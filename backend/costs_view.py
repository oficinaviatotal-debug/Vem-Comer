"""Tela de Custos: monta a resposta a partir das linhas do banco, e o custo gravado em cada pedido.

Sem Flask e sem conexao propria (recebe o cursor), para testar sozinho. As contas estao em costing.py.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import costing

COST_PERIOD_DAYS = 30
# Estoque pela ficha: le as vendas desde a contagem, mas nunca mais de 180 dias para tras.
COST_STOCK_MAX_DAYS = 180


def _num(value, places='0.01'):
    """Decimal do banco -> numero do JSON (a tela trabalha com number)."""
    if value is None:
        return None
    return float(Decimal(value).quantize(Decimal(places)))


def order_unit_costs(cur, company_id, product_ids):
    """Custo de cada prato neste momento, para gravar no pedido.

    Roda dentro da transacao do pedido, protegido por um savepoint: se algo der errado aqui,
    o pedido segue sem custo (o cliente nunca fica sem pedir por causa da conta do custo).
    """
    ids = sorted({str(pid) for pid in product_ids})
    if not ids:
        return {}
    try:
        cur.execute("SAVEPOINT unit_costs;")
        cur.execute(
            """
            SELECT
                p.id AS product_id,
                p.extra_cost,
                p.yield_portions,
                pi.quantity,
                i.package_qty,
                i.package_price,
                i.yield_pct
            FROM products p
            LEFT JOIN product_ingredients pi
                ON pi.product_id = p.id
            LEFT JOIN ingredients i
                ON i.id = pi.ingredient_id
                AND i.company_id = p.company_id
            WHERE p.company_id = %s
            AND p.id::text = ANY(%s);
            """,
            (str(company_id), ids)
        )
        rows = cur.fetchall() or []
        cur.execute("RELEASE SAVEPOINT unit_costs;")
    except Exception:
        try:
            cur.execute("ROLLBACK TO SAVEPOINT unit_costs;")
        except Exception:
            pass
        return {}

    try:
        lines = {}
        extras = {}
        portions = {}
        for row in rows:
            pid = str(row['product_id'])
            extras[pid] = row.get('extra_cost') or 0
            portions[pid] = row.get('yield_portions') or 1
            lines.setdefault(pid, [])
            if row.get('quantity') is not None and row.get('package_qty') is not None:
                lines[pid].append((
                    row['quantity'], row['package_qty'], row['package_price'], row.get('yield_pct') or 100
                ))

        # Custo absurdo (erro de digitacao) nao cabe no pedido e nunca pode travar a venda: fica vazio.
        return {
            pid: costing.storable_cost(costing.product_cost(pid_lines, extras.get(pid, 0), portions.get(pid, 1)))
            for pid, pid_lines in lines.items()
        }
    except Exception:
        return {}


def _as_utc(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value


def cost_since(ingredient_rows, now):
    """Desde quando ler as vendas: 30 dias, ou a contagem de estoque mais antiga (ate 180 dias)."""
    since = now - timedelta(days=COST_PERIOD_DAYS)
    for row in ingredient_rows:
        stock_at = _as_utc(row.get('stock_at'))
        if row.get('stock_qty') is not None and stock_at is not None and stock_at < since:
            since = stock_at
    return max(since, now - timedelta(days=COST_STOCK_MAX_DAYS))


def build_cost_view(target, ingredient_rows, product_rows, line_rows, sold_rows, now=None):
    """Monta, a partir das linhas do banco, tudo que a aba Custos mostra."""
    now = now or datetime.now(timezone.utc)
    period_start = now - timedelta(days=COST_PERIOD_DAYS)

    ingredients = {str(row['id']): row for row in ingredient_rows}
    product_by_id = {str(row['id']): row for row in product_rows}
    lines_by_product = {}
    for row in line_rows:
        ingredient = ingredients.get(str(row['ingredient_id']))
        if ingredient is None or str(row['product_id']) not in product_by_id:
            continue
        lines_by_product.setdefault(str(row['product_id']), []).append((row, ingredient))

    # Vendas aceitas: as dos ultimos 30 dias (CMV e lucratividade) e as de depois de cada contagem (estoque).
    sold_30 = {}
    period_items = []
    used_30 = {}
    used_since = {}
    for sale in sold_rows:
        pid = str(sale.get('product_id'))
        created = _as_utc(sale.get('created_at')) or now
        quantity = int(sale.get('quantity') or 0)
        in_period = created >= period_start
        if in_period:
            sold_30[pid] = sold_30.get(pid, 0) + quantity
            period_items.append((quantity, sale['unit_price'], sale.get('unit_cost')))
        product = product_by_id.get(pid)
        if product is None:
            continue
        for line, ing in lines_by_product.get(pid, []):
            use = costing.gross_use(quantity, line['quantity'], product.get('yield_portions') or 1, ing.get('yield_pct'))
            iid = str(ing['id'])
            if in_period:
                used_30[iid] = used_30.get(iid, Decimal('0')) + use
            stock_at = _as_utc(ing.get('stock_at'))
            if ing.get('stock_qty') is not None and stock_at is not None and created > stock_at:
                used_since[iid] = used_since.get(iid, Decimal('0')) + use

    products = []
    margins = []
    for product in product_rows:
        pid = str(product['id'])
        lines = lines_by_product.get(pid, [])
        price = Decimal(product.get('price') or 0)
        portions = product.get('yield_portions') or 1
        cost = costing.product_cost(
            ((line['quantity'], ing['package_qty'], ing['package_price'], ing.get('yield_pct') or 100)
             for line, ing in lines),
            product.get('extra_cost') or 0,
            portions
        )
        unit_margin = costing.margin(cost, price)
        sold = sold_30.get(pid, 0)
        if price > 0:
            margins.append((pid, sold, unit_margin))
        products.append({
            "id": pid,
            "name": product['name'],
            "price": _num(price),
            "menu_id": str(product['menu_id']) if product.get('menu_id') else None,
            "portion": product.get('portion'),
            "portion_grams": _num(product.get('portion_grams'), '0.1'),
            "yield_portions": int(portions),
            "extra_cost": _num(product.get('extra_cost') or 0),
            "recipe": [
                {
                    "ingredient_id": str(ing['id']),
                    "name": ing['name'],
                    "unit": ing['unit'],
                    "quantity": _num(line['quantity'], '0.001'),
                    "cost": _num(costing.line_cost(
                        line['quantity'], ing['package_qty'], ing['package_price'], ing.get('yield_pct') or 100
                    )),
                }
                for line, ing in lines
            ],
            "cost": _num(cost),
            "cmv": _num(costing.cmv_percent(cost, price), '0.1'),
            "margin": _num(unit_margin),
            "status": costing.status(cost, price, target),
            "suggested_price": _num(costing.suggested_price(cost, target)),
            "sold_30d": sold,
            "profit_30d": _num(unit_margin * sold) if unit_margin is not None else None,
            "quadrant": None,
        })

    quadrants, margin_cut, share_cut = costing.menu_engineering(margins)
    for item in products:
        item["quadrant"] = quadrants.get(item["id"])

    ingredient_view = []
    for row in ingredient_rows:
        iid = str(row['id'])
        current = costing.stock_now(row.get('stock_qty'), used_since.get(iid, Decimal('0')))
        used_period = used_30.get(iid, Decimal('0'))
        yields = []
        for pid, pairs in lines_by_product.items():
            for line, ing in pairs:
                if str(ing['id']) != iid:
                    continue
                count = costing.portions_per_package(
                    row['package_qty'], row.get('yield_pct'), line['quantity'],
                    product_by_id[pid].get('yield_portions') or 1
                )
                if count is not None:
                    yields.append({"product_id": pid, "name": product_by_id[pid]['name'], "portions": _num(count, '0.1')})
        ingredient_view.append({
            "id": iid,
            "name": row['name'],
            "unit": row['unit'],
            "package_qty": _num(row['package_qty'], '0.001'),
            "package_price": _num(row['package_price']),
            "yield_pct": int(row.get('yield_pct') or 100),
            "unit_cost": _num(costing.line_cost(1, row['package_qty'], row['package_price'], row.get('yield_pct') or 100), '0.0001'),
            "used_in": len(yields),
            "portions_per_package": sorted(yields, key=lambda item: item["name"].lower()),
            "stock_controlled": row.get('stock_qty') is not None,
            "stock_now": _num(current, '0.001'),
            "stock_at": _as_utc(row.get('stock_at')).isoformat() if row.get('stock_at') else None,
            "used_30d": _num(used_period, '0.001'),
            "days_left": costing.days_left(current, used_period, COST_PERIOD_DAYS),
        })

    period = costing.period_summary(period_items)

    return {
        "target": target,
        "ingredients": ingredient_view,
        "products": products,
        "with_cost": sum(1 for p in products if p["cost"] is not None),
        "period": {
            "days": COST_PERIOD_DAYS,
            "revenue": _num(period['revenue']),
            "covered_revenue": _num(period['covered_revenue']),
            "cost": _num(period['cost']),
            "cmv": _num(period['cmv'], '0.1'),
            "coverage": _num(period['coverage'], '1'),
        },
        "menu": {
            "margin_cut": _num(margin_cut),
            "share_cut": _num(share_cut, '0.1'),
        },
    }
