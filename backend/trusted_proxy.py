"""Real visitor address behind the HTTPS front door (Caddy).

Behind a reverse proxy every request seems to come from the proxy itself. The login
limiter would then treat every customer as one person. When the server runs behind
our own Caddy (TRUST_PROXY=1) it reads the address that Caddy puts in the request.

Never turn this on when the server can be reached directly from the internet:
anyone could then forge the header.
"""

import os

from werkzeug.middleware.proxy_fix import ProxyFix

_TRUE_VALUES = {"1", "true", "yes", "on"}


def proxy_trusted(env=None):
    env = os.environ if env is None else env
    return str(env.get("TRUST_PROXY", "")).strip().lower() in _TRUE_VALUES


def wrap_trusted_proxy(wsgi_app, env=None):
    if not proxy_trusted(env):
        return wsgi_app

    # Exactly one proxy in front (Caddy): trust one hop for address and scheme.
    # With one hop only the right-most value counts, so an address forged by the
    # visitor (to the left) is ignored.
    return ProxyFix(wsgi_app, x_for=1, x_proto=1, x_host=0, x_prefix=0)
