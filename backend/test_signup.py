import os
import re
import unittest
from unittest.mock import patch

from werkzeug.security import check_password_hash

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import signup  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
USER_ID = "99999999-9999-4999-8999-999999999999"
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def good(**overrides):
    data = {
        "restaurant_name": "Saiteria do João",
        "owner_name": "João da Silva",
        "email": "Joao@Gmail.com",
        "phone": "(84) 99999-1234",
        "password": "minha-senha-forte",
        "accept_terms": True,
        "terms_version": signup.TERMS_VERSION,
    }
    data.update(overrides)
    return data


class SlugTests(unittest.TestCase):
    def test_slugify_removes_accents_and_symbols(self):
        self.assertEqual(signup.slugify("Saiteria do João"), "saiteria-do-joao")
        self.assertEqual(signup.slugify("  Bar   do Zé!! "), "bar-do-ze")
        self.assertEqual(signup.slugify("Coxinha Prime #1"), "coxinha-prime-1")

    def test_slugify_of_nothing_usable_is_empty(self):
        self.assertEqual(signup.slugify("🍕🍕"), "")
        self.assertEqual(signup.slugify(""), "")
        self.assertEqual(signup.slugify(None), "")

    def test_a_long_name_is_cut_without_a_dangling_hyphen(self):
        slug = signup.slugify("a" * 39 + " " + "b" * 30)
        self.assertLessEqual(len(slug), 40)
        self.assertFalse(slug.endswith("-"))

    def test_candidates_go_from_the_prettiest_to_the_most_random(self):
        names = list(signup.slug_candidates("Saiteria do João", token=lambda: "ab12"))
        self.assertEqual(names[0], "saiteria-do-joao")
        self.assertEqual(names[1], "saiteria-do-joao-2")
        self.assertEqual(names[8], "saiteria-do-joao-9")
        self.assertEqual(names[9:], ["saiteria-do-joao-ab12"] * 3)

    def test_reserved_short_and_empty_names_still_get_a_valid_address(self):
        self.assertEqual(next(signup.slug_candidates("Admin")), "admin-restaurante")
        self.assertEqual(next(signup.slug_candidates("Zé")), "ze-restaurante")
        self.assertEqual(next(signup.slug_candidates("🍕")), "meu-restaurante")

    def test_every_candidate_is_a_valid_address(self):
        for name in ("Saiteria do João", "Zé", "🍕", "x" * 120, "Bar & Grill 24h"):
            for slug in signup.slug_candidates(name):
                self.assertRegex(slug, SLUG_RE)
                self.assertLessEqual(len(slug), 60)
                self.assertNotIn(slug, signup.RESERVED_SLUGS)


class PhoneTests(unittest.TestCase):
    def test_mobile_with_and_without_country_code(self):
        self.assertEqual(signup.normalize_phone("(84) 99999-1234"), "5584999991234")
        self.assertEqual(signup.normalize_phone("+55 84 99999-1234"), "5584999991234")
        self.assertEqual(signup.normalize_phone("84999991234"), "5584999991234")

    def test_landline(self):
        self.assertEqual(signup.normalize_phone("(84) 3222-1234"), "558432221234")

    def test_things_that_are_not_phones(self):
        for raw in ("123", "(10) 99999-1234", "84 89999-1234", "(84) 1222-1234", "abc", "", None, 55):
            self.assertIsNone(signup.normalize_phone(raw), raw)


