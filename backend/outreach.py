"""Divulgação por e-mail para empresas: quem pode receber, quantas vezes e quando.

Esta é a trava que o "agente da lei" põe antes de qualquer envio (compliance/obligations.json:
EMAIL-PROSPECCAO-EMPRESA, EMAIL-LISTA-BLOQUEIO, EMAIL-REMETENTE). Nada aqui envia e-mail: não existe ainda
provedor de envio. Quando existir, ele só pode mandar a mensagem que `check_contact` liberar.

Regras (todas com teste):
- só empresa, com a origem do e-mail e a base legal anotadas; candidato nunca entra aqui (só por cadastro dele);
- lista de bloqueio única: quem pediu para não receber, reclamou ou teve o e-mail devolvido nunca mais recebe;
- no máximo 3 envios por contato (o primeiro e 2 lembretes), com pelo menos 5 dias entre eles;
- limite por dia que começa em 20 e sobe 25% a cada dia de uso, até um teto;
- freio automático: se as reclamações passarem de 0,3% ou os e-mails devolvidos de 2% (últimos 7 dias), o envio
  congela até alguém conferir (as regras do Gmail e do Yahoo pedem reclamação abaixo de 0,3%);
- descadastro de um clique (RFC 8058) com link assinado que vale para sempre.

O e-mail é identificado pela impressão digital SHA-256 do endereço em minúsculas (sem chave), para que as listas
de bloqueio do Vem Comer e do Vem Trabalhar possam trocar só as impressões, sem trocar endereços.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from itsdangerous import BadSignature, URLSafeSerializer

MAX_SENDS = 3
MIN_DAYS_BETWEEN = 5
START_DAILY_LIMIT = 20
GROWTH_PER_DAY = 1.25
MAX_DAILY_LIMIT = 500
COMPLAINT_FREEZE_RATE = 0.003
BOUNCE_FREEZE_RATE = 0.02
EMAIL_MAX = 200

KINDS = ("empresa",)
SOURCES = ("anuncio_publico", "site_da_empresa", "indicacao", "parceiro", "pedido_do_contato")
LEGAL_BASES = ("interesse_legitimo", "consentimento")
# Origens em que a própria empresa divulgou o endereço ou pediu contato: só nelas vale o interesse legítimo.
LEGITIMATE_INTEREST_SOURCES = ("anuncio_publico", "site_da_empresa", "indicacao", "parceiro")
SUPPRESSION_REASONS = ("pediu", "reclamacao", "devolvido", "titular")

FREE_MAIL_DOMAINS = frozenset(
    {
        "gmail.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "yahoo.com", "yahoo.com.br",
        "icloud.com", "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "globo.com", "proton.me",
    }
)

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_UNSUBSCRIBE_SALT = "descadastro"


# ---------------------------------------------------------------- e-mail

def normalize_email(value) -> str | None:
    """E-mail em minúsculas, ou None se não for um e-mail utilizável."""
    if not isinstance(value, str):
        return None
    email = value.strip().lower()
    if not email or len(email) > EMAIL_MAX or not _EMAIL_RE.match(email):
        return None
    return email


def email_hash(email: str) -> str:
    normalized = normalize_email(email)
    if normalized is None:
        raise ValueError("e-mail inválido")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def is_free_mail(email: str) -> bool:
    normalized = normalize_email(email) or ""
    return normalized.rsplit("@", 1)[-1] in FREE_MAIL_DOMAINS


def mask_email(email: str) -> str:
    """joao@empresa.com.br vira j***@empresa.com.br (para a página de descadastro confirmar sem expor)."""
    normalized = normalize_email(email)
    if normalized is None:
        return ""
    local, domain = normalized.split("@", 1)
    return f"{local[:1]}***@{domain}"


# ---------------------------------------------------------------- descadastro

def unsubscribe_token(email: str, secret: str) -> str:
    """Link assinado, sem validade: o descadastro tem de funcionar para sempre."""
    normalized = normalize_email(email)
    if normalized is None:
        raise ValueError("e-mail inválido")
    return URLSafeSerializer(secret, salt=_UNSUBSCRIBE_SALT).dumps({"e": normalized})


def email_from_token(token, secret: str) -> str | None:
    if not isinstance(token, str) or not token or len(token) > 600:
        return None
    try:
        data = URLSafeSerializer(secret, salt=_UNSUBSCRIBE_SALT).loads(token)
    except BadSignature:
        return None
    return normalize_email(data.get("e")) if isinstance(data, dict) else None


def unsubscribe_headers(base_url: str, email: str, secret: str) -> dict[str, str]:
    """Cabeçalhos de descadastro de um clique (RFC 8058) que todo e-mail de divulgação precisa levar."""
    url = f"{base_url.rstrip('/')}/api/descadastro?t={unsubscribe_token(email, secret)}"
    return {"List-Unsubscribe": f"<{url}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}


# ---------------------------------------------------------------- limites

def daily_limit(days_in_use: int, start: int = START_DAILY_LIMIT, growth: float = GROWTH_PER_DAY, cap: int = MAX_DAILY_LIMIT) -> int:
    """Limite de envios do dia: começa baixo para o provedor conhecer o remetente e sobe aos poucos."""
    days = max(0, int(days_in_use))
    return int(min(cap, start * (growth ** days)))


def freeze_reason(sent: int, complaints: int, bounces: int) -> str | None:
    """Motivo para congelar o envio (últimos 7 dias), ou None se está tudo bem."""
    if sent <= 0:
        return None
    if complaints / sent > COMPLAINT_FREEZE_RATE:
        return "reclamacoes_acima_de_0_3_por_cento"
    if bounces / sent > BOUNCE_FREEZE_RATE:
        return "devolvidos_acima_de_2_por_cento"
    return None


@dataclass(frozen=True)
class Decision:
    ok: bool
    reason: str

    def __bool__(self) -> bool:  # `if decision:` lê como "pode enviar"
        return self.ok


def can_send(
    contact: dict,
    *,
    suppressed: bool,
    sends_done: int,
    last_sent_at: datetime | None,
    sent_today: int,
    limit_today: int,
    frozen: bool,
    consent_granted: bool = False,
    now: datetime | None = None,
) -> Decision:
    """A função única que libera ou barra um envio. Cada barreira tem um motivo curto e testável."""
    now = now or datetime.now(timezone.utc)
    if frozen:
        return Decision(False, "envio_congelado")
    if suppressed:
        return Decision(False, "na_lista_de_bloqueio")
    if contact.get("kind") not in KINDS:
        return Decision(False, "so_empresa")
    if contact.get("source") not in SOURCES or contact.get("legal_basis") not in LEGAL_BASES:
        return Decision(False, "sem_origem_ou_base_legal")
    if contact["legal_basis"] == "consentimento":
        if not consent_granted:
            return Decision(False, "sem_consentimento")
    elif contact["source"] not in LEGITIMATE_INTEREST_SOURCES:
        return Decision(False, "interesse_legitimo_nao_vale_para_esta_origem")
    if sends_done >= MAX_SENDS:
        return Decision(False, "limite_de_envios_por_contato")
    if last_sent_at is not None and now - last_sent_at < timedelta(days=MIN_DAYS_BETWEEN):
        return Decision(False, "cedo_demais_para_o_proximo")
    if sent_today >= limit_today:
        return Decision(False, "limite_do_dia")
    return Decision(True, "ok")


# ---------------------------------------------------------------- SQL

SQL_ADD_CONTACT = """
INSERT INTO outreach_contacts (email, email_hash, kind, source, source_note, legal_basis, free_mail, added_by)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (email_hash) DO NOTHING
RETURNING id
"""
SQL_CONTACT = "SELECT id, email, kind, source, legal_basis FROM outreach_contacts WHERE email_hash = %s"
SQL_IS_SUPPRESSED = "SELECT 1 AS found FROM email_suppression WHERE email_hash = %s"
SQL_SUPPRESS = "INSERT INTO email_suppression (email_hash, reason) VALUES (%s, %s) ON CONFLICT (email_hash) DO NOTHING"
SQL_SENDS = """
SELECT count(*) AS n, max(created_at) AS last_at
FROM outreach_log WHERE contact_id = %s AND outcome = 'enviado'
"""
SQL_SENT_TODAY = """
SELECT count(*) AS n FROM outreach_log
WHERE outcome = 'enviado'
  AND created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
