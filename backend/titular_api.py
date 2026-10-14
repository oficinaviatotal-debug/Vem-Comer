"""Rotas do titular dos dados (LGPD arts. 9, 18, 19 e 41) e da denúncia de conteúdo (Marco Civil arts. 19 e 21).

Públicas, sem login e sem JavaScript (funcionam com sinal fraco e em qualquer celular):
  GET  /api/privacidade                     aviso de privacidade (vem do inventário de dados) + formulário de pedido
  POST /api/privacidade/solicitacoes        abre o pedido e devolve protocolo, prazo e o endereço de acompanhamento
  GET  /api/privacidade/acompanhar?p=&t=    andamento (só com protocolo E código; errado = "não encontramos")
  GET  /api/denuncia, POST /api/denuncia    denúncia de conteúdo (pode ser anônima)
Com login (a identidade é conferida pela sessão):
  GET  /api/me/dados[?pedidos=1]            cópia dos dados da conta (JSON para guardar)
  POST /api/me/solicitacoes                 pedido feito dentro da conta
Só administrador da plataforma:
  GET  /api/platform/solicitacoes                    pedidos abertos, do prazo mais curto ao mais longo
  POST /api/platform/solicitacoes/<id>/responder     muda o andamento e registra a resposta
  POST /api/platform/titular/anonimizar              simula (padrão) ou executa a eliminação de uma pessoa/restaurante (por e-mail + escopo)

Dados da empresa e do canal vêm de variáveis de ambiente (CONTROLLER_NAME, CONTROLLER_CNPJ, CONTROLLER_ADDRESS,
PRIVACY_CONTACT). Enquanto PRIVACY_REVIEWED não for 1, a página mostra o aviso de "texto preliminar".
"""

from __future__ import annotations

import html
import os
from datetime import datetime

from flask import Blueprint, Response, jsonify, request
from psycopg2.extras import RealDictCursor

import inventario
import push
import titular
from db import get_db_connection
from signup import SignupError, SignupLimiter

blueprint = Blueprint("titular_api", __name__)
limiter = SignupLimiter(per_hour=6, per_day=20)

