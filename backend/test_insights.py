import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import insights
import order_status

# 14/10/2026, 15:00 em Brasília = 18:00 UTC (quarta-feira).
NOW = datetime(2026, 10, 14, 18, 0, tzinfo=timezone.utc)
BRT = insights.BRAZIL


def at(day, hour, minute=0):
    """Hora de Brasília em outubro de 2026 -> datetime UTC."""
    return datetime(2026, 10, day, hour, minute, tzinfo=BRT).astimezone(timezone.utc)


_counter = [0]


def order(when, total="50.00", status="concluido", kind="mesa", method="pix", **extra):
    _counter[0] += 1
    row = {
        "id": f"o{_counter[0]}", "created_at": when, "status": status, "order_type": kind,
        "total_price": Decimal(total), "delivery_fee": Decimal("0"), "payment_method": method,
        "courier_id": None, "picked_up_at": None, "delivered_at": None,
    }
    row.update(extra)
    return row


def item(order_row, name="Coxinha", qty=1, total="10.00", cost="4.00", product="p1", portion=None):
    return {
        "order_id": order_row["id"], "product_id": product, "name": name, "portion": portion,
        "quantity": qty, "total": Decimal(total), "unit_cost": None if cost is None else Decimal(cost),
    }


class WindowTests(unittest.TestCase):
    def test_today_starts_at_brasilia_midnight_not_utc_midnight(self):
        win = insights.window("hoje", NOW)
        self.assertEqual(win["start"], datetime(2026, 10, 14, 3, 0, tzinfo=timezone.utc))
        self.assertEqual(win["end"], NOW)

    def test_just_after_utc_midnight_is_still_yesterday_in_brasilia(self):
        # 01:00 UTC de 15/10 = 22:00 de 14/10 em Brasília: "hoje" ainda é o dia 14.
        win = insights.window("hoje", datetime(2026, 10, 15, 1, 0, tzinfo=timezone.utc))
        self.assertEqual(win["start"], datetime(2026, 10, 14, 3, 0, tzinfo=timezone.utc))

    def test_previous_window_is_yesterday_until_the_same_hour(self):
        win = insights.window("hoje", NOW)
        self.assertEqual(win["prev_start"], datetime(2026, 10, 13, 3, 0, tzinfo=timezone.utc))
        self.assertEqual(win["prev_end"], datetime(2026, 10, 13, 18, 0, tzinfo=timezone.utc))

    def test_seven_days_counts_today_and_the_six_before(self):
        win = insights.window("7d", NOW)
        self.assertEqual(win["start"], datetime(2026, 10, 8, 3, 0, tzinfo=timezone.utc))
        self.assertEqual(win["prev_start"], datetime(2026, 10, 1, 3, 0, tzinfo=timezone.utc))
        self.assertEqual(win["prev_end"], datetime(2026, 10, 7, 18, 0, tzinfo=timezone.utc))

    def test_thirty_days(self):
        win = insights.window("30d", NOW)
        self.assertEqual(win["days"], 30)
        self.assertEqual((win["end"] - win["start"]).days, 29)

    def test_unknown_period_is_refused(self):
        with self.assertRaises(ValueError):
            insights.window("ano", NOW)

    def test_naive_now_is_read_as_utc(self):
        win = insights.window("hoje", datetime(2026, 10, 14, 18, 0))
        self.assertEqual(win["end"], NOW)


class SplitTests(unittest.TestCase):
    def test_only_accepted_orders_count_and_they_are_split_by_window(self):
        win = insights.window("hoje", NOW)
        today = order(at(14, 12))
        yesterday = order(at(13, 12))
        yesterday_late = order(at(13, 16))  # depois da mesma hora de ontem: fora das duas janelas
        pending = order(at(14, 12), status=order_status.PENDING)
        old = order(at(10, 12))
        current, previous = insights._split([today, yesterday, yesterday_late, pending, old], win)
        self.assertEqual([o["id"] for o in current], [today["id"]])
        self.assertEqual([o["id"] for o in previous], [yesterday["id"]])

    def test_every_sold_status_counts(self):
        win = insights.window("hoje", NOW)
        rows = [order(at(14, 10), status=s) for s in order_status.SOLD_STATUSES]
        current, _ = insights._split(rows, win)
        self.assertEqual(len(current), len(order_status.SOLD_STATUSES))

    def test_naive_database_timestamps_are_utc(self):
        win = insights.window("hoje", NOW)
        row = order(datetime(2026, 10, 14, 15, 0))  # 15:00 UTC = 12:00 em Brasília, hoje
        current, _ = insights._split([row], win)
        self.assertEqual(len(current), 1)


