"""Prova no PostgreSQL de verdade: a migração 020 (registro de ações e fila de aprovação).

Roda só com VEM_TEST_DATABASE_URL (fluxo .github/workflows/compliance.yml). Cada teste trabalha dentro de uma
transação desfeita no fim: o banco não fica sujo.
"""

import os
import unittest

import approvals as a

URL = os.getenv("VEM_TEST_DATABASE_URL")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover
    psycopg2 = None

EVIDENCE = [{"fact": "O advogado ainda não revisou o e-mail para empresas", "source": "docs/agentes-e-aprendizado.md", "date": "2026-10-15"}]


def proposal(**extra):
    data = {
        "agent": "captacao",
        "kind": "nova_origem_de_contatos",
        "title": "Usar o cadastro público de CNPJ como origem",
        "what": "Incluir a base aberta da Receita Federal como origem de contatos de empresas.",
        "why": "É a única fonte que dá a lista completa do estado.",
        "risk": "Muda regra de conformidade.",
        "if_refused": "A lista continua só com as origens de hoje.",
        "evidence": EVIDENCE,
    }
    data.update(extra)
    return data


def record(**extra):
    data = {
        "agent": "sucesso",
        "kind": "resumo_semanal",
        "title": "Resumo da semana montado",
        "what": "Montei o resumo com três ações.",
        "result": "Resumo guardado no painel. Nada foi enviado.",
    }
    data.update(extra)
    return data


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar os testes de banco")
class AprovacoesBancoTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg2.connect(URL)
        self.cur = self.conn.cursor(cursor_factory=RealDictCursor)

    def tearDown(self):
        self.conn.rollback()
        self.cur.close()
        self.conn.close()

    def dono(self):
        self.cur.execute("INSERT INTO companies (name, slug) VALUES ('Vem Tecnologia', 'vem-tecnologia-teste-aprovacoes') RETURNING id")
        company = self.cur.fetchone()["id"]
        self.cur.execute(
            "INSERT INTO users (company_id, name, email, password_hash, role) VALUES (%s, 'GD', 'gd-aprovacoes@exemplo.com', 'hash-de-teste', 'OWNER') RETURNING id",
            (company,),
        )
        return str(self.cur.fetchone()["id"])

    def linha(self, action_id):
        self.cur.execute("SELECT * FROM agent_actions WHERE id = %s", (action_id,))
        return self.cur.fetchone()

    def historico(self, action_id):
        self.cur.execute("SELECT event, actor, actor_user, note FROM agent_action_events WHERE action_id = %s ORDER BY seq", (action_id,))
        return self.cur.fetchall()

    # ---- o caminho inteiro

    def test_propose_decide_and_finish_leave_a_history_that_tells_the_story(self):
        dono = self.dono()
        action = a.propose(self.cur, proposal())
        self.assertEqual(self.linha(action)["status"], "pendente")

        self.assertEqual(a.decide(self.cur, action, {"decision": "approve", "note": "pode seguir"}, dono), {"status": "aprovada", "already": False})
        row = self.linha(action)
        self.assertEqual((row["status"], str(row["decided_by"]), row["decision_note"]), ("aprovada", dono, "pode seguir"))
        self.assertIsNotNone(row["decided_at"])

        a.finish(self.cur, action, ok=True, result="Lista de 120 contatos montada, nada enviado.", cost_cents=90)
        row = self.linha(action)
        self.assertEqual((row["status"], row["cost_cents"]), ("feita", 90))
        self.assertIsNotNone(row["done_at"])

        story = self.historico(action)
        self.assertEqual([e["event"] for e in story], ["proposta", "aprovada", "feita"])
        self.assertEqual([e["actor"] for e in story], ["agente:captacao", "dono", "agente:captacao"])
        self.assertEqual(str(story[1]["actor_user"]), dono)

    def test_a_decision_is_taken_once_in_the_real_table(self):
        dono = self.dono()
        action = a.propose(self.cur, proposal())
        a.decide(self.cur, action, {"decision": "refuse", "note": "agora não"}, dono)
        self.assertEqual(a.decide(self.cur, action, {"decision": "refuse", "note": ""}, dono), {"status": "recusada", "already": True})
        with self.assertRaises(a.ApprovalError) as raised:
            a.decide(self.cur, action, {"decision": "approve", "note": ""}, dono)
        self.assertEqual(raised.exception.status, 409)
        self.assertEqual(self.linha(action)["status"], "recusada")
        self.assertEqual([e["event"] for e in self.historico(action)], ["proposta", "recusada"])

    def test_nothing_that_was_not_approved_can_be_finished(self):
        dono = self.dono()
        pendente = a.propose(self.cur, proposal())
        with self.assertRaises(a.ApprovalError):
            a.finish(self.cur, pendente, ok=True, result="Feito.")
        a.decide(self.cur, pendente, {"decision": "refuse", "note": ""}, dono)
        with self.assertRaises(a.ApprovalError):
            a.finish(self.cur, pendente, ok=True, result="Feito.")
        self.assertEqual(self.linha(pendente)["status"], "recusada")

    def test_a_level_one_record_never_waits_and_cannot_be_decided(self):
        dono = self.dono()
        action = a.record(self.cur, record(cost_cents=40))
        row = self.linha(action)
        self.assertEqual((row["level"], row["status"], row["cost_cents"]), (1, "feita", 40))
        self.assertIsNotNone(row["done_at"])
        with self.assertRaises(a.ApprovalError) as raised:
            a.decide(self.cur, action, {"decision": "approve", "note": ""}, dono)
        self.assertEqual(raised.exception.status, 409)

    def test_the_queue_and_the_record_are_split_by_the_real_queries(self):
        dono = self.dono()
        waiting = a.propose(self.cur, proposal(title="Esta espera o aval"))
        decided = a.propose(self.cur, proposal(title="Esta já foi decidida"))
        a.decide(self.cur, decided, {"decision": "refuse", "note": ""}, dono)
        done = a.record(self.cur, record())

        self.cur.execute(a.SQL_PENDING)
        queue = {str(r["id"]) for r in self.cur.fetchall()}
        self.cur.execute(a.SQL_RECENT)
        recent = {str(r["id"]) for r in self.cur.fetchall()}

        self.assertIn(waiting, queue)
        self.assertNotIn(decided, queue)
        self.assertNotIn(done, queue)
        self.assertNotIn(waiting, recent)
        self.assertTrue({decided, done} <= recent)

    def test_the_card_view_reads_a_real_row(self):
        action = a.propose(self.cur, proposal())
        self.cur.execute(a.SQL_PENDING)
        card = a.card_view([r for r in self.cur.fetchall() if str(r["id"]) == action][0])
        self.assertEqual(card["evidence"], EVIDENCE)
        self.assertEqual(card["status_label"], "Esperando o seu aval")
        self.assertEqual(card["agent_label"], "Captação")

    # ---- o banco recusa o que as regras não aceitam

    def test_the_database_itself_refuses_a_queue_card_without_evidence(self):
        with self.assertRaises(psycopg2.Error):
            self.cur.execute(
                "INSERT INTO agent_actions (agent, kind, level, title, what, status) VALUES ('captacao', 'x_y', 3, 'Título', 'O que', 'pendente')"
            )

    def test_the_database_refuses_a_level_one_action_that_waits(self):
        with self.assertRaises(psycopg2.Error):
            self.cur.execute(
                "INSERT INTO agent_actions (agent, kind, level, title, what, status) VALUES ('sucesso', 'x_y', 1, 'Título', 'O que', 'pendente')"
            )

    def test_the_database_refuses_level_two_for_now_and_bad_names(self):
        for sql in (
            "INSERT INTO agent_actions (agent, kind, level, title, what, status, done_at) VALUES ('sucesso', 'x_y', 2, 'Título', 'O que', 'feita', now())",
            "INSERT INTO agent_actions (agent, kind, level, title, what, status, done_at) VALUES ('Sucesso', 'x_y', 1, 'Título', 'O que', 'feita', now())",
            "INSERT INTO agent_actions (agent, kind, level, title, what, status, done_at, cost_cents) VALUES ('sucesso', 'x_y', 1, 'Título', 'O que', 'feita', now(), -1)",
        ):
            with self.subTest(sql=sql):
                with self.assertRaises(psycopg2.Error):
                    self.cur.execute(sql)
                self.conn.rollback()

    def test_a_decided_action_must_carry_the_time_of_the_decision(self):
        action = a.propose(self.cur, proposal())
        with self.assertRaises(psycopg2.Error):
            self.cur.execute("UPDATE agent_actions SET status = 'aprovada' WHERE id = %s", (action,))

    def test_the_history_only_takes_new_rows(self):
        action = a.propose(self.cur, proposal())
        for sql in ("UPDATE agent_action_events SET note = 'x'", "DELETE FROM agent_action_events", "TRUNCATE agent_action_events"):
            with self.subTest(sql=sql):
                with self.assertRaises(psycopg2.Error):
                    self.cur.execute(sql)
                self.conn.rollback()
                action = a.propose(self.cur, proposal())
        self.assertGreaterEqual(len(self.historico(action)), 1)

    def test_an_action_with_a_history_cannot_be_erased(self):
        action = a.propose(self.cur, proposal())
        with self.assertRaises(psycopg2.Error):
            self.cur.execute("DELETE FROM agent_actions WHERE id = %s", (action,))

    def test_erasing_the_user_who_decided_does_not_touch_the_history(self):
        dono = self.dono()
        action = a.propose(self.cur, proposal())
        a.decide(self.cur, action, {"decision": "approve", "note": ""}, dono)
        self.cur.execute("DELETE FROM users WHERE id = %s", (dono,))
        self.assertIsNone(self.linha(action)["decided_by"])
        self.assertEqual([e["event"] for e in self.historico(action)], ["proposta", "aprovada"])


if __name__ == "__main__":
    unittest.main()
