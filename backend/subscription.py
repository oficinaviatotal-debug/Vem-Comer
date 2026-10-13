"""Assinatura do restaurante: só o uso da plataforma, pago no primeiro dia, bloqueio no dia seguinte (migração 012).

Regras (fala do GD em 07/10/2026, requisito 66):
- R$ 190 por restaurante por mês; o preço fica COPIADO na assinatura de cada um ("quem entrou mais barato mantém");
- paga no primeiro dia, sem semana grátis; o vencimento é todo mês no dia em que pagou pela primeira vez
  (quem entrou dia 29, 30 ou 31 vence no último dia do mês mais curto);
- venceu no dia 5, no dia 6 não funciona. Aviso 3 dias antes e no dia;
- bloqueado = o cliente não consegue fazer pedido novo e o painel só mostra a tela de pagar. Pedido em andamento
  termina, nada é apagado e volta na hora em que paga.

A situação NÃO fica gravada: sai da data de hoje e de `paid_until` (o último dia coberto). Assim não existe tarefa
diária que possa parar de rodar e deixar alguém bloqueado ou liberado por engano.

Nada bloqueia enquanto o administrador não ligar BILLING_ENFORCED=1. Restaurante sem linha em `subscriptions`
(os de teste e os que o próprio GD criou) nunca é bloqueado.

Este arquivo tem as regras e o SQL; as rotas em app.py conversam com o banco.
"""

from __future__ import annotations

import calendar
import os
import re
from datetime import date, datetime, timedelta, timezone

PLAN_CODE = "vemcomer_mensal"
DEFAULT_PRICE_CENTS = 19000
WARN_DAYS = 3
MAX_PAYMENT_CENTS = 1_000_000  # R$ 10.000: acima disso é erro de digitação
PAYMENT_METHODS = ("pix", "dinheiro", "transferencia", "outro")
REFERENCE_MAX = 120

# Brasil não tem horário de verão desde 2019: UTC-3 fixo evita depender do pacote de fusos do servidor.
BRAZIL = timezone(timedelta(hours=-3))

CUSTOMER_MESSAGE = "Este restaurante não está recebendo pedidos agora. Tente de novo mais tarde."

STATES = ("none", "awaiting_payment", "active", "past_due", "canceled")


class SubscriptionError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def billing_enforced() -> bool:
    """Desligado por padrão: ligar é decisão do GD (BILLING_ENFORCED=1)."""
    return os.getenv("BILLING_ENFORCED", "").strip().lower() in ("1", "true", "yes", "sim")


