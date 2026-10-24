"""A página pública do restaurante: regras puras (public_page.py) e a imagem da prévia (page_preview.py).

Não precisa de banco nem de rede. O que a página mostra, o que ela NUNCA mostra, como o texto do dono é escapado,
as chaves desligadas de fábrica, o contraste das cores e a imagem em português com acento.
"""

import io
import json
import os
import re
import unittest
import xml.etree.ElementTree as ET
from contextlib import contextmanager
from decimal import Decimal
from unittest.mock import patch

from PIL import Image, ImageDraw

import page_preview
import public_page as pp

BASE = "https://vem.example.com"
KEY = "a" * 32


@contextmanager
def env(**values):
    """Define (ou, com None, tira) variáveis de ambiente só dentro do bloco."""
    with patch.dict(os.environ, {}, clear=False):
        for name, value in values.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        yield


def company(**extra):
    base = {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Pastelaria do Zé",
        "slug": "pastelaria-do-ze",
        "logo_url": "/media/c/logo.webp",
        "logo_thumb_url": "/media/c/logo-thumb.webp",
        "accepting_orders": True,
        "public_page_listed": True,
        "hours": {"configured": True, "open_now": True, "message": "Aberto até 23h.", "paused": False},
    }
    base.update(extra)
    return base


def dish(name, menu_id="m1", price="9.00", **extra):
    base = {
        "id": name,
        "menu_id": menu_id,
        "name": name,
        "description": "",
        "subcategory": None,
        "price": Decimal(price),
        "image_key": None,
        "image_url": None,
        "thumb_url": None,
        "sold_out": False,
    }
    base.update(extra)
    return base


MENUS = [{"id": "m1", "name": "Pastéis"}, {"id": "m2", "name": "Bebidas"}]


def products():
    return [
        dish("Pastel de carne", description="Carne moída, azeitona e ovo.", subcategory="Tradicionais",
             image_key=KEY, image_url=f"/media/c/{KEY}.webp", thumb_url=f"/media/c/{KEY}-thumb.webp"),
        dish("Pastel de queijo", subcategory="Tradicionais", price="8.50"),
        dish("Pastel de camarão", subcategory="Especiais", price="14.00", sold_out=True),
        dish("Caldo de cana", menu_id="m2", price="6.00"),
        dish("Brigadeiro", menu_id=None, price="3.50"),
    ]


def view(**kwargs):
    with env(PUBLIC_PAGE_OPEN="1", PUBLIC_PAGE_INDEX="1"):
        return pp.build_view(kwargs.get("company") or company(), kwargs.get("menus", MENUS),
                             kwargs["products"] if "products" in kwargs else products(), BASE, kwargs.get("origin"))


def html_of(**kwargs):
    return pp.render(view(**kwargs))


def luminance(hex_color):
    channels = []
    for i in (1, 3, 5):
        c = int(hex_color[i:i + 2], 16) / 255
        channels.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


class SwitchTests(unittest.TestCase):
    def test_everything_is_off_without_the_keys(self):
        with env(PUBLIC_PAGE_OPEN=None, PUBLIC_PAGE_INDEX=None):
            self.assertFalse(pp.is_open())
            self.assertFalse(pp.is_indexed())

    def test_the_second_key_alone_does_nothing(self):
        with env(PUBLIC_PAGE_OPEN=None, PUBLIC_PAGE_INDEX="1"):
            self.assertFalse(pp.is_open())
            self.assertFalse(pp.is_indexed())

    def test_open_without_google_and_open_with_google(self):
        with env(PUBLIC_PAGE_OPEN="1", PUBLIC_PAGE_INDEX=None):
            self.assertTrue(pp.is_open())
            self.assertFalse(pp.is_indexed())
        with env(PUBLIC_PAGE_OPEN="sim", PUBLIC_PAGE_INDEX="true"):
            self.assertTrue(pp.is_indexed())

    def test_other_values_do_not_turn_it_on(self):
        for value in ("", "0", "no", "nao", "2", "ligado"):
            with env(PUBLIC_PAGE_OPEN=value, PUBLIC_PAGE_INDEX=value):
                self.assertFalse(pp.is_open(), value)


