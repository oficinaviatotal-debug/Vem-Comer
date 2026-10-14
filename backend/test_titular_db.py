"""Prova no PostgreSQL de verdade: pedidos do titular, cópia dos dados e anonimização (migração 019).

Roda só com VEM_TEST_DATABASE_URL (fluxo .github/workflows/compliance.yml). Cada teste trabalha dentro de uma
transação desfeita no fim: o banco não fica sujo.
"""

import os
import unittest
from datetime import datetime, timedelta, timezone

import outreach
import titular

URL = os.getenv("VEM_TEST_DATABASE_URL")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover
    psycopg2 = None

NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar os testes de banco")
class TitularBancoTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg2.connect(URL)
        self.cur = self.conn.cursor(cursor_factory=RealDictCursor)

    def tearDown(self):
        self.conn.rollback()
        self.cur.close()
        self.conn.close()

    # ---- ajudantes

    def restaurante(self, nome="Saiteria do Joao", email="dono@saiteria.com.br"):
        cur = self.cur
        cur.execute(
            "INSERT INTO companies (name, slug, pix_key_type, pix_key, pix_receiver_name, pix_city, owner_phone) "
            "VALUES (%s, %s, 'cpf', '12345678909', 'JOAO DA SILVA', 'NATAL', '5584999991234') RETURNING id",
            (nome, "saiteria-" + email.split("@")[0]),
        )
        company = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO users (company_id, name, email, password_hash, role) VALUES (%s, 'Joao da Silva', %s, 'hash-de-teste', 'OWNER') RETURNING id",
            (company, email),
        )
        owner = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO users (company_id, name, email, password_hash, role) VALUES (%s, 'Maria Garcom', %s, 'hash-de-teste', 'WAITER') RETURNING id",
            (company, "maria@" + email.split("@")[1]),
        )
        staff = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO orders (company_id, customer_name, customer, customer_phone, delivery_address, delivery_code, total_price, order_type, status) "
            "VALUES (%s, 'Ana Cliente', 'Ana Cliente', '84988887777', '{\"rua\": \"Rua A\", \"numero\": \"10\"}', '1234', 42.50, 'entrega', 'entregue') RETURNING id",
            (company,),
        )
        order = cur.fetchone()["id"]
        cur.execute("INSERT INTO products (company_id, name, price) VALUES (%s, 'Prato', 10) RETURNING id", (company,))
        product = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, note) VALUES (%s, %s, 1, 10, 10, 'sem cebola, e o portao azul') ",
            (order, product),
        )
        cur.execute(
            "INSERT INTO help_requests (company_id, user_id, topic, message, contact_phone) VALUES (%s, %s, 'outro', 'meu telefone mudou', '5584999991234')",
            (company, owner),
        )
        cur.execute(
            "INSERT INTO push_subscriptions (company_id, user_id, endpoint, p256dh, auth) VALUES (%s, %s, %s, 'chave', 'segredo')",
            (company, owner, "https://push.exemplo/" + str(owner)),
        )
        cur.execute(
            "INSERT INTO subscription_payments (company_id, amount_cents, period_start, period_end, reference, recorded_by) "
            "VALUES (%s, 4900, '2026-10-01', '2026-10-31', 'pix-e2e-1', %s)",
            (company, owner),
        )
        return {"company": company, "owner": owner, "staff": staff, "order": order}

    def pedido(self, **extra):
        data = {"kind": "acesso", "contact": "Ana@Exemplo.com", "description": None}
        data.update(extra)
        return titular.validate_request(data)

    # ---- pedido, prazo e histórico

    def test_a_request_gets_a_protocol_a_deadline_and_a_first_event(self):
        made = titular.create(self.cur, self.pedido(), now=NOW)
        self.assertRegex(made["protocol"], r"^VC-2026-[0-9A-F]{8}$")
        self.assertEqual(made["due_at"], NOW + timedelta(days=15))
        self.cur.execute("SELECT event FROM data_request_events e JOIN data_requests r ON r.id = e.request_id WHERE r.protocol = %s", (made["protocol"],))
        self.assertEqual([r["event"] for r in self.cur.fetchall()], ["recebida"])

    def test_the_code_is_not_stored_only_its_fingerprint(self):
        made = titular.create(self.cur, self.pedido(), now=NOW)
        self.cur.execute("SELECT token_hash, contact, subject_hash FROM data_requests WHERE protocol = %s", (made["protocol"],))
        row = self.cur.fetchone()
        self.assertNotEqual(row["token_hash"], made["token"])
        self.assertEqual(row["token_hash"], titular.token_hash(made["token"]))
        self.assertEqual(row["contact"], "ana@exemplo.com")
        self.assertEqual(row["subject_hash"], outreach.email_hash("ana@exemplo.com"))

    def test_following_a_request_needs_the_protocol_and_the_code(self):
        made = titular.create(self.cur, self.pedido(), now=NOW)
        seen = titular.public_view(self.cur, made["protocol"], made["token"])
        self.assertEqual(seen["status"], "recebida")
        self.assertIsNone(titular.public_view(self.cur, made["protocol"], "codigo-errado"))
        self.assertIsNone(titular.public_view(self.cur, "VC-2026-00000000", made["token"]))
        self.assertIsNone(titular.public_view(self.cur, "' OR 1=1 --", made["token"]))

    def test_a_report_may_be_anonymous_and_has_a_two_day_target(self):
        clean = titular.validate_request({"kind": "denuncia", "target_url": "https://x.exemplo/cardapio", "description": "foto de outra pessoa sem permissao", "reason": "dados_pessoais"})
        made = titular.create(self.cur, clean, now=NOW)
        self.assertEqual(made["due_at"], NOW + timedelta(hours=48))
        self.cur.execute("SELECT contact, description FROM data_requests WHERE protocol = %s", (made["protocol"],))
        row = self.cur.fetchone()
        self.assertIsNone(row["contact"])
        self.assertIn("Dados pessoais ou imagem minha sem permissão", row["description"])

    def test_the_history_only_takes_new_rows(self):
        made = titular.create(self.cur, self.pedido(), now=NOW)
        for sql in ("UPDATE data_request_events SET note = 'x'", "DELETE FROM data_request_events", "TRUNCATE data_request_events"):
            with self.subTest(sql=sql):
                self.cur.execute("SAVEPOINT s")
                with self.assertRaises(psycopg2.Error):
                    self.cur.execute(sql)
                self.cur.execute("ROLLBACK TO SAVEPOINT s")
        self.cur.execute("SELECT count(*) AS n FROM data_request_events")
        self.assertGreaterEqual(self.cur.fetchone()["n"], 1)
        self.assertTrue(made)

    def test_answering_records_who_when_and_keeps_the_history(self):
        made = titular.create(self.cur, self.pedido(), now=NOW)
        self.cur.execute("SELECT id FROM data_requests WHERE protocol = %s", (made["protocol"],))
        request_id = self.cur.fetchone()["id"]
        titular.answer(self.cur, request_id, "respondida", "Enviamos a copia dos seus dados por e-mail.", identity_verified=True)
        seen = titular.public_view(self.cur, made["protocol"], made["token"])
        self.assertEqual(seen["status"], "respondida")
        self.assertIn("copia", seen["response"])
        self.assertIsNotNone(seen["answered_at"])
        self.cur.execute("SELECT event FROM data_request_events WHERE request_id = %s ORDER BY seq", (request_id,))
        self.assertEqual([r["event"] for r in self.cur.fetchall()], ["recebida", "identidade_conferida", "respondida"])

    def test_open_requests_come_sorted_by_deadline_with_overdue_flag(self):
        velho = titular.create(self.cur, self.pedido(contact="velho@exemplo.com"), now=NOW - timedelta(days=20))
        novo = titular.create(self.cur, self.pedido(contact="novo@exemplo.com"), now=NOW)
        itens = {i["protocol"]: i for i in titular.list_open(self.cur, now=NOW)}
        self.assertTrue(itens[velho["protocol"]]["overdue"])
        self.assertFalse(itens[novo["protocol"]]["overdue"])

    # ---- cópia dos dados

    def test_the_export_has_the_account_and_never_the_password(self):
        ids = self.restaurante()
        body = titular.export_account(self.cur, ids["owner"], ids["company"], "OWNER", now=NOW)
        self.assertEqual(body["usuario"]["email"], "dono@saiteria.com.br")
        self.assertEqual(body["restaurante"]["pix_key"], "12345678909")
        self.assertEqual(len(body["equipe"]), 2)
        self.assertEqual(body["pagamentos_da_assinatura"][0]["amount_cents"], 4900)
        self.assertEqual(body["totais"], {"produtos": 1, "pedidos": 1})
        self.assertNotIn("hash-de-teste", str(body))
        self.assertNotIn("password", str(body).lower())
        self.assertNotIn("pedidos", body)  # só vem quando o dono pede

    def test_orders_come_only_when_the_owner_asks(self):
        ids = self.restaurante()
        body = titular.export_account(self.cur, ids["owner"], ids["company"], "OWNER", include_orders=True, now=NOW)
        self.assertEqual(body["pedidos"][0]["customer_name"], "Ana Cliente")

    def test_staff_gets_only_their_own_data(self):
        ids = self.restaurante()
        body = titular.export_account(self.cur, ids["staff"], ids["company"], "WAITER", now=NOW)
        self.assertEqual(body["usuario"]["name"], "Maria Garcom")
        for chave in ("restaurante", "equipe", "pagamentos_da_assinatura", "pedidos"):
            self.assertNotIn(chave, body)

    # ---- eliminação

    def test_find_person_by_email_shows_a_hint_and_ignores_removed_people(self):
        ids = self.restaurante()
        found = titular.find_person(self.cur, " DONO@saiteria.com.br ")
        self.assertEqual((found["role"], found["name_hint"], found["user_id"]), ("OWNER", "J***", str(ids["owner"])))
        self.assertIsNone(titular.find_person(self.cur, "ninguem@exemplo.com"))
        self.assertIsNone(titular.find_person(self.cur, "lixo"))
        titular.anonymize_user(self.cur, ids["owner"])
        self.assertIsNone(titular.find_person(self.cur, "dono@saiteria.com.br"))

    def test_anonymizing_a_person_removes_identity_and_blocks_marketing(self):
        ids = self.restaurante()
        counts = titular.anonymize_user(self.cur, ids["staff"])
        self.assertEqual(counts["pessoa"], 1)
        self.cur.execute("SELECT name, email, password_hash, active FROM users WHERE id = %s", (ids["staff"],))
        row = self.cur.fetchone()
        self.assertEqual(row["name"], "Pessoa removida")
        self.assertTrue(row["email"].endswith("@anon.invalid"))
        self.assertEqual(row["password_hash"], "!")
        self.assertFalse(row["active"])
        self.cur.execute("SELECT 1 AS x FROM email_suppression WHERE email_hash = %s", (outreach.email_hash("maria@saiteria.com.br"),))
        self.assertTrue(self.cur.fetchone())
        # o dono continua inteiro
        self.cur.execute("SELECT name FROM users WHERE id = %s", (ids["owner"],))
        self.assertEqual(self.cur.fetchone()["name"], "Joao da Silva")

    def test_anonymizing_a_restaurant_removes_personal_data_and_keeps_money(self):
        ids = self.restaurante()
        counts = titular.anonymize_company(self.cur, ids["company"])
        self.assertEqual(counts["pessoas"], 2)

        self.cur.execute("SELECT name, slug, pix_key, pix_receiver_name, owner_phone, orders_paused FROM companies WHERE id = %s", (ids["company"],))
        c = self.cur.fetchone()
        self.assertEqual(c["name"], "Restaurante encerrado")
        self.assertTrue(c["slug"].startswith("encerrado-"))
        self.assertIsNone(c["pix_key"])
        self.assertIsNone(c["pix_receiver_name"])
        self.assertIsNone(c["owner_phone"])
        self.assertTrue(c["orders_paused"])

        self.cur.execute("SELECT customer_name, customer, customer_phone, delivery_address, delivery_code, total_price, order_type FROM orders WHERE id = %s", (ids["order"],))
        o = self.cur.fetchone()
        self.assertEqual([o["customer_name"], o["customer"], o["customer_phone"], o["delivery_address"], o["delivery_code"]], [None] * 5)
        self.assertEqual(float(o["total_price"]), 42.50)  # o valor fica (obrigação fiscal)

        self.cur.execute("SELECT note FROM order_items WHERE order_id = %s", (ids["order"],))
        self.assertIsNone(self.cur.fetchone()["note"])
        self.cur.execute("SELECT count(*) AS n FROM push_subscriptions WHERE company_id = %s", (ids["company"],))
        self.assertEqual(self.cur.fetchone()["n"], 0)
        self.cur.execute("SELECT contact_phone, message FROM help_requests WHERE company_id = %s", (ids["company"],))
        h = self.cur.fetchone()
        self.assertIsNone(h["contact_phone"])
        self.assertEqual(h["message"], "[removido]")
        self.cur.execute("SELECT amount_cents FROM subscription_payments WHERE company_id = %s", (ids["company"],))
        self.assertEqual(self.cur.fetchone()["amount_cents"], 4900)  # pagamento da assinatura fica

    def test_another_restaurant_is_not_touched(self):
        a = self.restaurante(email="a@um.com.br")
        b = self.restaurante(nome="Outro", email="b@dois.com.br")
        titular.anonymize_company(self.cur, a["company"])
        self.cur.execute("SELECT name FROM companies WHERE id = %s", (b["company"],))
        self.assertEqual(self.cur.fetchone()["name"], "Outro")
        self.cur.execute("SELECT customer_name FROM orders WHERE id = %s", (b["order"],))
        self.assertEqual(self.cur.fetchone()["customer_name"], "Ana Cliente")

    def test_an_anonymized_person_can_not_log_in_with_any_password(self):
        from werkzeug.security import check_password_hash

        ids = self.restaurante()
        titular.anonymize_user(self.cur, ids["owner"])
        self.cur.execute("SELECT password_hash FROM users WHERE id = %s", (ids["owner"],))
        stored = self.cur.fetchone()["password_hash"]
        for tentativa in ("!", "", "hash-de-teste", "qualquer coisa"):
            self.assertFalse(check_password_hash(stored, tentativa), tentativa)


