"""Pedidos de ajuda do dono ("Preciso de ajuda") e o acompanhamento dos cadastros parados.

O dono que trava toca em Preciso de ajuda, escolhe o assunto (cardápio, foto, logomarca...), escreve ou dita o que
houve, e o pedido (tabela help_requests, migração 014) chega à caixa do administrador da plataforma
(PLATFORM_ADMIN_EMAILS), com o WhatsApp do dono. Se houver um WhatsApp de suporte configurado, a tela também
oferece falar agora por lá, com a mensagem já escrita.

A mesma caixa mostra os restaurantes que se cadastraram sozinhos e ainda não têm cardápio, com quantos dias faltam
para o prazo de 3 dias do GD, e quanto tempo levaram os que terminaram: é o cronômetro de verdade, medido com
dono de verdade, sem ninguém precisar anotar.

Este arquivo só tem as regras e o SQL; as rotas em app.py conversam com o banco.
"""

from __future__ import annotations

import os
import re
import threading
import time
from collections import deque
from urllib.parse import quote

# assunto -> o que o dono lê. A ordem é a ordem dos botões na tela.
TOPICS = {
    "cardapio": "Cadastrar o cardápio",
    "foto": "Foto de prato",
    "logo": "Logomarca",
    "pedidos": "Pedidos",
    "plano": "Plano e pagamento",
    "erro": "Deu erro",
    "outro": "Outra coisa",
}

MAX_MESSAGE = 500
MAX_SCREEN = 40
PER_COMPANY_PER_HOUR = 6
_PRUNE_ABOVE = 5000

# O prazo prometido ao dono: cardápio todo cadastrado em até 3 dias. "Cardápio cadastrado" = pelo menos
# MENU_READY_PRODUCTS pratos ativos (um restaurante de verdade tem mais; aqui só medimos que ele começou a valer).
DEADLINE_DAYS = 3
MENU_READY_PRODUCTS = 5
# Quem se cadastrou sozinho há mais que isso e nunca terminou sai da lista de parados (desistiu ou já é outra coisa).
WATCH_DAYS = 30


class HelpError(ValueError):
    """Pedido que não dá para registrar; a mensagem vai para a tela e `status` é o código da resposta."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


def _text(value, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = _CONTROL.sub(" ", value.replace("\r\n", "\n").replace("\r", "\n"))
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()[:limit].strip()


def clean_phone(value) -> str | None:
    """O WhatsApp do dono como só números (10 a 13), ou None quando não veio. Levanta HelpError se veio errado."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise HelpError("Escreva o WhatsApp com o DDD, por exemplo (84) 99999-1234.")
    digits = re.sub(r"\D", "", value)
    if not digits:
        return None
    if digits.startswith("55") and len(digits) in (12, 13):
        digits = digits[2:]
    if len(digits) not in (10, 11):
        raise HelpError("Escreva o WhatsApp com o DDD, por exemplo (84) 99999-1234.")
    return digits


def clean_request(payload) -> dict:
    """O corpo do pedido ({"topic", "message", "screen", "phone"}) limpo. Levanta HelpError."""
    if not isinstance(payload, dict):
        raise HelpError("Pedido inválido.")

    topic = payload.get("topic")
    if not isinstance(topic, str) or topic not in TOPICS:
        raise HelpError("Escolha o assunto: " + ", ".join(label.lower() for label in TOPICS.values()) + ".")

    screen = re.sub(r"[^a-z0-9_-]", "", _text(payload.get("screen"), MAX_SCREEN).lower())
    message = _text(payload.get("message"), MAX_MESSAGE)

    # "Outra coisa" sem uma palavra não diz nada a quem for ajudar.
    if topic == "outro" and len(message) < 3:
        raise HelpError("Conte em poucas palavras o que você precisa.")

    return {
        "topic": topic,
        "screen": screen,
        "message": message,
        "phone": clean_phone(payload.get("phone")),
    }


# ----------------------------------------------------------------------------------------------- WhatsApp