class InputTests(unittest.TestCase):
    def test_slugs(self):
        for good in ("pastelaria-do-ze", "a", "pizza2go", "x" * 100):
            self.assertTrue(pp.valid_slug(good), good)
        for bad in ("", "-x", "Pastel", "a b", "a/b", "a..b", "a?b", "x" * 101, "ação", None, 5, "a\n"):
            self.assertFalse(pp.valid_slug(bad), repr(bad))

    def test_origin_only_from_the_known_list(self):
        self.assertEqual(pp.clean_origin(" WhatsApp "), "whatsapp")
        self.assertEqual(pp.clean_origin("qr"), "qr")
        for bad in ("", "evil", "whatsapp&x=1", "<script>", None, 3, "whats app"):
            self.assertIsNone(pp.clean_origin(bad), repr(bad))

    def test_base_url_comes_from_the_setting_then_from_the_request(self):
        with env(PUBLIC_BASE_URL="https://vem.example.com/"):
            self.assertEqual(pp.base_url("http://other/"), "https://vem.example.com")
        with env(PUBLIC_BASE_URL=None):
            self.assertEqual(pp.base_url("https://host.test/"), "https://host.test")
            self.assertEqual(pp.base_url("http://localhost:5000/"), "http://localhost:5000")

    def test_a_base_that_is_not_an_address_is_dropped(self):
        for junk in ("javascript:alert(1)", "https://a b", 'https://x"onload=1', "//evil", "https://evil.com/path", "ftp://x"):
            with env(PUBLIC_BASE_URL=junk):
                self.assertEqual(pp.base_url(""), "", junk)
                self.assertEqual(pp.base_url("https://ok.test/"), "https://ok.test", junk)


class TextTests(unittest.TestCase):
    def test_money_in_reais(self):
        self.assertEqual(pp.money(9), "R$ 9,00")
        self.assertEqual(pp.money(Decimal("8.5")), "R$ 8,50")
        self.assertEqual(pp.money("1234.5"), "R$ 1.234,50")
        self.assertEqual(pp.money(1234567.891), "R$ 1.234.567,89")
        self.assertEqual(pp.money(0), "R$ 0,00")

    def test_a_price_that_is_not_a_number_shows_no_price(self):
        for bad in (None, "", "abc", -1, float("nan")):
            self.assertEqual(pp.money(bad), "", repr(bad))
            self.assertIsNone(pp.price_number(bad), repr(bad))
        self.assertEqual(pp.price_number(Decimal("9")), "9.00")

    def test_clean_text_removes_control_characters_and_extra_spaces(self):
        self.assertEqual(pp.clean_text("  Pastel \n\t de  carne\x00\x1b "), "Pastel de carne")
        self.assertEqual(pp.clean_text(None), "")
        self.assertEqual(pp.clean_text(5), "")

    def test_excerpt_cuts_on_a_whole_word(self):
        text = "uma frase bem comprida para cortar no meio de alguma palavra qualquer"
        short = pp.excerpt(text, 30)
        self.assertTrue(short.endswith("…"))
        self.assertLessEqual(len(short), 30)
        self.assertNotIn("palav", short)
        self.assertEqual(pp.excerpt("curto", 30), "curto")


class StatusTests(unittest.TestCase):
    def test_paused_wins(self):
        status = pp.status_of(company(accepting_orders=False, hours={"paused": True, "configured": True, "open_now": True}))
        self.assertEqual(status["tone"], "paused")
        self.assertIn("pausa", status["text"])

    def test_a_blocked_plan_never_says_why(self):
        status = pp.status_of(company(accepting_orders=False, hours={"configured": False, "paused": False}))
        self.assertEqual(status["tone"], "closed")
        for word in ("assinatura", "plano", "pagamento", "bloque", "cobran", "vencid"):
            self.assertNotIn(word, status["text"].lower())

    def test_hours(self):
        self.assertEqual(pp.status_of(company())["tone"], "open")
        closed = company(hours={"configured": True, "open_now": False, "message": "Fechado agora. Abre amanhã às 11h.", "paused": False})
        self.assertEqual(pp.status_of(closed), {"tone": "closed", "text": "Fechado agora. Abre amanhã às 11h."})

    def test_without_hours_it_just_invites(self):
        status = pp.status_of(company(hours={"configured": False, "open_now": True, "message": "", "paused": False}))
        self.assertEqual(status["tone"], "neutral")