class SummaryTests(unittest.TestCase):
    def test_revenue_orders_ticket_and_dishes(self):
        a, b = order(at(14, 12), total="60.00"), order(at(14, 13), total="40.00")
        items = {a["id"]: [item(a, qty=2), item(a, qty=1)], b["id"]: [item(b, qty=3)]}
        result = insights.summarize([a, b], items)
        self.assertEqual(result["revenue"], 100.0)
        self.assertEqual(result["orders"], 2)
        self.assertEqual(result["avg_ticket"], 50.0)
        self.assertEqual(result["dishes"], 6)

    def test_no_orders_has_no_ticket_instead_of_zero(self):
        result = insights.summarize([], {})
        self.assertEqual(result["orders"], 0)
        self.assertIsNone(result["avg_ticket"])

    def test_ticket_rounds_to_cents(self):
        rows = [order(at(14, 10), total="10.00"), order(at(14, 11), total="10.00"), order(at(14, 12), total="10.01")]
        self.assertEqual(insights.summarize(rows)["avg_ticket"], 10.0)

    def test_delivery_fees_are_summed(self):
        rows = [order(at(14, 10), delivery_fee=Decimal("5.00")), order(at(14, 11), delivery_fee=Decimal("4.50"))]
        self.assertEqual(insights.summarize(rows)["delivery_fees"], 9.5)


class HourlyTests(unittest.TestCase):
    def test_orders_land_in_the_brasilia_hour(self):
        rows = [order(at(14, 12, 59)), order(at(14, 13, 0)), order(at(14, 13, 30), total="20.00")]
        hours = insights.hourly(rows)
        self.assertEqual(len(hours), 24)
        self.assertEqual(hours[12]["orders"], 1)
        self.assertEqual(hours[13]["orders"], 2)
        self.assertEqual(hours[13]["revenue"], 70.0)
        self.assertEqual(hours[3]["orders"], 0)

    def test_late_night_order_stays_on_brasilia_hour(self):
        row = order(datetime(2026, 10, 15, 1, 30, tzinfo=timezone.utc))  # 22:30 em Brasília
        self.assertEqual(insights.hourly([row])[22]["orders"], 1)


class PeakWeakTests(unittest.TestCase):
    def hours(self, spec):
        rows = [{"hour": h, "orders": 0, "revenue": 0.0} for h in range(24)]
        for hour, orders, revenue in spec:
            rows[hour] = {"hour": hour, "orders": orders, "revenue": revenue}
        return rows

    def test_peak_and_weak_inside_the_selling_span(self):
        rows = self.hours([(11, 3, 150.0), (12, 8, 400.0), (13, 4, 200.0), (14, 1, 40.0), (15, 3, 120.0)])
        result = insights.peak_and_weak(rows)
        self.assertEqual(result["peak"]["hour"], 12)
        self.assertEqual(result["peak"]["label"], "12h")
        self.assertEqual(result["weak"]["hour"], 14)

    def test_empty_hour_between_sales_is_the_weak_one(self):
        rows = self.hours([(11, 4, 200.0), (12, 6, 300.0), (14, 2, 80.0)])
        self.assertEqual(insights.peak_and_weak(rows)["weak"]["hour"], 13)

    def test_hours_before_first_and_after_last_sale_never_count_as_weak(self):
        rows = self.hours([(18, 4, 200.0), (19, 8, 400.0), (20, 3, 100.0)])
        self.assertEqual(insights.peak_and_weak(rows)["weak"]["hour"], 20)

    def test_too_few_orders_means_no_answer(self):
        rows = self.hours([(11, 2, 100.0), (12, 3, 150.0), (13, 2, 90.0)])
        self.assertEqual(insights.peak_and_weak(rows), {"peak": None, "weak": None})

    def test_too_few_distinct_hours_means_no_answer(self):
        rows = self.hours([(12, 8, 400.0), (13, 8, 380.0)])
        self.assertEqual(insights.peak_and_weak(rows), {"peak": None, "weak": None})

    def test_tie_goes_to_the_earlier_hour(self):
        rows = self.hours([(11, 5, 100.0), (12, 5, 100.0), (13, 5, 50.0)])
        self.assertEqual(insights.peak_and_weak(rows)["peak"]["hour"], 11)


