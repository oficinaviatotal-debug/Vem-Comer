"""Chamadas da mesa (Mesa viva): o cliente toca no celular e o painel do restaurante avisa.

Na tela da mesa o cliente escolhe Chamar garçom, Pedir a conta, Água ou Limpeza. Cada toque vira uma
chamada aberta (tabela table_calls, migração 009) que aparece no painel com o número da mesa e há
quanto tempo espera. Quem do restaurante toca em Atender fecha a chamada; o tempo entre as duas horas
é o número que vira a meta do garçom (requisito 11).

Este arquivo só tem as regras e o SQL; a rota em app.py conversa com o banco.

O que protege a porta pública (o cliente não tem login):
- só vale para uma mesa que existe naquele restaurante (o endereço da mesa é o QR impresso);
- limite por endereço de rede (por hora) e por mesa (a cada 10 minutos);
- tocar de novo num pedido ainda aberto não cria outra linha: só sobe o contador de repetições;
- a resposta pública nunca traz dado de ninguém, só o tipo e se já foi atendido.
"""

from __future__ import annotations

import threading
import time
from collections import deque

# tipo -> nome curto (botão) e a frase que o painel mostra: "Mesa 4 chama o garçom"
KINDS = {
    "garcom": ("Garçom", "chama o garçom"),
    "conta": ("Conta", "pede a conta"),
    "agua": ("Água", "pede água"),
    "limpeza": ("Limpeza", "pede limpeza da mesa"),
}

# Chamada aberta há mais que isso é esquecida: some do painel e o cliente pode chamar de novo.
OPEN_WINDOW_MINUTES = 120
MAX_REPEATS = 9

# Quando o painel pinta a chamada de amarelo (demorando) e de vermelho (urgente).
LATE_AFTER_SECONDS = 180
URGENT_AFTER_SECONDS = 420
URGENT_AFTER_REPEATS = 2

PER_TABLE_PER_10_MIN = 8
PER_IP_PER_HOUR = 60
_PRUNE_ABOVE = 5000


