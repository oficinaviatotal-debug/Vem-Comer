from __future__ import annotations

from io import BytesIO
from urllib.parse import quote

import qrcode


def table_url(base_url: str, company_id: str, table_number: str) -> str:
    base = base_url.rstrip("/")
    return f"{base}/c/{quote(str(company_id), safe='')}/mesa/{quote(str(table_number), safe='')}"


def qr_png_for_url(url: str) -> bytes:
    """Render any link as a printable PNG QR code, fully offline."""
    qr = qrcode.QRCode(version=None, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    image = qr.make_image()
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def table_qr_png(base_url: str, company_id: str, table_number: str) -> bytes:
    return qr_png_for_url(table_url(base_url, company_id, table_number))
