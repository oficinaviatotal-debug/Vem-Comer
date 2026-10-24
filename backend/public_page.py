"""Página pública do restaurante: o endereço que o dono manda no WhatsApp e que o Google consegue ler.

Hoje o link do restaurante (`/?empresa=pastelaria-do-ze`) abre o aplicativo. Para uma pessoa, ótimo. Para quem
só olha o endereço (a prévia do WhatsApp, do Instagram, o robô do Google) ele é uma página vazia: sem nome, sem
foto, sem prato. Esta página resolve isso. O servidor monta, para cada restaurante, uma página de verdade:

- o nome, a logomarca e se está aberto agora;
- o cardápio inteiro (categorias, pratos, preços, fotos), legível sem baixar o aplicativo e rápido em celular simples;
- o botão "Ver cardápio e pedir", que leva ao aplicativo (`/?empresa=...`);
- a prévia para o WhatsApp (Open Graph) e os dados estruturados do Google (JSON-LD de restaurante e cardápio);
- o `sitemap.xml` e o `robots.txt`.

**Só aparece o que o restaurante já mostra a qualquer cliente** (a mesma lista que o aplicativo do cliente recebe).
Nunca o telefone do dono, o e-mail, a chave Pix, os custos, os pedidos, os turnos do horário. A página não
tem nenhum script, não grava nada e não conta ninguém.

Duas chaves, as duas **desligadas** de fábrica (deploy/vps/abrir-pagina-publica.sh):

- `PUBLIC_PAGE_OPEN=1`: a página responde. Sem isto, tudo daqui responde 404, como se não existisse.
  Com ela ligada e a outra não, a página mostra a prévia bonita, mas pede ao Google para **não** guardá-la (`noindex`).
- `PUBLIC_PAGE_INDEX=1` (só vale com a primeira): o Google pode guardar a página; entram no `sitemap.xml` os
  restaurantes que têm prato e estão recebendo pedidos.

Este módulo só faz conta e texto: não fala com o banco nem com a rede. As rotas ficam em public_page_routes.py.
"""

from __future__ import annotations

import base64
import hashlib
import html
import json
import os
import re
import threading
import time
import unicodedata
from collections import deque
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

import hours

# ---------------------------------------------------------------------------------------------- as chaves

_TRUE = {"1", "true", "sim", "yes"}


def _flag(name: str) -> bool:
    return (os.getenv(name) or "").strip().lower() in _TRUE


def is_open() -> bool:
    """A página só responde com PUBLIC_PAGE_OPEN=1. Sem isso, 404."""
    return _flag("PUBLIC_PAGE_OPEN")


def is_indexed() -> bool:
    """O Google só é convidado com as duas chaves ligadas."""
    return is_open() and _flag("PUBLIC_PAGE_INDEX")


# ---------------------------------------------------------------------------------------------- entradas

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,99}$")

# De onde veio o toque no link. Só estas marcas passam; o resto é descartado (nunca vira texto na página).
ORIGINS = frozenset({"whatsapp", "instagram", "facebook", "tiktok", "telegram", "google", "qr"})

BASE_RE = re.compile(r"^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$", re.IGNORECASE)


def valid_slug(slug) -> bool:
    return isinstance(slug, str) and bool(SLUG_RE.fullmatch(slug))


def clean_origin(value) -> str | None:
    """"WhatsApp " -> "whatsapp"; marca desconhecida -> None."""
    if not isinstance(value, str):
        return None
    value = value.strip().lower()
    return value if value in ORIGINS else None


