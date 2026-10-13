"""Entrega e retirada: regiões por CEP, taxa, pedido mínimo, endereço e telefone (regras puras, sem banco)."""

import unittest
from decimal import Decimal

import delivery
from delivery import DeliveryError


def zone(name, prefixes, fee="5.00", min_order="0.00", eta=None, active=True, zone_id=None):
    return {
        "id": zone_id or name,
        "name": name,
        "cep_prefixes": prefixes,
        "fee": Decimal(fee),
        "min_order": Decimal(min_order),
        "eta_minutes": eta,
        "active": active,
    }


OPEN = {"accepts_pickup": True, "delivery_paused": False}
ZONES = [
    zone("Centro", ["30110", "30120"], fee="5.00", min_order="20.00", eta=40),
    zone("Bairro Norte", ["30140"], fee="8.00", eta=55),
    zone("Cidade toda", ["301"], fee="15.00"),
]
ADDRESS = {"cep": "30140-071", "street": "Rua das Flores", "number": "123", "neighborhood": "Norte"}


class CepTests(unittest.TestCase):
    def test_a_cep_is_eight_digits_however_it_is_written(self):
        for text in ("30140-071", "30140071", " 30.140-071 ", "30140 071"):
            self.assertEqual(delivery.clean_cep(text), "30140071")
        for bad in ("3014007", "301400711", "abcdefgh", "", None, 30140071):
            self.assertIsNone(delivery.clean_cep(bad))

    def test_prefixes_accept_the_way_an_owner_writes_them(self):
        self.assertEqual(delivery.parse_prefixes("30140, 30150-9"), ["30140", "301509"])
        self.assertEqual(delivery.parse_prefixes(["30140", "30140", " 30150 30160"]), ["30140", "30150", "30160"])

    def test_prefixes_refuse_what_is_not_a_cep_beginning(self):
        for bad in ("", "  ", "30", "123456789", "abc", [], [1], None, 30140):
            with self.assertRaises(DeliveryError, msg=repr(bad)):
                delivery.parse_prefixes(bad)
        with self.assertRaises(DeliveryError):
            delivery.parse_prefixes([f"{n:05d}" for n in range(41)])


class MatchTests(unittest.TestCase):
    def test_the_longest_beginning_wins(self):
        self.assertEqual(delivery.match_zone(ZONES, "30140071")["name"], "Bairro Norte")
        self.assertEqual(delivery.match_zone(ZONES, "30110000")["name"], "Centro")
        self.assertEqual(delivery.match_zone(ZONES, "30199999")["name"], "Cidade toda")

    def test_no_zone_when_nothing_matches_or_the_zone_is_off(self):
        self.assertIsNone(delivery.match_zone(ZONES, "01310100"))
        off = [zone("Centro", ["30110"], active=False)]
        self.assertIsNone(delivery.match_zone(off, "30110000"))

    def test_a_tie_goes_to_the_cheaper_zone(self):
        zones = [zone("Cara", ["30140"], fee="9.00"), zone("Barata", ["30140"], fee="4.00")]
        self.assertEqual(delivery.match_zone(zones, "30140071")["name"], "Barata")


class QuoteTests(unittest.TestCase):
    def test_a_covered_cep_gets_zone_fee_minimum_and_time(self):
        reply = delivery.quote(OPEN, ZONES, "30110-050")
        self.assertEqual(
            reply,
            {"available": True, "zone": "Centro", "fee": "5.00", "min_order": "20.00", "eta_minutes": 40},
        )

    def test_each_way_of_no_has_a_reason_and_a_sentence(self):
        self.assertEqual(delivery.quote(OPEN, ZONES, "123")["reason"], "invalid_cep")
        self.assertEqual(delivery.quote(OPEN, ZONES, "01310-100")["reason"], "out_of_area")
        self.assertEqual(delivery.quote(OPEN, [], "30110-050")["reason"], "no_delivery")
        paused = dict(OPEN, delivery_paused=True)
        reply = delivery.quote(paused, ZONES, "30110-050")
        self.assertEqual(reply["reason"], "paused")
        for case in (reply, delivery.quote(OPEN, ZONES, "01310-100")):
            self.assertFalse(case["available"])
            self.assertTrue(case["message"])


