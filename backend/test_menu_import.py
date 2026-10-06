import os
import unittest
from decimal import Decimal
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import menu_import  # noqa: E402
import menu_templates  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
ROUTE = f"/api/companies/{COMPANY_ID}/admin/menu/import"


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps(
        {"user_id": "user-1", "company_id": company_id, "role": role}
    )
    return {"Authorization": f"Bearer {token}"}


class FakeDatabase:
    """Just enough of the menus/products tables to watch what gets written."""

    def __init__(self, menus=(), products=(), company_exists=True):
        self.company_exists = company_exists
        self.menus = {f"menu-{i}": name for i, name in enumerate(menus)}  # id -> name
        self.products = list(products)  # (menu_id, name)
        self.inserted_products = []
        self.executed = []
        self.committed = False
        self.rolled_back = False
        self.closed = False
        self._next = None

    def cursor(self, **kwargs):
        return self

    def execute(self, sql, params=None):
        sql = " ".join(sql.split())
        self.executed.append(sql)
        if sql.startswith("SELECT id FROM companies"):
            self._next = [{"id": COMPANY_ID}] if self.company_exists else []
        elif sql.startswith("SELECT id, name FROM menus"):
            self._next = [{"id": i, "name": n} for i, n in self.menus.items()]
        elif sql.startswith("SELECT menu_id, name FROM products"):
            self._next = [{"menu_id": m, "name": n} for m, n in self.products]
        elif sql.startswith("INSERT INTO menus"):
            new_id = f"menu-{len(self.menus)}"
            self.menus[new_id] = params[1]
            self._next = [{"id": new_id}]
        elif sql.startswith("INSERT INTO products"):
            self.inserted_products.append(params)
            self.products.append((params[1], params[2]))
            self._next = []
        else:
            raise AssertionError(f"unexpected SQL: {sql}")

    def fetchone(self):
        return self._next[0] if self._next else None

    def fetchall(self):
        return list(self._next or [])

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


def lanches(*items):
    return {"name": "Lanches", "items": list(items)}


def item(name="X-Burguer", price="18,50", **extra):
    return {"name": name, "price": price, **extra}


class ParsePriceTests(unittest.TestCase):
    def test_common_ways_of_writing_a_price(self):
        cases = {
            18: "18.00",
            18.5: "18.50",
            "18": "18.00",
            "18,50": "18.50",
            "18.50": "18.50",
            "R$ 18,50": "18.50",
            " r$18,5 ": "18.50",
            "1.234,50": "1234.50",
            "0,99": "0.99",
            Decimal("7.005"): "7.01",
        }
        for value, expected in cases.items():
            self.assertEqual(str(menu_import.parse_price(value)), expected, value)

    def test_refuses_what_is_not_a_usable_price(self):
        for value in (None, True, False, "", "abc", "R$", 0, "0", "0,00", -5, "-1,50",
                      "100000", 99999.995, float("nan"), float("inf"), [], {}, "1,2,3"):
            self.assertIsNone(menu_import.parse_price(value), repr(value))


class TextTests(unittest.TestCase):
    def test_clean_text(self):
        self.assertEqual(menu_import.clean_text("  X-Burguer \n\t grande ", 50), "X-Burguer grande")
        self.assertEqual(menu_import.clean_text("a\x00b\x07c", 50), "a b c")
        self.assertEqual(menu_import.clean_text("abcdef", 3), "abc")
        for value in (None, 5, [], {}, "   "):
            self.assertEqual(menu_import.clean_text(value, 50), "")

    def test_normalize_key_ignores_accents_capitals_and_spaces(self):
        self.assertEqual(menu_import.normalize_key("  Pão  de   Queijo "), "pao de queijo")
        self.assertEqual(
            menu_import.normalize_key("AÇAÍ"), menu_import.normalize_key("acai")
        )


