"""Prova de aceite (LGPD art. 8º §2º: quem trata o dado prova que houve consentimento).

Cada aceite, e cada retirada de aceite, vira uma linha nova em `consent_records`. A tabela só recebe linhas
(o banco recusa alterar ou apagar). A pessoa aparece só pela impressão digital do e-mail; o IP aparece só
misturado com a chave do servidor. Sem Flask: a rota e o cadastro usam estas funções.

O aceite que vale é sempre o mais recente de cada finalidade: aceitar de novo depois de retirar volta a valer,
e retirar depois de aceitar tira o direito de enviar.
"""

from __future__ import annotations

import hashlib
import hmac

import outreach

KINDS = ("dono", "cliente", "candidato", "empresa", "contato")
PURPOSES = ("termos", "privacidade", "maior_de_18", "ia_foto_exterior", "alertas_email", "divulgacao_email")
CHANNELS = ("site", "painel", "email", "api", "presencial")
# O que todo dono aceita ao se cadastrar (as novidades por e-mail são opcionais e entram só se ele marcar).
SIGNUP_PURPOSES = ("termos", "privacidade", "maior_de_18")
# Finalidades que são "receber e-mail": o descadastro retira todas de uma vez.
EMAIL_PURPOSES = ("alertas_email", "divulgacao_email")

SQL_RECORD = """
INSERT INTO consent_records
  (subject_hash, subject_kind, purpose, granted, document_version, document_sha256, channel, ip_hash)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""
SQL_LATEST = "SELECT granted FROM consent_records WHERE subject_hash = %s AND purpose = %s ORDER BY seq DESC LIMIT 1"


def text_sha256(text: str) -> str:
    """Impressão digital do texto que a pessoa viu ao aceitar (prova de qual texto foi aceito)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def ip_hash(ip: str | None, secret: str) -> str | None:
    if not ip:
        return None
    return hmac.new(secret.encode("utf-8"), ip.encode("utf-8"), hashlib.sha256).hexdigest()


def record(
    cur,
    email,
    *,
    kind: str,
    purpose: str,
    granted: bool,
    version: str,
    channel: str,
    document_sha256: str | None = None,
    ip: str | None = None,
    secret: str = "",
) -> None:
    if kind not in KINDS or purpose not in PURPOSES or channel not in CHANNELS:
        raise ValueError("tipo, finalidade ou canal desconhecido")
    if not isinstance(granted, bool):
        raise ValueError("granted precisa ser verdadeiro ou falso")
    if not version or len(version) > 40:
        raise ValueError("versão do texto é obrigatória")
    cur.execute(
        SQL_RECORD,
        (
            outreach.email_hash(email),
            kind,
            purpose,
            granted,
            version,
            document_sha256,
            channel,
            ip_hash(ip, secret) if secret else None,
        ),
    )


def is_granted(cur, email, purpose: str) -> bool:
    """O aceite mais recente dessa finalidade está valendo?"""
    if purpose not in PURPOSES:
        raise ValueError("finalidade desconhecida")
    cur.execute(SQL_LATEST, (outreach.email_hash(email), purpose))
    row = cur.fetchone()
    return bool(row and row["granted"])


def withdraw_email_consents(cur, email, *, kind: str, version: str, channel: str = "email") -> None:
    """Descadastro: retira de uma vez todos os aceites de receber e-mail."""
    for purpose in EMAIL_PURPOSES:
        record(cur, email, kind=kind, purpose=purpose, granted=False, version=version, channel=channel)