class WeekdayTests(unittest.TestCase):
    def test_average_is_per_day_that_had_sales(self):
        # 14/10/2026 é quarta; 7/10 também.
        rows = [order(at(14, 12), total="100.00"), order(at(7, 12), total="300.00"), order(at(7, 13), total="100.00")]
        wed = insights.weekdays(rows)[2]
        self.assertEqual(wed["name"], "quarta")
        self.assertEqual(wed["orders"], 3)
        self.assertEqual(wed["revenue"], 500.0)
        self.assertEqual(wed["days_with_sales"], 2)
        self.assertEqual(wed["avg_revenue"], 250.0)

    def test_day_without_sales_has_no_average(self):
        mon = insights.weekdays([order(at(14, 12))])[0]
        self.assertEqual(mon["orders"], 0)
        self.assertIsNone(mon["avg_revenue"])

    def test_seven_entries_monday_first(self):
        names = [d["name"] for d in insights.weekdays([])]
        self.assertEqual(names[0], "segunda")
        self.assertEqual(names[6], "domingo")


class DishesTests(unittest.TestCase):
    def setUp(self):
        self.o = order(at(14, 12))

    def test_each_size_is_its_own_dish(self):
        rows = [
            item(self.o, name="Coca-Cola", qty=3, total="15.00", cost="2.00", product="coca-lata", portion="350 ml"),
            item(self.o, name="Coca-Cola", qty=1, total="12.00", cost="5.00", product="coca-2l", portion="2 L"),
        ]
        names = [d["name"] for d in insights.dishes(rows)["by_quantity"]]
        self.assertEqual(names, ["Coca-Cola · 350 ml", "Coca-Cola · 2 L"])

    def test_portion_already_in_the_name_is_not_repeated(self):
        row = item(self.o, name="Coca 350 ml", portion="350 ml")
        self.assertEqual(insights.dishes([row])["by_quantity"][0]["name"], "Coca 350 ml")

    def test_the_same_product_in_many_orders_is_added_up(self):
        rows = [item(self.o, qty=2, total="20.00"), item(order(at(14, 13)), qty=3, total="30.00")]
        top = insights.dishes(rows)["by_quantity"][0]
        self.assertEqual((top["quantity"], top["revenue"]), (5, 50.0))

    def test_profit_and_cmv_use_the_cost_saved_in_the_order(self):
        rows = [item(self.o, qty=2, total="20.00", cost="3.00")]
        view = insights.dishes(rows)
        self.assertEqual(view["by_profit"][0]["profit"], 14.0)
        self.assertEqual(view["by_profit"][0]["cmv"], 30.0)
        self.assertEqual(view["cmv_real"], 30.0)
        self.assertEqual(view["cost_coverage"], 100.0)

    def test_dish_without_cost_is_left_out_of_profit_and_cmv_and_reported(self):
        rows = [
            item(self.o, name="Com custo", qty=1, total="10.00", cost="4.00", product="a"),
            item(self.o, name="Sem custo", qty=5, total="90.00", cost=None, product="b"),
        ]
        view = insights.dishes(rows)
        self.assertEqual([d["name"] for d in view["by_profit"]], ["Com custo"])
        self.assertEqual(view["cmv_real"], 40.0)
        self.assertEqual(view["cost_coverage"], 10.0)
        self.assertEqual(view["without_cost"], ["Sem custo"])
        # E o prato sem custo continua aparecendo entre os mais vendidos.
        self.assertEqual(view["by_quantity"][0]["name"], "Sem custo")

    def test_partial_cost_is_flagged(self):
        rows = [item(self.o, qty=1, total="10.00", cost="4.00"), item(order(at(14, 13)), qty=1, total="10.00", cost=None)]
        top = insights.dishes(rows)["by_profit"][0]
        self.assertTrue(top["cost_partial"])

    def test_no_sales_no_percentages(self):
        view = insights.dishes([])
        self.assertIsNone(view["cmv_real"])
        self.assertIsNone(view["cost_coverage"])
        self.assertEqual(view["by_quantity"], [])

    def test_top_list_is_limited_and_ordered(self):
        rows = [item(self.o, name=f"P{n}", qty=n, total=str(n * 10), product=f"p{n}") for n in range(1, 9)]
        names = [d["name"] for d in insights.dishes(rows)["by_quantity"]]
        self.assertEqual(names, ["P8", "P7", "P6", "P5", "P4"])

    def test_loss_making_dish_never_shows_as_profit_leader(self):
        rows = [item(self.o, name="Prejuizo", qty=1, total="5.00", cost="9.00", product="x")]
        self.assertEqual(insights.dishes(rows)["by_profit"], [])


