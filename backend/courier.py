"""Motoqueiro (requisito 42): pegar o pedido, fechar a entrega com o código do cliente e acertar o dinheiro.

Fluxo de um pedido de entrega:

  cozinha: pronto  ->  motoqueiro: "Peguei" (saiu para entrega, fica no nome dele)
  ->  motoqueiro: "Entreguei" digitando o CÓDIGO de 4 números que o cliente viu na tela do pedido  ->  concluído.

- O código nasce com o pedido de entrega e só o cliente (pelo código de acompanhamento) o vê. O motoqueiro nunca o
  recebe do servidor: errou 5 vezes, a entrega trava e o restaurante fecha pela tela dele.
- Pedido de entrega que já existia antes desta mudança não tem código e fecha como sempre fechou.
- Dinheiro: pedido pago em dinheiro e ainda não confirmado pelo caixa fica "em aberto" no nome do motoqueiro
  (cash_received) até o acerto (cash_settled_at). O acerto também confirma o pagamento do pedido.

Este arquivo só tem as regras e o SQL; as rotas em app.py conversam com o banco.
"""

from __future__ import annotations

import hmac
import re
import secrets
from decimal import Decimal

import order_status

CODE_LENGTH = 4
MAX_CODE_ATTEMPTS = 5

# Quem usa a tela do motoqueiro: o entregador, e o dono/gerente que sai para entregar ele mesmo.
COURIER_ROLES = ("COURIER", "OWNER", "MANAGER")
# Quem vê o dinheiro em aberto e faz o acerto.
SETTLE_ROLES = ("OWNER", "MANAGER", "CASHIER")
# Quem vê todos os pedidos de entrega, de qualquer motoqueiro. O entregador vê os livres e os dele.
SEES_ALL_ROLES = ("OWNER", "MANAGER")

MAX_SETTLE_ORDERS = 200


