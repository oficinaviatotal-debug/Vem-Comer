from __future__ import annotations

from decimal import Decimal


def require_session(session: dict | None) -> dict:
    if not session:
        raise PermissionError("unauthenticated")
    return session


def tenant_from_session(session: dict) -> str:
    require_session(session)
    tenant_id = session.get("tenant_id")
    if not tenant_id:
        raise PermissionError("missing tenant")
    return str(tenant_id)


def can_access_order(session: dict | None, order_tenant_id: str) -> bool:
    try:
        return tenant_from_session(session) == str(order_tenant_id)
    except PermissionError:
        return False


def server_total(items: list[dict], catalog: dict[str, Decimal]) -> Decimal:
    total = Decimal("0")
    for item in items:
        product_id = str(item["product_id"])
        quantity = int(item["quantity"])
        total += catalog[product_id] * quantity
    return total