class GroupingTests(unittest.TestCase):
    """As mesmas regras de frontend/src/customer/menuGroups.ts: a página e o aplicativo mostram a mesma ordem."""

    def test_categories_in_the_order_given_and_loose_dishes_last_under_outros(self):
        groups = pp.group_products(products(), MENUS)
        self.assertEqual([g["title"] for g in groups], ["Pastéis", "Bebidas", "Outros"])

    def test_without_any_category_the_loose_dishes_are_the_menu(self):
        groups = pp.group_products([dish("A", menu_id=None)], [])
        self.assertEqual([g["title"] for g in groups], ["Cardápio"])

    def test_a_dish_of_a_turned_off_category_is_hidden(self):
        groups = pp.group_products([dish("Fantasma", menu_id="desligada")], MENUS)
        self.assertEqual(groups, [])

    def test_empty_categories_are_left_out(self):
        groups = pp.group_products([dish("Caldo", menu_id="m2")], MENUS)
        self.assertEqual([g["title"] for g in groups], ["Bebidas"])

    def test_subsections_follow_the_first_appearance_and_ignore_accents_and_case(self):
        items = [
            dish("A", subcategory="Especiais"),
            dish("B", subcategory="Tradicionais"),
            dish("C", subcategory="especiais "),
            dish("D", subcategory=None),
        ]
        sections = pp.group_products(items, MENUS)[0]["sections"]
        self.assertEqual([s["title"] for s in sections], ["Especiais", "Tradicionais", ""])
        self.assertEqual([i["name"] for i in sections[0]["items"]], ["A", "C"])

    def test_ids_may_be_text_or_uuid_objects(self):
        import uuid
        menu_id = uuid.uuid4()
        groups = pp.group_products([dish("A", menu_id=menu_id)], [{"id": str(menu_id), "name": "X"}])
        self.assertEqual(len(groups), 1)


class ViewTests(unittest.TestCase):
    def test_links(self):
        v = view()
        self.assertEqual(v["page_url"], f"{BASE}/r/pastelaria-do-ze")
        self.assertEqual(v["order_url"], f"{BASE}/?empresa=pastelaria-do-ze")
        self.assertEqual(v["preview_url"], f"{BASE}/r/pastelaria-do-ze/previa.jpg")

    def test_the_origin_goes_to_the_order_link_only_when_it_is_known(self):
        self.assertEqual(view(origin="whatsapp")["order_url"], f"{BASE}/?empresa=pastelaria-do-ze&de=whatsapp")
        self.assertEqual(view(origin="x&y=1")["order_url"], f"{BASE}/?empresa=pastelaria-do-ze")

    def test_description_names_the_first_dishes_that_can_be_ordered(self):
        v = view()
        self.assertIn("Pastelaria do Zé", v["description"])
        self.assertIn("Pastel de carne e Pastel de queijo e Caldo de cana", v["description"].replace(", ", " e "))
        self.assertNotIn("camarão", v["description"])  # esgotado
        self.assertLessEqual(len(v["description"]), 158)

    def test_counts_leave_out_sold_out_dishes_but_show_them(self):
        v = view()
        self.assertEqual(v["dish_count"], 4)
        self.assertEqual(v["total_count"], 5)

    def test_only_known_fields_reach_the_view(self):
        sneaky = company(owner_phone="11999998888", owner_email="dono@x.com", pix_key="chave-pix-secreta", password_hash="h")
        text = json.dumps(view(company=sneaky), default=str)
        for secret in ("11999998888", "dono@x.com", "chave-pix-secreta", "password_hash"):
            self.assertNotIn(secret, text)

    def test_preview_uses_the_first_dish_with_a_photo(self):
        self.assertEqual(view()["preview_dish_key"], KEY)
        self.assertIsNone(view(products=[dish("Sem foto")])["preview_dish_key"])

    def test_the_main_image_is_a_dish_then_the_logo(self):
        self.assertEqual(view()["main_image"], f"{BASE}/media/c/{KEY}.webp")
        self.assertEqual(view(products=[dish("Sem foto")])["main_image"], f"{BASE}/media/c/logo.webp")
        self.assertIsNone(view(company=company(logo_url=None), products=[dish("Sem foto")])["main_image"])

    def test_who_may_be_found_on_google(self):
        self.assertTrue(view()["indexable"])
        self.assertFalse(view(company=company(public_page_listed=False))["indexable"])  # o dono não quis
        self.assertFalse(view(company=company(public_page_listed=None))["indexable"])
        self.assertFalse(view(company=company(accepting_orders=False))["indexable"])
        self.assertFalse(view(company=company(hours={"paused": True}))["indexable"])
        self.assertFalse(view(products=[], menus=[])["indexable"])  # sem prato, nada a mostrar
        self.assertFalse(view(products=[dish("A", sold_out=True)])["indexable"])
        with env(PUBLIC_PAGE_OPEN="1", PUBLIC_PAGE_INDEX=None):
            self.assertFalse(pp.build_view(company(), MENUS, products(), BASE)["indexable"])  # chave do servidor desligada
        with env(PUBLIC_PAGE_OPEN=None, PUBLIC_PAGE_INDEX="1"):
            self.assertFalse(pp.build_view(company(), MENUS, products(), BASE)["indexable"])