class ValidateTests(unittest.TestCase):
    def fails(self, field, status=400, **overrides):
        with self.assertRaises(signup.SignupError) as caught:
            signup.validate(good(**overrides))
        self.assertEqual(caught.exception.field, field)
        self.assertEqual(caught.exception.status, status)

    def test_a_good_form_comes_back_clean(self):
        clean = signup.validate(good())
        self.assertEqual(clean["restaurant_name"], "Saiteria do João")
        self.assertEqual(clean["email"], "joao@gmail.com")
        self.assertEqual(clean["phone"], "5584999991234")
        self.assertEqual(clean["password"], "minha-senha-forte")

    def test_phone_is_optional(self):
        self.assertIsNone(signup.validate(good(phone=""))["phone"])
        self.assertIsNone(signup.validate(good(phone=None))["phone"])
        self.assertIsNone(signup.validate({k: v for k, v in good().items() if k != "phone"})["phone"])

    def test_keyboard_leftovers_are_cleaned(self):
        clean = signup.validate(good(restaurant_name="  Bar   do\tZé \x00 ", email=" Joao @gmail.com "))
        self.assertEqual(clean["restaurant_name"], "Bar do Zé")
        self.assertEqual(clean["email"], "joao@gmail.com")

    def test_restaurant_and_owner_names(self):
        self.fails("restaurant_name", restaurant_name="")
        self.fails("restaurant_name", restaurant_name="a")
        self.fails("restaurant_name", restaurant_name="a" * 121)
        self.fails("restaurant_name", restaurant_name=None)
        self.fails("restaurant_name", restaurant_name=["x"])
        self.fails("owner_name", owner_name=" ")
        self.fails("owner_name", owner_name="a" * 101)

    def test_email(self):
        for email in ("", "joao", "joao@", "@gmail.com", "joao@gmail", "jo ao@x.com@y", "a" * 200 + "@x.com", 5):
            self.fails("email", email=email)

    def test_phone_that_is_filled_but_wrong(self):
        self.fails("phone", phone="12345")

    def test_password_rules(self):
        self.fails("password", password="curta")
        self.fails("password", password=None)
        self.fails("password", password="x" * 129)
        self.fails("password", password="12345678")
        self.fails("password", password="SENHA123")
        self.fails("password", password="aaaaaaaaaaaa")
        self.fails("password", password="joao@gmail.com")

    def test_terms_must_be_accepted_with_the_current_version(self):
        self.fails("accept_terms", accept_terms=False)
        self.fails("accept_terms", accept_terms="true")
        self.fails("accept_terms", accept_terms=None)
        self.fails("accept_terms", status=409, terms_version="2000-01-01")
        self.fails("accept_terms", status=409, terms_version=None)


class LimiterTests(unittest.TestCase):
    def test_hourly_limit_then_it_frees_up(self):
        now = [1000.0]
        limiter = signup.SignupLimiter(per_hour=2, per_day=10, clock=lambda: now[0])
        limiter.check("1.1.1.1")
        limiter.check("1.1.1.1")
        with self.assertRaises(signup.SignupError) as caught:
            limiter.check("1.1.1.1")
        self.assertEqual(caught.exception.status, 429)
        now[0] += 3601
        limiter.check("1.1.1.1")

    def test_daily_limit(self):
        now = [1000.0]
        limiter = signup.SignupLimiter(per_hour=100, per_day=3, clock=lambda: now[0])
        for _ in range(3):
            limiter.check("2.2.2.2")
            now[0] += 4000
        with self.assertRaises(signup.SignupError):
            limiter.check("2.2.2.2")
        now[0] += 86400
        limiter.check("2.2.2.2")

    def test_each_address_has_its_own_count(self):
        limiter = signup.SignupLimiter(per_hour=1, per_day=5, clock=lambda: 5.0)
        limiter.check("3.3.3.3")
        limiter.check("4.4.4.4")
        with self.assertRaises(signup.SignupError):
            limiter.check("3.3.3.3")

    def test_defaults_come_from_the_environment(self):
        with patch.dict(os.environ, {"SIGNUP_PER_IP_PER_HOUR": "3", "SIGNUP_PER_IP_PER_DAY": "7"}):
            limiter = signup.SignupLimiter()
        self.assertEqual((limiter.per_hour, limiter.per_day), (3, 7))


class SwitchTests(unittest.TestCase):
    def test_closed_unless_switched_on(self):
        with patch.dict(os.environ):
            os.environ.pop("SIGNUP_OPEN", None)
            self.assertFalse(signup.is_open())
        for value in ("", "0", "nao", "false", "talvez"):
            with patch.dict(os.environ, {"SIGNUP_OPEN": value}):
                self.assertFalse(signup.is_open(), value)
        for value in ("1", "true", "SIM", " yes "):
            with patch.dict(os.environ, {"SIGNUP_OPEN": value}):
                self.assertTrue(signup.is_open(), value)

    def test_daily_cap_ignores_junk(self):
        with patch.dict(os.environ, {"SIGNUP_MAX_PER_DAY": "abc"}):
            self.assertEqual(signup.max_per_day(), 200)
        with patch.dict(os.environ, {"SIGNUP_MAX_PER_DAY": "-5"}):
            self.assertEqual(signup.max_per_day(), 200)
        with patch.dict(os.environ, {"SIGNUP_MAX_PER_DAY": "50"}):
            self.assertEqual(signup.max_per_day(), 50)


