"""Regras do registro de ações e da fila de aprovação (approvals.py). Não precisa de banco nem de Flask."""

import json
import unittest
from datetime import date
from unittest.mock import MagicMock

import approvals as a

TODAY = date(2026, 10, 15)
ACTION_ID = "77777777-7777-4777-8777-777777777777"
OWNER = "99999999-9999-4999-8999-999999999999"

EVIDENCE = [{"fact": "O advogado ainda não revisou o e-mail para empresas", "source": "docs/agentes-e-aprendizado.md, item 8", "date": "2026-10-15"}]


def proposal(**extra):
    data = {
        "agent": "captacao",
        "kind": "nova_origem_de_contatos",
        "title": "Usar o cadastro público de CNPJ como origem",
        "what": "Incluir a base aberta da Receita Federal (RN, CNAE 55 e 56) como origem de contatos de empresas.",
        "why": "É a única fonte que dá a lista completa de bares, restaurantes e hotéis do estado.",
        "risk": "Muda regra de conformidade: o interesse legítimo precisa da revisão do advogado.",
        "if_refused": "A lista continua só com anúncio público, site da empresa e indicação.",
        "evidence": EVIDENCE,
    }
    data.update(extra)
    return data


def record(**extra):
    data = {
        "agent": "sucesso",
        "kind": "resumo_semanal",
        "title": "Resumo da semana montado",
        "what": "Montei o resumo com três ações para a Cantina da Dona Rosa.",
        "result": "Resumo guardado no painel. Nada foi enviado.",
    }
    data.update(extra)
    return data


class FakeCursor:
    """Guarda o que foi executado e devolve as respostas na ordem combinada."""

    def __init__(self, answers=()):
        self.calls = []
        self.answers = list(answers)

    def execute(self, sql, args=()):
        self.calls.append((" ".join(sql.split()), args))

    def fetchone(self):
        return self.answers.pop(0) if self.answers else None

    def sql(self, start):
        return [c for c in self.calls if c[0].startswith(start)]


class ProposalRules(unittest.TestCase):
    def test_a_complete_card_is_accepted_and_is_level_three(self):
        card = a.clean_proposal(proposal())
        self.assertEqual(card["level"], 3)
        self.assertEqual(card["agent"], "captacao")
        self.assertEqual(card["evidence"], EVIDENCE)

    def test_the_card_needs_what_why_risk_and_what_if_refused(self):
        for key in ("title", "what", "why", "risk", "if_refused"):
            with self.subTest(key=key):
                with self.assertRaises(a.ApprovalError) as raised:
                    a.clean_proposal(proposal(**{key: "  "}))
                self.assertEqual(raised.exception.status, 400)

    def test_without_evidence_it_does_not_enter_the_queue(self):
        for evidence in ([], None, "texto"):
            with self.subTest(evidence=evidence):
                with self.assertRaises(a.ApprovalError):
                    a.clean_proposal(proposal(evidence=evidence))

    def test_every_fact_needs_a_source_and_a_date(self):
        base = EVIDENCE[0]
        bad = [
            {**base, "source": ""},
            {**base, "source": None},
            {**base, "date": ""},
            {**base, "date": "15/10/2026"},
            {**base, "date": "2026-13-45"},
            {**base, "fact": "ok"},
            "um fato solto",
        ]
        for item in bad:
            with self.subTest(item=item):
                with self.assertRaises(a.ApprovalError):
                    a.clean_evidence([item], today=TODAY)

    def test_a_fact_dated_in_the_future_is_refused(self):
        with self.assertRaises(a.ApprovalError) as raised:
            a.clean_evidence([{**EVIDENCE[0], "date": "2026-12-31"}], today=TODAY)
        self.assertIn("futuro", raised.exception.message)
        # amanhã ainda passa: o servidor pode estar à frente do relógio do Brasil
        a.clean_evidence([{**EVIDENCE[0], "date": "2026-10-16"}], today=TODAY)

    def test_the_evidence_is_cut_to_the_known_fields_and_limited(self):
        item = {**EVIDENCE[0], "extra": "<script>x</script>"}
        self.assertEqual(a.clean_evidence([item], today=TODAY), EVIDENCE)
        with self.assertRaises(a.ApprovalError):
            a.clean_evidence([EVIDENCE[0]] * (a.EVIDENCE_MAX + 1), today=TODAY)

    def test_text_that_is_too_long_is_refused_not_silently_cut(self):
        with self.assertRaises(a.ApprovalError) as raised:
            a.clean_proposal(proposal(why="x" * (a.WHY_MAX + 1)))
        self.assertIn(str(a.WHY_MAX), raised.exception.message)

    def test_control_characters_are_cleaned(self):
        card = a.clean_proposal(proposal(title="Título\x00 com\x07  espaços   demais"))
        self.assertEqual(card["title"], "Título com espaços demais")

    def test_agent_and_kind_are_plain_names(self):
        for key in ("agent", "kind"):
            for bad in ("", "Captação", "1abc", "a", "x" * 41, "com espaço", "../etc", None, 7):
                with self.subTest(key=key, value=bad):
                    with self.assertRaises(a.ApprovalError):
                        a.clean_proposal(proposal(**{key: bad}))

    def test_what_is_not_a_dict_is_refused(self):
        for bad in (None, [], "texto", 3):
            with self.assertRaises(a.ApprovalError):
                a.clean_proposal(bad)

    def test_a_proposal_cannot_choose_its_own_level_or_status(self):
        card = a.clean_proposal(proposal(level=1, status="aprovada", decided_by="eu"))
        self.assertEqual(card["level"], 3)
        self.assertNotIn("status", card)
        self.assertNotIn("decided_by", card)


