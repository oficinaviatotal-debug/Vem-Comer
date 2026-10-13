"""Ler um cardápio de planilha (CSV, TXT ou Excel .xlsx), sem IA e sem custo.

O dono que já tem o cardápio numa planilha (ou que a loja de um parente montou em Excel) manda o arquivo e o
sistema devolve categorias, pratos e preços, no MESMO formato da leitura por foto. O dono confere na tela e só
então o cardápio é cadastrado pelo caminho de sempre (menu_import). Nada é gravado aqui.

Como entende a planilha (nesta ordem):
1. Procura uma linha de títulos nas primeiras linhas ("Categoria", "Prato/Produto/Item/Nome", "Preço/Valor").
2. Sem títulos, descobre as colunas pelo conteúdo: a coluna que parece preço, a de nomes e, se houver, a de categorias.
3. Planilha de uma coluna só ("X-Burguer ..... R$ 18,50"): separa o preço do fim do texto.
4. Linha que tem só texto, sem preço, vira o nome da categoria dos pratos que vêm depois.

Segurança: o arquivo é DADO. Não executa nada, não abre fórmulas, recusa XML com declaração de entidades (XXE e
"bomba de expansão"), limita tamanho, linhas, colunas e o tamanho descompactado do .xlsx (bomba de compressão).
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from xml.etree import ElementTree as ET

import menu_import
import menu_photo

MAX_FILE_BYTES = 2 * 1024 * 1024  # planilha de cardápio é pequena; acima disso não é cardápio
MAX_ROWS = 3000
MAX_COLS = 30
MAX_XML_BYTES = 20 * 1024 * 1024  # tamanho DESCOMPACTADO de cada parte do .xlsx
MAX_ZIP_ENTRIES = 300
DEFAULT_CATEGORY = "Cardápio"
HEADER_SCAN_ROWS = 12


class MenuFileError(Exception):
    """Falha com mensagem pronta para o dono e o código HTTP que a rota deve devolver."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ----------------------------------------------------------------------------- what kind of file is it

