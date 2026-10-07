"""Regras das opções por item (tamanho, adicionais, observação). Sem banco e sem Flask."""

import unittest
from decimal import Decimal

import item_options as io
from item_options import OptionError

SIZE_SMALL = "aaaaaaaa-0000-4000-8000-000000000001"
SIZE_BIG = "aaaaaaaa-0000-4000-8000-000000000002"
EXTRA_NINHO = "bbbbbbbb-0000-4000-8000-000000000001"
EXTRA_BANANA = "bbbbbbbb-0000-4000-8000-000000000002"
EXTRA_GRANOLA = "bbbbbbbb-0000-4000-8000-000000000003"
NO_GRANOLA = "cccccccc-0000-4000-8000-000000000001"
GROUP_SIZE = "11111111-0000-4000-8000-000000000001"
GROUP_EXTRAS = "11111111-0000-4000-8000-000000000002"
GROUP_REMOVE = "11111111-0000-4000-8000-000000000003"


def acai():
    """Um açaí: tamanho obrigatório (1), adicionais até 2, retirar até 3."""
    return [
        {
            "id": GROUP_SIZE,
            "name": "Tamanho",
            "min_choices": 1,
            "max_choices": 1,
            "items": [
                {"id": SIZE_SMALL, "name": "300 ml", "price_delta": Decimal("0.00"), "active": True},
                {"id": SIZE_BIG, "name": "500 ml", "price_delta": Decimal("6.00"), "active": True},
            ],
        },
        {
            "id": GROUP_EXTRAS,
            "name": "Adicionais",
            "min_choices": 0,
            "max_choices": 2,
            "items": [
                {"id": EXTRA_NINHO, "name": "Leite ninho", "price_delta": Decimal("3.00"), "active": True},
                {"id": EXTRA_BANANA, "name": "Banana", "price_delta": Decimal("2.50"), "active": True},
                {"id": EXTRA_GRANOLA, "name": "Granola", "price_delta": Decimal("0.00"), "active": False},
            ],
        },
        {
            "id": GROUP_REMOVE,
            "name": "Retirar",
            "min_choices": 0,
            "max_choices": 3,
            "items": [{"id": NO_GRANOLA, "name": "Sem granola", "price_delta": Decimal("0.00"), "active": True}],
        },
    ]


class NoteTests(unittest.TestCase):
    def test_empty_is_none(self):
        for value in (None, "", "   ", "\n\t"):
            self.assertIsNone(io.clean_note(value))

    def test_one_line_and_trimmed(self):
        self.assertEqual(io.clean_note("  sem   cebola\nbem passado "), "sem cebola bem passado")

    def test_invisible_characters_are_dropped(self):
        self.assertEqual(io.clean_note("sem​ cebola\x00"), "sem cebola")

    def test_too_long_is_refused_not_cut(self):
        with self.assertRaises(OptionError) as caught:
            io.clean_note("a" * (io.NOTE_MAX + 1))
        self.assertIn(str(io.NOTE_MAX), caught.exception.message)
        self.assertEqual(io.clean_note("a" * io.NOTE_MAX), "a" * io.NOTE_MAX)

    def test_not_a_text_is_refused(self):
        for value in (5, ["sem cebola"], {"a": 1}, True):
            with self.assertRaises(OptionError):
                io.clean_note(value)


class SelectedTests(unittest.TestCase):
    def test_missing_is_empty(self):
        self.assertEqual(io.parse_selected(None), [])
        self.assertEqual(io.parse_selected([]), [])

    def test_ids_come_back_normalized(self):
        self.assertEqual(io.parse_selected([SIZE_BIG.upper()]), [SIZE_BIG])

    def test_bad_shapes_are_refused(self):
        for value in ("abc", {"a": 1}, [5], [None], ["not-a-uuid"], [SIZE_BIG, SIZE_BIG]):
            with self.assertRaises(OptionError, msg=repr(value)):
                io.parse_selected(value)

    def test_too_many_is_refused(self):
        many = [f"aaaaaaaa-0000-4000-8000-{n:012d}" for n in range(io.MAX_SELECTED + 1)]
        with self.assertRaises(OptionError):
            io.parse_selected(many)


class MoneyTests(unittest.TestCase):
    def test_accepts_numbers_and_brazilian_text(self):
        self.assertEqual(io.parse_money("6,50"), Decimal("6.50"))
        self.assertEqual(io.parse_money("R$ 6,5"), Decimal("6.50"))
        self.assertEqual(io.parse_money("999,99"), Decimal("999.99"))
        self.assertEqual(io.parse_money(6.5), Decimal("6.50"))
        self.assertEqual(io.parse_money(0), Decimal("0.00"))
        self.assertEqual(io.parse_money("6.5"), Decimal("6.50"))

    def test_rounds_to_cents(self):
        self.assertEqual(io.parse_money("2,345"), Decimal("2.35"))

    def test_refuses_the_rest(self):
        for value in (None, True, "", "abc", "-1", -0.01, "1000", "1.234,56", "NaN", "Infinity", [1], {}):
            with self.assertRaises(OptionError, msg=repr(value)):
                io.parse_money(value)


