"""Logomarca do restaurante: valida e prepara a imagem que o dono mandou (ou que o criador de logomarca fez).

Entra: os bytes de uma imagem (PNG feito no celular pelo criador de logomarca, ou foto/arquivo da
logomarca que o dono já tem).
Sai: duas imagens WebP, sem os dados escondidos (EXIF: local, modelo do celular, data):
a grande (até 512 px de lado) e a pequena (até 160 px), para listas e cabeçalhos.

Diferente da foto de prato (image_enhance.py): aqui NÃO se corta, NÃO se melhora e NÃO se muda a cor.
Uma logomarca tem de sair igual à que o dono escolheu. Só reduz (nunca estica) e mantém a
transparência quando ela existe.

Só usa a biblioteca Pillow. Nada aqui acessa banco, disco ou rede.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

FULL_MAX_SIDE = 512
THUMB_MAX_SIDE = 160

# Limites para proteger o servidor (imagens "bomba" que abrem enormes na memória).
MAX_JPEG_PIXELS = 100_000_000   # JPEG é lido já reduzido (draft), então aguenta mais
MAX_OTHER_PIXELS = 24_000_000   # PNG e WebP são lidos inteiros
MIN_SIDE = 48                   # menor que isso não dá para mostrar uma logomarca

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


class LogoError(ValueError):
    """Imagem recusada. A mensagem já está em português e pode ir direto para o dono."""


@dataclass
class PreparedLogo:
    full: bytes
    thumb: bytes
    width: int
    height: int
    has_transparency: bool


def _looks_like_image(data: bytes) -> bool:
    """Confere os primeiros bytes; a extensão ou o tipo informado pelo navegador não valem nada."""
    if data[:3] == b"\xff\xd8\xff":
        return True  # JPEG
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return True  # PNG
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return True  # WebP
    return False


def _open(data: bytes) -> Image.Image:
    if not data:
        raise LogoError("Não recebi nenhuma imagem. Tente de novo.")
    if not _looks_like_image(data):
        raise LogoError("Esse arquivo não é uma imagem que eu consiga abrir. Use uma foto ou uma imagem PNG.")

    try:
        im = Image.open(io.BytesIO(data))
        fmt = im.format
        width, height = im.size
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError, ValueError):
        raise LogoError("Não consegui abrir essa imagem. Escolha outra e tente de novo.") from None

    if fmt not in ALLOWED_FORMATS:
        raise LogoError("Esse tipo de imagem não é aceito. Use uma foto ou uma imagem PNG.")

    limit = MAX_JPEG_PIXELS if fmt == "JPEG" else MAX_OTHER_PIXELS
    if width * height > limit:
        raise LogoError("A imagem é grande demais. Escolha uma menor.")
    if min(width, height) < MIN_SIDE:
        raise LogoError("A imagem é pequena demais para ser uma logomarca. Escolha uma maior.")

    return im


def _load(im: Image.Image) -> Image.Image:
    """Lê os pixels de verdade (já em pé e só o primeiro quadro), em RGBA ou RGB."""
    try:
        if im.format == "JPEG":
            im.draft("RGB", (FULL_MAX_SIDE * 2, FULL_MAX_SIDE * 2))
        else:
            try:
                im.seek(0)  # imagem animada: fica só o primeiro quadro
            except EOFError:
                pass
        im.load()
        im = ImageOps.exif_transpose(im)  # celular deitado: põe em pé
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise LogoError("A imagem está danificada. Escolha outra e tente de novo.") from None

    if im.mode in ("RGBA", "LA", "P", "PA") or "transparency" in im.info:
        return im.convert("RGBA")
    return im.convert("RGB")


def _has_transparency(im: Image.Image) -> bool:
    if im.mode != "RGBA":
        return False
    low, _high = im.getchannel("A").getextrema()
    return low < 255


def _shrink(im: Image.Image, longest: int) -> Image.Image:
    """Reduz até o lado maior ter `longest` pixels. Nunca estica: logomarca pequena fica pequena."""
    side = max(im.size)
    if side <= longest:
        return im.copy()
    scale = longest / side
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    return im.resize(size, Image.LANCZOS)


def _encode(im: Image.Image, lossless: bool) -> bytes:
    saida = io.BytesIO()
    if lossless:
        im.save(saida, "WEBP", lossless=True, method=4)  # sem exif=: nada de dados escondidos
    else:
        im.save(saida, "WEBP", quality=90, method=4)
    return saida.getvalue()


def prepare_logo(data: bytes) -> PreparedLogo:
    """Valida e prepara a logomarca. Levanta LogoError (com mensagem pronta) se não servir."""
    opened = _open(data)
    lossless = opened.format == "PNG"  # PNG costuma ser desenho de cores chapadas: sem perda fica nítido e leve
    im = _load(opened)

    transparent = _has_transparency(im)
    if im.mode == "RGBA" and not transparent:
        im = im.convert("RGB")  # alfa todo opaco: não precisa carregar o canal

    full = _shrink(im, FULL_MAX_SIDE)
    thumb = _shrink(im, THUMB_MAX_SIDE)

    return PreparedLogo(
        full=_encode(full, lossless),
        thumb=_encode(thumb, lossless),
        width=full.width,
        height=full.height,
        has_transparency=transparent,
    )