class CourierError(ValueError):
    """Passo que não dá para fazer; a mensagem vai para a tela e `status` é o código da resposta."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ----------------------------------------------------------------------------------------------- código

def new_delivery_code() -> str:
    """Quatro números sorteados com o gerador seguro do sistema (não adivinhável pelo número do pedido)."""
    return f"{secrets.randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}"


def clean_code(value) -> str | None:
    """O código digitado só com números, ou None se não tem exatamente 4. Aceita "4 8 2 1" e "4821 "."""
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        return None
    digits = re.sub(r"[^0-9]", "", str(value))  # só 0-9 comuns: dígitos de outras escritas não valem
    return digits if len(digits) == CODE_LENGTH else None


def code_matches(expected: str | None, given: str | None) -> bool:
    if not expected or not given:
        return False
    return hmac.compare_digest(expected.encode("utf-8"), given.encode("utf-8"))


def attempts_left(attempts) -> int:
    return max(0, MAX_CODE_ATTEMPTS - int(attempts or 0))


def wrong_code_message(attempts) -> str:
    left = attempts_left(attempts)
    if left <= 0:
        return LOCKED_MESSAGE
    return f"Código errado. Peça de novo ao cliente. Resta {left} tentativa." if left == 1 else (
        f"Código errado. Peça de novo ao cliente. Restam {left} tentativas."
    )


LOCKED_MESSAGE = "Código bloqueado depois de muitas tentativas. Avise o restaurante: ele fecha a entrega pela tela dele."


# ----------------------------------------------------------------------------------------------- dinheiro

def money(value) -> Decimal:
    try:
        return Decimal(str(value if value is not None else 0)).quantize(Decimal("0.01"))
    except Exception:  # noqa: BLE001 - valor estranho do banco nunca derruba a tela
        return Decimal("0.00")


def owes_cash(payment_method, payment_status) -> bool:
    """Em dinheiro e o caixa ainda não confirmou: quem recebe na porta é o motoqueiro."""
    return str(payment_method or "").lower() == "dinheiro" and str(payment_status or "").upper() != "PAID"


def address_line(address) -> str:
    """O endereço numa linha só: "Rua das Flores, 120 · apto 3 · Centro". Vazio se não há."""
    if not isinstance(address, dict):
        return ""

    def text(key):
        value = address.get(key)
        return re.sub(r"\s+", " ", value).strip() if isinstance(value, str) else ""

    street = ", ".join(part for part in (text("street"), text("number")) if part)
    return " · ".join(part for part in (street, text("complement"), text("neighborhood"), text("city")) if part)


# ----------------------------------------------------------------------------------------------- visões

def order_view(row: dict, user_id: str) -> dict:
    """Um pedido como a tela do motoqueiro mostra. Nunca leva o código de entrega."""
    total = money(row.get("total_price"))
    paying_cash = owes_cash(row.get("payment_method"), row.get("payment_status"))
    change_for = money(row.get("payment_change"))
    courier_id = row.get("courier_id")
    address = row.get("delivery_address") if isinstance(row.get("delivery_address"), dict) else {}
    return {
        "id": str(row["id"]),
        "customer_name": row.get("customer_name") or "",
        "phone": row.get("customer_phone") or "",
        "address": address_line(address),
        "reference": (address.get("reference") or "") if isinstance(address.get("reference"), str) else "",
        "zone": row.get("delivery_zone") or "",
        "status": row["status"],
        "total": str(total),
        "payment_method": str(row.get("payment_method") or "").lower(),
        "cash_to_receive": str(total) if paying_cash else "0.00",
        "change_for": str(change_for) if paying_cash and change_for > total else "",
        "change_back": str(change_for - total) if paying_cash and change_for > total else "",
        "mine": bool(courier_id) and str(courier_id) == str(user_id),
        "taken_by_other": bool(courier_id) and str(courier_id) != str(user_id),
        "needs_code": bool(row.get("needs_code")),
        "picked_up_at": row["picked_up_at"].isoformat() if row.get("picked_up_at") else None,
        "delivered_at": row["delivered_at"].isoformat() if row.get("delivered_at") else None,
        "cash_received": str(money(row["cash_received"])) if row.get("cash_received") is not None else "",
        "settled": bool(row.get("cash_settled_at")),
    }


def settlement_view(rows: list[dict]) -> dict:
    """O dinheiro em aberto agrupado por motoqueiro, para o caixa conferir antes de acertar."""
    couriers: dict[str, dict] = {}
    for row in rows:
        key = str(row["courier_id"])
        group = couriers.setdefault(
            key, {"courier_id": key, "name": row.get("courier_name") or "Sem nome", "total": Decimal("0.00"), "orders": []}
        )
        amount = money(row.get("cash_received"))
        group["total"] += amount
        group["orders"].append({
            "id": str(row["id"]),
            "customer_name": row.get("customer_name") or "",
            "amount": str(amount),
            "zone": row.get("delivery_zone") or "",
            "delivered_at": row["delivered_at"].isoformat() if row.get("delivered_at") else None,
        })
    groups = sorted(couriers.values(), key=lambda g: g["name"].lower())
    grand = sum((g["total"] for g in groups), Decimal("0.00"))
    for group in groups:
        group["total"] = str(group["total"].quantize(Decimal("0.01")))
        group["count"] = len(group["orders"])
    return {"couriers": groups, "total": str(grand.quantize(Decimal("0.01"))), "count": sum(g["count"] for g in groups)}


def clean_settle_ids(payload) -> list[str]:
    """Os pedidos que o caixa contou, como a tela mandou. Levanta CourierError se não é uma lista de ids."""
    ids = payload.get("order_ids") if isinstance(payload, dict) else None
    if not isinstance(ids, list) or not ids:
        raise CourierError("Escolha os pedidos que você contou.")
    if len(ids) > MAX_SETTLE_ORDERS:
        raise CourierError(f"São pedidos demais de uma vez (no máximo {MAX_SETTLE_ORDERS}). Acerte em partes.")
    clean = []
    for value in ids:
        if not isinstance(value, str) or not re.fullmatch(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", value):
            raise CourierError("Pedido inválido na lista.")
        if value.lower() not in clean:
            clean.append(value.lower())
    return clean


# ----------------------------------------------------------------------------------------------- decisões

def pickup_outcome(found: dict | None, user_id: str) -> str:
    """Por que "Peguei" não mudou nada. Devolve "already" se o pedido já está com este motoqueiro; senão levanta o motivo."""
    if not found:
        raise CourierError("Pedido não encontrado.", 404)
    if found.get("order_type") != "entrega":
        raise CourierError("Este pedido não é de entrega.", 400)
    holder = found.get("courier_id")
    mine = bool(holder) and str(holder) == str(user_id)
    if holder and not mine:
        raise CourierError("Outro motoqueiro já pegou este pedido.", 409)
    if found.get("status") == order_status.OUT_FOR_DELIVERY and mine:
        return "already"
    if found.get("status") == order_status.DONE:
        raise CourierError("Este pedido já foi entregue.", 409)
    raise CourierError("O pedido ainda não está pronto. A cozinha avisa quando puder pegar.", 409)


def delivery_decision(row: dict | None, user_id: str, code_given) -> dict:
    """O que fazer com "Entreguei", dado o pedido já trancado para esta conta. Não mexe no banco.

    Devolve {"action": "deliver", "cash": Decimal|None}, {"action": "already"} ou {"action": "wrong_code"};
    levanta CourierError quando o passo não pode ser feito.
    """
    if not row:
        raise CourierError("Pedido não encontrado.", 404)
    if row.get("order_type") != "entrega":
        raise CourierError("Este pedido não é de entrega.", 400)
    holder = row.get("courier_id")
    mine = bool(holder) and str(holder) == str(user_id)
    if holder and not mine:
        raise CourierError("Este pedido está com outro motoqueiro.", 409)
    status = row.get("status")
    if status == order_status.DONE:
        if mine:
            return {"action": "already"}
        raise CourierError("O restaurante já fechou este pedido.", 409)
    if status not in (order_status.READY, order_status.OUT_FOR_DELIVERY):
        raise CourierError("O pedido ainda não está pronto. A cozinha avisa quando puder pegar.", 409)

    expected = row.get("delivery_code")
    if expected:  # pedido antigo, de antes do código, fecha como sempre fechou
        if int(row.get("code_attempts") or 0) >= MAX_CODE_ATTEMPTS:
            raise CourierError(LOCKED_MESSAGE, 423)
        given = clean_code(code_given)
        if given is None:
            raise CourierError(f"Digite os {CODE_LENGTH} números do código que o cliente mostra.", 400)
        if not code_matches(expected, given):
            return {"action": "wrong_code"}

    cash = money(row.get("total_price")) if owes_cash(row.get("payment_method"), row.get("payment_status")) else None
    return {"action": "deliver", "cash": cash}


# ----------------------------------------------------------------------------------------------- SQL

# $1 company, $2 user (para "é meu"), $3 vê tudo. Entregues: as das últimas 12 h e, sem limite de tempo, as que ainda
# têm dinheiro em aberto (o motoqueiro vê o que ainda deve ao caixa até o acerto).
SQL_LIST = """
    SELECT o.id, o.customer_name, o.customer_phone, o.delivery_zone, o.delivery_address, o.status,
           o.total_price, o.payment_method, o.payment_change, o.courier_id, o.picked_up_at, o.delivered_at,
           o.cash_received, o.cash_settled_at, (o.delivery_code IS NOT NULL) AS needs_code,
           (SELECT pay.status FROM payments pay WHERE pay.order_id = o.id ORDER BY pay.created_at DESC LIMIT 1)
               AS payment_status
    FROM orders o
    WHERE o.company_id = %s AND o.order_type = 'entrega'
      AND (
            (o.status IN ('pronto', 'saiu para entrega') AND (o.courier_id IS NULL OR o.courier_id = %s OR %s))
         OR (o.status = 'concluido' AND o.courier_id = %s AND (
                o.delivered_at > now() - interval '12 hours'
             OR (o.cash_received IS NOT NULL AND o.cash_settled_at IS NULL)))
      )
    ORDER BY o.created_at ASC
    LIMIT 100
