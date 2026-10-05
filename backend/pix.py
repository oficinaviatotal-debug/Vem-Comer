"""Static Pix ("Pix Copia e Cola" / BR Code) built from the restaurant's own key.

The money goes straight from the customer's bank to the restaurant's account:
no intermediary, no fee. The system only writes the code (key, receiver name,
city, exact amount, order reference) and a person at the restaurant confirms
the payment by looking at the bank app, because a static code has no way to
call us back.

Format: EMV merchant-presented QR (BR Code), as in the Banco Central "Manual de
Padrões para Iniciação do Pix". Pure functions, no database, no network.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

GUI = "br.gov.bcb.pix"

NAME_MAX = 25
CITY_MAX = 15
TXID_MAX = 25
KEY_TYPES = ("cpf", "cnpj", "phone", "email", "random")


class PixError(ValueError):
    """The restaurant's Pix data is not usable. The message is safe to show."""


# ---------------------------------------------------------------------------
# CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF). It covers the whole payload
# including the "6304" that announces the CRC, and not the 4 hex digits.
# ---------------------------------------------------------------------------

def crc16(text: str) -> str:
    crc = 0xFFFF
    for byte in text.encode("ascii"):
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


# ---------------------------------------------------------------------------
# Keys
# ---------------------------------------------------------------------------

def _cpf_is_valid(digits: str) -> bool:
    if len(digits) != 11 or not digits.isdigit() or len(set(digits)) == 1:
        return False
    for size in (9, 10):
        total = sum(int(digits[i]) * (size + 1 - i) for i in range(size))
        check = (total * 10) % 11 % 10
        if check != int(digits[size]):
            return False
    return True


def _cnpj_is_valid(value: str) -> bool:
    """Numeric and the alphanumeric CNPJ (from July 2026): 12 letters/digits + 2 check digits."""
    if not re.fullmatch(r"[0-9A-Z]{12}[0-9]{2}", value):
        return False
    if len(set(value)) == 1:
        return False
    numbers = [ord(char) - 48 for char in value]
    for size in (12, 13):
        weights = [((size - 1 - i) % 8) + 2 for i in range(size)]
        total = sum(n * w for n, w in zip(numbers[:size], weights))
        remainder = total % 11
        check = 0 if remainder < 2 else 11 - remainder
        if check != numbers[size]:
            return False
    return True


def normalize_key(key_type: str, raw: str) -> str:
    """Returns the key the way banks register it, or raises PixError."""
    key_type = (key_type or "").strip().lower()
    value = (raw or "").strip()

    if key_type not in KEY_TYPES:
        raise PixError("Escolha o tipo da chave Pix.")
    if not value:
        raise PixError("Digite a chave Pix.")

    if key_type == "cpf":
        digits = re.sub(r"[.\-\s]", "", value)
        if not _cpf_is_valid(digits):
            raise PixError("CPF inválido. Confira os 11 números.")
        return digits

    if key_type == "cnpj":
        cleaned = re.sub(r"[.\-/\s]", "", value).upper()
        if not _cnpj_is_valid(cleaned):
            raise PixError("CNPJ inválido. Confira os 14 caracteres.")
        return cleaned

    if key_type == "phone":
        digits = re.sub(r"[\s().\-]", "", value)
        if digits.startswith("+"):
            digits = digits[1:]
        if not digits.isdigit():
            raise PixError("Celular inválido. Use o DDD e o número, por exemplo 84 99999-9999.")
        if digits.startswith("55") and len(digits) in (12, 13):
            digits = digits[2:]
        if len(digits) not in (10, 11) or digits[0] == "0" or digits[1] == "0":
            raise PixError("Celular inválido. Use o DDD e o número, por exemplo 84 99999-9999.")
        return "+55" + digits

    if key_type == "email":
        email = value.lower()
        if len(email) > 77 or not re.fullmatch(r"[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)+", email):
            raise PixError("E-mail inválido.")
        return email

    # random (EVP): a UUID
    try:
        parsed = uuid.UUID(value)
    except ValueError:
        raise PixError("Chave aleatória inválida. Ela tem 32 letras e números, com traços.") from None
    return str(parsed)


