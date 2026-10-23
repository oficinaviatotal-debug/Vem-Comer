import os
import unittest
from decimal import Decimal

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import product_fields as pf  # noqa: E402

MENU = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def create(**body):
    body.setdefault("name", "X-tudo")
    body.setdefault("price", "25")
    return pf.read_fields(body, creating=True)


def change(**body):
    return pf.read_fields(body, creating=False)


class NameTests(unittest.TestCase):
    def test_a_name_is_required_to_create(self):
        for name in (None, "", "   ", "\n\t", 7, ["x-tudo"]):
            self.assertEqual(create(name=name), (None, pf.NAME_MISSING), repr(name))
        self.assertEqual(pf.read_fields({"price": 5}, creating=True), (None, pf.NAME_MISSING))

    def test_the_name_is_one_clean_line(self):
        fields, problem = create(name="  x-tudo \n  completo\x00 ")
        self.assertIsNone(problem)
        self.assertEqual(fields["name"], "x-tudo completo")

    def test_a_name_over_the_limit_is_refused_not_cut(self):
        self.assertEqual(create(name="a" * (pf.NAME_MAX + 1)), (None, pf.NAME_TOO_LONG))
        fields, problem = create(name="a" * pf.NAME_MAX)
        self.assertIsNone(problem)
        self.assertEqual(len(fields["name"]), pf.NAME_MAX)

    def test_spaces_do_not_count_against_the_limit(self):
        fields, problem = create(name=("a" * pf.NAME_MAX) + "      ")
        self.assertIsNone(problem)
        self.assertEqual(len(fields["name"]), pf.NAME_MAX)

    def test_changing_a_name_to_nothing_is_refused(self):
        self.assertEqual(change(name="  "), (None, pf.NAME_MISSING))
        self.assertEqual(change(name=None), (None, pf.NAME_MISSING))


class TextTests(unittest.TestCase):
    def test_the_text_is_optional_and_empty_by_default(self):
        self.assertEqual(create()[0]["description"], "")
        self.assertEqual(create(description=None)[0]["description"], "")
        self.assertEqual(create(description="")[0]["description"], "")

    def test_the_text_is_one_clean_line(self):
        fields, _ = create(description=" gelada,\n  sem gelo ")
        self.assertEqual(fields["description"], "gelada, sem gelo")

    def test_only_letters_are_a_text(self):
        for text in (5, True, ["gelada"], {"a": 1}):
            self.assertEqual(create(description=text), (None, pf.TEXT_NOT_TEXT), repr(text))

    def test_the_limit(self):
        self.assertEqual(create(description="a" * (pf.TEXT_MAX + 1)), (None, pf.TEXT_TOO_LONG))
        self.assertIsNone(create(description="a" * pf.TEXT_MAX)[1])

    def test_changing_the_text_to_empty_clears_it(self):
        self.assertEqual(change(description=""), ({"description": ""}, None))
        self.assertEqual(change(description=None), ({"description": ""}, None))


class PriceTests(unittest.TestCase):
    def test_the_usual_ways_of_writing_a_price_are_the_same_price(self):
        for value in ("6,5", "R$ 6,50", " r$6,50 ", 6.5, "6.5", Decimal("6.5")):
            self.assertEqual(create(price=value)[0]["price"], Decimal("6.50"), repr(value))

    def test_thousands(self):
        self.assertEqual(create(price="1.234,50")[0]["price"], Decimal("1234.50"))

    def test_a_price_is_rounded_to_cents(self):
        self.assertEqual(create(price="6,555")[0]["price"], Decimal("6.56"))

    def test_the_price_is_required_to_create(self):
        self.assertEqual(pf.read_fields({"name": "x"}, creating=True), (None, pf.PRICE_BAD))

    def test_zero_negative_text_and_absurd_prices_are_refused(self):
        for value in (0, "0", "0,00", -1, "-5", "abc", "", None, True, False, 1e30, "100000", float("nan"), float("inf"), [5], {"a": 1}):
            self.assertEqual(create(price=value), (None, pf.PRICE_BAD), repr(value))

    def test_the_biggest_price_is_accepted(self):
        self.assertEqual(create(price="99999,99")[0]["price"], Decimal("99999.99"))

    def test_changing_the_price_to_something_bad_is_refused(self):
        self.assertEqual(change(price=0), (None, pf.PRICE_BAD))


class MenuTests(unittest.TestCase):
    def test_no_category_is_fine(self):
        self.assertIsNone(create()[0]["menu_id"])
        self.assertIsNone(create(menu_id=None)[0]["menu_id"])
        self.assertIsNone(create(menu_id="")[0]["menu_id"])

    def test_a_category_is_its_identifier_in_a_standard_shape(self):
        self.assertEqual(create(menu_id=MENU.upper())[0]["menu_id"], MENU)
        self.assertEqual(create(menu_id=f" {MENU} ")[0]["menu_id"], MENU)

    def test_anything_else_is_refused_before_the_database_can_choke_on_it(self):
        for value in ("lanches", "1", 7, True, ["x"], {"id": MENU}, "'; DROP TABLE products;--"):
            self.assertEqual(create(menu_id=value), (None, pf.MENU_BAD), repr(value))

    def test_changing_to_empty_takes_the_dish_out_of_its_category(self):
        self.assertEqual(change(menu_id=None), ({"menu_id": None}, None))
        self.assertEqual(change(menu_id=""), ({"menu_id": None}, None))


class ShapeTests(unittest.TestCase):
    def test_the_body_has_to_be_an_object(self):
        for body in (None, [], "x-tudo", 5, True):
            self.assertEqual(pf.read_fields(body, creating=True), (None, pf.NOT_JSON), repr(body))
            self.assertEqual(pf.read_fields(body, creating=False), (None, pf.NOT_JSON), repr(body))

    def test_changing_carries_only_what_came(self):
        self.assertEqual(change(price="7"), ({"price": Decimal("7.00")}, None))
        self.assertEqual(change(name=" Novo "), ({"name": "Novo"}, None))
        self.assertEqual(change(), ({}, None))

    def test_unknown_fields_are_ignored(self):
        fields, problem = change(price=7, company_id="outro", id="outro", sold_out=True, image_key="x")
        self.assertIsNone(problem)
        self.assertEqual(set(fields), {"price"})

    def test_a_dish_cannot_pick_its_restaurant(self):
        fields, _ = create(company_id="outro")
        self.assertNotIn("company_id", fields)

    def test_the_limits_are_the_menu_importers(self):
        import menu_import
        self.assertEqual(pf.NAME_MAX, menu_import.MAX_ITEM_NAME)
        self.assertEqual(pf.TEXT_MAX, menu_import.MAX_DESCRIPTION)


class TwiceTests(unittest.TestCase):
    def test_same_name_without_looking_at_accent_or_capital_or_spaces(self):
        others = ["Suco de laranja", "X-Tudo"]
        for name in ("suco de laranja", "SUCÓ  DE  LARANJA", "x-tudo", " X-TUDO "):
            self.assertTrue(pf.is_twice(name, others), name)

    def test_a_different_name_is_not_twice(self):
        self.assertFalse(pf.is_twice("Suco de uva", ["Suco de laranja"]))
        self.assertFalse(pf.is_twice("X-tudo", []))

    def test_a_missing_name_in_the_list_does_not_break_it(self):
        self.assertFalse(pf.is_twice("X-tudo", [None, ""]))


if __name__ == "__main__":
    unittest.main()
