"""Entrega e retirada: regiões por CEP com taxa, pedido mínimo, endereço e telefone (migração 011).

O que o GD vende é cardápio, venda e entrega. O restaurante cadastra as regiões que atende, cada uma com os CEPs
que ela cobre (só o começo do CEP: "30140" cobre de 30140-000 a 30140-999), a taxa, o pedido mínimo e o prazo
combinado. Sem serviço de mapa pago: o CEP decide a região.

O cliente manda o CEP e o endereço; o servidor acha a região, confere o pedido mínimo e SOMA a taxa ao total.
O valor da taxa que o celular mostrou nunca vale, como o preço dos pratos.

Este arquivo tem as regras e o SQL; as rotas em app.py conversam com o banco.

Regras:
- vale a região ativa cujo começo de CEP é o mais longo e bate com o CEP (30140 ganha de 301);
- entrega pausada ("hoje não estamos entregando") ou sem nenhuma região ativa: recusa, com frase clara;
- pedido de mesa não tem entrega; mesa e retirada não pagam taxa;
- o endereço e a região ficam COPIADOS no pedido: mudar a região amanhã não altera o pedido de hoje;
- telefone e endereço são dados pessoais: só o dono do restaurante e o próprio cliente (pelo código de
  acompanhamento) leem.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

MAX_ZONES = 20
MAX_PREFIXES = 40
NAME_MAX = 60
MAX_FEE = Decimal("999.99")
MAX_MIN_ORDER = Decimal("9999.99")
ETA_MIN = 5
ETA_MAX = 240
CENTS = Decimal("0.01")

ORDER_TYPES = ("mesa", "retirada", "entrega", "balcao")

DEFAULT_CUSTOMER_NAME = "Cliente Balcão"

ADDRESS_LIMITS = {
    "street": 120,
    "number": 20,
    "complement": 60,
    "neighborhood": 80,
    "city": 80,
    "reference": 120,
}


class DeliveryError(ValueError):
    """Região, endereço ou pedido de entrega que não dá para aceitar; a mensagem vai para a tela."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class Handling:
    """Como o pedido será entregue, já conferido: o que gravar e o quanto soma ao total."""

    order_type: str
    fee: Decimal
    zone: str | None
    address: dict | None
    phone: str | None


# --------------------------------------------------------------------------------------------- texto

def _one_line(value: str) -> str:
    visible = "".join(
        " " if ch.isspace() else ch for ch in value if ch.isspace() or unicodedata.category(ch) not in ("Cc", "Cf")
    )
    return " ".join(visible.split())


