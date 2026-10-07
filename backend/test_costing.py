import unittest
from decimal import Decimal

import costing
from costing import CostError


class ParseNumberTests(unittest.TestCase):
    def test_accepts_brazilian_and_plain_formats(self):
        self.assertEqual(costing.parse_number("18,90", "Preço"), Decimal("18.90"))
        self.assertEqual(costing.parse_number("R$ 1.234,56", "Preço"), Decimal("1234.56"))
        self.assertEqual(costing.parse_number("0,250", "Qtd"), Decimal("0.250"))
        self.assertEqual(costing.parse_number(18.9, "Preço"), Decimal("18.9"))
        self.assertEqual(costing.parse_number(2, "Qtd"), Decimal("2"))
        # sem virgula, "1.000" e mil no Brasil; "0.250" continua decimal
        self.assertEqual(costing.parse_number("1.000", "Qtd"), Decimal("1000"))
        self.assertEqual(costing.parse_number("2.500", "Qtd"), Decimal("2500"))
        self.assertEqual(costing.parse_number("0.250", "Qtd"), Decimal("0.250"))
        self.assertEqual(costing.parse_number("1.5", "Qtd"), Decimal("1.5"))

    def test_rejects_text_negative_bool_and_infinite(self):
        for bad in ("abc", "-1", True, None, "inf", "NaN", [], {}):
            with self.assertRaises(CostError, msg=repr(bad)):
                costing.parse_number(bad, "Preço")

    def test_zero_only_when_allowed(self):
        self.assertEqual(costing.parse_number("0", "Preço"), Decimal("0"))
        with self.assertRaises(CostError):
            costing.parse_number("0", "Quantidade", allow_zero=False)

    def test_maximum(self):
        with self.assertRaises(CostError):
            costing.parse_number("100001", "Preço", maximum=Decimal("100000"))


class UnitTests(unittest.TestCase):
    def test_converts_to_stored_unit(self):
        self.assertEqual(costing.to_base("1", "kg"), (Decimal("1000.000"), "g"))
        self.assertEqual(costing.to_base("0,25", "kg"), (Decimal("250.000"), "g"))
        self.assertEqual(costing.to_base("2", "L"), (Decimal("2000.000"), "ml"))
        self.assertEqual(costing.to_base("350", "ml"), (Decimal("350.000"), "ml"))
        self.assertEqual(costing.to_base("1", "dz"), (Decimal("12.000"), "un"))
        self.assertEqual(costing.to_base("3", "unidade"), (Decimal("3.000"), "un"))

    def test_spoken_unit_names(self):
        self.assertEqual(costing.normalize_unit("Quilos"), "kg")
        self.assertEqual(costing.normalize_unit("litro"), "l")
        self.assertEqual(costing.normalize_unit("dúzia"), "dz")

    def test_unknown_unit(self):
        with self.assertRaises(CostError):
            costing.to_base("1", "xícara")

    def test_too_small_after_rounding(self):
        with self.assertRaises(CostError):
            costing.to_base("0.0001", "g")

    def test_too_big(self):
        with self.assertRaises(CostError):
            costing.to_base("2000", "kg")


class CostTests(unittest.TestCase):
    def test_product_cost_from_recipe(self):
        # frango: 250 g de um pacote de 1 kg por R$ 18,90 = 4,725
        # batata: 200 g de um saco de 2 kg por R$ 12,00 = 1,20
        # embalagem e gas: R$ 1,50
        lines = [
            (Decimal("250"), Decimal("1000"), Decimal("18.90")),
            (Decimal("200"), Decimal("2000"), Decimal("12.00")),
        ]
        self.assertEqual(costing.product_cost(lines, Decimal("1.50")), Decimal("7.43"))

    def test_no_recipe_means_unknown_not_zero(self):
        self.assertIsNone(costing.product_cost([], 0))
        self.assertEqual(costing.product_cost([], Decimal("2")), Decimal("2.00"))

    def test_cmv_status_and_suggested_price(self):
        cost = Decimal("7.43")
        self.assertEqual(costing.cmv_percent(cost, Decimal("25")), Decimal("29.7"))
        self.assertEqual(costing.status(cost, Decimal("25"), 35), "ok")
        self.assertEqual(costing.status(cost, Decimal("17"), 35), "atencao")  # 43,7%
        self.assertEqual(costing.status(cost, Decimal("15"), 35), "alto")     # 49,5%
        self.assertEqual(costing.status(None, Decimal("15"), 35), "sem_custo")
        self.assertEqual(costing.status(cost, Decimal("0"), 35), "sem_preco")
        # 7,43 / 0,35 = 21,228... -> 21,23 (para cima, para nao passar da meta)
        self.assertEqual(costing.suggested_price(cost, 35), Decimal("21.23"))
        self.assertLessEqual(costing.cmv_percent(cost, Decimal("21.23")), Decimal("35"))
        self.assertEqual(costing.margin(cost, Decimal("25")), Decimal("17.57"))

    def test_sebrae_example(self):
        # Exemplo do Sebrae: prato de R$ 4 com meta de 30% -> cerca de R$ 13,30
        self.assertEqual(costing.suggested_price(Decimal("4"), 30), Decimal("13.34"))

    def test_storable_cost(self):
        self.assertEqual(costing.storable_cost(Decimal("7.43")), Decimal("7.43"))
        self.assertIsNone(costing.storable_cost(None))
        self.assertIsNone(costing.storable_cost(Decimal("189000000.00")))

    def test_target(self):
        self.assertEqual(costing.normalize_target("35"), 35)
        for bad in ("4", "91", "35,5", "abc"):
            with self.assertRaises(CostError, msg=bad):
                costing.normalize_target(bad)