"""

# Tocar duas vezes em "Peguei" não muda nada (e não repete o registro): só pega quem ainda não está com o pedido.
SQL_PICKUP = """
    UPDATE orders
    SET courier_id = %s, status = 'saiu para entrega', picked_up_at = COALESCE(picked_up_at, now())
    WHERE id = %s AND company_id = %s AND order_type = 'entrega'
      AND status IN ('pronto', 'saiu para entrega')
      AND (courier_id IS NULL OR courier_id = %s)
      AND NOT (status = 'saiu para entrega' AND courier_id = %s)
    RETURNING id
"""

SQL_WHY = "SELECT order_type, status, courier_id FROM orders WHERE id = %s AND company_id = %s"

SQL_LOCK_FOR_DELIVERY = """
    SELECT o.order_type, o.status, o.courier_id, o.delivery_code, o.code_attempts, o.total_price,
           o.payment_method,
           (SELECT pay.status FROM payments pay WHERE pay.order_id = o.id ORDER BY pay.created_at DESC LIMIT 1)
               AS payment_status
    FROM orders o
    WHERE o.id = %s AND o.company_id = %s
    FOR UPDATE
"""

SQL_COUNT_WRONG_CODE = """
    UPDATE orders SET code_attempts = code_attempts + 1 WHERE id = %s AND company_id = %s
    RETURNING code_attempts
"""

SQL_DELIVER = """
    UPDATE orders
    SET status = 'concluido', delivered_at = now(), courier_id = COALESCE(courier_id, %s),
        picked_up_at = COALESCE(picked_up_at, now()), cash_received = %s
    WHERE id = %s AND company_id = %s
"""

SQL_EVENT = "INSERT INTO order_events (order_id, event_type) VALUES (%s, %s)"

SQL_CASH_OPEN = """
    SELECT o.id, o.courier_id, u.name AS courier_name, o.customer_name, o.delivery_zone, o.delivered_at,
           o.cash_received
    FROM orders o
    JOIN users u ON u.id = o.courier_id AND u.company_id = o.company_id
    WHERE o.company_id = %s AND o.cash_received IS NOT NULL AND o.cash_settled_at IS NULL
    ORDER BY u.name, o.delivered_at
    LIMIT 500
"""

# Acerta so o que o caixa contou (e que ainda e deste motoqueiro e esta em aberto).
SQL_SETTLE = """
    UPDATE orders
    SET cash_settled_at = now(), cash_settled_by = %s
    WHERE company_id = %s AND courier_id = %s AND id = ANY(%s::uuid[])
      AND cash_received IS NOT NULL AND cash_settled_at IS NULL
    RETURNING id, cash_received
"""

# O dinheiro chegou ao caixa: o pagamento do pedido passa a "pago", como se o caixa tivesse tocado em Pagamento recebido.
SQL_MARK_PAID = """
    UPDATE payments SET status = 'PAID', paid_at = now()
    WHERE order_id = ANY(%s::uuid[]) AND status <> 'PAID'
      AND order_id IN (SELECT id FROM orders WHERE company_id = %s)
"""
