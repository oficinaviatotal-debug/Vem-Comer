"""As rotas da página pública do restaurante (veja public_page.py para o que ela é e para as duas chaves).

    GET /r/<restaurante>              a página (cardápio, prévia do WhatsApp, dados do Google)
    GET /r/<restaurante>/previa.jpg   a imagem da prévia (1200 x 630)
    GET /r/<restaurante>/qr.png       o QR Code do link, para o balcão, a sacola, o adesivo
    GET /robots.txt                   o que o Google pode ler
    GET /sitemap.xml                  a lista de restaurantes (só com a segunda chave ligada)

Tudo responde 404 enquanto PUBLIC_PAGE_OPEN não estiver ligada. Nenhuma rota grava no banco, nenhuma conta ninguém,
nenhuma recebe dado de pessoa. Só duas rotas do painel (do dono) gravam, e só um sim ou não sobre o próprio
restaurante:

    GET /api/admin/public-page   dono e gerente veem o link da página e se o Google pode guardá-la
    PUT /api/admin/public-page   só o dono: {"listed": true|false}, "Aparecer no Google" (padrão: não)

`register` recebe do app.py o que precisa (consulta e conexão ao banco, a montagem dos dados públicos do restaurante,
"este restaurante recebe pedidos?" e a trava por cargo), assim este arquivo não importa o app e os testes rodam
sem banco.
"""

from __future__ import annotations

import os
import time

from flask import Response, jsonify, request
from psycopg2.extras import RealDictCursor

import media_store
import page_preview
import public_page
from table_qr import qr_png_for_url

SQL_COMPANY = """
    SELECT id, name, slug, logo_key, orders_paused, public_page_listed
    FROM companies
    WHERE slug = %s;
"""

# O dono do restaurante vê e muda se o Google pode guardar a página dele (migração 022; o padrão é não).
SQL_OWNER_GET = """
    SELECT slug, public_page_listed
    FROM companies
    WHERE id = %s;
"""

SQL_OWNER_SET = """
    UPDATE companies
    SET public_page_listed = %s
    WHERE id = %s
    RETURNING slug, public_page_listed;
"""

# As mesmas listas que o aplicativo do cliente recebe (/api/companies/<id>/menus e /products): é o que o cliente já vê.
SQL_MENUS = """
    SELECT id, company_id, name, active
    FROM menus
    WHERE company_id = %s
    AND active = TRUE;
"""

SQL_PRODUCTS = """
    SELECT id, company_id, menu_id, name, description, subcategory, price, image_key, sold_out
    FROM products
    WHERE company_id = %s;
"""

SQL_SITEMAP = """
    SELECT c.id, c.slug
    FROM companies c
    WHERE c.public_page_listed
    AND EXISTS (SELECT 1 FROM products p WHERE p.company_id = c.id)
    ORDER BY c.slug
    LIMIT %s;
"""

SITEMAP_CACHE_SECONDS = 600


def _int_env(name: str, default: int) -> int:
    try:
        return max(1, int((os.getenv(name) or "").strip()))
    except ValueError:
        return default