class CallError(ValueError):
    """Chamada que não dá para registrar; a mensagem vai para a tela e `status` é o código da resposta."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def label(kind: str) -> str:
    return KINDS[kind][0]


def phrase(kind: str) -> str:
    return KINDS[kind][1]


def normalize_kind(payload) -> str:
    """O tipo pedido no corpo da requisição ({"kind": "garcom"}). Levanta CallError."""
    if not isinstance(payload, dict):
        raise CallError("Pedido inválido.")
    kind = payload.get("kind")
    if not isinstance(kind, str) or kind not in KINDS:
        raise CallError("Escolha: garçom, conta, água ou limpeza.")
    return kind


def urgency(waiting_seconds: int, repeats: int = 0) -> str:
    """"normal", "late" (demorando) ou "urgent": a cor da chamada no painel."""
    waiting = max(0, int(waiting_seconds))
    if waiting >= URGENT_AFTER_SECONDS or repeats >= URGENT_AFTER_REPEATS:
        return "urgent"
    if waiting >= LATE_AFTER_SECONDS:
        return "late"
    return "normal"


def confirmation(kind: str, already: bool) -> str:
    """O que o cliente lê depois de tocar."""
    if already:
        return "Já avisamos. O atendente está a caminho."
    if kind == "conta":
        return "Pedimos a conta. Já vai chegar."
    if kind == "agua":
        return "Avisamos que você quer água. Já vai chegar."
    if kind == "limpeza":
        return "Avisamos que a mesa precisa de limpeza."
    return "Avisamos o garçom. Já vai chegar."


def public_view(row: dict, already: bool | None = None) -> dict:
    """O que o cliente pode ver da própria chamada: só o tipo e o andamento."""
    body = {"id": str(row["id"]), "kind": row["kind"], "status": row["status"]}
    if already is not None:
        body["already"] = already
        body["message"] = confirmation(row["kind"], already)
    return body


def admin_view(row: dict) -> dict:
    """Uma chamada aberta como o painel mostra."""
    waiting = max(0, int(row.get("waiting_seconds") or 0))
    repeats = int(row.get("repeats") or 0)
    return {
        "id": str(row["id"]),
        "table_id": str(row["table_id"]),
        "table_number": row["table_number"],
        "kind": row["kind"],
        "label": label(row["kind"]),
        "text": f"Mesa {row['table_number']} {phrase(row['kind'])}",
        "waiting_seconds": waiting,
        "repeats": repeats,
        "urgency": urgency(waiting, repeats),
    }


class Limiter:
    """Quantos toques por endereço de rede (hora) e por mesa (10 minutos), em memória.

    Em memória basta: o objetivo é só barrar quem aperta sem parar ou um robô, não contar com
    exatidão. Ao reiniciar o servidor a contagem zera, e isso não machuca ninguém.
    """

    def __init__(self, clock=time.time):
        self._clock = clock
        self._lock = threading.Lock()
        self._per_ip: dict[str, deque] = {}
        self._per_table: dict[str, deque] = {}

    @staticmethod
    def _hit(bucket: dict, key: str, now: float, window: float, limit: int) -> bool:
        mine = bucket.setdefault(key, deque())
        while mine and now - mine[0] > window:
            mine.popleft()
        if len(mine) >= limit:
            return False
        mine.append(now)
        return True

    def _prune(self, bucket: dict, now: float, window: float) -> None:
        if len(bucket) <= _PRUNE_ABOVE:
            return
        for key in [k for k, hits in bucket.items() if not hits or now - hits[-1] > window]:
            del bucket[key]

    def check_ip(self, ip: str) -> None:
        now = self._clock()
        with self._lock:
            self._prune(self._per_ip, now, 3600)
            if not self._hit(self._per_ip, str(ip), now, 3600, PER_IP_PER_HOUR):
                raise CallError("Muitos toques seguidos. Espere um pouco e tente de novo.", 429)

    def check_table(self, table_id: str) -> None:
        now = self._clock()
        with self._lock:
            self._prune(self._per_table, now, 600)
            if not self._hit(self._per_table, str(table_id), now, 600, PER_TABLE_PER_10_MIN):
                raise CallError("Já avisamos várias vezes. Aguarde o atendente um instante.", 429)


SQL_TABLE = "SELECT id, number FROM tables WHERE id = %s AND company_id = %s"

SQL_OPEN_SAME = """
    SELECT id, kind, status
    FROM table_calls
    WHERE company_id = %s AND table_id = %s AND kind = %s AND status = 'open'
      AND created_at > now() - make_interval(mins => %s)
    ORDER BY created_at DESC
    LIMIT 1
"""

SQL_BUMP = """
    UPDATE table_calls SET repeats = LEAST(repeats + 1, %s)
    WHERE id = %s AND company_id = %s
"""

SQL_INSERT = """
    INSERT INTO table_calls (company_id, table_id, kind)
    VALUES (%s, %s, %s)
    RETURNING id, kind, status
"""

SQL_PUBLIC_STATUS = """
    SELECT id, kind, status
    FROM table_calls
    WHERE id = %s AND company_id = %s AND table_id = %s
"""

SQL_LIST_OPEN = """
    SELECT c.id, c.table_id, c.kind, c.repeats, t.number AS table_number,
           GREATEST(0, EXTRACT(EPOCH FROM (now() - c.created_at)))::int AS waiting_seconds
    FROM table_calls c
    JOIN tables t ON t.id = c.table_id
    WHERE c.company_id = %s AND c.status = 'open'
      AND c.created_at > now() - make_interval(mins => %s)
    ORDER BY c.created_at ASC
    LIMIT 100
"""

SQL_ANSWER = """
    UPDATE table_calls
    SET status = 'answered', answered_at = now(), answered_by = %s
    WHERE id = %s AND company_id = %s AND status = 'open'
    RETURNING id, GREATEST(0, EXTRACT(EPOCH FROM (answered_at - created_at)))::int AS seconds_to_answer
"""

SQL_EXISTS = "SELECT status FROM table_calls WHERE id = %s AND company_id = %s"