def base_url(request_host_url: str = "") -> str:
    """O endereço do site, sem barra no fim. Vem de PUBLIC_BASE_URL (o instalador põe o endereço do servidor);
    sem isso, do pedido. O que não parece um endereço é descartado."""
    configured = (os.getenv("PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if configured and BASE_RE.fullmatch(configured):
        return configured
    fallback = (request_host_url or "").strip().rstrip("/")
    return fallback if fallback and BASE_RE.fullmatch(fallback) else ""


# ---------------------------------------------------------------------------------------------- texto

def clean_text(value) -> str:
    """Sem caracteres de controle, sem espaços repetidos. Texto que o dono digitou nunca chega cru à página."""
    if not isinstance(value, str):
        return ""
    value = "".join(" " if ch.isspace() else ch for ch in value)
    value = "".join(ch for ch in value if not unicodedata.category(ch).startswith("C"))
    return " ".join(value.split())


def excerpt(value, limit: int) -> str:
    """Corta em uma palavra inteira e põe reticências. Texto curto passa como está."""
    text = clean_text(value)
    if len(text) <= limit:
        return text
    cut = text[: max(limit - 1, 1)]
    if " " in cut and text[len(cut)] != " ":
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip(" ,.;:-") + "…"


def money(value) -> str:
    """9 -> "R$ 9,00"; 1234.5 -> "R$ 1.234,50". Valor que não é número fica sem preço ("")."""
    try:
        number = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return ""
    if not number.is_finite() or number < 0:
        return ""
    whole, cents = f"{number:.2f}".split(".")
    groups = []
    while len(whole) > 3:
        groups.insert(0, whole[-3:])
        whole = whole[:-3]
    groups.insert(0, whole)
    return f"R$ {'.'.join(groups)},{cents}"


def price_number(value) -> str | None:
    """O preço como o Google quer ("9.00")."""
    try:
        number = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None
    return f"{number:.2f}" if number.is_finite() and number >= 0 else None


# ---------------------------------------------------------------------------------------------- o que a página diz

def status_of(company: dict) -> dict:
    """Uma frase e um tom (open, closed, paused, neutral). Nunca diz o motivo de um bloqueio de plano."""
    view = company.get("hours") or {}
    if view.get("paused"):
        return {"tone": "paused", "text": hours.PAUSED_MESSAGE}
    if company.get("accepting_orders") is False:
        return {"tone": "closed", "text": "Pedidos indisponíveis no momento."}
    if view.get("configured"):
        text = clean_text(view.get("message")) or ("Aberto agora." if view.get("open_now") else "Fechado no momento.")
        return {"tone": "open" if view.get("open_now") else "closed", "text": text}
    return {"tone": "neutral", "text": "Cardápio e pedidos pelo celular."}


OTHER_KEY = "outros"


def group_products(products: list[dict], menus: list[dict]) -> list[dict]:
    """As mesmas regras do aplicativo do cliente (frontend/src/customer/menuGroups.ts): uma seção por categoria
    ativa, na ordem em que o restaurante criou; prato sem categoria vai por último em "Outros" (ou "Cardápio", se o
    restaurante não tem categoria nenhuma); prato de categoria desligada não aparece; seção vazia fica de fora;
    dentro da categoria, as subseções na ordem em que aparecem."""
    groups = []
    for menu in menus:
        items = [p for p in products if p.get("menu_id") is not None and str(p["menu_id"]) == str(menu["id"])]
        groups.append((str(menu["id"]), clean_text(menu.get("name")), items))
    loose = [p for p in products if not p.get("menu_id")]
    if loose:
        groups.append((OTHER_KEY, "Outros" if menus else "Cardápio", loose))

    out = []
    for key, title, items in groups:
        if not items:
            continue
        sections: list[dict] = []
        by_key: dict[str, dict] = {}
        for item in items:
            sub = clean_text(item.get("subcategory"))
            marker = _plain(sub)
            section = by_key.get(marker)
            if section is None:
                section = {"title": sub, "items": []}
                by_key[marker] = section
                sections.append(section)
            section["items"].append(item)
        out.append({"key": key, "title": title or "Cardápio", "sections": sections, "count": len(items)})
    return out


def _plain(text: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", text) if not unicodedata.combining(ch)).lower()


def build_view(company: dict, menus: list[dict], products: list[dict], base: str, origin: str | None = None) -> dict:
    """Tudo o que a página mostra, já limpo. `company` é o que o aplicativo do cliente já recebe (public_company):
    nome, endereço, logomarca, se recebe pedidos e o estado do horário. Nada além disso entra."""
    slug = str(company.get("slug") or "")
    name = clean_text(company.get("name")) or "Restaurante"
    origin = clean_origin(origin)

    page_url = f"{base}/r/{slug}"
    order_path = f"/?empresa={quote(slug, safe='')}" + (f"&de={origin}" if origin else "")

    groups = group_products(products, menus)
    dishes = [item for group in groups for section in group["sections"] for item in section["items"]]

    def photo(item, which):
        value = item.get(which)
        return f"{base}{value}" if value else None

    shown = []
    for group in groups:
        sections = []
        for section in group["sections"]:
            rows = []
            for item in section["items"]:
                rows.append(
                    {
                        "name": clean_text(item.get("name")),
                        "description": excerpt(item.get("description"), 220),
                        "price_text": money(item.get("price")),
                        "price_number": price_number(item.get("price")),
                        "sold_out": bool(item.get("sold_out")),
                        "thumb_url": item.get("thumb_url") or None,
                        "image_url": photo(item, "image_url"),
                    }
                )
            sections.append({"title": section["title"], "items": rows})
        shown.append({"key": group["key"], "title": group["title"], "sections": sections, "count": group["count"]})

    available = [row for group in shown for section in group["sections"] for row in section["items"] if not row["sold_out"]]
    status = status_of(company)

    # Prévia: a foto do primeiro prato que tem foto; sem prato com foto, a logomarca; sem nada, o desenho do prato.
    preview_photo = next((p for p in dishes if p.get("image_url") and not p.get("sold_out")), None)
    # A imagem que o Google recebe como "foto do restaurante": um prato de verdade ou a logomarca, nunca a arte com texto.
    main_image = photo(preview_photo, "image_url") if preview_photo else (f"{base}{company['logo_url']}" if company.get("logo_url") else None)

    names = [row["name"] for row in available[:3]]
    description = f"Veja o cardápio de {name} e peça pelo celular."
    if names:
        description += " Tem " + ", ".join(names[:-1]) + (" e " if len(names) > 1 else "") + names[-1] + "."
    description = excerpt(description, 158)

    accepting = company.get("accepting_orders") is not False
    return {
        "slug": slug,
        "name": name,
        "title": f"{excerpt(name, 48)}: cardápio e pedidos",
        "description": description,
        "base": base,
        "page_url": page_url,
        "order_url": f"{base}{order_path}",
        "home_url": f"{base}/",
        "preview_url": f"{base}/r/{slug}/previa.jpg",
        "logo_thumb": company.get("logo_thumb_url") or None,
        "logo_image": company.get("logo_url") or None,
        "status": status,
        "groups": shown,
        "dish_count": len(available),
        "total_count": sum(group["count"] for group in shown),
        "preview_dish_key": preview_photo.get("image_key") if preview_photo else None,
        "main_image": main_image,
        "accepting": accepting,
        # Só vale ser achado pelo Google com as DUAS chaves do servidor, a escolha do dono ("Aparecer no Google"),
        # prato para mostrar e pedidos recebendo.
        "indexable": bool(
            is_indexed()
            and company.get("public_page_listed") is True
            and available
            and accepting
            and not (company.get("hours") or {}).get("paused")
        ),
        "origin": origin,
    }


def owner_view(slug: str, listed: bool, base: str) -> dict:
    """O que o painel do dono precisa saber: o link novo, o QR, se a página já está no ar e a escolha dele sobre o Google."""
    return {
        "open": is_open(),
        "indexed": is_indexed(),
        "listed": bool(listed),
        "slug": slug,
        "page_url": f"{base}/r/{slug}",
        "qr_path": f"/r/{slug}/qr.png",
    }


# ---------------------------------------------------------------------------------------------- JSON-LD

def jsonld(view: dict) -> dict:
    """Restaurante e cardápio no formato do Google (schema.org). Só o que a página já mostra."""
    sections = []
    for group in view["groups"]:
        items = []
        for section in group["sections"]:
            for row in section["items"]:
                if row["sold_out"] or not row["name"] or row["price_number"] is None:
                    continue
                item = {"@type": "MenuItem", "name": row["name"]}
                if row["description"]:
                    item["description"] = row["description"]
                if row["image_url"]:
                    item["image"] = row["image_url"]
                item["offers"] = {"@type": "Offer", "price": row["price_number"], "priceCurrency": "BRL"}
                items.append(item)
        if items:
            sections.append({"@type": "MenuSection", "name": group["title"], "hasMenuItem": items})

    data = {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": view["name"],
        "url": view["page_url"],
        "image": [view["main_image"] or view["preview_url"]],
    }
    if sections:
        data["hasMenu"] = {"@type": "Menu", "name": "Cardápio", "url": view["page_url"], "hasMenuSection": sections}
    return data


def json_for_script(data) -> str:
    """JSON seguro para dentro de <script type="application/ld+json">: nada que feche a tag ou quebre a linha."""
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return (
        text.replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace(" ", "\\u2028")
        .replace(" ", "\\u2029")
    )


# ---------------------------------------------------------------------------------------------- a página

# As cores da marca (as mesmas do visual novo do aplicativo). Cada par de texto sobre fundo passa de 4,5:1;
# o teste test_public_page.py calcula.
COLORS = {
    "verde": "#1F5E2E",
    "verde_escuro": "#123D1C",
    "creme": "#FBF6EA",
    "papel": "#FFFFFF",
    "tinta": "#1D2A1F",
    "tinta_suave": "#4A5A4D",
    "linha": "#E4DCC8",
    "aberto_fundo": "#DDF0DF",
    "aberto_texto": "#124A1F",
    "fechado_fundo": "#F8DDD7",
    "fechado_texto": "#7A1F12",
    "neutro_fundo": "#ECE6D3",
    "neutro_texto": "#33403A",
    "amarelo": "#F4B63F",
}

CSS = (
    "@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/BricolageGrotesque-Bold.woff) format('woff');font-weight:700;font-display:swap}"
    "@font-face{font-family:'Instrument Sans';src:url(/fonts/InstrumentSans-Regular.woff) format('woff');font-weight:400;font-display:swap}"
    "@font-face{font-family:'Instrument Sans';src:url(/fonts/InstrumentSans-Bold.woff) format('woff');font-weight:700;font-display:swap}"
    ":root{color-scheme:light;"
    + "".join(f"--{key.replace('_', '-')}:{value};" for key, value in COLORS.items())
    + "}"
    "*{box-sizing:border-box}"
    "html{-webkit-text-size-adjust:100%}"
    "body{margin:0;background:var(--creme);color:var(--tinta);font:400 17px/1.45 'Instrument Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}"
    "h1,h2,h3{font-family:'Bricolage Grotesque','Instrument Sans',system-ui,sans-serif;font-weight:700;line-height:1.1;margin:0}"
    "a{color:inherit}"
    "a:focus-visible{outline:3px solid var(--amarelo);outline-offset:3px}"
    ".topo{background:var(--verde);color:#fff;padding:28px 16px 30px}"
    ".miolo{max-width:720px;margin:0 auto}"
    ".id{display:flex;align-items:center;gap:16px}"
    ".logo{width:72px;height:72px;border-radius:50%;background:var(--papel);object-fit:cover;flex:none;border:3px solid var(--creme)}"
    "h1{font-size:clamp(28px,8vw,44px);overflow-wrap:anywhere}"
    ".estado{display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:8px 14px;border-radius:999px;font-weight:700;font-size:16px;min-height:40px}"
    ".estado::before{content:'';width:10px;height:10px;border-radius:50%;background:currentColor;flex:none}"
    ".estado.open{background:var(--aberto-fundo);color:var(--aberto-texto)}"
    ".estado.closed,.estado.paused{background:var(--fechado-fundo);color:var(--fechado-texto)}"
    ".estado.neutral{background:var(--neutro-fundo);color:var(--neutro-texto)}"
    ".pedir{display:flex;align-items:center;justify-content:center;min-height:56px;padding:0 24px;border-radius:16px;background:var(--verde);color:#fff;text-decoration:none;font-weight:700;font-size:19px;border-bottom:5px solid var(--verde-escuro)}"
    ".pedir:active{transform:translateY(3px);border-bottom-width:2px}"
    ".barra{position:sticky;bottom:0;z-index:2;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:var(--creme);border-top:1px solid var(--linha)}"
    ".barra .pedir{max-width:720px;margin:0 auto}"
    "main{padding:8px 16px 28px}"
    ".atalhos{display:flex;gap:8px;overflow-x:auto;padding:16px 0 4px;margin:0;list-style:none;scrollbar-width:thin}"
    ".atalhos a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;background:var(--papel);border:2px solid var(--linha);text-decoration:none;font-weight:700;white-space:nowrap}"
    "section{padding-top:28px;scroll-margin-top:8px}"
    "h2{font-size:clamp(24px,6vw,30px);padding-bottom:6px;border-bottom:3px solid var(--amarelo);display:inline-block}"
    "h3{font-size:19px;margin:22px 0 2px;color:var(--tinta-suave)}"
    "ul.pratos{list-style:none;margin:0;padding:0}"
    ".prato{display:grid;grid-template-columns:1fr auto;gap:4px 14px;padding:16px 0;border-bottom:1px solid var(--linha)}"
    ".prato.esgotado .nome,.prato.esgotado .preco{color:var(--tinta-suave)}"
    ".prato.esgotado .preco{text-decoration:line-through}"
    ".prato.esgotado .foto{filter:grayscale(1)}"
    ".nome{font-weight:700;font-size:18px;overflow-wrap:anywhere}"
    ".desc{grid-column:1;margin:0;color:var(--tinta-suave);font-size:16px;overflow-wrap:anywhere}"
    ".preco{grid-column:1;font-weight:700;font-size:18px}"
    ".etiqueta{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:8px;background:var(--neutro-fundo);color:var(--neutro-texto);font-size:14px;font-weight:700}"
    ".foto{grid-column:2;grid-row:1/span 3;width:84px;height:84px;border-radius:14px;object-fit:cover;background:var(--linha)}"
    ".vazio{margin:28px 0;padding:20px;border-radius:16px;background:var(--papel);border:2px solid var(--linha)}"
    "footer{padding:8px 16px 36px;color:var(--tinta-suave);font-size:15px}"
    "footer p{margin:6px 0}"
)

CSP = (
    "default-src 'none'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; "
    "frame-ancestors 'none'; style-src 'sha256-" + base64.b64encode(hashlib.sha256(CSS.encode("utf-8")).digest()).decode("ascii") + "'"
)


def _e(value) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def _dish_html(row: dict) -> str:
    classes = "prato esgotado" if row["sold_out"] else "prato"
    parts = [f'<li class="{classes}">']
    tag = ' <span class="etiqueta">Esgotado</span>' if row["sold_out"] else ""
    parts.append(f'<span class="nome">{_e(row["name"])}{tag}</span>')
    if row["description"]:
        parts.append(f'<p class="desc">{_e(row["description"])}</p>')
    if row["price_text"]:
        parts.append(f'<span class="preco">{_e(row["price_text"])}</span>')
    if row["thumb_url"]:
        parts.append(
            f'<img class="foto" src="{_e(row["thumb_url"])}" alt="{_e(row["name"])}" width="84" height="84" loading="lazy" decoding="async">'
        )
    parts.append("</li>")
    return "".join(parts)


def render(view: dict) -> str:
    """A página inteira. Todo texto que veio do banco passa por html.escape; não há script nenhum."""
    robots = "index,follow,max-image-preview:large" if view["indexable"] else "noindex,nofollow"
    status = view["status"]
    title, description = _e(view["title"]), _e(view["description"])
    order = _e(view["order_url"])

    head = [
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        f"<title>{title}</title>",
        f'<meta name="description" content="{description}">',
        f'<meta name="robots" content="{robots}">',
        f'<link rel="canonical" href="{_e(view["page_url"])}">',
        f'<meta name="theme-color" content="{COLORS["verde"]}">',
        '<link rel="icon" href="/favicon-32.png" sizes="32x32">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Vem Comer">',
        '<meta property="og:locale" content="pt_BR">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{description}">',
        f'<meta property="og:url" content="{_e(view["page_url"])}">',
        f'<meta property="og:image" content="{_e(view["preview_url"])}">',
        '<meta property="og:image:type" content="image/jpeg">',
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{_e("Cardápio de " + view["name"])}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{title}">',
        f'<meta name="twitter:description" content="{description}">',
        f'<meta name="twitter:image" content="{_e(view["preview_url"])}">',
        f'<script type="application/ld+json">{json_for_script(jsonld(view))}</script>',
        f"<style>{CSS}</style></head><body>",
    ]

    logo = ""
    if view["logo_thumb"]:
        logo = f'<img class="logo" src="{_e(view["logo_thumb"])}" alt="Logomarca de {_e(view["name"])}" width="72" height="72">'

    top = [
        '<header class="topo"><div class="miolo"><div class="id">',
        logo,
        f'<h1>{_e(view["name"])}</h1></div>',
        f'<p class="estado {_e(status["tone"])}" role="status">{_e(status["text"])}</p>',
        "</div></header>",
    ]

    body = ['<main class="miolo">']
    if len(view["groups"]) > 1:
        body.append('<nav aria-label="Categorias do cardápio"><ul class="atalhos">')
        for number, group in enumerate(view["groups"], 1):
            body.append(f'<li><a href="#cat-{number}">{_e(group["title"])}</a></li>')
        body.append("</ul></nav>")
    if not view["groups"]:
        body.append('<p class="vazio">O cardápio deste restaurante ainda está sendo montado. Toque em "Ver cardápio e pedir" para ver as novidades.</p>')
    for number, group in enumerate(view["groups"], 1):
        body.append(f'<section id="cat-{number}" aria-labelledby="cat-{number}-t"><h2 id="cat-{number}-t">{_e(group["title"])}</h2>')
        for section in group["sections"]:
            if section["title"]:
                body.append(f'<h3>{_e(section["title"])}</h3>')
            body.append('<ul class="pratos">' + "".join(_dish_html(row) for row in section["items"]) + "</ul>")
        body.append("</section>")
    body.append("</main>")

    foot = [
        f'<footer class="miolo"><p>Cardápio de {_e(view["name"])}. Os preços e os pratos são os do restaurante.</p>',
        f'<p>Feito com o <a href="{_e(view["home_url"])}">Vem Comer</a>.</p></footer>',
        f'<div class="barra"><a class="pedir" href="{order}">Ver cardápio e pedir</a></div>',
        "</body></html>",
    ]
    return "".join(head + top + body + foot)


def not_found_page() -> str:
    """Uma página simples e igual para tudo que não existe (restaurante, endereço malformado). Não diz nada a mais."""
    return (
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex,nofollow"><title>Página não encontrada</title>'
        f"<style>{CSS}</style></head><body><main class=\"miolo\"><section><h1>Não achamos esta página</h1>"
        '<p class="desc">Confira o endereço que você recebeu. Se foi um restaurante que mandou, peça o link de novo.</p>'
        "</section></main></body></html>"
    )


# ---------------------------------------------------------------------------------------------- sitemap e robots

SITEMAP_MAX = 5000


def sitemap_xml(base: str, slugs: list[str]) -> str:
    rows = []
    for slug in slugs[:SITEMAP_MAX]:
        if valid_slug(slug):
            rows.append(f"<url><loc>{html.escape(base + '/r/' + slug, quote=True)}</loc></url>")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(rows) + "</urlset>"
    )


def robots_txt(base: str, indexed: bool) -> str:
    """Aberta só para a prévia: o Google não deve guardar. Com a segunda chave ligada, convida e aponta o sitemap."""
    if indexed:
        lines = ["User-agent: *", "Disallow: /api/", "Allow: /r/", f"Sitemap: {base}/sitemap.xml"]
    else:
        lines = ["User-agent: *", "Disallow: /api/", "Disallow: /r/"]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------------------------- limite por endereço

class PageLimiter:
    """Pedidos por minuto de um mesmo endereço de rede. Em memória (um processo só); zera ao reiniciar.

    Vários celulares na mesma rede móvel dividem um endereço, e os robôs do WhatsApp e do Facebook vêm de poucos
    endereços: o limite é folgado, serve para frear um laço de robô, não gente."""

    def __init__(self, per_minute: int, clock=time.time):
        self.per_minute = per_minute
        self._clock = clock
        self._lock = threading.Lock()
        self._by_ip: dict[str, deque] = {}

    def allow(self, ip: str) -> bool:
        now = self._clock()
        with self._lock:
            if len(self._by_ip) > 5000:
                for key in [k for k, v in self._by_ip.items() if not v or now - v[-1] > 60]:
                    del self._by_ip[key]
            hits = self._by_ip.setdefault(str(ip), deque())
            while hits and now - hits[0] > 60:
                hits.popleft()
            if len(hits) >= self.per_minute:
                return False
            hits.append(now)
            return True