def support_whatsapp() -> str:
    """O WhatsApp de suporte, só números com 55 na frente, ou "". SUPPORT_WHATSAPP; na falta, o mesmo da cobrança."""
    raw = os.getenv("SUPPORT_WHATSAPP", "") or os.getenv("BILLING_CONTACT_PHONE", "")
    digits = re.sub(r"\D", "", raw)
    if len(digits) in (10, 11):
        digits = "55" + digits
    return digits if 12 <= len(digits) <= 13 else ""


def help_text(company_name: str, user_name: str, topic: str, message: str) -> str:
    """A mensagem que o dono manda ao suporte, já escrita."""
    who = _text(user_name, 80) or "o dono"
    place = _text(company_name, 100) or "meu restaurante"
    line = f"Oi! Aqui é {who}, do restaurante {place}. Preciso de ajuda no Vem Comer: {TOPICS[topic].lower()}."
    note = _text(message, 300)
    return f"{line} {note}" if note else line


def whatsapp_link(number: str, text: str) -> str:
    return f"https://wa.me/{number}?text={quote(text)}" if number else ""


def confirmation(already: bool, has_whatsapp: bool) -> str:
    """O que o dono lê depois de pedir."""
    base = (
        "Seu pedido de ajuda continua aberto. Atualizei com o que você escreveu."
        if already
        else "Recebi o seu pedido. Uma pessoa do Vem Comer vai falar com você."
    )
    return base + (" Se quiser, fale agora pelo WhatsApp." if has_whatsapp else "")


# ----------------------------------------------------------------------------------------------- limite

class Limiter:
    """Quantos pedidos por restaurante por hora, em memória.

    Só para barrar quem aperta sem parar. Ao reiniciar o servidor a contagem zera, e isso não machuca ninguém.
    """

    def __init__(self, clock=time.time):
        self._clock = clock
        self._lock = threading.Lock()
        self._per_company: dict[str, deque] = {}

    def check(self, company_id: str) -> None:
        now = self._clock()
        with self._lock:
            if len(self._per_company) > _PRUNE_ABOVE:
                for key in [k for k, hits in self._per_company.items() if not hits or now - hits[-1] > 3600]:
                    del self._per_company[key]
            mine = self._per_company.setdefault(str(company_id), deque())
            while mine and now - mine[0] > 3600:
                mine.popleft()
            if len(mine) >= PER_COMPANY_PER_HOUR:
                raise HelpError("Você já pediu ajuda várias vezes. Aguarde: uma pessoa vai falar com você.", 429)
            mine.append(now)


# ----------------------------------------------------------------------------------------------- tempo

def waiting_label(seconds) -> str:
    """"agora", "há 5 min", "há 3 h", "há 2 dias": há quanto tempo o dono espera."""
    seconds = max(0, int(seconds or 0))
    if seconds < 120:
        return "agora"
    if seconds < 3600:
        return f"há {seconds // 60} min"
    if seconds < 86400:
        return f"há {seconds // 3600} h"
    days = seconds // 86400
    return f"há {days} {'dia' if days == 1 else 'dias'}"


def duration_label(seconds) -> str:
    """"45 min", "3 h 20 min", "2 dias 4 h": quanto tempo levou."""
    seconds = max(0, int(seconds or 0))
    minutes = seconds // 60
    if minutes < 60:
        return f"{max(1, minutes)} min"
    hours, minutes = divmod(minutes, 60)
    if hours < 24:
        return f"{hours} h {minutes:02d} min" if minutes else f"{hours} h"
    days, hours = divmod(hours, 24)
    unit = "dia" if days == 1 else "dias"
    return f"{days} {unit} {hours} h" if hours else f"{days} {unit}"


def deadline_state(age_seconds, ready: bool) -> str:
    """Onde o cadastro está em relação ao prazo: "done", "ok" (menos de 1 dia), "watch" (1 dia), "late" (2 dias) ou "over"."""
    if ready:
        return "done"
    days = max(0, int(age_seconds or 0)) / 86400
    if days >= DEADLINE_DAYS:
        return "over"
    if days >= DEADLINE_DAYS - 1:
        return "late"
    if days >= 1:
        return "watch"
    return "ok"