class ChannelsAndPaymentsTests(unittest.TestCase):
    def test_shares_follow_orders(self):
        rows = [order(at(14, 10), kind="mesa"), order(at(14, 11), kind="mesa"), order(at(14, 12), kind="entrega", total="30.00")]
        result = insights.channels(rows)
        self.assertEqual([(r["label"], r["orders"]) for r in result], [("Mesa", 2), ("Entrega", 1)])
        self.assertAlmostEqual(result[0]["share"], 66.7)
        self.assertEqual(result[1]["revenue"], 30.0)

    def test_payment_methods_have_names(self):
        rows = [order(at(14, 10), method="pix"), order(at(14, 11), method="dinheiro"), order(at(14, 12), method=None)]
        labels = {r["label"] for r in insights.payments(rows)}
        self.assertEqual(labels, {"Pix", "Dinheiro", "Não informado"})


class TimesTests(unittest.TestCase):
    def kitchen(self, minutes_list, kind="mesa"):
        orders, events = [], []
        for minutes in minutes_list:
            row = order(at(14, 12), kind=kind)
            orders.append(row)
            events.append({"order_id": row["id"], "event_type": insights.EV_PREPARING, "created_at": at(14, 12)})
            end = insights.EV_READY if kind == "entrega" else insights.EV_DONE
            events.append({"order_id": row["id"], "event_type": end, "created_at": at(14, 12) + timedelta(minutes=minutes)})
        return orders, events

    def test_median_needs_the_minimum_number_of_samples(self):
        orders, events = self.kitchen([10, 20, 30, 40])
        entry = insights.times(orders, events, [])["kitchen"]
        self.assertEqual(entry, {"median_min": None, "samples": 4})
        orders, events = self.kitchen([10, 20, 30, 40, 50])
        entry = insights.times(orders, events, [])["kitchen"]
        self.assertEqual(entry, {"median_min": 30.0, "samples": 5})

    def test_delivery_order_ends_at_ready_not_at_done(self):
        orders, events = self.kitchen([12] * 5, kind="entrega")
        events += [{"order_id": o["id"], "event_type": insights.EV_DONE, "created_at": at(14, 14)} for o in orders]
        self.assertEqual(insights.times(orders, events, [])["kitchen"]["median_min"], 12.0)

    def test_forgotten_order_does_not_enter_the_average(self):
        orders, events = self.kitchen([10, 10, 10, 10, 10, 500])
        entry = insights.times(orders, events, [])["kitchen"]
        self.assertEqual(entry["samples"], 5)
        self.assertEqual(entry["median_min"], 10.0)

    def test_first_event_wins_when_repeated(self):
        row = order(at(14, 12))
        events = [
            {"order_id": row["id"], "event_type": insights.EV_PREPARING, "created_at": at(14, 12, 10)},
            {"order_id": row["id"], "event_type": insights.EV_PREPARING, "created_at": at(14, 12, 0)},
            {"order_id": row["id"], "event_type": insights.EV_DONE, "created_at": at(14, 12, 20)},
        ]
        self.assertEqual(insights.kitchen_minutes([row], events), [20.0])

    def test_order_without_events_is_ignored(self):
        self.assertEqual(insights.kitchen_minutes([order(at(14, 12))], []), [])

    def test_delivery_time_comes_from_pickup_to_delivered(self):
        rows = [
            order(at(14, 12), kind="entrega", picked_up_at=at(14, 12, 5), delivered_at=at(14, 12, 25))
            for _ in range(5)
        ]
        self.assertEqual(insights.times(rows, [], [])["delivery"], {"median_min": 20.0, "samples": 5})

    def test_table_call_response_time(self):
        calls = [{"created_at": at(14, 12), "answered_at": at(14, 12, 3)} for _ in range(5)]
        self.assertEqual(insights.times([], [], calls)["table_call"], {"median_min": 3.0, "samples": 5})

    def test_negative_times_are_discarded(self):
        calls = [{"created_at": at(14, 12, 5), "answered_at": at(14, 12, 0)}]
        self.assertEqual(insights.call_minutes(calls), [])