class RenderSecurityTests(unittest.TestCase):
    EVIL = '<img src=x onerror=alert(1)>"\'</script><script>alert(2)</script>&amp;'

    def evil_html(self):
        c = company(name=self.EVIL, logo_thumb_url='/x" onerror="alert(3)')
        items = [dish(self.EVIL, description=self.EVIL, subcategory=self.EVIL, thumb_url='/m" onerror="alert(4)')]
        return html_of(company=c, products=items, menus=[{"id": "m1", "name": self.EVIL}])

    def test_text_from_the_owner_never_arrives_raw(self):
        page = self.evil_html()
        self.assertNotIn("<img src=x", page)
        self.assertNotIn("<script>alert", page)
        self.assertNotIn('onerror="alert', page)
        self.assertIn("&lt;img src=x onerror=alert(1)&gt;", page)

    def test_the_only_script_is_the_structured_data_and_it_cannot_be_closed_early(self):
        page = self.evil_html()
        scripts = re.findall(r"<script\b[^>]*>(.*?)</script>", page, re.S)
        self.assertEqual(len(scripts), 1)
        self.assertIn('type="application/ld+json"', page)
        data = json.loads(scripts[0])  # continua sendo JSON válido
        self.assertEqual(data["name"], self.EVIL)  # e diz o que o dono escreveu, sem perder nada
        self.assertNotIn("</", scripts[0])

    def test_no_script_files_no_inline_handlers_no_inline_styles(self):
        page = html_of()
        self.assertNotRegex(page, r"<script[^>]+src=")
        self.assertNotRegex(page, r"\son[a-z]+\s*=")
        self.assertNotRegex(page, r'\sstyle\s*=')
        self.assertNotIn("javascript:", page)
        self.assertNotRegex(page, r"<(iframe|form|input|object|embed|link rel=\"stylesheet\")")

    def test_nothing_private_is_ever_on_the_page(self):
        sneaky = company(owner_phone="11999998888", owner_email="dono@x.com", pix_key="chave-pix-secreta", cnpj="12.345.678/0001-90")
        page = html_of(company=sneaky)
        for secret in ("11999998888", "dono@x.com", "chave-pix-secreta", "12.345.678", "tel:", "mailto:", "wa.me"):
            self.assertNotIn(secret, page)

    def test_the_security_policy_matches_the_style_block(self):
        page = html_of()
        style = re.search(r"<style>(.*?)</style>", page, re.S).group(1)
        import base64
        import hashlib
        digest = base64.b64encode(hashlib.sha256(style.encode("utf-8")).digest()).decode()
        self.assertIn(f"'sha256-{digest}'", pp.CSP)
        self.assertIn("default-src 'none'", pp.CSP)
        self.assertIn("frame-ancestors 'none'", pp.CSP)
        self.assertNotIn("unsafe-inline", pp.CSP)
        self.assertNotIn("script-src", pp.CSP)  # sem regra de script: default-src 'none' já barra todos
        # o mesmo bloco serve à página de "não achei"
        self.assertIn(style, pp.not_found_page())

    def test_the_not_found_page_says_nothing_about_who_exists(self):
        page = pp.not_found_page()
        self.assertIn("noindex", page)
        self.assertNotIn("restaurante não existe", page.lower())


