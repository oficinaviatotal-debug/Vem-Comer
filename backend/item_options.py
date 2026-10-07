"""Opções por item: tamanho, adicionais, sabor, "sem cebola" e observação (migração 010).

O dono monta, para cada prato, grupos de escolha ("Tamanho": escolher 1; "Adicionais": até 5). O preço do
prato é o preço base e cada opção soma o seu `price_delta`. O cliente manda só os ids das opções
escolhidas e uma observação curta; o servidor confere tudo contra o cardápio e recalcula o preço. O valor
que o celular calculou nunca vale.

Este arquivo tem as regras e o SQL; as rotas em app.py conversam com o banco.

Regras que protegem a porta pública (o cliente não tem login):
- só vale opção que pertence àquele prato, daquele restaurante, e que esteja ligada;
- grupo obrigatório sem nenhuma escolha possível deixa o prato indisponível (não vende sem o tamanho);
- cada grupo respeita o mínimo e o máximo;
- a observação passa de 140 letras? Recusa, não corta: "alergia a amendoim" cortada no meio é perigo;
- o que o cliente escolheu fica COPIADO no pedido (nome e preço da hora), então mudar o cardápio depois
  não altera pedido antigo.
"""

from __future__ import annotations

import unicodedata
import uuid
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

MAX_GROUPS = 8
MAX_ITEMS_PER_GROUP = 30
MAX_SELECTED = 40
NAME_MAX = 60
NOTE_MAX = 140
MAX_DELTA = Decimal("999.99")
CENTS = Decimal("0.01")


class OptionError(ValueError):
    """Opção ou observação que não dá para aceitar; a mensagem vai para a tela."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class Resolution:
    """O que o cliente escolheu, já conferido: o quanto soma no preço e a cópia para guardar no pedido."""

    delta: Decimal
    chosen: list


NO_OPTIONS = Resolution(Decimal("0.00"), [])


# ---------------------------------------------------------------------------
# Texto
# ---------------------------------------------------------------------------

def _one_line(value: str) -> str:
    """Texto em uma linha: quebra de linha e tabulação viram espaço, caractere invisível sai, espaços juntos."""
    visible = "".join(
        " " if ch.isspace() else ch for ch in value if ch.isspace() or unicodedata.category(ch) not in ("Cc", "Cf")
    )
    return " ".join(visible.split())


def _clean_text(value, limit: int, what: str) -> str:
    """Nome de grupo ou de opção: uma linha, não vazio e até `limit` letras."""
    if not isinstance(value, str):
        raise OptionError(f"{what}: escreva um texto.")
    text = _one_line(value)
    if not text:
        raise OptionError(f"{what}: não pode ficar vazio.")
    if len(text) > limit:
        raise OptionError(f"{what}: use até {limit} letras.")
    return text


def clean_note(value) -> str | None:
    """Observação do cliente para a cozinha. Vazia vira None. Longa demais é recusada (nunca cortada)."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise OptionError("A observação precisa ser um texto.")
    text = _one_line(value)
    if not text:
        return None
    if len(text) > NOTE_MAX:
        raise OptionError(f"A observação passou de {NOTE_MAX} letras. Escreva menos, só o essencial.")
    return text


def parse_selected(value) -> list[str]:
    """Lista de ids de opção vinda do pedido (["uuid", ...]). Ausente é lista vazia."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise OptionError("Opções inválidas.")
    if len(value) > MAX_SELECTED:
        raise OptionError("Opções demais neste item.")
    seen: list[str] = []
    for raw in value:
        if not isinstance(raw, str):
            raise OptionError("Opção inválida.")
        try:
            option_id = str(uuid.UUID(raw))
        except ValueError:
            raise OptionError("Opção inválida.") from None
        if option_id in seen:
            raise OptionError("Opção repetida.")
        seen.append(option_id)
    return seen


def parse_money(value, what: str = "Preço") -> Decimal:
    """Valor em reais ("6,50", "6.5", 6.5) com duas casas. Não aceita negativo, nem passar de 999,99."""
    if isinstance(value, bool) or value is None:
        raise OptionError(f"{what}: valor inválido.")
    if isinstance(value, str):
        text = value.strip().replace("R$", "").replace(" ", "")
        if "," in text:
            text = text.replace(".", "").replace(",", ".")
    else:
        text = str(value)
    try:
        number = Decimal(text)
    except (InvalidOperation, ValueError):
        raise OptionError(f"{what}: valor inválido.") from None
    if not number.is_finite():
        raise OptionError(f"{what}: valor inválido.")
    number = number.quantize(CENTS, rounding=ROUND_HALF_UP)
    if number < 0:
        raise OptionError(f"{what}: não pode ser negativo.")
    if number > MAX_DELTA:
        raise OptionError(f"{what}: passou de R$ 999,99.")
    return number


# ---------------------------------------------------------------------------
# Leitura do banco
# ---------------------------------------------------------------------------

# Uma linha por opção (ou uma por grupo sem opção). Ordem: a que o dono montou.
GROUP_ROWS_FOR_PRODUCT = """
SELECT g.id AS group_id, g.name AS group_name, g.min_choices, g.max_choices,
       i.id AS item_id, i.name AS item_name, i.price_delta, i.active AS item_active