class ServiceTests(unittest.TestCase):
    USERS = [
        {"id": "u-zeca", "name": "Zeca", "role": "COURIER"},
        {"id": "u-ana", "name": "ana", "role": "WAITER"},
        {"id": "u-bia", "name": "Bia", "role": "WAITER"},
    ]

    def test_people_are_listed_alphabetically_whatever_their_numbers(self):
        calls = [{"created_at": at(14, 12), "answered_at": at(14, 12, 1), "answered_by": "u-bia"} for _ in range(9)]
        calls += [{"created_at": at(14, 12), "answered_at": at(14, 12, 1), "answered_by": "u-ana"}]
        names = [p["name"] for p in insights.service([], calls, self.USERS)]
        self.assertEqual(names, ["ana", "Bia"])

    def test_waiter_counts_calls_and_median_after_enough_samples(self):
        calls = [{"created_at": at(14, 12), "answered_at": at(14, 12, m), "answered_by": "u-ana"} for m in (1, 2, 3, 4, 5)]
        ana = insights.service([], calls, self.USERS)[0]
        self.assertEqual((ana["calls_answered"], ana["call_median_min"]), (5, 3.0))
        self.assertEqual(ana["role"], "Garçom")

    def test_median_hidden_with_few_calls(self):
        calls = [{"created_at": at(14, 12), "answered_at": at(14, 12, 2), "answered_by": "u-ana"}]
        ana = insights.service([], calls, self.USERS)[0]
        self.assertEqual(ana["calls_answered"], 1)
        self.assertIsNone(ana["call_median_min"])

    def test_courier_deliveries(self):
        rows = [
            order(at(14, 12), kind="entrega", courier_id="u-zeca", picked_up_at=at(14, 12, 5), delivered_at=at(14, 12, 25))
            for _ in range(5)
        ]
        zeca = insights.service(rows, [], self.USERS)[0]
        self.assertEqual((zeca["deliveries"], zeca["delivery_median_min"]), (5, 20.0))

    def test_undelivered_order_is_not_a_delivery_done(self):
        rows = [order(at(14, 12), kind="entrega", courier_id="u-zeca", picked_up_at=at(14, 12, 5))]
        self.assertEqual(insights.service(rows, [], self.USERS), [])

    def test_unknown_user_and_unanswered_calls_are_ignored(self):
        calls = [
            {"created_at": at(14, 12), "answered_at": at(14, 12, 1), "answered_by": "u-fantasma"},
            {"created_at": at(14, 12), "answered_at": at(14, 12, 1), "answered_by": None},
        ]
        self.assertEqual(insights.service([], calls, self.USERS), [])

    def test_no_ranking_fields(self):
        calls = [{"created_at": at(14, 12), "answered_at": at(14, 12, 1), "answered_by": "u-ana"}]
        person = insights.service([], calls, self.USERS)[0]
        self.assertFalse({"rank", "position", "score", "best"} & set(person))