# ------------------------------------------------------------------ the route, with a scripted database

class FakeCursor:
    def __init__(self, handler):
        self.handler = handler
        self.executed = []
        self._row = None
        self.closed = False

    def execute(self, sql, params=None):
        sql = " ".join(sql.split())
        self.executed.append((sql, params))
        self._row = self.handler(sql, params)
        if isinstance(self._row, Exception):
            error, self._row = self._row, None
            raise error

    def fetchone(self):
        return self._row

    def close(self):
        self.closed = True


class FakeConnection:
    def __init__(self, handler):
        self.cursor_obj = FakeCursor(handler)
        self.committed = 0
        self.rolled_back = 0
        self.closed = False

    def cursor(self, **kwargs):
        return self.cursor_obj

    def commit(self):
        self.committed += 1

    def rollback(self):
        self.rolled_back += 1

    def close(self):
        self.closed = True

    def ran(self, fragment):
        return [params for sql, params in self.cursor_obj.executed if fragment in sql]


def happy_handler(taken_slugs=(), today=0, email_taken=False):
    def handler(sql, params):
        if "count(*)" in sql:
            return {"n": today}
        if "FROM users WHERE lower(email)" in sql:
            return {"taken": 1} if email_taken else None
        if "INSERT INTO companies" in sql:
            if params[1] in taken_slugs:
                return None
            return {"id": COMPANY_ID, "name": params[0], "slug": params[1]}
        if "INSERT INTO users" in sql:
            return {"id": USER_ID, "name": params[1], "email": params[2], "role": "OWNER"}
        raise AssertionError("unexpected SQL: " + sql)

    return handler


class SignupRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        env = patch.dict(os.environ, {"SIGNUP_OPEN": "1"})
        env.start()
        self.addCleanup(env.stop)
        limiter = patch.object(backend_app, "signup_limiter", signup.SignupLimiter(per_hour=50, per_day=50))
        limiter.start()
        self.addCleanup(limiter.stop)

    def post(self, body=None, handler=None, connection=None):
        connection = connection or FakeConnection(handler or happy_handler())
        with patch.object(backend_app, "get_db_connection", return_value=connection):
            response = self.client.post("/api/signup", json=good() if body is None else body)
        return response, connection

    def test_closed_by_default(self):
        with patch.dict(os.environ, {"SIGNUP_OPEN": ""}):
            with patch.object(backend_app, "get_db_connection") as db:
                self.assertEqual(self.client.post("/api/signup", json=good()).status_code, 404)
                status = self.client.get("/api/signup/status")
            db.assert_not_called()
        self.assertEqual(status.get_json()["open"], False)

    def test_status_when_open_tells_the_terms_version(self):
        body = self.client.get("/api/signup/status").get_json()
        self.assertEqual(body, {"open": True, "terms_version": signup.TERMS_VERSION})

    def test_the_old_admin_only_route_is_untouched(self):
        # /api/auth/register-company stays closed at the front door (Caddy); this PR does not reopen it.
        self.assertIn("/api/auth/register-company", [r.rule for r in backend_app.app.url_map.iter_rules()])

    def test_success_creates_company_and_owner_and_signs_in(self):
        response, connection = self.post()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        body = response.get_json()
        self.assertEqual(body["company"]["slug"], "saiteria-do-joao")
        self.assertEqual(body["user"]["role"], "OWNER")
        self.assertEqual(body["user"]["email"], "joao@gmail.com")
        self.assertEqual(body["user"]["company_id"], COMPANY_ID)

        token = backend_app.serializer.loads(body["token"])
        self.assertEqual(token, {"user_id": USER_ID, "company_id": COMPANY_ID, "role": "OWNER"})

        self.assertEqual(connection.committed, 1)
        self.assertEqual(connection.rolled_back, 0)
        self.assertTrue(connection.closed and connection.cursor_obj.closed)

    def test_what_is_stored(self):
        response, connection = self.post()
        (company_args,) = connection.ran("INSERT INTO companies")
        self.assertEqual(company_args, ("Saiteria do João", "saiteria-do-joao", "5584999991234", signup.TERMS_VERSION))
        self.assertIn("'web'", [s for s, _ in connection.cursor_obj.executed if "INSERT INTO companies" in s][0])

        (owner_args,) = connection.ran("INSERT INTO users")
        self.assertEqual(owner_args[0], COMPANY_ID)
        self.assertEqual(owner_args[2], "joao@gmail.com")
        self.assertNotEqual(owner_args[3], "minha-senha-forte")
        self.assertTrue(check_password_hash(owner_args[3], "minha-senha-forte"))

    def test_the_password_never_comes_back(self):
        response, _ = self.post()
        self.assertNotIn("minha-senha-forte", response.get_data(as_text=True))
        self.assertNotIn("password", response.get_data(as_text=True).lower())

    def test_a_taken_address_moves_on_to_the_next_one(self):
        response, connection = self.post(handler=happy_handler(taken_slugs={"saiteria-do-joao", "saiteria-do-joao-2"}))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["company"]["slug"], "saiteria-do-joao-3")
        self.assertEqual(len(connection.ran("INSERT INTO companies")), 3)

    def test_when_every_address_is_taken_nothing_is_created(self):
        def handler(sql, params):
            if "INSERT INTO companies" in sql:
                return None
            return happy_handler()(sql, params)

        response, connection = self.post(handler=handler)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["field"], "restaurant_name")
        self.assertEqual(connection.ran("INSERT INTO users"), [])
        self.assertEqual(connection.committed, 0)
        self.assertGreaterEqual(connection.rolled_back, 1)

    def test_an_email_that_already_has_an_account(self):
        response, connection = self.post(handler=happy_handler(email_taken=True))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["field"], "email")
        self.assertEqual(connection.ran("INSERT INTO companies"), [])
        self.assertEqual(connection.committed, 0)

    def test_two_people_with_the_same_email_at_once_the_index_holds_the_second(self):
        def handler(sql, params):
            if "INSERT INTO users" in sql:
                return backend_app.psycopg2.errors.UniqueViolation()
            return happy_handler()(sql, params)

        response, connection = self.post(handler=handler)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["field"], "email")
        self.assertEqual(connection.committed, 0)
        self.assertGreaterEqual(connection.rolled_back, 1)
        self.assertTrue(connection.closed)

    def test_the_daily_cap_for_the_whole_server(self):
        with patch.dict(os.environ, {"SIGNUP_MAX_PER_DAY": "5"}):
            response, connection = self.post(handler=happy_handler(today=5))
        self.assertEqual(response.status_code, 429)
        self.assertEqual(connection.ran("INSERT INTO companies"), [])

    def test_below_the_cap_it_goes_through(self):
        with patch.dict(os.environ, {"SIGNUP_MAX_PER_DAY": "5"}):
            response, _ = self.post(handler=happy_handler(today=4))
        self.assertEqual(response.status_code, 201)

    def test_bad_data_is_refused_before_touching_the_database(self):
        with patch.object(backend_app, "get_db_connection") as db:
            response = self.client.post("/api/signup", json=good(email="joao"))
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.get_json()["field"], "email")
            db.assert_not_called()

    def test_not_json_or_not_an_object(self):
        with patch.object(backend_app, "get_db_connection") as db:
            self.assertEqual(self.client.post("/api/signup", data="oi").status_code, 400)
            self.assertEqual(self.client.post("/api/signup", json=["a"]).status_code, 400)
            db.assert_not_called()

    def test_the_hidden_field_only_robots_fill(self):
        with patch.object(backend_app, "get_db_connection") as db:
            response = self.client.post("/api/signup", json=good(website="http://spam.example"))
            db.assert_not_called()
        self.assertEqual(response.status_code, 400)

    def test_too_many_tries_from_one_network(self):
        with patch.object(backend_app, "signup_limiter", signup.SignupLimiter(per_hour=2, per_day=5)):
            codes = [self.client.post("/api/signup", json=good(email="x")).status_code for _ in range(3)]
        self.assertEqual(codes, [400, 400, 429])

    def test_an_unexpected_failure_says_nothing_about_the_inside(self):
        def handler(sql, params):
            raise RuntimeError("senha do banco: segredo")

        response, connection = self.post(handler=handler)
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("segredo", response.get_data(as_text=True))
        self.assertGreaterEqual(connection.rolled_back, 1)
        self.assertTrue(connection.closed)


if __name__ == "__main__":
    unittest.main()
