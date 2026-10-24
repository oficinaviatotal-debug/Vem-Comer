"""Trava de e-mail de divulgação (outreach.py) e prova de aceite (consent.py). Sem banco: cursor de mentira."""

import unittest
from datetime import datetime, timedelta, timezone

import consent
import outreach as o

NOW = datetime(2026, 10, 14, 15, 0, tzinfo=timezone.utc)
CONTACT = {"kind": "empresa", "source": "anuncio_publico", "legal_basis": "interesse_legitimo"}


def ask(contact=CONTACT, **overrides):
    base = dict(suppressed=False, sends_done=0, last_sent_at=None, sent_today=0, limit_today=20, frozen=False, now=NOW)
    base.update(overrides)
    return o.can_send(contact, **base)


class Cursor:
    """Responde a cada comando SQL pelo texto dele e guarda o que foi pedido."""

    def __init__(self, answers=None):
        self.answers = answers or {}
        self.calls = []
        self._row = None

    def execute(self, sql, args=()):
        self.calls.append((sql, args))
        self._row = None
        for key, value in self.answers.items():
            if key in sql:
                self._row = value(args) if callable(value) else value
                break

    def fetchone(self):
        return self._row

    def ran(self, fragment):
        return [args for sql, args in self.calls if fragment in sql]


