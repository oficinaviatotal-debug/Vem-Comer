"""Registro de ações dos agentes e fila de aprovação do dono do software (migração 020).

Desenho em docs/agentes-e-aprendizado.md (itens 3, 4 e 5). Esta etapa só tem o **registro** e a **fila**:
**nada aqui executa, envia ou muda coisa nenhuma.** Quando houver agentes, eles vão propor por aqui e esperar.

Dois jeitos de uma ação entrar (o "nível" do LIVING_SYSTEM_SPINE.md):
- nível 1, reversível e pequeno: o sistema faz e conta. Entra no registro já como "feita" (ou "falhou"), nunca espera;
- nível 3, o que muda método, dinheiro, texto legal, canal novo, custo novo, dado pessoal ou código em produção:
  entra como "pendente" e **só o dono do software decide** (aprovar, recusar ou pedir mudança).
  O nível 2 (o dono do restaurante aprova) entra quando houver a fila do restaurante.

Regras (todas com teste):
- o cartão do nível 3 diz o quê, por quê, o risco e o que acontece se recusar, e traz **evidência**: cada fato com a
  fonte e a data ("sem fonte, a frase não sai");
- aprovar **só libera**. Quem executa conta depois o resultado e o custo (`finish`), e só uma ação aprovada pode ser
  concluída;
- decidir é uma vez só: repetir a mesma decisão não é erro, mas mudar de ideia depois de decidir não é permitido
  (o agente propõe um cartão novo);
- cada passo vira uma linha no histórico, que o banco não deixa alterar nem apagar.

Este arquivo só tem as regras e o SQL; as rotas em app.py conversam com o banco.
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta

from help_requests import waiting_label

LEVEL_ACT = 1
LEVEL_OWNER = 3

STATUS_LABELS = {
    "pendente": "Esperando o seu aval",
    "aprovada": "Aprovada, ainda não executada",
    "recusada": "Recusada",
    "mudanca": "Você pediu mudança",
    "feita": "Feita",
    "falhou": "Falhou",
}

LEVEL_LABELS = {
    LEVEL_ACT: "O sistema faz e conta",
    LEVEL_OWNER: "Só o dono do sistema decide",
}

# decisão que a tela manda -> estado em que a ação fica
DECISIONS = {"approve": "aprovada", "refuse": "recusada", "change": "mudanca"}

AGENT_LABELS = {
    "captacao": "Captação",
    "sucesso": "Sucesso do restaurante",
    "aprendizado": "Aprendizado",
    "lei": "Agente da lei",
    "conversa": "Conversa",
}

TITLE_MAX = 140
WHAT_MAX = 1000
WHY_MAX = 600
RISK_MAX = 600
IF_REFUSED_MAX = 400
NOTE_MAX = 500
RESULT_MAX = 1000
FACT_MAX = 300
SOURCE_MAX = 200
EVIDENCE_MAX = 8
COST_MAX_CENTS = 10_000_000  # R$ 100 mil: acima disso é erro de digitação, não custo de agente
PENDING_LIMIT = 200
RECENT_LIMIT = 30


class ApprovalError(ValueError):
    """Pedido que não dá para registrar; a mensagem é clara e `status` é o código da resposta."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_SLUG = re.compile(r"^[a-z][a-z0-9_]{1,39}$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _clean(value) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = _CONTROL.sub(" ", value.replace("\r\n", "\n").replace("\r", "\n"))
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _field(payload: dict, key: str, label: str, *, minimum: int, maximum: int) -> str:
    """O texto do campo limpo. Texto grande demais é recusado, não cortado: quem escreveu precisa saber."""
    text = _clean(payload.get(key))
    if len(text) < minimum:
        raise ApprovalError(f"Falta preencher: {label}.")
    if len(text) > maximum:
        raise ApprovalError(f"{label[:1].upper()}{label[1:]} passa de {maximum} letras.")
    return text