class ValidatePayloadTests(unittest.TestCase):
    def check(self, data):
        return menu_import.validate_payload(data)

    def test_good_payload_is_cleaned(self):
        categories, problem = self.check(
            {"categories": [lanches(item("  X-Burguer ", "18,5", description=" com   queijo "))]}
        )
        self.assertIsNone(problem)
        self.assertEqual(
            categories,
            [{"name": "Lanches", "items": [
                {"name": "X-Burguer", "price": Decimal("18.50"), "description": "com queijo"}
            ]}],
        )

    def test_rejects_malformed_payloads_with_a_clear_message(self):
        bad = [
            None, [], "x", {}, {"categories": []}, {"categories": "x"},
            {"categories": ["x"]},
            {"categories": [{"name": "", "items": [item()]}]},
            {"categories": [{"name": "Lanches"}]},
            {"categories": [{"name": "Lanches", "items": []}]},
            {"categories": [lanches("x")]},
            {"categories": [lanches({"price": "5"})]},
            {"categories": [lanches({"name": "  ", "price": "5"})]},
            {"categories": [lanches({"name": "Suco"})]},
            {"categories": [lanches({"name": "Suco", "price": 0})]},
            {"categories": [lanches({"name": "Suco", "price": "grátis"})]},
        ]
        for data in bad:
            categories, problem = self.check(data)
            self.assertIsNone(categories, data)
            self.assertTrue(problem, data)

    def test_the_message_names_the_dish_without_a_price(self):
        _, problem = self.check({"categories": [lanches(item("Suco", None))]})
        self.assertIn("Suco", problem)

    def test_repeated_category_and_dish_are_merged_not_duplicated(self):
        categories, problem = self.check(
            {"categories": [
                lanches(item("Pão de queijo", "5"), item("pao de QUEIJO", "9")),
                {"name": "LANCHES", "items": [item("Coxinha", "6"), item("Coxinha ", "7")]},
            ]}
        )
        self.assertIsNone(problem)
        self.assertEqual(len(categories), 1)
        self.assertEqual(
            [(i["name"], i["price"]) for i in categories[0]["items"]],
            [("Pão de queijo", Decimal("5.00")), ("Coxinha", Decimal("6.00"))],
        )

    def test_limits(self):
        many_categories = [
            {"name": f"Categoria {n}", "items": [item()]}
            for n in range(menu_import.MAX_CATEGORIES + 1)
        ]
        self.assertTrue(self.check({"categories": many_categories})[1])

        many_items = [item(f"Prato {n}") for n in range(menu_import.MAX_ITEMS + 1)]
        self.assertTrue(self.check({"categories": [lanches(*many_items)]})[1])

        exact = [item(f"Prato {n}") for n in range(menu_import.MAX_ITEMS)]
        self.assertIsNone(self.check({"categories": [lanches(*exact)]})[1])

    def test_long_names_are_cut_to_the_column_size(self):
        categories, _ = self.check(
            {"categories": [{"name": "C" * 500, "items": [item("P" * 500)]}]}
        )
        self.assertEqual(len(categories[0]["name"]), menu_import.MAX_CATEGORY_NAME)
        self.assertEqual(len(categories[0]["items"][0]["name"]), menu_import.MAX_ITEM_NAME)


