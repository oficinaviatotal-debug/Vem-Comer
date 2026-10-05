import unittest

from trusted_proxy import proxy_trusted, wrap_trusted_proxy


def echo_app(environ, start_response):
    body = f"{environ.get('REMOTE_ADDR', '')}|{environ.get('wsgi.url_scheme', '')}".encode()
    start_response("200 OK", [("Content-Type", "text/plain"), ("Content-Length", str(len(body)))])
    return [body]


def call(app, **headers):
    environ = {
        "REQUEST_METHOD": "GET",
        "PATH_INFO": "/",
        "SERVER_NAME": "api",
        "SERVER_PORT": "5000",
        "wsgi.url_scheme": "http",
        "REMOTE_ADDR": "172.18.0.5",  # the proxy container
    }
    environ.update(headers)
    return b"".join(app(environ, lambda status, hdrs, exc_info=None: None)).decode()


class TrustedProxyTests(unittest.TestCase):
    def test_off_by_default_and_header_is_ignored(self):
        app = wrap_trusted_proxy(echo_app, {})
        self.assertIs(app, echo_app)
        self.assertEqual(
            call(app, HTTP_X_FORWARDED_FOR="203.0.113.9", HTTP_X_FORWARDED_PROTO="https"),
            "172.18.0.5|http",
        )

    def test_on_reads_the_visitor_address_and_scheme(self):
        app = wrap_trusted_proxy(echo_app, {"TRUST_PROXY": "1"})
        self.assertEqual(
            call(app, HTTP_X_FORWARDED_FOR="203.0.113.9", HTTP_X_FORWARDED_PROTO="https"),
            "203.0.113.9|https",
        )

    def test_forged_address_to_the_left_is_ignored(self):
        app = wrap_trusted_proxy(echo_app, {"TRUST_PROXY": "true"})
        self.assertEqual(
            call(app, HTTP_X_FORWARDED_FOR="1.2.3.4, 203.0.113.9"),
            "203.0.113.9|http",
        )

    def test_without_header_the_proxy_address_stays(self):
        app = wrap_trusted_proxy(echo_app, {"TRUST_PROXY": "1"})
        self.assertEqual(call(app), "172.18.0.5|http")

    def test_switch_values(self):
        for on in ("1", "true", "TRUE", " yes ", "on"):
            self.assertTrue(proxy_trusted({"TRUST_PROXY": on}), on)
        for off in ("", "0", "false", "no", "off", "talvez"):
            self.assertFalse(proxy_trusted({"TRUST_PROXY": off}), off)
        self.assertFalse(proxy_trusted({}))


if __name__ == "__main__":
    unittest.main()