class AttentionTests(unittest.TestCase):
    def view(self, **over):
        base = dict(
            summary={"orders": 20, "revenue": 1000.0, "avg_ticket": 50.0},
            previous={"orders": 20, "revenue": 1000.0, "avg_ticket": 50.0},
            dish_view={"cmv_real": 30.0, "cost_coverage": 90.0},
            time_view={"kitchen": {"median_min": 12.0}, "table_call": {"median_min": 2.0}},
            cmv_target=35, live={"calls_waiting": 0}, period="7d",
        )
        base.update(over)
        return insights.attention(**base)

    def ids(self, notes):
        return [n["id"] for n in notes]

    def test_healthy_business_has_no_warnings(self):
        self.assertEqual(self.view(), [])

    def test_big_drop_warns_with_numbers(self):
        notes = self.view(summary={"orders": 20, "revenue": 700.0, "avg_ticket": 35.0})
        self.assertIn("queda_vendas", self.ids(notes))
        text = next(n["text"] for n in notes if n["id"] == "queda_vendas")
        self.assertIn("R$ 700,00", text)
        self.assertIn("30%", text)

    def test_small_drop_is_silent(self):
        notes = self.view(summary={"orders": 20, "revenue": 900.0, "avg_ticket": 45.0})
        self.assertNotIn("queda_vendas", self.ids(notes))

    def test_no_comparison_warning_without_enough_orders(self):
        notes = self.view(summary={"orders": 3, "revenue": 100.0, "avg_ticket": 33.0})
        self.assertNotIn("queda_vendas", self.ids(notes))

    def test_growth_is_good_news(self):
        notes = self.view(summary={"orders": 30, "revenue": 1500.0, "avg_ticket": 50.0})
        self.assertEqual(notes[0]["level"], "bom")

    def test_ticket_drop(self):
        notes = self.view(summary={"orders": 25, "revenue": 1000.0, "avg_ticket": 40.0})
        self.assertIn("ticket_caiu", self.ids(notes))

    def test_cmv_above_target_alerts_and_points_to_custos(self):
        notes = self.view(dish_view={"cmv_real": 42.0, "cost_coverage": 80.0})
        note = next(n for n in notes if n["id"] == "cmv_alto")
        self.assertEqual((note["level"], note["go"]), ("alerta", "custos"))
        self.assertIn("R$ 42", note["text"])
        self.assertIn("R$ 35", note["text"])

    def test_cmv_within_margin_is_silent(self):
        notes = self.view(dish_view={"cmv_real": 37.0, "cost_coverage": 80.0})
        self.assertNotIn("cmv_alto", self.ids(notes))

    def test_cmv_is_not_claimed_when_few_sales_have_cost(self):
        notes = self.view(dish_view={"cmv_real": 60.0, "cost_coverage": 30.0})
        self.assertNotIn("cmv_alto", self.ids(notes))
        self.assertIn("pouco_custo", self.ids(notes))

    def test_slow_kitchen_and_slow_tables(self):
        notes = self.view(time_view={"kitchen": {"median_min": 35.0}, "table_call": {"median_min": 6.0}})
        self.assertIn("cozinha_lenta", self.ids(notes))
        self.assertIn("chamado_demorado", self.ids(notes))

    def test_missing_medians_never_warn(self):
        notes = self.view(time_view={"kitchen": {"median_min": None}, "table_call": {"median_min": None}})
        self.assertEqual(notes, [])

    def test_tables_calling_now(self):
        notes = self.view(live={"calls_waiting": 2})
        note = next(n for n in notes if n["id"] == "chamados_abertos")
        self.assertIn("2 chamados", note["text"])
        self.assertEqual(note["level"], "alerta")

    def test_single_call_uses_singular(self):
        notes = self.view(live={"calls_waiting": 1})
        self.assertIn("1 chamado de mesa", notes[0]["text"])

    def test_no_sales_today_is_information_not_alarm(self):
        notes = self.view(summary={"orders": 0, "revenue": 0.0, "avg_ticket": None},
                          previous={"orders": 0, "revenue": 0.0, "avg_ticket": None},
                          dish_view={"cmv_real": None, "cost_coverage": None}, period="hoje")
        self.assertEqual(self.ids(notes), ["sem_vendas"])
        self.assertEqual(notes[0]["level"], "info")

    def test_most_urgent_first(self):
        notes = self.view(
            summary={"orders": 30, "revenue": 1500.0, "avg_ticket": 50.0},
            dish_view={"cmv_real": 50.0, "cost_coverage": 90.0},
            time_view={"kitchen": {"median_min": 40.0}, "table_call": {"median_min": None}},
        )
        self.assertEqual([n["level"] for n in notes], sorted([n["level"] for n in notes],
                         key=["alerta", "atencao", "info", "bom"].index))


