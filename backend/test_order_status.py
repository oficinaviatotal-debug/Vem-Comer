"""Andamento do pedido: o módulo (order_status.py) e a rota PUT /api/orders/<id>/status."""
import os
import re
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import order_status  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
ORDER_ID = "55555555-5555-4555-8555-555555555555"
ROUTE = f"/api/orders/{ORDER_ID}/status"


def auth(role="KITCHEN"):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": COMPANY_ID, "role": role})
    return {"Authorization": f"Bearer {token}"}


class ModuleTests(unittest.TestCase):
    def test_every_status_the_server_accepts_is_listed_once(self):
        self.assertEqual(
            order_status.ALLOWED,
            ("PENDING_PAYMENT", "em preparo", "pronto", "saiu para entrega", "concluido"),
        )
        self.assertEqual(len(set(order_status.ALLOWED)), len(order_status.ALLOWED))

    def test_only_a_delivery_has_ready_and_out_for_delivery(self):
        for status in order_status.DELIVERY_ONLY:
            self.assertIsNone(order_status.problem_for("entrega", status))
            for other in ("mesa", "balcao", "retirada", None, ""):
                self.assertEqual(order_status.problem_for(other, status), order_status.NOT_A_DELIVERY, (other, status))

    def test_the_old_statuses_are_fine_for_every_type(self):
        for status in (order_status.PENDING, order_status.PREPARING, order_status.DONE):
            for kind in ("mesa", "balcao", "retirada", "entrega", None):
                self.assertIsNone(order_status.problem_for(kind, status))

    def test_everything_after_the_kitchen_accepts_counts_as_sold(self):
        self.assertNotIn(order_status.PENDING, order_status.SOLD_STATUSES)
        for status in order_status.ALLOWED:
            if status != order_status.PENDING:
                self.assertIn(status, order_status.SOLD_STATUSES, status)
        self.assertEqual(
            order_status.SOLD_STATUSES_SQL, "'em preparo', 'pronto', 'saiu para entrega', 'concluido'"
        )

    def test_the_cost_and_stock_queries_use_the_shared_list(self):
        # Se alguém voltar a escrever a lista à mão, a venda de um estado novo some do custo e do estoque.
        source = Path(backend_app.__file__).read_text(encoding="utf-8")
        self.assertNotIn("IN ('em preparo', 'concluido')", source)
        self.assertEqual(source.count("{order_status.SOLD_STATUSES_SQL}"), 2)

    def test_event_names_fit_the_column(self):
        self.assertEqual(order_status.event_type("saiu para entrega"), "STATUS_SAIU_PARA_ENTREGA")
        self.assertEqual(order_status.event_type("em preparo"), "STATUS_EM_PREPARO")
        self.assertEqual(order_status.event_type("concluido"), "STATUS_CONCLUIDO")
        for status in order_status.ALLOWED:
            self.assertLessEqual(len(order_status.event_type(status)), 50)

    def test_the_schema_column_is_wide_enough_for_every_status(self):
        schema = (Path(__file__).resolve().parent.parent / "database" / "schema.production.sql").read_text(encoding="utf-8")
        table = schema[schema.index("CREATE TABLE public.orders ("):]
        table = table[: table.index(");")]
        width = int(re.search(r"status character varying\((\d+)\)", table).group(1))
        for status in order_status.ALLOWED:
            self.assertLessEqual(len(status), width)


class FakeConnection:
    """Uma conexão de mentira: guarda o que foi executado e devolve o tipo do pedido pedido."""

    def __init__(self, order_type="entrega", exists=True, updated=1):
        self.order_type = order_type
        self.exists = exists
        self.updated = updated
        self.executed = []
        self.closed = 0
        self.commit = MagicMock()
        self.rollback = MagicMock()
        self.cursor_obj = MagicMock()
        self.cursor_obj.execute.side_effect = lambda sql, params=None: self.executed.append((" ".join(sql.split()), params))
        self.cursor_obj.fetchone.side_effect = lambda: (self.order_type,) if self.exists else None
        type(self.cursor_obj).rowcount = property(lambda _self: self.updated if self._last_is_update() else 1)

    def _last_is_update(self):
        return bool(self.executed) and self.executed[-1][0].startswith("UPDATE orders")

    def cursor(self, *args, **kwargs):
        return self.cursor_obj

    def close(self):
        self.closed += 1

    def sql(self, start):
        return [item for item in self.executed if item[0].startswith(start)]


class StatusRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def put(self, status, conn):
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            return self.client.put(ROUTE, json={"status": status}, headers=auth())

    def test_requires_login(self):
        self.assertEqual(self.client.put(ROUTE, json={"status": "pronto"}).status_code, 401)

    def test_an_unknown_status_is_refused_before_touching_the_database(self):
        conn = FakeConnection()
        for bad in ("pago", "Pronto", "saiu", "", None):
            reply = self.put(bad, conn)
            self.assertEqual(reply.status_code, 400, bad)
        self.assertEqual(conn.executed, [])

    def test_a_delivery_can_be_ready_then_out_then_done(self):
        for status in ("pronto", "saiu para entrega", "concluido"):
            conn = FakeConnection(order_type="entrega")
            reply = self.put(status, conn)
            self.assertEqual(reply.status_code, 200, (status, reply.get_json()))
            update = conn.sql("UPDATE orders")
            self.assertEqual(len(update), 1)
            self.assertEqual(update[0][1][0], status)
            self.assertEqual(update[0][1][1:], (ORDER_ID, COMPANY_ID))  # sempre preso à empresa do login
            event = conn.sql("INSERT INTO order_events")[0]
            self.assertEqual(event[1][1], order_status.event_type(status))
            conn.commit.assert_called_once()

    def test_ready_and_out_for_delivery_are_refused_for_other_types(self):
        for kind in ("mesa", "balcao", "retirada"):
            for status in ("pronto", "saiu para entrega"):
                conn = FakeConnection(order_type=kind)
                reply = self.put(status, conn)
                self.assertEqual(reply.status_code, 400, (kind, status))
                self.assertEqual(reply.get_json()["error"], order_status.NOT_A_DELIVERY)
                self.assertEqual(conn.sql("UPDATE orders"), [], "nada foi gravado")
                conn.commit.assert_not_called()

    def test_the_old_flow_for_a_table_or_a_pickup_does_not_look_the_order_up(self):
        for status in ("em preparo", "concluido"):
            conn = FakeConnection(order_type="mesa")
            reply = self.put(status, conn)
            self.assertEqual(reply.status_code, 200)
            self.assertEqual(conn.sql("SELECT order_type"), [])

    def test_finishing_still_frees_the_table(self):
        conn = FakeConnection(order_type="mesa")
        self.put("concluido", conn)
        self.assertEqual(len(conn.sql("UPDATE tables")), 1)
        conn = FakeConnection(order_type="entrega")
        self.put("pronto", conn)
        self.assertEqual(conn.sql("UPDATE tables"), [], "so concluir libera a mesa")

    def test_an_order_of_another_restaurant_is_a_404(self):
        conn = FakeConnection(exists=False)
        reply = self.put("pronto", conn)
        self.assertEqual(reply.status_code, 404)
        self.assertEqual(conn.sql("UPDATE orders"), [])
        lookup = conn.sql("SELECT order_type")[0]
        self.assertEqual(lookup[1], (ORDER_ID, COMPANY_ID))


if __name__ == "__main__":
    unittest.main()
