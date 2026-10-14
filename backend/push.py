"""Avisos no celular com o app fechado (Web Push, requisito 52).

O painel ja apita e vibra quando esta aberto (frontend/src/service/alertDevice.ts). Aqui o servidor avisa tambem quem
fechou o app ou bloqueou a tela: entra pedido novo, uma mesa chama o garcom, uma entrega fica pronta.

Como funciona, em palavras:
- quem entra no painel e toca em "Ativar aviso" autoriza o celular; o celular entrega ao servidor um endereco secreto
  (o "endpoint") e duas chaves de criptografia. Isso fica em push_subscriptions (migracao 016);
- quando o evento acontece, o servidor monta uma mensagem curta, criptografa com as chaves daquele aparelho, assina com
  a chave VAPID deste servidor e entrega ao servico de notificacao (Google, Mozilla, Apple, Microsoft), que acorda o
  celular. A biblioteca pywebpush faz a criptografia e a assinatura; este arquivo so decide QUEM recebe, O QUE diz e
  protege a porta.

Seguranca, por ser uma rota que faz o servidor chamar um endereco que vem de fora:
- o endereco do aparelho so vale se for HTTPS, na porta 443, sem usuario e de um dos servicos de notificacao conhecidos
  (lista abaixo). Sem isso um funcionario poderia mandar o servidor chamar qualquer endereco da rede interna;
- cada pessoa guarda no maximo 5 aparelhos; a chave publica e as chaves do aparelho sao conferidas antes de gravar;
- a mensagem nunca leva nome, telefone, endereco ou valor: so "Pedido novo - Mesa 4" e parecidos, porque aparece com
  a tela bloqueada;
- o endpoint nunca vai para o log nem para a resposta;
- nada aqui derruba o pedido: o envio roda em segundo plano e qualquer erro vira so uma linha de log.

So liga com PUSH_ENABLED=1 (o docker-compose liga) e com a biblioteca instalada. Sem isso tudo aqui fica quieto.
"""

from __future__ import annotations

import base64
import binascii
import importlib.util
import json
import logging
import os
import re
import threading
import time
from functools import wraps
from urllib.parse import urlsplit

LOG = logging.getLogger("vemcomer.push")

# ---------------------------------------------------------------------------------------------------- quem recebe o que
EVENT_ROLES = {
    "new_order": ("OWNER", "MANAGER", "KITCHEN", "CASHIER"),
    "table_call": ("OWNER", "MANAGER", "WAITER"),
    "delivery_ready": ("OWNER", "MANAGER", "COURIER"),
}

# Eventos que nao sao de um restaurante: quem recebe sao os administradores da plataforma (PLATFORM_ADMIN_EMAILS), em
# qualquer restaurante em que tenham entrado.
PLATFORM_EVENTS = ("help_request", "titular_request")

# Quanto tempo o servico de notificacao guarda a mensagem se o celular estiver sem sinal (segundos).
EVENT_TTL = {"new_order": 600, "table_call": 300, "delivery_ready": 600, "help_request": 3600, "titular_request": 3600, "test": 60}

MAX_PER_USER = 5
MAX_TARGETS = 100
MAX_FAILURES = 8
SEND_TIMEOUT = 6

# Servicos de notificacao conhecidos. Entrada que comeca com "." vale para qualquer subdominio.
ALLOWED_HOSTS = (
    "fcm.googleapis.com",  # Chrome, Edge, Opera, Samsung e os demais navegadores do Android
    ".push.services.mozilla.com",  # Firefox
    ".push.apple.com",  # Safari
    ".notify.windows.com",  # Edge no Windows
)

_B64URL = re.compile(r"^[A-Za-z0-9_-]+$")


class PushError(ValueError):
    """Entrada que nao da para aceitar; a mensagem vai para a tela e `status` e o codigo da resposta."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


class Gone(Exception):
    """O servico de notificacao disse que esse aparelho nao existe mais (404 ou 410)."""


class Failed(Exception):
    """O envio falhou por outro motivo (sem rede, servico fora do ar, recusa)."""


# ---------------------------------------------------------------------------------------------------- ligar e desligar
def enabled() -> bool:
    """Liga so com PUSH_ENABLED=1 e com a biblioteca de envio instalada."""
    if os.environ.get("PUSH_ENABLED", "").strip().lower() not in ("1", "true", "yes"):
        return False
    return importlib.util.find_spec("pywebpush") is not None


def vapid_subject() -> str:
    """Quem responde por este servidor perante o servico de notificacao: um https:// ou mailto:."""
    explicit = os.environ.get("VAPID_SUBJECT", "").strip()
    if explicit.startswith(("https://", "mailto:")):
        return explicit
    origin = os.environ.get("CORS_ORIGIN_REGEX", "").strip()
    if origin.startswith("https://") and len(origin) < 200 and " " not in origin:
        return origin
    for mail in os.environ.get("PLATFORM_ADMIN_EMAILS", "").split(","):
        mail = mail.strip()
        if "@" in mail:
            return "mailto:" + mail
    return "https://vemcomer.invalid"