def deadline_text(age_seconds, ready: bool, ready_seconds=None) -> str:
    """Uma frase para a caixa do administrador."""
    if ready:
        took = duration_label(ready_seconds) if ready_seconds is not None else "?"
        return f"Cardápio cadastrado em {took}."
    left = DEADLINE_DAYS * 86400 - max(0, int(age_seconds or 0))
    if left <= 0:
        return f"Passou do prazo de {DEADLINE_DAYS} dias (cadastrou {waiting_label(age_seconds)})."
    return f"Cadastrou {waiting_label(age_seconds)}. Faltam {duration_label(left)} para o prazo."


# ----------------------------------------------------------------------------------------------- visões

def topic_label(topic: str) -> str:
    return TOPICS.get(topic, TOPICS["outro"])


def owner_whatsapp(*numbers) -> str:
    """O primeiro número que parece de WhatsApp (só números, com 55), ou ""."""
    for value in numbers:
        digits = re.sub(r"\D", "", value or "")
        if digits.startswith("55") and len(digits) in (12, 13):
            return digits
        if len(digits) in (10, 11):
            return "55" + digits
    return ""


def inbox_row(row: dict) -> dict:
    """Um pedido aberto como a caixa do administrador mostra."""
    waiting = max(0, int(row.get("waiting_seconds") or 0))
    phone = owner_whatsapp(row.get("contact_phone"), row.get("owner_phone"))
    reply = (
        f"Oi, {_text(row.get('owner_name'), 60) or 'tudo bem'}! Aqui é do Vem Comer. "
        f"Vi que você pediu ajuda com: {topic_label(row['topic']).lower()}. Como posso ajudar?"
    )
    return {
        "id": str(row["id"]),
        "company_id": str(row["company_id"]),
        "company_name": row.get("company_name"),
        "slug": row.get("slug"),
        "owner_name": row.get("owner_name"),
        "topic": row["topic"],
        "topic_label": topic_label(row["topic"]),
        "screen": row.get("screen") or "",
        "message": row.get("message") or "",
        "repeats": int(row.get("repeats") or 0),
        "waiting_seconds": waiting,
        "waiting_label": waiting_label(waiting),
        "phone": phone,
        "whatsapp_url": whatsapp_link(phone, reply),
    }


def tracking_row(row: dict) -> dict | None:
    """Um cadastro feito pela internet como o acompanhamento mostra. None quando já passou do tempo de acompanhar."""
    age = max(0, int(row.get("age_seconds") or 0))
    products = int(row.get("products") or 0)
    ready = products >= MENU_READY_PRODUCTS
    if not ready and age > WATCH_DAYS * 86400:
        return None

    ready_seconds = row.get("ready_seconds")
    phone = owner_whatsapp(row.get("owner_phone"))
    state = deadline_state(age, ready)
    nudge = (
        f"Oi, {_text(row.get('owner_name'), 60) or 'tudo bem'}! Aqui é do Vem Comer. "
        "Vi que o cardápio do seu restaurante ainda não foi cadastrado. Posso te ajudar? "
        "É só mandar uma foto ou uma planilha do cardápio que eu cadastro."
    )
    return {
        "company_id": str(row["company_id"]),
        "company_name": row.get("name"),
        "slug": row.get("slug"),
        "owner_name": row.get("owner_name"),
        "owner_email": row.get("owner_email"),
        "products": products,
        "age_seconds": age,
        "age_label": waiting_label(age),
        "state": state,
        "ready": ready,
        "ready_seconds": int(ready_seconds) if ready and ready_seconds is not None else None,
        "text": deadline_text(age, ready, ready_seconds),
        "has_open_help": bool(row.get("has_open_help")),
        "phone": phone,
        "whatsapp_url": "" if ready else whatsapp_link(phone, nudge),
    }


_STATE_ORDER = {"over": 0, "late": 1, "watch": 2, "ok": 3, "done": 4}


def tracking_sort_key(row: dict) -> tuple:
    """Quem precisa de ajuda primeiro: passou do prazo, falta pouco, parado há um dia, recém-chegado, terminou."""
    return (_STATE_ORDER[row["state"]], -row["age_seconds"] if row["state"] != "done" else row["age_seconds"])