def mask_key(key_type: str, key: str) -> str:
    """Shows enough of the key to recognise it without exposing all of it."""
    if key_type in ("cpf", "cnpj"):
        return key[:3] + "•" * (len(key) - 5) + key[-2:]
    if key_type == "phone":
        return key[:5] + "•" * max(len(key) - 9, 0) + key[-4:]
    if key_type == "email":
        name, _, domain = key.partition("@")
        return name[:2] + "•" * max(len(name) - 2, 1) + "@" + domain
    return key[:8] + "-••••-••••-••••-" + key[-4:]


# ---------------------------------------------------------------------------
# Receiver name and city: ASCII capitals, as the BR Code requires
# ---------------------------------------------------------------------------

def clean_text(value: str, max_len: int) -> str:
    ascii_text = (
        unicodedata.normalize("NFKD", value or "")
        .encode("ascii", "ignore")
        .decode("ascii")
        .upper()
    )
    ascii_text = re.sub(r"[^A-Z0-9 ]", " ", ascii_text)
    return re.sub(r"\s+", " ", ascii_text).strip()[:max_len].strip()


def clean_receiver(name: str, city: str) -> tuple[str, str]:
    cleaned_name = clean_text(name, NAME_MAX)
    cleaned_city = clean_text(city, CITY_MAX)
    if not cleaned_name:
        raise PixError("Digite o nome do recebedor, como aparece no banco.")
    if not cleaned_city:
        raise PixError("Digite a cidade do restaurante.")
    return cleaned_name, cleaned_city


# ---------------------------------------------------------------------------
# Payload
# ---------------------------------------------------------------------------

def _tlv(tag: str, value: str) -> str:
    if len(value) > 99:
        raise PixError("Dados do Pix grandes demais.")
    return f"{tag}{len(value):02d}{value}"


def format_amount(amount) -> str:
    try:
        value = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        raise PixError("Valor inválido.") from None
    if value <= 0 or value > Decimal("9999999999.99"):
        raise PixError("Valor inválido.")
    return f"{value:.2f}"


def txid_for_order(order_id) -> str:
    """Reference printed in the code so a payment can be matched to an order: VC + 8 characters."""
    clean = re.sub(r"[^0-9A-Za-z]", "", str(order_id)).upper()
    return ("VC" + clean[:8])[:TXID_MAX]


def build_payload(*, key: str, receiver_name: str, city: str, amount, txid: str | None = None) -> str:
    """The "Pix Copia e Cola" text. `key` must already be normalised, name and city cleaned."""
    reference = re.sub(r"[^0-9A-Za-z]", "", txid or "")[:TXID_MAX] or "***"

    merchant_account = _tlv("00", GUI) + _tlv("01", key)
    body = (
        _tlv("00", "01")
        + _tlv("26", merchant_account)
        + _tlv("52", "0000")
        + _tlv("53", "986")
        + _tlv("54", format_amount(amount))
        + _tlv("58", "BR")
        + _tlv("59", receiver_name)
        + _tlv("60", city)
        + _tlv("62", _tlv("05", reference))
        + "6304"
    )
    return body + crc16(body)


def parse_payload(payload: str) -> dict[str, str]:
    """Reads the top-level fields back. Used by tests and to double-check what we hand out."""
    fields: dict[str, str] = {}
    position = 0
    while position < len(payload):
        tag = payload[position : position + 2]
        length_text = payload[position + 2 : position + 4]
        if len(tag) != 2 or not length_text.isdigit():
            raise PixError("Código Pix malformado.")
        length = int(length_text)
        value = payload[position + 4 : position + 4 + length]
        if len(value) != length:
            raise PixError("Código Pix malformado.")
        fields[tag] = value
        position += 4 + length
    return fields


def is_valid_payload(payload: str) -> bool:
    """True when the structure parses and the CRC matches."""
    try:
        fields = parse_payload(payload)
    except PixError:
        return False
    return payload[-8:-4] == "6304" and fields.get("63") == crc16(payload[:-4])
