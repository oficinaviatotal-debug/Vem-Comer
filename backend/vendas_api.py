"""Rotas da máquina de vendas do Vem (vendas.py): só o administrador da plataforma (o dono do sistema).

  GET  /api/platform/sales                          quem procurar hoje, o funil e as origens
  POST /api/platform/sales/read-contact             lê um texto colado ou falado e separa telefone, e-mail, Instagram…
  POST /api/platform/sales/prospects                anota um negócio (origem do contato obrigatória)
  POST /api/platform/sales/prospects/<id>/touch     "já mandei" (uma pessoa do Vem falou com o negócio)
  POST /api/platform/sales/prospects/<id>/reply     o que o negócio respondeu (texto ou resultado escolhido)
  POST /api/platform/sales/prospects/<id>/stage     muda a etapa (só para frente; "não quer" é para sempre)
  POST /api/platform/sales/prospects/<id>/forget    apaga os dados do negócio (pede confirmação escrita)

**Nenhuma rota daqui envia mensagem.** Elas só anotam o que uma pessoa do Vem fez e dizem o que fazer em seguida.
Toda mudança grava quem fez (o identificador do usuário, sem nome nem e-mail).

Duas rotas são públicas e só existem se o GD ligar INTEREST_OPEN=1 (sem isso respondem 404):

  GET  /api/interest/status   se o formulário está aberto e o texto exato que a pessoa autoriza
  POST /api/interest          "quero que o Vem fale comigo": nome do negócio, cidade, WhatsApp ou e-mail e a caixa marcada
"""

from __future__ import annotations

from flask import jsonify, request
from psycopg2.extras import RealDictCursor

import os

import signup
import vendas
from db import get_db_connection

FORGET_WORD = "APAGAR"


def _no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


def _by() -> str:
    return str(request.user.get("user_id") or "?")[:60]


