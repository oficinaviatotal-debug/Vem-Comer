"""Prova no PostgreSQL de verdade: o painel "Seu negócio" lê o esquema real e separa um restaurante do outro.

Roda só com VEM_TEST_DATABASE_URL (fluxo .github/workflows/compliance.yml). Cada teste trabalha dentro de uma
transação desfeita no fim: o banco não fica sujo.
"""

import os
import unittest
from datetime import datetime, timedelta, timezone

import business_api
import order_status

URL = os.getenv("VEM_TEST_DATABASE_URL")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover
    psycopg2 = None

# 14/10/2026, 15:00 em Brasília.
NOW = datetime(2026, 10, 14, 18, 0, tzinfo=timezone.utc)
BRT = timezone(timedelta(hours=-3))


def brt(day, hour, minute=0):
    return datetime(2026, 10, day, hour, minute, tzinfo=BRT).astimezone(timezone.utc).replace(tzinfo=None)


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar os testes de banco")
class BusinessDbTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg2.connect(URL)
        self.cur = self.conn.cursor(cursor_factory=RealDictCursor)
        self.n = 0

    def tearDown(self):
        self.conn.rollback()
        self.cur.close()
        self.conn.close()

    # ---- ajudantes

    def restaurante(self, nome="Cantina do Teste"):
        self.n += 1
        cur = self.cur
        cur.execute(
            "INSERT INTO companies (name, slug) VALUES (%s, %s) RETURNING id",
            (nome, f"cantina-{os.getpid()}-{self.n}-{datetime.now().timestamp()}"),
        )
        company = cur.fetchone()["id"]
        users = {}
        for key, name, role in (("ana", "Ana", "WAITER"), ("zeca", "Zeca", "COURIER")):
            cur.execute(
                "INSERT INTO users (company_id, name, email, password_hash, role) "
                "VALUES (%s, %s, %s, 'hash-de-teste', %s) RETURNING id",
                (company, name, f"{key}{self.n}-{datetime.now().timestamp()}@teste.com.br", role),
            )
            users[key] = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO products (company_id, name, price, portion) VALUES (%s, 'Pizza', 40, 'Grande') RETURNING id",
            (company,),
        )
        pizza = cur.fetchone()["id"]
        return {"company": company, "users": users, "pizza": pizza}

    def pedido(self, r, when, total=40, status="concluido", kind="mesa", qty=1, cost=12, **extra):
        cur = self.cur
        cols = {
            "company_id": r["company"], "customer_name": "Cliente", "customer": "Cliente", "total_price": total,
            "status": status, "created_at": when, "payment_method": "pix", "order_type": kind,
        }
        cols.update(extra)
        names = ", ".join(cols)
        marks = ", ".join(["%s"] * len(cols))
        cur.execute(f"INSERT INTO orders ({names}) VALUES ({marks}) RETURNING id", list(cols.values()))
        order = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, unit_cost) "
            "VALUES (%s, %s, %s, 40, %s, %s)",
            (order, r["pizza"], qty, total, cost),
        )
        return order

    def evento(self, order, tipo, when):
        self.cur.execute(
            "INSERT INTO order_events (order_id, event_type, created_at) VALUES (%s, %s, %s)",
            (order, tipo, when.replace(tzinfo=timezone.utc)),
        )

    def carregar(self, r, period="hoje"):
        return business_api.load(self.cur, r["company"], period, NOW)

    # ---- provas

    def test_empty_restaurant_answers_without_error(self):
        view = self.carregar(self.restaurante())
        self.assertEqual(view["summary"]["orders"], 0)
        self.assertIsNone(view["summary"]["avg_ticket"])

    def test_unknown_restaurant_is_none(self):
        self.assertIsNone(business_api.load(self.cur, "99999999-9999-4999-8999-999999999999", "hoje", NOW))

    def test_sales_ticket_and_cost_come_from_the_real_tables(self):
        r = self.restaurante()
        self.pedido(r, brt(14, 12), total=40, cost=12)
        self.pedido(r, brt(14, 13), total=80, qty=2, cost=12)
        view = self.carregar(r)
        self.assertEqual(view["summary"]["revenue"], 120.0)
        self.assertEqual(view["summary"]["orders"], 2)
        self.assertEqual(view["summary"]["avg_ticket"], 60.0)
        self.assertEqual(view["summary"]["dishes"], 3)
        top = view["dishes"]["by_quantity"][0]
        self.assertEqual((top["name"], top["quantity"]), ("Pizza · Grande", 3))
        self.assertEqual(view["dishes"]["by_profit"][0]["profit"], 120 - 36)
        self.assertEqual(view["dishes"]["cmv_real"], 30.0)

    def test_naive_timestamp_column_is_read_as_utc_and_hours_are_brasilia(self):
        r = self.restaurante()
        self.pedido(r, brt(14, 12, 30))
        view = self.carregar(r)
        self.assertEqual(view["hours"][12]["orders"], 1)
        self.assertEqual(view["hours"][15]["orders"], 0)

    def test_today_starts_at_brasilia_midnight(self):
        r = self.restaurante()
        self.pedido(r, brt(14, 0, 30))      # 00:30 de hoje: conta
        self.pedido(r, brt(13, 23, 30))     # 23:30 de ontem: não conta
        self.assertEqual(self.carregar(r)["summary"]["orders"], 1)

    def test_pending_payment_is_not_a_sale(self):
        r = self.restaurante()
        self.pedido(r, brt(14, 12), status=order_status.PENDING)
        self.pedido(r, brt(14, 12), status=order_status.PREPARING)
        self.assertEqual(self.carregar(r)["summary"]["orders"], 1)

    def test_another_restaurant_never_leaks_in(self):
        mine, other = self.restaurante("Meu"), self.restaurante("Outro")
        self.pedido(mine, brt(14, 12), total=40)
        for _ in range(3):
            self.pedido(other, brt(14, 12), total=500)
        view = self.carregar(mine)
        self.assertEqual(view["summary"]["revenue"], 40.0)
        self.assertEqual(view["dishes"]["by_quantity"][0]["quantity"], 1)

    def test_previous_period_is_yesterday_until_the_same_hour(self):
        r = self.restaurante()
        for hour in (10, 11, 12, 13, 14):
            self.pedido(r, brt(13, hour), total=40)          # ontem até 15h: 5 pedidos
        self.pedido(r, brt(13, 20), total=999)               # ontem à noite: fora da comparação
        for hour in (10, 11, 12, 13, 14):
            self.pedido(r, brt(14, hour), total=60)
        view = self.carregar(r)
        self.assertEqual(view["previous"]["revenue"], 200.0)
        self.assertEqual(view["compare"]["revenue_pct"], 50.0)

    def test_kitchen_time_from_events(self):
        r = self.restaurante()
        for _ in range(5):
            order = self.pedido(r, brt(14, 12))
            self.evento(order, "STATUS_EM_PREPARO", brt(14, 12, 1))
            self.evento(order, "STATUS_CONCLUIDO", brt(14, 12, 21))
        self.assertEqual(self.carregar(r)["times"]["kitchen"], {"median_min": 20.0, "samples": 5})

    def test_courier_and_waiter_numbers_with_names_in_order(self):
        r = self.restaurante()
        for _ in range(5):
            self.pedido(
                r, brt(14, 12), kind="entrega", courier_id=r["users"]["zeca"],
                picked_up_at=brt(14, 12, 5).replace(tzinfo=timezone.utc),
                delivered_at=brt(14, 12, 25).replace(tzinfo=timezone.utc),
            )
            self.cur.execute(
                "INSERT INTO tables (company_id, number) VALUES (%s, %s) RETURNING id",
                (r["company"], self.n * 100 + _),
            )
            table = self.cur.fetchone()["id"]
            self.cur.execute(
                "INSERT INTO table_calls (company_id, table_id, kind, status, created_at, answered_at, answered_by) "
                "VALUES (%s, %s, 'garcom', 'answered', %s, %s, %s)",
                (r["company"], table, brt(14, 12).replace(tzinfo=timezone.utc),
                 brt(14, 12, 2).replace(tzinfo=timezone.utc), r["users"]["ana"]),
            )
        people = self.carregar(r)["service"]
        self.assertEqual([p["name"] for p in people], ["Ana", "Zeca"])
        self.assertEqual((people[0]["calls_answered"], people[0]["call_median_min"]), (5, 2.0))
        self.assertEqual((people[1]["deliveries"], people[1]["delivery_median_min"]), (5, 20.0))

    def test_open_table_call_waiting_raises_an_alert(self):
        r = self.restaurante()
        self.cur.execute("INSERT INTO tables (company_id, number) VALUES (%s, 7) RETURNING id", (r["company"],))
        table = self.cur.fetchone()["id"]
        self.cur.execute(
            "INSERT INTO table_calls (company_id, table_id, kind, status, created_at) VALUES (%s, %s, 'conta', 'open', %s)",
            (r["company"], table, (NOW - timedelta(minutes=9))),
        )
        ids = [n["id"] for n in self.carregar(r)["attention"]]
        self.assertIn("chamados_abertos", ids)

    def test_recent_open_call_is_not_an_alert_yet(self):
        r = self.restaurante()
        self.cur.execute("INSERT INTO tables (company_id, number) VALUES (%s, 8) RETURNING id", (r["company"],))
        table = self.cur.fetchone()["id"]
        self.cur.execute(
            "INSERT INTO table_calls (company_id, table_id, kind, status, created_at) VALUES (%s, %s, 'agua', 'open', %s)",
            (r["company"], table, (NOW - timedelta(minutes=1))),
        )
        self.assertNotIn("chamados_abertos", [n["id"] for n in self.carregar(r)["attention"]])

    def test_week_and_month_windows(self):
        r = self.restaurante()
        self.pedido(r, brt(9, 12))     # há 5 dias
        self.pedido(r, brt(1, 12))     # há 13 dias
        self.assertEqual(self.carregar(r, "7d")["summary"]["orders"], 1)
        self.assertEqual(self.carregar(r, "30d")["summary"]["orders"], 2)

    def test_session_time_zone_does_not_change_the_answer(self):
        r = self.restaurante()
        self.pedido(r, brt(14, 12, 30))
        self.cur.execute("SET TIME ZONE 'America/Sao_Paulo'")
        first = self.carregar(r)
        self.cur.execute("SET TIME ZONE 'Asia/Tokyo'")
        second = self.carregar(r)
        self.assertEqual(first["summary"], second["summary"])
        self.assertEqual(first["hours"][12]["orders"], 1)
        self.assertEqual(second["hours"][12]["orders"], 1)

    def test_cmv_target_of_the_restaurant_is_used(self):
        r = self.restaurante()
        self.cur.execute("UPDATE companies SET cmv_target = 20 WHERE id = %s", (r["company"],))
        self.assertEqual(self.carregar(r)["cmv_target"], 20)


if __name__ == "__main__":
    unittest.main()