class _SharedConnection:
    """Entrega a mesma conexão do teste às rotas, sem deixar commit nem close valerem (o teste desfaz tudo no fim)."""

    def __init__(self, conn):
        self._conn = conn

    def cursor(self, **kwargs):
        return self._conn.cursor(**kwargs)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar os testes de banco")
class RotasContraOBancoTests(unittest.TestCase):
    """As páginas e rotas de ponta a ponta, com o PostgreSQL de verdade por trás."""

    def setUp(self):
        os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")
        import app as backend_app
        import titular_api
        from unittest.mock import patch
        from signup import SignupLimiter

        self.conn = psycopg2.connect(URL)
        self.client = backend_app.app.test_client()
        for patcher in (
            patch.object(titular_api, "get_db_connection", return_value=_SharedConnection(self.conn)),
            patch.object(titular_api, "limiter", SignupLimiter(per_hour=100, per_day=100)),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def tearDown(self):
        self.conn.rollback()
        self.conn.close()

    def test_open_a_request_follow_it_and_see_the_answer(self):
        made = self.client.post("/api/privacidade/solicitacoes", json={"kind": "acesso", "contact": "ana@exemplo.com"})
        self.assertEqual(made.status_code, 201, made.get_data(as_text=True))
        body = made.get_json()
        seen = self.client.get(body["follow_url"])
        self.assertEqual(seen.status_code, 200)
        self.assertIn("Recebida", seen.get_data(as_text=True))

        cur = self.conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id FROM data_requests WHERE protocol = %s", (body["protocol"],))
        titular.answer(cur, cur.fetchone()["id"], "respondida", "Enviamos a copia dos seus dados.")
        again = self.client.get(body["follow_url"]).get_data(as_text=True)
        self.assertIn("Enviamos a copia dos seus dados.", again)
        self.assertIn("Respondida", again)

        wrong = self.client.get(f"/api/privacidade/acompanhar?p={body['protocol']}&t=codigo-errado")
        self.assertEqual(wrong.status_code, 404)

    def test_an_anonymous_report_goes_through(self):
        reply = self.client.post("/api/denuncia", data={"target_url": "https://x.exemplo/cardapio", "reason": "golpe", "description": "pede Pix para outra pessoa"})
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        cur = self.conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT kind, contact FROM data_requests ORDER BY created_at DESC LIMIT 1")
        row = cur.fetchone()
        self.assertEqual((row["kind"], row["contact"]), ("denuncia", None))


if __name__ == "__main__":
    unittest.main()
