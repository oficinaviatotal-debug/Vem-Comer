import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import costs_view as backend_app  # as funcoes puras da tela de Custos (o app.py as reexporta)

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
PRODUCT_ID = "aaaaaaaa-0000-4000-8000-000000000001"
JUICE_ID = "aaaaaaaa-0000-4000-8000-000000000002"
CHICKEN_ID = "bbbbbbbb-0000-4000-8000-000000000001"
NOW = datetime.now(timezone.utc)


class ScriptedCursor:
    """Responde cada SQL pelo primeiro trecho do roteiro que aparece nele (e gasta esse trecho)."""

    def __init__(self, script):
        self.script = list(script)
        self.executed = []
        self._last = None

    def execute(self, sql, params=None):
        flat = " ".join(sql.split())
        self.executed.append((flat, params))
        for index, (needle, result) in enumerate(self.script):
            if needle in flat:
                self.script.pop(index)
                if isinstance(result, Exception):
                    raise result
                self._last = result
                return
        self._last = None

    def fetchone(self):
        if isinstance(self._last, list):
            return self._last[0] if self._last else None
        return self._last

    def fetchall(self):
        if self._last is None:
            return []
        return self._last if isinstance(self._last, list) else [self._last]

    def close(self):
        pass


class YieldAndStockViewTests(unittest.TestCase):
    def test_recipe_for_six_portions_trimming_loss_and_stock(self):
        ingredients = [
            {"id": CHICKEN_ID, "name": "Peito de frango", "unit": "g", "package_qty": Decimal("1000.000"),
             "package_price": Decimal("18.90"), "yield_pct": 85,
             "stock_qty": Decimal("5000.000"), "stock_at": NOW - timedelta(days=3)},
        ]
        products = [
            {"id": PRODUCT_ID, "name": "Frango a milanesa", "price": Decimal("30.00"), "menu_id": None,
             "portion": "1 pessoa", "portion_grams": Decimal("250.0"), "yield_portions": 6,
             "extra_cost": Decimal("0.00")},
        ]
        lines = [{"product_id": PRODUCT_ID, "ingredient_id": CHICKEN_ID, "quantity": Decimal("1200.000")}]
        sold = [
            {"product_id": PRODUCT_ID, "quantity": 10, "unit_price": Decimal("30.00"), "unit_cost": Decimal("4.45"),
             "created_at": NOW - timedelta(days=1)},
            # antes da contagem: entra no mes, mas nao tira do estoque contado
            {"product_id": PRODUCT_ID, "quantity": 5, "unit_price": Decimal("30.00"), "unit_cost": Decimal("4.45"),
             "created_at": NOW - timedelta(days=10)},
        ]
        view = backend_app.build_cost_view(35, ingredients, products, lines, sold, NOW)
        dish = view["products"][0]
        # 1200 g limpos de um peito com 85% = 26,68 a receita; / 6 = 4,45 a porcao
        self.assertEqual(dish["cost"], 4.45)
        self.assertEqual(dish["yield_portions"], 6)
        self.assertEqual(dish["portion_grams"], 250.0)
        self.assertEqual(dish["sold_30d"], 15)
        chicken = view["ingredients"][0]
        self.assertEqual(chicken["portions_per_package"][0]["portions"], 4.2)
        # 10 porcoes depois da contagem = 2000 g limpos = 2352,941 g comprados
        self.assertEqual(chicken["stock_now"], 2647.059)
        # no mes: 15 porcoes = 3529,41 g; 117,6 g por dia -> 22 dias
        self.assertEqual(chicken["used_30d"], 3529.412)
        self.assertEqual(chicken["days_left"], 22)
        self.assertTrue(chicken["stock_controlled"])

    def test_reads_sales_since_the_oldest_stock_count(self):
        old = NOW - timedelta(days=45)
        since = backend_app.cost_since([{"stock_qty": Decimal("1"), "stock_at": old}, {"stock_qty": None}], NOW)
        self.assertEqual(since, old)
        very_old = NOW - timedelta(days=400)
        since = backend_app.cost_since([{"stock_qty": Decimal("1"), "stock_at": very_old}], NOW)
        self.assertEqual(since, NOW - timedelta(days=180))


class OrderUnitCostTests(unittest.TestCase):
    def test_costs_per_product(self):
        cursor = ScriptedCursor([
            ("FROM products p", [
                {"product_id": PRODUCT_ID, "extra_cost": Decimal("1.50"), "quantity": Decimal("250"),
                 "package_qty": Decimal("1000"), "package_price": Decimal("18.90")},
                {"product_id": PRODUCT_ID, "extra_cost": Decimal("1.50"), "quantity": Decimal("200"),
                 "package_qty": Decimal("2000"), "package_price": Decimal("12.00")},
                {"product_id": JUICE_ID, "extra_cost": Decimal("0"), "quantity": None,
                 "package_qty": None, "package_price": None},
            ]),
        ])
        costs = backend_app.order_unit_costs(cursor, COMPANY_ID, [PRODUCT_ID, JUICE_ID, PRODUCT_ID])
        self.assertEqual(costs[PRODUCT_ID], Decimal("7.43"))
        self.assertIsNone(costs[JUICE_ID])
        self.assertEqual(cursor.executed[0][0], "SAVEPOINT unit_costs;")
        self.assertEqual(cursor.executed[1][1], (COMPANY_ID, sorted([PRODUCT_ID, JUICE_ID])))

    def test_absurd_cost_is_left_empty_instead_of_breaking_the_order(self):
        # "1 g por R$ 18.900" e 10 kg na ficha: custo de R$ 189 milhoes nao cabe em order_items.unit_cost
        cursor = ScriptedCursor([
            ("FROM products p", [
                {"product_id": PRODUCT_ID, "extra_cost": Decimal("0"), "quantity": Decimal("10000"),
                 "package_qty": Decimal("1"), "package_price": Decimal("18900.00")},
            ]),
        ])
        self.assertEqual(backend_app.order_unit_costs(cursor, COMPANY_ID, [PRODUCT_ID]), {PRODUCT_ID: None})

    def test_failure_never_blocks_the_order(self):
        cursor = ScriptedCursor([("FROM products p", RuntimeError("coluna nao existe"))])
        self.assertEqual(backend_app.order_unit_costs(cursor, COMPANY_ID, [PRODUCT_ID]), {})
        self.assertIn("ROLLBACK TO SAVEPOINT unit_costs;", [sql for sql, _ in cursor.executed])


if __name__ == "__main__":
    unittest.main()
