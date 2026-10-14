"""Prova no banco de verdade (PostgreSQL): a migração 018 e as regras que dependem do banco.

Roda só quando VEM_TEST_DATABASE_URL aponta para um banco com o esquema e as migrações aplicados
(o fluxo .github/workflows/compliance.yml faz isso com um PostgreSQL de teste). Sem a variável, os testes são
pulados, assim a suíte comum continua rodando em qualquer máquina. Cada teste trabalha dentro de uma transação
que é desfeita no fim: o banco não fica sujo.
"""

import os
import unittest
from datetime import datetime, timedelta, timezone

import consent
import outreach as o

URL = os.getenv("VEM_TEST_DATABASE_URL")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover
    psycopg2 = None


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar os testes de banco")
class ConformidadeBancoTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg2.connect(URL)
        self.cur = self.conn.cursor(cursor_factory=RealDictCursor)

    def tearDown(self):
        self.conn.rollback()
        self.cur.close()
        self.conn.close()

    def add(self, email="rh@empresa.com.br", **extra):
        data = dict(source="anuncio_publico", source_note="cartaz publicado", legal_basis="interesse_legitimo", added_by="teste")
        data.update(extra)
        return o.add_contact(self.cur, email, **data)

    # ---- prova de aceite

    def test_the_acceptance_log_only_takes_new_rows(self):
        consent.record(self.cur, "dono@rest.com", kind="dono", purpose="termos", granted=True, version="2026-10-06", channel="site")
        for sql in ("UPDATE consent_records SET granted = false", "DELETE FROM consent_records", "TRUNCATE consent_records"):
            with self.subTest(sql=sql):
                with self.assertRaises(psycopg2.Error):
                    self.cur.execute(sql)
                self.conn.rollback()
                consent.record(self.cur, "dono@rest.com", kind="dono", purpose="termos", granted=True, version="2026-10-06", channel="site")

    def test_the_latest_answer_wins_in_the_real_table(self):
        email = "cliente@exemplo.com"
        self.assertFalse(consent.is_granted(self.cur, email, "alertas_email"))
        consent.record(self.cur, email, kind="candidato", purpose="alertas_email", granted=True, version="1", channel="site")
        self.assertTrue(consent.is_granted(self.cur, email, "alertas_email"))
        consent.record(self.cur, email, kind="candidato", purpose="alertas_email", granted=False, version="1", channel="email")
        self.assertFalse(consent.is_granted(self.cur, email, "alertas_email"))
        consent.record(self.cur, email, kind="candidato", purpose="alertas_email", granted=True, version="2", channel="site")
        self.assertTrue(consent.is_granted(self.cur, email, "alertas_email"))
        self.assertFalse(consent.is_granted(self.cur, email, "termos"))

    def test_the_table_keeps_no_email_and_refuses_bad_values(self):
        consent.record(self.cur, "a@b.com", kind="dono", purpose="termos", granted=True, version="1", channel="site", ip="1.2.3.4", secret="s")
        self.cur.execute("SELECT * FROM consent_records ORDER BY seq DESC LIMIT 1")
        row = self.cur.fetchone()
        self.assertNotIn("a@b.com", str(row))
        self.assertNotIn("1.2.3.4", str(row))
        with self.assertRaises(psycopg2.Error):
            self.cur.execute(consent.SQL_RECORD, ("nao-e-hash", "dono", "termos", True, "1", None, "site", None))

    # ---- lista de bloqueio e contato

    def test_a_new_company_contact_can_get_the_first_message(self):
        self.assertIsNotNone(self.add())
        self.assertTrue(o.check_contact(self.cur, "RH@empresa.com.br"))

    def test_the_same_address_is_only_added_once(self):
        self.assertIsNotNone(self.add())
        self.assertIsNone(self.add("RH@EMPRESA.com.br"))

    def test_the_database_refuses_a_contact_without_origin_or_that_is_not_a_company(self):
        base = ("a@b.com", o.email_hash("a@b.com"), "empresa", "anuncio_publico", "cartaz", "interesse_legitimo", False, "teste")
        sql = o.SQL_ADD_CONTACT
        for index, bad in ((2, "candidato"), (3, "lista_comprada"), (4, "x"), (5, "porque_sim")):
            with self.subTest(column=index):
                values = list(base)
                values[index] = bad
                with self.assertRaises(psycopg2.Error):
                    self.cur.execute(sql, values)
                self.conn.rollback()

    def test_unsubscribing_blocks_the_address_everywhere_and_for_good(self):
        self.add()
        o.suppress(self.cur, "rh@empresa.com.br", "pediu")
        o.suppress(self.cur, "RH@empresa.com.br", "pediu")  # repetir não dá erro
        self.assertEqual(o.check_contact(self.cur, "rh@empresa.com.br").reason, "na_lista_de_bloqueio")
        self.assertIsNone(self.add("rh@empresa.com.br"))

    def test_after_the_first_message_the_reminder_waits_five_days_and_the_third_is_the_last(self):
        self.add()
        self.cur.execute(o.SQL_CONTACT, (o.email_hash("rh@empresa.com.br"),))
        contact_id = self.cur.fetchone()["id"]
        o.register_outcome(self.cur, contact_id, "primeiro", "enviado")
        now = datetime.now(timezone.utc)
        self.assertEqual(o.check_contact(self.cur, "rh@empresa.com.br", now=now).reason, "cedo_demais_para_o_proximo")
        self.assertTrue(o.check_contact(self.cur, "rh@empresa.com.br", now=now + timedelta(days=6)))
        o.register_outcome(self.cur, contact_id, "lembrete", "enviado")
        o.register_outcome(self.cur, contact_id, "lembrete", "enviado")
        self.assertEqual(
            o.check_contact(self.cur, "rh@empresa.com.br", now=now + timedelta(days=30)).reason, "limite_de_envios_por_contato"
        )

    def test_a_complaint_freezes_all_sending_until_someone_checks(self):
        self.add()
        self.add("outra@empresa.com.br")
        self.cur.execute(o.SQL_CONTACT, (o.email_hash("rh@empresa.com.br"),))
        contact_id = self.cur.fetchone()["id"]
        self.assertTrue(o.check_contact(self.cur, "outra@empresa.com.br"))
        o.register_outcome(self.cur, contact_id, "primeiro", "enviado")
        reason = o.register_outcome(self.cur, contact_id, "primeiro", "reclamacao")
        self.assertEqual(reason, "reclamacoes_acima_de_0_3_por_cento")
        self.assertEqual(o.check_contact(self.cur, "outra@empresa.com.br").reason, "envio_congelado")

    def test_the_daily_limit_counts_in_the_real_table(self):
        self.add()
        self.add("novo@empresa.com.br")
        self.cur.execute(o.SQL_CONTACT, (o.email_hash("rh@empresa.com.br"),))
        contact_id = self.cur.fetchone()["id"]
        self.cur.execute(o.SQL_LOG, (contact_id, "primeiro", "enviado"))  # hoje passa a ser um dia de uso
        self.cur.execute(o.SQL_DAYS_IN_USE)
        limit = o.daily_limit(self.cur.fetchone()["n"])
        self.cur.execute(o.SQL_SENT_TODAY)
        sent = self.cur.fetchone()["n"]
        for _ in range(limit - sent):
            self.cur.execute(o.SQL_LOG, (contact_id, "lembrete", "enviado"))
        self.assertEqual(o.check_contact(self.cur, "novo@empresa.com.br").reason, "limite_do_dia")


if __name__ == "__main__":
    unittest.main()