def register(app, *, query_db, get_db_connection, public_company, accepts_orders, require_roles):
    page_limiter = public_page.PageLimiter(_int_env("PUBLIC_PAGE_PER_MINUTE", 90))
    image_limiter = public_page.PageLimiter(_int_env("PUBLIC_IMAGE_PER_MINUTE", 30))
    previews = page_preview.PreviewCache()
    sitemap_cache: dict = {"at": 0.0, "xml": ""}

    # ------------------------------------------------------------------ respostas

    def html_response(body: str, status: int = 200, indexable: bool = False, cache: str = "public, max-age=60") -> Response:
        response = Response(body, status=status, mimetype="text/html")
        response.headers["Content-Security-Policy"] = public_page.CSP
        response.headers["Cache-Control"] = cache if status == 200 else "no-store"
        if not indexable:
            response.headers["X-Robots-Tag"] = "noindex, nofollow"
        return response

    def missing() -> Response:
        return html_response(public_page.not_found_page(), 404)

    def plain(text: str, status: int, **headers) -> Response:
        response = Response(text, status=status, mimetype="text/plain")
        response.headers["Cache-Control"] = "no-store"
        for key, value in headers.items():
            response.headers[key.replace("_", "-")] = value
        return response

    def too_many() -> Response:
        return plain("Muitos pedidos deste endereço. Tente de novo em instantes.\n", 429, Retry_After="60")

    def failed() -> Response:
        return plain("Não foi possível abrir a página agora. Tente de novo em instantes.\n", 503, Retry_After="30")

    def base() -> str:
        return public_page.base_url(request.host_url)

    def client() -> str:
        return request.remote_addr or "unknown"

    # ------------------------------------------------------------------ dados

    def load_company(slug: str):
        row = query_db(SQL_COMPANY, (slug,), one=True)
        return row if row else None

    def load_menu(row):
        """O restaurante, as categorias e os pratos, do jeito que o cliente os recebe."""
        company_id = str(row["id"])
        company = public_company(row)
        menus = query_db(SQL_MENUS, (company_id,))
        products = query_db(SQL_PRODUCTS, (company_id,))
        for product in products:
            product.update(media_store.public_urls(company_id, product.get("image_key")))
        return company, list(menus), list(products)

    # ------------------------------------------------------------------ a página

    @app.route("/r/<slug>", methods=["GET"], strict_slashes=False)
    def public_restaurant_page(slug):
        if not public_page.is_open() or not public_page.valid_slug(slug):
            return missing()
        if not page_limiter.allow(client()):
            return too_many()
        try:
            row = load_company(slug)
            if row is None:
                return missing()
            company, menus, products = load_menu(row)
            view = public_page.build_view(company, menus, products, base(), request.args.get("de"))
            return html_response(public_page.render(view), indexable=view["indexable"])
        except Exception:
            app.logger.exception("pagina publica: erro ao montar %s", slug)
            return failed()

    @app.route("/r/<slug>/previa.jpg", methods=["GET"])
    def public_restaurant_preview(slug):
        if not public_page.is_open() or not public_page.valid_slug(slug):
            return missing()
        if not image_limiter.allow(client()):
            return too_many()
        try:
            row = load_company(slug)
            if row is None:
                return missing()
            company, menus, products = load_menu(row)
            view = public_page.build_view(company, menus, products, base())
            company_id, logo_key = str(row["id"]), row.get("logo_key")
            photo_key = view["preview_dish_key"]
            key = (view["slug"], view["name"], photo_key, logo_key)
            image = previews.get(key)
            if image is None:
                photo = media_store.read_full(company_id, photo_key) if photo_key else None
                logo = media_store.read_full(company_id, logo_key) if logo_key else None
                image = page_preview.render(view["name"], photo, logo)
                previews.put(key, image)
            response = Response(image, mimetype="image/jpeg")
            response.headers["Cache-Control"] = "public, max-age=3600"
            return response
        except Exception:
            app.logger.exception("pagina publica: erro ao montar a imagem de %s", slug)
            return failed()

    @app.route("/r/<slug>/qr.png", methods=["GET"])
    def public_restaurant_qr(slug):
        if not public_page.is_open() or not public_page.valid_slug(slug):
            return missing()
        if not image_limiter.allow(client()):
            return too_many()
        try:
            if load_company(slug) is None:
                return missing()
            origin = public_page.clean_origin(request.args.get("de")) or "qr"
            png = qr_png_for_url(f"{base()}/r/{slug}?de={origin}")
            response = Response(png, mimetype="image/png")
            response.headers["Cache-Control"] = "public, max-age=86400"
            response.headers["Content-Disposition"] = f'inline; filename="qr-{slug}.png"'
            return response
        except Exception:
            app.logger.exception("pagina publica: erro ao montar o QR de %s", slug)
            return failed()

    # ------------------------------------------------------------------ o dono decide: aparecer no Google?

    def owner_view(row) -> dict:
        # Dono e gerente leem (os dois mandam o link); só o dono muda a escolha: `can_change` diz isso ao painel.
        view = public_page.owner_view(row["slug"], bool(row.get("public_page_listed")), base())
        view["can_change"] = request.user.get("role") == "OWNER"
        return view

    @app.route("/api/admin/public-page", methods=["GET"])
    @require_roles("OWNER", "MANAGER")
    def admin_get_public_page():
        try:
            row = query_db(SQL_OWNER_GET, (str(request.user.get("company_id")),), one=True)
            if not row:
                return jsonify({"error": "Estabelecimento nao encontrado"}), 404
            return jsonify(owner_view(row)), 200
        except Exception:
            app.logger.exception("pagina publica: erro ao ler a escolha do dono")
            return jsonify({"error": "Erro ao buscar a pagina publica"}), 500

    @app.route("/api/admin/public-page", methods=["PUT"])
    @require_roles("OWNER")
    def admin_set_public_page():
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or not isinstance(data.get("listed"), bool):
            return jsonify({"error": "Diga se o restaurante pode aparecer no Google: sim ou nao."}), 400
        conn = None
        cur = None
        try:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(SQL_OWNER_SET, (data["listed"], str(request.user.get("company_id"))))
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return jsonify({"error": "Estabelecimento nao encontrado"}), 404
            conn.commit()
            return jsonify({"message": "Escolha salva", **owner_view(row)}), 200
        except Exception:
            if conn is not None and not conn.closed:
                conn.rollback()
            app.logger.exception("pagina publica: erro ao salvar a escolha do dono")
            return jsonify({"error": "Erro ao salvar a escolha"}), 500
        finally:
            if cur is not None:
                cur.close()
            if conn is not None and not conn.closed:
                conn.close()

    # ------------------------------------------------------------------ Google

    @app.route("/robots.txt", methods=["GET"])
    def public_robots():
        if not public_page.is_open():
            return plain("Não encontrado.\n", 404)
        response = Response(public_page.robots_txt(base(), public_page.is_indexed()), mimetype="text/plain")
        response.headers["Cache-Control"] = "public, max-age=3600"
        return response

    @app.route("/sitemap.xml", methods=["GET"])
    def public_sitemap():
        if not public_page.is_indexed():
            return plain("Não encontrado.\n", 404)
        if not page_limiter.allow(client()):
            return too_many()
        try:
            now = time.time()
            current_base = base()
            cached = sitemap_cache.get("xml")
            if not cached or now - sitemap_cache["at"] > SITEMAP_CACHE_SECONDS or sitemap_cache.get("base") != current_base:
                rows = query_db(SQL_SITEMAP, (public_page.SITEMAP_MAX,))
                slugs = [row["slug"] for row in rows if accepts_orders(row["id"])]
                cached = public_page.sitemap_xml(current_base, slugs)
                sitemap_cache.update({"at": now, "xml": cached, "base": current_base})
            response = Response(cached, mimetype="application/xml")
            response.headers["Cache-Control"] = "public, max-age=600"
            return response
        except Exception:
            app.logger.exception("pagina publica: erro ao montar o sitemap")
            return failed()