class FormattingTests(unittest.TestCase):
    def test_brl(self):
        self.assertEqual(insights.brl(1234.5), "R$ 1.234,50")
        self.assertEqual(insights.brl(0), "R$ 0,00")
        self.assertEqual(insights.brl(Decimal("1000000")), "R$ 1.000.000,00")

    def test_change_pct(self):
        self.assertEqual(insights.change_pct(120, 100), 20.0)
        self.assertEqual(insights.change_pct(80, 100), -20.0)
        self.assertIsNone(insights.change_pct(10, 0))
        self.assertIsNone(insights.change_pct(None, 5))

    def test_minutes_text(self):
        self.assertEqual(insights.minutes_text(4.5), "4,5 min")
        self.assertEqual(insights.minutes_text(32.0), "32 min")


class BuildTests(unittest.TestCase):
    def sample(self):
        orders, items, events = [], [], []
        for n in range(12):
            o = order(at(14, 11 + n % 4), total="50.00", kind="mesa")
            orders.append(o)
            items.append(item(o, name="Prato do dia", qty=1, total="50.00", cost="15.00", product="pdd"))
            events.append({"order_id": o["id"], "event_type": insights.EV_PREPARING, "created_at": at(14, 11)})
            events.append({"order_id": o["id"], "event_type": insights.EV_DONE, "created_at": at(14, 11, 15)})
        for n in range(12):
            o = order(at(13, 11 + n % 4), total="40.00")
            orders.append(o)
            items.append(item(o, total="40.00", cost="12.00", product="pdd"))
        return orders, items, events

    def build(self, period="hoje", **over):
        orders, items, events = self.sample()
        args = dict(period=period, now=NOW, orders=orders, items=items, events=events, calls=[],
                    users=[], cmv_target=35, live={"calls_waiting": 0})
        args.update(over)
        return insights.build(**args)

    def test_today_against_yesterday_until_the_same_hour(self):
        result = self.build()
        self.assertEqual(result["summary"]["orders"], 12)
        self.assertEqual(result["summary"]["revenue"], 600.0)
        self.assertEqual(result["previous"]["revenue"], 480.0)
        self.assertTrue(result["compare"]["enough_data"])
        self.assertEqual(result["compare"]["revenue_pct"], 25.0)
        self.assertEqual(result["compare"]["against"], "ontem até esta hora")
        self.assertIsNone(result["weekdays"])

    def test_today_hours_peak_and_kitchen_time(self):
        result = self.build()
        self.assertEqual(len(result["hours"]), 24)
        self.assertIsNotNone(result["peak"])
        self.assertEqual(result["times"]["kitchen"], {"median_min": 15.0, "samples": 12})

    def test_seven_days_has_weekdays_and_both_days(self):
        result = self.build("7d")
        self.assertEqual(result["summary"]["orders"], 24)
        self.assertEqual(len(result["weekdays"]), 7)

    def test_items_of_the_previous_period_do_not_leak_into_dishes(self):
        result = self.build()
        self.assertEqual(result["dishes"]["by_quantity"][0]["quantity"], 12)

    def test_cmv_target_default_when_company_has_none(self):
        self.assertEqual(self.build(cmv_target=None)["cmv_target"], 35)

    def test_response_is_json_serialisable(self):
        import json
        json.dumps(self.build("30d"))

    def test_empty_restaurant_gets_a_clean_answer(self):
        result = insights.build(period="hoje", now=NOW, orders=[], items=[], events=[], calls=[], users=[],
                                cmv_target=35)
        self.assertEqual(result["summary"]["orders"], 0)
        self.assertIsNone(result["summary"]["avg_ticket"])
        self.assertFalse(result["compare"]["enough_data"])
        self.assertEqual([n["id"] for n in result["attention"]], ["sem_vendas"])
        self.assertEqual(result["peak"], None)


if __name__ == "__main__":
    unittest.main()