def _same(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold()


def _text(value, limit: int, what: str, required: bool = False) -> str | None:
    if value is None or value == "":
        if required:
            raise DeliveryError(f"{what}: preencha.")
        return None
    if not isinstance(value, str):
        raise DeliveryError(f"{what}: escreva um texto.")
    text = _one_line(value)
    if not text:
        if required:
            raise DeliveryError(f"{what}: preencha.")
        return None
    if len(text) > limit:
        raise DeliveryError(f"{what}: use até {limit} letras.")
    return text


def _money(value, what: str, maximum: Decimal) -> Decimal:
    """Reais como o dono escreve ("5", "5,50", "R$ 5,50"). Vazio é zero (taxa grátis, sem pedido mínimo)."""
    if value is None or value == "":
        return Decimal("0.00")
    if isinstance(value, bool):
        raise DeliveryError(f"{what}: valor inválido.")
    if isinstance(value, str):
        text = value.strip().lower().replace("r$", "").replace(" ", "")
        if not text:
            return Decimal("0.00")
        if "," in text:
            text = text.replace(".", "").replace(",", ".")
    elif isinstance(value, (int, float, Decimal)):
        text = str(value)
    else:
        raise DeliveryError(f"{what}: valor inválido.")
    try:
        amount = Decimal(text)
    except InvalidOperation:
        raise DeliveryError(f"{what}: valor inválido.") from None
    if not amount.is_finite() or amount < 0:
        raise DeliveryError(f"{what}: valor inválido.")
    amount = amount.quantize(CENTS, rounding=ROUND_HALF_UP)
    if amount > maximum:
        raise DeliveryError(f"{what}: passou do máximo de R$ {str(maximum).replace('.', ',')}.")
    return amount


def _flag(data: dict, key: str, default: bool, what: str) -> bool:
    if key not in data or data[key] is None:
        return default
    if not isinstance(data[key], bool):
        raise DeliveryError(f"{what}: valor inválido.")
    return data[key]


# ------------------------------------------------------------------------------------------------ CEP

def clean_cep(value) -> str | None:
    """8 dígitos, ou None quando não é um CEP ("30140-071", "30140071", " 30.140-071 ")."""
    if not isinstance(value, str):
        return None
    digits = re.sub(r"\D", "", value)
    return digits if len(digits) == 8 else None


def parse_prefixes(value) -> list[str]:
    """Os começos de CEP de uma região: "30140, 30150-9" ou ["30140", "30150-9"]. De 3 a 8 dígitos cada."""
    if isinstance(value, str):
        pieces = re.split(r"[,;\s]+", value)
    elif isinstance(value, list):
        pieces = []
        for piece in value:
            if not isinstance(piece, str):
                raise DeliveryError("CEP da região: escreva só números.")
            pieces.extend(re.split(r"[,;\s]+", piece))
    else:
        raise DeliveryError("Região sem CEP: escreva o começo dos CEPs que ela cobre.")

    prefixes: list[str] = []
    for piece in pieces:
        if not piece:
            continue
        digits = re.sub(r"\D", "", piece)
        if not digits:
            raise DeliveryError(f"CEP da região: \"{piece}\" não tem números.")
        if not 3 <= len(digits) <= 8:
            raise DeliveryError(f"CEP da região: \"{piece}\" precisa ter de 3 a 8 números (o começo do CEP).")
        if digits not in prefixes:
            prefixes.append(digits)

    if not prefixes:
        raise DeliveryError("Região sem CEP: escreva o começo dos CEPs que ela cobre.")
    if len(prefixes) > MAX_PREFIXES:
        raise DeliveryError(f"Use no máximo {MAX_PREFIXES} começos de CEP por região.")
    return prefixes


# ------------------------------------------------------------------------------- o que o dono salva

def _valid_uuid(value) -> str | None:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        return None


def normalize_settings(data) -> dict:
    """Confere o que o painel mandou. Devolve {"accepts_pickup", "delivery_paused", "zones": [...]} limpo."""
    if not isinstance(data, dict):
        raise DeliveryError("Envie as regiões de entrega.")

    accepts_pickup = _flag(data, "accepts_pickup", True, "Retirada")
    delivery_paused = _flag(data, "delivery_paused", False, "Pausa da entrega")

    # "zones" é obrigatório: um envio sem a lista apagaria todas as regiões sem o dono perceber.
    raw_zones = data.get("zones")
    if not isinstance(raw_zones, list):
        raise DeliveryError("As regiões precisam vir em uma lista (pode ser vazia).")
    if len(raw_zones) > MAX_ZONES:
        raise DeliveryError(f"Use no máximo {MAX_ZONES} regiões.")

    zones: list[dict] = []
    names: set[str] = set()
    for index, raw in enumerate(raw_zones):
        if not isinstance(raw, dict):
            raise DeliveryError("Região inválida.")
        name = _text(raw.get("name"), NAME_MAX, f"Região {index + 1}: nome", required=True)
        assert name is not None
        key = _same(name)
        if key in names:
            raise DeliveryError(f"Duas regiões com o nome {name}. Use nomes diferentes.")
        names.add(key)

        prefixes = parse_prefixes(raw.get("cep_prefixes"))
        fee = _money(raw.get("fee"), f"{name}: taxa", MAX_FEE)
        min_order = _money(raw.get("min_order"), f"{name}: pedido mínimo", MAX_MIN_ORDER)

        eta = raw.get("eta_minutes")
        if eta in (None, ""):
            eta = None
        elif isinstance(eta, bool) or not isinstance(eta, (int, str)) or not str(eta).strip().isdigit():
            raise DeliveryError(f"{name}: o prazo é em minutos, só números.")
        else:
            eta = int(str(eta).strip())
            if not ETA_MIN <= eta <= ETA_MAX:
                raise DeliveryError(f"{name}: o prazo precisa ficar entre {ETA_MIN} e {ETA_MAX} minutos.")

        zones.append(
            {
                "id": _valid_uuid(raw.get("id")),
                "name": name,
                "cep_prefixes": prefixes,
                "fee": fee,
                "min_order": min_order,
                "eta_minutes": eta,
                "active": _flag(raw, "active", True, f"{name}: ligada"),
            }
        )

    return {"accepts_pickup": accepts_pickup, "delivery_paused": delivery_paused, "zones": zones}


# --------------------------------------------------------------------------- achar a região do CEP

def match_zone(zones: list[dict], cep: str) -> dict | None:
    """A região ativa cujo começo de CEP é o mais longo e bate com `cep`. Empate: a mais barata, depois a primeira."""
    best: tuple[int, Decimal, int] | None = None
    chosen: dict | None = None
    for position, zone in enumerate(zones):
        if not zone.get("active", True):
            continue
        longest = max((len(prefix) for prefix in zone["cep_prefixes"] if cep.startswith(prefix)), default=0)
        if longest == 0:
            continue
        rank = (-longest, Decimal(zone["fee"]), position)
        if best is None or rank < best:
            best = rank
            chosen = zone
    return chosen


def is_delivering(company: dict | None, zones: list[dict]) -> bool:
    return bool(company) and not company.get("delivery_paused") and any(z.get("active", True) for z in zones)


def quote(company: dict | None, zones: list[dict], cep_text) -> dict:
    """A resposta para "entrega neste CEP?": a região, a taxa e o pedido mínimo, ou o motivo de não."""
    cep = clean_cep(cep_text)
    if cep is None:
        return {"available": False, "reason": "invalid_cep", "message": "Escreva o CEP com 8 números."}
    if company and company.get("delivery_paused"):
        return {
            "available": False,
            "reason": "paused",
            "message": "A entrega está pausada agora. Você pode retirar ou tentar mais tarde.",
        }
    if not is_delivering(company, zones):
        return {"available": False, "reason": "no_delivery", "message": "Este restaurante não faz entrega."}
    zone = match_zone(zones, cep)
    if zone is None:
        return {
            "available": False,
            "reason": "out_of_area",
            "message": "Ainda não entregamos nesse CEP. Você pode retirar no local.",
        }
    return {
        "available": True,
        "zone": zone["name"],
        "fee": str(Decimal(zone["fee"]).quantize(CENTS)),
        "min_order": str(Decimal(zone["min_order"]).quantize(CENTS)),
        "eta_minutes": zone.get("eta_minutes"),
    }


# ---------------------------------------------------------------------------- endereço e telefone

def parse_phone(value, required: bool) -> str | None:
    """Telefone brasileiro só com números (DDD + número). Vazio é permitido só quando não é obrigatório."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise DeliveryError("Informe um telefone com DDD para o entregador avisar.")
        return None
    if not isinstance(value, str):
        raise DeliveryError("Telefone inválido. Escreva com DDD.")
    digits = re.sub(r"\D", "", value)
    if len(digits) in (12, 13) and digits.startswith("55"):
        digits = digits[2:]
    valid_ddd = len(digits) in (10, 11) and "11" <= digits[:2] <= "99"
    if not valid_ddd or (len(digits) == 11 and digits[2] != "9"):
        raise DeliveryError("Telefone inválido. Escreva com DDD, por exemplo 31 99999-8888.")
    return digits


def parse_address(value) -> dict:
    """Endereço de entrega limpo: CEP, rua, número e bairro são obrigatórios."""
    if not isinstance(value, dict):
        raise DeliveryError("Informe o endereço de entrega.")
    cep = clean_cep(value.get("cep"))
    if cep is None:
        raise DeliveryError("Endereço: escreva o CEP com 8 números.")

    labels = {
        "street": "rua",
        "number": "número",
        "complement": "complemento",
        "neighborhood": "bairro",
        "city": "cidade",
        "reference": "ponto de referência",
    }
    required = {"street", "number", "neighborhood"}
    address: dict = {"cep": cep}
    for key, limit in ADDRESS_LIMITS.items():
        text = _text(value.get(key), limit, f"Endereço: {labels[key]}", required=key in required)
        if text:
            address[key] = text
    return address


# ----------------------------------------------------------------------------- o pedido (a regra)

def resolve_handling(
    company: dict | None,
    zones: list[dict],
    *,
    order_type,
    has_table: bool,
    address,
    phone,
    customer_name: str,
    subtotal: Decimal,
) -> Handling:
    """Decide o tipo do pedido, a taxa e o que gravar. `subtotal` é a soma dos pratos, já conferida no servidor.

    Sem tipo e sem mesa o pedido é de balcão, como sempre foi (celular com a versão antiga continua pedindo).
    """
    if company is None:
        raise DeliveryError("Estabelecimento inválido.")

    if order_type is not None and order_type not in ORDER_TYPES:
        raise DeliveryError("Tipo de pedido inválido.")

    if has_table:
        if order_type not in (None, "mesa"):
            raise DeliveryError("Pedido de mesa não tem entrega nem retirada.")
        return Handling("mesa", Decimal("0.00"), None, None, parse_phone(phone, required=False))

    if order_type in (None, "balcao"):
        return Handling("balcao", Decimal("0.00"), None, None, parse_phone(phone, required=False))

    if order_type == "mesa":
        raise DeliveryError("Pedido de mesa precisa da mesa. Leia o QR da mesa de novo.")

    if order_type == "retirada":
        if not company.get("accepts_pickup", True):
            raise DeliveryError("Este restaurante não está aceitando retirada. Escolha entrega ou fale com a casa.")
        return Handling("retirada", Decimal("0.00"), None, None, parse_phone(phone, required=False))

    # entrega
    if company.get("delivery_paused"):
        raise DeliveryError("A entrega está pausada agora. Você pode retirar ou tentar mais tarde.")
    if not is_delivering(company, zones):
        raise DeliveryError("Este restaurante não faz entrega.")
    if not customer_name or customer_name == DEFAULT_CUSTOMER_NAME:
        raise DeliveryError("Informe seu nome para a entrega.")

    clean_address = parse_address(address)
    clean_phone = parse_phone(phone, required=True)

    zone = match_zone(zones, clean_address["cep"])
    if zone is None:
        raise DeliveryError("Ainda não entregamos nesse CEP. Você pode retirar no local.")

    minimum = Decimal(zone["min_order"])
    if subtotal < minimum:
        raise DeliveryError(
            f"O pedido mínimo para {zone['name']} é R$ {str(minimum.quantize(CENTS)).replace('.', ',')}. "
            "Adicione mais itens ou escolha retirar."
        )

    return Handling("entrega", Decimal(zone["fee"]).quantize(CENTS), zone["name"], clean_address, clean_phone)


# ---------------------------------------------------------------------------------------------- SQL

COMPANY_FLAGS_SQL = "SELECT accepts_pickup, delivery_paused FROM companies WHERE id = %s;"

ZONE_ROWS_SQL = """
SELECT id, name, cep_prefixes, fee, min_order, eta_minutes, active
FROM delivery_zones
WHERE company_id = %s
ORDER BY position, created_at, id;
"""


def fetch_company_flags(cur, company_id) -> dict | None:
    cur.execute(COMPANY_FLAGS_SQL, (str(company_id),))
    return cur.fetchone()


def fetch_zones(cur, company_id) -> list[dict]:
    cur.execute(ZONE_ROWS_SQL, (str(company_id),))
    return [zone_from_row(row) for row in cur.fetchall()]


def zone_from_row(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "cep_prefixes": list(row["cep_prefixes"] or []),
        "fee": row["fee"],
        "min_order": row["min_order"],
        "eta_minutes": row["eta_minutes"],
        "active": bool(row["active"]),
    }


def admin_view(company: dict | None, zones: list[dict]) -> dict:
    """O que o painel do dono lê: tudo, com os ids e os começos de CEP."""
    return {
        "accepts_pickup": bool(company.get("accepts_pickup", True)) if company else True,
        "delivery_paused": bool(company.get("delivery_paused", False)) if company else False,
        "zones": [
            {
                "id": zone["id"],
                "name": zone["name"],
                "cep_prefixes": zone["cep_prefixes"],
                "fee": str(Decimal(zone["fee"]).quantize(CENTS)),
                "min_order": str(Decimal(zone["min_order"]).quantize(CENTS)),
                "eta_minutes": zone["eta_minutes"],
                "active": zone["active"],
            }
            for zone in zones
        ],
    }


def public_view(company: dict | None, zones: list[dict]) -> dict:
    """O que o cardápio público lê: se retira, se entrega, e as regiões ligadas (nome, taxa, mínimo, prazo)."""
    active = [zone for zone in zones if zone["active"]]
    delivering = is_delivering(company, zones)
    return {
        "pickup": bool(company.get("accepts_pickup", True)) if company else True,
        "delivery": delivering,
        "paused": bool(company and company.get("delivery_paused") and active),
        "zones": [
            {
                "name": zone["name"],
                "fee": str(Decimal(zone["fee"]).quantize(CENTS)),
                "min_order": str(Decimal(zone["min_order"]).quantize(CENTS)),
                "eta_minutes": zone["eta_minutes"],
            }
            for zone in active
        ]
        if delivering
        else [],
    }


def save_settings(cur, company_id, settings: dict) -> None:
    """Grava a retirada, a pausa e as regiões no lugar das antigas, mantendo os ids que o dono não trocou.

    Região que saiu da lista é apagada (o pedido antigo não muda: guarda o nome e a taxa da hora). Id desconhecido
    ou de outro restaurante vira região nova. O chamador abre e fecha a transação.
    """
    company = str(company_id)
    cur.execute(
        "UPDATE companies SET accepts_pickup = %s, delivery_paused = %s WHERE id = %s;",
        (settings["accepts_pickup"], settings["delivery_paused"], company),
    )
    cur.execute("SELECT id FROM delivery_zones WHERE company_id = %s;", (company,))
    existing = {str(row["id"]) for row in cur.fetchall()}

    kept: list[str] = []
    for position, zone in enumerate(settings["zones"]):
        zone_id = zone.get("id")
        values = (
            zone["name"],
            zone["cep_prefixes"],
            zone["fee"],
            zone["min_order"],
            zone["eta_minutes"],
            zone["active"],
            position,
        )
        if zone_id in existing and zone_id not in kept:
            cur.execute(
                """
                UPDATE delivery_zones
                SET name = %s, cep_prefixes = %s, fee = %s, min_order = %s, eta_minutes = %s, active = %s, position = %s
                WHERE id = %s AND company_id = %s;
                """,
                values + (zone_id, company),
            )
        else:
            cur.execute(
                """
                INSERT INTO delivery_zones (name, cep_prefixes, fee, min_order, eta_minutes, active, position, company_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
                """,
                values + (company,),
            )
            zone_id = str(cur.fetchone()["id"])
        kept.append(zone_id)

    cur.execute(
        "DELETE FROM delivery_zones WHERE company_id = %s AND id <> ALL(%s::uuid[]);",
        (company, kept),
    )