def today_br(now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(BRAZIL).date()


def platform_admin_emails() -> set[str]:
    """E-mails que enxergam todos os restaurantes e registram pagamentos (PLATFORM_ADMIN_EMAILS, separados por vírgula)."""
    raw = os.getenv("PLATFORM_ADMIN_EMAILS", "")
    return {piece.strip().lower() for piece in re.split(r"[,;\s]+", raw) if piece.strip()}


def is_platform_admin(email: str | None) -> bool:
    return bool(email) and email.strip().lower() in platform_admin_emails()


def payment_info() -> dict:
    """Para onde o dono manda o dinheiro. Vem do ambiente do servidor (nunca do navegador); vazio = fale com a gente."""
    contact = re.sub(r"\D", "", os.getenv("BILLING_CONTACT_PHONE", ""))
    return {
        "pix_key": os.getenv("BILLING_PIX_KEY", "").strip()[:140],
        "pix_receiver": os.getenv("BILLING_PIX_RECEIVER", "").strip()[:80],
        "contact_phone": contact[:13],
    }


# ----------------------------------------------------------------------------------------------- datas

def last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def add_month(day: date, anchor_day: int) -> date:
    """O vencimento do mês seguinte: mesmo dia-âncora, ou o último dia do mês quando ele é mais curto."""
    year = day.year + (1 if day.month == 12 else 0)
    month = 1 if day.month == 12 else day.month + 1
    return date(year, month, min(anchor_day, last_day_of_month(year, month)))


def _as_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


# ------------------------------------------------------------------------------------- a situação de hoje

def evaluate(sub: dict | None, today: date) -> dict:
    """O que se sabe da assinatura hoje, pronto para o painel (datas em texto ISO).

    `state`: none (sem assinatura: isento), awaiting_payment (falta o primeiro pagamento), active (em dia),
    past_due (venceu e não pagou) ou canceled. `blocks` diz se, com a cobrança ligada, o restaurante fica parado.
    """
    if not sub:
        return {"state": "none", "blocks": False, "due_date": None, "days_left": None, "warning": None,
                "price_cents": DEFAULT_PRICE_CENTS}

    price = int(sub.get("price_cents") or DEFAULT_PRICE_CENTS)
    paid_until = _as_date(sub.get("paid_until"))
    base = {"price_cents": price, "due_date": paid_until.isoformat() if paid_until else None,
            "days_left": None, "warning": None}

    if sub.get("canceled_at"):
        return {**base, "state": "canceled", "blocks": True}
    if paid_until is None:
        return {**base, "state": "awaiting_payment", "blocks": True, "due_date": None}

    days_left = (paid_until - today).days
    if days_left < 0:
        return {**base, "state": "past_due", "blocks": True, "days_left": days_left}

    warning = "today" if days_left == 0 else "soon" if days_left <= WARN_DAYS else None
    return {**base, "state": "active", "blocks": False, "days_left": days_left, "warning": warning}


def is_blocked(sub: dict | None, today: date, enforced: bool | None = None) -> bool:
    """Bloqueado de verdade: só quando a cobrança está ligada E a situação bloqueia."""
    on = billing_enforced() if enforced is None else enforced
    return bool(on and evaluate(sub, today)["blocks"])


def next_period(sub: dict | None, today: date) -> tuple[date, date, int]:
    """(início do período, novo `paid_until`, dia-âncora) de UM mês a mais, pago hoje.

    - primeiro pagamento: vale desde hoje, e o dia de hoje vira o dia do vencimento;
    - em dia (ou adiantado): continua de onde o período terminava, sem perder nem um dia;
    - vencido: volta hoje, com um mês cheio a partir de hoje, e o dia do vencimento passa a ser o de hoje
      (quem voltou depois de parar não paga os meses em que ficou fora).
    """
    paid_until = _as_date(sub.get("paid_until")) if sub else None
    anchor = sub.get("anchor_day") if sub else None
    if paid_until is None or not anchor:
        return today, add_month(today, today.day), today.day
    if paid_until >= today:
        return paid_until, add_month(paid_until, int(anchor)), int(anchor)
    return today, add_month(today, today.day), today.day


# ---------------------------------------------------------------------------------------------- textos

def reais(cents: int) -> str:
    return f"R$ {cents // 100},{cents % 100:02d}".replace(".", ",")


def br_date(iso: str | None) -> str:
    return date.fromisoformat(iso).strftime("%d/%m") if iso else ""


def owner_message(view: dict) -> str:
    """A frase que o dono lê, sem culpa e dizendo o que fazer."""
    price = reais(view["price_cents"])
    state = view["state"]
    if state == "awaiting_payment":
        return f"Falta o pagamento do primeiro mês ({price}) para começar a vender."
    if state == "past_due":
        return (f"Seu plano venceu em {br_date(view['due_date'])}. Pague {price} e o restaurante volta na hora. "
                "Nada foi apagado.")
    if state == "canceled":
        return "Seu plano foi cancelado. Fale com a gente para voltar."
    if view.get("warning") == "today":
        return f"Seu plano vence hoje. Pague {price} hoje para não parar amanhã."
    if view.get("warning") == "soon":
        days = view["days_left"]
        return f"Seu plano vence em {days} {'dia' if days == 1 else 'dias'} ({br_date(view['due_date'])})."
    return ""


def parse_amount_cents(value, default_cents: int) -> int:
    """Valor recebido, em reais ("190", "190,00", 190.0), para centavos. Vazio = o preço da assinatura."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return default_cents
    text = str(value).strip().replace("R$", "").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    if not re.fullmatch(r"\d+(\.\d{1,2})?", text):
        raise SubscriptionError("Valor inválido. Escreva assim: 190,00")
    cents = round(float(text) * 100)
    if cents <= 0 or cents > MAX_PAYMENT_CENTS:
        raise SubscriptionError("Valor inválido. Escreva um valor de até R$ 10.000,00.")
    return cents


def clean_payment(data) -> tuple[int | None, str, str | None]:
    """(valor em centavos ou None para o preço, forma, referência) de um pagamento registrado à mão."""
    if not isinstance(data, dict):
        data = {}
    method = str(data.get("method") or "pix").strip().lower()
    if method not in PAYMENT_METHODS:
        raise SubscriptionError("Forma de pagamento inválida. Use pix, dinheiro, transferencia ou outro.")
    raw_ref = data.get("reference")
    reference = re.sub(r"\s+", " ", raw_ref).strip()[:REFERENCE_MAX] if isinstance(raw_ref, str) else ""
    amount = data.get("amount")
    cents = None if amount is None or (isinstance(amount, str) and not amount.strip()) else parse_amount_cents(amount, 0)
    return cents, method, reference or None


# ------------------------------------------------------------------------------------------------- SQL

SQL_GET = """
    SELECT company_id, plan_code, price_cents, anchor_day, paid_until, canceled_at, created_at
    FROM subscriptions
    WHERE company_id = %s
"""

SQL_GET_FOR_UPDATE = SQL_GET + " FOR UPDATE"

# Cadastro pela internet: nasce esperando o primeiro pagamento; o preço é o do plano de hoje.
SQL_START = """
    INSERT INTO subscriptions (company_id, plan_code, price_cents)
    SELECT %s::uuid, code, price_cents FROM plans WHERE code = %s AND active = TRUE
    ON CONFLICT (company_id) DO NOTHING
"""

SQL_COMPANY_EXISTS = "SELECT id FROM companies WHERE id = %s"

SQL_RECENT_DUPLICATE = """
    SELECT 1 FROM subscription_payments
    WHERE company_id = %s AND paid_at > now() - interval '30 seconds'
    LIMIT 1
"""

SQL_INSERT_PAYMENT = """
    INSERT INTO subscription_payments (company_id, amount_cents, period_start, period_end, method, reference, recorded_by)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING id, paid_at
"""

SQL_APPLY_PAYMENT = """
    UPDATE subscriptions
    SET paid_until = %s, anchor_day = %s, canceled_at = NULL, updated_at = now()
    WHERE company_id = %s
"""

SQL_RECENT_PAYMENTS = """
    SELECT id, amount_cents, period_start, period_end, method, paid_at
    FROM subscription_payments
    WHERE company_id = %s
    ORDER BY paid_at DESC
    LIMIT 12
"""

SQL_USER_EMAIL = "SELECT email FROM users WHERE id = %s AND active = TRUE"

# Lista do administrador da plataforma: cada restaurante com o dono e a situação da assinatura.
SQL_PLATFORM_LIST = """
    SELECT c.id AS company_id, c.name, c.slug, c.created_at AS company_created_at,
           s.plan_code, s.price_cents, s.anchor_day, s.paid_until, s.canceled_at,
           (s.company_id IS NOT NULL) AS has_subscription,
           c.owner_phone, u.name AS owner_name, u.email AS owner_email
    FROM companies c
    LEFT JOIN subscriptions s ON s.company_id = c.id
    LEFT JOIN LATERAL (
        SELECT name, email FROM users
        WHERE company_id = c.id AND role = 'OWNER' AND active = TRUE
        ORDER BY created_at LIMIT 1
    ) u ON TRUE
    ORDER BY c.created_at DESC
    LIMIT 500
"""

_ORDER = {"past_due": 0, "awaiting_payment": 1, "active": 2, "canceled": 3, "none": 4}


def platform_sort_key(row: dict) -> tuple:
    """Quem precisa de atenção primeiro: vencidos, esperando o primeiro pagamento, vencendo logo, em dia, isentos."""
    view = row["subscription"]
    soon = 0 if view["state"] == "active" and view["warning"] else 1
    left = view["days_left"] if view["days_left"] is not None else 10_000
    return (_ORDER[view["state"]], soon, left, row.get("name") or "")