# ---------------------------------------------------------------------------------------------------- entrada do aparelho
def _b64url_decode(value: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (binascii.Error, ValueError):
        raise PushError("Dados do aparelho invalidos.")


def endpoint_allowed(endpoint: object) -> bool:
    """So HTTPS, porta 443, sem usuario, de um servico de notificacao conhecido."""
    if not isinstance(endpoint, str) or not endpoint or len(endpoint) > 1000:
        return False
    if any(ord(ch) < 33 or ord(ch) > 126 for ch in endpoint):
        return False
    try:
        parts = urlsplit(endpoint)
        port = parts.port
    except ValueError:
        return False
    if parts.scheme != "https" or parts.username or parts.password or port not in (None, 443):
        return False
    if not parts.path or parts.path == "/" or parts.fragment:
        return False
    host = (parts.hostname or "").lower().rstrip(".")
    if not host or host.replace(".", "").isdigit():
        return False
    for allowed in ALLOWED_HOSTS:
        if allowed.startswith("."):
            if host.endswith(allowed) and len(host) > len(allowed):
                return True
        elif host == allowed:
            return True
    return False


def clean_subscription(payload: object) -> dict:
    """Confere o que o navegador entregou (PushSubscription.toJSON()). Levanta PushError."""
    if not isinstance(payload, dict):
        raise PushError("Pedido invalido.")
    endpoint = payload.get("endpoint")
    keys = payload.get("keys")
    if not endpoint_allowed(endpoint):
        raise PushError("Este navegador usa um servico de aviso que o sistema nao aceita.")
    if not isinstance(keys, dict):
        raise PushError("Dados do aparelho invalidos.")
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not isinstance(p256dh, str) or not isinstance(auth, str):
        raise PushError("Dados do aparelho invalidos.")
    if not _B64URL.match(p256dh) or not _B64URL.match(auth):
        raise PushError("Dados do aparelho invalidos.")
    # a chave do aparelho e um ponto P-256 sem compressao (65 bytes, comeca com 4); o segredo de autenticacao tem 16 bytes
    point = _b64url_decode(p256dh)
    secret = _b64url_decode(auth)
    if len(point) != 65 or point[:1] != b"\x04" or len(secret) != 16:
        raise PushError("Dados do aparelho invalidos.")
    return {"endpoint": endpoint, "p256dh": p256dh, "auth": auth}


# ---------------------------------------------------------------------------------------------------- mensagens
def _text(value: object, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def make_payload(title: str, body: str, tag: str, url: str = "/") -> dict:
    return {"title": _text(title, 60), "body": _text(body, 120), "tag": _text(tag, 80), "url": url if url.startswith("/") else "/"}


def where_label(order_type: object, table_number: object = None) -> str:
    """"Mesa 4", "Entrega", "Retirada" ou "Balcao": so isso aparece na tela bloqueada."""
    if table_number not in (None, ""):
        return f"Mesa {_text(table_number, 10)}"
    if order_type == "entrega":
        return "Entrega"
    if order_type == "retirada":
        return "Retirada"
    return "Balcão"


def new_order_payload(order_id: object, order_type: object = None, table_number: object = None) -> dict:
    return make_payload("Pedido novo", where_label(order_type, table_number), f"pedido-{order_id}")


def table_call_payload(phrase: str, table_number: object, kind: str) -> dict:
    who = f"Mesa {_text(table_number, 10)}" if table_number not in (None, "") else "Uma mesa"
    return make_payload(f"{who} {phrase}", "Toque para abrir o painel.", f"mesa-{_text(table_number, 10)}-{_text(kind, 12)}")


def help_request_payload(company_id: object, company_name: object, topic: object, again: bool = False) -> dict:
    """Para o administrador da plataforma: o restaurante e o assunto. O texto que o dono escreveu fica so na caixa de chamados."""
    place = _text(company_name, 40) or "Um restaurante"
    what = _text(topic, 30) or "ajuda"
    title = "Chamado de novo" if again else "Chamado de ajuda"
    return make_payload(title, f"{place}: {what}", f"ajuda-{company_id}")


def titular_request_payload(is_report: bool) -> dict:
    """Para o administrador da plataforma: so o tipo e o prazo. O contato e o texto da pessoa ficam na caixa de pedidos."""
    if is_report:
        return make_payload("Denúncia de conteúdo", "Prazo de 2 dias. Abra a caixa de pedidos.", "titular-denuncia")
    return make_payload("Pedido de dados pessoais", "Prazo de 15 dias. Abra a caixa de pedidos.", "titular-pedido")


def delivery_ready_payload(order_id: object) -> dict:
    return make_payload("Entrega pronta", "Tem pedido esperando você pegar.", f"entrega-{order_id}")


def test_payload() -> dict:
    return make_payload("Aviso funcionando", "Seu celular vai receber os avisos do Vem Comer.", "teste")


# ---------------------------------------------------------------------------------------------------- chave do servidor
def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_keypair() -> tuple[str, str]:
    """(chave publica em base64url, chave privada em PEM). A publica e o que o navegador recebe para se inscrever."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode("ascii")
    public = key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return b64url(public), pem


SQL_KEYS = "SELECT public_key, private_key FROM push_config WHERE id = 1;"

SQL_INSERT_KEYS = """
    INSERT INTO push_config (id, public_key, private_key)
    VALUES (1, %s, %s)
    ON CONFLICT (id) DO NOTHING;
"""


def ensure_keys(cur) -> tuple[str, str]:
    """(publica, privada). Cria o par na primeira vez; duas chamadas ao mesmo tempo acabam com o mesmo par."""
    cur.execute(SQL_KEYS)
    row = cur.fetchone()
    if not row:
        public, private = generate_keypair()
        cur.execute(SQL_INSERT_KEYS, (public, private))
        cur.execute(SQL_KEYS)
        row = cur.fetchone()
    return column(row, "public_key", 0), column(row, "private_key", 1)


def column(row, name: str, index: int):
    """Um campo de uma linha do banco, venha ela como dicionario (RealDictCursor) ou como tupla. Falta vira None."""
    if row is None:
        return None
    if hasattr(row, "keys"):
        return row.get(name)
    try:
        return row[index]
    except (IndexError, TypeError):
        return None


# ---------------------------------------------------------------------------------------------------- banco
# clock_timestamp() e nao now(): a ordem "mais recente" nao pode empatar nem dentro de uma mesma transacao
SQL_UPSERT = """
    INSERT INTO push_subscriptions (company_id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (%s, %s, %s, %s, %s, clock_timestamp())
    ON CONFLICT (endpoint) DO UPDATE
       SET company_id = EXCLUDED.company_id,
           user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           failures = 0,
           created_at = clock_timestamp()
    RETURNING id;
"""

# cada pessoa guarda os MAX_PER_USER aparelhos mais recentes; o resto sai
SQL_TRIM = """
    DELETE FROM push_subscriptions
    WHERE user_id = %s
      AND id NOT IN (
          SELECT id FROM push_subscriptions
          WHERE user_id = %s
          ORDER BY created_at DESC, id
          LIMIT %s
      );
"""

SQL_REMOVE_MINE = "DELETE FROM push_subscriptions WHERE endpoint = %s AND user_id = %s AND company_id = %s;"

SQL_TARGETS_BY_ROLE = """
    SELECT s.id, s.endpoint, s.p256dh, s.auth
    FROM push_subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.company_id = %s AND u.company_id = %s AND u.active = TRUE AND u.role = ANY(%s)
    ORDER BY s.created_at
    LIMIT %s;
"""

SQL_TARGETS_OF_USER = """
    SELECT s.id, s.endpoint, s.p256dh, s.auth
    FROM push_subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.company_id = %s AND s.user_id = %s AND u.active = TRUE
    ORDER BY s.created_at
    LIMIT %s;
"""

SQL_TARGETS_PLATFORM = """
    SELECT s.id, s.endpoint, s.p256dh, s.auth
    FROM push_subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE u.active = TRUE AND lower(u.email) = ANY(%s)
    ORDER BY s.created_at
    LIMIT %s;
"""

SQL_MARK_OK = "UPDATE push_subscriptions SET failures = 0, last_ok_at = now() WHERE id = %s;"
SQL_MARK_FAILED = "UPDATE push_subscriptions SET failures = failures + 1 WHERE id = %s;"
SQL_DROP_GONE = "DELETE FROM push_subscriptions WHERE id = %s;"
SQL_DROP_TIRED = "DELETE FROM push_subscriptions WHERE id = %s AND failures >= %s;"

SQL_ORDER_FACTS = """
    SELECT o.order_type, t.number AS table_number
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    WHERE o.id = %s AND o.company_id = %s;
"""


def save_subscription(cur, company_id, user_id, subscription: dict) -> None:
    cur.execute(
        SQL_UPSERT,
        (str(company_id), str(user_id), subscription["endpoint"], subscription["p256dh"], subscription["auth"]),
    )
    cur.execute(SQL_TRIM, (str(user_id), str(user_id), MAX_PER_USER))


# ---------------------------------------------------------------------------------------------------- envio
def _webpush_send(target: dict, payload: dict, private_pem: str, subject: str, ttl: int) -> None:
    """Criptografa, assina e entrega uma mensagem. Gone se o aparelho nao existe mais; Failed no resto."""
    from py_vapid import Vapid
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={
                "endpoint": target["endpoint"],
                "keys": {"p256dh": target["p256dh"], "auth": target["auth"]},
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=Vapid.from_pem(private_pem.encode("ascii")),
            vapid_claims={"sub": subject},
            ttl=ttl,
            timeout=SEND_TIMEOUT,
            headers={"Urgency": "high"},
        )
    except WebPushException as error:
        if error.status_code in (404, 410):
            raise Gone()
        raise Failed(f"servico respondeu {error.status_code}")
    except Exception as error:  # rede fora, tempo esgotado, chave ruim
        raise Failed(type(error).__name__)


def deliver(targets: list, payload: dict, private_pem: str, event: str, send=None) -> dict:
    """Manda a mesma mensagem para cada aparelho. Devolve {"ok": [...ids], "gone": [...], "failed": [...]}. Nunca levanta."""
    send = send or _webpush_send
    ttl = EVENT_TTL.get(event, 300)
    subject = vapid_subject()
    result = {"ok": [], "gone": [], "failed": []}
    for target in targets:
        key = str(target["id"])
        try:
            send(target, payload, private_pem, subject, ttl)
            result["ok"].append(key)
        except Gone:
            result["gone"].append(key)
        except Exception as error:
            result["failed"].append(key)
            LOG.warning("aviso nao entregue (%s): %s", event, error)
    return result


def record(cur, result: dict) -> None:
    """Grava o resultado do envio: aparelho que sumiu sai, o que falhou conta ponto, o que entregou zera."""
    for key in result["gone"]:
        cur.execute(SQL_DROP_GONE, (key,))
    for key in result["failed"]:
        cur.execute(SQL_MARK_FAILED, (key,))
        cur.execute(SQL_DROP_TIRED, (key, MAX_FAILURES))
    for key in result["ok"]:
        cur.execute(SQL_MARK_OK, (key,))


def platform_emails() -> set:
    """Os e-mails dos administradores da plataforma (PLATFORM_ADMIN_EMAILS), em minusculas."""
    import subscription

    return subscription.platform_admin_emails()


def _connect():
    from db import get_db_connection

    return get_db_connection()


def _close(conn) -> None:
    try:
        if conn is not None and not conn.closed:
            conn.close()
    except Exception:
        pass


def send_event(event: str, company_id, build_payload, user_id=None, connect=None, send=None) -> dict:
    """Roda o envio inteiro (busca quem recebe, entrega, grava). `build_payload(cur)` monta a mensagem.

    Sem segurar o banco durante a entrega: a conexao abre para ler, fecha, o envio acontece, e abre de novo para gravar.
    Nunca levanta; devolve o resultado (listas vazias se nada foi feito).
    """
    connect = connect or _connect
    empty = {"ok": [], "gone": [], "failed": []}
    conn = None
    try:
        conn = connect()
        cur = conn.cursor()
        public, private = ensure_keys(cur)
        payload = build_payload(cur)
        if user_id is not None:
            cur.execute(SQL_TARGETS_OF_USER, (str(company_id), str(user_id), MAX_PER_USER))
        elif event in PLATFORM_EVENTS:
            emails = sorted(platform_emails())
            if not emails:
                conn.commit()
                return empty
            cur.execute(SQL_TARGETS_PLATFORM, (emails, MAX_TARGETS))
        else:
            roles = list(EVENT_ROLES[event])
            cur.execute(SQL_TARGETS_BY_ROLE, (str(company_id), str(company_id), roles, MAX_TARGETS))
        targets = [
            {"id": column(row, "id", 0), "endpoint": column(row, "endpoint", 1), "p256dh": column(row, "p256dh", 2), "auth": column(row, "auth", 3)}
            for row in (cur.fetchall() or [])
        ]
        conn.commit()
        cur.close()
        _close(conn)
        conn = None
        if not targets or not payload:
            return empty

        result = deliver(targets, payload, private, event, send)

        conn = connect()
        cur = conn.cursor()
        record(cur, result)
        conn.commit()
        cur.close()
        return result
    except Exception as error:
        LOG.warning("aviso nao enviado (%s): %s", event, type(error).__name__)
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
        return empty
    finally:
        _close(conn)


# no maximo 4 envios ao mesmo tempo; os outros esperam a vez em vez de lotar o servidor
_slots = threading.BoundedSemaphore(4)


def _in_background(job) -> None:
    def run():
        with _slots:
            job()

    try:
        threading.Thread(target=run, name="push-send", daemon=True).start()
    except Exception as error:  # sem memoria para uma thread nova: o pedido ja esta gravado, so o aviso se perde
        LOG.warning("aviso nao iniciado: %s", type(error).__name__)


def never_raises(function):
    """Quem chama (a rota que acabou de gravar um pedido) nunca ve erro daqui."""

    @wraps(function)
    def wrapper(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except Exception as error:
            LOG.warning("aviso nao preparado (%s): %s", function.__name__, type(error).__name__)
            return None

    return wrapper


@never_raises
def notify_new_order(company_id, order_id) -> None:
    """Pedido novo: dono, gerente, cozinha e caixa. Chamado depois que o pedido foi gravado."""
    if not enabled():
        return

    def build(cur):
        cur.execute(SQL_ORDER_FACTS, (str(order_id), str(company_id)))
        row = cur.fetchone()
        if not row:
            return None
        return new_order_payload(order_id, column(row, "order_type", 0), column(row, "table_number", 1))

    _in_background(lambda: send_event("new_order", company_id, build))


@never_raises
def notify_table_call(company_id, kind: str, phrase: str, table_number) -> None:
    """Mesa chamou: dono, gerente e garcom."""
    if not enabled():
        return
    payload = table_call_payload(phrase, table_number, kind)
    _in_background(lambda: send_event("table_call", company_id, lambda cur: payload))


@never_raises
def notify_delivery_ready(company_id, order_id) -> None:
    """Entrega pronta para pegar: motoqueiros, dono e gerente."""
    if not enabled():
        return
    payload = delivery_ready_payload(order_id)
    _in_background(lambda: send_event("delivery_ready", company_id, lambda cur: payload))


@never_raises
def notify_help_request(company_id, company_name, topic_label: str, again: bool = False) -> None:
    """O dono pediu ajuda: avisa o administrador da plataforma. Sem administrador configurado, nao faz nada (nem toca no banco)."""
    if not enabled() or not platform_emails():
        return
    payload = help_request_payload(company_id, company_name, topic_label, again)
    _in_background(lambda: send_event("help_request", None, lambda cur: payload))


@never_raises
def notify_titular_request(is_report: bool = False) -> None:
    """Chegou pedido do titular dos dados (LGPD) ou denúncia: avisa o administrador da plataforma, que tem prazo a cumprir."""
    if not enabled() or not platform_emails():
        return
    payload = titular_request_payload(is_report)
    _in_background(lambda: send_event("titular_request", None, lambda cur: payload))


def send_test(company_id, user_id, connect=None, send=None) -> dict:
    """O aviso de teste do botao: vai so para os aparelhos de quem tocou, e a resposta diz quantos receberam."""
    return send_event("test", company_id, lambda cur: test_payload(), user_id=user_id, connect=connect, send=send)


# ---------------------------------------------------------------------------------------------------- limite do teste
class TestLimiter:
    """Um aviso de teste a cada 10 segundos por pessoa (memoria do processo, como os outros limites)."""

    __test__ = False  # nao e um teste do unittest/pytest

    def __init__(self, seconds: int = 10, clock=time.monotonic):
        self.seconds = seconds
        self.clock = clock
        self._last: dict[str, float] = {}
        self._lock = threading.Lock()

    def check(self, user_id) -> None:
        now = self.clock()
        with self._lock:
            if len(self._last) > 2000:
                self._last = {k: v for k, v in self._last.items() if now - v < self.seconds}
            last = self._last.get(str(user_id))
            if last is not None and now - last < self.seconds:
                raise PushError("Espere alguns segundos para testar de novo.", 429)
            self._last[str(user_id)] = now