def _run(work, error_response, *, write: bool = True):
    """Abre uma transação, roda `work(cur)` e confirma. Erro de regra vira frase inteira; erro de verdade, 500."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        body, status = work(cur)
        if write:
            conn.commit()
        return _no_store(jsonify(body)), status
    except vendas.ProspectError as error:
        if conn is not None:
            conn.rollback()
        return jsonify({"error": error.message}), error.status
    except Exception as exc:  # noqa: BLE001 (o texto do erro de banco não vai para a tela)
        if conn is not None:
            conn.rollback()
        return error_response("Erro na máquina de vendas", exc)
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


def register(app, *, require_platform_admin, error_response) -> None:
    """Chamada depois de app.py definir os decoradores."""

    def run(work, *, write: bool = True):
        return _run(work, error_response, write=write)

    def body_dict():
        data = request.get_json(silent=True)
        return data if isinstance(data, dict) else {}

    def view_after(cur, prospect_id):
        cur.execute(vendas.SQL_VIEW_ONE, (str(prospect_id),))
        row = cur.fetchone()
        return vendas.view_of(row) if row else None

    @app.route("/api/platform/sales", methods=["GET"])
    @require_platform_admin
    def sales_overview():
        return run(lambda cur: (vendas.overview(cur), 200), write=False)

    @app.route("/api/platform/sales/read-contact", methods=["POST"])
    @require_platform_admin
    def sales_read_contact():
        text = body_dict().get("text")
        if not isinstance(text, str) or not text.strip():
            return jsonify({"error": "Cole ou fale o texto do anúncio, do cartão ou da conversa."}), 400
        return _no_store(jsonify(vendas.parse_contact_text(text))), 200

    @app.route("/api/platform/sales/prospects", methods=["POST"])
    @require_platform_admin
    def sales_add():
        def work(cur):
            result = vendas.add_prospect(cur, body_dict(), _by())
            if result["reason"] == "na_lista_de_bloqueio":
                return {"error": "Esse contato pediu para não receber mais nada. Não foi cadastrado.", "reason": result["reason"]}, 409
            result["prospect"] = view_after(cur, result["id"])
            return result, (201 if result["created"] else 200)

        return run(work)

    @app.route("/api/platform/sales/prospects/<uuid:prospect_id>/touch", methods=["POST"])
    @require_platform_admin
    def sales_touch(prospect_id):
        def work(cur):
            result = vendas.record_touch(cur, prospect_id, body_dict().get("channel"), _by())
            result["prospect"] = view_after(cur, prospect_id)
            return result, 200

        return run(work)

    @app.route("/api/platform/sales/prospects/<uuid:prospect_id>/reply", methods=["POST"])
    @require_platform_admin
    def sales_reply(prospect_id):
        def work(cur):
            data = body_dict()
            text = data.get("text")
            result = data.get("result")
            if text is not None and not isinstance(text, str):
                raise vendas.ProspectError("A resposta precisa ser um texto.")
            if result is not None and not isinstance(result, str):
                raise vendas.ProspectError("Esse resultado não existe.")
            # O texto da resposta só serve para entender o resultado: não é guardado em lugar nenhum.
            outcome = vendas.record_reply(cur, prospect_id, _by(), text=(text or "")[:2000] or None, result=result)
            outcome["prospect"] = view_after(cur, prospect_id)
            return outcome, 200

        return run(work)

    @app.route("/api/platform/sales/prospects/<uuid:prospect_id>/stage", methods=["POST"])
    @require_platform_admin
    def sales_stage(prospect_id):
        def work(cur):
            stage = body_dict().get("stage")
            if not isinstance(stage, str):
                raise vendas.ProspectError("Escolha a etapa.")
            outcome = vendas.set_stage(cur, prospect_id, stage, _by())
            outcome["prospect"] = view_after(cur, prospect_id)
            return outcome, 200

        return run(work)

    @app.route("/api/platform/sales/prospects/<uuid:prospect_id>/forget", methods=["POST"])
    @require_platform_admin
    def sales_forget(prospect_id):
        def work(cur):
            if body_dict().get("confirm") != FORGET_WORD:
                raise vendas.ProspectError(f"Para apagar de vez, escreva {FORGET_WORD}.", 400)
            return vendas.forget_prospect(cur, prospect_id), 200

        return run(work)


def register_public(app, *, error_response) -> None:
    """Formulário público "quero que o Vem fale comigo". Fechado até o GD ligar INTEREST_OPEN=1."""
    limiter = signup.SignupLimiter()

    @app.route("/api/interest/status", methods=["GET"])
    def interest_status():
        if not vendas.interest_open():
            return _no_store(jsonify({"open": False})), 200
        return _no_store(jsonify({
            "open": True,
            "text_version": vendas.INTEREST_TEXT_VERSION,
            "consent_text": vendas.INTEREST_CONSENT_TEXT,
            "kinds": [{"id": kind, "label": vendas.KIND_LABELS[kind]} for kind in vendas.KINDS],
        })), 200

    @app.route("/api/interest", methods=["POST"])
    def interest():
        if not vendas.interest_open():
            return jsonify({"error": "O formulário ainda não está aberto."}), 404
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Pedido inválido."}), 400
        if data.get("website"):
            # campo escondido na tela: só robô preenche. Responde como se tivesse dado certo e não guarda nada.
            return _no_store(jsonify({"ok": True, "message": vendas.INTEREST_THANKS})), 200
        try:
            limiter.check(request.remote_addr or "unknown")
        except signup.SignupError as error:
            return jsonify({"error": error.message}), error.status

        def work(cur):
            result = vendas.add_inbound(cur, data, ip=request.remote_addr, secret=os.getenv("SECRET_KEY") or "")
            if result["reason"] == "na_lista_de_bloqueio":
                return {"error": vendas.INTEREST_BLOCKED}, 409
            return {"ok": True, "message": vendas.INTEREST_THANKS}, 200

        return _run(work, error_response)
