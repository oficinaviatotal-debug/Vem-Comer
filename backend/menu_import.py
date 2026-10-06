"""Register a whole menu in one request (categories and dishes at once).

This is the server side of the voice assistant: the owner says or taps his
dishes, the phone turns that into the structure below and sends it here in a
single call. Everything is validated first; nothing is written when something
is wrong, and the writes happen in one transaction (the caller commits).

Payload:
    {"categories": [
        {"name": "Lanches", "items": [
            {"name": "X-Burguer", "price": "18,50", "description": "opcional"}
        ]}
    ]}

Re-sending the same menu is harmless: a category that already exists is reused
(accents and capital letters do not matter) and a dish that already exists in
it is skipped, never duplicated and never overwritten.
"""

import re
import unicodedata
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

MAX_CATEGORIES = 30
MAX_ITEMS = 300
MAX_CATEGORY_NAME = 100  # menus.name is VARCHAR(100)
MAX_ITEM_NAME = 150  # products.name is VARCHAR(150)
MAX_DESCRIPTION = 500
MAX_PRICE = Decimal("99999.99")

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_SPACES = re.compile(r"\s+")


def clean_text(value, max_length):
    """Plain single-line text, trimmed. Returns "" when there is nothing usable."""
    if not isinstance(value, str):
        return ""
    text = _CONTROL_CHARS.sub(" ", value)
    text = _SPACES.sub(" ", text).strip()
    return text[:max_length].strip()


def normalize_key(text):
    """Comparison key: no accents, no capitals, single spaces."""
    decomposed = unicodedata.normalize("NFKD", text)
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return _SPACES.sub(" ", without_accents).strip().casefold()


def parse_price(value):
    """Decimal with two places, or None when it is not a usable price.

    Accepts 18, 18.5, "18,50", "R$ 18,50" and "1.234,50". Zero, negative,
    boolean and absurdly large values are refused: a price of zero here almost
    always means "the price was never said".
    """
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float, Decimal)):
        text = str(value)
    elif isinstance(value, str):
        text = value.strip().lower().replace("r$", "").replace(" ", "")
        if "," in text:
            # Brazilian format: dots group thousands, the comma is the decimal mark.
            text = text.replace(".", "").replace(",", ".")
    else:
        return None

    try:
        price = Decimal(text)
    except InvalidOperation:
        return None

    if not price.is_finite():
        return None

    price = price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if price <= 0 or price > MAX_PRICE:
        return None

    return price


def validate_payload(data):
    """Check and clean the payload.

    Returns (categories, None) on success or (None, "mensagem") on failure, where
    categories is a list of {"name": str, "items": [{"name", "price", "description"}]}.
    Repeated categories are merged and repeated dishes inside one category are
    dropped (the first one wins), so the result never contains duplicates.
    """
    if not isinstance(data, dict):
        return None, "Envie as categorias e os pratos"

    raw_categories = data.get("categories")

    if not isinstance(raw_categories, list) or not raw_categories:
        return None, "Envie pelo menos uma categoria com pratos"

    if len(raw_categories) > MAX_CATEGORIES:
        return None, f"No maximo {MAX_CATEGORIES} categorias por vez"

    categories = []
    by_key = {}
    total_items = 0

    for raw_category in raw_categories:
        if not isinstance(raw_category, dict):
            return None, "Categoria invalida"

        name = clean_text(raw_category.get("name"), MAX_CATEGORY_NAME)

        if not name:
            return None, "Toda categoria precisa de um nome"

        raw_items = raw_category.get("items")

        if not isinstance(raw_items, list) or not raw_items:
            return None, f"A categoria '{name}' esta sem pratos"

        key = normalize_key(name)
        category = by_key.get(key)

        if category is None:
            category = {"name": name, "items": [], "_seen": set()}
            by_key[key] = category
            categories.append(category)

        for raw_item in raw_items:
            total_items += 1

            if total_items > MAX_ITEMS:
                return None, f"No maximo {MAX_ITEMS} pratos por vez"

            if not isinstance(raw_item, dict):
                return None, "Prato invalido"

            item_name = clean_text(raw_item.get("name"), MAX_ITEM_NAME)

            if not item_name:
                return None, f"Todo prato precisa de um nome (categoria '{name}')"

            price = parse_price(raw_item.get("price"))

            if price is None:
                return None, f"Preco invalido ou faltando em '{item_name}'"

            item_key = normalize_key(item_name)

            if item_key in category["_seen"]:
                continue

            category["_seen"].add(item_key)
            category["items"].append(
                {
                    "name": item_name,
                    "price": price,
                    "description": clean_text(raw_item.get("description"), MAX_DESCRIPTION),
                }
            )

    for category in categories:
        del category["_seen"]

    return categories, None


def import_menu(cur, company_id, categories):
    """Write the validated categories for one company. Does not commit.

    The company row is locked first, so two imports for the same restaurant
    (a double tap, two phones) run one after the other instead of both creating
    the same category.
    """
    cur.execute(
        """
        SELECT id
        FROM companies
        WHERE id = %s
        FOR UPDATE;
        """,
        (str(company_id),),
    )

    if not cur.fetchone():
        return None

    cur.execute(
        """
        SELECT id, name
        FROM menus
        WHERE company_id = %s;
        """,
        (str(company_id),),
    )
    menu_ids = {normalize_key(row["name"]): row["id"] for row in cur.fetchall()}

    cur.execute(
        """
        SELECT menu_id, name
        FROM products
        WHERE company_id = %s;
        """,
        (str(company_id),),
    )
    existing = {(row["menu_id"], normalize_key(row["name"])) for row in cur.fetchall()}

    summary = {
        "menus_created": 0,
        "menus_reused": 0,
        "products_created": 0,
        "products_skipped": 0,
    }

    for category in categories:
        key = normalize_key(category["name"])
        menu_id = menu_ids.get(key)

        if menu_id is None:
            cur.execute(
                """
                INSERT INTO menus (company_id, name)
                VALUES (%s, %s)
                RETURNING id;
                """,
                (str(company_id), category["name"]),
            )
            menu_id = cur.fetchone()["id"]
            menu_ids[key] = menu_id
            summary["menus_created"] += 1
        else:
            summary["menus_reused"] += 1

        for item in category["items"]:
            item_key = (menu_id, normalize_key(item["name"]))

            if item_key in existing:
                summary["products_skipped"] += 1
                continue

            cur.execute(
                """
                INSERT INTO products (company_id, menu_id, name, description, price)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (
                    str(company_id),
                    str(menu_id),
                    item["name"],
                    item["description"],
                    item["price"],
                ),
            )
            existing.add(item_key)
            summary["products_created"] += 1

    return summary