class PeriodTests(unittest.TestCase):
    def test_only_items_with_cost_enter_the_cmv(self):
        summary = costing.period_summary([
            (2, Decimal("25.00"), Decimal("7.43")),   # vendeu 50, custou 14,86
            (1, Decimal("8.00"), None),              # suco sem ficha
        ])
        self.assertEqual(summary["revenue"], Decimal("58.00"))
        self.assertEqual(summary["covered_revenue"], Decimal("50.00"))
        self.assertEqual(summary["cost"], Decimal("14.86"))
        self.assertEqual(summary["cmv"], Decimal("29.7"))
        self.assertEqual(summary["coverage"], Decimal("86"))

    def test_empty(self):
        summary = costing.period_summary([])
        self.assertIsNone(summary["cmv"])
        self.assertIsNone(summary["coverage"])


class RecipeLinesTests(unittest.TestCase):
    INGREDIENTS = {"a": "g", "b": "ml", "c": "un"}

    def test_valid_recipe(self):
        lines = costing.recipe_lines(
            [
                {"ingredient_id": "a", "quantity": "0,25", "unit": "kg"},
                {"ingredient_id": "b", "quantity": 50, "unit": "ml"},
                {"ingredient_id": "c", "quantity": 1, "unit": "un"},
            ],
            self.INGREDIENTS,
        )
        self.assertEqual(lines, [("a", Decimal("250.000")), ("b", Decimal("50.000")), ("c", Decimal("1.000"))])

    def test_rejects_unknown_duplicate_and_wrong_unit(self):
        cases = [
            [{"ingredient_id": "x", "quantity": 1, "unit": "g"}],
            [{"ingredient_id": "a", "quantity": 1, "unit": "g"}, {"ingredient_id": "a", "quantity": 2, "unit": "g"}],
            [{"ingredient_id": "a", "quantity": 1, "unit": "ml"}],
            [{"ingredient_id": "a", "quantity": 0, "unit": "g"}],
            "not a list",
            ["not a dict"],
        ]
        for items in cases:
            with self.assertRaises(CostError, msg=repr(items)):
                costing.recipe_lines(items, self.INGREDIENTS)

    def test_limit_of_lines(self):
        many = {str(i): "g" for i in range(41)}
        items = [{"ingredient_id": str(i), "quantity": 1, "unit": "g"} for i in range(41)]
        with self.assertRaises(CostError):
            costing.recipe_lines(items, many)


class NameTests(unittest.TestCase):
    def test_clean_name_and_portion(self):
        self.assertEqual(costing.clean_name("  Peito   de frango "), "Peito de frango")
        with self.assertRaises(CostError):
            costing.clean_name("   ")
        with self.assertRaises(CostError):
            costing.clean_name("x" * 81)
        self.assertIsNone(costing.clean_portion("  "))
        self.assertEqual(costing.clean_portion("1 pessoa"), "1 pessoa")