PAGE = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{robots}<title>{title}</title>
<style>
:root{{--bg:#f7f7f5;--ink:#1b1b1b;--muted:#4a4a4a;--line:#d6d6d0;--brand:#0b5fd6;--card:#fff;--warn:#7a4b00;--warnbg:#fff4d6}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151515;--ink:#f1f1ee;--muted:#c4c4be;--line:#3a3a36;--brand:#7ab0ff;--card:#1f1f1d;--warn:#ffd88a;--warnbg:#3a2f12}}}}
body{{margin:0;font:18px/1.55 system-ui,sans-serif;background:var(--bg);color:var(--ink)}}
main{{max-width:42rem;margin:0 auto;padding:1.5rem 1rem 3rem}}
h1{{font-size:1.6rem;margin:0 0 .75rem}} h2{{font-size:1.25rem;margin:2rem 0 .5rem}}
p,ul,dl{{margin:0 0 1rem}} li{{margin:.25rem 0}}
a{{color:var(--brand)}}
label{{display:block;font-weight:600;margin:1rem 0 .3rem}}
input,select,textarea{{font:inherit;width:100%;box-sizing:border-box;padding:.7rem;border:1px solid var(--line);border-radius:.5rem;background:var(--card);color:var(--ink);min-height:48px}}
textarea{{min-height:8rem}}
button{{font:inherit;font-weight:600;margin-top:1.2rem;padding:.85rem 1.4rem;border:0;border-radius:.6rem;background:var(--brand);color:#fff;cursor:pointer;min-height:48px}}
@media (prefers-color-scheme:dark){{button{{color:#0a0a0a}}}}
:is(button,input,select,textarea,a,summary):focus-visible{{outline:3px solid var(--brand);outline-offset:3px}}
details{{background:var(--card);border:1px solid var(--line);border-radius:.6rem;margin:.6rem 0;padding:.2rem .9rem}}
summary{{cursor:pointer;font-weight:600;padding:.6rem 0;min-height:44px}}
dt{{font-weight:600;margin-top:.6rem}} dd{{margin:0 0 .3rem}}
.draft{{background:var(--warnbg);color:var(--warn);border-radius:.6rem;padding:.7rem .9rem;margin:0 0 1rem}}
.protocol{{font-size:1.7rem;font-weight:700;letter-spacing:.04em}}
.muted{{color:var(--muted)}} .error{{color:#b00020}}
@media (prefers-color-scheme:dark){{.error{{color:#ff8a8a}}}}
.honey{{position:absolute;left:-9999px;height:0;overflow:hidden}}
</style>
</head>
<body><main>
{body}
</main></body>
</html>
"""

RIGHTS = (
    ("Saber se tratamos dados seus e receber uma cópia", "LGPD art. 18, I e II"),
    ("Corrigir dado errado, incompleto ou desatualizado", "art. 18, III"),
    ("Pedir o apagamento ou a anonimização de dado desnecessário ou tratado sem base na lei", "art. 18, IV e VI"),
    ("Levar os seus dados para outro serviço", "art. 18, V"),
    ("Saber com quem compartilhamos os seus dados", "art. 18, VII"),
    ("Retirar um consentimento a qualquer momento, de forma tão fácil quanto foi dar", "art. 18, IX e art. 8º, §5º"),
    ("Pedir que uma pessoa revise uma decisão tomada só por sistema automático", "art. 20"),
)


# ---------------------------------------------------------------------------- ajudantes

def _truthy(name: str) -> bool:
    return (os.getenv(name) or "").strip().lower() in {"1", "true", "sim", "yes"}


def _esc(value) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def _page(title: str, body: str, status: int = 200, *, index: bool = False) -> Response:
    robots = "" if index else '<meta name="robots" content="noindex">\n'
    response = Response(PAGE.format(title=_esc(title), body=body, robots=robots), status=status, mimetype="text/html")
    response.headers["Cache-Control"] = "no-store"
    if not index:
        response.headers["X-Robots-Tag"] = "noindex"
    return response


def _wants_json() -> bool:
    return request.is_json or request.accept_mimetypes.best == "application/json"


def _payload() -> dict:
    if request.is_json:
        data = request.get_json(silent=True)
        return data if isinstance(data, dict) else {}
    return {key: request.form.get(key, "") for key in request.form}


def _br_date(value: datetime | None) -> str:
    return value.strftime("%d/%m/%Y") if value else ""


def _draft_banner() -> str:
    if _truthy("PRIVACY_REVIEWED"):
        return ""
    return '<p class="draft" role="note">Texto preliminar: ainda vai ser revisado por um advogado.</p>'


def _controller_block() -> str:
    name = _esc(os.getenv("CONTROLLER_NAME") or "Vem Tecnologia")
    cnpj = (os.getenv("CONTROLLER_CNPJ") or "").strip()
    address = (os.getenv("CONTROLLER_ADDRESS") or "").strip()
    contact = (os.getenv("PRIVACY_CONTACT") or "").strip()
    lines = [f"<p><strong>{name}</strong> é quem decide sobre os dados da sua conta e do seu uso do Vem Comer (controlador)."]
    if cnpj or address:
        lines.append(" " + _esc(" · ".join(part for part in (f"CNPJ {cnpj}" if cnpj else "", address) if part)) + ".")
    else:
        lines.append(' <span class="muted">O CNPJ e o endereço da empresa serão publicados aqui assim que o registro terminar.</span>')
    lines.append("</p>")
    if contact:
        lines.append(f"<p>Fale com o responsável pelos dados: <strong>{_esc(contact)}</strong>, ou use o formulário abaixo.</p>")
    else:
        lines.append("<p>Para falar com o responsável pelos dados, use o formulário abaixo.</p>")
    return "".join(lines)


def _inventory_block() -> str:
    inv = inventario.carregar()
    bases = inv["bases_legais"]
    blocks = []
    for item in inv["categorias"]:
        role = (
            "Somos o controlador: nós decidimos sobre estes dados."
            if item["papel_da_plataforma"] == "controlador"
            else "Somos o operador: o restaurante decide sobre estes dados e nós só os guardamos e protegemos para ele."
        )
        where = f"<dt>Onde fica</dt><dd>{_esc(item['onde'])}</dd>" if item.get("onde") else ""
        blocks.append(
            f"<details><summary>{_esc(item['titular'])}</summary><dl>"
            f"<dt>Dados</dt><dd>{_esc(item['dados'])}</dd>"
            f"<dt>Para quê</dt><dd>{_esc(item['finalidade'])}</dd>"
            f"<dt>Em que a lei nos apoia</dt><dd>{_esc(bases[item['base_legal']])}</dd>"
            f"<dt>Quem recebe</dt><dd>{_esc(item['compartilha_com'])}</dd>"
            f"<dt>Por quanto tempo</dt><dd>{_esc(item['guarda'])}</dd>"
            f"{where}<dt>Quem decide</dt><dd>{_esc(role)}</dd></dl></details>"
        )
    return "".join(blocks)


def _form(kinds, action: str, *, button: str, report: bool = False) -> str:
    options = "".join(f'<option value="{_esc(k)}">{_esc(titular.KIND_LABELS[k])}</option>' for k in kinds)
    honey = (
        '<p class="honey" aria-hidden="true"><label>Não preencha este campo'
        '<input type="text" name="website" tabindex="-1" autocomplete="off"></label></p>'
    )
    if report:
        reasons = "".join(f'<option value="{_esc(k)}">{_esc(v)}</option>' for k, v in titular.REPORT_REASONS.items())
        return (
            f'<form method="post" action="{action}">'
            '<input type="hidden" name="kind" value="denuncia">'
            '<label for="target_url">Onde está o conteúdo? Cole o endereço (link) ou descreva o lugar</label>'
            '<input id="target_url" name="target_url" required maxlength="500">'
            f'<label for="reason">Motivo</label><select id="reason" name="reason">{reasons}</select>'
            '<label for="description">Explique o que há de errado</label>'
            '<textarea id="description" name="description" required maxlength="4000"></textarea>'
            '<label for="contact">Seu e-mail ou WhatsApp com DDD (opcional; sem ele não conseguimos responder)</label>'
            '<input id="contact" name="contact" autocomplete="email" maxlength="200">'
            f"{honey}<button type=\"submit\">{_esc(button)}</button></form>"
        )
    return (
        f'<form method="post" action="{action}">'
        f'<label for="kind">O que você quer pedir</label><select id="kind" name="kind" required>{options}</select>'
        '<label for="contact">Seu e-mail ou WhatsApp com DDD (para a gente responder)</label>'
        '<input id="contact" name="contact" autocomplete="email" required maxlength="200">'
        '<label for="description">Detalhes (obrigatório para corrigir, retirar consentimento, se opor ou pedir revisão)</label>'
        '<textarea id="description" name="description" maxlength="4000"></textarea>'
        f"{honey}<button type=\"submit\">{_esc(button)}</button></form>"
    )


def _error_page(error: titular.RequestError, back: str) -> Response:
    return _page(
        "Não deu para enviar",
        f'<h1>Não deu para enviar</h1><p class="error" role="alert">{_esc(error.message)}</p>'
        f'<p><a href="{back}">Voltar e corrigir</a></p>',
        error.status,
    )


def _follow_path(protocol: str, token: str) -> str:
    return f"/api/privacidade/acompanhar?p={protocol}&t={token}"


def _created_response(made: dict, kind: str):
    path = _follow_path(made["protocol"], made["token"])
    if _wants_json():
        return jsonify({
            "protocol": made["protocol"], "token": made["token"], "due_at": made["due_at"].isoformat(),
            "follow_url": path,
        }), 201
    when = "em até 2 dias" if kind == "denuncia" else f"até {_br_date(made['due_at'])}"
    body = (
        "<h1>Recebemos o seu pedido</h1>"
        f'<p>Protocolo:</p><p class="protocol">{_esc(made["protocol"])}</p>'
        f"<p>Vamos responder {_esc(when)}. Guarde o endereço abaixo: é por ele que você acompanha, e só quem tem "
        "este endereço consegue ver a resposta.</p>"
        f'<p><a href="{_esc(path)}">Acompanhar este pedido</a></p>'
        '<p class="muted">Se você deixou e-mail ou WhatsApp, vamos responder também por ele.</p>'
    )
    response = _page("Pedido recebido", body, 201)
    response.headers["Referrer-Policy"] = "no-referrer"  # o endereço de acompanhamento leva o código
    return response


def _check_rate_limit():
    try:
        limiter.check(request.remote_addr or "unknown")
    except SignupError as error:
        return error
    return None


def _open(callback):
    """Abre conexão, roda `callback(cur)`, confirma ou desfaz. Devolve o que o callback devolveu."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        result = callback(cur)
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------- páginas públicas

@blueprint.get("/api/privacidade")
def privacy_page():
    kinds = [k for k in titular.KINDS if k != "denuncia"]
    rights = "".join(f"<li>{_esc(text)} <span class=\"muted\">({_esc(ref)})</span></li>" for text, ref in RIGHTS)
    body = (
        "<h1>Privacidade e os seus direitos</h1>"
        f"{_draft_banner()}"
        '<p class="muted">Texto em português simples, feito a partir do registro das operações de tratamento '
        f"(versão {_esc(inventario.carregar()['versao'])}). Os termos de uso estão em "
        '<a href="/?termos=1">Termos de uso e privacidade</a>.</p>'
        "<h2>Quem é o responsável</h2>"
        f"{_controller_block()}"
        "<h2>O que guardamos e por quê</h2>"
        "<p>Toque em cada item para ver o detalhe.</p>"
        f"{_inventory_block()}"
        "<h2>O que você pode pedir</h2>"
        f"<ul>{rights}</ul>"
        f"<p>Respondemos em até {titular.LGPD_DAYS} dias. Para entregar ou apagar dados, antes conferimos que o pedido "
        "é mesmo da pessoa: assim ninguém recebe nem apaga dado de outro.</p>"
        "<h2>Fazer um pedido</h2>"
        f"{_form(kinds, '/api/privacidade/solicitacoes', button='Enviar pedido')}"
        '<h2>Denunciar um conteúdo</h2><p>Viu um cardápio, anúncio ou imagem que fere a lei ou direitos de alguém? '
        '<a href="/api/denuncia">Faça a denúncia aqui</a>.</p>'
    )
    return _page("Privacidade e os seus direitos", body, index=True)


@blueprint.post("/api/privacidade/solicitacoes")
def create_request():
    blocked = _check_rate_limit()
    if blocked:
        return _fail(blocked.message, blocked.status, "/api/privacidade")
    return _create_public(_payload(), "/api/privacidade", allow_report=False)


@blueprint.get("/api/denuncia")
def report_page():
    body = (
        "<h1>Denunciar um conteúdo</h1>"
        f"{_draft_banner()}"
        "<p>Use este formulário para avisar que um cardápio, anúncio, vaga ou imagem feito por outra pessoa fere a lei "
        "ou direitos de alguém. Analisamos e, se for ilegal, retiramos. Você pode denunciar sem se identificar.</p>"
        "<p><strong>Risco à vida ou crime em andamento:</strong> ligue 190. Violência contra criança, mulher ou "
        "pessoa idosa: Disque 100 ou 180.</p>"
        f"{_form((), '/api/denuncia', button='Enviar denúncia', report=True)}"
        '<p><a href="/api/privacidade">Privacidade e os seus direitos</a></p>'
    )
    return _page("Denunciar um conteúdo", body, index=True)


@blueprint.post("/api/denuncia")
def create_report():
    blocked = _check_rate_limit()
    if blocked:
        return _fail(blocked.message, blocked.status, "/api/denuncia")
    data = _payload()
    data["kind"] = "denuncia"
    return _create_public(data, "/api/denuncia", allow_report=True)


def _fail(message: str, status: int, back: str):
    if _wants_json():
        return jsonify({"error": message}), status
    return _error_page(titular.RequestError(message, status), back)


def _create_public(data: dict, back: str, *, allow_report: bool):
    try:
        if data.get("kind") == "denuncia" and not allow_report:
            raise titular.RequestError("Escolha o que você quer pedir.", 400, "kind")
        clean = titular.validate_request(data)
        made = _open(lambda cur: titular.create(cur, clean, channel="site"))
        push.notify_titular_request(clean["kind"] == "denuncia")  # avisa o administrador; nunca falha o pedido
    except titular.RequestError as error:
        if _wants_json():
            return jsonify({"error": error.message, "field": error.field}), error.status
        return _error_page(error, back)
    except Exception:  # noqa: BLE001 (a pessoa não precisa ver o erro; precisa tentar de novo)
        return _fail("Não consegui registrar agora. Tente de novo em alguns minutos.", 500, back)
    return _created_response(made, clean["kind"])


@blueprint.get("/api/privacidade/acompanhar")
def follow_request():
    protocol = request.args.get("p", "")
    token = request.args.get("t", "")
    try:
        seen = _open(lambda cur: titular.public_view(cur, protocol, token))
    except Exception:  # noqa: BLE001
        return _page("Não consegui agora", "<h1>Não consegui agora</h1><p>Tente de novo em alguns minutos.</p>", 500)
    if not seen:
        return _page(
            "Não encontramos este pedido",
            "<h1>Não encontramos este pedido</h1><p>Confira se o endereço está completo, como você recebeu.</p>"
            '<p><a href="/api/privacidade">Fazer um pedido</a></p>',
            404,
        )
    answer = f"<h2>Resposta</h2><p>{_esc(seen['response'])}</p>" if seen["response"] else ""
    body = (
        "<h1>Andamento do seu pedido</h1>"
        f'<p class="protocol">{_esc(seen["protocol"])}</p>'
        f"<dl><dt>Pedido</dt><dd>{_esc(seen['kind_label'])}</dd>"
        f"<dt>Situação</dt><dd>{_esc(seen['status_label'])}</dd>"
        f"<dt>Recebido em</dt><dd>{_br_date(seen['created_at'])}</dd>"
        f"<dt>Prazo para responder</dt><dd>{_br_date(seen['due_at'])}</dd></dl>{answer}"
    )
    response = _page("Andamento do pedido", body)
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


# ---------------------------------------------------------------------------- rotas com login

def register_private(app, *, require_auth, require_platform_admin) -> None:
    """Rotas que dependem do login. Chamada depois de app.py definir os decoradores."""

    def _user_email(cur, user_id):
        cur.execute("SELECT email FROM users WHERE id = %s", (str(user_id),))
        row = cur.fetchone()
        return row["email"] if row else None

    @require_auth
    def my_data():
        user = request.user
        include = request.args.get("pedidos") in {"1", "true", "sim"}
        try:
            body = _open(lambda cur: titular.export_account(
                cur, user.get("user_id"), user.get("company_id"), user.get("role"), include_orders=include))
        except titular.RequestError as error:
            return jsonify({"error": error.message}), error.status
        except Exception:  # noqa: BLE001
            return jsonify({"error": "Não consegui montar a cópia agora."}), 500
        response = jsonify(body)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Disposition"] = 'attachment; filename="meus-dados-vem-comer.json"'
        return response

    @require_auth
    def my_request():
        blocked = _check_rate_limit()
        if blocked:
            return jsonify({"error": blocked.message}), blocked.status
        user = request.user
        data = _payload()
        try:
            def work(cur):
                email = _user_email(cur, user.get("user_id"))
                if not email:
                    raise titular.RequestError("Conta não encontrada.", 404)
                clean = titular.validate_request(data, verified_email=email)
                return titular.create(cur, clean, channel="painel", identity_verified=True), clean["kind"]

            made, kind = _open(work)
            push.notify_titular_request(kind == "denuncia")
        except titular.RequestError as error:
            return jsonify({"error": error.message, "field": error.field}), error.status
        except Exception:  # noqa: BLE001
            return jsonify({"error": "Não consegui registrar agora."}), 500
        return jsonify({
            "protocol": made["protocol"], "token": made["token"], "due_at": made["due_at"].isoformat(),
            "follow_url": _follow_path(made["protocol"], made["token"]),
        }), 201

    @require_platform_admin
    def platform_list():
        try:
            items = _open(titular.list_open)
        except Exception:  # noqa: BLE001
            return jsonify({"error": "Não consegui listar agora."}), 500
        response = jsonify({"items": items, "overdue": sum(1 for i in items if i["overdue"])})
        response.headers["Cache-Control"] = "no-store"
        return response

    @require_platform_admin
    def platform_answer(request_id):
        data = _payload()
        try:
            result = _open(lambda cur: titular.answer(
                cur, request_id, data.get("status"), data.get("response"),
                identity_verified=data.get("identity_verified") is True))
        except titular.RequestError as error:
            return jsonify({"error": error.message, "field": error.field}), error.status
        except Exception:  # noqa: BLE001
            return jsonify({"error": "Não consegui registrar agora."}), 500
        return jsonify(result), 200

    @require_platform_admin
    def platform_anonymize():
        """Elimina (anonimiza) uma pessoa ou um restaurante. Aponta-se pelo e-mail do pedido (`email` + `escopo`) ou
        direto por `user_id` / `company_id`. Sem `confirmar` = ANONIMIZAR, só simula (conta o que mudaria e desfaz)."""
        data = _payload()
        execute = data.get("confirmar") == "ANONIMIZAR"
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            target = None
            company_id, user_id = data.get("company_id"), data.get("user_id")
            if data.get("email"):
                if company_id or user_id:
                    raise titular.RequestError("Use o e-mail OU o número, não os dois.", 400)
                scope = data.get("escopo")
                if scope not in ("pessoa", "restaurante"):
                    raise titular.RequestError("Diga se é só a pessoa ou o restaurante inteiro (escopo).", 400)
                target = titular.find_person(cur, data.get("email"))
                if not target:
                    raise titular.RequestError("Não achei uma conta ativa com esse e-mail.", 404)
                if scope == "restaurante":
                    if target["role"] != "OWNER":
                        raise titular.RequestError("Só o dono pode encerrar o restaurante inteiro.", 400)
                    company_id = target["company_id"]
                else:
                    user_id = target["user_id"]
            if bool(company_id) == bool(user_id):
                raise titular.RequestError("Informe uma pessoa OU um restaurante.", 400)

            counts = titular.anonymize_company(cur, company_id) if company_id else titular.anonymize_user(cur, user_id)
            if execute and data.get("request_id"):
                cur.execute(
                    titular.SQL_INSERT_EVENT,
                    (str(data["request_id"]), "anotacao", f"Eliminação executada: {counts}"[:2000]),
                )
            if execute:
                conn.commit()
            else:
                conn.rollback()  # simulação: conta o que mudaria e desfaz
        except titular.RequestError as error:
            conn.rollback()
            return jsonify({"error": error.message}), error.status
        except Exception:  # noqa: BLE001
            conn.rollback()
            return jsonify({"error": "Não consegui agora; nada foi alterado."}), 500
        finally:
            cur.close()
            conn.close()
        return jsonify({
            "executado": execute,
            "contagem": counts,
            "alvo": target,
            "aviso": None if execute else "Simulação: nada foi alterado. Envie confirmar=ANONIMIZAR para executar.",
        }), 200

    app.add_url_rule("/api/me/dados", "titular_my_data", my_data, methods=["GET"])
    app.add_url_rule("/api/me/solicitacoes", "titular_my_request", my_request, methods=["POST"])
    app.add_url_rule("/api/platform/solicitacoes", "titular_platform_list", platform_list, methods=["GET"])
    app.add_url_rule("/api/platform/solicitacoes/<uuid:request_id>/responder", "titular_platform_answer",
                     platform_answer, methods=["POST"])
    app.add_url_rule("/api/platform/titular/anonimizar", "titular_platform_anonymize", platform_anonymize,
                     methods=["POST"])