FROM option_groups g
LEFT JOIN option_items i ON i.group_id = g.id
WHERE g.company_id = %s AND g.product_id = %s
ORDER BY g.position, g.name, i.position, i.name;
"""

GROUP_ROWS_FOR_COMPANY = """
SELECT g.product_id, g.id AS group_id, g.name AS group_name, g.min_choices, g.max_choices,
       i.id AS item_id, i.name AS item_name, i.price_delta, i.active AS item_active
FROM option_groups g
LEFT JOIN option_items i ON i.group_id = g.id
WHERE g.company_id = %s
ORDER BY g.product_id, g.position, g.name, i.position, i.name;
"""


def build_groups(rows) -> list[dict]:
    """Junta as linhas planas do banco em grupos com suas opções, na ordem em que chegaram."""
    groups: list[dict] = []
    by_id: dict[str, dict] = {}
    for row in rows:
        group_id = str(row["group_id"])
        group = by_id.get(group_id)
        if group is None:
            group = {
                "id": group_id,
                "name": row["group_name"],
                "min_choices": row["min_choices"],
                "max_choices": row["max_choices"],
                "items": [],
            }
            by_id[group_id] = group
            groups.append(group)
        if row.get("item_id") is not None:
            group["items"].append(
                {
                    "id": str(row["item_id"]),
                    "name": row["item_name"],
                    "price_delta": row["price_delta"],
                    "active": bool(row["item_active"]),
                }
            )
    return groups


def groups_by_product(rows) -> dict[str, list[dict]]:
    """Linhas do restaurante inteiro (GROUP_ROWS_FOR_COMPANY) -> {id do prato: grupos}."""
    per_product: dict[str, list] = {}
    for row in rows:
        per_product.setdefault(str(row["product_id"]), []).append(row)
    return {product_id: build_groups(product_rows) for product_id, product_rows in per_product.items()}


def public_view(groups: list[dict]) -> list[dict]:
    """O que o cardápio mostra ao cliente: só opção ligada, sem o campo `active`.

    Grupo cujas opções estão todas desligadas continua na lista, com `items` vazio: a tela mostra
    "indisponível agora" em vez de vender o prato sem a escolha obrigatória.
    """
    return [
        {
            "id": group["id"],
            "name": group["name"],
            "min_choices": group["min_choices"],
            "max_choices": group["max_choices"],
            "items": [
                {"id": item["id"], "name": item["name"], "price_delta": item["price_delta"]}
                for item in group["items"]
                if item["active"]
            ],
        }
        for group in groups
    ]


def fetch_groups(cur, company_id, product_id) -> list[dict]:
    """Os grupos de um prato (com as opções desligadas também), para conferir o pedido e para o painel."""
    cur.execute(GROUP_ROWS_FOR_PRODUCT, (str(company_id), str(product_id)))
    return build_groups(cur.fetchall())


# ---------------------------------------------------------------------------
# Conferir o que o cliente escolheu
# ---------------------------------------------------------------------------

def resolve(groups: list[dict], selected: list[str]) -> Resolution:
    """Confere as opções escolhidas contra os grupos do prato e devolve o acréscimo de preço.

    `groups` vem de `build_groups` / `fetch_groups`; `selected` vem de `parse_selected`.
    Levanta OptionError com uma frase que o cliente entende.
    """
    index = {}
    for group in groups:
        for item in group["items"]:
            index[item["id"]] = (group, item)

    chosen_per_group: dict[str, list[dict]] = {group["id"]: [] for group in groups}
    for option_id in selected:
        found = index.get(option_id)
        if found is None:
            raise OptionError("Uma das opções escolhidas não existe mais. Atualize o cardápio e escolha de novo.")
        group, item = found
        if not item["active"]:
            raise OptionError(f"{item['name']} acabou. Escolha outra opção.")
        chosen_per_group[group["id"]].append(item)

    delta = Decimal("0.00")
    chosen: list[dict] = []
    for group in groups:
        picked = chosen_per_group[group["id"]]
        active_count = sum(1 for item in group["items"] if item["active"])
        minimum = group["min_choices"]
        maximum = group["max_choices"]

        if active_count < minimum:
            raise OptionError(f"{group['name']}: indisponível agora. Peça outro item ou chame o atendente.")
        if len(picked) < minimum:
            if minimum == 1 and maximum == 1:
                raise OptionError(f"Escolha uma opção em {group['name']}.")
            raise OptionError(f"Em {group['name']}, escolha pelo menos {minimum}.")
        if len(picked) > maximum:
            raise OptionError(
                f"Em {group['name']}, escolha só uma opção." if maximum == 1 else f"Em {group['name']}, escolha no máximo {maximum}."
            )

        for item in picked:
            price = Decimal(str(item["price_delta"])).quantize(CENTS, rounding=ROUND_HALF_UP)
            delta += price
            chosen.append({"group": group["name"], "name": item["name"], "price": format(price, ".2f")})

    return Resolution(delta.quantize(CENTS, rounding=ROUND_HALF_UP), chosen)


# ---------------------------------------------------------------------------
# Painel: o dono monta os grupos
# ---------------------------------------------------------------------------

def _optional_id(raw) -> str | None:
    if raw is None or raw == "":
        return None
    if not isinstance(raw, str):
        raise OptionError("Identificador inválido.")
    try:
        return str(uuid.UUID(raw))
    except ValueError:
        raise OptionError("Identificador inválido.") from None


def _whole_number(value, what: str, default: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise OptionError(f"{what}: use um número inteiro.")
    return value


def normalize_groups(payload) -> list[dict]:
    """Confere o que o painel mandou ({"groups": [...]}) e devolve os grupos limpos, na ordem.

    Cada grupo: name, min_choices (0 = opcional, 1 = obrigatório), max_choices (1 = escolher uma; mais =
    várias), items [{name, price_delta, active}]. `id` é opcional e serve para manter a opção quando o dono
    só muda o preço (o carrinho de quem está pedindo agora não quebra). Lista vazia tira todas as opções.
    """
    raw_groups = payload.get("groups") if isinstance(payload, dict) else None
    if not isinstance(raw_groups, list):
        raise OptionError("Mande a lista de grupos de opções.")
    if len(raw_groups) > MAX_GROUPS:
        raise OptionError(f"Use no máximo {MAX_GROUPS} grupos de opções por item.")

    groups: list[dict] = []
    group_names: set[str] = set()
    for raw in raw_groups:
        if not isinstance(raw, dict):
            raise OptionError("Grupo inválido.")
        name = _clean_text(raw.get("name"), NAME_MAX, "Nome do grupo")
        if name.casefold() in group_names:
            raise OptionError(f"Dois grupos com o nome {name}. Use nomes diferentes.")
        group_names.add(name.casefold())

        raw_items = raw.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            raise OptionError(f"{name}: coloque pelo menos uma opção.")
        if len(raw_items) > MAX_ITEMS_PER_GROUP:
            raise OptionError(f"{name}: use no máximo {MAX_ITEMS_PER_GROUP} opções.")

        items: list[dict] = []
        item_names: set[str] = set()
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                raise OptionError(f"{name}: opção inválida.")
            item_name = _clean_text(raw_item.get("name"), NAME_MAX, f"{name}: nome da opção")
            if item_name.casefold() in item_names:
                raise OptionError(f"{name}: a opção {item_name} está repetida.")
            item_names.add(item_name.casefold())
            active = raw_item.get("active", True)
            if not isinstance(active, bool):
                raise OptionError(f"{name}: 'ligada' precisa ser sim ou não.")
            raw_price = raw_item.get("price_delta")
            items.append(
                {
                    "id": _optional_id(raw_item.get("id")),
                    "name": item_name,
                    "price_delta": parse_money(0 if raw_price in (None, "") else raw_price, f"{name} / {item_name}: preço"),
                    "active": active,
                }
            )

        minimum = _whole_number(raw.get("min_choices"), f"{name}: mínimo", 0)
        maximum = _whole_number(raw.get("max_choices"), f"{name}: máximo", 1)
        if minimum < 0 or minimum > 20:
            raise OptionError(f"{name}: o mínimo vai de 0 a 20.")
        if maximum < 1:
            raise OptionError(f"{name}: o máximo é pelo menos 1.")
        maximum = min(maximum, len(items), 20)
        if minimum > len(items):
            raise OptionError(f"{name}: o mínimo ({minimum}) é maior que o número de opções ({len(items)}).")
        if minimum > maximum:
            raise OptionError(f"{name}: o mínimo não pode ser maior que o máximo.")

        groups.append(
            {
                "id": _optional_id(raw.get("id")),
                "name": name,
                "min_choices": minimum,
                "max_choices": maximum,
                "items": items,
            }
        )
    return groups


def save_groups(cur, company_id, product_id, groups: list[dict]) -> None:
    """Grava os grupos de um prato no lugar dos antigos, mantendo os ids que o dono não trocou.

    Quem não está na lista nova é apagado (as opções saem junto, o pedido antigo não muda porque guarda
    uma cópia). Id desconhecido, ou de outro grupo, vira opção nova: o cliente nunca escolhe o id.
    O chamador abre e fecha a transação.
    """
    company = str(company_id)
    product = str(product_id)

    cur.execute(
        "SELECT id FROM option_groups WHERE company_id = %s AND product_id = %s;",
        (company, product),
    )
    existing_groups = {str(row["id"]) for row in cur.fetchall()}
    cur.execute(
        """
        SELECT i.id, i.group_id
        FROM option_items i
        JOIN option_groups g ON g.id = i.group_id
        WHERE g.company_id = %s AND g.product_id = %s;
        """,
        (company, product),
    )
    existing_items = {str(row["id"]): str(row["group_id"]) for row in cur.fetchall()}

    kept_groups: list[str] = []
    kept_items: list[str] = []

    for group_position, group in enumerate(groups):
        group_id = group.get("id")
        if group_id in existing_groups and group_id not in kept_groups:
            cur.execute(
                """
                UPDATE option_groups
                SET name = %s, min_choices = %s, max_choices = %s, position = %s
                WHERE id = %s AND company_id = %s AND product_id = %s;
                """,
                (group["name"], group["min_choices"], group["max_choices"], group_position, group_id, company, product),
            )
        else:
            cur.execute(
                """
                INSERT INTO option_groups (company_id, product_id, name, min_choices, max_choices, position)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (company, product, group["name"], group["min_choices"], group["max_choices"], group_position),
            )
            group_id = str(cur.fetchone()["id"])
        kept_groups.append(group_id)

        for item_position, item in enumerate(group["items"]):
            item_id = item.get("id")
            if item_id in existing_items and existing_items[item_id] == group_id and item_id not in kept_items:
                cur.execute(
                    """
                    UPDATE option_items
                    SET name = %s, price_delta = %s, active = %s, position = %s
                    WHERE id = %s AND group_id = %s;
                    """,
                    (item["name"], item["price_delta"], item["active"], item_position, item_id, group_id),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO option_items (group_id, name, price_delta, active, position)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id;
                    """,
                    (group_id, item["name"], item["price_delta"], item["active"], item_position),
                )
                item_id = str(cur.fetchone()["id"])
            kept_items.append(item_id)

    cur.execute(
        "DELETE FROM option_items WHERE group_id = ANY(%s::uuid[]) AND id <> ALL(%s::uuid[]);",
        (kept_groups, kept_items),
    )
    cur.execute(
        "DELETE FROM option_groups WHERE company_id = %s AND product_id = %s AND id <> ALL(%s::uuid[]);",
        (company, product, kept_groups),
    )
