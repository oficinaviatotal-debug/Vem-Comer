import binascii
import unittest
from decimal import Decimal

import pix


class Crc16Tests(unittest.TestCase):
    def test_standard_check_value(self):
        # The universal test vector for CRC-16/CCITT-FALSE.
        self.assertEqual(pix.crc16("123456789"), "29B1")

    def test_matches_the_central_bank_manual_example(self):
        # Example payload from the Banco Central Pix manual; the CRC covers the
        # "6304" that announces it.
        body = (
            "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000"
            "5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304"
        )
        self.assertEqual(pix.crc16(body), "1D3D")

    def test_agrees_with_the_standard_library_implementation(self):
        for text in ("", "A", "00020126", "x" * 500):
            expected = f"{binascii.crc_hqx(text.encode('ascii'), 0xFFFF):04X}"
            self.assertEqual(pix.crc16(text), expected)


class KeyTests(unittest.TestCase):
    def test_cpf(self):
        self.assertEqual(pix.normalize_key("cpf", "529.982.247-25"), "52998224725")
        for bad in ("529.982.247-26", "111.111.111-11", "123", "abc"):
            with self.assertRaises(pix.PixError):
                pix.normalize_key("cpf", bad)

    def test_cnpj_numeric_and_alphanumeric(self):
        self.assertEqual(pix.normalize_key("cnpj", "11.222.333/0001-81"), "11222333000181")
        # Alphanumeric CNPJ (issued from July 2026), example from the Receita Federal.
        self.assertEqual(pix.normalize_key("cnpj", "12.ABC.345/01DE-35"), "12ABC34501DE35")
        self.assertEqual(pix.normalize_key("cnpj", "12.abc.345/01de-35"), "12ABC34501DE35")
        for bad in ("11.222.333/0001-82", "00000000000000", "12.ABC.345/01DE-36"):
            with self.assertRaises(pix.PixError):
                pix.normalize_key("cnpj", bad)

    def test_phone_is_stored_the_way_banks_register_it(self):
        for text in ("84 99999-9999", "(84) 99999-9999", "+55 84 99999-9999", "5584999999999"):
            self.assertEqual(pix.normalize_key("phone", text), "+5584999999999")
        for bad in ("123", "99999-9999", "(04) 99999-9999", "abc"):
            with self.assertRaises(pix.PixError):
                pix.normalize_key("phone", bad)

    def test_email_is_lowercased_and_checked(self):
        self.assertEqual(pix.normalize_key("email", " Loja@Exemplo.com.br "), "loja@exemplo.com.br")
        for bad in ("sem-arroba", "a@b", "a b@c.com", "a@" + "b" * 80 + ".com"):
            with self.assertRaises(pix.PixError):
                pix.normalize_key("email", bad)

    def test_random_key_is_a_uuid(self):
        key = "123E4567-E12B-12D1-A456-426655440000"
        self.assertEqual(pix.normalize_key("random", key), key.lower())
        with self.assertRaises(pix.PixError):
            pix.normalize_key("random", "not-a-uuid")

    def test_type_is_required_and_known(self):
        for bad_type in ("", None, "cartao"):
            with self.assertRaises(pix.PixError):
                pix.normalize_key(bad_type, "529.982.247-25")
        with self.assertRaises(pix.PixError):
            pix.normalize_key("cpf", "   ")

    def test_masked_key_hides_most_of_it(self):
        self.assertEqual(pix.mask_key("cpf", "52998224725"), "529••••••25")
        self.assertEqual(pix.mask_key("phone", "+5584999999999"), "+5584•••••9999")
        self.assertEqual(pix.mask_key("email", "loja@exemplo.com.br"), "lo••@exemplo.com.br")
        masked = pix.mask_key("random", "123e4567-e12b-12d1-a456-426655440000")
        self.assertTrue(masked.startswith("123e4567-") and masked.endswith("-0000"))
        self.assertNotIn("e12b", masked)


