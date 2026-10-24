"""A imagem de prévia da página pública: o cartão que aparece quando o link do restaurante é colado no WhatsApp,
no Instagram ou no Facebook (1200 × 630, o tamanho que eles esperam).

Esquerda: o nome do restaurante grande, "Cardápio e pedidos pelo celular" e a marca Vem Comer. Direita: a foto do
primeiro prato do cardápio; sem foto de prato, a logomarca; sem nenhuma das duas, um prato desenhado. Letras da
própria marca (Bricolage Grotesque e Instrument Sans, licença OFL, em backend/fonts/): a letra padrão do Pillow não
desenha acento (ã, é, ç), e este é um texto em português.

Sai em JPEG (bem mais leve que PNG com foto): o WhatsApp deixa de mostrar a prévia de imagem pesada demais.
Nada aqui acessa banco, disco do servidor ou rede: recebe nome e bytes de imagem, devolve bytes de JPEG.
"""

from __future__ import annotations

import io
import os
import threading
from collections import OrderedDict

from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError

WIDTH, HEIGHT = 1200, 630
SPLIT = 640  # onde a foto começa

GREEN = (31, 94, 46)
GREEN_LIGHT = (46, 112, 50)
CREAM = (251, 246, 234)
CREAM_DARK = (233, 223, 196)
YELLOW = (244, 182, 63)
SOFT_TEXT = (214, 233, 218)

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
TITLE_FONT = os.path.join(FONT_DIR, "BricolageGrotesque-Bold.woff")
TEXT_FONT = os.path.join(FONT_DIR, "InstrumentSans-Regular.woff")

TEXT_LEFT = 64
TEXT_WIDTH = 540  # largura da coluna do nome (a foto começa em SPLIT)
MAX_LINES = 3
SIZES = (88, 80, 72, 64, 56, 50, 44)

MAX_PHOTO_PIXELS = 16_000_000


def _font(path: str, size: int):
    try:
        return ImageFont.truetype(path, size)
    except OSError:  # a pasta de letras não veio na instalação: a letra padrão (sem acento) é melhor que nada
        return ImageFont.load_default(size=size)


def _width(draw: ImageDraw.ImageDraw, text: str, font) -> float:
    return draw.textlength(text, font=font)


def _wrap(draw, text: str, font, limit: int) -> list[str] | None:
    """Quebra por palavras em linhas de no máximo `limit` pontos; None se alguma palavra sozinha não cabe."""
    lines: list[str] = []
    line = ""
    for word in text.split():
        if _width(draw, word, font) > limit:
            return None
        trial = f"{line} {word}".strip()
        if _width(draw, trial, font) <= limit:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def _fit_name(draw, name: str):
    """O maior tamanho de letra em que o nome cabe em até três linhas; no menor tamanho, corta com reticências."""
    for size in SIZES:
        font = _font(TITLE_FONT, size)
        lines = _wrap(draw, name, font, TEXT_WIDTH)
        if lines is not None and len(lines) <= MAX_LINES:
            return font, lines, size
    font = _font(TITLE_FONT, SIZES[-1])
    clipped = name
    while len(clipped) > 1:
        lines = _wrap(draw, clipped + "…", font, TEXT_WIDTH)
        if lines is not None and len(lines) <= MAX_LINES:
            return font, lines, SIZES[-1]
        clipped = clipped[:-1].rstrip()
    return font, [name[:1]], SIZES[-1]


def _open(data: bytes | None):
    if not data:
        return None
    try:
        image = Image.open(io.BytesIO(data))
        if image.width * image.height > MAX_PHOTO_PIXELS:
            return None
        image = ImageOps.exif_transpose(image)
        return image.convert("RGBA")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return None


