"""Pedidos do titular (titular.py): regras de validação, prazo, protocolo e código. Sem banco (o banco está em
test_titular_db.py)."""

import unittest
from datetime import datetime, timedelta, timezone

import titular

NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)


def pedido(**extra):
    data = {"kind": "acesso", "contact": "ana@exemplo.com"}
    data.update(extra)
    return data


class FakeCursor:
    def __init__(self, rows=()):
        self.executed = []
        self.rows = list(rows)
        self.rowcount = 1

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def fetchall(self):
        rows, self.rows = self.rows, []
        return rows


class ValidationTests(unittest.TestCase):
    def fails(self, field, status=400, **extra):
        with self.assertRaises(titular.RequestError) as caught:
            titular.validate_request(pedido(**extra))
        self.assertEqual(caught.exception.field, field)
        self.assertEqual(caught.exception.status, status)

    def test_a_simple_request_is_clean(self):
        clean = titular.validate_request(pedido(contact=" Ana@Exemplo.COM "))
        self.assertEqual(clean["kind"], "acesso")
        self.assertEqual(clean["contact"], "ana@exemplo.com")
        self.assertRegex(clean["subject_hash"], r"^[0-9a-f]{64}$")
        self.assertIsNone(clean["target_url"])

    def test_a_phone_works_as_contact_and_has_no_email_fingerprint(self):
        clean = titular.validate_request(pedido(contact="(84) 99999-1234"))
        self.assertEqual(clean["contact"], "5584999991234")
        self.assertIsNone(clean["subject_hash"])

    def test_the_kind_must_be_one_of_the_known_ones(self):
        self.fails("kind", kind="hackear")
        self.fails("kind", kind=None)
        for kind in titular.KINDS:
            self.assertIn(kind, titular.KIND_LABELS)

    def test_contact_is_required_except_for_anonymous_reports(self):
        self.fails("contact", contact="")
        self.fails("contact", contact="nao-e-contato")
        self.fails("contact", contact="a@b")
        clean = titular.validate_request({"kind": "denuncia", "target_url": "https://x.exemplo/m", "description": "golpe no cardapio"})
        self.assertIsNone(clean["contact"])

    def test_some_requests_need_a_description(self):
        for kind in ("correcao", "revogacao", "oposicao", "revisao_decisao", "duvida"):
            self.fails("description", kind=kind, description="curto")
            self.assertEqual(titular.validate_request(pedido(kind=kind, description="Meu nome esta escrito errado"))["kind"], kind)
        for kind in ("acesso", "eliminacao", "portabilidade", "informacao_compartilhamento"):
            self.assertIsNone(titular.validate_request(pedido(kind=kind))["description"])

    def test_a_report_needs_to_say_where_the_content_is_and_what_is_wrong(self):
        with self.assertRaises(titular.RequestError) as caught:
            titular.validate_request({"kind": "denuncia", "description": "tem golpe aqui no cardapio"})
        self.assertEqual(caught.exception.field, "target_url")
        with self.assertRaises(titular.RequestError) as caught:
            titular.validate_request({"kind": "denuncia", "target_url": "https://x.exemplo/m", "description": "x"})
        self.assertEqual(caught.exception.field, "description")

    def test_the_report_reason_is_kept_in_the_text_and_unknown_reasons_become_other(self):
        base = {"kind": "denuncia", "target_url": "https://x.exemplo/m", "description": "foto minha sem permissao"}
        self.assertIn("Golpe ou fraude", titular.validate_request({**base, "reason": "golpe"})["description"])
        self.assertIn("Outro motivo", titular.validate_request({**base, "reason": "<script>"})["description"])

    def test_the_hidden_robot_field_refuses(self):
        with self.assertRaises(titular.RequestError):
            titular.validate_request(pedido(website="http://spam.exemplo"))

    def test_text_is_cleaned_and_cut(self):
        clean = titular.validate_request(pedido(kind="duvida", description="Oi\x00 \x07tudo   bem?\r\n\r\n\r\n\r\nPreciso de ajuda"))
        self.assertNotIn("\x00", clean["description"])
        self.assertNotIn("\x07", clean["description"])
        self.assertNotIn("\n\n\n", clean["description"])
        long = titular.validate_request(pedido(kind="duvida", description="a" * 9000))
        self.assertEqual(len(long["description"]), titular.DESCRIPTION_MAX)

    def test_a_logged_in_request_uses_the_account_email(self):
        clean = titular.validate_request({"kind": "eliminacao"}, verified_email="dono@saiteria.com.br")
        self.assertEqual(clean["contact"], "dono@saiteria.com.br")

    def test_not_a_dict(self):
        with self.assertRaises(titular.RequestError):
            titular.validate_request(["x"])