class ImportMenuTests(unittest.TestCase):
    def run_import(self, db, *categories):
        validated, problem = menu_import.validate_payload({"categories": list(categories)})
        self.assertIsNone(problem)
        return menu_import.import_menu(db, COMPANY_ID, validated)

    def test_creates_categories_and_dishes(self):
        db = FakeDatabase()
        summary = self.run_import(
            db,
            lanches(item("X-Burguer", "18,50"), item("X-Salada", "20")),
            {"name": "Bebidas", "items": [item("Suco de laranja", "8")]},
        )
        self.assertEqual(
            summary,
            {"menus_created": 2, "menus_reused": 0, "products_created": 3, "products_skipped": 0},
        )
        self.assertEqual(sorted(db.menus.values()), ["Bebidas", "Lanches"])
        names = [params[2] for params in db.inserted_products]
        self.assertEqual(names, ["X-Burguer", "X-Salada", "Suco de laranja"])
        self.assertEqual(db.inserted_products[0][4], Decimal("18.50"))

    def test_company_row_is_locked_first(self):
        db = FakeDatabase()
        self.run_import(db, lanches(item()))
        self.assertIn("FOR UPDATE", db.executed[0])
        self.assertIn("FROM companies", db.executed[0])

    def test_unknown_company_writes_nothing(self):
        db = FakeDatabase(company_exists=False)
        validated, _ = menu_import.validate_payload({"categories": [lanches(item())]})
        self.assertIsNone(menu_import.import_menu(db, COMPANY_ID, validated))
        self.assertEqual(db.inserted_products, [])
        self.assertEqual(db.menus, {})

    def test_existing_category_is_reused_even_with_other_accents_or_capitals(self):
        db = FakeDatabase(menus=["lanches"])
        summary = self.run_import(db, {"name": "LANCHES", "items": [item("Coxinha", "6")]})
        self.assertEqual(summary["menus_created"], 0)
        self.assertEqual(summary["menus_reused"], 1)
        self.assertEqual(len(db.menus), 1)
        self.assertEqual(db.inserted_products[0][1], "menu-0")

    def test_existing_dish_is_skipped_never_duplicated_or_overwritten(self):
        db = FakeDatabase(menus=["Lanches"], products=[("menu-0", "X-Burguer")])
        summary = self.run_import(db, lanches(item("x-burguer", "99"), item("X-Salada", "20")))
        self.assertEqual(summary["products_created"], 1)
        self.assertEqual(summary["products_skipped"], 1)
        self.assertEqual([p[2] for p in db.inserted_products], ["X-Salada"])

    def test_same_dish_name_in_another_category_is_allowed(self):
        db = FakeDatabase(menus=["Lanches", "Porcoes"], products=[("menu-0", "Batata frita")])
        summary = self.run_import(db, {"name": "Porções", "items": [item("Batata frita", "25")]})
        self.assertEqual(summary["products_created"], 1)

    def test_sending_the_same_menu_twice_is_harmless(self):
        db = FakeDatabase()
        menu = lanches(item("X-Burguer", "18"), item("X-Salada", "20"))
        self.run_import(db, menu)
        again = self.run_import(db, menu)
        self.assertEqual(again["products_created"], 0)
        self.assertEqual(again["products_skipped"], 2)
        self.assertEqual(again["menus_created"], 0)
        self.assertEqual(len(db.inserted_products), 2)


class MenuImportEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def post(self, body, role="OWNER", company_id=COMPANY_ID, db=None, headers=True):
        db = db or FakeDatabase()
        with patch.object(backend_app, "get_db_connection", return_value=db):
            response = self.client.post(
                ROUTE, json=body, headers=auth(role, company_id) if headers else {}
            )
        return response, db

    def good(self):
        return {"categories": [lanches(item("X-Burguer", "18,50"))]}

    def test_requires_login(self):
        response, db = self.post(self.good(), headers=False)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(db.executed, [])

    def test_only_owner_or_manager(self):
        for role in ("WAITER", "CASHIER", "KITCHEN", "COURIER"):
            response, db = self.post(self.good(), role=role)
            self.assertEqual(response.status_code, 403, role)
            self.assertEqual(db.executed, [], role)
        for role in ("OWNER", "MANAGER"):
            self.assertEqual(self.post(self.good(), role=role)[0].status_code, 201, role)

    def test_another_company_is_forbidden(self):
        response, db = self.post(self.good(), company_id=OTHER_COMPANY_ID)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(db.executed, [])

    def test_bad_payload_is_a_400_and_nothing_is_written(self):
        for body in ({}, {"categories": []}, {"categories": [lanches({"name": "Suco"})]}):
            response, db = self.post(body)
            self.assertEqual(response.status_code, 400, body)
            self.assertTrue(response.get_json()["error"])
            self.assertEqual(db.executed, [])
            self.assertFalse(db.committed)

    def test_not_json_is_a_400(self):
        with patch.object(backend_app, "get_db_connection", return_value=FakeDatabase()):
            response = self.client.post(
                ROUTE, data="isso nao e json", headers=auth(), content_type="text/plain"
            )
        self.assertEqual(response.status_code, 400)

    def test_success_commits_once_and_reports_what_happened(self):
        response, db = self.post(self.good())
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertEqual(data["menus_created"], 1)
        self.assertEqual(data["products_created"], 1)
        self.assertTrue(db.committed)
        self.assertTrue(db.closed)

    def test_nothing_new_is_a_200(self):
        db = FakeDatabase(menus=["Lanches"], products=[("menu-0", "X-Burguer")])
        response, _ = self.post(self.good(), db=db)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["products_skipped"], 1)

    def test_unknown_company_is_a_404_without_commit(self):
        response, db = self.post(self.good(), db=FakeDatabase(company_exists=False))
        self.assertEqual(response.status_code, 404)
        self.assertFalse(db.committed)
        self.assertTrue(db.rolled_back)

    def test_database_failure_rolls_back_and_hides_the_details(self):
        db = FakeDatabase()

        def boom(sql, params=None):
            raise RuntimeError("segredo interno do banco")

        db.execute = boom
        response, _ = self.post(self.good(), db=db)
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("segredo interno", response.get_data(as_text=True))
        self.assertTrue(db.rolled_back)
        self.assertFalse(db.committed)


class TemplateEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def test_requires_owner_or_manager(self):
        for url in ("/api/admin/menu/templates", "/api/admin/menu/templates/lanchonete"):
            self.assertEqual(self.client.get(url).status_code, 401, url)
            self.assertEqual(self.client.get(url, headers=auth("WAITER")).status_code, 403, url)
            self.assertEqual(self.client.get(url, headers=auth("MANAGER")).status_code, 200, url)

    def test_list_has_every_business_type(self):
        data = self.client.get("/api/admin/menu/templates", headers=auth()).get_json()
        ids = {t["id"] for t in data}
        self.assertTrue({"lanchonete", "pizzaria", "restaurante", "bar", "acai",
                         "padaria", "churrasco", "japones"} <= ids)
        for template in data:
            self.assertTrue(template["name"] and template["icon"])
            self.assertTrue(all(c["count"] > 0 for c in template["categories"]))

    def test_one_template_and_unknown_one(self):
        ok = self.client.get("/api/admin/menu/templates/pizzaria", headers=auth())
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.get_json()["id"], "pizzaria")
        missing = self.client.get("/api/admin/menu/templates/nao-existe", headers=auth())
        self.assertEqual(missing.status_code, 404)


class TemplateContentTests(unittest.TestCase):
    def test_templates_carry_no_prices(self):
        for summary in menu_templates.list_templates():
            template = menu_templates.get_template(summary["id"])
            for category in template["categories"]:
                for entry in category["items"]:
                    self.assertEqual(set(entry), {"name"}, (summary["id"], entry))

    def test_summary_matches_the_full_template(self):
        for summary in menu_templates.list_templates():
            template = menu_templates.get_template(summary["id"])
            self.assertEqual(
                [(c["name"], c["count"]) for c in summary["categories"]],
                [(c["name"], len(c["items"])) for c in template["categories"]],
            )

    def test_no_empty_or_repeated_names_and_all_fit_the_database(self):
        for summary in menu_templates.list_templates():
            template = menu_templates.get_template(summary["id"])
            category_keys = set()
            for category in template["categories"]:
                key = menu_import.normalize_key(category["name"])
                self.assertNotIn(key, category_keys, (summary["id"], category["name"]))
                category_keys.add(key)
                self.assertLessEqual(len(category["name"]), menu_import.MAX_CATEGORY_NAME)
                item_keys = set()
                for entry in category["items"]:
                    name = entry["name"]
                    self.assertTrue(name.strip() and name == name.strip())
                    self.assertLessEqual(len(name), menu_import.MAX_ITEM_NAME)
                    item_key = menu_import.normalize_key(name)
                    self.assertNotIn(item_key, item_keys, (summary["id"], name))
                    item_keys.add(item_key)

    def test_a_whole_template_can_be_imported_in_one_go(self):
        for summary in menu_templates.list_templates():
            template = menu_templates.get_template(summary["id"])
            payload = {"categories": [
                {"name": c["name"], "items": [{"name": e["name"], "price": "10"} for e in c["items"]]}
                for c in template["categories"]
            ]}
            categories, problem = menu_import.validate_payload(payload)
            self.assertIsNone(problem, summary["id"])
            total = sum(len(c["items"]) for c in categories)
            self.assertLessEqual(total, menu_import.MAX_ITEMS)

    def test_unknown_id(self):
        self.assertIsNone(menu_templates.get_template("nao-existe"))
        self.assertIsNone(menu_templates.get_template(""))


if __name__ == "__main__":
    unittest.main()