class ResolveTests(unittest.TestCase):
    def test_only_the_required_size(self):
        result = io.resolve(acai(), [SIZE_SMALL])
        self.assertEqual(result.delta, Decimal("0.00"))
        self.assertEqual(result.chosen, [{"group": "Tamanho", "name": "300 ml", "price": "0.00"}])

    def test_sums_the_price_of_every_choice(self):
        result = io.resolve(acai(), [EXTRA_NINHO, SIZE_BIG, EXTRA_BANANA, NO_GRANOLA])
        self.assertEqual(result.delta, Decimal("11.50"))

    def test_copy_follows_the_order_of_the_groups_not_of_the_request(self):
        result = io.resolve(acai(), [NO_GRANOLA, EXTRA_BANANA, SIZE_BIG])
        self.assertEqual([c["name"] for c in result.chosen], ["500 ml", "Banana", "Sem granola"])
        self.assertEqual(result.chosen[0], {"group": "Tamanho", "name": "500 ml", "price": "6.00"})

    def test_required_group_without_choice_is_refused(self):
        with self.assertRaises(OptionError) as caught:
            io.resolve(acai(), [])
        self.assertIn("Tamanho", caught.exception.message)

    def test_two_sizes_are_refused(self):
        with self.assertRaises(OptionError) as caught:
            io.resolve(acai(), [SIZE_SMALL, SIZE_BIG])
        self.assertIn("Tamanho", caught.exception.message)

    def test_maximum_per_group(self):
        groups = acai()
        groups[1]["items"][2]["active"] = True
        with self.assertRaises(OptionError) as caught:
            io.resolve(groups, [SIZE_SMALL, EXTRA_NINHO, EXTRA_BANANA, EXTRA_GRANOLA])
        self.assertIn("no máximo 2", caught.exception.message)

    def test_minimum_above_one(self):
        groups = acai()
        groups[1]["min_choices"] = 2
        with self.assertRaises(OptionError) as caught:
            io.resolve(groups, [SIZE_SMALL, EXTRA_BANANA])
        self.assertIn("pelo menos 2", caught.exception.message)
        self.assertEqual(io.resolve(groups, [SIZE_SMALL, EXTRA_BANANA, EXTRA_NINHO]).delta, Decimal("5.50"))

    def test_option_of_another_product_is_refused(self):
        with self.assertRaises(OptionError):
            io.resolve(acai(), [SIZE_SMALL, "dddddddd-0000-4000-8000-000000000009"])

    def test_option_turned_off_is_refused(self):
        with self.assertRaises(OptionError) as caught:
            io.resolve(acai(), [SIZE_SMALL, EXTRA_GRANOLA])
        self.assertIn("Granola", caught.exception.message)

    def test_required_group_with_every_option_off_makes_the_item_unavailable(self):
        groups = acai()
        for item in groups[0]["items"]:
            item["active"] = False
        with self.assertRaises(OptionError) as caught:
            io.resolve(groups, [])
        self.assertIn("indisponível", caught.exception.message)

    def test_product_without_options(self):
        self.assertEqual(io.resolve([], []).delta, Decimal("0.00"))
        self.assertEqual(io.resolve([], []).chosen, [])
        with self.assertRaises(OptionError):
            io.resolve([], [SIZE_SMALL])

    def test_price_is_exact_in_cents(self):
        groups = [
            {
                "id": GROUP_EXTRAS,
                "name": "Extras",
                "min_choices": 0,
                "max_choices": 3,
                "items": [
                    {"id": EXTRA_NINHO, "name": "A", "price_delta": Decimal("0.10"), "active": True},
                    {"id": EXTRA_BANANA, "name": "B", "price_delta": Decimal("0.20"), "active": True},
                ],
            }
        ]
        self.assertEqual(io.resolve(groups, [EXTRA_NINHO, EXTRA_BANANA]).delta, Decimal("0.30"))