class ProtocolAndDeadlineTests(unittest.TestCase):
    def test_protocol_format(self):
        self.assertRegex(titular.new_protocol(NOW), r"^VC-2026-[0-9A-F]{8}$")
        self.assertNotEqual(titular.new_protocol(NOW), titular.new_protocol(NOW))
        self.assertTrue(titular.PROTOCOL_RE.match(titular.new_protocol(NOW)))

    def test_deadlines(self):
        self.assertEqual(titular.due_at("acesso", NOW), NOW + timedelta(days=15))  # LGPD art. 19, II
        self.assertEqual(titular.due_at("eliminacao", NOW), NOW + timedelta(days=15))
        self.assertEqual(titular.due_at("denuncia", NOW), NOW + timedelta(hours=48))

    def test_the_code_is_long_unique_and_only_its_fingerprint_matches(self):
        a, b = titular.new_token(), titular.new_token()
        self.assertNotEqual(a, b)
        self.assertGreaterEqual(len(a), 20)
        self.assertTrue(titular.token_matches(a, titular.token_hash(a)))
        self.assertFalse(titular.token_matches(b, titular.token_hash(a)))
        for bad in (None, "", 5, "x" * 500):
            self.assertFalse(titular.token_matches(bad, titular.token_hash(a)))
        self.assertFalse(titular.token_matches(a, None))


class CreateTests(unittest.TestCase):
    def test_create_writes_the_request_and_its_first_event_and_returns_the_code_once(self):
        cur = FakeCursor([{"id": "id-1", "protocol": "VC-2026-AAAAAAAA", "due_at": NOW + timedelta(days=15)}])
        made = titular.create(cur, titular.validate_request(pedido()), now=NOW, protocol_factory=lambda now: "VC-2026-AAAAAAAA")
        self.assertEqual(made["protocol"], "VC-2026-AAAAAAAA")
        insert_params = cur.executed[0][1]
        self.assertNotIn(made["token"], insert_params)                    # o código não é guardado
        self.assertIn(titular.token_hash(made["token"]), insert_params)   # só a impressão digital
        self.assertEqual(cur.executed[1][1], ("id-1", "recebida", None))

    def test_a_logged_in_request_also_records_the_identity_check(self):
        cur = FakeCursor([{"id": "id-1", "protocol": "VC-2026-AAAAAAAA", "due_at": NOW}])
        titular.create(cur, titular.validate_request({"kind": "eliminacao"}, verified_email="a@b.com"), channel="painel",
                       identity_verified=True, now=NOW, protocol_factory=lambda now: "VC-2026-AAAAAAAA")
        events = [params for _, params in cur.executed[1:]]
        self.assertEqual(events, [("id-1", "recebida", None), ("id-1", "identidade_conferida", "Pedido feito dentro da conta, com login.")])

    def test_a_taken_protocol_is_tried_again(self):
        cur = FakeCursor([None, None, {"id": "id-1", "protocol": "VC-2026-BBBBBBBB", "due_at": NOW}])
        protocols = iter(["VC-2026-AAAAAAAA", "VC-2026-AAAAAAAA", "VC-2026-BBBBBBBB"])
        made = titular.create(cur, titular.validate_request(pedido()), now=NOW, protocol_factory=lambda now: next(protocols))
        self.assertEqual(made["protocol"], "VC-2026-BBBBBBBB")

    def test_it_gives_up_after_a_few_tries(self):
        cur = FakeCursor([None] * 10)
        with self.assertRaises(RuntimeError):
            titular.create(cur, titular.validate_request(pedido()), now=NOW, protocol_factory=lambda now: "VC-2026-AAAAAAAA")


class AnswerTests(unittest.TestCase):
    def test_answering_or_denying_needs_text_and_denial_needs_a_reason(self):
        for status in ("respondida", "negada"):
            with self.assertRaises(titular.RequestError) as caught:
                titular.answer(FakeCursor(), "id-1", status, "")
            self.assertEqual(caught.exception.field, "response")

    def test_unknown_status(self):
        with self.assertRaises(titular.RequestError):
            titular.answer(FakeCursor(), "id-1", "apagada", "ok ok ok")

    def test_unknown_request(self):
        with self.assertRaises(titular.RequestError) as caught:
            titular.answer(FakeCursor([None]), "id-1", "em_analise", "")
        self.assertEqual(caught.exception.status, 404)

    def test_a_good_answer_updates_and_logs(self):
        cur = FakeCursor([{"id": "id-1", "kind": "acesso", "status": "recebida", "contact": "a@b.com", "identity_verified": False}])
        titular.answer(cur, "id-1", "respondida", "Enviamos a copia.", identity_verified=True)
        events = [p for s, p in cur.executed if "data_request_events" in s]
        self.assertEqual([e[1] for e in events], ["identidade_conferida", "respondida"])


class OpenListTests(unittest.TestCase):
    def test_hours_left_and_overdue(self):
        rows = [
            {"id": "1", "protocol": "VC-2026-AAAAAAAA", "kind": "acesso", "channel": "site", "contact": "a@b.com", "description": None,
             "target_url": None, "identity_verified": False, "status": "recebida", "due_at": NOW - timedelta(hours=3), "created_at": NOW},
            {"id": "2", "protocol": "VC-2026-BBBBBBBB", "kind": "denuncia", "channel": "site", "contact": None, "description": "x",
             "target_url": "u", "identity_verified": False, "status": "em_analise", "due_at": NOW + timedelta(hours=40), "created_at": NOW},
        ]
        items = titular.list_open(FakeCursor(rows), now=NOW)
        self.assertTrue(items[0]["overdue"])
        self.assertFalse(items[1]["overdue"])
        self.assertEqual(items[1]["hours_left"], 40)


if __name__ == "__main__":
    unittest.main()