class SettingsTests(unittest.TestCase):
    def test_what_the_owner_types_is_cleaned(self):
        out = delivery.normalize_settings(
            {
                "accepts_pickup": False,
                "delivery_paused": True,
                "zones": [
                    {"name": "  Centro ", "cep_prefixes": "30110, 30120", "fee": "R$ 5,50", "min_order": "20", "eta_minutes": "40"},
                    {"id": "not-a-uuid", "name": "Norte", "cep_prefixes": ["30140"], "fee": 8, "active": False},
                ],
            }
        )
        self.assertEqual(out["accepts_pickup"], False)
        self.assertEqual(out["delivery_paused"], True)
        centro, norte = out["zones"]
        self.assertEqual(
            (centro["name"], centro["cep_prefixes"], centro["fee"], centro["min_order"], centro["eta_minutes"], centro["active"]),
            ("Centro", ["30110", "30120"], Decimal("5.50"), Decimal("20.00"), 40, True),
        )
        self.assertIsNone(norte["id"])  # an id that is not an id is a new zone
        self.assertEqual((norte["fee"], norte["min_order"], norte["eta_minutes"], norte["active"]), (Decimal("8.00"), Decimal("0.00"), None, False))

    def test_free_delivery_is_a_fee_of_zero(self):
        out = delivery.normalize_settings({"zones": [{"name": "Perto", "cep_prefixes": "30140", "fee": ""}]})
        self.assertEqual(out["zones"][0]["fee"], Decimal("0.00"))
        self.assertEqual(out["accepts_pickup"], True)
        self.assertEqual(out["delivery_paused"], False)

    def test_a_save_without_the_zone_list_is_refused_instead_of_wiping_the_zones(self):
        with self.assertRaises(DeliveryError):
            delivery.normalize_settings({"accepts_pickup": True})
        self.assertEqual(delivery.normalize_settings({"zones": []})["zones"], [])

    def test_everything_wrong_is_refused_with_a_sentence(self):
        good = {"name": "Centro", "cep_prefixes": "30110", "fee": "5"}
        bad_cases = [
            None,
            [],
            {"zones": "x"},
            {"zones": [{"name": "", "cep_prefixes": "30110"}]},
            {"zones": [{"name": "x" * 61, "cep_prefixes": "30110"}]},
            {"zones": [good, dict(good, name="centro")]},
            {"zones": [dict(good, fee="-1")]},
            {"zones": [dict(good, fee="1000")]},
            {"zones": [dict(good, fee="abc")]},
            {"zones": [dict(good, fee=True)]},
            {"zones": [dict(good, min_order="10000")]},
            {"zones": [dict(good, eta_minutes="2")]},
            {"zones": [dict(good, eta_minutes="500")]},
            {"zones": [dict(good, eta_minutes="logo")]},
            {"zones": [dict(good, active="sim")]},
            {"accepts_pickup": "sim", "zones": []},
            {"zones": [good] * 21},
            {"zones": ["x"]},
        ]
        for case in bad_cases:
            with self.assertRaises(DeliveryError, msg=repr(case)) as caught:
                delivery.normalize_settings(case)
            self.assertTrue(caught.exception.message)

    def test_names_are_compared_without_accents_or_capitals(self):
        good = {"cep_prefixes": "30110"}
        with self.assertRaises(DeliveryError):
            delivery.normalize_settings({"zones": [dict(good, name="São Pedro"), dict(good, name="sao pedro")]})


class PhoneAndAddressTests(unittest.TestCase):
    def test_phone_is_kept_as_digits_with_the_country_code_dropped(self):
        for text in ("(31) 99999-8888", "31999998888", "+55 31 99999-8888", "5531999998888"):
            self.assertEqual(delivery.parse_phone(text, required=True), "31999998888")
        self.assertEqual(delivery.parse_phone("(31) 3333-4444", required=True), "3133334444")

    def test_phone_that_is_not_one_is_refused(self):
        for bad in ("123", "99999-8888", "(31) 89999-8888", "(01) 99999-8888", "abc", 31999998888, "0031999998888"):
            with self.assertRaises(DeliveryError, msg=repr(bad)):
                delivery.parse_phone(bad, required=True)

    def test_phone_can_be_empty_only_when_it_is_not_required(self):
        self.assertIsNone(delivery.parse_phone("", required=False))
        self.assertIsNone(delivery.parse_phone(None, required=False))
        with self.assertRaises(DeliveryError):
            delivery.parse_phone("", required=True)
        with self.assertRaises(DeliveryError):
            delivery.parse_phone("   ", required=True)

    def test_address_needs_cep_street_number_and_neighborhood(self):
        out = delivery.parse_address(
            {"cep": "30140-071", "street": " Rua  das\nFlores ", "number": "123", "neighborhood": "Norte", "complement": "", "reference": "Em frente à padaria"}
        )
        self.assertEqual(
            out,
            {"cep": "30140071", "street": "Rua das Flores", "number": "123", "neighborhood": "Norte", "reference": "Em frente à padaria"},
        )
        for missing in ("cep", "street", "number", "neighborhood"):
            data = dict(ADDRESS)
            data.pop(missing)
            with self.assertRaises(DeliveryError, msg=missing):
                delivery.parse_address(data)
        with self.assertRaises(DeliveryError):
            delivery.parse_address("Rua das Flores, 123")
        with self.assertRaises(DeliveryError):
            delivery.parse_address(dict(ADDRESS, street="x" * 121))
        with self.assertRaises(DeliveryError):
            delivery.parse_address(dict(ADDRESS, number=123))  # a number typed as a number is still a text field


