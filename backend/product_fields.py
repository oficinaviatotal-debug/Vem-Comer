"""Nome, texto, preco e categoria de um prato: a mesma regra para criar e para mudar.

Tudo e conferido ANTES de falar com o banco, e o que e recusado volta com uma frase em
portugues simples, que a tela do painel mostra como veio:

- nome de 1 a 150 letras e texto de ate 500, numa linha so (sem quebra nem caractere de
  controle, espacos juntos);
- preco maior que zero e ate 99.999,99, com duas casas ("6,5", "R$ 6,50" e 6.5 valem o mesmo);
- categoria: vazia (sem categoria) ou o identificador de uma categoria; que ela e deste
  restaurante quem confere e a rota, no banco;
- dois pratos com o mesmo nome (sem acento e sem maiuscula) na mesma categoria nao valem.

Quem le a mesma regra e a conta do importador de cardapio (`menu_import`): os limites sao os
dele, para um prato nao poder ser criado de um jeito e recusado de outro.
"""

import uuid

import menu_import

NAME_MAX = menu_import.MAX_ITEM_NAME
TEXT_MAX = menu_import.MAX_DESCRIPTION

NAME_MISSING = "Escreva o nome do prato."
NAME_TOO_LONG = f"O nome do prato pode ter até {NAME_MAX} letras."
TEXT_NOT_TEXT = "O texto do prato precisa ser escrito em letras."
TEXT_TOO_LONG = f"O texto do prato pode ter até {TEXT_MAX} letras."
PRICE_BAD = "Escreva um preço maior que zero."
MENU_BAD = "Categoria inválida."
NOT_JSON = "Mande os dados do prato."
NOTHING_TO_CHANGE = "Diga o que mudar no prato."
TWICE = "Já existe um prato com esse nome nesta categoria."
ORDERED = (
    "Este prato já foi pedido. Se for apagado, some também dos pedidos antigos e das vendas. "
    "Para tirar do ar, toque em Esgotou."
)

# Tamanho de folga para ler o texto inteiro e so entao dizer que passou do limite
# (cortar em silencio faria o dono achar que o nome saiu como ele escreveu).
_READ_LIMIT = 100_000


def _line(value):
    """Texto de uma linha so, aparado. Vazio quando nao e texto."""
    return menu_import.clean_text(value, _READ_LIMIT)


def _menu_id(value):
    """(identificador, ok). Vazio e 'sem categoria'; o que nao e um identificador e recusado."""
    if value is None or value == "":
        return None, True
    if not isinstance(value, str):
        return None, False
    try:
        return str(uuid.UUID(value.strip())), True
    except ValueError:
        return None, False


def read_fields(data, *, creating):
    """(campos, problema). Ao criar, nome e preco sao obrigatorios e o resto tem padrao.

    Ao mudar, vem so o que veio: um campo que nao veio nao muda. `menu_id` presente e vazio
    tira o prato da categoria (sem categoria). O preco volta como Decimal com duas casas.
    """
    if not isinstance(data, dict):
        return None, NOT_JSON

    fields = {}

    if creating or "name" in data:
        name = _line(data.get("name"))
        if not name:
            return None, NAME_MISSING
        if len(name) > NAME_MAX:
            return None, NAME_TOO_LONG
        fields["name"] = name

    if creating or "description" in data:
        raw = data.get("description")
        if raw is not None and not isinstance(raw, str):
            return None, TEXT_NOT_TEXT
        text = _line(raw) if raw else ""
        if len(text) > TEXT_MAX:
            return None, TEXT_TOO_LONG
        fields["description"] = text

    if creating or "price" in data:
        price = menu_import.parse_price(data.get("price"))
        if price is None:
            return None, PRICE_BAD
        fields["price"] = price

    if creating or "menu_id" in data:
        menu_id, ok = _menu_id(data.get("menu_id"))
        if not ok:
            return None, MENU_BAD
        fields["menu_id"] = menu_id

    return fields, None


def is_twice(name, others):
    """O nome ja esta entre os `others` (nomes dos outros pratos da mesma categoria)?"""
    key = menu_import.normalize_key(name)
    return any(menu_import.normalize_key(other or "") == key for other in others)