def tracking_summary(rows: list[dict]) -> dict:
    """Os números do cronômetro: quantos terminaram, quantos estão parados e o tempo típico dos que terminaram."""
    done = sorted(r["ready_seconds"] for r in rows if r["ready"] and r["ready_seconds"] is not None)
    median = None
    if done:
        middle = len(done) // 2
        median = done[middle] if len(done) % 2 else (done[middle - 1] + done[middle]) // 2
    within = sum(1 for seconds in done if seconds <= DEADLINE_DAYS * 86400)
    return {
        "total": len(rows),
        "done": len(done),
        "done_within_deadline": within,
        "stalled": sum(1 for r in rows if not r["ready"]),
        "over_deadline": sum(1 for r in rows if r["state"] == "over"),
        "median_seconds": median,
        "median_label": duration_label(median) if median is not None else "",
    }


# ----------------------------------------------------------------------------------------------- SQL

SQL_CONTEXT = """
    SELECT c.name AS company_name, c.owner_phone, u.name AS user_name
    FROM companies c
    LEFT JOIN users u ON u.id = %s AND u.company_id = c.id
    WHERE c.id = %s
"""

SQL_OPEN_ONE = """
    SELECT id, topic
    FROM help_requests
    WHERE company_id = %s AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
"""

# Pedir de novo com o pedido ainda aberto atualiza o mesmo pedido. Sem texto novo, fica o texto de antes.
SQL_UPDATE_OPEN = """
    UPDATE help_requests
    SET topic = %s, screen = %s,
        message = CASE WHEN %s = '' THEN message ELSE %s END,
        contact_phone = COALESCE(%s, contact_phone),
        repeats = LEAST(repeats + 1, %s)
    WHERE id = %s AND company_id = %s AND status = 'open'
    RETURNING id
"""

MAX_REPEATS = 9

SQL_INSERT = """
    INSERT INTO help_requests (company_id, user_id, topic, screen, message, contact_phone)
    VALUES (%s, %s, %s, %s, %s, %s)
    RETURNING id
"""

SQL_INBOX = """
    SELECT h.id, h.company_id, h.topic, h.screen, h.message, h.contact_phone, h.repeats,
           c.name AS company_name, c.slug, c.owner_phone,
           u.name AS owner_name,
           GREATEST(0, EXTRACT(EPOCH FROM (now() - h.created_at)))::bigint AS waiting_seconds
    FROM help_requests h
    JOIN companies c ON c.id = h.company_id
    LEFT JOIN LATERAL (
        SELECT name FROM users
        WHERE company_id = c.id AND role = 'OWNER' AND active = TRUE
        ORDER BY created_at LIMIT 1
    ) u ON TRUE
    WHERE h.status = 'open'
    ORDER BY h.repeats DESC, h.created_at ASC
    LIMIT 200
"""

SQL_TRACKING = """
    SELECT c.id AS company_id, c.name, c.slug, c.owner_phone,
           GREATEST(0, EXTRACT(EPOCH FROM (now() - c.created_at)))::bigint AS age_seconds,
           (SELECT count(*) FROM products p WHERE p.company_id = c.id AND p.active) AS products,
           (SELECT GREATEST(0, EXTRACT(EPOCH FROM (p.created_at - c.created_at)))::bigint
              FROM products p WHERE p.company_id = c.id AND p.active
              ORDER BY p.created_at OFFSET %s LIMIT 1) AS ready_seconds,
           EXISTS(SELECT 1 FROM help_requests h WHERE h.company_id = c.id AND h.status = 'open') AS has_open_help,
           u.name AS owner_name, u.email AS owner_email
    FROM companies c
    LEFT JOIN LATERAL (
        SELECT name, email FROM users
        WHERE company_id = c.id AND role = 'OWNER' AND active = TRUE
        ORDER BY created_at LIMIT 1
    ) u ON TRUE
    WHERE c.signup_source = 'web'
    ORDER BY c.created_at DESC
    LIMIT 300
"""

SQL_RESOLVE = """
    UPDATE help_requests
    SET status = 'done', resolved_at = now(), resolved_by = %s
    WHERE id = %s AND status = 'open'
    RETURNING id
"""

SQL_EXISTS = "SELECT status FROM help_requests WHERE id = %s"