class BuildTests(unittest.TestCase):
    ROWS = [
        {"group_id": GROUP_SIZE, "group_name": "Tamanho", "min_choices": 1, "max_choices": 1,
         "item_id": SIZE_SMALL, "item_name": "300 ml", "price_delta": Decimal("0.00"), "item_active": True},
        {"group_id": GROUP_SIZE, "group_name": "Tamanho", "min_choices": 1, "max_choices": 1,
         "item_id": SIZE_BIG, "item_name": "500 ml", "price_delta": Decimal("6.00"), "item_active": False},
        {"group_id": GROUP_EXTRAS, "group_name": "Adicionais", "min_choices": 0, "max_choices": 2,
         "item_id": None, "item_name": None, "price_delta": None, "item_active": None},
    ]

    def test_groups_keep_the_order_and_empty_groups(self):
        groups = io.build_groups(self.ROWS)
        self.assertEqual([g["name"] for g in groups], ["Tamanho", "Adicionais"])
        self.assertEqual([i["name"] for i in groups[0]["items"]], ["300 ml", "500 ml"])
        self.assertEqual(groups[1]["items"], [])

    def test_public_view_hides_turned_off_options_and_the_flag(self):
        view = io.public_view(io.build_groups(self.ROWS))
        self.assertEqual(view[0]["items"], [{"id": SIZE_SMALL, "name": "300 ml", "price_delta": Decimal("0.00")}])
        self.assertEqual(view[1]["items"], [])
        self.assertNotIn("active", view[0]["items"][0])

    def test_grouped_by_product(self):
        rows = [dict(self.ROWS[0], product_id="p1"), dict(self.ROWS[2], product_id="p2")]
        per_product = io.groups_by_product(rows)
        self.assertEqual(set(per_product), {"p1", "p2"})
        self.assertEqual(per_product["p1"][0]["name"], "Tamanho")


def payload(**overrides):
    group = {
        "name": "Tamanho",
        "min_choices": 1,
        "max_choices": 1,
        "items": [{"name": "300 ml", "price_delta": "0"}, {"name": "500 ml", "price_delta": "6,00"}],
    }
    group.update(overrides)
    return {"groups": [group]}


class NormalizeTests(unittest.TestCase):
    def test_clean_group(self):
        groups = io.normalize_groups(payload())
        self.assertEqual(groups[0]["name"], "Tamanho")
        self.assertEqual([i["price_delta"] for i in groups[0]["items"]], [Decimal("0.00"), Decimal("6.00")])
        self.assertTrue(all(i["active"] for i in groups[0]["items"]))
        self.assertIsNone(groups[0]["id"])

    def test_empty_list_removes_every_option(self):
        self.assertEqual(io.normalize_groups({"groups": []}), [])

    def test_defaults_are_optional_and_single_choice(self):
        group = io.normalize_groups({"groups": [{"name": "Molho", "items": [{"name": "Alho"}, {"name": "Barbecue"}]}]})[0]
        self.assertEqual((group["min_choices"], group["max_choices"]), (0, 1))
        self.assertEqual(group["items"][0]["price_delta"], Decimal("0.00"))

    def test_maximum_is_trimmed_to_the_number_of_options(self):
        group = io.normalize_groups(payload(max_choices=9))[0]
        self.assertEqual(group["max_choices"], 2)

    def test_ids_are_kept_when_valid(self):
        data = payload(id=GROUP_SIZE)
        data["groups"][0]["items"][0]["id"] = SIZE_SMALL
        group = io.normalize_groups(data)[0]
        self.assertEqual(group["id"], GROUP_SIZE)
        self.assertEqual(group["items"][0]["id"], SIZE_SMALL)

    def test_refuses_bad_input(self):
        bad = [
            None,
            [],
            {"groups": "x"},
            {"groups": [5]},
            payload(name=""),
            payload(name="x" * 61),
            payload(items=[]),
            payload(items=["a"]),
            payload(items=[{"name": ""}]),
            payload(items=[{"name": "A"}, {"name": "a"}]),
            payload(items=[{"name": "A", "price_delta": "-1"}]),
            payload(items=[{"name": "A", "price_delta": "abc"}]),
            payload(items=[{"name": "A", "active": "sim"}]),
            payload(min_choices=3),
            payload(min_choices=-1),
            payload(max_choices=0),
            payload(min_choices=True),
            payload(min_choices=2, max_choices=1),
            payload(id="not-a-uuid"),
            payload(items=[{"name": f"op {n}"} for n in range(io.MAX_ITEMS_PER_GROUP + 1)]),
        ]
        for data in bad:
            with self.assertRaises(OptionError, msg=repr(data)[:80]):
                io.normalize_groups(data)

    def test_two_groups_with_the_same_name_are_refused(self):
        data = payload()
        data["groups"].append(dict(data["groups"][0], name="tamanho"))
        with self.assertRaises(OptionError):
            io.normalize_groups(data)

    def test_too_many_groups_are_refused(self):
        data = {"groups": [dict(payload()["groups"][0], name=f"G{n}") for n in range(io.MAX_GROUPS + 1)]}
        with self.assertRaises(OptionError):
            io.normalize_groups(data)
        data["groups"].pop()
        self.assertEqual(len(io.normalize_groups(data)), io.MAX_GROUPS)


if __name__ == "__main__":
    unittest.main()