class RecordRules(unittest.TestCase):
    def test_a_level_one_record_says_what_was_done_and_the_result(self):
        card = a.clean_record(record())
        self.assertEqual(card["level"], 1)
        self.assertEqual(card["cost_cents"], 0)
        self.assertEqual(card["risk"], "")
        with self.assertRaises(a.ApprovalError):
            a.clean_record(record(result=""))

    def test_the_cost_is_whole_cents_and_never_negative(self):
        self.assertEqual(a.clean_record(record(cost_cents=250))["cost_cents"], 250)
        for bad in (-1, 1.5, "10", True, a.COST_MAX_CENTS + 1):
            with self.subTest(cost=bad):
                with self.assertRaises(a.ApprovalError):
                    a.clean_record(record(cost_cents=bad))

    def test_evidence_is_optional_here_but_checked_when_given(self):
        self.assertEqual(a.clean_record(record())["evidence"], [])
        with self.assertRaises(a.ApprovalError):
            a.clean_record(record(evidence=[{"fact": "algo", "source": "", "date": "2026-10-15"}]))


class DecisionRules(unittest.TestCase):
    def test_the_three_answers(self):
        self.assertEqual(a.clean_decision({"decision": "approve"}), {"decision": "approve", "note": ""})
        self.assertEqual(a.clean_decision({"decision": "refuse", "note": "  agora não "})["note"], "agora não")
        self.assertEqual(a.clean_decision({"decision": "change", "note": "troque o texto"})["decision"], "change")

    def test_asking_for_a_change_needs_to_say_what(self):
        for note in ("", "  ", None):
            with self.assertRaises(a.ApprovalError):
                a.clean_decision({"decision": "change", "note": note})

    def test_anything_else_is_refused(self):
        for bad in (None, {}, {"decision": "aprovada"}, {"decision": 1}, "approve", []):
            with self.assertRaises(a.ApprovalError):
                a.clean_decision(bad)

    def test_a_long_note_is_refused(self):
        with self.assertRaises(a.ApprovalError):
            a.clean_decision({"decision": "refuse", "note": "x" * (a.NOTE_MAX + 1)})