"""
SQL_DAYS_IN_USE = "SELECT count(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS n FROM outreach_log WHERE outcome = 'enviado'"
SQL_FROZEN = "SELECT congelado FROM email_controle WHERE id = 1"
SQL_FREEZE = "UPDATE email_controle SET congelado = true, motivo = %s, desde = now() WHERE id = 1 AND congelado = false"
SQL_STATS_7D = """
SELECT
  count(*) FILTER (WHERE outcome = 'enviado') AS sent,
  count(*) FILTER (WHERE outcome = 'reclamacao') AS complaints,
  count(*) FILTER (WHERE outcome = 'devolvido') AS bounces
FROM outreach_log WHERE created_at >= now() - interval '7 days'
"""
SQL_LOG = "INSERT INTO outreach_log (contact_id, step, outcome) VALUES (%s, %s, %s)"


def _one(cur, sql, args=()):
    cur.execute(sql, args)
    return cur.fetchone()


def add_contact(cur, email, *, source: str, source_note: str, legal_basis: str, added_by: str, kind: str = "empresa"):
    """Anota uma empresa que pode ser procurada. Devolve o id, ou None se o contato já existia ou foi barrado."""
    normalized = normalize_email(email)
    if normalized is None:
        raise ValueError("e-mail inválido")
    if kind not in KINDS:
        raise ValueError("só empresa pode entrar na lista de divulgação")
    if source not in SOURCES or legal_basis not in LEGAL_BASES:
        raise ValueError("origem ou base legal desconhecida")
    if not isinstance(source_note, str) or not 3 <= len(source_note.strip()) <= 300:
        raise ValueError("diga onde o e-mail foi visto (de 3 a 300 letras)")
    hashed = email_hash(normalized)
    if _one(cur, SQL_IS_SUPPRESSED, (hashed,)):
        return None  # quem pediu para sair não volta por outra porta
    row = _one(
        cur,
        SQL_ADD_CONTACT,
        (normalized, hashed, kind, source, source_note.strip(), legal_basis, is_free_mail(normalized), added_by),
    )
    return row["id"] if row else None


def suppress(cur, email, reason: str) -> None:
    if reason not in SUPPRESSION_REASONS:
        raise ValueError("motivo desconhecido")
    cur.execute(SQL_SUPPRESS, (email_hash(email), reason))


def check_contact(cur, email, *, consent_granted: bool = False, now: datetime | None = None) -> Decision:
    """Junta o que o banco sabe e pergunta a `can_send`. É por aqui que todo envio tem de passar."""
    normalized = normalize_email(email)
    if normalized is None:
        return Decision(False, "email_invalido")
    hashed = email_hash(normalized)
    suppressed = bool(_one(cur, SQL_IS_SUPPRESSED, (hashed,)))
    contact = _one(cur, SQL_CONTACT, (hashed,))
    if contact is None:
        return Decision(False, "contato_nao_cadastrado") if not suppressed else Decision(False, "na_lista_de_bloqueio")
    frozen = bool((_one(cur, SQL_FROZEN) or {}).get("congelado", False))
    sends = _one(cur, SQL_SENDS, (contact["id"],)) or {}
    today = (_one(cur, SQL_SENT_TODAY) or {}).get("n", 0)
    days = (_one(cur, SQL_DAYS_IN_USE) or {}).get("n", 0)
    return can_send(
        contact,
        suppressed=suppressed,
        sends_done=int(sends.get("n") or 0),
        last_sent_at=sends.get("last_at"),
        sent_today=int(today or 0),
        limit_today=daily_limit(int(days or 0)),
        frozen=frozen,
        consent_granted=consent_granted,
        now=now,
    )


def register_outcome(cur, contact_id, step: str, outcome: str) -> str | None:
    """Anota o que aconteceu com um envio e, se o freio for atingido, congela. Devolve o motivo do freio, se houve."""
    cur.execute(SQL_LOG, (contact_id, step, outcome))
    stats = _one(cur, SQL_STATS_7D) or {}
    reason = freeze_reason(int(stats.get("sent") or 0), int(stats.get("complaints") or 0), int(stats.get("bounces") or 0))
    if reason:
        cur.execute(SQL_FREEZE, (reason,))
    return reason