class YieldTests(unittest.TestCase):
    def test_recipe_for_many_portions(self):
        # frango a milanesa: 1,2 kg de peito limpo (aproveitamento 85%), 300 g de farinha, 4 ovos, rende 6
        lines = [
            (Decimal("1200"), Decimal("1000"), Decimal("18.90"), 85),   # 1200 x 18,90 / 850 = 26,682...
            (Decimal("300"), Decimal("500"), Decimal("6.00"), 100),     # 3,60
            (Decimal("4"), Decimal("12"), Decimal("12.00"), 100),       # 4,00
        ]
        # receita 34,2824 / 6 = 5,7137 + embalagem 1,00 = 6,71
        self.assertEqual(costing.product_cost(lines, Decimal("1.00"), 6), Decimal("6.71"))
        # a mesma ficha, de uma porcao so, como no comeco
        self.assertEqual(costing.product_cost(lines[:1], 0), Decimal("26.68"))

    def test_trimming_loss_raises_the_cost(self):
        self.assertEqual(costing.line_cost(Decimal("850"), Decimal("1000"), Decimal("18.90"), 85), Decimal("18.9"))
        self.assertEqual(costing.line_cost(Decimal("850"), Decimal("1000"), Decimal("18.90")), Decimal("16.065"))

    def test_portions_per_package(self):
        # 1 kg de peito, 85% limpo = 850 g; 1200 g rendem 6 pratos = 200 g por prato -> 4,2 pratos
        self.assertEqual(costing.portions_per_package(Decimal("1000"), 85, Decimal("1200"), 6), Decimal("4.2"))
        self.assertEqual(costing.portions_per_package(Decimal("1000"), 100, Decimal("250")), Decimal("4.0"))

    def test_normalizers(self):
        self.assertEqual(costing.normalize_yield_portions(""), 1)
        self.assertEqual(costing.normalize_yield_portions("6"), 6)
        self.assertEqual(costing.normalize_yield_pct("85%"), 85)
        self.assertEqual(costing.normalize_yield_pct(None), 100)
        self.assertIsNone(costing.normalize_portion_grams(""))
        self.assertEqual(costing.normalize_portion_grams("300"), Decimal("300.0"))
        for bad in ("0", "2,5", "501"):
            with self.assertRaises(CostError, msg=bad):
                costing.normalize_yield_portions(bad)
        for bad in ("0", "101", "85,5"):
            with self.assertRaises(CostError, msg=bad):
                costing.normalize_yield_pct(bad)


class StockTests(unittest.TestCase):
    def test_gross_use_and_stock(self):
        # 10 pratos de uma receita de 1200 g que rende 6, peito com 85% de aproveitamento:
        # 10 x 200 g = 2000 g limpo = 2352,94 g comprado
        use = costing.gross_use(10, Decimal("1200"), 6, 85)
        self.assertEqual(use.quantize(Decimal("0.01")), Decimal("2352.94"))
        self.assertEqual(costing.stock_now(Decimal("5000"), use), Decimal("2647.059"))
        self.assertIsNone(costing.stock_now(None, use))

    def test_days_left(self):
        self.assertEqual(costing.days_left(Decimal("3000"), Decimal("9000"), 30), 10)  # 300 por dia
        self.assertEqual(costing.days_left(Decimal("-5"), Decimal("9000"), 30), 0)
        self.assertIsNone(costing.days_left(Decimal("3000"), Decimal("0"), 30))
        self.assertIsNone(costing.days_left(None, Decimal("10"), 30))


class MenuEngineeringTests(unittest.TestCase):
    def test_four_quadrants(self):
        items = [
            ("frango", 100, Decimal("17.00")),   # muito vendido, margem alta -> estrela
            ("pf", 120, Decimal("8.00")),        # muito vendido, margem baixa -> cavalo
            ("peixe", 10, Decimal("30.00")),     # pouco vendido, margem alta -> quebra-cabeca
            ("sopa", 5, Decimal("4.00")),        # pouco vendido, margem baixa -> cao
            ("suco", 50, None),                  # sem ficha: fora da conta
        ]
        quadrants, margin_cut, share_cut = costing.menu_engineering(items)
        self.assertEqual(quadrants, {"frango": "estrela", "pf": "cavalo", "peixe": "quebra_cabeca", "sopa": "cao"})
        # media ponderada: (1700 + 960 + 300 + 20) / 235 = 12,68
        self.assertEqual(margin_cut, Decimal("12.68"))
        self.assertEqual(share_cut, Decimal("17.5"))  # 70% de 1/4

    def test_without_sales(self):
        self.assertEqual(costing.menu_engineering([("a", 0, Decimal("5"))]), ({}, None, None))
        self.assertEqual(costing.menu_engineering([]), ({}, None, None))


if __name__ == "__main__":
    unittest.main()