class WritingRules(unittest.TestCase):
    def test_proposing_puts_a_pending_card_and_one_event_and_runs_nothing(self):
        cur = FakeCursor([{"id": ACTION_ID}])
        self.assertEqual(a.propose(cur, proposal()), ACTION_ID)
        insert = cur.sql("INSERT INTO agent_actions")[0][1]
        self.assertEqual(insert[2], 3)  # nível
        self.assertEqual(insert[9], "pendente")
        self.assertEqual(json.loads(insert[8]), EVIDENCE)
        events = cur.sql("INSERT INTO agent_action_events")
        self.assertEqual([e[1] for e in events], [(ACTION_ID, "proposta", "agente:captacao", None, "")])
        self.assertEqual(len(cur.calls), 2)

    def test_a_bad_card_never_touches_the_database(self):
        cur = FakeCursor()
        with self.assertRaises(a.ApprovalError):
            a.propose(cur, proposal(evidence=[]))
        self.assertEqual(cur.calls, [])

    def test_recording_a_level_one_action_is_done_right_away(self):
        cur = FakeCursor([{"id": ACTION_ID}])
        a.record(cur, record(cost_cents=40))
        insert = cur.sql("INSERT INTO agent_actions")[0][1]
        self.assertEqual((insert[2], insert[9], insert[11]), (1, "feita", 40))
        self.assertEqual(cur.sql("INSERT INTO agent_action_events")[0][1][1], "feita")

        cur = FakeCursor([{"id": ACTION_ID}])
        a.record(cur, record(result="O envio foi barrado pela trava de e-mail."), ok=False)
        self.assertEqual(cur.sql("INSERT INTO agent_actions")[0][1][9], "falhou")

    def test_the_owner_decides_a_pending_card_once(self):
        for choice, status in (("approve", "aprovada"), ("refuse", "recusada"), ("change", "mudanca")):
            with self.subTest(choice=choice):
                cur = FakeCursor([{"id": ACTION_ID}])
                result = a.decide(cur, ACTION_ID, {"decision": choice, "note": "x"}, OWNER)
                self.assertEqual(result, {"status": status, "already": False})
                update = cur.sql("UPDATE agent_actions")[0]
                self.assertIn("level = 3 AND status = 'pendente'", update[0])
                self.assertEqual(update[1], (status, "x", OWNER, ACTION_ID))
                self.assertEqual(cur.sql("INSERT INTO agent_action_events")[0][1], (ACTION_ID, status, "dono", OWNER, "x"))

    def test_sending_the_same_decision_again_changes_nothing(self):
        cur = FakeCursor([None, {"level": 3, "status": "aprovada"}])
        self.assertEqual(a.decide(cur, ACTION_ID, {"decision": "approve", "note": ""}, OWNER), {"status": "aprovada", "already": True})
        self.assertEqual(cur.sql("INSERT INTO agent_action_events"), [])

    def test_changing_the_mind_after_deciding_is_refused(self):
        cur = FakeCursor([None, {"level": 3, "status": "recusada"}])
        with self.assertRaises(a.ApprovalError) as raised:
            a.decide(cur, ACTION_ID, {"decision": "approve", "note": ""}, OWNER)
        self.assertEqual(raised.exception.status, 409)
        self.assertIn("recusada", raised.exception.message)
        self.assertEqual(cur.sql("INSERT INTO agent_action_events"), [])

    def test_a_level_one_action_does_not_wait_for_anyone(self):
        cur = FakeCursor([None, {"level": 1, "status": "feita"}])
        with self.assertRaises(a.ApprovalError) as raised:
            a.decide(cur, ACTION_ID, {"decision": "approve", "note": ""}, OWNER)
        self.assertEqual(raised.exception.status, 409)

    def test_an_unknown_card_is_a_404(self):
        cur = FakeCursor([None, None])
        with self.assertRaises(a.ApprovalError) as raised:
            a.decide(cur, ACTION_ID, {"decision": "refuse", "note": ""}, OWNER)
        self.assertEqual(raised.exception.status, 404)

    def test_only_an_approved_action_can_be_finished(self):
        cur = FakeCursor([{"id": ACTION_ID, "agent": "captacao"}])
        a.finish(cur, ACTION_ID, ok=True, result="Lista de 120 contatos montada, nada enviado.", cost_cents=90)
        update = cur.sql("UPDATE agent_actions")[0]
        self.assertIn("level = 3 AND status = 'aprovada'", update[0])
        self.assertEqual(update[1], ("feita", "Lista de 120 contatos montada, nada enviado.", 90, ACTION_ID))
        self.assertEqual(cur.sql("INSERT INTO agent_action_events")[0][1][:3], (ACTION_ID, "feita", "agente:captacao"))

        cur = FakeCursor([None])
        with self.assertRaises(a.ApprovalError) as raised:
            a.finish(cur, ACTION_ID, ok=True, result="Feito.")
        self.assertEqual(raised.exception.status, 409)
        self.assertEqual(cur.sql("INSERT INTO agent_action_events"), [])

    def test_finish_checks_the_result_and_the_cost_before_the_database(self):
        for kwargs in ({"result": ""}, {"result": "x" * (a.RESULT_MAX + 1)}, {"result": "Feito.", "cost_cents": -5}):
            cur = FakeCursor()
            with self.assertRaises(a.ApprovalError):
                a.finish(cur, ACTION_ID, ok=True, **kwargs)
            self.assertEqual(cur.calls, [])

    def test_a_failure_is_recorded_as_failed(self):
        cur = FakeCursor([{"id": ACTION_ID, "agent": "captacao"}])
        a.finish(cur, ACTION_ID, ok=False, result="A fonte saiu do ar.")
        self.assertEqual(cur.sql("UPDATE agent_actions")[0][1][0], "falhou")


