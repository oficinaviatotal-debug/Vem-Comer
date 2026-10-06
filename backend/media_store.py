"""Onde ficam as fotos no disco do servidor, e como o endereço público de cada uma é montado.

Estrutura:  <UPLOAD_DIR>/<id da empresa>/<chave>.webp          (foto grande)
            <UPLOAD_DIR>/<id da empresa>/<chave>-thumb.webp    (foto pequena)

A chave é sorteada a cada foto nova (nunca vem do usuário). Por isso o endereço muda quando a
foto é trocada, e o navegador pode guardar cada foto para sempre sem mostrar uma versão velha.
O Caddy (porteiro HTTPS) lê esta mesma pasta e entrega em /media/...
"""

from __future__ import annotations

import os
import re
import secrets
import uuid

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/data/uploads")

_KEY_RE = re.compile(r"^[0-9a-f]{32}$")


def new_key() -> str:
    return secrets.token_hex(16)


def is_valid_key(key) -> bool:
    return isinstance(key, str) and bool(_KEY_RE.match(key))


def _company_dir(company_id) -> str:
    # str(UUID(...)) só deixa passar letras e números do formato certo: sem ".." nem "/"
    return os.path.join(UPLOAD_DIR, str(uuid.UUID(str(company_id))))


def _paths(company_id, key: str) -> tuple[str, str]:
    if not is_valid_key(key):
        raise ValueError("chave de foto inválida")
    base = _company_dir(company_id)
    return os.path.join(base, f"{key}.webp"), os.path.join(base, f"{key}-thumb.webp")


def _write_atomic(path: str, data: bytes) -> None:
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


def save_pair(company_id, key: str, full: bytes, thumb: bytes) -> None:
    full_path, thumb_path = _paths(company_id, key)
    os.makedirs(os.path.dirname(full_path), mode=0o755, exist_ok=True)
    try:
        _write_atomic(full_path, full)
        _write_atomic(thumb_path, thumb)
    except Exception:
        delete_pair(company_id, key)
        raise


def delete_pair(company_id, key) -> None:
    """Apaga as duas imagens. Nunca levanta erro: foto que sobrou no disco não pode travar o cardápio."""
    if not is_valid_key(key):
        return
    try:
        for path in _paths(company_id, key):
            try:
                os.remove(path)
            except FileNotFoundError:
                pass
    except (OSError, ValueError):
        pass


def public_urls(company_id, key) -> dict:
    """Endereços para o cardápio. Sem foto: ambos None."""
    if not is_valid_key(key):
        return {"image_url": None, "thumb_url": None}
    company = str(company_id)
    return {
        "image_url": f"/media/{company}/{key}.webp",
        "thumb_url": f"/media/{company}/{key}-thumb.webp",
    }
