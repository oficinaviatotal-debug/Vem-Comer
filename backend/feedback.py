"""'Como foi?': o retorno de quem usa o sistema, no fim de cada tarefa.

A pessoa toca num de três rostinhos e, se quiser, diz o que melhorar. Fica guardado por restaurante
(tabela feedback, migração 008) para a melhoria diária: o dono do software lê o resumo com
deploy/vps/ver-retorno.sh e decide o que muda. Nada muda sozinho no sistema por causa de um retorno.
"""

from __future__ import annotations

import re
import threading
import time
import unicodedata
from collections import deque

# Onde a pergunta aparece. Um nome fora da lista vira "geral" (a tela nunca quebra por isso).
CONTEXTS = {
    "cardapio_falado",
    "cardapio_foto",
    "cardapio_modelo",
    "fotos",
    "custos",
    "logomarca",
    "pedidos",
    "geral",
}
RATINGS = {1: "ruim", 2: "mais ou menos", 3: "bom"}
MAX_COMMENT = 500
PER_USER_PER_HOUR = 20

_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


class FeedbackError(ValueError):
    """Resposta que não dá para guardar; a mensagem vai para a tela."""


def clean_comment(raw) -> str:
    if raw is None:
        return ""
    if not isinstance(raw, str):
        raise FeedbackError("O comentário precisa ser texto.")
    text = unicodedata.normalize("NFC", raw)
    text = _CONTROL.sub(" ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:MAX_COMMENT].strip()


def normalize(payload) -> tuple[str, int, str]:
    """(contexto, nota, comentário) a partir do corpo da requisição. Levanta FeedbackError."""
    if not isinstance(payload, dict):
        raise FeedbackError("Resposta vazia.")
    rating = payload.get("rating")
    if isinstance(rating, bool) or not isinstance(rating, int) or rating not in RATINGS:
        raise FeedbackError("Toque num dos três rostinhos.")
    context = payload.get("context")
    context = context if isinstance(context, str) and context in CONTEXTS else "geral"
    return context, rating, clean_comment(payload.get("comment"))


class Limiter:
    """Respostas por pessoa por hora, em memória: evita que um toque repetido encha a tabela."""

    def __init__(self, clock=time.time):
        self._clock = clock
        self._lock = threading.Lock()
        self._per_user: dict[str, deque] = {}

    def check(self, user_key: str) -> None:
        now = self._clock()
        with self._lock:
            mine = self._per_user.setdefault(str(user_key), deque())
            while mine and now - mine[0] > 3600:
                mine.popleft()
            if len(mine) >= PER_USER_PER_HOUR:
                raise FeedbackError("Já recebemos várias respostas suas nesta hora. Obrigado!")
            mine.append(now)


limiter = Limiter()
