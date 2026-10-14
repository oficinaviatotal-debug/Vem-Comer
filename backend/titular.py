"""Direitos do titular dos dados e denúncia de conteúdo (LGPD arts. 18 e 19; Marco Civil arts. 19 e 21).

Sem Flask: as rotas (titular_api.py) usam estas funções. O que cada peça faz:
- cria o pedido com PROTOCOLO, PRAZO e um código de acompanhamento que só a pessoa recebe (guardamos só a
  impressão digital do código);
- guarda o histórico em `data_request_events`, que só recebe linhas novas (prova de que respondemos no prazo);
- entrega ao dono a cópia dos dados da conta (acesso e portabilidade, art. 18 II e V);
- anonimiza uma pessoa ou um restaurante inteiro (eliminação, art. 18 VI), mantendo só valores e datas que a lei
  manda guardar. Nunca roda sozinho: quem chama decide, e a rota exige confirmação escrita.
Os prazos e os textos são a leitura da engenharia; o advogado confirma (compliance/obligations.json).
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

import outreach
import signup

# LGPD art. 18 (direitos) mais a denúncia de conteúdo ilegal (Marco Civil arts. 19 e 21).
KIND_LABELS = {
    "acesso": "Saber quais dados meus vocês têm e receber uma cópia",
    "correcao": "Corrigir dado errado ou desatualizado",
    "eliminacao": "Apagar os meus dados / encerrar a minha conta",
    "portabilidade": "Levar os meus dados para outro serviço",
    "informacao_compartilhamento": "Saber com quem vocês compartilham os meus dados",
    "revogacao": "Retirar um consentimento que eu dei",
    "oposicao": "Me opor a um uso dos meus dados",
    "revisao_decisao": "Pedir que uma pessoa revise uma decisão automática",
    "duvida": "Falar com o responsável pelos dados (dúvida ou reclamação)",
    "denuncia": "Denunciar um conteúdo (cardápio, anúncio, vaga, imagem)",
}
KINDS = tuple(KIND_LABELS)
NEEDS_DESCRIPTION = frozenset({"correcao", "revogacao", "oposicao", "revisao_decisao", "duvida", "denuncia"})

REPORT_REASONS = {
    "ilegal": "Conteúdo ilegal ou crime",
    "golpe": "Golpe ou fraude",
    "discriminacao": "Discriminação (por exemplo, em vaga de emprego)",
    "dados_pessoais": "Dados pessoais ou imagem minha sem permissão",
    "direito_autoral": "Cópia de obra, marca ou imagem de outra pessoa",
    "outro": "Outro motivo",
}

# Prazos: LGPD art. 19, II (declaração completa em até 15 dias). Para a denúncia a lei não diz um número: é a
# meta da engenharia (retirar o que for ilegal "de forma diligente"); o advogado confirma.
LGPD_DAYS = 15
REPORT_HOURS = 48

STATUS_LABELS = {
    "recebida": "Recebida",
    "em_analise": "Em análise",
    "respondida": "Respondida",
    "negada": "Respondida (não atendida, com o motivo)",
    "encerrada": "Encerrada",
}
OPEN_STATUSES = ("recebida", "em_analise")
ANSWER_STATUSES = ("em_analise", "respondida", "negada", "encerrada")

DESCRIPTION_MAX = 4000
TARGET_MAX = 500
CONTACT_MAX = 200
PROTOCOL_RE = re.compile(r"^VC-[0-9]{4}-[0-9A-F]{8}$")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class RequestError(Exception):
    def __init__(self, message: str, status: int = 400, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.field = field


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------- protocolo e código

def new_protocol(now: datetime | None = None, token_hex=secrets.token_hex) -> str:
    return f"VC-{(now or _now()).year}-{token_hex(4).upper()}"


def new_token() -> str:
    return secrets.token_urlsafe(18)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def token_matches(token, stored_hash) -> bool:
    if not isinstance(token, str) or not isinstance(stored_hash, str) or not token or len(token) > 100:
        return False
    return hmac.compare_digest(token_hash(token), stored_hash)


def due_at(kind: str, now: datetime | None = None) -> datetime:
    now = now or _now()
    return now + (timedelta(hours=REPORT_HOURS) if kind == "denuncia" else timedelta(days=LGPD_DAYS))


# ---------------------------------------------------------------------------- validação

def _clean_text(value, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    text = _CONTROL.sub("", value.replace("\r\n", "\n").replace("\r", "\n"))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:limit]


def normalize_contact(raw) -> tuple[str | None, str | None]:
    """(contato_para_responder, impressão_digital_do_e-mail). O contato é e-mail ou telefone do Brasil."""
    if not isinstance(raw, str) or not raw.strip():
        return None, None
    text = raw.strip()
    if "@" in text:
        email = outreach.normalize_email(text)
        if email is None or len(email) > CONTACT_MAX:
            raise RequestError("Esse e-mail não parece certo. Exemplo: nome@gmail.com", 400, "contact")
        return email, outreach.email_hash(email)
    phone = signup.normalize_phone(text)
    if phone is None:
        raise RequestError("Escreva um e-mail ou um WhatsApp com DDD para a gente responder.", 400, "contact")
    return phone, None


def validate_request(data: dict, *, verified_email: str | None = None) -> dict:
    """Confere o pedido. `verified_email` vem do login (a identidade já foi conferida pela sessão)."""
    if not isinstance(data, dict):
        raise RequestError("Pedido inválido.", 400)
    if _clean_text(data.get("website"), 200):  # campo escondido: só robô preenche
        raise RequestError("Não foi possível enviar.", 400)

    kind = data.get("kind")
    if kind not in KINDS:
        raise RequestError("Escolha o que você quer pedir.", 400, "kind")

    contact, subject_hash = (verified_email, outreach.email_hash(verified_email)) if verified_email else normalize_contact(data.get("contact"))
    if kind != "denuncia" and contact is None:
        raise RequestError("Escreva um e-mail ou um WhatsApp com DDD para a gente responder.", 400, "contact")

    description = _clean_text(data.get("description"), DESCRIPTION_MAX)
    if kind in NEEDS_DESCRIPTION and len(description) < 10:
        raise RequestError("Conte com um pouco mais de detalhe (pelo menos uma frase).", 400, "description")

    target_url = None
    if kind == "denuncia":
        target_url = _clean_text(data.get("target_url"), TARGET_MAX)
        if len(target_url) < 5:
            raise RequestError("Diga onde está o conteúdo: cole o endereço (link) ou descreva o lugar.", 400, "target_url")
        reason = data.get("reason") if data.get("reason") in REPORT_REASONS else "outro"
        description = f"Motivo: {REPORT_REASONS[reason]}\n{description}".strip()

    return {
        "kind": kind,
        "contact": contact,
        "subject_hash": subject_hash,
        "description": description or None,
        "target_url": target_url,
    }


# ---------------------------------------------------------------------------- criação e acompanhamento

SQL_INSERT_REQUEST = """
INSERT INTO data_requests
  (protocol, kind, channel, contact, subject_hash, description, target_url, identity_verified, token_hash, due_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (protocol) DO NOTHING
RETURNING id, protocol, due_at
"""
SQL_INSERT_EVENT = "INSERT INTO data_request_events (request_id, event, note) VALUES (%s, %s, %s)"
SQL_BY_PROTOCOL = """
SELECT id, protocol, kind, status, response, due_at, created_at, answered_at, token_hash
FROM data_requests WHERE protocol = %s
"""
SQL_OPEN_LIST = """
SELECT id, protocol, kind, channel, contact, description, target_url, identity_verified, status, due_at, created_at
FROM data_requests WHERE status IN ('recebida', 'em_analise') ORDER BY due_at LIMIT 200
"""
SQL_ONE = "SELECT id, kind, status, contact, identity_verified FROM data_requests WHERE id = %s FOR UPDATE"
SQL_ANSWER = """
UPDATE data_requests
SET status = %s, response = %s, identity_verified = identity_verified OR %s,
    answered_at = CASE WHEN %s THEN now() ELSE answered_at END
WHERE id = %s
"""


def create(cur, clean: dict, *, channel: str = "site", identity_verified: bool = False, now: datetime | None = None,
           protocol_factory=new_protocol) -> dict:
    """Grava o pedido e devolve {protocol, token, due_at}. O código (token) só existe aqui: não é guardado."""
    now = now or _now()
    token = new_token()
    deadline = due_at(clean["kind"], now)
    for _ in range(6):
        protocol = protocol_factory(now)
        cur.execute(
            SQL_INSERT_REQUEST,
            (protocol, clean["kind"], channel, clean["contact"], clean["subject_hash"], clean["description"],
             clean["target_url"], bool(identity_verified), token_hash(token), deadline),
        )
        row = cur.fetchone()
        if row:
            cur.execute(SQL_INSERT_EVENT, (row["id"], "recebida", None))
            if identity_verified:
                cur.execute(SQL_INSERT_EVENT, (row["id"], "identidade_conferida", "Pedido feito dentro da conta, com login."))
            return {"protocol": row["protocol"], "token": token, "due_at": row["due_at"]}
    raise RuntimeError("não consegui gerar um protocolo livre")


def public_view(cur, protocol, token) -> dict | None:
    """O que a pessoa vê ao acompanhar: só com protocolo E código certos. Devolve None se qualquer um falhar."""
    if not isinstance(protocol, str) or not PROTOCOL_RE.match(protocol):
        return None
    cur.execute(SQL_BY_PROTOCOL, (protocol,))
    row = cur.fetchone()
    if not row or not token_matches(token, row["token_hash"]):
        return None
    return {
        "protocol": row["protocol"],
        "kind": row["kind"],
        "kind_label": KIND_LABELS[row["kind"]],
        "status": row["status"],
        "status_label": STATUS_LABELS[row["status"]],
        "due_at": row["due_at"],
        "created_at": row["created_at"],
        "answered_at": row["answered_at"],
        "response": row["response"],
    }


def list_open(cur, now: datetime | None = None) -> list[dict]:
    now = now or _now()
    cur.execute(SQL_OPEN_LIST)
    items = []
    for row in cur.fetchall():
        seconds = (row["due_at"] - now).total_seconds()
        items.append({
            "id": str(row["id"]),
            "protocol": row["protocol"],
            "kind": row["kind"],
            "kind_label": KIND_LABELS[row["kind"]],
            "channel": row["channel"],
            "contact": row["contact"],
            "description": row["description"],
            "target_url": row["target_url"],
            "identity_verified": row["identity_verified"],
            "status": row["status"],
            "due_at": row["due_at"].isoformat(),
            "hours_left": int(seconds // 3600),
            "overdue": seconds < 0,
        })
    return items


def answer(cur, request_id, status: str, response: str | None, identity_verified: bool = False) -> dict:
    """Atualiza o andamento. Responder ou negar exige texto (a negativa tem de dizer o motivo, LGPD art. 18 §4º)."""
    if status not in ANSWER_STATUSES:
        raise RequestError("Situação desconhecida.", 400, "status")
    text = _clean_text(response, DESCRIPTION_MAX)
    if status in ("respondida", "negada") and len(text) < 5:
        raise RequestError("Escreva a resposta (e, se for negar, o motivo).", 400, "response")
    cur.execute(SQL_ONE, (str(request_id),))
    row = cur.fetchone()
    if not row:
        raise RequestError("Pedido não encontrado.", 404)
    finished = status in ("respondida", "negada")
    cur.execute(SQL_ANSWER, (status, text or None, bool(identity_verified), finished, str(request_id)))
    if identity_verified and not row["identity_verified"]:
        cur.execute(SQL_INSERT_EVENT, (str(request_id), "identidade_conferida", None))
    cur.execute(SQL_INSERT_EVENT, (str(request_id), status, text[:2000] or None))
    return {"id": str(request_id), "status": status}


# ---------------------------------------------------------------------------- cópia dos dados da conta

SQL_EXPORT_USER = "SELECT id, name, email, role, active, created_at FROM users WHERE id = %s"
SQL_EXPORT_CONSENTS = """
SELECT purpose, granted, document_version, channel, created_at
FROM consent_records WHERE subject_hash = %s ORDER BY seq
"""
SQL_EXPORT_REQUESTS = """
SELECT protocol, kind, status, due_at, created_at, answered_at
FROM data_requests WHERE subject_hash = %s ORDER BY created_at
"""
SQL_EXPORT_COMPANY = """
SELECT name, slug, pix_key_type, pix_key, pix_receiver_name, pix_city, owner_phone, terms_version,
       terms_accepted_at, signup_source, created_at
FROM companies WHERE id = %s
"""
SQL_EXPORT_STAFF = "SELECT name, email, role, active, created_at FROM users WHERE company_id = %s ORDER BY created_at"
SQL_EXPORT_PAYMENTS = """
SELECT amount_cents, period_start, period_end, method, reference, paid_at
FROM subscription_payments WHERE company_id = %s ORDER BY paid_at
"""
SQL_EXPORT_COUNTS = """
SELECT (SELECT count(*) FROM products WHERE company_id = %(c)s) AS produtos,
       (SELECT count(*) FROM orders WHERE company_id = %(c)s) AS pedidos
"""
SQL_EXPORT_ORDERS = """
SELECT id, created_at, order_type, status, total_price, customer_name, customer_phone, delivery_address
FROM orders WHERE company_id = %s ORDER BY created_at DESC LIMIT 5000
"""


def _plain(value):
    """Converte para algo que o JSON aceita (datas em texto, dinheiro em número)."""
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "as_tuple"):  # Decimal
        return float(value)
    if hasattr(value, "hex") and not isinstance(value, (str, bytes, float)):  # UUID
        return str(value)
    return value


def export_account(cur, user_id: str, company_id: str, role: str, *, include_orders: bool = False,
                   now: datetime | None = None) -> dict:
    """Cópia dos dados da própria conta (LGPD art. 18 II e V e art. 19 §3º). Nunca traz o código da senha."""
    cur.execute(SQL_EXPORT_USER, (str(user_id),))
    user = cur.fetchone()
    if not user:
        raise RequestError("Conta não encontrada.", 404)
    subject = outreach.email_hash(user["email"])
    cur.execute(SQL_EXPORT_CONSENTS, (subject,))
    consents = cur.fetchall()
    cur.execute(SQL_EXPORT_REQUESTS, (subject,))
    requests = cur.fetchall()

    body = {
        "gerado_em": (now or _now()).isoformat(),
        "aviso": (
            "Esta é a cópia dos dados que o Vem Comer guarda sobre a sua conta. A senha não aparece: ela é guardada "
            "só como um código que não volta ao texto original. Dados de clientes do restaurante são do restaurante "
            "(o dono pode incluí-los pedindo 'pedidos')."
        ),
        "usuario": user,
        "aceites": consents,
        "pedidos_do_titular": requests,
    }
    if role == "OWNER":
        cur.execute(SQL_EXPORT_COMPANY, (str(company_id),))
        body["restaurante"] = cur.fetchone()
        cur.execute(SQL_EXPORT_STAFF, (str(company_id),))
        body["equipe"] = cur.fetchall()
        cur.execute(SQL_EXPORT_PAYMENTS, (str(company_id),))
        body["pagamentos_da_assinatura"] = cur.fetchall()
        cur.execute(SQL_EXPORT_COUNTS, {"c": str(company_id)})
        body["totais"] = cur.fetchone()
        if include_orders:
            cur.execute(SQL_EXPORT_ORDERS, (str(company_id),))
            body["pedidos"] = cur.fetchall()
    return _plain(body)


# ---------------------------------------------------------------------------- eliminação (anonimização)

SQL_ANON_USER = """
UPDATE users SET name = 'Pessoa removida', email = %s, password_hash = '!', active = false
WHERE id = %s RETURNING company_id, email AS old_email
"""
SQL_USER_EMAIL = "SELECT email FROM users WHERE id = %s"
SQL_COMPANY_USERS = "SELECT id FROM users WHERE company_id = %s"
STEPS_USER = (
    ("avisos_no_celular", "DELETE FROM push_subscriptions WHERE user_id = %s"),
    ("pedidos_de_ajuda", "UPDATE help_requests SET contact_phone = NULL, message = '[removido]' WHERE user_id = %s"),
    ("opinioes", "UPDATE feedback SET comment = NULL WHERE user_id = %s"),
)
STEPS_COMPANY = (
    ("restaurante", """UPDATE companies SET name = 'Restaurante encerrado', slug = 'encerrado-' || left(id::text, 8),
        pix_key_type = NULL, pix_key = NULL, pix_receiver_name = NULL, pix_city = NULL, logo_key = NULL,
        owner_phone = NULL, orders_paused = true, delivery_paused = true, accepts_pickup = false
        WHERE id = %s"""),
    ("pedidos", """UPDATE orders SET customer_name = NULL, customer = NULL, customer_phone = NULL,
        delivery_address = NULL, delivery_code = NULL WHERE company_id = %s"""),
    ("observacoes_dos_itens", "UPDATE order_items SET note = NULL WHERE order_id IN (SELECT id FROM orders WHERE company_id = %s)"),
    ("opinioes_dos_clientes", "UPDATE feedbacks SET comment = NULL WHERE company_id = %s"),
    ("opinioes", "UPDATE feedback SET comment = NULL WHERE company_id = %s"),
    ("pedidos_de_ajuda", "UPDATE help_requests SET contact_phone = NULL, message = '[removido]' WHERE company_id = %s"),
    ("avisos_no_celular", "DELETE FROM push_subscriptions WHERE company_id = %s"),
)


SQL_FIND_PERSON = """
SELECT u.id, u.company_id, u.name, u.role, c.name AS company_name
FROM users u JOIN companies c ON c.id = u.company_id
WHERE lower(u.email) = %s AND u.active
"""


def find_person(cur, email) -> dict | None:
    """Acha a pessoa pelo e-mail do pedido (para o administrador conferir antes de eliminar). Só mostra o necessário."""
    normalized = outreach.normalize_email(email)
    if normalized is None:
        return None
    cur.execute(SQL_FIND_PERSON, (normalized,))
    row = cur.fetchone()
    if not row:
        return None
    return {
        "user_id": str(row["id"]),
        "company_id": str(row["company_id"]),
        "role": row["role"],
        "name_hint": (row["name"][:1] + "***") if row["name"] else "",
        "company_name": row["company_name"],
    }


def anonymize_user(cur, user_id: str) -> dict:
    """Tira a identidade de UMA pessoa da conta. A linha fica (os pedidos e pagamentos apontam para ela), mas sem
    nome, sem e-mail e sem senha que funcione. O e-mail vai para a lista de bloqueio (nunca mais recebe divulgação)."""
    user_id = str(user_id)
    cur.execute(SQL_USER_EMAIL, (user_id,))
    before = cur.fetchone()
    if not before:
        raise RequestError("Pessoa não encontrada.", 404)
    cur.execute(SQL_ANON_USER, (f"removido-{user_id}@anon.invalid", user_id))
    counts = {"pessoa": 1}
    for name, sql in STEPS_USER:
        cur.execute(sql, (user_id,))
        counts[name] = cur.rowcount
    if outreach.normalize_email(before["email"]):
        outreach.suppress(cur, before["email"], "titular")
    return counts


def anonymize_company(cur, company_id: str) -> dict:
    """Encerra um restaurante: todas as pessoas, o dono, os pedidos e as observações. Ficam só valores, datas,
    pagamentos da assinatura e a prova de aceite (a lei manda guardar). O endereço público muda e o cardápio fecha."""
    company_id = str(company_id)
    cur.execute(SQL_COMPANY_USERS, (company_id,))
    user_ids = [row["id"] for row in cur.fetchall()]
    counts = {"pessoas": 0}
    for user_id in user_ids:
        anonymize_user(cur, user_id)
        counts["pessoas"] += 1
    for name, sql in STEPS_COMPANY:
        cur.execute(sql, (company_id,))
        counts[name] = counts.get(name, 0) + cur.rowcount
    return counts