class RenderContentTests(unittest.TestCase):
    def test_header_status_dishes_and_button(self):
        page = html_of()
        self.assertIn('<html lang="pt-BR">', page)
        self.assertEqual(page.count("<h1>"), 1)
        self.assertIn("<h1>Pastelaria do Zé</h1>", page)
        self.assertIn("Aberto até 23h.", page)
        self.assertIn('role="status"', page)
        for text in ("Pastel de carne", "R$ 9,00", "R$ 8,50", "Caldo de cana", "Brigadeiro", "Tradicionais", "Especiais"):
            self.assertIn(text, page)
        self.assertIn(f'href="{BASE}/?empresa=pastelaria-do-ze"', page)
        self.assertIn("Ver cardápio e pedir", page)

    def test_sold_out_is_written_not_only_faded(self):
        page = html_of()
        self.assertIn("Esgotado", page)
        self.assertIn("Pastel de camarão", page)

    def test_photos_have_text_and_size(self):
        page = html_of()
        match = re.search(r'<img class="foto"[^>]*>', page)
        self.assertIsNotNone(match)
        self.assertIn('alt="Pastel de carne"', match.group(0))
        self.assertIn('width="84"', match.group(0))
        self.assertIn('loading="lazy"', match.group(0))
        self.assertIn('alt="Logomarca de Pastelaria do Zé"', page)

    def test_category_shortcuts_link_to_real_sections(self):
        page = html_of()
        for number in (1, 2, 3):
            self.assertIn(f'href="#cat-{number}"', page)
            self.assertIn(f'id="cat-{number}"', page)
        single = html_of(products=[dish("Só um")], menus=[{"id": "m1", "name": "Único"}])
        self.assertNotIn('href="#cat-', single)

    def test_an_empty_menu_says_so_and_stays_out_of_google(self):
        page = html_of(products=[dish("X", menu_id="desligada")])
        self.assertIn("ainda está sendo montado", page)
        self.assertIn('content="noindex,nofollow"', page)

    def test_the_order_button_carries_the_origin(self):
        page = pp.render(view(origin="instagram"))
        self.assertIn("/?empresa=pastelaria-do-ze&amp;de=instagram", page)

    def test_a_dish_without_a_valid_price_has_no_price_line(self):
        page = html_of(products=[dish("Misterioso", price="1"), {**dish("Sem preço"), "price": None}])
        self.assertIn("Sem preço", page)
        self.assertEqual(len(re.findall(r'class="preco"', page)), 1)

    def test_the_footer_is_honest_and_links_home(self):
        page = html_of()
        self.assertIn(f'<a href="{BASE}/">Vem Comer</a>', page)


class SeoTests(unittest.TestCase):
    def test_share_preview_tags(self):
        page = html_of()
        for needle in (
            '<title>Pastelaria do Zé: cardápio e pedidos</title>',
            f'<link rel="canonical" href="{BASE}/r/pastelaria-do-ze">',
            '<meta property="og:type" content="website">',
            '<meta property="og:site_name" content="Vem Comer">',
            f'<meta property="og:url" content="{BASE}/r/pastelaria-do-ze">',
            f'<meta property="og:image" content="{BASE}/r/pastelaria-do-ze/previa.jpg">',
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            '<meta name="twitter:card" content="summary_large_image">',
            '<meta property="og:locale" content="pt_BR">',
        ):
            self.assertIn(needle, page)

    def test_robots_meta_follows_the_two_keys_and_the_owner(self):
        self.assertIn('content="index,follow,max-image-preview:large"', html_of())
        self.assertIn('content="noindex,nofollow"', html_of(company=company(public_page_listed=False)))

    def test_structured_data_is_a_restaurant_with_a_menu(self):
        data = pp.jsonld(view())
        self.assertEqual(data["@type"], "Restaurant")
        self.assertEqual(data["name"], "Pastelaria do Zé")
        self.assertEqual(data["url"], f"{BASE}/r/pastelaria-do-ze")
        self.assertEqual(data["image"], [f"{BASE}/media/c/{KEY}.webp"])
        sections = data["hasMenu"]["hasMenuSection"]
        self.assertEqual([s["name"] for s in sections], ["Pastéis", "Bebidas", "Outros"])
        first = sections[0]["hasMenuItem"][0]
        self.assertEqual(first["name"], "Pastel de carne")
        self.assertEqual(first["offers"], {"@type": "Offer", "price": "9.00", "priceCurrency": "BRL"})

    def test_structured_data_leaves_out_sold_out_dishes_and_claims_nothing_unknown(self):
        text = json.dumps(pp.jsonld(view()), ensure_ascii=False)
        self.assertNotIn("camarão", text)
        for claim in ("aggregateRating", "review", "telephone", "address", "servesCuisine", "openingHours", "priceRange", "geo"):
            self.assertNotIn(claim, text)

    def test_empty_menu_has_no_menu_block(self):
        data = pp.jsonld(view(products=[dish("X", menu_id="desligada")]))
        self.assertNotIn("hasMenu", data)