def detect_kind(data: bytes) -> str:
    """"pdf", "xlsx", "csv" (texto) ou o nome de um formato que não lemos: "xls", "docx", "ods", "zip", "image"."""
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return "xls"  # Excel/Word antigos (binário)
    if data[:8].startswith(b"\x89PNG") or data.startswith(b"\xff\xd8\xff") or data[:4] in (b"RIFF", b"GIF8"):
        return "image"
    if data.startswith(b"PK\x03\x04") or data.startswith(b"PK\x05\x06"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = set(archive.namelist())
        except (zipfile.BadZipFile, ValueError, OSError):
            return "zip"
        if "xl/workbook.xml" in names:
            return "xlsx"
        if "word/document.xml" in names:
            return "docx"
        if "content.xml" in names:
            return "ods"
        return "zip"
    return "csv"


UNSUPPORTED_MESSAGES = {
    "xls": "Esse é o formato antigo do Excel (.xls). Abra a planilha e use Salvar como, escolhendo .xlsx ou CSV.",
    "docx": "Esse é um documento do Word. Salve como PDF, ou tire uma foto do cardápio.",
    "ods": "Esse é o formato do LibreOffice (.ods). Abra a planilha e use Salvar como, escolhendo .xlsx ou CSV.",
    "zip": "Não reconheci esse arquivo. Mande uma planilha (.xlsx ou CSV).",
    "image": "Isso é uma imagem. Use o botão de foto do cardápio.",
}


# ----------------------------------------------------------------------------- reading the rows

def _decode_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            pass
    try:
        return data.decode("cp1252")  # Excel em português salva CSV assim
    except UnicodeDecodeError:
        return data.decode("latin-1")


NO_DELIMITER = "\x1f"  # nenhuma linha tem isto: cada linha vira uma célula só


def _pick_delimiter(text: str) -> str:
    lines = [line for line in text.splitlines()[:40] if line.strip()]
    if not lines:
        return NO_DELIMITER
    best, best_score = NO_DELIMITER, 0.0
    for delimiter in (";", "\t", "|", ","):
        with_it = [line for line in lines if delimiter in line]
        # o separador precisa estar na grande maioria das linhas (uma linha de título sozinha é aceita)
        if len(with_it) < max(2, int(len(lines) * 0.75)):
            continue
        if delimiter == "," and _commas_are_decimals(with_it):
            continue
        score = len(with_it) + min(line.count(delimiter) for line in with_it)
        if score > best_score:
            best, best_score = delimiter, score
    return best


def _commas_are_decimals(lines: list[str]) -> bool:
    """"X-Burguer R$ 18,50": a vírgula é a dos centavos, não separa colunas."""
    decimal = sum(1 for line in lines if re.search(r"\d,\d{1,2}\s*$", line) and line.count(",") == 1)
    return decimal >= max(1, int(len(lines) * 0.8))


def rows_from_text(data: bytes) -> list[list[str]]:
    text = _decode_text(data)
    if "\x00" in text:
        raise MenuFileError("Esse arquivo não parece uma planilha de texto. Mande .xlsx ou CSV.")
    delimiter = _pick_delimiter(text)
    rows: list[list[str]] = []
    try:
        for record in csv.reader(io.StringIO(text), delimiter=delimiter):
            rows.append([cell.strip() for cell in record[:MAX_COLS]])
            if len(rows) >= MAX_ROWS:
                break
    except csv.Error:
        raise MenuFileError("Não consegui entender esse arquivo como planilha. Salve de novo como CSV ou .xlsx.") from None
    return rows


def _safe_xml(archive: zipfile.ZipFile, name: str) -> ET.Element | None:
    try:
        info = archive.getinfo(name)
    except KeyError:
        return None
    if info.file_size > MAX_XML_BYTES:
        raise MenuFileError("Essa planilha é grande demais para um cardápio.")
    with archive.open(info) as handle:
        raw = handle.read(MAX_XML_BYTES + 1)
    if len(raw) > MAX_XML_BYTES:
        raise MenuFileError("Essa planilha é grande demais para um cardápio.")
    lowered = raw[:4096].lower() + raw[-2048:].lower()
    if b"<!doctype" in lowered or b"<!entity" in lowered or b"<!doctype" in raw.lower():
        raise MenuFileError("Essa planilha tem uma estrutura que não aceito por segurança. Salve de novo como CSV.")
    try:
        return ET.fromstring(raw)
    except ET.ParseError:
        raise MenuFileError("Não consegui abrir essa planilha. Salve de novo como .xlsx ou CSV.") from None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _column_index(reference: str) -> int:
    letters = re.match(r"[A-Za-z]+", reference or "")
    if not letters:
        return -1
    index = 0
    for char in letters.group(0).upper():
        index = index * 26 + (ord(char) - 64)
    return index - 1


def _text_of(element: ET.Element) -> str:
    """Todo o texto de um <si> ou <is> (junta os pedaços formatados)."""
    return "".join(node.text or "" for node in element.iter() if _local(node.tag) == "t")


def rows_from_xlsx(data: bytes) -> list[list[str]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except (zipfile.BadZipFile, ValueError, OSError):
        raise MenuFileError("Não consegui abrir essa planilha. Salve de novo como .xlsx ou CSV.") from None
    with archive:
        if len(archive.namelist()) > MAX_ZIP_ENTRIES:
            raise MenuFileError("Essa planilha tem arquivos demais por dentro. Salve de novo como CSV.")

        shared: list[str] = []
        strings = _safe_xml(archive, "xl/sharedStrings.xml")
        if strings is not None:
            shared = [_text_of(item) for item in strings if _local(item.tag) == "si"]

        # a primeira aba, na ordem do arquivo (e não a primeira pelo nome)
        sheet_path = "xl/worksheets/sheet1.xml"
        workbook = _safe_xml(archive, "xl/workbook.xml")
        relations = _safe_xml(archive, "xl/_rels/workbook.xml.rels")
        if workbook is not None and relations is not None:
            targets = {rel.get("Id"): rel.get("Target") for rel in relations if _local(rel.tag) == "Relationship"}
            for sheet in workbook.iter():
                if _local(sheet.tag) != "sheet":
                    continue
                relation_id = next((value for key, value in sheet.attrib.items() if _local(key) == "id"), None)
                target = targets.get(relation_id or "")
                if target:
                    sheet_path = target.lstrip("/") if target.startswith("/") else f"xl/{target}"
                break
        sheet_path = sheet_path.replace("xl/xl/", "xl/")

        sheet = _safe_xml(archive, sheet_path)
        if sheet is None:
            raise MenuFileError("Não achei nenhuma aba com dados nessa planilha.")

        rows: list[list[str]] = []
        for row in sheet.iter():
            if _local(row.tag) != "row":
                continue
            cells: dict[int, str] = {}
            next_index = 0
            for cell in row:
                if _local(cell.tag) != "c":
                    continue
                index = _column_index(cell.get("r", ""))
                if index < 0:
                    index = next_index
                next_index = index + 1
                if index >= MAX_COLS:
                    continue
                kind = cell.get("t", "n")
                value = ""
                if kind == "inlineStr":
                    inline = next((child for child in cell if _local(child.tag) == "is"), None)
                    value = _text_of(inline) if inline is not None else ""
                else:
                    raw = next((child.text or "" for child in cell if _local(child.tag) == "v"), "")
                    if kind == "s":
                        try:
                            value = shared[int(raw)]
                        except (ValueError, IndexError):
                            value = ""
                    elif kind == "b":
                        value = "sim" if raw.strip() == "1" else "não"
                    else:
                        value = raw  # número ("18.5") ou texto de fórmula; fórmulas nunca são calculadas
                cells[index] = value.strip()
            width = (max(cells) + 1) if cells else 0
            rows.append([cells.get(i, "") for i in range(width)])
            if len(rows) >= MAX_ROWS:
                break
        return rows


# ----------------------------------------------------------------------------- understanding the rows

_PRICE_CELL = re.compile(r"(?:r\$\s*)?\d{1,5}(?:[.,]\d{3})*(?:[.,]\d{1,2})?", re.IGNORECASE)
_DECIMAL_OR_CURRENCY = re.compile(r"r\$|[.,]\d{1,2}$", re.IGNORECASE)
# "X-Burguer ........ R$ 18,50" / "Suco - 6,00": o preço precisa ter R$ ou centavos, senão "Combo 2" viraria preço
_TRAILING_PRICE = re.compile(
    r"^(?P<name>.*?\S)[\s.\-–—:|·_]*(?:r\$\s*(?P<a>\d{1,5}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)"
    r"|(?P<b>\d{1,5}(?:[.]\d{3})*[.,]\d{1,2}))\s*(?:reais)?$",
    re.IGNORECASE,
)

_NAME_HEADERS = ("nome", "prato", "produto", "item", "sabor", "titulo", "artigo")
_CATEGORY_HEADERS = ("categoria", "grupo", "secao", "tipo", "classe", "setor", "departamento", "linha", "familia")
_DESCRIPTION_HEADERS = ("descricao", "ingrediente", "detalhe", "observa", "composicao", "obs")
_PRICE_HEADERS = ("preco", "valor", "vlr", "pvp")
_NOT_PRICE_HEADERS = ("custo", "compra", "cmv", "estoque", "quant", "qtd", "desconto", "codigo", "cod ", "margem", "lucro")


def looks_like_price(cell: str) -> bool:
    return bool(cell) and _PRICE_CELL.fullmatch(cell.strip()) is not None and menu_import.parse_price(cell) is not None


def _role_of_header(cell: str) -> str | None:
    key = menu_import.normalize_key(cell)
    if not key or len(key) > 40:
        return None
    padded = f"{key} "
    if any(word in padded for word in _NOT_PRICE_HEADERS):
        return None
    if key in ("r$", "$") or any(word in key for word in _PRICE_HEADERS):
        return "price"
    if any(word in key for word in _DESCRIPTION_HEADERS):
        return "description"
    if any(key == word or key.startswith(word + " ") or key.startswith(word + "s") for word in _CATEGORY_HEADERS):
        return "category"
    if any(key == word or key.startswith(word + " ") or key.startswith(word + "s") or key.startswith(word + "(") for word in _NAME_HEADERS):
        return "name"
    return None


def _price_columns_by_content(rows: list[list[str]], skip: set[int]) -> list[int]:
    """Colunas (fora as já usadas) em que a maioria das células parece preço."""
    width = max((len(row) for row in rows), default=0)
    found = []
    for column in range(width):
        if column in skip:
            continue
        cells = [row[column] for row in rows if column < len(row) and row[column]]
        if len(cells) >= 2 and sum(1 for cell in cells if looks_like_price(cell)) / len(cells) >= 0.6:
            found.append(column)
    return found


def _find_header(rows: list[list[str]]) -> tuple[int, dict] | None:
    """Acha a linha de títulos. Devolve (posição, colunas) com colunas = {"name", "category"?, "prices": [(coluna, rótulo)]}.

    Com mais de uma coluna de preço sem título de preço (pizzaria: "Broto | Média | Grande"), cada uma vira um
    tamanho: o rótulo é o título da coluna e vai para o nome do prato ("Calabresa (Grande)").
    """
    for position, row in enumerate(rows[:HEADER_SCAN_ROWS]):
        if any(looks_like_price(cell) for cell in row):
            continue  # linha de títulos não tem preço; esta já é um prato
        roles: dict[str, int] = {}
        for column, cell in enumerate(row):
            role = _role_of_header(cell)
            if role and role not in roles:
                roles[role] = column
        if "name" not in roles and "description" in roles:
            roles["name"] = roles["description"]  # "Código | Descrição | Preço": a descrição é o nome
        if "name" not in roles:
            continue
        columns: dict = {"name": roles["name"]}
        if "category" in roles:
            columns["category"] = roles["category"]
        if "price" in roles:
            columns["prices"] = [(roles["price"], None)]
            return position, columns
        used = {roles["name"], roles.get("category", -1)}
        by_content = _price_columns_by_content(rows[position + 1:], used)
        if len(by_content) == 1:
            columns["prices"] = [(by_content[0], None)]
            return position, columns
        if len(by_content) >= 2:
            labels = [(column, row[column].strip() if column < len(row) else "") for column in by_content]
            if all(label for _, label in labels):
                columns["prices"] = [(column, label[:30]) for column, label in labels]
                return position, columns
    return None


def _infer_columns(rows: list[list[str]]) -> dict | None:
    """Sem títulos: a coluna de preço é a que mais parece preço; a de nomes, a de texto mais variado."""
    width = max((len(row) for row in rows), default=0)
    if width < 2:
        return None
    best_price, best_score = -1, 0.0
    for column in range(width):
        cells = [row[column] for row in rows if column < len(row) and row[column]]
        if len(cells) < 2:
            continue
        priced = [cell for cell in cells if looks_like_price(cell)]
        ratio = len(priced) / len(cells)
        if ratio < 0.6:
            continue
        decimals = sum(1 for cell in priced if _DECIMAL_OR_CURRENCY.search(cell.strip()))
        score = ratio + 0.5 * (decimals / len(priced)) + column * 0.001  # empate: a mais à direita
        if score > best_score:
            best_price, best_score = column, score
    if best_price < 0:
        return None

    candidates = []
    for column in range(width):
        if column == best_price:
            continue
        cells = [row[column] for row in rows if column < len(row) and row[column]]
        texts = [cell for cell in cells if re.search(r"[A-Za-zÀ-ÿ]", cell) and not looks_like_price(cell)]
        if len(texts) < 2:
            continue
        distinct = len({menu_import.normalize_key(cell) for cell in texts}) / len(texts)
        candidates.append((column, len(texts), distinct))

    names = [candidate for candidate in candidates if candidate[2] >= 0.6]
    if not names:
        return None
    # com mais de uma coluna variada (nome e descrição), o nome é a mais à esquerda, de preferência antes do preço
    left = [candidate for candidate in names if candidate[0] < best_price]
    name_column = (left or names)[0][0]
    columns: dict = {"name": name_column, "prices": [(best_price, None)]}
    repeated = [c for c in candidates if c[2] < 0.6 and c[0] < name_column]
    if repeated:
        columns["category"] = repeated[0][0]
    return columns


def split_trailing_price(text: str) -> tuple[str, str | None]:
    """"X-Burguer ..... R$ 18,50" -> ("X-Burguer", "18,50"). Sem preço no fim: (texto, None)."""
    match = _TRAILING_PRICE.match(text.strip())
    if not match:
        return text.strip(), None
    price = match.group("a") or match.group("b")
    return match.group("name").strip(" .-–—:|·_"), price


def _single_column_menu(rows: list[list[str]]) -> list[dict]:
    """Lista de uma coluna: linha com preço no fim é prato; linha sem preço é categoria."""
    categories: list[dict] = []
    current: dict | None = None
    for row in rows:
        text = next((cell for cell in row if cell), "")
        if not text:
            continue
        name, price = split_trailing_price(text)
        if price is None:
            current = {"name": text, "items": []}
            categories.append(current)
            continue
        if current is None:
            current = {"name": DEFAULT_CATEGORY, "items": []}
            categories.append(current)
        current["items"].append({"name": name, "price": price})
    return categories


def _table_menu(rows: list[list[str]], columns: dict) -> list[dict]:
    name_col = columns["name"]
    price_cols: list[tuple[int, str | None]] = columns["prices"]
    category_col = columns.get("category")
    price_indexes = {column for column, _ in price_cols}
    categories: list[dict] = []
    by_key: dict[str, dict] = {}
    current: dict | None = None

    def category_named(name: str) -> dict:
        key = menu_import.normalize_key(name)
        if key not in by_key:
            by_key[key] = {"name": name, "items": []}
            categories.append(by_key[key])
        return by_key[key]

    def has_price(row: list[str]) -> bool:
        return any(column < len(row) and looks_like_price(row[column]) for column in price_indexes)

    def next_has_price(position: int) -> bool:
        for later in rows[position + 1:]:
            if any(later):
                return has_price(later)
        return False

    for position, row in enumerate(rows):
        name = row[name_col] if name_col < len(row) else ""
        category = row[category_col] if category_col is not None and category_col < len(row) else ""
        cells = [(row[column] if column < len(row) else "", label) for column, label in price_cols]
        any_price_text = any(text for text, _ in cells)
        if not name:
            # linha só com a categoria (quando a coluna de categoria existe)
            if category and not any_price_text:
                current = category_named(category)
            continue
        others = [cell for index, cell in enumerate(row) if cell and index != name_col and index not in price_indexes]
        if not any_price_text and not others and category_col is None and next_has_price(position):
            current = category_named(name)  # "Bebidas" sozinho na linha, e a próxima já tem preço: título de grupo
            continue
        if category:
            current = category_named(category)
        if current is None:
            current = category_named(DEFAULT_CATEGORY)

        emitted = False
        for text, label in cells:
            if looks_like_price(text):
                item_name = f"{name} ({label})" if label and len(price_cols) > 1 else name
                current["items"].append({"name": item_name, "price": text})
                emitted = True
        if not emitted:
            trailing_name, trailing_price = (name, None)
            if not any_price_text:
                trailing_name, trailing_price = split_trailing_price(name)
            if trailing_price is not None:
                current["items"].append({"name": trailing_name, "price": trailing_price})
            else:
                current["items"].append({"name": name, "price": ""})  # sem preço: o dono preenche na conferência
    return categories


def rows_to_menu(rows: list[list[str]]) -> dict:
    """Linhas da planilha -> {"readable", "categories", "notes"} (ainda sem a limpeza final)."""
    rows = [row for row in rows if any(cell for cell in row)]
    if not rows:
        return {"readable": False, "categories": [], "notes": "A planilha está vazia."}

    header = _find_header(rows)
    if header is not None:
        position, columns = header
        categories = _table_menu(rows[position + 1:], columns)
        how = "pelos títulos das colunas"
        if len(columns["prices"]) > 1:
            how += " (uma coluna de preço por tamanho)"
    else:
        columns = _infer_columns(rows)
        if columns is not None:
            categories = _table_menu(rows, columns)
            how = "pelo conteúdo das colunas"
        else:
            categories = _single_column_menu(rows)
            how = "linha por linha"

    items = sum(len(category["items"]) for category in categories)
    notes = ""
    if items:
        notes = f"Entendi a planilha {how}."
    return {"readable": items > 0, "categories": categories, "notes": notes}


# ----------------------------------------------------------------------------- the whole job

def read_menu_sheet(data: bytes, kind: str | None = None) -> dict:
    """Bytes de uma planilha (CSV/TXT ou .xlsx) -> o mesmo formato da leitura por foto. Levanta MenuFileError."""
    if not data:
        raise MenuFileError("O arquivo veio vazio. Tente de novo.")
    if len(data) > MAX_FILE_BYTES:
        raise MenuFileError("Esse arquivo é grande demais para uma planilha de cardápio (limite de 2 MB).", 413)
    kind = kind or detect_kind(data)
    if kind == "csv":
        rows = rows_from_text(data)
    elif kind == "xlsx":
        rows = rows_from_xlsx(data)
    elif kind in UNSUPPORTED_MESSAGES:
        raise MenuFileError(UNSUPPORTED_MESSAGES[kind])
    else:
        raise MenuFileError("Não reconheci esse arquivo. Mande uma planilha (.xlsx ou CSV).")

    raw = rows_to_menu(rows)
    result = menu_photo.normalize_result(raw)
    if not result["readable"]:
        return {
            "readable": False,
            "categories": [],
            "notes": raw.get("notes") or "Não achei pratos com preço nessa planilha.",
        }
    result["notes"] = raw.get("notes", "")
    return result
