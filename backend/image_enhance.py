"""Foto de prato: valida, endireita, enquadra e melhora a imagem que o dono mandou.

Entra: os bytes de uma foto qualquer (celular, galeria, quadro de vídeo).
Sai: duas imagens WebP em proporção 4:3 (a grande para o cardápio, a pequena para listas),
sem os dados escondidos da foto (EXIF: local, modelo do celular, data), mais uma lista de
melhorias feitas e de dicas sinceras ("a foto está escura").

Sobre foto tremida: de propósito NÃO tento adivinhar. Um aviso errado ("saiu tremida" numa foto
boa) incomoda mais do que ajuda, e ainda não tenho fotos reais de pratos para calibrar isso.

Só usa a biblioteca Pillow. Nada aqui acessa banco, disco ou rede.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

# Tamanho final. A foto grande serve para a tela cheia do celular; a pequena para listas.
FULL_SIZE = (1080, 810)
THUMB_SIZE = (480, 360)

# Limites para proteger o servidor (fotos "bomba" que abrem enormes na memória).
MAX_JPEG_PIXELS = 100_000_000   # JPEG é lido já reduzido (draft), então aguenta mais
MAX_OTHER_PIXELS = 24_000_000   # PNG e WebP são lidos inteiros
MIN_SIDE = 200                  # menor que isso não dá para mostrar um prato

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

# Brilho médio (0 a 255) que um prato bem iluminado costuma ter.
TARGET_LUMA = 128
DARK_LUMA = 70
BRIGHT_LUMA = 205


class PhotoError(ValueError):
    """Foto recusada. A mensagem já está em português e pode ir direto para o dono."""


@dataclass
class EnhancedPhoto:
    full: bytes
    thumb: bytes
    width: int
    height: int
    improvements: list[str] = field(default_factory=list)
    tips: list[str] = field(default_factory=list)


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
        raise PhotoError("Não recebi nenhuma foto. Tente de novo.")
    if not _looks_like_image(data):
        raise PhotoError("Esse arquivo não é uma foto que eu consiga abrir. Use uma foto tirada com a câmera.")

    try:
        im = Image.open(io.BytesIO(data))
        fmt = im.format
        width, height = im.size
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError, ValueError):
        raise PhotoError("Não consegui abrir essa foto. Tire outra e tente de novo.") from None

    if fmt not in ALLOWED_FORMATS:
        raise PhotoError("Esse tipo de imagem não é aceito. Use uma foto tirada com a câmera.")

    pixels = width * height
    limit = MAX_JPEG_PIXELS if fmt == "JPEG" else MAX_OTHER_PIXELS
    if pixels > limit:
        raise PhotoError("A foto é grande demais. Tire outra com a câmera normal do celular.")
    if min(width, height) < MIN_SIDE:
        raise PhotoError("A foto é muito pequena. Chegue mais perto do prato e tire de novo.")

    return im


def _load(im: Image.Image) -> Image.Image:
    """Lê os pixels de verdade. Foto de celular de 48 megapixels é lida já reduzida (rápido e leve)."""
    try:
        if im.format == "JPEG":
            im.draft("RGB", (FULL_SIZE[0] * 2, FULL_SIZE[1] * 2))
        else:
            try:
                im.seek(0)  # imagem animada: fica só o primeiro quadro
            except EOFError:
                pass
        im.load()
        im = ImageOps.exif_transpose(im)  # celular deitado: põe em pé
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise PhotoError("A foto está danificada. Tire outra e tente de novo.") from None

    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        fundo = Image.new("RGB", im.size, (255, 255, 255))
        fundo.paste(im, mask=im.getchannel("A"))
        return fundo
    return im.convert("RGB")


def _crop_4x3(im: Image.Image) -> Image.Image:
    """Corta no centro para a proporção 4:3 (a mesma em todo o cardápio)."""
    width, height = im.size
    alvo = 4 / 3
    if width / height > alvo:
        novo = round(height * alvo)
        esq = (width - novo) // 2
        return im.crop((esq, 0, esq + novo, height))
    novo = round(width / alvo)
    # o prato costuma estar um pouco acima do meio da foto (a borda da mesa fica embaixo)
    topo = max(0, round((height - novo) * 0.4))
    return im.crop((0, topo, width, topo + novo))


def _luma(im: Image.Image) -> float:
    return ImageStat.Stat(im.convert("L").resize((64, 48))).mean[0]


def _contrast(im: Image.Image) -> float:
    return ImageStat.Stat(im.convert("L").resize((64, 48))).stddev[0]


def _resize(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    # nunca estica uma foto pequena (ficaria borrada); só reduz
    if im.width <= size[0]:
        return im.copy()
    return im.resize(size, Image.LANCZOS)


def _encode(im: Image.Image, quality: int) -> bytes:
    saida = io.BytesIO()
    im.save(saida, "WEBP", quality=quality, method=4)  # sem exif=: nada de dados escondidos
    return saida.getvalue()


def enhance_photo(data: bytes) -> EnhancedPhoto:
    """Valida e melhora a foto. Levanta PhotoError (com mensagem pronta) se não servir."""
    im = _load(_open(data))
    im = _crop_4x3(im)
    if im.width > FULL_SIZE[0]:
        im = im.resize(FULL_SIZE, Image.LANCZOS)

    melhorias: list[str] = []
    dicas: list[str] = []

    luz_antes = _luma(im)

    if luz_antes < DARK_LUMA:
        dicas.append("A foto ficou escura. Perto de uma janela, ou com a luz acesa, o prato fica bem mais bonito.")
    elif luz_antes > BRIGHT_LUMA:
        dicas.append("A foto ficou muito clara. Evite o sol direto no prato.")

    # 1) contraste: abre o claro e o escuro sem estourar
    # Misturo só 60% do efeito: o automático puro costuma exagerar em foto de prato.
    melhor = Image.blend(im, ImageOps.autocontrast(im, cutoff=0.4, preserve_tone=True), 0.6)

    # 2) luz: só clareia foto escura. Nunca escurece: prato branco em mesa clara não pode virar
    #    cinza (foto estourada ganha só uma dica, lá em cima).
    luz = _luma(melhor)
    if 1 < luz < TARGET_LUMA - 8:
        melhor = ImageEnhance.Brightness(melhor).enhance(min(1.45, TARGET_LUMA / luz))

    # 3) cor: comida com cor viva parece mais apetitosa (sem exagero)
    melhor = ImageEnhance.Color(melhor).enhance(1.12)

    # 4) nitidez leve
    melhor = melhor.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=3))

    # O que se mostra ao dono é o que de fato mudou (comparando antes e depois).
    luz_depois = _luma(melhor)
    if luz_depois > luz_antes * 1.08:
        melhorias.append("Mais luz")
    if _contrast(melhor) > _contrast(im) * 1.05:
        melhorias.append("Mais contraste")
    melhorias.append("Cores mais vivas")
    melhorias.append("Mais nitidez")

    full = _resize(melhor, FULL_SIZE)
    thumb = _resize(melhor, THUMB_SIZE)

    return EnhancedPhoto(
        full=_encode(full, 82),
        thumb=_encode(thumb, 78),
        width=full.width,
        height=full.height,
        improvements=melhorias,
        tips=dicas,
    )
