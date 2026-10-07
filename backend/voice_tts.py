"""Voz natural do servidor para o guia do dono (texto em áudio).

O celular sempre tem a própria voz (às vezes robótica). Quando a internet é boa, a tela pede aqui
a mesma frase em voz natural; se este servidor não tiver a voz ligada, ou demorar, a tela fala com
a voz do celular. Nada aqui é obrigatório para o sistema funcionar.

Como liga (variáveis de ambiente do servidor, nunca no código):
- VOZ_PROVEDOR=google      + VOZ_GOOGLE_CHAVE (chave de API do Google Cloud, Text-to-Speech ativado)
                             VOZ_GOOGLE_VOZ (opcional; padrão pt-BR-Neural2-B)
- VOZ_PROVEDOR=elevenlabs  + VOZ_ELEVENLABS_CHAVE + VOZ_ELEVENLABS_VOZ (id da voz; pode ser a voz do
                             dono do software clonada com a autorização dele, no painel da ElevenLabs)
                             VOZ_ELEVENLABS_MODELO (opcional; padrão eleven_flash_v2_5)

Custo e abuso:
- Cada frase nova custa (por caractere). Frase repetida não custa: o áudio fica guardado em disco
  (<UPLOAD_DIR>/voz/<hash>.mp3) e o Caddy entrega em /media/voz/..., com cache longo no navegador.
- Só quem está logado no painel pede voz; há limite por restaurante por hora e limite geral de
  caracteres por dia (guarda-chuva de custo).
- O texto é do próprio sistema (perguntas do guia, nomes de pratos); vai para o provedor só para
  virar áudio. A chave nunca vai para o navegador nem para o log.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import deque

import media_store

MAX_TEXT = 400
REQUEST_TIMEOUT_SECONDS = 12

PER_COMPANY_PER_HOUR = int(os.getenv("VOZ_POR_HORA", "400"))
CHARS_PER_DAY = int(os.getenv("VOZ_CARACTERES_POR_DIA", "300000"))

GOOGLE_URL = os.getenv("VOZ_GOOGLE_URL", "https://texttospeech.googleapis.com/v1/text:synthesize")
GOOGLE_DEFAULT_VOICE = "pt-BR-Neural2-B"
ELEVENLABS_URL = os.getenv("VOZ_ELEVENLABS_URL", "https://api.elevenlabs.io/v1/text-to-speech")
ELEVENLABS_DEFAULT_MODEL = "eleven_flash_v2_5"
# 22 kHz e 32 kbit/s: voz clara e ~4 KB por segundo, leve no 3G
ELEVENLABS_FORMAT = "mp3_22050_32"


class VoiceError(Exception):
    """Falha com mensagem curta e o código HTTP que a rota deve devolver. A tela cai na voz do celular."""

    def __init__(self, message: str, status: int = 500):
        super().__init__(message)
        self.message = message
        self.status = status


# ----------------------------------------------------------------------------- configuração

def provider() -> str:
    return (os.getenv("VOZ_PROVEDOR") or "").strip().lower()


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def voice_name() -> str:
    """Identifica a voz em uso; entra no nome do arquivo, então trocar a voz gera áudios novos."""
    if provider() == "google":
        return _env("VOZ_GOOGLE_VOZ") or GOOGLE_DEFAULT_VOICE
    if provider() == "elevenlabs":
        return f"{_env('VOZ_ELEVENLABS_VOZ')}:{_env('VOZ_ELEVENLABS_MODELO') or ELEVENLABS_DEFAULT_MODEL}"
    return ""


def is_configured() -> bool:
    if provider() == "google":
        return bool(_env("VOZ_GOOGLE_CHAVE"))
    if provider() == "elevenlabs":
        return bool(_env("VOZ_ELEVENLABS_CHAVE")) and bool(_env("VOZ_ELEVENLABS_VOZ"))
    return False


# ----------------------------------------------------------------------------- texto

_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def clean_text(raw) -> str:
    """Uma linha, sem caracteres de controle, espaços simples. Vazio quando não serve."""
    if not isinstance(raw, str):
        return ""
    text = unicodedata.normalize("NFC", raw)
    text = _CONTROL.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def cache_key(text: str, voice: str, provider_name: str) -> str:
    return hashlib.sha256(f"{provider_name}\n{voice}\n{text}".encode("utf-8")).hexdigest()[:40]


def _voice_dir() -> str:
    return os.path.join(media_store.UPLOAD_DIR, "voz")


def _path_for(key: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{40}", key):
        raise ValueError("chave de áudio inválida")
    return os.path.join(_voice_dir(), f"{key}.mp3")


def public_url(key: str) -> str:
    return f"/media/voz/{key}.mp3"


def _write_atomic(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), mode=0o755, exist_ok=True)
    tmp = f"{path}.{secrets.token_hex(4)}.tmp"
    try:
        with open(tmp, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, 0o644)  # o Caddy lê com outro usuário
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


# ----------------------------------------------------------------------------- limites

class Limiter:
    """Frases por restaurante por hora e caracteres por dia no servidor todo. Em memória."""

    def __init__(self, clock=time.time):
        self._clock = clock
        self._lock = threading.Lock()
        self._per_company: dict[str, deque] = {}
        self._chars: deque = deque()  # (instante, caracteres)

    def check(self, company_id: str, chars: int) -> None:
        now = self._clock()
        with self._lock:
            mine = self._per_company.setdefault(str(company_id), deque())
            while mine and now - mine[0] > 3600:
                mine.popleft()
            while self._chars and now - self._chars[0][0] > 86400:
                self._chars.popleft()
            if len(mine) >= PER_COMPANY_PER_HOUR:
                raise VoiceError("Muitas frases nesta hora. Usando a voz do celular.", 429)
            if sum(count for _, count in self._chars) + chars > CHARS_PER_DAY:
                raise VoiceError("A voz natural atingiu o limite de hoje. Usando a voz do celular.", 429)
            mine.append(now)
            self._chars.append((now, chars))

    def refund(self, company_id: str, chars: int) -> None:
        with self._lock:
            mine = self._per_company.get(str(company_id))
            if mine:
                mine.pop()
            for index in range(len(self._chars) - 1, -1, -1):
                if self._chars[index][1] == chars:
                    del self._chars[index]
                    break


limiter = Limiter()


# ----------------------------------------------------------------------------- provedores

def build_google_request(text: str, voice: str) -> tuple[str, dict, dict]:
    body = {
        "input": {"text": text},
        "voice": {"languageCode": "pt-BR", "name": voice},
        "audioConfig": {"audioEncoding": "MP3", "speakingRate": 1.05},
    }
    headers = {"content-type": "application/json", "x-goog-api-key": _env("VOZ_GOOGLE_CHAVE")}
    return GOOGLE_URL, headers, body


def build_elevenlabs_request(text: str) -> tuple[str, dict, dict]:
    voice_id = urllib.parse.quote(_env("VOZ_ELEVENLABS_VOZ"), safe="")
    url = f"{ELEVENLABS_URL}/{voice_id}?output_format={ELEVENLABS_FORMAT}"
    body = {
        "text": text,
        "model_id": _env("VOZ_ELEVENLABS_MODELO") or ELEVENLABS_DEFAULT_MODEL,
    }
    headers = {"content-type": "application/json", "xi-api-key": _env("VOZ_ELEVENLABS_CHAVE"), "accept": "audio/mpeg"}
    return url, headers, body


def _post(url: str, headers: dict, body: dict) -> tuple[bytes, str]:
    """Chamada HTTP; devolve (corpo, content-type). Separada para os testes trocarem."""
    request = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.read(), response.headers.get("content-type", "")
    except urllib.error.HTTPError as error:
        if error.code in (401, 402, 403):
            raise VoiceError("A voz natural está desligada no momento.", 503) from None
        raise VoiceError("O serviço de voz está ocupado.", 503) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise VoiceError("Não consegui falar com o serviço de voz.", 504) from None


def _looks_like_mp3(data: bytes) -> bool:
    return data[:3] == b"ID3" or (len(data) > 1 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)


def synthesize(text: str) -> bytes:
    """O áudio MP3 da frase, pedido ao provedor configurado. Levanta VoiceError."""
    name = provider()
    if name == "google":
        url, headers, body = build_google_request(text, voice_name())
        raw, _ = _post(url, headers, body)
        try:
            audio = base64.b64decode(json.loads(raw.decode("utf-8"))["audioContent"])
        except (ValueError, KeyError, TypeError, UnicodeDecodeError):
            raise VoiceError("O serviço de voz respondeu algo que não entendi.", 502) from None
    elif name == "elevenlabs":
        url, headers, body = build_elevenlabs_request(text)
        audio, _ = _post(url, headers, body)
    else:
        raise VoiceError("A voz natural não está ligada neste servidor.", 501)
    if not audio or not _looks_like_mp3(audio):
        raise VoiceError("O serviço de voz respondeu algo que não entendi.", 502)
    return audio


# ----------------------------------------------------------------------------- o trabalho todo

def speech_url(raw_text, company_id: str) -> str:
    """O endereço do áudio da frase, gerando e guardando quando ainda não existe."""
    if not is_configured():
        raise VoiceError("A voz natural não está ligada neste servidor.", 501)
    text = clean_text(raw_text)
    if not text:
        raise VoiceError("Frase vazia.", 400)
    if len(text) > MAX_TEXT:
        raise VoiceError("Frase longa demais para a voz natural.", 400)

    key = cache_key(text, voice_name(), provider())
    path = _path_for(key)
    if os.path.exists(path):
        return public_url(key)  # já pago: não conta no limite

    limiter.check(company_id, len(text))
    try:
        audio = synthesize(text)
    except VoiceError as error:
        if error.status >= 500:
            limiter.refund(company_id, len(text))
        raise
    _write_atomic(path, audio)
    return public_url(key)