def _plate(canvas: Image.Image, logo: Image.Image | None) -> None:
    """Sem foto de prato: um prato desenhado (e a logomarca no meio, quando existe)."""
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((SPLIT, 0, WIDTH, HEIGHT), fill=GREEN_LIGHT)
    cx, cy = SPLIT + (WIDTH - SPLIT) // 2, HEIGHT // 2
    draw.ellipse((cx - 215, cy - 215, cx + 215, cy + 215), fill=CREAM)
    draw.ellipse((cx - 160, cy - 160, cx + 160, cy + 160), fill=CREAM_DARK)
    if logo is not None:
        box = ImageOps.contain(logo, (230, 230))
        canvas.paste(box, (cx - box.width // 2, cy - box.height // 2), box)
    else:
        draw.ellipse((cx - 44, cy - 44, cx + 44, cy + 44), fill=YELLOW)


def _photo(canvas: Image.Image, photo: Image.Image) -> None:
    panel = ImageOps.fit(photo, (WIDTH - SPLIT, HEIGHT), method=Image.Resampling.LANCZOS)
    flat = Image.new("RGB", panel.size, CREAM)
    flat.paste(panel, mask=panel.split()[3])
    canvas.paste(flat, (SPLIT, 0))
    # uma sombra verde na borda esquerda da foto, para o nome e a foto não se baterem
    shade = Image.new("RGBA", (36, HEIGHT))
    pixels = shade.load()
    for x in range(shade.width):
        alpha = int(150 * (1 - x / shade.width) ** 2)
        for y in range(HEIGHT):
            pixels[x, y] = GREEN + (alpha,)
    canvas.paste(shade, (SPLIT, 0), shade)


def _badge(canvas: Image.Image, logo: Image.Image) -> None:
    """A logomarca num selo redondo no canto da foto (longe do texto, que ocupa a esquerda)."""
    size, ring = 150, 8
    cx, cy = WIDTH - 40 - size // 2 - ring, HEIGHT - 40 - size // 2 - ring
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((cx - size // 2 - ring, cy - size // 2 - ring, cx + size // 2 + ring, cy + size // 2 + ring), fill=CREAM)
    inner = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    fitted = ImageOps.contain(logo, (size - 24, size - 24))
    inner.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2), fitted)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    canvas.paste(inner, (cx - size // 2, cy - size // 2), mask)


def render(name: str, photo: bytes | None = None, logo: bytes | None = None) -> bytes:
    """O cartão em JPEG. `name` já vem limpo (public_page.clean_text)."""
    canvas = Image.new("RGB", (WIDTH, HEIGHT), GREEN)
    photo_image, logo_image = _open(photo), _open(logo)

    if photo_image is not None:
        _photo(canvas, photo_image)
        if logo_image is not None:
            _badge(canvas, logo_image)
    else:
        _plate(canvas, logo_image)

    draw = ImageDraw.Draw(canvas)
    title_font, lines, size = _fit_name(draw, name or "Restaurante")
    line_height = int(size * 1.08)
    sub_font = _font(TEXT_FONT, 34)
    brand_font = _font(TITLE_FONT, 38)

    block = line_height * len(lines) + 28 + 40
    top = max(70, (HEIGHT - 120 - block) // 2 + 20)
    y = top
    for line in lines:
        draw.text((TEXT_LEFT, y), line, font=title_font, fill=CREAM)
        y += line_height
    draw.rectangle((TEXT_LEFT, y + 14, TEXT_LEFT + 96, y + 20), fill=YELLOW)
    draw.text((TEXT_LEFT, y + 38), "Cardápio e pedidos pelo celular", font=sub_font, fill=SOFT_TEXT)
    draw.text((TEXT_LEFT, HEIGHT - 84), "Vem Comer", font=brand_font, fill=YELLOW)

    out = io.BytesIO()
    canvas.save(out, format="JPEG", quality=82, optimize=True, progressive=True)
    return out.getvalue()


class PreviewCache:
    """As últimas imagens prontas, na memória: o WhatsApp pede a mesma imagem muitas vezes. A chave inclui o nome e
    as chaves sorteadas das fotos; trocou o nome ou a foto, a chave muda e a imagem nova é feita."""

    def __init__(self, size: int = 64):
        self.size = size
        self._lock = threading.Lock()
        self._items: OrderedDict[tuple, bytes] = OrderedDict()

    def get(self, key: tuple):
        with self._lock:
            value = self._items.get(key)
            if value is not None:
                self._items.move_to_end(key)
            return value

    def put(self, key: tuple, value: bytes) -> None:
        with self._lock:
            self._items[key] = value
            self._items.move_to_end(key)
            while len(self._items) > self.size:
                self._items.popitem(last=False)
