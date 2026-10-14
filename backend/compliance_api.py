"""Rotas de conformidade abertas ao público (sem login): hoje, o descadastro de um clique.

O link vem em todo e-mail de divulgação (cabeçalho List-Unsubscribe, RFC 8058). Regras:
- GET só MOSTRA a página com um botão e nunca muda nada (programas de e-mail abrem links sozinhos para checar);
- POST faz o descadastro na hora, sem pedir mais nada (é o que o Gmail e o Yahoo mandam no "um clique");
- o link é assinado e não vence; link adulterado não revela nada.
O descadastro entra na lista de bloqueio única e retira de uma vez todos os aceites de receber e-mail.
"""

from __future__ import annotations

import html
import os

from flask import Blueprint, Response, jsonify, request
from psycopg2.extras import RealDictCursor

import consent
import outreach
from db import get_db_connection

blueprint = Blueprint("compliance_api", __name__)

VERSION = "descadastro"

PAGE = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{title}</title>
<style>
body{{margin:0;font:18px/1.5 system-ui,sans-serif;background:#f7f7f5;color:#1b1b1b}}
main{{max-width:30rem;margin:0 auto;padding:2.5rem 1rem}}
h1{{font-size:1.5rem;margin:0 0 1rem}}
button{{font:inherit;font-weight:600;padding:.85rem 1.4rem;border:0;border-radius:.6rem;background:#0b5fd6;color:#fff;cursor:pointer;min-height:48px}}
button:focus-visible{{outline:3px solid #1e78ff;outline-offset:3px}}
p{{margin:0 0 1rem}}
</style>
</head>
<body><main>
<h1>{title}</h1>
{body}
</main></body>
</html>
"""


def _page(title: str, body: str, status: int = 200) -> Response:
    response = Response(PAGE.format(title=html.escape(title), body=body), status=status, mimetype="text/html")
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    return response


def _wants_json() -> bool:
    return request.is_json or request.accept_mimetypes.best == "application/json"


def _email_from_request() -> str | None:
    secret = os.getenv("SECRET_KEY") or ""
    token = request.args.get("t") or request.form.get("t")
    return outreach.email_from_token(token, secret) if secret else None


@blueprint.get("/api/descadastro")
def unsubscribe_page():
    email = _email_from_request()
    if not email:
        return _page("Este link não é válido", "<p>Ele pode ter sido cortado ao copiar. Use o link do e-mail que você recebeu.</p>", 400)
    token = html.escape(request.args.get("t", ""), quote=True)
    body = (
        f"<p>Você deixa de receber e-mails do Vem Comer e do Vem Trabalhar em <strong>{html.escape(outreach.mask_email(email))}</strong>.</p>"
        f'<form method="post" action="/api/descadastro"><input type="hidden" name="t" value="{token}">'
        "<button type=\"submit\">Não quero mais receber</button></form>"
    )
    return _page("Deixar de receber e-mails", body)


@blueprint.post("/api/descadastro")
def unsubscribe():
    email = _email_from_request()
    if not email:
        if _wants_json():
            return jsonify({"error": "Link inválido"}), 400
        return _page("Este link não é válido", "<p>Use o link do e-mail que você recebeu.</p>", 400)

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        outreach.suppress(cur, email, "pediu")
        consent.withdraw_email_consents(cur, email, kind="contato", version=VERSION)
        conn.commit()
    except Exception:  # noqa: BLE001 (a pessoa não precisa ver o erro; ela só precisa tentar de novo)
        if conn is not None:
            conn.rollback()
        if _wants_json():
            return jsonify({"error": "Não consegui agora. Tente de novo em instantes."}), 500
        return _page("Não consegui agora", "<p>Tente de novo em alguns minutos. Se continuar, responda ao e-mail que você recebeu.</p>", 500)
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()

    if _wants_json():
        return jsonify({"ok": True}), 200
    return _page("Pronto", "<p>Você não vai mais receber e-mails nossos nesse endereço.</p>")