class DesignTests(unittest.TestCase):
    def test_every_text_color_reads_well_on_its_background(self):
        c = pp.COLORS
        pairs = {
            "texto no creme": (c["tinta"], c["creme"]),
            "texto suave no creme": (c["tinta_suave"], c["creme"]),
            "texto suave no branco": (c["tinta_suave"], c["papel"]),
            "cabeçalho": ("#FFFFFF", c["verde"]),
            "botão": ("#FFFFFF", c["verde"]),
            "aberto": (c["aberto_texto"], c["aberto_fundo"]),
            "fechado": (c["fechado_texto"], c["fechado_fundo"]),
            "neutro": (c["neutro_texto"], c["neutro_fundo"]),
            "etiqueta esgotado": (c["neutro_texto"], c["neutro_fundo"]),
        }
        for name, (fg, bg) in pairs.items():
            self.assertGreaterEqual(contrast(fg, bg), 4.5, f"{name}: {contrast(fg, bg):.2f}")

    def test_a_sold_out_row_is_marked_by_words_and_never_by_fading_the_text(self):
        # texto esmaecido por opacidade perde contraste (a tinta a 62% sobre o creme dá menos de 4,5:1)
        self.assertNotIn("opacity", pp.CSS)
        self.assertIn(".prato.esgotado .nome", pp.CSS)

    def test_touch_targets_and_focus(self):
        css = pp.CSS
        self.assertIn("min-height:56px", css)  # o botão
        self.assertIn("min-height:44px", css)  # os atalhos
        self.assertIn(":focus-visible", css)
        self.assertNotIn("100vw", css)  # a página não rola de lado

    def test_brand_fonts_ship_with_their_license(self):
        folder = os.path.join(os.path.dirname(os.path.abspath(page_preview.__file__)), "fonts")
        for name in ("BricolageGrotesque-Bold.woff", "InstrumentSans-Regular.woff", "InstrumentSans-Bold.woff",
                     "OFL-BricolageGrotesque.txt", "OFL-InstrumentSans.txt"):
            self.assertTrue(os.path.isfile(os.path.join(folder, name)), name)


