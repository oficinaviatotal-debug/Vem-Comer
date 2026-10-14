"""Rota do painel "Seu negócio" (só dono e gerente).

  GET /api/companies/<id>/admin/business?period=hoje|7d|30d

Aqui só tem SQL e a rota. As contas estão em insights.py. Toda consulta é presa ao restaurante de quem está logado.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from flask import jsonify, request
from psycopg2.extras import RealDictCursor

import insights
import order_status
from db import get_db_connection

ROLES = ("OWNER", "MANAGER")
# Chamado de mesa aberto há mais que isto aparece como "mesa chamando agora".
WAITING_CALL_MINUTES = 5


def _utc_naive(value: datetime) -> datetime:
    """Limite de consulta em UTC sem fuso: serve tanto para coluna `timestamp` quanto `timestamptz` (sessão em UTC)."""
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _event_types_sql() -> str:
    return ", ".join(f"'{name}'" for name in insights.EVENT_TYPES)


def load(cur, company_id, period: str, now: datetime | None = None):
    """Lê o que o período precisa e devolve a resposta pronta; None se o restaurante não existe."""
    now = insights.utc(now) if now else datetime.now(timezone.utc)
    win = insights.window(period, now)
    company = str(company_id)

    # A sessão em UTC faz o banco ler os limites (sem fuso) do mesmo jeito nos dois tipos de coluna.
    cur.execute("SET LOCAL TIME ZONE 'UTC'")

    cur.execute("SELECT cmv_target FROM companies WHERE id = %s", (company,))
    row = cur.fetchone()
    if row is None:
        return None
    cmv_target = row["cmv_target"]

    low, high = _utc_naive(win["prev_start"]), _utc_naive(win["end"])
    start = _utc_naive(win["start"])

    cur.execute(
        f"""
        SELECT o.id, o.created_at, o.status, o.order_type, o.total_price, o.delivery_fee,
               o.payment_method, o.courier_id, o.picked_up_at, o.delivered_at
        FROM orders o
        WHERE o.company_id = %s
          AND o.status IN ({order_status.SOLD_STATUSES_SQL})
          AND o.created_at >= %s AND o.created_at < %s
        """,
        (company, low, high),
    )
    orders = cur.fetchall() or []

    cur.execute(
        f"""
        SELECT oi.order_id, oi.product_id, p.name, p.portion, oi.quantity, oi.total, oi.unit_cost
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id AND p.company_id = o.company_id
        WHERE o.company_id = %s
          AND o.status IN ({order_status.SOLD_STATUSES_SQL})
          AND o.created_at >= %s AND o.created_at < %s
        """,
        (company, low, high),
    )
    items = cur.fetchall() or []

    cur.execute(
        f"""
        SELECT e.order_id, e.event_type, e.created_at
        FROM order_events e
        JOIN orders o ON o.id = e.order_id
        WHERE o.company_id = %s
          AND o.created_at >= %s AND o.created_at < %s
          AND e.event_type IN ({_event_types_sql()})
        """,
        (company, start, high),
    )
    events = cur.fetchall() or []

    cur.execute(
        """
        SELECT id, kind, created_at, answered_at, answered_by
        FROM table_calls
        WHERE company_id = %s AND status = 'answered' AND created_at >= %s AND created_at < %s
        """,
        (company, start, high),
    )
    calls = cur.fetchall() or []

    cur.execute("SELECT id, name, role FROM users WHERE company_id = %s", (company,))
    users = cur.fetchall() or []

    cur.execute(
        """
        SELECT count(*) AS waiting
        FROM table_calls
        WHERE company_id = %s AND status = 'open' AND created_at < %s
        """,
        (company, _utc_naive(now) - timedelta(minutes=WAITING_CALL_MINUTES)),
    )
    waiting = (cur.fetchone() or {}).get("waiting") or 0

    return insights.build(
        period=period, now=now, orders=orders, items=items, events=events, calls=calls, users=users,
        cmv_target=cmv_target, live={"calls_waiting": int(waiting)},
    )


def register(app, *, require_roles, require_company_access, error_response) -> None:
    """Liga a rota. Chamada por app.py depois de definir os decoradores de acesso."""

    def admin_business(company_id):
        access_error = require_company_access(company_id)
        if access_error:
            return access_error

        period = (request.args.get("period") or "hoje").strip().lower()
        if period not in insights.PERIODS:
            return jsonify({"error": "Período inválido. Use hoje, 7d ou 30d."}), 400

        conn = None
        cur = None
        try:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            view = load(cur, company_id, period)
            conn.rollback()  # só leitura: nada a gravar, e o SET LOCAL termina aqui
        except Exception as error:  # noqa: BLE001
            return error_response("Não consegui montar o painel agora", error)
        finally:
            if cur is not None:
                cur.close()
            if conn is not None:
                conn.close()

        if view is None:
            return jsonify({"error": "Restaurante nao encontrado"}), 404

        response = jsonify(view)
        response.headers["Cache-Control"] = "no-store"
        return response, 200

    app.add_url_rule(
        "/api/companies/<uuid:company_id>/admin/business",
        endpoint="admin_business",
        view_func=require_roles(*ROLES)(admin_business),
        methods=["GET"],
    )