def _slug(payload: dict, key: str, label: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not _SLUG.match(value):
        raise ApprovalError(f"{label[:1].upper()}{label[1:]} deve ter de 2 a 40 letras minúsculas, números ou _ (começando por letra).")
    return value


def clean_evidence(value, *, today: date | None = None) -> list[dict]:
    """A evidência do cartão: até 8 fatos, cada um com a fonte e a data (AAAA-MM-DD, nunca no futuro)."""
    if not isinstance(value, list):
        raise ApprovalError("A evidência deve ser uma lista de fatos, cada um com fonte e data.")
    if len(value) > EVIDENCE_MAX:
        raise ApprovalError(f"A evidência passa de {EVIDENCE_MAX} fatos.")

    limit = (today or date.today()) + timedelta(days=1)  # a data do Brasil nunca passa de amanhã no relógio do servidor
    items = []
    for position, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            raise ApprovalError(f"Fato {position} da evidência está inválido.")
        fact = _clean(item.get("fact"))
        source = _clean(item.get("source"))
        stamp = item.get("date")
        if len(fact) < 3 or len(fact) > FACT_MAX:
            raise ApprovalError(f"Fato {position} da evidência precisa de 3 a {FACT_MAX} letras.")
        if len(source) < 3 or len(source) > SOURCE_MAX:
            raise ApprovalError(f"Fato {position} da evidência está sem fonte. Sem fonte, a frase não sai.")
        if not isinstance(stamp, str) or not _ISO_DATE.match(stamp):
            raise ApprovalError(f"Fato {position} da evidência está sem data (AAAA-MM-DD).")
        try:
            when = date.fromisoformat(stamp)
        except ValueError:
            raise ApprovalError(f"Fato {position} da evidência tem uma data que não existe.") from None
        if when > limit:
            raise ApprovalError(f"Fato {position} da evidência tem data no futuro.")
        items.append({"fact": fact, "source": source, "date": stamp})
    return items


def _base(payload) -> dict:
    if not isinstance(payload, dict):
        raise ApprovalError("Pedido inválido.")
    return {
        "agent": _slug(payload, "agent", "o agente"),
        "kind": _slug(payload, "kind", "o tipo da ação"),
        "title": _field(payload, "title", "o título", minimum=3, maximum=TITLE_MAX),
        "what": _field(payload, "what", "o que será feito", minimum=3, maximum=WHAT_MAX),
    }


def clean_proposal(payload) -> dict:
    """O cartão do nível 3 limpo. Levanta ApprovalError. Sem evidência, sem risco ou sem "se recusar", não entra na fila."""
    action = _base(payload)
    action.update(
        level=LEVEL_OWNER,
        why=_field(payload, "why", "o porquê", minimum=3, maximum=WHY_MAX),
        risk=_field(payload, "risk", "o risco", minimum=3, maximum=RISK_MAX),
        if_refused=_field(payload, "if_refused", "o que acontece se recusar", minimum=3, maximum=IF_REFUSED_MAX),
        evidence=clean_evidence(payload.get("evidence")),
    )
    if not action["evidence"]:
        raise ApprovalError("Sem evidência (fato com fonte e data), a ação não entra na fila.")
    return action


def clean_record(payload) -> dict:
    """Uma ação do nível 1, que o sistema fez e conta: precisa dizer o que foi feito e o resultado."""
    action = _base(payload)
    cost = payload.get("cost_cents", 0)
    if isinstance(cost, bool) or not isinstance(cost, int) or cost < 0 or cost > COST_MAX_CENTS:
        raise ApprovalError("O custo deve ser um número inteiro de centavos, de 0 a 10.000.000.")
    action.update(
        level=LEVEL_ACT,
        why=_field(payload, "why", "o porquê", minimum=0, maximum=WHY_MAX),
        risk="",
        if_refused="",
        evidence=clean_evidence(payload.get("evidence", [])),
        result=_field(payload, "result", "o resultado", minimum=3, maximum=RESULT_MAX),
        cost_cents=cost,
    )
    return action


def clean_decision(payload) -> dict:
    """{"decision": "approve" | "refuse" | "change", "note": "..."}. Pedir mudança exige dizer o que mudar."""
    if not isinstance(payload, dict):
        raise ApprovalError("Pedido inválido.")
    decision = payload.get("decision")
    if not isinstance(decision, str) or decision not in DECISIONS:
        raise ApprovalError("Escolha: aprovar, recusar ou pedir mudança.")
    note = _clean(payload.get("note"))
    if len(note) > NOTE_MAX:
        raise ApprovalError(f"A nota passa de {NOTE_MAX} letras.")
    if decision == "change" and len(note) < 3:
        raise ApprovalError("Diga o que deve mudar.")
    return {"decision": decision, "note": note}


# ----------------------------------------------------------------------------------------------- SQL

SQL_INSERT = """
    INSERT INTO agent_actions
        (agent, kind, level, title, what, why, risk, if_refused, evidence, status, result, cost_cents, done_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, CASE WHEN %s IN ('feita', 'falhou') THEN now() END)
    RETURNING id
"""

SQL_EVENT = """
    INSERT INTO agent_action_events (action_id, event, actor, actor_user, note)
    VALUES (%s, %s, %s, %s, %s)
"""

# Só o nível 3 espera o dono do software, e só enquanto está pendente: dois toques ao mesmo tempo decidem uma vez.
SQL_DECIDE = """
    UPDATE agent_actions
    SET status = %s, decision_note = %s, decided_by = %s, decided_at = now()
    WHERE id = %s AND level = 3 AND status = 'pendente'
    RETURNING id
"""

SQL_STATE = "SELECT level, status FROM agent_actions WHERE id = %s"

SQL_FINISH = """
    UPDATE agent_actions
    SET status = %s, result = %s, cost_cents = %s, done_at = now()
    WHERE id = %s AND level = 3 AND status = 'aprovada'
    RETURNING id, agent
"""

_COLUMNS = """
    id, agent, kind, level, title, what, why, risk, if_refused, evidence, status, decision_note, result, cost_cents
"""

SQL_PENDING = f"""
    SELECT {_COLUMNS},
           GREATEST(0, EXTRACT(EPOCH FROM (now() - created_at)))::bigint AS since_seconds
    FROM agent_actions
    WHERE level = 3 AND status = 'pendente'
    ORDER BY created_at ASC
    LIMIT {PENDING_LIMIT}
"""

SQL_RECENT = f"""
    SELECT {_COLUMNS},
           GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(done_at, decided_at, created_at))))::bigint AS since_seconds
    FROM agent_actions
    WHERE NOT (level = 3 AND status = 'pendente')
    ORDER BY COALESCE(done_at, decided_at, created_at) DESC
    LIMIT {RECENT_LIMIT}
"""


# ----------------------------------------------------------------------------------------------- escrever

def _actor(agent: str) -> str:
    return f"agente:{agent}"


def _insert(cur, action: dict, status: str) -> str:
    cur.execute(
        SQL_INSERT,
        (
            action["agent"],
            action["kind"],
            action["level"],
            action["title"],
            action["what"],
            action["why"],
            action["risk"],
            action["if_refused"],
            json.dumps(action["evidence"], ensure_ascii=False),
            status,
            action.get("result", ""),
            action.get("cost_cents", 0),
            status,
        ),
    )
    return str(cur.fetchone()["id"])


def propose(cur, payload) -> str:
    """Põe um cartão do nível 3 na fila do dono do software. Não executa nada. Devolve o id."""
    action = clean_proposal(payload)
    action_id = _insert(cur, action, "pendente")
    cur.execute(SQL_EVENT, (action_id, "proposta", _actor(action["agent"]), None, ""))
    return action_id


def record(cur, payload, *, ok: bool = True) -> str:
    """Registra uma ação do nível 1 que o sistema já fez (ou que falhou). Nunca espera ninguém. Devolve o id."""
    action = clean_record(payload)
    status = "feita" if ok else "falhou"
    action_id = _insert(cur, action, status)
    cur.execute(SQL_EVENT, (action_id, status, _actor(action["agent"]), None, action["result"][:NOTE_MAX]))
    return action_id


def decide(cur, action_id: str, decision: dict, user_id) -> dict:
    """O dono do software decide um cartão pendente. Devolve {"status", "already"}. Levanta ApprovalError (404 ou 409)."""
    target = DECISIONS[decision["decision"]]
    cur.execute(SQL_DECIDE, (target, decision["note"], user_id, action_id))

    if cur.fetchone():
        cur.execute(SQL_EVENT, (action_id, target, "dono", user_id, decision["note"]))
        return {"status": target, "already": False}

    cur.execute(SQL_STATE, (action_id,))
    current = cur.fetchone()
    if not current:
        raise ApprovalError("Ação não encontrada.", 404)
    if current["level"] != LEVEL_OWNER:
        raise ApprovalError("Esta ação não espera o seu aval.", 409)
    if current["status"] == target:
        return {"status": target, "already": True}
    raise ApprovalError(f"Esta ação já foi decidida: {STATUS_LABELS.get(current['status'], current['status']).lower()}.", 409)


def finish(cur, action_id: str, *, ok: bool, result: str, cost_cents: int = 0) -> None:
    """Quem executou uma ação aprovada conta o resultado e o custo. Só uma ação aprovada pode ser concluída."""
    text = _clean(result)
    if len(text) < 3:
        raise ApprovalError("Falta preencher: o resultado.")
    if len(text) > RESULT_MAX:
        raise ApprovalError(f"O resultado passa de {RESULT_MAX} letras.")
    if isinstance(cost_cents, bool) or not isinstance(cost_cents, int) or cost_cents < 0 or cost_cents > COST_MAX_CENTS:
        raise ApprovalError("O custo deve ser um número inteiro de centavos, de 0 a 10.000.000.")

    status = "feita" if ok else "falhou"
    cur.execute(SQL_FINISH, (status, text, cost_cents, action_id))
    row = cur.fetchone()
    if not row:
        raise ApprovalError("Só uma ação aprovada pode ser concluída.", 409)
    cur.execute(SQL_EVENT, (action_id, status, _actor(row["agent"]), None, text[:NOTE_MAX]))


# ----------------------------------------------------------------------------------------------- ler

def agent_label(agent: str) -> str:
    known = AGENT_LABELS.get(agent)
    if known:
        return known
    words = str(agent or "").replace("_", " ").strip()
    return f"{words[:1].upper()}{words[1:]}" if words else "Agente"


def _evidence_view(items) -> list[dict]:
    out = []
    for item in items if isinstance(items, list) else []:
        if isinstance(item, dict):
            out.append({k: str(item.get(k) or "") for k in ("fact", "source", "date")})
    return out


def card_view(row: dict) -> dict:
    """Um cartão como a tela mostra. Não leva o id de quem decidiu."""
    level = int(row["level"])
    status = row["status"]
    return {
        "id": str(row["id"]),
        "agent": row["agent"],
        "agent_label": agent_label(row["agent"]),
        "kind": row["kind"],
        "level": level,
        "level_label": LEVEL_LABELS.get(level, ""),
        "title": row["title"],
        "what": row["what"],
        "why": row.get("why") or "",
        "risk": row.get("risk") or "",
        "if_refused": row.get("if_refused") or "",
        "evidence": _evidence_view(row.get("evidence")),
        "status": status,
        "status_label": STATUS_LABELS.get(status, status),
        "when_label": waiting_label(row.get("since_seconds")),
        "decision_note": row.get("decision_note") or "",
        "result": row.get("result") or "",
        "cost_cents": int(row.get("cost_cents") or 0),
    }
