"""Painel "Seu negócio": as contas que transformam pedidos em respostas para o dono.

Sem Flask e sem banco (recebe as linhas já lidas), para testar sozinho. O SQL fica em business_api.py.

Regras que valem para tudo aqui:
  * Só conta venda de verdade: pedido que a cozinha já aceitou (order_status.SOLD_STATUSES).
  * "Falar sempre a verdade": sem dado suficiente, a resposta é None (a tela diz "poucos dados"), nunca um número
    inventado. Mediana de tempo só aparece com MIN_SAMPLES ou mais registros.
  * Custo vem do que ficou gravado em cada pedido (order_items.unit_cost). Prato sem custo não entra na conta do CMV,
    e a tela mostra quanto das vendas tem custo (cobertura).
  * Gente em ordem alfabética: o painel mostra o que cada um fez, não faz ranking.
  * Relógio de Brasília (UTC-3, sem horário de verão desde 2019), como o horário de funcionamento e a assinatura.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from statistics import median

import order_status

BRAZIL = timezone(timedelta(hours=-3))

PERIODS = {"hoje": 1, "7d": 7, "30d": 30}
PERIOD_LABELS = {"hoje": "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias"}

# Quantos registros a mediana precisa para ser mostrada.
MIN_SAMPLES = 5
# Quantos pedidos a comparação com o período anterior precisa dos dois lados.
MIN_COMPARE_ORDERS = 5
# Tempos fora destes limites são pedido esquecido aberto, não tempo de serviço: não entram na conta.
MAX_KITCHEN_MIN = 240
MAX_CALL_MIN = 120
MAX_DELIVERY_MIN = 180
# Quando o aviso aparece.
DROP_ALERT_PCT = 20
CMV_MARGIN_POINTS = 3
SLOW_KITCHEN_MIN = 30
SLOW_CALL_MIN = 5
LOW_COVERAGE_PCT = 50
TOP_DISHES = 5

EV_PREPARING = order_status.event_type(order_status.PREPARING)
EV_READY = order_status.event_type(order_status.READY)
EV_DONE = order_status.event_type(order_status.DONE)
EVENT_TYPES = (EV_PREPARING, EV_READY, EV_DONE)

WEEKDAYS = ("segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo")
ROLE_LABELS = {
    "OWNER": "Dono", "MANAGER": "Gerente", "WAITER": "Garçom",
    "CASHIER": "Caixa", "KITCHEN": "Cozinha", "COURIER": "Entregador",
}
CHANNEL_LABELS = {"mesa": "Mesa", "balcao": "Balcão", "retirada": "Retirada", "entrega": "Entrega"}
PAYMENT_LABELS = {"pix": "Pix", "cartao": "Cartão", "dinheiro": "Dinheiro"}


# ---------------------------------------------------------------- pequenas ferramentas

def utc(value):
    """Datetime com fuso UTC. Sem fuso (coluna `timestamp` do banco) é UTC; texto ISO também serve."""
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _dec(value) -> Decimal:
    if value is None:
        return Decimal(0)
    return value if isinstance(value, Decimal) else Decimal(str(value))


def money(value) -> float:
    return float(_dec(value).quantize(Decimal("0.01")))


def brl(value) -> str:
    """1234.5 -> 'R$ 1.234,50' (o texto dos avisos é montado aqui para ser testado)."""
    text = f"{_dec(value).quantize(Decimal('0.01')):,.2f}"
    return "R$ " + text.replace(",", "X").replace(".", ",").replace("X", ".")


def pct_text(value) -> str:
    return f"{value:.0f}%".replace(".", ",")


def minutes_text(value) -> str:
    if value < 10:
        return f"{value:.1f}".replace(".", ",") + " min"
    return f"{value:.0f} min"


def change_pct(now_value, before_value):
    """Quanto mudou em %, ou None quando não há como comparar (antes zero ou sem dado)."""
    if now_value is None or before_value is None:
        return None
    before = _dec(before_value)
    if before == 0:
        return None
    return float(((_dec(now_value) - before) / before * 100).quantize(Decimal("0.1")))


def local(value) -> datetime:
    return utc(value).astimezone(BRAZIL)


# ---------------------------------------------------------------- período

def window(period: str, now: datetime) -> dict:
    """O período pedido e o anterior, do mesmo tamanho.

    "hoje" vai da meia-noite de Brasília até agora e é comparado com ontem até a mesma hora (comparar o dia
    inteiro de ontem com meio dia de hoje seria injusto). 7d e 30d contam o dia de hoje e os anteriores.
    """
    if period not in PERIODS:
        raise ValueError("Período inválido")
    now = utc(now)
    days = PERIODS[period]
    today_start = local(now).replace(hour=0, minute=0, second=0, microsecond=0)
    start = (today_start - timedelta(days=days - 1)).astimezone(timezone.utc)
    shift = timedelta(days=days)
    return {
        "period": period,
        "label": PERIOD_LABELS[period],
        "days": days,
        "start": start,
        "end": now,
        "prev_start": start - shift,
        "prev_end": now - shift,
    }


def _split(orders, win):
    """(pedidos vendidos neste período, pedidos vendidos no anterior)."""
    sold = set(order_status.SOLD_STATUSES)
    current, previous = [], []
    for order in orders:
        if order.get("status") not in sold:
            continue
        created = utc(order.get("created_at"))
        if created is None:
            continue
        if win["start"] <= created < win["end"]:
            current.append(order)
        elif win["prev_start"] <= created < win["prev_end"]:
            previous.append(order)
    return current, previous


# ---------------------------------------------------------------- blocos

def summarize(orders, items_by_order=None):
    """Faturamento, pedidos, ticket médio, pratos vendidos e taxa de entrega."""
    revenue = sum((_dec(o.get("total_price")) for o in orders), Decimal(0))
    count = len(orders)
    fees = sum((_dec(o.get("delivery_fee")) for o in orders), Decimal(0))
    dishes = 0
    if items_by_order is not None:
        for order in orders:
            dishes += sum(int(i.get("quantity") or 0) for i in items_by_order.get(str(order.get("id")), []))
    return {
        "revenue": money(revenue),
        "orders": count,
        "avg_ticket": money(revenue / count) if count else None,
        "dishes": dishes,
        "delivery_fees": money(fees),
    }


def hourly(orders):
    """24 posições (hora de Brasília): pedidos e valor por hora do dia."""
    rows = [{"hour": h, "orders": 0, "revenue": Decimal(0)} for h in range(24)]
    for order in orders:
        row = rows[local(order["created_at"]).hour]
        row["orders"] += 1
        row["revenue"] += _dec(order.get("total_price"))
    return [{"hour": r["hour"], "orders": r["orders"], "revenue": money(r["revenue"])} for r in rows]


def _hour_entry(row):
    return {"hour": row["hour"], "label": f"{row['hour']}h", "orders": row["orders"], "revenue": row["revenue"]}


def peak_and_weak(hours):
    """Hora mais forte e hora mais fraca dentro do período em que o restaurante vendeu.

    Só responde com pelo menos 10 pedidos em 3 horas diferentes; abaixo disso qualquer "melhor hora" seria acaso.
    A fraca é a de menor valor entre a primeira e a última hora com venda (hora vazia no meio conta).
    """
    active = [r for r in hours if r["orders"] > 0]
    if sum(r["orders"] for r in hours) < 10 or len(active) < 3:
        return {"peak": None, "weak": None}
    peak = max(active, key=lambda r: (r["revenue"], -r["hour"]))
    first, last = active[0]["hour"], active[-1]["hour"]
    inside = [r for r in hours if first <= r["hour"] <= last and r["hour"] != peak["hour"]]
    weak = min(inside, key=lambda r: (r["revenue"], r["hour"]))
    return {"peak": _hour_entry(peak), "weak": _hour_entry(weak)}


def weekdays(orders):
    """Por dia da semana: pedidos, valor e média por dia que teve venda. Mostra quais dias rendem mais."""
    rows = [{"weekday": d, "name": WEEKDAYS[d], "orders": 0, "revenue": Decimal(0), "dates": set()} for d in range(7)]
    for order in orders:
        when = local(order["created_at"])
        row = rows[when.weekday()]
        row["orders"] += 1
        row["revenue"] += _dec(order.get("total_price"))
        row["dates"].add(when.date())
    result = []
    for row in rows:
        days = len(row["dates"])
        result.append({
            "weekday": row["weekday"],
            "name": row["name"],
            "orders": row["orders"],
            "revenue": money(row["revenue"]),
            "days_with_sales": days,
            "avg_revenue": money(row["revenue"] / days) if days else None,
        })
    return result


def _dish_name(item):
    name = (item.get("name") or "Prato sem nome").strip()
    portion = (item.get("portion") or "").strip()
    if portion and portion.casefold() not in name.casefold():
        return f"{name} · {portion}"
    return name


def dishes(items):
    """Os pratos que mais saem, os que mais faturam e os que mais deixam lucro, mais o CMV real.

    Cada tamanho/sabor é um produto, então cada um aparece sozinho. Lucro só existe onde há custo gravado.
    """
    by_product = {}
    total_revenue = Decimal(0)
    costed_revenue = Decimal(0)
    costed_cost = Decimal(0)
    for item in items:
        quantity = int(item.get("quantity") or 0)
        revenue = _dec(item.get("total"))
        key = str(item.get("product_id"))
        row = by_product.setdefault(key, {
            "name": _dish_name(item), "quantity": 0, "revenue": Decimal(0),
            "costed_revenue": Decimal(0), "cost": Decimal(0), "costed_quantity": 0,
        })
        row["quantity"] += quantity
        row["revenue"] += revenue
        total_revenue += revenue
        if item.get("unit_cost") is not None:
            cost = _dec(item["unit_cost"]) * quantity
            row["cost"] += cost
            row["costed_revenue"] += revenue
            row["costed_quantity"] += quantity
            costed_revenue += revenue
            costed_cost += cost

    entries = []
    for row in by_product.values():
        has_cost = row["costed_quantity"] > 0
        profit = row["costed_revenue"] - row["cost"] if has_cost else None
        entries.append({
            "name": row["name"],
            "quantity": row["quantity"],
            "revenue": money(row["revenue"]),
            "profit": money(profit) if profit is not None else None,
            "cmv": float((row["cost"] / row["costed_revenue"] * 100).quantize(Decimal("0.1")))
            if has_cost and row["costed_revenue"] > 0 else None,
            # Sem custo em todas as unidades vendidas, o lucro vale só para parte delas: a tela avisa.
            "cost_partial": has_cost and row["costed_quantity"] < row["quantity"],
        })

    def top(key, only_costed=False):
        pool = [e for e in entries if e[key] is not None and (not only_costed or e["profit"] is not None)]
        pool = [e for e in pool if e[key] > 0]
        return sorted(pool, key=lambda e: (-e[key], e["name"].casefold()))[:TOP_DISHES]

    coverage = float((costed_revenue / total_revenue * 100).quantize(Decimal("0.1"))) if total_revenue > 0 else None
    cmv = float((costed_cost / costed_revenue * 100).quantize(Decimal("0.1"))) if costed_revenue > 0 else None
    return {
        "by_quantity": top("quantity"),
        "by_revenue": top("revenue"),
        "by_profit": top("profit", only_costed=True),
        "cmv_real": cmv,
        "cost_coverage": coverage,
        "without_cost": sorted(
            (e["name"] for e in entries if e["profit"] is None), key=str.casefold)[:TOP_DISHES],
        "distinct": len(entries),
    }


def _share(counter, labels):
    total_orders = sum(v["orders"] for v in counter.values())
    rows = []
    for key, value in counter.items():
        rows.append({
            "key": key,
            "label": labels.get(key, key.capitalize() if key else "Não informado"),
            "orders": value["orders"],
            "revenue": money(value["revenue"]),
            "share": round(value["orders"] / total_orders * 100, 1) if total_orders else 0,
        })
    return sorted(rows, key=lambda r: (-r["orders"], r["label"]))


def channels(orders):
    counter = {}
    for order in orders:
        key = order.get("order_type") or "balcao"
        row = counter.setdefault(key, {"orders": 0, "revenue": Decimal(0)})
        row["orders"] += 1
        row["revenue"] += _dec(order.get("total_price"))
    return _share(counter, CHANNEL_LABELS)


def payments(orders):
    counter = {}
    for order in orders:
        key = (order.get("payment_method") or "").lower()
        row = counter.setdefault(key, {"orders": 0, "revenue": Decimal(0)})
        row["orders"] += 1
        row["revenue"] += _dec(order.get("total_price"))
    return _share(counter, PAYMENT_LABELS)


def _median_entry(values):
    """{'median_min', 'samples'}; a mediana só existe com MIN_SAMPLES ou mais registros."""
    samples = len(values)
    return {
        "median_min": round(median(values), 1) if samples >= MIN_SAMPLES else None,
        "samples": samples,
    }


def _minutes(start, end, limit):
    start, end = utc(start), utc(end)
    if start is None or end is None:
        return None
    value = (end - start).total_seconds() / 60
    return value if 0 < value <= limit else None


def kitchen_minutes(orders, events):
    """Minutos da cozinha por pedido: de "em preparo" até "pronto" (entrega) ou "concluído" (mesa/balcão/retirada)."""
    first = {}
    for event in events:
        key = (str(event["order_id"]), event["event_type"])
        when = utc(event["created_at"])
        if key not in first or when < first[key]:
            first[key] = when
    values = []
    for order in orders:
        oid = str(order["id"])
        end_type = EV_READY if order.get("order_type") == "entrega" else EV_DONE
        value = _minutes(first.get((oid, EV_PREPARING)), first.get((oid, end_type)), MAX_KITCHEN_MIN)
        if value is not None:
            values.append(value)
    return values


def delivery_minutes(orders):
    values = []
    for order in orders:
        if order.get("order_type") != "entrega":
            continue
        value = _minutes(order.get("picked_up_at"), order.get("delivered_at"), MAX_DELIVERY_MIN)
        if value is not None:
            values.append(value)
    return values


def call_minutes(calls):
    values = []
    for call in calls:
        value = _minutes(call.get("created_at"), call.get("answered_at"), MAX_CALL_MIN)
        if value is not None:
            values.append(value)
    return values


def times(orders, events, calls):
    return {
        "kitchen": _median_entry(kitchen_minutes(orders, events)),
        "delivery": _median_entry(delivery_minutes(orders)),
        "table_call": _median_entry(call_minutes(calls)),
    }


def service(orders, calls, users):
    """O que cada pessoa fez no período, em ordem alfabética (de propósito: não é ranking)."""
    people = {}
    names = {str(u["id"]): u for u in users}

    def person(user_id):
        user = names.get(str(user_id))
        if user is None:
            return None
        return people.setdefault(str(user_id), {
            "name": user.get("name") or "Sem nome",
            "role": ROLE_LABELS.get(user.get("role"), user.get("role") or ""),
            "_calls": [], "_deliveries": [],
        })

    for call in calls:
        if call.get("answered_by") is None:
            continue
        who = person(call["answered_by"])
        value = _minutes(call.get("created_at"), call.get("answered_at"), MAX_CALL_MIN)
        if who is not None and value is not None:
            who["_calls"].append(value)

    for order in orders:
        if order.get("order_type") != "entrega" or order.get("courier_id") is None:
            continue
        if order.get("delivered_at") is None:
            continue
        who = person(order["courier_id"])
        if who is None:
            continue
        value = _minutes(order.get("picked_up_at"), order.get("delivered_at"), MAX_DELIVERY_MIN)
        who["_deliveries"].append(value if value is not None else None)

    result = []
    for who in people.values():
        timed = [v for v in who["_deliveries"] if v is not None]
        calls_entry = _median_entry(who["_calls"])
        delivery_entry = _median_entry(timed)
        result.append({
            "name": who["name"],
            "role": who["role"],
            "calls_answered": len(who["_calls"]),
            "call_median_min": calls_entry["median_min"],
            "deliveries": len(who["_deliveries"]),
            "delivery_median_min": delivery_entry["median_min"],
        })
    return sorted(result, key=lambda p: (p["name"].casefold(), p["role"]))


# ---------------------------------------------------------------- avisos

def attention(summary, previous, dish_view, time_view, cmv_target, live, period):
    """Os avisos que o dono precisa ler, cada um com número e o lugar onde resolve. Vazio = nada preocupante."""
    notes = []

    def add(key, level, title, text, go=None):
        notes.append({"id": key, "level": level, "title": title, "text": text, "go": go})

    orders_now, orders_before = summary["orders"], previous["orders"]

    if orders_now == 0:
        if period == "hoje":
            add("sem_vendas", "info", "Ainda sem vendas hoje",
                "Nenhum pedido aceito até agora. Se o restaurante está aberto, confira se o cardápio está no ar "
                "e o QR das mesas está à vista.", "pedidos")
        else:
            add("sem_vendas", "info", "Sem vendas no período",
                "Nenhum pedido aceito neste período.", "pedidos")

    if orders_now >= MIN_COMPARE_ORDERS and orders_before >= MIN_COMPARE_ORDERS:
        revenue_change = change_pct(summary["revenue"], previous["revenue"])
        if revenue_change is not None and revenue_change <= -DROP_ALERT_PCT:
            add("queda_vendas", "atencao", "Vendas abaixo do período anterior",
                f"Você vendeu {brl(summary['revenue'])}, {pct_text(abs(revenue_change))} a menos que antes "
                f"({brl(previous['revenue'])}).", None)
        elif revenue_change is not None and revenue_change >= DROP_ALERT_PCT:
            add("alta_vendas", "bom", "Vendas acima do período anterior",
                f"Você vendeu {brl(summary['revenue'])}, {pct_text(revenue_change)} a mais que antes "
                f"({brl(previous['revenue'])}).", None)
        ticket_change = change_pct(summary["avg_ticket"], previous["avg_ticket"])
        if ticket_change is not None and ticket_change <= -15:
            add("ticket_caiu", "atencao", "Ticket médio menor",
                f"Cada pedido rendeu {brl(summary['avg_ticket'])}, contra {brl(previous['avg_ticket'])} antes. "
                "Vale oferecer bebida ou sobremesa na hora de pedir.", None)

    cmv, coverage = dish_view["cmv_real"], dish_view["cost_coverage"]
    if cmv is not None and coverage is not None and coverage >= LOW_COVERAGE_PCT:
        if cmv > cmv_target + CMV_MARGIN_POINTS:
            add("cmv_alto", "alerta", "Custo da comida acima da meta",
                f"De cada R$ 100 vendidos, R$ {cmv:.0f} foram para ingredientes; sua meta é R$ {cmv_target:.0f}. "
                "Veja na aba Custos quais pratos puxam o custo para cima.", "custos")
    if coverage is not None and coverage < LOW_COVERAGE_PCT and orders_now > 0:
        add("pouco_custo", "info", "Falta o custo de vários pratos",
            f"Só {pct_text(coverage)} das vendas têm custo calculado. Sem a ficha do prato, o lucro e o CMV "
            "daqui ficam incompletos.", "custos")

    kitchen = time_view["kitchen"]["median_min"]
    if kitchen is not None and kitchen >= SLOW_KITCHEN_MIN:
        add("cozinha_lenta", "atencao", "Cozinha demorando",
            f"Metade dos pedidos levou {minutes_text(kitchen)} ou mais entre aceitar e sair da cozinha.", "pedidos")

    call = time_view["table_call"]["median_min"]
    if call is not None and call >= SLOW_CALL_MIN:
        add("chamado_demorado", "atencao", "Mesas esperando atendimento",
            f"Metade dos chamados das mesas levou {minutes_text(call)} ou mais para ser atendida.", None)

    waiting = live.get("calls_waiting", 0)
    if waiting:
        add("chamados_abertos", "alerta", "Mesa chamando agora",
            f"{waiting} chamado{'s' if waiting != 1 else ''} de mesa esperando há mais de "
            f"{SLOW_CALL_MIN} minutos.", "pedidos")

    order = {"alerta": 0, "atencao": 1, "info": 2, "bom": 3}
    return sorted(notes, key=lambda n: order[n["level"]])


# ---------------------------------------------------------------- tudo junto

def build(*, period, now, orders, items, events, calls, users, cmv_target, live=None):
    """Monta a resposta do painel. `orders` traz o período e o anterior; `items`/`events`/`calls`, o período atual."""
    win = window(period, now)
    current, previous = _split(orders, win)

    items_by_order = {}
    for item in items:
        items_by_order.setdefault(str(item["order_id"]), []).append(item)
    current_ids = {str(o["id"]) for o in current}
    prev_ids = {str(o["id"]) for o in previous}
    current_items = [i for i in items if str(i["order_id"]) in current_ids]

    summary = summarize(current, items_by_order)
    before = summarize(previous, {k: v for k, v in items_by_order.items() if k in prev_ids})
    comparable = summary["orders"] >= MIN_COMPARE_ORDERS and before["orders"] >= MIN_COMPARE_ORDERS

    hours = hourly(current)
    dish_view = dishes(current_items)
    time_view = times(current, [e for e in events if str(e["order_id"]) in current_ids],
                      [c for c in calls if win["start"] <= utc(c["created_at"]) < win["end"]])
    live = live or {}
    cmv_target = cmv_target if cmv_target is not None else 35

    return {
        "period": period,
        "label": win["label"],
        "from": win["start"].isoformat(),
        "to": win["end"].isoformat(),
        "timezone": "America/Sao_Paulo",
        "summary": summary,
        "previous": before,
        "compare": {
            "enough_data": comparable,
            "revenue_pct": change_pct(summary["revenue"], before["revenue"]) if comparable else None,
            "orders_pct": change_pct(summary["orders"], before["orders"]) if comparable else None,
            "ticket_pct": change_pct(summary["avg_ticket"], before["avg_ticket"]) if comparable else None,
            "against": "ontem até esta hora" if period == "hoje" else "período anterior de mesmo tamanho",
        },
        "hours": hours,
        **peak_and_weak(hours),
        "weekdays": weekdays(current) if win["days"] > 1 else None,
        "dishes": dish_view,
        "cmv_target": cmv_target,
        "channels": channels(current),
        "payments": payments(current),
        "times": time_view,
        "service": service(current, [c for c in calls if win["start"] <= utc(c["created_at"]) < win["end"]], users),
        "attention": attention(summary, before, dish_view, time_view, cmv_target, live, period),
        "min_samples": MIN_SAMPLES,
    }