class EmailTests(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(o.normalize_email("  Joao@Empresa.COM.br "), "joao@empresa.com.br")
        for bad in (None, 5, "", "sem-arroba", "a@b", "a b@c.com", "x" * 201 + "@a.com"):
            self.assertIsNone(o.normalize_email(bad), repr(bad))

    def test_the_fingerprint_ignores_case_and_spaces_and_is_stable(self):
        self.assertEqual(o.email_hash("Joao@Empresa.com"), o.email_hash(" joao@empresa.com "))
        # valor fixo: o Vem Trabalhar usa a mesma conta, então ela nunca pode mudar
        self.assertEqual(o.email_hash("a@b.co"), "80305c9bb1bb2480e03894350e0a8a366dcbdeb302e69e0817aa0743abd77054")
        self.assertEqual(len(o.email_hash("a@b.co")), 64)
        with self.assertRaises(ValueError):
            o.email_hash("lixo")

    def test_free_mail_and_mask(self):
        self.assertTrue(o.is_free_mail("dono@gmail.com"))
        self.assertFalse(o.is_free_mail("rh@cincos.eng.br"))
        self.assertEqual(o.mask_email("Joao@empresa.com.br"), "j***@empresa.com.br")
        self.assertEqual(o.mask_email("lixo"), "")


class UnsubscribeTokenTests(unittest.TestCase):
    def test_round_trip_and_tampering(self):
        token = o.unsubscribe_token("Joao@Empresa.com", "segredo")
        self.assertEqual(o.email_from_token(token, "segredo"), "joao@empresa.com")
        self.assertIsNone(o.email_from_token(token, "outro-segredo"))
        self.assertIsNone(o.email_from_token(token[:-2] + "xx", "segredo"))
        for bad in (None, "", 5, "a" * 700):
            self.assertIsNone(o.email_from_token(bad, "segredo"))

    def test_the_link_never_expires(self):
        token = o.unsubscribe_token("a@b.com", "s")
        self.assertEqual(o.email_from_token(token, "s"), "a@b.com")  # sem prazo: serializer sem tempo

    def test_headers_follow_rfc_8058(self):
        headers = o.unsubscribe_headers("https://vem.example/", "a@b.com", "s")
        self.assertTrue(headers["List-Unsubscribe"].startswith("<https://vem.example/api/descadastro?t="))
        self.assertTrue(headers["List-Unsubscribe"].endswith(">"))
        self.assertEqual(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")


class LimitTests(unittest.TestCase):
    def test_the_daily_limit_starts_low_and_grows_to_a_cap(self):
        self.assertEqual(o.daily_limit(0), 20)
        self.assertEqual(o.daily_limit(1), 25)
        self.assertGreater(o.daily_limit(5), o.daily_limit(4))
        self.assertEqual(o.daily_limit(1000), o.MAX_DAILY_LIMIT)
        self.assertEqual(o.daily_limit(-3), 20)

    def test_the_brake(self):
        self.assertIsNone(o.freeze_reason(0, 0, 0))
        self.assertIsNone(o.freeze_reason(1000, 3, 10))  # 0,3% e 1%
        self.assertEqual(o.freeze_reason(1000, 4, 0), "reclamacoes_acima_de_0_3_por_cento")
        self.assertEqual(o.freeze_reason(100, 0, 3), "devolvidos_acima_de_2_por_cento")
        self.assertEqual(o.freeze_reason(20, 1, 0), "reclamacoes_acima_de_0_3_por_cento")  # volume baixo: 1 reclamação já freia


class CanSendTests(unittest.TestCase):
    def test_a_good_first_contact_is_allowed(self):
        decision = ask()
        self.assertTrue(decision)
        self.assertEqual(decision.reason, "ok")

    def test_each_barrier_has_its_reason(self):
        self.assertEqual(ask(frozen=True).reason, "envio_congelado")
        self.assertEqual(ask(suppressed=True).reason, "na_lista_de_bloqueio")
        self.assertEqual(ask({**CONTACT, "kind": "candidato"}).reason, "so_empresa")
        self.assertEqual(ask({**CONTACT, "source": "lista_comprada"}).reason, "sem_origem_ou_base_legal")
        self.assertEqual(ask({**CONTACT, "legal_basis": None}).reason, "sem_origem_ou_base_legal")
        self.assertEqual(ask(sends_done=3).reason, "limite_de_envios_por_contato")
        self.assertEqual(ask(sent_today=20).reason, "limite_do_dia")

    def test_the_freeze_beats_everything_else(self):
        self.assertEqual(ask(frozen=True, suppressed=True).reason, "envio_congelado")

    def test_the_block_list_beats_a_good_contact(self):
        self.assertFalse(ask(suppressed=True))

    def test_reminders_wait_five_days(self):
        self.assertEqual(ask(sends_done=1, last_sent_at=NOW - timedelta(days=4, hours=23)).reason, "cedo_demais_para_o_proximo")
        self.assertTrue(ask(sends_done=1, last_sent_at=NOW - timedelta(days=5)))
        self.assertTrue(ask(sends_done=2, last_sent_at=NOW - timedelta(days=6)))

    def test_consent_basis_needs_a_granted_consent(self):
        contact = {**CONTACT, "source": "pedido_do_contato", "legal_basis": "consentimento"}
        self.assertEqual(ask(contact).reason, "sem_consentimento")
        self.assertTrue(ask(contact, consent_granted=True))

    def test_legitimate_interest_does_not_cover_a_contact_who_only_asked_for_something_else(self):
        contact = {**CONTACT, "source": "pedido_do_contato"}
        self.assertEqual(ask(contact).reason, "interesse_legitimo_nao_vale_para_esta_origem")


class ServiceTests(unittest.TestCase):
    def test_add_contact_requires_where_the_email_was_seen_and_only_companies(self):
        cur = Cursor({"INSERT INTO outreach_contacts": {"id": "id-1"}})
        ok = dict(source="anuncio_publico", source_note="cartaz de vaga publicado no Instagram", legal_basis="interesse_legitimo", added_by="gd")
        self.assertEqual(o.add_contact(cur, "RH@Empresa.com.br", **ok), "id-1")
        saved = cur.ran("INSERT INTO outreach_contacts")[0]
        self.assertEqual(saved[0], "rh@empresa.com.br")
        self.assertEqual(saved[6], False)  # não é e-mail gratuito
        for change in ({"source_note": "  "}, {"source": "lista_comprada"}, {"legal_basis": "outra"}, {"kind": "candidato"}):
            with self.assertRaises(ValueError, msg=str(change)):
                o.add_contact(cur, "a@b.com", **{**ok, **change})
        with self.assertRaises(ValueError):
            o.add_contact(cur, "lixo", **ok)

    def test_someone_on_the_block_list_cannot_come_back_through_another_door(self):
        cur = Cursor({"FROM email_suppression": {"found": 1}})
        ok = dict(source="indicacao", source_note="indicada por outra empresa", legal_basis="interesse_legitimo", added_by="gd")
        self.assertIsNone(o.add_contact(cur, "saiu@empresa.com", **ok))
        self.assertEqual(cur.ran("INSERT INTO outreach_contacts"), [])

    def test_suppress_stores_only_the_fingerprint(self):
        cur = Cursor()
        o.suppress(cur, "Saiu@Empresa.com", "pediu")
        args = cur.ran("INSERT INTO email_suppression")[0]
        self.assertEqual(args, (o.email_hash("saiu@empresa.com"), "pediu"))
        with self.assertRaises(ValueError):
            o.suppress(cur, "a@b.com", "porque sim")

    def test_check_contact_uses_what_the_database_knows(self):
        contact = {"id": "c1", "email": "a@b.com", "kind": "empresa", "source": "anuncio_publico", "legal_basis": "interesse_legitimo"}
        answers = {
            "FROM outreach_contacts": contact,
            "FROM email_controle": {"congelado": False},
            "FROM outreach_log WHERE contact_id": {"n": 0, "last_at": None},
            "AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE": {"n": 0},
            "count(DISTINCT": {"n": 0},
        }
        self.assertTrue(o.check_contact(Cursor(answers), "a@b.com", now=NOW))
        self.assertEqual(o.check_contact(Cursor({**answers, "FROM email_suppression": {"found": 1}}), "a@b.com", now=NOW).reason, "na_lista_de_bloqueio")
        self.assertEqual(o.check_contact(Cursor({**answers, "FROM email_controle": {"congelado": True}}), "a@b.com", now=NOW).reason, "envio_congelado")
        self.assertEqual(o.check_contact(Cursor({**answers, "FROM outreach_contacts": None}), "a@b.com", now=NOW).reason, "contato_nao_cadastrado")
        self.assertEqual(o.check_contact(Cursor(answers), "lixo", now=NOW).reason, "email_invalido")

    def test_a_complaint_freezes_the_sending(self):
        cur = Cursor({"count(*) FILTER": {"sent": 40, "complaints": 1, "bounces": 0}})
        self.assertEqual(o.register_outcome(cur, "c1", "primeiro", "reclamacao"), "reclamacoes_acima_de_0_3_por_cento")
        self.assertEqual(len(cur.ran("UPDATE email_controle")), 1)

    def test_a_healthy_week_does_not_freeze(self):
        cur = Cursor({"count(*) FILTER": {"sent": 1000, "complaints": 1, "bounces": 5}})
        self.assertIsNone(o.register_outcome(cur, "c1", "primeiro", "enviado"))
        self.assertEqual(cur.ran("UPDATE email_controle"), [])


class ConsentTests(unittest.TestCase):
    def test_record_stores_fingerprints_not_the_email_nor_the_ip(self):
        cur = Cursor()
        consent.record(cur, "Dono@Rest.com", kind="dono", purpose="termos", granted=True, version="2026-10-06",
                       channel="site", document_sha256=consent.text_sha256("texto"), ip="10.1.2.3", secret="s")
        args = cur.ran("INSERT INTO consent_records")[0]
        self.assertEqual(args[0], o.email_hash("dono@rest.com"))
        self.assertNotIn("dono@rest.com", str(args))
        self.assertNotIn("10.1.2.3", str(args))
        self.assertEqual(len(args[7]), 64)

    def test_unknown_values_are_refused_before_touching_the_database(self):
        cur = Cursor()
        base = dict(kind="dono", purpose="termos", granted=True, version="1", channel="site")
        for change in ({"kind": "rei"}, {"purpose": "tudo"}, {"channel": "telepatia"}, {"granted": "sim"}, {"version": ""}):
            with self.assertRaises(ValueError, msg=str(change)):
                consent.record(cur, "a@b.com", **{**base, **change})
        self.assertEqual(cur.calls, [])

    def test_the_latest_answer_is_the_one_that_counts(self):
        self.assertTrue(consent.is_granted(Cursor({"FROM consent_records": {"granted": True}}), "a@b.com", "termos"))
        self.assertFalse(consent.is_granted(Cursor({"FROM consent_records": {"granted": False}}), "a@b.com", "termos"))
        self.assertFalse(consent.is_granted(Cursor({"FROM consent_records": None}), "a@b.com", "termos"))
        self.assertIn("ORDER BY seq DESC", consent.SQL_LATEST)
        with self.assertRaises(ValueError):
            consent.is_granted(Cursor(), "a@b.com", "outra")

    def test_unsubscribing_withdraws_every_email_consent(self):
        cur = Cursor()
        consent.withdraw_email_consents(cur, "a@b.com", kind="contato", version="descadastro")
        rows = cur.ran("INSERT INTO consent_records")
        self.assertEqual([r[2] for r in rows], list(consent.EMAIL_PURPOSES))
        self.assertTrue(all(r[3] is False for r in rows))


class MigrationTests(unittest.TestCase):
    def test_the_migration_matches_the_code(self):
        import os

        # A 018 cria as tabelas; migrações seguintes podem ampliar a lista de finalidades (a 021 acrescenta o contato comercial).
        folder = os.path.join(os.path.dirname(__file__), "..", "database", "migrations")
        sql = ""
        for name in ("018_conformidade.sql", "021_vendas_do_vem.sql"):
            if os.path.exists(os.path.join(folder, name)):
                with open(os.path.join(folder, name), encoding="utf-8") as handle:
                    sql += handle.read()
        for value in consent.PURPOSES + consent.KINDS + consent.CHANNELS + o.SOURCES + o.LEGAL_BASES + o.SUPPRESSION_REASONS:
            self.assertIn(f"'{value}'", sql, value)
        for trigger in ("BEFORE UPDATE OR DELETE ON consent_records", "BEFORE TRUNCATE ON consent_records"):
            self.assertIn(trigger, sql)
        self.assertNotIn("DROP TABLE", sql.upper())


if __name__ == "__main__":
    unittest.main()