class SitemapRobotsTests(unittest.TestCase):
    def test_sitemap_is_valid_xml_with_one_url_per_restaurant(self):
        xml = pp.sitemap_xml(BASE, ["pastelaria-do-ze", "pizza-da-nona"])
        root = ET.fromstring(xml)
        urls = [e.text for e in root.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        self.assertEqual(urls, [f"{BASE}/r/pastelaria-do-ze", f"{BASE}/r/pizza-da-nona"])

    def test_sitemap_drops_bad_names_and_caps_the_size(self):
        xml = pp.sitemap_xml(BASE, ["ok", "<x>", "a b", "Maiúscula", "ok-2"])
        self.assertEqual(xml.count("<loc>"), 2)
        many = pp.sitemap_xml(BASE, [f"r{i}" for i in range(pp.SITEMAP_MAX + 50)])
        self.assertEqual(many.count("<loc>"), pp.SITEMAP_MAX)

    def test_robots_closed_to_google_and_open_to_google(self):
        closed = pp.robots_txt(BASE, False)
        self.assertIn("Disallow: /r/", closed)
        self.assertIn("Disallow: /api/", closed)
        self.assertNotIn("Sitemap", closed)
        opened = pp.robots_txt(BASE, True)
        self.assertIn("Allow: /r/", opened)
        self.assertIn(f"Sitemap: {BASE}/sitemap.xml", opened)
        self.assertNotIn("Disallow: /r/", opened)


class LimiterTests(unittest.TestCase):
    def test_blocks_the_burst_and_forgives_after_a_minute(self):
        now = [1000.0]
        limiter = pp.PageLimiter(3, clock=lambda: now[0])
        self.assertEqual([limiter.allow("1.1.1.1") for _ in range(4)], [True, True, True, False])
        self.assertTrue(limiter.allow("2.2.2.2"))  # outro endereço não paga pelo primeiro
        now[0] += 61
        self.assertTrue(limiter.allow("1.1.1.1"))

    def test_memory_does_not_grow_without_end(self):
        now = [0.0]
        limiter = pp.PageLimiter(5, clock=lambda: now[0])
        for i in range(6000):
            limiter.allow(f"10.0.{i // 250}.{i % 250}")
        now[0] += 120
        limiter.allow("novo")
        self.assertLess(len(limiter._by_ip), 6000)


class PreviewImageTests(unittest.TestCase):
    def photo(self, color=(200, 90, 40), size=(900, 700), fmt="WEBP"):
        out = io.BytesIO()
        Image.new("RGB", size, color).save(out, fmt)
        return out.getvalue()

    def logo(self):
        out = io.BytesIO()
        Image.new("RGBA", (200, 200), (30, 30, 200, 255)).save(out, "PNG")
        return out.getvalue()

    def check(self, data):
        image = Image.open(io.BytesIO(data))
        self.assertEqual(image.format, "JPEG")
        self.assertEqual(image.size, (1200, 630))
        self.assertLess(len(data), 300 * 1024, "o WhatsApp deixa de mostrar prévia de imagem pesada")
        return image

    def test_every_combination_makes_a_valid_card(self):
        for photo in (None, self.photo()):
            for logo in (None, self.logo()):
                self.check(page_preview.render("Pastelaria do Zé", photo, logo))

    def test_the_name_is_written_in_the_left_half_and_the_photo_fills_the_right(self):
        card = self.check(page_preview.render("Pastelaria do Zé", self.photo((250, 10, 10)), None)).convert("RGB")
        # direita: a cor da foto; esquerda: o verde da marca
        r, g, b = card.getpixel((1000, 300))
        self.assertGreater(r, 200)
        self.assertLess(g, 80)
        lr, lg, lb = card.getpixel((20, 20))
        self.assertGreater(lg, lr)
        self.assertGreater(lg, lb)
        # tem letra clara escrita na esquerda (acento incluído): pixels bem claros na faixa do nome
        light = sum(1 for x in range(60, 600, 3) for y in range(120, 400, 3) if sum(card.getpixel((x, y))) > 600)
        self.assertGreater(light, 200)

    def test_accents_are_drawn_not_boxes(self):
        # a letra da marca tem ã, é e ç; a padrão do Pillow não tem: sai um quadradinho vazio no lugar
        font = page_preview._font(page_preview.TITLE_FONT, 80)
        draw = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        for letter in "ãéçõíú":
            self.assertNotEqual(font.getmask(letter).getbbox(), font.getmask("￾").getbbox(), letter)
        self.assertTrue(draw.textlength("Açaí", font=font) > 0)

    def test_garbage_or_huge_images_are_ignored_not_fatal(self):
        for bad in (b"isto nao e imagem", b"\x00" * 50, b"RIFF....WEBPxxxx"):
            self.check(page_preview.render("Pão", bad, bad))
        self.assertIsNone(page_preview._open(None))
        self.assertIsNone(page_preview._open(b""))

    def test_very_long_and_odd_names_still_fit(self):
        for name in ("A" * 120, "Restaurante e Pizzaria Sabor da Vovó Conceição do Norte e Região Metropolitana Ltda", "Z", "ÃÉÇ " * 20,
                     "Supercalifragilisticexpialidocious" * 3):
            self.check(page_preview.render(name, None, None))

    def test_name_wrapping_never_goes_past_the_column(self):
        draw = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        font, lines, size = page_preview._fit_name(draw, "Restaurante e Pizzaria Sabor da Vovó Conceição do Norte Ltda")
        self.assertLessEqual(len(lines), page_preview.MAX_LINES)
        for line in lines:
            self.assertLessEqual(draw.textlength(line, font=font), page_preview.TEXT_WIDTH)

    def test_cache_keeps_recent_cards_and_forgets_old_ones(self):
        cache = page_preview.PreviewCache(size=2)
        cache.put(("a",), b"1")
        cache.put(("b",), b"2")
        self.assertEqual(cache.get(("a",)), b"1")  # a fica "recente"
        cache.put(("c",), b"3")
        self.assertIsNone(cache.get(("b",)))
        self.assertEqual(cache.get(("a",)), b"1")
        self.assertEqual(cache.get(("c",)), b"3")


if __name__ == "__main__":
    unittest.main()
