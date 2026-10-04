import unittest

from table_qr import table_qr_png, table_url


class TableQrTests(unittest.TestCase):
    def test_url_contains_only_company_and_table(self):
        url = table_url("https://cliente.example", "empresa A", "12")
        self.assertEqual(url, "https://cliente.example/c/empresa%20A/mesa/12")

    def test_qr_is_printable_png(self):
        data = table_qr_png("https://cliente.example", "empresa-a", "12")
        self.assertGreater(len(data), 100)
        self.assertTrue(data.startswith(b"\x89PNG\r\n\x1a\n"))


if __name__ == "__main__":
    unittest.main()
