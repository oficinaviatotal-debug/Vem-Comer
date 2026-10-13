"""Avisos no celular (push.py + as rotas de app.py). Roda no CI; o banco é simulado.

O último grupo (RealDeliveryTests) manda uma mensagem de verdade pela biblioteca de envio para um servidor de mentira
na própria máquina e abre a mensagem do outro lado com a chave do aparelho: prova que a criptografia e a assinatura
saem corretas. Só roda onde a biblioteca está instalada (no CI está).
"""

import base64
import http.server
import importlib.util
import json
import os
import threading
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import push  # noqa: E402
import help_requests  # noqa: E402
import test_delivery_endpoint as delivery_tests  # noqa: E402
import test_help_requests_endpoint as help_tests  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
ORDER_ID = "55555555-5555-4555-8555-555555555555"
TABLE_ID = "66666666-6666-4666-8666-666666666666"
ME = "aaaaaaaa-0000-4000-8000-000000000002"

GOOD_ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123:APA91bExample"


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def device_keys():
    """As chaves que um navegador entregaria: (privada, p256dh, auth) no formato do PushSubscription.toJSON()."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    private = ec.generate_private_key(ec.SECP256R1())
    point = private.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return private, b64(point), b64(os.urandom(16))


def subscription(endpoint=GOOD_ENDPOINT):
    _private, p256dh, auth_secret = device_keys()
    return {"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth_secret}}


def auth(role="OWNER", company_id=COMPANY_ID, user_id=ME):
    token = backend_app.serializer.dumps({"user_id": user_id, "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


def norm(sql):
    return " ".join(sql.split())


# ------------------------------------------------------------------------------------------------ o endereço do aparelho
class EndpointTests(unittest.TestCase):
    def test_known_notification_services_are_accepted(self):
        for url in (
            "https://fcm.googleapis.com/fcm/send/abc",
            "https://updates.push.services.mozilla.com/wpush/v2/abc",
            "https://web.push.apple.com/QAb123",
            "https://wns2-par02p.notify.windows.com/w/?token=abc",
            "https://fcm.googleapis.com:443/fcm/send/abc",
        ):
            self.assertTrue(push.endpoint_allowed(url), url)

    def test_anything_else_is_refused(self):
        refused = (
            "http://fcm.googleapis.com/fcm/send/abc",  # sem HTTPS
            "https://localhost/x",
            "https://127.0.0.1/x",
            "https://169.254.169.254/latest/meta-data",
            "https://10.0.0.5/x",
            "https://api:5000/health",  # o servidor da API na rede interna
            "https://db/x",
            "https://fcm.googleapis.com.evil.example/x",  # parecido, mas de outro dono
            "https://evilfcm.googleapis.com.evil.example/x",
            "https://notfcm.googleapis.com/x",
            "https://push.apple.com/x",  # sem subdominio nao e o servico
            "https://user:pass@fcm.googleapis.com/x",
            "https://fcm.googleapis.com:8443/x",
            "https://fcm.googleapis.com",  # sem caminho
            "https://fcm.googleapis.com/",
            "https://fcm.googleapis.com/x#frag",
            "https://fcm.googleapis.com/x y",
            "https://fcm.googleapis.com/ç",
            "ftp://fcm.googleapis.com/x",
            "javascript:alert(1)",
            "",
            None,
            123,
            ["https://fcm.googleapis.com/x"],
            "https://fcm.googleapis.com/" + "a" * 1001,
        )
        for url in refused:
            self.assertFalse(push.endpoint_allowed(url), repr(url))


class SubscriptionTests(unittest.TestCase):
    def test_a_real_subscription_is_accepted_and_trimmed_to_three_fields(self):
        raw = subscription()
        raw["expirationTime"] = None
        raw["extra"] = "ignored"
        clean = push.clean_subscription(raw)
        self.assertEqual(set(clean), {"endpoint", "p256dh", "auth"})
        self.assertEqual(clean["endpoint"], GOOD_ENDPOINT)

    def test_bad_input_is_refused_with_a_message(self):
        good = subscription()
        cases = [
            None, [], "x", {},
            {"endpoint": GOOD_ENDPOINT},
            {"endpoint": GOOD_ENDPOINT, "keys": "x"},
            {"endpoint": GOOD_ENDPOINT, "keys": {"p256dh": good["keys"]["p256dh"]}},
            {"endpoint": GOOD_ENDPOINT, "keys": {"p256dh": 1, "auth": 2}},
            {"endpoint": GOOD_ENDPOINT, "keys": {"p256dh": "short", "auth": good["keys"]["auth"]}},
            {"endpoint": GOOD_ENDPOINT, "keys": {"p256dh": good["keys"]["p256dh"], "auth": "short"}},
            {"endpoint": GOOD_ENDPOINT, "keys": {"p256dh": "!" * 87, "auth": good["keys"]["auth"]}},
            # ponto que nao comeca com o byte 4 (nao e um ponto sem compressao)
            {"endpoint": GOOD_ENDPOINT, "keys": {"p256dh": b64(b"\x02" + os.urandom(64)), "auth": good["keys"]["auth"]}},
            {"endpoint": "https://evil.example/x", "keys": good["keys"]},
        ]
        for case in cases:
            with self.assertRaises(push.PushError, msg=repr(case)) as caught:
                push.clean_subscription(case)
            self.assertEqual(caught.exception.status, 400)
            self.assertTrue(caught.exception.message)


# ------------------------------------------------------------------------------------------------ as mensagens
class PayloadTests(unittest.TestCase):
    def test_an_order_message_says_only_where_and_never_who_or_how_much(self):
        self.assertEqual(push.new_order_payload(ORDER_ID, "entrega")["body"], "Entrega")
        self.assertEqual(push.new_order_payload(ORDER_ID, "retirada")["body"], "Retirada")
        self.assertEqual(push.new_order_payload(ORDER_ID, None)["body"], "Balcão")
        self.assertEqual(push.new_order_payload(ORDER_ID, "mesa", 4)["body"], "Mesa 4")
        self.assertEqual(push.new_order_payload(ORDER_ID, "entrega", None)["title"], "Pedido novo")

    def test_a_table_call_message_names_the_table_and_the_request(self):
        payload = push.table_call_payload("chama o garçom", 4, "garcom")
        self.assertEqual(payload["title"], "Mesa 4 chama o garçom")
        self.assertEqual(push.table_call_payload("pede a conta", None, "conta")["title"], "Uma mesa pede a conta")

    def test_every_message_is_small_and_points_inside_the_app(self):
        payloads = [
            push.new_order_payload(ORDER_ID, "mesa", 4),
            push.table_call_payload("pede limpeza da mesa", 12, "limpeza"),
            push.delivery_ready_payload(ORDER_ID),
            push.test_payload(),
            push.make_payload("t" * 500, "b" * 500, "x" * 500, "https://evil.example/"),
        ]
        for payload in payloads:
            self.assertEqual(set(payload), {"title", "body", "tag", "url"})
            self.assertLessEqual(len(json.dumps(payload).encode("utf-8")), 700)
            self.assertTrue(payload["url"].startswith("/"))
        self.assertEqual(payloads[-1]["url"], "/")

    def test_two_deliveries_do_not_share_a_tag_but_a_repeated_call_does(self):
        self.assertNotEqual(push.delivery_ready_payload("a")["tag"], push.delivery_ready_payload("b")["tag"])
        self.assertEqual(
            push.table_call_payload("chama o garçom", 4, "garcom")["tag"],
            push.table_call_payload("chama o garçom", 4, "garcom")["tag"],
        )

    def test_who_receives_what(self):
        self.assertEqual(set(push.EVENT_ROLES["new_order"]), {"OWNER", "MANAGER", "KITCHEN", "CASHIER"})
        self.assertEqual(set(push.EVENT_ROLES["table_call"]), {"OWNER", "MANAGER", "WAITER"})
        self.assertEqual(set(push.EVENT_ROLES["delivery_ready"]), {"OWNER", "MANAGER", "COURIER"})
        self.assertNotIn("COURIER", push.EVENT_ROLES["new_order"])
        self.assertNotIn("COURIER", push.EVENT_ROLES["table_call"])


class SwitchTests(unittest.TestCase):
    def test_it_is_off_unless_asked_for(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("PUSH_ENABLED", None)
            self.assertFalse(push.enabled())
        with patch.dict(os.environ, {"PUSH_ENABLED": "0"}):
            self.assertFalse(push.enabled())

    def test_it_needs_the_library_too(self):
        with patch.dict(os.environ, {"PUSH_ENABLED": "1"}), patch("importlib.util.find_spec", return_value=None):
            self.assertFalse(push.enabled())
        with patch.dict(os.environ, {"PUSH_ENABLED": "1"}), patch("importlib.util.find_spec", return_value=object()):
            self.assertTrue(push.enabled())

    def test_the_vapid_subject_is_an_https_or_mailto_address(self):
        with patch.dict(os.environ, {"VAPID_SUBJECT": "mailto:a@b.com", "CORS_ORIGIN_REGEX": "https://x.com"}):
            self.assertEqual(push.vapid_subject(), "mailto:a@b.com")
        with patch.dict(os.environ, {"VAPID_SUBJECT": "", "CORS_ORIGIN_REGEX": "https://meu.restaurante.com"}):
            self.assertEqual(push.vapid_subject(), "https://meu.restaurante.com")
        with patch.dict(os.environ, {"VAPID_SUBJECT": "", "CORS_ORIGIN_REGEX": "", "PLATFORM_ADMIN_EMAILS": "gd@x.com, y@z.com"}):
            self.assertEqual(push.vapid_subject(), "mailto:gd@x.com")
        with patch.dict(os.environ, {"VAPID_SUBJECT": "javascript:x", "CORS_ORIGIN_REGEX": "", "PLATFORM_ADMIN_EMAILS": ""}):
            self.assertTrue(push.vapid_subject().startswith("https://"))


# ------------------------------------------------------------------------------------------------ chave do servidor
class KeyTests(unittest.TestCase):
    def test_the_public_key_is_the_65_byte_point_the_browser_expects(self):
        public, private = push.generate_keypair()
        raw = base64.urlsafe_b64decode(public + "=" * (-len(public) % 4))
        self.assertEqual((len(raw), raw[:1]), (65, b"\x04"))
        self.assertNotIn("=", public)
        self.assertTrue(private.startswith("-----BEGIN PRIVATE KEY-----"))
        self.assertNotEqual(push.generate_keypair()[0], public)

    def test_the_pair_is_made_once_and_then_reused(self):
        stored = []
        executed = []

        class Cur:
            def execute(self, sql, params=()):
                executed.append((norm(sql), params))
                if norm(sql).startswith("INSERT INTO push_config") and not stored:
                    stored.append({"public_key": params[0], "private_key": params[1]})

            def fetchone(self):
                return stored[0] if stored else None

        first = push.ensure_keys(Cur())
        second = push.ensure_keys(Cur())
        self.assertEqual(first, second)
        self.assertEqual(len([e for e in executed if e[0].startswith("INSERT INTO push_config")]), 1)
        self.assertIn("ON CONFLICT (id) DO NOTHING", norm(push.SQL_INSERT_KEYS))


# ------------------------------------------------------------------------------------------------ banco de mentira
class FakeConn:
    def __init__(self, targets=(), keys=("PUB", "PEM"), order=("entrega", None), fail_connect_after=None, log=None):
        self.targets = list(targets)
        self.keys = keys
        self.order = order
        self.executed = []
        self.closed = False
        self.commit = MagicMock()
        self.rollback = MagicMock()
        self.log = log if log is not None else []
        self._last = ""

    def cursor(self, *args, **kwargs):
        return self

    def execute(self, sql, params=()):
        self._last = norm(sql)
        self.executed.append((self._last, params))

    def fetchone(self):
        if self._last == norm(push.SQL_KEYS):
            return {"public_key": self.keys[0], "private_key": self.keys[1]}
        if self._last == norm(push.SQL_ORDER_FACTS):
            return {"order_type": self.order[0], "table_number": self.order[1]} if self.order else None
        return None

    def fetchall(self):
        if self._last in (norm(push.SQL_TARGETS_BY_ROLE), norm(push.SQL_TARGETS_OF_USER)):
            return self.targets
        return []

    def close(self):
        self.closed = True
        self.log.append("db closed")

    def ran(self, sql):
        return [p for s, p in self.executed if s == norm(sql)]


def target(n, endpoint=None):
    return {"id": f"sub-{n}", "endpoint": endpoint or f"https://fcm.googleapis.com/fcm/send/{n}", "p256dh": "P", "auth": "A"}


class DeliverTests(unittest.TestCase):
    def test_each_device_gets_the_message_and_one_failure_does_not_stop_the_rest(self):
        sent = []

        def send(item, payload, pem, subject, ttl):
            sent.append((item["id"], payload["title"], pem, ttl))
            if item["id"] == "sub-2":
                raise push.Gone()
            if item["id"] == "sub-3":
                raise push.Failed("fora do ar")

        result = push.deliver([target(1), target(2), target(3), target(4)], push.test_payload(), "PEM", "new_order", send)
        self.assertEqual(result, {"ok": ["sub-1", "sub-4"], "gone": ["sub-2"], "failed": ["sub-3"]})
        self.assertEqual([s[0] for s in sent], ["sub-1", "sub-2", "sub-3", "sub-4"])
        self.assertEqual(sent[0][3], push.EVENT_TTL["new_order"])

    def test_an_unexpected_error_in_the_sender_is_a_failure_not_a_crash(self):
        def send(*args):
            raise RuntimeError("boom")

        result = push.deliver([target(1)], push.test_payload(), "PEM", "test", send)
        self.assertEqual(result["failed"], ["sub-1"])

    def test_the_result_is_written_back(self):
        conn = FakeConn()
        push.record(conn, {"ok": ["a"], "gone": ["b"], "failed": ["c"]})
        self.assertEqual(conn.ran(push.SQL_DROP_GONE), [("b",)])
        self.assertEqual(conn.ran(push.SQL_MARK_FAILED), [("c",)])
        self.assertEqual(conn.ran(push.SQL_DROP_TIRED), [("c", push.MAX_FAILURES)])
        self.assertEqual(conn.ran(push.SQL_MARK_OK), [("a",)])


class SendEventTests(unittest.TestCase):
    def test_the_database_is_not_held_while_the_message_travels(self):
        log = []
        conns = []

        def connect():
            conn = FakeConn(targets=[target(1)], log=log)
            conns.append(conn)
            log.append("db opened")
            return conn

        def send(item, payload, pem, subject, ttl):
            log.append("sending")

        result = push.send_event("table_call", COMPANY_ID, lambda cur: push.test_payload(), connect=connect, send=send)
        self.assertEqual(result["ok"], ["sub-1"])
        self.assertEqual(log, ["db opened", "db closed", "sending", "db opened", "db closed"])
        self.assertEqual(conns[1].ran(push.SQL_MARK_OK), [("sub-1",)])
        conns[1].commit.assert_called_once()

    def test_the_private_key_reaches_the_sender_and_only_the_sender(self):
        seen = []
        push.send_event(
            "new_order", COMPANY_ID, lambda cur: push.test_payload(),
            connect=lambda: FakeConn(targets=[target(1)], keys=("PUBLIC", "PRIVATE-PEM")),
            send=lambda item, payload, pem, subject, ttl: seen.append((pem, payload)),
        )
        self.assertEqual(seen[0][0], "PRIVATE-PEM")
        self.assertNotIn("PRIVATE-PEM", json.dumps(seen[0][1]))

    def test_a_role_event_asks_for_the_right_roles_in_this_restaurant_only(self):
        conn = FakeConn(targets=[])
        push.send_event("delivery_ready", COMPANY_ID, lambda cur: push.test_payload(), connect=lambda: conn, send=lambda *a: None)
        (params,) = conn.ran(push.SQL_TARGETS_BY_ROLE)
        self.assertEqual(params[0], COMPANY_ID)
        self.assertEqual(params[1], COMPANY_ID)
        self.assertEqual(set(params[2]), {"OWNER", "MANAGER", "COURIER"})
        self.assertIn("u.active = TRUE", norm(push.SQL_TARGETS_BY_ROLE))
        self.assertIn("u.company_id = %s", norm(push.SQL_TARGETS_BY_ROLE))

    def test_a_test_goes_only_to_the_devices_of_who_asked(self):
        conn = FakeConn(targets=[])
        push.send_test(COMPANY_ID, ME, connect=lambda: conn, send=lambda *a: None)
        self.assertEqual(conn.ran(push.SQL_TARGETS_OF_USER), [(COMPANY_ID, ME, push.MAX_PER_USER)])
        self.assertEqual(conn.ran(push.SQL_TARGETS_BY_ROLE), [])

    def test_nobody_subscribed_means_nothing_is_sent(self):
        sent = []
        result = push.send_event("new_order", COMPANY_ID, lambda cur: push.test_payload(), connect=lambda: FakeConn(targets=[]), send=lambda *a: sent.append(a))
        self.assertEqual((result, sent), ({"ok": [], "gone": [], "failed": []}, []))

    def test_an_order_that_vanished_sends_nothing(self):
        sent = []
        conn = FakeConn(targets=[target(1)], order=None)

        def build(cur):
            cur.execute(push.SQL_ORDER_FACTS, (ORDER_ID, COMPANY_ID))
            return push.new_order_payload(ORDER_ID) if cur.fetchone() else None

        push.send_event("new_order", COMPANY_ID, build, connect=lambda: conn, send=lambda *a: sent.append(a))
        self.assertEqual(sent, [])

    def test_a_dead_database_is_a_quiet_empty_result(self):
        def connect():
            raise OSError("database is down")

        result = push.send_event("new_order", COMPANY_ID, lambda cur: push.test_payload(), connect=connect)
        self.assertEqual(result, {"ok": [], "gone": [], "failed": []})

    def test_the_notify_functions_never_raise_and_do_nothing_when_off(self):
        with patch.object(push, "enabled", return_value=False), patch.object(push, "_in_background") as spawn:
            push.notify_new_order(COMPANY_ID, ORDER_ID)
            push.notify_table_call(COMPANY_ID, "garcom", "chama o garçom", 4)
            push.notify_delivery_ready(COMPANY_ID, ORDER_ID)
        spawn.assert_not_called()
        with patch.object(push, "enabled", side_effect=RuntimeError("x")):
            self.assertIsNone(push.notify_new_order(COMPANY_ID, ORDER_ID))
        with patch.object(push, "enabled", return_value=True), patch.object(push.threading, "Thread", side_effect=RuntimeError("no threads")):
            self.assertIsNone(push.notify_delivery_ready(COMPANY_ID, ORDER_ID))

    def test_the_order_message_is_built_inside_the_background_job(self):
        jobs = []
        with patch.object(push, "enabled", return_value=True), patch.object(push, "_in_background", side_effect=jobs.append):
            push.notify_new_order(COMPANY_ID, ORDER_ID)
        self.assertEqual(len(jobs), 1)
        sent = []
        conn = FakeConn(targets=[target(1)], order=("mesa", 7))
        with patch.object(push, "_connect", return_value=conn), patch.object(push, "_webpush_send", side_effect=lambda *a: sent.append(a[1])):
            jobs[0]()
        self.assertEqual(sent[0]["body"], "Mesa 7")
        self.assertNotIn("sub-1", json.dumps(sent[0]))


class LimiterTests(unittest.TestCase):
    def test_one_test_every_ten_seconds_per_person(self):
        now = [100.0]
        limiter = push.TestLimiter(10, clock=lambda: now[0])
        limiter.check("a")
        with self.assertRaises(push.PushError) as caught:
            limiter.check("a")
        self.assertEqual(caught.exception.status, 429)
        limiter.check("b")
        now[0] += 11
        limiter.check("a")


# ------------------------------------------------------------------------------------------------ as rotas
class RouteBase(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.conn = FakeConn()
        patcher = patch.object(backend_app, "get_db_connection", return_value=self.conn)
        patcher.start()
        self.addCleanup(patcher.stop)
        backend_app.push_test_limiter = push.TestLimiter()

    def switch(self, on):
        patcher = patch.object(push, "enabled", return_value=on)
        patcher.start()
        self.addCleanup(patcher.stop)


BASE = f"/api/companies/{COMPANY_ID}/push"


class ConfigRouteTests(RouteBase):
    def test_off_it_says_so_and_does_not_touch_the_database(self):
        self.switch(False)
        reply = self.client.get("/api/push/config")
        self.assertEqual((reply.status_code, reply.get_json()), (200, {"enabled": False}))
        self.assertEqual(self.conn.executed, [])

    def test_on_it_gives_the_public_key_and_never_the_private_one(self):
        self.switch(True)
        self.conn.keys = ("PUBLIC-KEY", "SECRET-PEM")
        reply = self.client.get("/api/push/config")
        self.assertEqual(reply.get_json(), {"enabled": True, "key": "PUBLIC-KEY"})
        self.assertNotIn("SECRET-PEM", reply.get_data(as_text=True))
        self.conn.commit.assert_called_once()


class SubscribeRouteTests(RouteBase):
    def test_login_is_required(self):
        self.switch(True)
        self.assertEqual(self.client.post(f"{BASE}/subscribe", json=subscription()).status_code, 401)
        self.assertEqual(self.client.post(f"{BASE}/unsubscribe", json={"endpoint": GOOD_ENDPOINT}).status_code, 401)
        self.assertEqual(self.client.post(f"{BASE}/test").status_code, 401)

    def test_a_login_of_another_restaurant_is_refused(self):
        self.switch(True)
        for path, body in (("subscribe", subscription()), ("unsubscribe", {"endpoint": GOOD_ENDPOINT}), ("test", {})):
            reply = self.client.post(f"{BASE}/{path}", json=body, headers=auth(company_id=OTHER_COMPANY_ID))
            self.assertEqual(reply.status_code, 403, path)
        self.assertEqual(self.conn.executed, [])

    def test_off_it_answers_404_without_touching_the_database(self):
        self.switch(False)
        self.assertEqual(self.client.post(f"{BASE}/subscribe", json=subscription(), headers=auth()).status_code, 404)
        self.assertEqual(self.client.post(f"{BASE}/test", headers=auth()).status_code, 404)
        self.assertEqual(self.conn.executed, [])

    def test_a_good_subscription_is_saved_for_this_person_in_this_restaurant(self):
        self.switch(True)
        raw = subscription()
        reply = self.client.post(f"{BASE}/subscribe", json=raw, headers=auth("KITCHEN"))
        self.assertEqual((reply.status_code, reply.get_json()), (200, {"ok": True}))
        (params,) = self.conn.ran(push.SQL_UPSERT)
        self.assertEqual(params, (COMPANY_ID, ME, raw["endpoint"], raw["keys"]["p256dh"], raw["keys"]["auth"]))
        self.assertEqual(self.conn.ran(push.SQL_TRIM), [(ME, ME, push.MAX_PER_USER)])
        self.conn.commit.assert_called_once()
        # a resposta nao devolve o endereco secreto
        self.assertNotIn(raw["endpoint"], reply.get_data(as_text=True))

    def test_the_company_comes_from_the_login_never_from_the_body(self):
        self.switch(True)
        raw = subscription()
        raw["company_id"] = OTHER_COMPANY_ID
        raw["user_id"] = "someone-else"
        self.client.post(f"{BASE}/subscribe", json=raw, headers=auth())
        (params,) = self.conn.ran(push.SQL_UPSERT)
        self.assertEqual(params[:2], (COMPANY_ID, ME))

    def test_an_address_that_is_not_a_notification_service_never_reaches_the_database(self):
        self.switch(True)
        for url in ("https://169.254.169.254/latest/meta-data", "http://fcm.googleapis.com/x", "https://api:5000/x"):
            raw = subscription(url)
            reply = self.client.post(f"{BASE}/subscribe", json=raw, headers=auth())
            self.assertEqual(reply.status_code, 400, url)
        self.assertEqual(self.client.post(f"{BASE}/subscribe", data="not json", headers=auth()).status_code, 400)
        self.assertEqual(self.conn.executed, [])

    def test_the_table_keeps_one_row_per_device_and_trims_each_person_to_five(self):
        sql = norm(push.SQL_UPSERT)
        self.assertIn("ON CONFLICT (endpoint) DO UPDATE", sql)
        self.assertIn("user_id = EXCLUDED.user_id", sql)
        self.assertIn("LIMIT %s", norm(push.SQL_TRIM))
        self.assertEqual(push.MAX_PER_USER, 5)


class UnsubscribeRouteTests(RouteBase):
    def test_a_person_removes_only_their_own_device(self):
        self.switch(True)
        reply = self.client.post(f"{BASE}/unsubscribe", json={"endpoint": GOOD_ENDPOINT}, headers=auth())
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(self.conn.ran(push.SQL_REMOVE_MINE), [(GOOD_ENDPOINT, ME, COMPANY_ID)])
        self.assertIn("user_id = %s", norm(push.SQL_REMOVE_MINE))
        self.assertIn("company_id = %s", norm(push.SQL_REMOVE_MINE))

    def test_it_works_even_when_the_switch_is_off_so_nobody_is_stuck_subscribed(self):
        self.switch(False)
        self.assertEqual(self.client.post(f"{BASE}/unsubscribe", json={"endpoint": GOOD_ENDPOINT}, headers=auth()).status_code, 200)

    def test_garbage_is_refused(self):
        self.switch(True)
        for body in ({}, {"endpoint": "https://evil.example/x"}, {"endpoint": 5}, None):
            reply = self.client.post(f"{BASE}/unsubscribe", json=body, headers=auth())
            self.assertEqual(reply.status_code, 400, body)
        self.assertEqual(self.conn.executed, [])


class TestRouteTests(RouteBase):
    def test_it_reports_how_many_devices_got_it_and_only_looks_at_this_persons_devices(self):
        self.switch(True)
        sent = []
        self.conn.targets = [target(1), target(2), target(3)]

        def fake_send(item, payload, pem, subject, ttl):
            sent.append(item["id"])
            if item["id"] == "sub-2":
                raise push.Gone()
            if item["id"] == "sub-3":
                raise push.Failed("x")

        with patch.object(push, "_webpush_send", side_effect=fake_send):
            reply = self.client.post(f"{BASE}/test", headers=auth())
        self.assertEqual((reply.status_code, reply.get_json()), (200, {"sent": 1, "removed": 1, "failed": 1}))
        self.assertEqual(self.conn.ran(push.SQL_TARGETS_OF_USER), [(COMPANY_ID, ME, push.MAX_PER_USER)])

    def test_no_device_is_zero_not_an_error(self):
        self.switch(True)
        reply = self.client.post(f"{BASE}/test", headers=auth())
        self.assertEqual(reply.get_json(), {"sent": 0, "removed": 0, "failed": 0})

    def test_a_second_test_right_away_is_refused(self):
        self.switch(True)
        self.assertEqual(self.client.post(f"{BASE}/test", headers=auth()).status_code, 200)
        reply = self.client.post(f"{BASE}/test", headers=auth())
        self.assertEqual(reply.status_code, 429)
        self.assertTrue(reply.get_json()["error"])


# ------------------------------------------------------------------------------------------------ onde o aviso nasce
class HookTests(delivery_tests.Base):
    """O pedido, a chamada da mesa e a entrega pronta chamam o aviso; sem ele nada muda."""

    def test_a_new_order_asks_for_a_notification_after_it_is_saved(self):
        committed_when_called = []
        with patch.object(push, "notify_new_order") as notify:
            notify.side_effect = lambda *args: committed_when_called.append(self.conn.commit.called)
            reply = self.client.post(
                delivery_tests.ORDERS_URL,
                json={"customer_name": "Ana", "payment_method": "pix", "items": [{"id": delivery_tests.PRODUCT_ID, "quantity": 1}]},
            )
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        self.assertEqual([tuple(map(str, call.args)) for call in notify.call_args_list], [(delivery_tests.COMPANY_ID, delivery_tests.ORDER_ID)])
        self.assertEqual(committed_when_called, [True], "o aviso so sai depois do pedido gravado")

    def test_a_refused_order_asks_for_nothing(self):
        with patch.object(push, "notify_new_order") as notify:
            reply = self.client.post(delivery_tests.ORDERS_URL, json={"customer_name": "Ana", "items": []})
        self.assertEqual(reply.status_code, 400)
        notify.assert_not_called()

    def test_a_failing_notification_does_not_break_the_order(self):
        with patch.object(push, "enabled", return_value=True), patch.object(push, "_in_background", side_effect=RuntimeError("x")):
            reply = self.client.post(
                delivery_tests.ORDERS_URL,
                json={"customer_name": "Ana", "payment_method": "pix", "items": [{"id": delivery_tests.PRODUCT_ID, "quantity": 1}]},
            )
        self.assertEqual(reply.status_code, 201)


class TableCallHookTests(unittest.TestCase):
    URL = f"/api/companies/{COMPANY_ID}/tables/{TABLE_ID}/calls"

    def setUp(self):
        self.client = backend_app.app.test_client()
        self.conn = MagicMock()
        self.conn.closed = False
        self.cur = MagicMock()
        self.conn.cursor.return_value = self.cur
        self.open_call = None
        self.cur.fetchone.side_effect = self._fetchone
        self._last = ""
        self.cur.execute.side_effect = lambda sql, params=None: setattr(self, "_last", norm(sql))
        patcher = patch.object(backend_app, "get_db_connection", return_value=self.conn)
        patcher.start()
        self.addCleanup(patcher.stop)
        backend_app.table_call_limiter = backend_app.table_calls.Limiter()

    def _fetchone(self):
        import table_calls

        if self._last == norm(table_calls.SQL_TABLE):
            return {"id": TABLE_ID, "number": 4}
        if self._last == norm(table_calls.SQL_OPEN_SAME):
            return self.open_call
        return {"id": "cccccccc-0000-4000-8000-000000000001", "kind": "garcom", "status": "open"}

    def test_a_new_call_warns_the_waiters_with_the_table_number(self):
        with patch.object(push, "notify_table_call") as notify:
            reply = self.client.post(self.URL, json={"kind": "garcom"})
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        self.assertEqual([tuple(map(str, call.args)) for call in notify.call_args_list], [(COMPANY_ID, "garcom", "chama o garçom", "4")])

    def test_touching_again_on_an_open_call_warns_again(self):
        self.open_call = {"id": "cccccccc-0000-4000-8000-000000000001", "kind": "conta", "status": "open"}
        with patch.object(push, "notify_table_call") as notify:
            reply = self.client.post(self.URL, json={"kind": "conta"})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual([tuple(map(str, call.args)) for call in notify.call_args_list], [(COMPANY_ID, "conta", "pede a conta", "4")])

    def test_a_refused_call_warns_nobody(self):
        with patch.object(push, "notify_table_call") as notify:
            reply = self.client.post(self.URL, json={"kind": "pizza"})
        self.assertEqual(reply.status_code, 400)
        notify.assert_not_called()


class ReadyHookTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def put(self, status, order_type="entrega", role="KITCHEN"):
        import test_order_status as status_tests

        conn = status_tests.FakeConnection(order_type=order_type)
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            return self.client.put(
                f"/api/orders/{ORDER_ID}/status", json={"status": status}, headers=auth(role)
            )

    def test_a_delivery_that_becomes_ready_warns_the_couriers(self):
        with patch.object(push, "notify_delivery_ready") as notify:
            reply = self.put("pronto")
        self.assertEqual(reply.status_code, 200)
        self.assertEqual([tuple(map(str, call.args)) for call in notify.call_args_list], [(COMPANY_ID, ORDER_ID)])

    def test_the_other_steps_warn_nobody(self):
        for status in ("em preparo", "saiu para entrega", "concluido"):
            with patch.object(push, "notify_delivery_ready") as notify:
                self.assertEqual(self.put(status).status_code, 200)
            notify.assert_not_called()

    def test_a_refused_ready_warns_nobody(self):
        with patch.object(push, "notify_delivery_ready") as notify:
            reply = self.put("pronto", order_type="mesa")
        self.assertEqual(reply.status_code, 400)
        notify.assert_not_called()


# ------------------------------------------------------------------------------------------------ chamado de ajuda
class HelpRequestPushTests(unittest.TestCase):
    def test_the_message_names_the_restaurant_and_the_subject_and_never_the_owners_text(self):
        payload = push.help_request_payload(COMPANY_ID, "Pizzaria do Zé", "Foto")
        self.assertEqual(payload["title"], "Chamado de ajuda")
        self.assertEqual(payload["body"], "Pizzaria do Zé: Foto")
        self.assertEqual(push.help_request_payload(COMPANY_ID, "Pizzaria do Zé", "Foto", True)["title"], "Chamado de novo")
        self.assertEqual(push.help_request_payload(COMPANY_ID, None, "")["body"], "Um restaurante: ajuda")
        self.assertEqual(push.help_request_payload(COMPANY_ID, "x" * 300, "y" * 300)["body"], "x" * 40 + ": " + "y" * 30)
        self.assertEqual(push.help_request_payload(COMPANY_ID, "A", "B")["tag"], f"ajuda-{COMPANY_ID}")

    def test_it_goes_to_the_platform_admins_in_any_restaurant_and_to_no_one_else(self):
        conn = FakeConn(targets=[])
        with patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": "GD@Exemplo.com, outro@exemplo.com"}):
            push.send_event("help_request", None, lambda cur: push.test_payload(), connect=lambda: conn, send=lambda *a: None)
        (params,) = conn.ran(push.SQL_TARGETS_PLATFORM)
        self.assertEqual(params, (["gd@exemplo.com", "outro@exemplo.com"], push.MAX_TARGETS))
        self.assertEqual(conn.ran(push.SQL_TARGETS_BY_ROLE), [])
        sql = norm(push.SQL_TARGETS_PLATFORM)
        self.assertIn("lower(u.email) = ANY(%s)", sql)
        self.assertIn("u.active = TRUE", sql)
        self.assertNotIn("company_id", sql, "o administrador recebe de onde estiver")

    def test_without_an_admin_configured_nothing_is_looked_up_or_sent(self):
        sent = []
        conn = FakeConn(targets=[target(1)])
        with patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": ""}):
            result = push.send_event("help_request", None, lambda cur: push.test_payload(), connect=lambda: conn, send=lambda *a: sent.append(a))
            with patch.object(push, "enabled", return_value=True), patch.object(push, "_in_background") as spawn:
                push.notify_help_request(COMPANY_ID, "Pizzaria", "Foto")
        self.assertEqual((result, sent), ({"ok": [], "gone": [], "failed": []}, []))
        self.assertEqual(conn.ran(push.SQL_TARGETS_PLATFORM), [])
        spawn.assert_not_called()

    def test_it_is_quiet_when_the_switch_is_off(self):
        with patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": "gd@exemplo.com"}):
            with patch.object(push, "enabled", return_value=False), patch.object(push, "_in_background") as spawn:
                push.notify_help_request(COMPANY_ID, "Pizzaria", "Foto")
            spawn.assert_not_called()
            jobs = []
            with patch.object(push, "enabled", return_value=True), patch.object(push, "_in_background", side_effect=jobs.append):
                push.notify_help_request(COMPANY_ID, "Pizzaria", "Foto", True)
            self.assertEqual(len(jobs), 1)

    def test_a_help_event_does_not_use_the_roles_table(self):
        self.assertNotIn("help_request", push.EVENT_ROLES)
        self.assertIn("help_request", push.PLATFORM_EVENTS)


class HelpRequestHookTests(help_tests.Base):
    def ask(self, body):
        return self.client.post(help_tests.ASK_URL, json=body, headers=help_tests.auth())

    def test_a_new_request_warns_the_platform_admin_with_the_restaurant_and_the_subject(self):
        self.cur.fetchone.side_effect = [help_tests.CONTEXT, None, {"id": help_tests.REQUEST_ID}]
        with patch.object(push, "notify_help_request") as notify:
            reply = self.ask({"topic": "foto", "message": "a foto sai escura"})
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(notify.call_args_list[0].args, (help_tests.COMPANY_ID, "Pizzaria do Zé", help_requests.topic_label("foto"), False))
        self.assertNotIn("escura", repr(notify.call_args_list), "o texto do dono nao vai no aviso")

    def test_asking_again_warns_again_marked_as_a_repeat(self):
        self.cur.fetchone.side_effect = [help_tests.CONTEXT, {"id": help_tests.REQUEST_ID, "topic": "foto"}, {"id": help_tests.REQUEST_ID}]
        with patch.object(push, "notify_help_request") as notify:
            reply = self.ask({"topic": "logo", "message": ""})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(notify.call_args_list[0].args[3], True)

    def test_a_refused_request_warns_nobody(self):
        with patch.object(push, "notify_help_request") as notify:
            reply = self.ask({"topic": "pizza"})
        self.assertEqual(reply.status_code, 400)
        notify.assert_not_called()

    def test_a_restaurant_that_does_not_exist_warns_nobody(self):
        self.cur.fetchone.side_effect = [None]
        with patch.object(push, "notify_help_request") as notify:
            reply = self.ask({"topic": "foto"})
        self.assertEqual(reply.status_code, 404)
        notify.assert_not_called()


# ------------------------------------------------------------------------------------------------ envio de verdade
HAS_LIBRARY = all(importlib.util.find_spec(name) for name in ("pywebpush", "py_vapid", "http_ece"))


class FakePushService(http.server.BaseHTTPRequestHandler):
    """Faz o papel do servico de notificacao: recebe o envio, guarda e responde como ele responderia."""

    received: list = []
    answer = 201

    def do_POST(self):
        size = int(self.headers.get("Content-Length", 0))
        FakePushService.received.append({"path": self.path, "headers": dict(self.headers), "body": self.rfile.read(size)})
        self.send_response(FakePushService.answer)
        self.end_headers()

    def log_message(self, *args):
        pass


@unittest.skipUnless(HAS_LIBRARY, "biblioteca de envio nao instalada")
class RealDeliveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.HTTPServer(("127.0.0.1", 0), FakePushService)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.endpoint = f"http://127.0.0.1:{cls.server.server_address[1]}/push/device-1"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        FakePushService.received = []
        FakePushService.answer = 201
        self.private, self.p256dh, self.auth_secret = device_keys()
        self.public_key, self.pem = push.generate_keypair()
        self.item = {"id": "sub-1", "endpoint": self.endpoint, "p256dh": self.p256dh, "auth": self.auth_secret}

    def send(self):
        push._webpush_send(self.item, push.new_order_payload(ORDER_ID, "mesa", 4), self.pem, "https://meu.restaurante.com", 600)

    def test_the_device_can_open_exactly_what_was_sent(self):
        import http_ece

        self.send()
        (got,) = FakePushService.received
        plain = http_ece.decrypt(got["body"], private_key=self.private, auth_secret=unb64(self.auth_secret))
        self.assertEqual(json.loads(plain.decode("utf-8")), push.new_order_payload(ORDER_ID, "mesa", 4))
        self.assertEqual({k.lower(): v for k, v in got["headers"].items()}.get("content-encoding"), "aes128gcm")
        self.assertNotIn(b"Mesa 4", got["body"], "a mensagem viaja criptografada")

    def test_the_message_is_signed_with_this_servers_key_and_asks_for_attention(self):
        self.send()
        (got,) = FakePushService.received
        headers = {k.lower(): v for k, v in got["headers"].items()}
        self.assertTrue(headers["authorization"].startswith("vapid t="), headers["authorization"][:20])
        self.assertIn(f"k={self.public_key}", headers["authorization"])
        self.assertEqual(headers["ttl"], "600")
        self.assertEqual(headers["urgency"], "high")
        # o token carrega quem responde por este servidor e para quem foi pedido
        token = headers["authorization"].split("t=")[1].split(",")[0]
        claims = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
        self.assertEqual(claims["sub"], "https://meu.restaurante.com")
        self.assertEqual(claims["aud"], f"http://127.0.0.1:{self.server.server_address[1]}")

    def test_the_service_saying_the_device_is_gone_becomes_gone(self):
        for code in (404, 410):
            FakePushService.answer = code
            with self.assertRaises(push.Gone):
                self.send()

    def test_any_other_refusal_becomes_a_failure(self):
        for code in (400, 401, 413, 429, 500, 503):
            FakePushService.answer = code
            with self.assertRaises(push.Failed, msg=str(code)):
                self.send()

    def test_a_service_that_cannot_be_reached_becomes_a_failure(self):
        self.item["endpoint"] = "http://127.0.0.1:1/nowhere"
        with self.assertRaises(push.Failed):
            self.send()

    def test_the_whole_chain_from_the_database_to_the_device(self):
        import http_ece

        conn_log = []
        conns = []

        def connect():
            conn = FakeConn(targets=[self.item], keys=(self.public_key, self.pem), order=("entrega", None), log=conn_log)
            conns.append(conn)
            return conn

        def build(cur):
            cur.execute(push.SQL_ORDER_FACTS, (ORDER_ID, COMPANY_ID))
            row = cur.fetchone()
            return push.new_order_payload(ORDER_ID, row["order_type"], row["table_number"])

        with patch.dict(os.environ, {"CORS_ORIGIN_REGEX": "https://meu.restaurante.com"}):
            result = push.send_event("new_order", COMPANY_ID, build, connect=connect)
        self.assertEqual(result["ok"], ["sub-1"])
        (got,) = FakePushService.received
        plain = http_ece.decrypt(got["body"], private_key=self.private, auth_secret=unb64(self.auth_secret))
        self.assertEqual(json.loads(plain.decode("utf-8"))["body"], "Entrega")
        self.assertEqual(conns[1].ran(push.SQL_MARK_OK), [("sub-1",)])

    def test_the_generated_private_key_loads_in_the_library(self):
        from py_vapid import Vapid

        vapid = Vapid.from_pem(self.pem.encode("ascii"))
        self.assertTrue(vapid.sign({"sub": "https://x.example", "aud": "https://fcm.googleapis.com", "exp": 4102444800}))


if __name__ == "__main__":
    unittest.main()
