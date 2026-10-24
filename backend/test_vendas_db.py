"""Prova no PostgreSQL de verdade: a migração 021 (máquina de vendas do Vem).

Roda só com VEM_TEST_DATABASE_URL (fluxo .github/workflows/compliance.yml). Cada teste trabalha dentro de uma
transação desfeita no fim: o banco não fica sujo.
"""

import os
import unittest
from datetime import datetime, timedelta, timezone

import consent
import outreach
import vendas as v

URL = os.getenv("VEM_TEST_DATABASE_URL")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover
    psycopg2 = None

PHONE = "(84) 99999-8888"
EMAIL = "dono@pastelariadoze.com.br"


def record(**over):
    data = dict(
        business_name="Pastelaria do Zé", business_kind="pastelaria", city="Natal", phone=PHONE, email=EMAIL,
        source="anuncio_publico", source_note="Anúncio no Instagram da pastelaria",
    )
    data.update(over)
    return data


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar os testes de banco")
class VendasBancoTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg2.connect(URL)
        self.cur = self.conn.cursor(cursor_factory=RealDictCursor)

    def tearDown(self):
        self.conn.rollback()
        self.cur.close()
        self.conn.close()

    def add(self, **over):
        result = v.add_prospect(self.cur, record(**over), "gd")
        self.assertTrue(result["created"], result)
        return result["id"]

    def row(self, prospect_id):
        self.cur.execute("SELECT * FROM sales_prospects WHERE id = %s", (prospect_id,))
        return self.cur.fetchone()

    def history(self, prospect_id):
        self.cur.execute("SELECT kind, channel, detail, by_user FROM sales_events WHERE prospect_id = %s ORDER BY seq", (prospect_id,))
        return self.cur.fetchall()

    def age(self, prospect_id, days):
        """Faz de conta que o último contato foi há `days` dias."""
        self.cur.execute(
            "UPDATE sales_prospects SET last_touch_at = now() - make_interval(days => %s), stage_since = now() - make_interval(days => %s) WHERE id = %s",
            (days, days, prospect_id),
        )

    # ---- entrar na lista

    def test_a_record_enters_with_its_origin_and_a_history(self):
        prospect_id = self.add()
        row = self.row(prospect_id)
        self.assertEqual((row["stage"], row["touches"], row["source"], row["phone"]), ("achado", 0, "anuncio_publico", "5584999998888"))
        self.assertEqual(row["phone_hash"], v.phone_hash(PHONE))
        self.assertEqual(row["email_hash"], outreach.email_hash(EMAIL))
        self.assertEqual([e["kind"] for e in self.history(prospect_id)], ["criado"])

    def test_the_same_phone_or_email_does_not_enter_twice(self):
        first = self.add()
        again = v.add_prospect(self.cur, record(business_name="Outro nome", email=None), "gd")
        self.assertEqual((again["id"], again["created"], again["reason"]), (first, False, "ja_existe"))
        by_mail = v.add_prospect(self.cur, record(phone="(84) 98888-7777"), "gd")
        self.assertEqual((by_mail["id"], by_mail["reason"]), (first, "ja_existe"))

    def test_the_database_itself_refuses_a_second_row_with_the_same_phone(self):
        self.add()
        with self.assertRaises(psycopg2.errors.UniqueViolation):
            self.cur.execute(
                "INSERT INTO sales_prospects (business_name, business_kind, city, phone, phone_hash, source, source_note, added_by) "
                "VALUES ('Outro', 'bar', 'Natal', '5584999998888', %s, 'visita', 'conversa', 'gd')",
                (v.phone_hash(PHONE),),
            )

    def test_the_database_refuses_nonsense(self):
        for column, value in (("stage", "voando"), ("business_kind", "cassino"), ("source", "lista_comprada"), ("phone", "84999998888"), ("email", "MAIUSCULA@X.COM")):
            self.conn.rollback()
            columns = dict(business_name="X Bar", business_kind="bar", city="Natal", source="visita", source_note="conversa", added_by="gd")
            columns[column] = value
            names = ", ".join(columns)
            holders = ", ".join(["%s"] * len(columns))
            with self.assertRaises(psycopg2.errors.CheckViolation, msg=column):
                self.cur.execute(f"INSERT INTO sales_prospects ({names}) VALUES ({holders})", tuple(columns.values()))

    # ---- falar com o negócio

    def test_a_touch_moves_to_called_counts_and_starts_the_wait(self):
        prospect_id = self.add()
        v.record_touch(self.cur, prospect_id, "whatsapp", "gd")
        row = self.row(prospect_id)
        self.assertEqual((row["stage"], row["touches"], row["whatsapp_touches"], row["last_channel"]), ("chamado", 1, 1, "whatsapp"))
        self.assertIsNotNone(row["last_touch_at"])
        with self.assertRaises(v.ProspectError) as caught:
            v.record_touch(self.cur, prospect_id, "whatsapp", "gd")
        self.assertIn("Cedo demais", caught.exception.message)
        self.assertEqual(self.row(prospect_id)["touches"], 1)

    def test_the_limits_hold_in_the_real_table(self):
        prospect_id = self.add()
        for channel in ("whatsapp", "whatsapp", "email"):
            self.age(prospect_id, 10)
            v.record_touch(self.cur, prospect_id, channel, "gd")
        self.assertEqual(self.row(prospect_id)["touches"], 3)
        self.age(prospect_id, 10)
        with self.assertRaises(v.ProspectError) as caught:
            v.record_touch(self.cur, prospect_id, "email", "gd")
        self.assertIn("3 contatos", caught.exception.message)
        self.assertEqual(self.row(prospect_id)["whatsapp_touches"], 2)

    # ---- o que a pessoa respondeu

    def test_an_interested_reply_moves_the_stage_and_keeps_only_the_class(self):
        prospect_id = self.add()
        v.record_touch(self.cur, prospect_id, "whatsapp", "gd")
        result = v.record_reply(self.cur, prospect_id, "gd", text="Tenho interesse, pode me mostrar?")
        self.assertEqual((result["result"], result["stage"]), ("interessado", "respondeu"))
        row = self.row(prospect_id)
        self.assertEqual((row["stage"], row["reply_kind"]), ("respondeu", "interessado"))
        self.assertIsNotNone(row["replied_at"])
        story = self.history(prospect_id)
        self.assertEqual([e["kind"] for e in story], ["criado", "mensagem", "resposta"])
        self.assertEqual(story[-1]["detail"], "interessado")
        for column in row.keys():
            self.assertNotIn("reply_text", column)

    def test_saying_no_blocks_everywhere_and_wipes_the_person_from_the_record(self):
        prospect_id = self.add()
        v.record_touch(self.cur, prospect_id, "whatsapp", "gd")
        v.record_reply(self.cur, prospect_id, "gd", text="Não quero, obrigado")
        row = self.row(prospect_id)
        self.assertEqual(row["stage"], "nao_quer")
        for column in ("contact_person", "phone", "phone_hash", "email", "email_hash", "instagram", "site", "note", "snooze_until"):
            self.assertIsNone(row[column], column)
        self.assertEqual(row["business_name"], "Pastelaria do Zé")  # o negócio fica para a conta de qual origem funciona
        self.cur.execute("SELECT reason FROM phone_suppression WHERE phone_hash = %s", (v.phone_hash(PHONE),))
        self.assertEqual(self.cur.fetchone()["reason"], "pediu")
        self.cur.execute("SELECT reason FROM email_suppression WHERE email_hash = %s", (outreach.email_hash(EMAIL),))
        self.assertEqual(self.cur.fetchone()["reason"], "pediu")

    def test_someone_who_said_no_does_not_come_back_by_another_door(self):
        prospect_id = self.add()
        v.record_no(self.cur, prospect_id, "gd")
        for data in (record(), record(email=None, phone="+55 84 99999 8888"), record(phone=None)):
            result = v.add_prospect(self.cur, data, "gd")
            self.assertEqual((result["created"], result["reason"]), (False, "na_lista_de_bloqueio"))
        # e o e-mail para empresas (outreach) também não aceita mais esse endereço
        self.assertIsNone(outreach.add_contact(self.cur, EMAIL, source="anuncio_publico", source_note="outro anúncio", legal_basis="interesse_legitimo", added_by="gd"))

    def test_a_blocked_email_from_the_unsubscribe_link_also_blocks_a_new_record(self):
        outreach.suppress(self.cur, EMAIL, "pediu")
        result = v.add_prospect(self.cur, record(phone=None), "gd")
        self.assertEqual(result["reason"], "na_lista_de_bloqueio")

    def test_later_snoozes_and_the_record_leaves_the_day_list(self):
        prospect_id = self.add()
        v.record_touch(self.cur, prospect_id, "whatsapp", "gd")
        self.age(prospect_id, 8)
        self.assertEqual([item["id"] for item in v.overview(self.cur)["today"]["items"] if item["id"] == prospect_id], [prospect_id])
        v.record_reply(self.cur, prospect_id, "gd", text="agora não, me chama mais tarde")
        self.assertIsNotNone(self.row(prospect_id)["snooze_until"])
        self.assertEqual([item["id"] for item in v.overview(self.cur)["today"]["items"] if item["id"] == prospect_id], [])

    # ---- pedido de contato pelo formulário do site

    def form(self, **over):
        data = dict(business_name="Sorveteria Gelo Bom", business_kind="sorveteria", city="Natal", phone="(84) 98888-7777", consent=True)
        data.update(over)
        return data

    def proofs(self, subject_hash):
        self.cur.execute("SELECT purpose, granted, document_version, document_sha256, channel, ip_hash FROM consent_records WHERE subject_hash = %s ORDER BY seq", (subject_hash,))
        return self.cur.fetchall()

    def test_a_form_request_enters_at_the_top_and_leaves_proof_with_the_text_fingerprint(self):
        result = v.add_inbound(self.cur, self.form(), ip="10.1.2.3", secret="segredo")
        self.assertTrue(result["created"])
        row = self.row(result["id"])
        self.assertEqual((row["stage"], row["reply_kind"], row["source"], row["added_by"]), ("respondeu", "interessado", "formulario_do_site", "formulario"))
        self.assertIsNotNone(row["replied_at"])
        proof = self.proofs(v.phone_hash("(84) 98888-7777"))
        self.assertEqual(len(proof), 1)
        self.assertEqual((proof[0]["purpose"], proof[0]["granted"], proof[0]["channel"]), ("contato_comercial", True, "site"))
        self.assertEqual(proof[0]["document_sha256"], consent.text_sha256(v.INTEREST_CONSENT_TEXT))
        self.assertNotIn("10.1.2.3", str(proof))
        self.assertEqual([e["kind"] for e in self.history(result["id"])], ["criado", "resposta"])
        first = v.overview(self.cur)["today"]["items"][0]
        self.assertEqual((first["id"], first["move"]["action"]), (result["id"], "responder"))

    def test_the_second_request_with_the_same_phone_reopens_instead_of_duplicating(self):
        first = v.add_inbound(self.cur, self.form())
        self.cur.execute("UPDATE sales_prospects SET stage = 'sem_resposta' WHERE id = %s", (first["id"],))
        again = v.add_inbound(self.cur, self.form(business_name="Outro nome"))
        self.assertEqual((again["id"], again["created"], again["reason"]), (first["id"], False, "ja_existe"))
        self.assertEqual(self.row(first["id"])["stage"], "respondeu")
        self.assertEqual(len(self.proofs(v.phone_hash("(84) 98888-7777"))), 2)

    def test_a_blocked_phone_cannot_use_the_form_and_leaves_no_trace(self):
        self.cur.execute("INSERT INTO phone_suppression (phone_hash, reason) VALUES (%s, 'pediu')", (v.phone_hash("(84) 98888-7777"),))
        result = v.add_inbound(self.cur, self.form())
        self.assertEqual((result["id"], result["reason"]), (None, "na_lista_de_bloqueio"))
        self.assertEqual(self.proofs(v.phone_hash("(84) 98888-7777")), [])
        self.cur.execute("SELECT count(*) AS n FROM sales_prospects WHERE business_name = 'Sorveteria Gelo Bom'")
        self.assertEqual(self.cur.fetchone()["n"], 0)

    def test_the_consent_log_stays_append_only_with_the_new_purpose(self):
        v.add_inbound(self.cur, self.form())
        with self.assertRaises(psycopg2.errors.RaiseException):
            self.cur.execute("UPDATE consent_records SET granted = false WHERE purpose = 'contato_comercial'")

    # ---- etapas

    def test_the_stage_walks_forward_and_never_back(self):
        prospect_id = self.add()
        for stage in ("chamado", "respondeu", "demonstracao", "cadastrou", "pagando"):
            v.set_stage(self.cur, prospect_id, stage, "gd")
            self.assertEqual(self.row(prospect_id)["stage"], stage)
        with self.assertRaises(v.ProspectError):
            v.set_stage(self.cur, prospect_id, "chamado", "gd")
        self.assertEqual([e["detail"] for e in self.history(prospect_id) if e["kind"] == "etapa"], ["chamado", "respondeu", "demonstracao", "cadastrou", "pagando"])

    # ---- apagar

    def test_forgetting_removes_the_record_and_its_history_and_keeps_only_fingerprints(self):
        prospect_id = self.add()
        v.record_touch(self.cur, prospect_id, "whatsapp", "gd")
        v.forget_prospect(self.cur, prospect_id)
        self.assertIsNone(self.row(prospect_id))
        self.assertEqual(self.history(prospect_id), [])
        self.cur.execute("SELECT reason FROM phone_suppression WHERE phone_hash = %s", (v.phone_hash(PHONE),))
        self.assertEqual(self.cur.fetchone()["reason"], "titular")
        self.cur.execute("SELECT reason FROM email_suppression WHERE email_hash = %s", (outreach.email_hash(EMAIL),))
        self.assertEqual(self.cur.fetchone()["reason"], "titular")

    def test_the_24_month_guard_removes_closed_records_and_keeps_the_living_ones(self):
        closed = self.add()
        living = self.add(business_name="Pizzaria Viva", phone="(84) 98888-7777", email=None)
        paying = self.add(business_name="Bar Pagante", phone="(84) 97777-6666", email=None)
        self.cur.execute("UPDATE sales_prospects SET stage = 'sem_resposta' WHERE id = %s", (closed,))
        self.cur.execute("UPDATE sales_prospects SET stage = 'pagando' WHERE id = %s", (paying,))
        self.cur.execute("UPDATE sales_prospects SET updated_at = now() - interval '30 months'")
        self.assertEqual(v.purge_old(self.cur), 1)
        self.assertIsNone(self.row(closed))
        self.assertIsNotNone(self.row(living))
        self.assertIsNotNone(self.row(paying))

    # ---- a tela

    def test_the_overview_reads_the_real_tables(self):
        first = self.add()
        self.add(business_name="Sorveteria Gelo Bom", business_kind="sorveteria", phone="(84) 98888-7777", email=None)
        v.record_touch(self.cur, first, "whatsapp", "gd")
        overview = v.overview(self.cur)
        self.assertGreaterEqual(overview["today"]["touches_today"], 1)
        self.assertGreaterEqual(overview["funnel"]["total"], 2)
        names = [item["business_name"] for item in overview["today"]["items"]]
        self.assertIn("Sorveteria Gelo Bom", names)

    def test_touches_today_counts_only_messages(self):
        prospect_id = self.add()
        before = v.touches_today(self.cur)
        v.record_touch(self.cur, prospect_id, "whatsapp", "gd")
        v.set_stage(self.cur, prospect_id, "respondeu", "gd")
        self.assertEqual(v.touches_today(self.cur), before + 1)

    def test_a_blocked_number_shows_as_suppressed_in_the_list(self):
        prospect_id = self.add()
        self.cur.execute("INSERT INTO phone_suppression (phone_hash, reason) VALUES (%s, 'pediu')", (v.phone_hash(PHONE),))
        self.cur.execute(v.SQL_LIST)
        row = next(r for r in self.cur.fetchall() if str(r["id"]) == prospect_id)
        self.assertTrue(row["suppressed"])
        self.assertEqual([item["id"] for item in v.overview(self.cur)["today"]["items"] if item["id"] == prospect_id], [])

    def test_the_company_link_survives_and_is_cleared_when_the_company_goes(self):
        prospect_id = self.add()
        self.cur.execute("INSERT INTO companies (name, slug) VALUES ('Pastelaria do Zé', 'pastelaria-do-ze-vendas-teste') RETURNING id")
        company = self.cur.fetchone()["id"]
        self.cur.execute("UPDATE sales_prospects SET company_id = %s WHERE id = %s", (company, prospect_id))
        self.cur.execute("DELETE FROM companies WHERE id = %s", (company,))
        self.assertIsNone(self.row(prospect_id)["company_id"])


if __name__ == "__main__":
    unittest.main()