class Views(unittest.TestCase):
    ROW = {
        "id": ACTION_ID, "agent": "captacao", "kind": "nova_origem_de_contatos", "level": 3,
        "title": "Usar o cadastro público de CNPJ", "what": "O quê", "why": "Por quê", "risk": "Risco",
        "if_refused": "Nada muda", "evidence": EVIDENCE, "status": "pendente", "decision_note": "",
        "result": "", "cost_cents": 0, "since_seconds": 7300,
    }

    def test_the_card_has_everything_the_screen_needs(self):
        card = a.card_view(dict(self.ROW))
        self.assertEqual(card["agent_label"], "Captação")
        self.assertEqual(card["level_label"], "Só o dono do sistema decide")
        self.assertEqual(card["status_label"], "Esperando o seu aval")
        self.assertEqual(card["when_label"], "há 2 h")
        self.assertEqual(card["evidence"], EVIDENCE)
        self.assertEqual(card["id"], ACTION_ID)

    def test_the_view_never_carries_who_decided(self):
        card = a.card_view({**self.ROW, "decided_by": OWNER, "decided_at": "2026-10-15"})
        self.assertNotIn(OWNER, json.dumps(card))
        self.assertNotIn("decided_by", card)

    def test_an_unknown_agent_still_gets_a_readable_name(self):
        self.assertEqual(a.agent_label("mapa_de_bairros"), "Mapa de bairros")
        self.assertEqual(a.agent_label(""), "Agente")

    def test_evidence_that_is_not_a_list_of_facts_shows_nothing(self):
        self.assertEqual(a.card_view({**self.ROW, "evidence": None})["evidence"], [])
        self.assertEqual(a.card_view({**self.ROW, "evidence": ["x", 3]})["evidence"], [])

    def test_the_queue_query_only_holds_level_three_pending_cards(self):
        self.assertIn("level = 3 AND status = 'pendente'", a.SQL_PENDING)
        self.assertIn("NOT (level = 3 AND status = 'pendente')", a.SQL_RECENT)
        self.assertIn(f"LIMIT {a.PENDING_LIMIT}", a.SQL_PENDING)
        self.assertIn(f"LIMIT {a.RECENT_LIMIT}", a.SQL_RECENT)


if __name__ == "__main__":
    unittest.main()