class HandlingTests(unittest.TestCase):
    def handle(self, **overrides):
        args = dict(
            order_type="entrega",
            has_table=False,
            address=ADDRESS,
            phone="(31) 99999-8888",
            customer_name="Ana",
            subtotal=Decimal("30.00"),
        )
        args.update(overrides)
        company = args.pop("company", OPEN)
        zones = args.pop("zones", ZONES)
        return delivery.resolve_handling(company, zones, **args)

    def test_delivery_takes_the_fee_of_the_zone_that_the_cep_picks(self):
        got = self.handle()
        self.assertEqual((got.order_type, got.fee, got.zone), ("entrega", Decimal("8.00"), "Bairro Norte"))
        self.assertEqual(got.phone, "31999998888")
        self.assertEqual(got.address["cep"], "30140071")

    def test_the_minimum_order_counts_the_dishes_not_the_fee(self):
        centro = dict(ADDRESS, cep="30110-050")
        with self.assertRaises(DeliveryError) as caught:
            self.handle(address=centro, subtotal=Decimal("19.99"))
        self.assertIn("R$ 20,00", caught.exception.message)
        self.assertEqual(self.handle(address=centro, subtotal=Decimal("20.00")).fee, Decimal("5.00"))

    def test_delivery_is_refused_with_a_sentence_in_every_case_it_cannot_happen(self):
        cases = [
            dict(address=dict(ADDRESS, cep="01310-100")),
            dict(address=None),
            dict(address={"cep": "30140071"}),
            dict(phone=""),
            dict(phone="123"),
            dict(customer_name="Cliente Balcão"),
            dict(customer_name=""),
            dict(company=dict(OPEN, delivery_paused=True)),
            dict(zones=[]),
            dict(zones=[zone("Centro", ["30140"], active=False)]),
            dict(has_table=True),
            dict(company=None),
        ]
        for case in cases:
            with self.assertRaises(DeliveryError, msg=repr(case)) as caught:
                self.handle(**case)
            self.assertTrue(caught.exception.message)

    def test_pickup_has_no_fee_and_can_be_turned_off(self):
        got = self.handle(order_type="retirada", address=None, phone="")
        self.assertEqual((got.order_type, got.fee, got.zone, got.address, got.phone), ("retirada", Decimal("0.00"), None, None, None))
        with self.assertRaises(DeliveryError):
            self.handle(order_type="retirada", company=dict(OPEN, accepts_pickup=False))

    def test_pickup_works_even_when_delivery_is_paused(self):
        got = self.handle(order_type="retirada", company=dict(OPEN, delivery_paused=True), address=None, phone=None)
        self.assertEqual(got.order_type, "retirada")

    def test_a_table_order_has_no_fee_and_does_not_take_delivery(self):
        got = self.handle(order_type=None, has_table=True, address=None, phone=None)
        self.assertEqual((got.order_type, got.fee), ("mesa", Decimal("0.00")))
        self.assertEqual(self.handle(order_type="mesa", has_table=True, address=None, phone=None).order_type, "mesa")
        with self.assertRaises(DeliveryError):
            self.handle(order_type="entrega", has_table=True)
        with self.assertRaises(DeliveryError):
            self.handle(order_type="mesa", has_table=False)

    def test_an_order_without_a_type_is_a_counter_order_like_before(self):
        got = self.handle(order_type=None, address=None, phone=None)
        self.assertEqual((got.order_type, got.fee, got.zone), ("balcao", Decimal("0.00"), None))

    def test_an_unknown_type_is_refused(self):
        for bad in ("moto", "", 1, "ENTREGA"):
            with self.assertRaises(DeliveryError, msg=repr(bad)):
                self.handle(order_type=bad)

    def test_a_fee_the_phone_sends_is_not_even_read(self):
        # resolve_handling has no fee argument: the only fee is the one of the zone
        self.assertEqual(self.handle().fee, Decimal("8.00"))


class ViewTests(unittest.TestCase):
    def test_the_public_view_shows_only_active_zones_without_the_cep_lists(self):
        zones = ZONES + [zone("Desligada", ["99999"], active=False)]
        view = delivery.public_view(OPEN, zones)
        self.assertEqual(view["pickup"], True)
        self.assertEqual(view["delivery"], True)
        self.assertEqual([z["name"] for z in view["zones"]], ["Centro", "Bairro Norte", "Cidade toda"])
        self.assertNotIn("cep_prefixes", view["zones"][0])
        self.assertEqual(view["zones"][0], {"name": "Centro", "fee": "5.00", "min_order": "20.00", "eta_minutes": 40})

    def test_paused_or_empty_delivery_shows_no_zones(self):
        paused = delivery.public_view(dict(OPEN, delivery_paused=True), ZONES)
        self.assertEqual((paused["delivery"], paused["paused"], paused["zones"]), (False, True, []))
        empty = delivery.public_view(OPEN, [])
        self.assertEqual((empty["delivery"], empty["paused"], empty["zones"]), (False, False, []))

    def test_the_admin_view_has_ids_prefixes_and_the_off_zones(self):
        zones = [zone("Centro", ["30110"], zone_id="z1"), zone("Norte", ["30140"], active=False, zone_id="z2")]
        view = delivery.admin_view(OPEN, zones)
        self.assertEqual([(z["id"], z["cep_prefixes"], z["active"]) for z in view["zones"]], [("z1", ["30110"], True), ("z2", ["30140"], False)])
        self.assertEqual(view["zones"][0]["fee"], "5.00")


if __name__ == "__main__":
    unittest.main()