class ReceiverTests(unittest.TestCase):
    def test_names_become_ascii_capitals_within_the_limits(self):
        self.assertEqual(pix.clean_text("Jack Sushima & Cia. Ltda", 25), "JACK SUSHIMA CIA LTDA")
        self.assertEqual(pix.clean_text("São Gonçalo do Amarante", 15), "SAO GONCALO DO")
        self.assertEqual(pix.clean_text("  Açaí  ", 25), "ACAI")

    def test_name_and_city_are_required(self):
        with self.assertRaises(pix.PixError):
            pix.clean_receiver("", "Natal")
        with self.assertRaises(pix.PixError):
            pix.clean_receiver("Jack", "!!!")
        self.assertEqual(pix.clean_receiver("Jack Sushima", "Natal"), ("JACK SUSHIMA", "NATAL"))


class PayloadTests(unittest.TestCase):
    def build(self, **overrides):
        values = dict(
            key="+5584999999999",
            receiver_name="JACK SUSHIMA",
            city="NATAL",
            amount=Decimal("89.90"),
            txid="VC1A2B3C4D",
        )
        values.update(overrides)
        return pix.build_payload(**values)

    def test_structure_and_crc(self):
        payload = self.build()
        self.assertTrue(pix.is_valid_payload(payload))
        self.assertTrue(payload.startswith("000201"))
        self.assertEqual(payload[-8:-4], "6304")

        fields = pix.parse_payload(payload)
        self.assertEqual(fields["52"], "0000")
        self.assertEqual(fields["53"], "986")
        self.assertEqual(fields["54"], "89.90")
        self.assertEqual(fields["58"], "BR")
        self.assertEqual(fields["59"], "JACK SUSHIMA")
        self.assertEqual(fields["60"], "NATAL")

        account = pix.parse_payload(fields["26"])
        self.assertEqual(account["00"], "br.gov.bcb.pix")
        self.assertEqual(account["01"], "+5584999999999")
        self.assertEqual(pix.parse_payload(fields["62"])["05"], "VC1A2B3C4D")

    def test_a_changed_character_breaks_the_crc(self):
        payload = self.build()
        tampered = payload.replace("89.90", "08.90")
        self.assertFalse(pix.is_valid_payload(tampered))

    def test_amount_is_exact_with_two_decimals(self):
        self.assertEqual(pix.format_amount("89.9"), "89.90")
        self.assertEqual(pix.format_amount(Decimal("19.90") * 3), "59.70")
        self.assertEqual(pix.format_amount(12), "12.00")
        self.assertEqual(pix.format_amount("0.005"), "0.01")
        for bad in (0, -1, "abc", None):
            with self.assertRaises(pix.PixError):
                pix.format_amount(bad)

    def test_reference_falls_back_to_the_standard_placeholder(self):
        fields = pix.parse_payload(self.build(txid=None))
        self.assertEqual(pix.parse_payload(fields["62"])["05"], "***")

    def test_order_reference_is_short_and_alphanumeric(self):
        ref = pix.txid_for_order("0a1b2c3d-aaaa-bbbb-cccc-ddddeeeeffff")
        self.assertEqual(ref, "VC0A1B2C3D")
        self.assertLessEqual(len(ref), pix.TXID_MAX)

    def test_every_key_type_produces_a_valid_code(self):
        keys = [
            pix.normalize_key("cpf", "529.982.247-25"),
            pix.normalize_key("cnpj", "11.222.333/0001-81"),
            pix.normalize_key("phone", "84 99999-9999"),
            pix.normalize_key("email", "loja@exemplo.com.br"),
            pix.normalize_key("random", "123e4567-e12b-12d1-a456-426655440000"),
        ]
        for key in keys:
            self.assertTrue(pix.is_valid_payload(self.build(key=key)), key)

    def test_malformed_text_is_not_a_valid_code(self):
        for text in ("", "abc", "0002", "000201630400"):
            self.assertFalse(pix.is_valid_payload(text))


if __name__ == "__main__":
    unittest.main()
