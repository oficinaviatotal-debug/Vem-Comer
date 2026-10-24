"""Máquina de vendas do Vem (vendas.py, migração 021): regras, sugestões e funil. Sem banco: cursor de mentira.

O que mais importa aqui: o sistema nunca manda nada, "não quero" vale para sempre, ninguém é procurado mais do que o
limite e todo negócio entra com a origem do contato.
"""

import hashlib
import re
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import consent
import outreach
import vendas as v

# Terça-feira, 20/10/2026, 14h30 em Brasília (17h30 em UTC): dentro da folga de pastelaria e restaurante.
NOW = datetime(2026, 10, 20, 17, 30, tzinfo=timezone.utc)
SUNDAY = datetime(2026, 10, 25, 17, 30, tzinfo=timezone.utc)
DAY = timedelta(days=1)
MIGRATION = Path(__file__).resolve().parent.parent / "database" / "migrations" / "021_vendas_do_vem.sql"


def prospect(**over):
    base = dict(
        id="11111111-1111-4111-8111-111111111111", business_name="Pastelaria do Zé", business_kind="pastelaria", city="Natal",
        neighborhood=None, contact_person=None, phone="5584999998888", email=None, instagram=None, site=None,
        source="anuncio_publico", source_note="Anúncio no Instagram da pastelaria", stage="achado", touches=0,
        whatsapp_touches=0, last_touch_at=None, last_channel=None, replied_at=None, reply_kind=None,
        stage_since=NOW - DAY, snooze_until=None, created_at=NOW - DAY, suppressed=False, note=None,
    )
    base.update(over)
    return base


class PhoneTests(unittest.TestCase):
    def test_the_usual_ways_of_writing_a_brazilian_number(self):
        for text in ("(84) 99999-8888", "+55 84 99999-8888", "84999998888", "5584999998888", "084 99999-8888", "(84)99999 8888"):
            self.assertEqual(v.normalize_phone(text), "5584999998888", text)

    def test_old_mobile_numbers_get_the_ninth_digit(self):
        self.assertEqual(v.normalize_phone("(84) 8888-7777"), "5584988887777")

    def test_landlines_are_kept_and_are_not_mobile(self):
        phone = v.normalize_phone("(84) 3222-1234")
        self.assertEqual(phone, "558432221234")
        self.assertFalse(v.is_mobile(phone))
        self.assertTrue(v.is_mobile("5584999998888"))

    def test_the_ddd_55_is_not_mistaken_for_the_country_code(self):
        self.assertEqual(v.normalize_phone("(55) 99999-8888"), "5555999998888")
        self.assertEqual(v.normalize_phone("+55 55 99999-8888"), "5555999998888")

    def test_things_that_are_not_phones(self):
        for bad in (None, "", "abc", "1234", "(00) 99999-8888", "(84) 5999-88", True, 3.5, "84 7 99999-8888"):
            self.assertIsNone(v.normalize_phone(bad), repr(bad))

    def test_the_fingerprint_is_stable_and_ignores_formatting(self):
        self.assertEqual(v.phone_hash("(84) 99999-8888"), v.phone_hash("+55 84 999998888"))
        self.assertEqual(len(v.phone_hash("84999998888")), 64)
        # o bloqueio guarda esta conta (SHA-256 do número com o 55), então ela nunca pode mudar
        self.assertEqual(v.phone_hash("84999998888"), hashlib.sha256(b"5584999998888").hexdigest())
        with self.assertRaises(ValueError):
            v.phone_hash("lixo")

    def test_display(self):
        self.assertEqual(v.phone_display("5584999998888"), "(84) 99999-8888")
        self.assertEqual(v.phone_display("558432221234"), "(84) 3222-1234")
        self.assertEqual(v.phone_display(None), "")


class InstagramTests(unittest.TestCase):
    def test_handles(self):
        for text in ("@PizzariaDoZe", "pizzariadoze", "https://www.instagram.com/pizzariadoze/", "instagram.com/pizzariadoze?hl=pt"):
            self.assertEqual(v.normalize_instagram(text), "pizzariadoze", text)
        for bad in (None, "", "@", "com espaço", "a" * 31, "instagram.com/p/ABC123", "..", "nome."):
            self.assertIsNone(v.normalize_instagram(bad), repr(bad))


class ParseContactTests(unittest.TestCase):
    def test_a_typical_instagram_post(self):
        text = (
            "🍕 Pizzaria do Zé 🍕\n"
            "Pizza no capricho, todo dia!\n"
            "Pedidos: (84) 99999-8888\n"
            "Siga @pizzariadoze\n"
            "contato@pizzariadoze.com.br"
        )
        found = v.parse_contact_text(text)
        self.assertEqual(found["name"], "Pizzaria do Zé")
        self.assertEqual(found["phone"], "5584999998888")
        self.assertEqual(found["instagram"], "pizzariadoze")
        self.assertEqual(found["email"], "contato@pizzariadoze.com.br")
        self.assertIsNone(found["site"])

    def test_wa_me_links_and_site(self):
        found = v.parse_contact_text("Sorveteria Gelo Bom\nhttps://wa.me/5584988887777\nwww.gelobom.com.br\nhttps://instagram.com/gelobom")
        self.assertEqual(found["phone"], "5584988887777")
        self.assertEqual(found["site"], "https://www.gelobom.com.br")
        self.assertEqual(found["instagram"], "gelobom")
        self.assertEqual(found["name"], "Sorveteria Gelo Bom")

    def test_the_email_is_not_read_as_an_instagram_handle(self):
        found = v.parse_contact_text("Padaria Pão Quente\njoao@padaria.com.br")
        self.assertIsNone(found["instagram"])
        self.assertEqual(found["email"], "joao@padaria.com.br")

    def test_two_phones_keep_the_first_and_list_the_other(self):
        found = v.parse_contact_text("Bar do Chico\n(84) 3222-1234 / (84) 99999-1111")
        self.assertEqual(found["phone"], "558432221234")
        self.assertEqual(found["other_phones"], ["5584999991111"])

    def test_nothing_found_means_nothing_invented(self):
        found = v.parse_contact_text("bom dia")
        self.assertEqual(found["phone"], None)
        self.assertEqual(found["email"], None)
        self.assertEqual(found["instagram"], None)
        self.assertEqual(found["site"], None)
        self.assertEqual(v.parse_contact_text(None)["name"], None)

    def test_a_cnpj_or_a_price_is_not_a_phone(self):
        found = v.parse_contact_text("Lanches do Beto\nCNPJ 12.345.678/0001-90\nCombo R$ 25,00")
        self.assertIsNone(found["phone"])


class ClassifyReplyTests(unittest.TestCase):
    def test_no_means_stop_and_stop_wins(self):
        for text in (
            "Não", "não.", "Nao obrigado", "Não quero", "Não tenho interesse", "Pare de me mandar mensagem", "Me tira dessa lista",
            "Não me chame mais", "isso é spam", "vou denunciar", "Quero sair", "Remover meu número", "Não quero, mas quanto custa?",
        ):
            self.assertEqual(v.classify_reply(text), "nao_quer", text)

    def test_where_did_you_get_my_number(self):
        for text in ("Onde você conseguiu meu número?", "Como vocês conseguiram meu contato?", "Quem passou meu whatsapp pra você?", "De onde tirou meu telefone"):
            self.assertEqual(v.classify_reply(text), "quer_saber_origem", text)

    def test_later(self):
        for text in ("Agora não, estou ocupado", "me chama mais tarde", "semana que vem a gente conversa", "Depois eu vejo"):
            self.assertEqual(v.classify_reply(text), "adiar", text)

    def test_interest(self):
        for text in ("Sim", "Tenho interesse", "quero ver", "Pode ligar", "Me mostra como funciona", "Ok", "Bora testar"):
            self.assertEqual(v.classify_reply(text), "interessado", text)

    def test_questions(self):
        for text in ("Quanto custa?", "Qual o valor da mensalidade", "Como funciona isso?", "Quem é você?"):
            self.assertEqual(v.classify_reply(text), "duvida", text)

    def test_unclear_gives_nothing(self):
        for text in ("", None, "   ", "kkk", "👍"):
            self.assertIsNone(v.classify_reply(text), repr(text))


def good(**over):
    data = dict(business_name="  Pastelaria   do Zé ", business_kind="pastelaria", city="Natal", phone="(84) 99999-8888", source="anuncio_publico", source_note="Anúncio no Instagram")
    data.update(over)
    return data


class CleanProspectTests(unittest.TestCase):
    def test_a_good_record_is_cleaned(self):
        clean = v.clean_prospect(good(email=" Zé@Pastel.com.br ", instagram="@pasteldoze", site="pasteldoze.com.br"))
        self.assertEqual(clean["business_name"], "Pastelaria do Zé")
        self.assertEqual(clean["phone"], "5584999998888")
        self.assertEqual(clean["phone_hash"], v.phone_hash("5584999998888"))
        self.assertEqual(clean["instagram"], "pasteldoze")
        self.assertEqual(clean["site"], "https://pasteldoze.com.br")
        self.assertEqual(clean["email_hash"], outreach.email_hash(clean["email"]))

    def test_the_origin_is_required(self):
        with self.assertRaises(v.ProspectError) as caught:
            v.clean_prospect(good(source=None))
        self.assertIn("de onde veio", caught.exception.message)
        with self.assertRaises(v.ProspectError):
            v.clean_prospect(good(source="comprei_uma_lista"))
        with self.assertRaises(v.ProspectError):
            v.clean_prospect(good(source_note=" "))
        with self.assertRaises(v.ProspectError):
            v.clean_prospect(good(source_note="ab"))

    def test_a_contact_is_required_unless_it_is_a_visit(self):
        with self.assertRaises(v.ProspectError):
            v.clean_prospect(good(phone=None))
        visit = v.clean_prospect(good(phone=None, source="visita", source_note="Passei em frente e conversei com o dono"))
        self.assertIsNone(visit["phone"])

    def test_bad_values_are_refused_in_plain_words(self):
        for field, value in (("phone", "123"), ("email", "sem-arroba"), ("instagram", "nome com espaco"), ("business_kind", "cassino"), ("business_name", "a"), ("city", ""), ("neighborhood", "x")):
            with self.assertRaises(v.ProspectError, msg=field) as caught:
                v.clean_prospect(good(**{field: value}))
            self.assertTrue(caught.exception.message.endswith("."), field)
        with self.assertRaises(v.ProspectError):
            v.clean_prospect("não é um dicionário")

    def test_unknown_fields_are_dropped(self):
        clean = v.clean_prospect(good(stage="pagando", touches=9, company_id="x"))
        self.assertNotIn("stage", clean)
        self.assertNotIn("touches", clean)
        self.assertNotIn("company_id", clean)

    def test_default_kind(self):
        self.assertEqual(v.clean_prospect(good(business_kind=None))["business_kind"], "outro")


class ChannelTests(unittest.TestCase):
    def test_order_prefers_whatsapp_then_email(self):
        self.assertEqual(v.channels_of(prospect(email="a@b.com", instagram="x")), ["whatsapp", "email", "ligacao", "instagram"])

    def test_a_landline_cannot_receive_whatsapp(self):
        self.assertEqual(v.channels_of(prospect(phone="558432221234")), ["ligacao"])

    def test_only_what_exists(self):
        self.assertEqual(v.channels_of(prospect(phone=None, email=None)), [])
        self.assertEqual(v.channels_of(prospect(phone=None, email="a@b.com")), ["email"])


class CanTouchTests(unittest.TestCase):
    def test_the_first_contact_is_allowed(self):
        self.assertTrue(v.can_touch(prospect(), "whatsapp", NOW))

    def test_blocked_list_and_closed_businesses(self):
        self.assertEqual(v.can_touch(prospect(), "whatsapp", NOW, suppressed=True).reason, "na_lista_de_bloqueio")
        for stage in ("nao_quer", "pagando", "sem_resposta", "perdido"):
            self.assertEqual(v.can_touch(prospect(stage=stage), "whatsapp", NOW).reason, "negocio_encerrado", stage)

    def test_the_channel_has_to_exist_on_the_record(self):
        self.assertEqual(v.can_touch(prospect(), "email", NOW).reason, "sem_esse_canal")
        self.assertEqual(v.can_touch(prospect(phone="558432221234"), "whatsapp", NOW).reason, "sem_esse_canal")
        self.assertEqual(v.can_touch(prospect(), "carta", NOW).reason, "canal_desconhecido")
        self.assertTrue(v.can_touch(prospect(phone=None, email=None), "presencial", NOW))

    def test_waits_between_contacts(self):
        chamado = dict(stage="chamado", touches=1, whatsapp_touches=1, last_channel="whatsapp")
        self.assertEqual(v.can_touch(prospect(last_touch_at=NOW - 3 * DAY, **chamado), "whatsapp", NOW).reason, "cedo_demais_para_o_proximo")
        self.assertEqual(v.can_touch(prospect(last_touch_at=NOW - 6 * DAY, **chamado), "whatsapp", NOW).reason, "cedo_demais_para_o_proximo")
        self.assertTrue(v.can_touch(prospect(last_touch_at=NOW - 7 * DAY, **chamado), "whatsapp", NOW))

    def test_email_waits_five_days(self):
        chamado = dict(stage="chamado", touches=1, last_channel="email", email="a@b.com", phone=None)
        self.assertEqual(v.can_touch(prospect(last_touch_at=NOW - 4 * DAY, **chamado), "email", NOW).reason, "cedo_demais_para_o_proximo")
        self.assertTrue(v.can_touch(prospect(last_touch_at=NOW - 5 * DAY, **chamado), "email", NOW))

    def test_at_most_three_contacts_and_two_whatsapps(self):
        old = NOW - 30 * DAY
        self.assertEqual(
            v.can_touch(prospect(stage="chamado", touches=3, whatsapp_touches=1, last_touch_at=old, last_channel="email", email="a@b.com"), "email", NOW).reason,
            "limite_de_contatos",
        )
        self.assertEqual(
            v.can_touch(prospect(stage="chamado", touches=2, whatsapp_touches=2, last_touch_at=old, last_channel="whatsapp"), "whatsapp", NOW).reason,
            "limite_de_whatsapp",
        )
        self.assertTrue(v.can_touch(prospect(stage="chamado", touches=2, whatsapp_touches=2, last_touch_at=old, last_channel="whatsapp", email="a@b.com"), "email", NOW))

    def test_someone_who_answered_can_be_answered_at_any_time(self):
        talking = prospect(stage="respondeu", touches=3, whatsapp_touches=2, last_touch_at=NOW - timedelta(minutes=5), last_channel="whatsapp")
        self.assertTrue(v.can_touch(talking, "whatsapp", NOW))


class NextMoveTests(unittest.TestCase):
    def test_a_new_record_gets_the_first_contact_on_the_best_channel(self):
        move = v.next_move(prospect(email="a@b.com"), NOW)
        self.assertEqual((move.action, move.channel), ("primeiro_contato", "whatsapp"))
        self.assertTrue(move.ready)

    def test_without_a_channel_the_system_asks_to_find_one(self):
        move = v.next_move(prospect(phone=None, source="visita"), NOW)
        self.assertEqual(move.action, "achar_contato")

    def test_closed_or_blocked_records_stop(self):
        for stage in ("nao_quer", "pagando", "sem_resposta", "perdido"):
            self.assertEqual(v.next_move(prospect(stage=stage), NOW).action, "parar", stage)
        self.assertEqual(v.next_move(prospect(), NOW, suppressed=True).action, "parar")
        self.assertFalse(v.next_move(prospect(), NOW, suppressed=True).ready)

    def test_after_the_first_message_it_waits_then_reminds_once(self):
        chamado = dict(stage="chamado", touches=1, whatsapp_touches=1, last_channel="whatsapp")
        waiting = v.next_move(prospect(last_touch_at=NOW - 3 * DAY, **chamado), NOW)
        self.assertEqual(waiting.action, "esperar")
        self.assertEqual(waiting.due, NOW - 3 * DAY + 7 * DAY)
        reminder = v.next_move(prospect(last_touch_at=NOW - 8 * DAY, **chamado), NOW)
        self.assertEqual((reminder.action, reminder.channel), ("lembrete", "whatsapp"))

    def test_after_two_whatsapps_it_tries_another_channel_for_the_last_contact(self):
        base = dict(stage="chamado", touches=2, whatsapp_touches=2, last_touch_at=NOW - 8 * DAY, last_channel="whatsapp")
        other = v.next_move(prospect(email="a@b.com", **base), NOW)
        self.assertEqual((other.action, other.channel), ("lembrete", "email"))
        call = v.next_move(prospect(**base), NOW)
        self.assertEqual((call.action, call.channel), ("lembrete", "ligacao"))

    def test_after_three_contacts_it_closes(self):
        move = v.next_move(prospect(stage="chamado", touches=3, whatsapp_touches=2, email="a@b.com", last_touch_at=NOW - 8 * DAY, last_channel="email"), NOW)
        self.assertEqual(move.action, "encerrar")
        self.assertIn("3 contatos", move.reason)

    def test_a_reply_comes_first_and_the_origin_question_comes_before_that(self):
        replied = dict(stage="respondeu", replied_at=NOW - timedelta(hours=2), last_channel="whatsapp", touches=1, last_touch_at=NOW - 3 * DAY)
        answer = v.next_move(prospect(reply_kind="interessado", **replied), NOW)
        self.assertEqual((answer.action, answer.priority), ("responder", 100))
        origin = v.next_move(prospect(reply_kind="quer_saber_origem", **replied), NOW)
        self.assertEqual(origin.action, "responder_origem")
        self.assertGreater(origin.priority, answer.priority)
        self.assertIn("privacidade", origin.tags)

    def test_after_answering_it_waits_three_days_and_then_invites_to_the_demo(self):
        base = dict(stage="respondeu", reply_kind="interessado", replied_at=NOW - 5 * DAY, last_channel="whatsapp", touches=2)
        self.assertEqual(v.next_move(prospect(last_touch_at=NOW - DAY, **base), NOW).action, "esperar")
        self.assertEqual(v.next_move(prospect(last_touch_at=NOW - 4 * DAY, **base), NOW).action, "convidar_para_demonstracao")

    def test_an_origin_question_is_not_followed_by_a_sales_invite(self):
        base = dict(stage="respondeu", reply_kind="quer_saber_origem", replied_at=NOW - 9 * DAY, last_channel="whatsapp", touches=2)
        self.assertEqual(v.next_move(prospect(last_touch_at=NOW - 8 * DAY, **base), NOW).action, "encerrar")
        self.assertEqual(v.next_move(prospect(last_touch_at=NOW - 2 * DAY, **base), NOW).action, "esperar")

    def test_after_the_demo_it_asks_if_the_person_got_stuck(self):
        stuck = v.next_move(prospect(stage="demonstracao", stage_since=NOW - 4 * DAY, last_channel="whatsapp"), NOW)
        self.assertEqual(stuck.action, "perguntar_se_travou")
        recent = v.next_move(prospect(stage="demonstracao", stage_since=NOW - DAY), NOW)
        self.assertEqual(recent.action, "esperar")

    def test_after_signing_up_it_offers_help_with_the_menu(self):
        self.assertEqual(v.next_move(prospect(stage="cadastrou", stage_since=NOW - 3 * DAY), NOW).action, "ajudar_a_comecar")
        self.assertEqual(v.next_move(prospect(stage="cadastrou", stage_since=NOW - timedelta(hours=5)), NOW).action, "esperar")

    def test_snooze_hides_the_record_until_the_date(self):
        until = NOW + 5 * DAY
        move = v.next_move(prospect(snooze_until=until), NOW)
        self.assertEqual((move.action, move.due), ("esperar", until))
        self.assertEqual(v.next_move(prospect(snooze_until=NOW - DAY), NOW).action, "primeiro_contato")


class TimeTests(unittest.TestCase):
    def test_the_rest_window_of_each_kind(self):
        self.assertTrue(v.good_time("pastelaria", NOW))  # terça, 14h30
        self.assertFalse(v.good_time("sorveteria", NOW))  # sorveteria: de manhã
        at_10 = datetime(2026, 10, 20, 13, 0, tzinfo=timezone.utc)
        self.assertTrue(v.good_time("sorveteria", at_10))
        self.assertTrue(v.good_time("bar", at_10))
        self.assertFalse(v.good_time("pastelaria", at_10))

    def test_never_on_sunday(self):
        for kind in v.KINDS:
            self.assertFalse(v.good_time(kind, SUNDAY), kind)

    def test_every_kind_has_a_window_and_a_label(self):
        for kind in v.KINDS:
            start, end = v.WINDOWS[kind]
            self.assertTrue(8 <= start < end <= 18, kind)
            self.assertIn(kind, v.KIND_LABELS)
        self.assertEqual(v.window_label("pastelaria"), "14h às 16h")

    def test_the_hour_is_read_in_brasilia_not_utc(self):
        # 17h30 UTC é 14h30 em Brasília; 14h30 UTC seria 11h30, hora de almoço lotado
        lunch = datetime(2026, 10, 20, 14, 30, tzinfo=timezone.utc)
        self.assertFalse(v.good_time("restaurante", lunch))
        self.assertTrue(v.good_time("restaurante", NOW))


class TodayListTests(unittest.TestCase):
    def test_replies_come_first_then_follow_ups_then_new_ones(self):
        fresh = prospect(id="a-new", business_name="Novo")
        reminder = prospect(id="b-reminder", business_name="Lembrete", stage="chamado", touches=1, whatsapp_touches=1, last_touch_at=NOW - 8 * DAY, last_channel="whatsapp")
        answer = prospect(id="c-answer", business_name="Respondeu", stage="respondeu", reply_kind="interessado", replied_at=NOW - timedelta(hours=1), last_channel="whatsapp")
        origin = prospect(id="d-origin", business_name="Origem", stage="respondeu", reply_kind="quer_saber_origem", replied_at=NOW - timedelta(hours=1), last_channel="whatsapp")
        today = v.today_list([fresh, reminder, answer, origin], NOW)
        self.assertEqual([item["business_name"] for item in today["items"]], ["Origem", "Respondeu", "Novo", "Lembrete"])
        actions = [item["move"]["action"] for item in today["items"]]
        self.assertEqual(actions, ["responder_origem", "responder", "primeiro_contato", "lembrete"])

    def test_waiting_and_closed_records_do_not_appear(self):
        waiting = prospect(id="w", stage="chamado", touches=1, whatsapp_touches=1, last_touch_at=NOW - DAY, last_channel="whatsapp")
        closed = prospect(id="c", stage="nao_quer")
        blocked = prospect(id="b", suppressed=True)
        self.assertEqual(v.today_list([waiting, closed, blocked], NOW)["items"], [])

    def test_at_most_ten_and_the_rest_is_counted(self):
        many = [prospect(id=f"{n:02d}") for n in range(14)]
        today = v.today_list(many, NOW)
        self.assertEqual(len(today["items"]), v.TODAY_LIMIT)
        self.assertEqual(today["more"], 4)

    def test_sunday_keeps_only_the_people_who_wrote_back(self):
        answer = prospect(id="a", stage="respondeu", reply_kind="duvida", replied_at=SUNDAY - timedelta(hours=1), last_channel="whatsapp")
        today = v.today_list([prospect(id="n"), answer], SUNDAY)
        self.assertEqual([item["id"] for item in today["items"]], ["a"])
        self.assertTrue(any("domingo" in note for note in today["notes"]))

    def test_after_fifteen_messages_the_system_says_enough(self):
        today = v.today_list([prospect()], NOW, touches_today=15)
        self.assertTrue(any("Por hoje chega" in note for note in today["notes"]))
        self.assertFalse(v.today_list([prospect()], NOW, touches_today=14)["notes"])

    def test_the_view_has_plain_labels_and_the_best_time(self):
        item = v.today_list([prospect(email="a@b.com", neighborhood="Ponta Negra")], NOW)["items"][0]
        self.assertEqual(item["kind_label"], "Pastelaria")
        self.assertEqual(item["stage_label"], "Achado")
        self.assertEqual(item["source_label"], "Anúncio público")
        self.assertEqual(item["phone"], "(84) 99999-8888")
        self.assertEqual(item["whatsapp"], "5584999998888")
        self.assertEqual(item["window"], "14h às 16h")
        self.assertTrue(item["good_time"])
        self.assertEqual(item["channels"], ["whatsapp", "email", "ligacao"])


class FunnelTests(unittest.TestCase):
    def rows(self):
        return [
            prospect(id="1", source="anuncio_publico", stage="achado"),
            prospect(id="2", source="anuncio_publico", stage="chamado", touches=1),
            prospect(id="3", source="anuncio_publico", stage="respondeu", touches=1, replied_at=NOW),
            prospect(id="4", source="indicacao", stage="pagando", touches=1, replied_at=NOW),
            prospect(id="5", source="indicacao", stage="cadastrou", touches=1, replied_at=NOW),
            prospect(id="6", source="visita", stage="nao_quer", touches=1),
        ]

    def test_counts_by_stage_in_the_natural_order(self):
        result = v.funnel(self.rows())
        self.assertEqual(result["total"], 6)
        self.assertEqual([row["stage"] for row in result["by_stage"]], list(v.STAGES))
        counts = {row["stage"]: row["count"] for row in result["by_stage"]}
        self.assertEqual((counts["achado"], counts["chamado"], counts["pagando"], counts["nao_quer"]), (1, 1, 1, 1))
        self.assertEqual(result["paying"], 1)

    def test_the_source_that_pays_comes_first(self):
        by_source = v.funnel(self.rows())["by_source"]
        self.assertEqual([row["source"] for row in by_source], ["indicacao", "anuncio_publico", "visita"])
        indicacao = by_source[0]
        self.assertEqual((indicacao["total"], indicacao["chamados"], indicacao["responderam"], indicacao["cadastraram"], indicacao["pagando"]), (2, 2, 2, 2, 1))
        self.assertEqual((indicacao["taxa_resposta"], indicacao["taxa_cadastro"], indicacao["taxa_pagamento"]), (1.0, 1.0, 0.5))

    def test_no_division_by_zero(self):
        self.assertEqual(v.funnel([])["total"], 0)
        only_new = v.funnel([prospect()])["by_source"][0]
        self.assertEqual((only_new["taxa_resposta"], only_new["taxa_cadastro"], only_new["taxa_pagamento"]), (0.0, 0.0, 0.0))


class CanMoveTests(unittest.TestCase):
    def test_forward_only(self):
        self.assertTrue(v.can_move("achado", "chamado"))
        self.assertTrue(v.can_move("respondeu", "demonstracao"))
        self.assertTrue(v.can_move("demonstracao", "pagando"))
        self.assertFalse(v.can_move("demonstracao", "chamado"))
        self.assertFalse(v.can_move("pagando", "cadastrou"))

    def test_saying_no_is_forever(self):
        for stage in v.STAGES:
            if stage != "nao_quer":
                self.assertFalse(v.can_move("nao_quer", stage), stage)
        self.assertTrue(v.can_move("nao_quer", "nao_quer"))
        for stage in ("achado", "chamado", "respondeu", "demonstracao", "cadastrou", "pagando"):
            self.assertTrue(v.can_move(stage, "nao_quer"), stage)

    def test_a_silent_business_can_come_back_if_it_writes(self):
        self.assertTrue(v.can_move("sem_resposta", "respondeu"))
        self.assertTrue(v.can_move("perdido", "demonstracao"))
        self.assertFalse(v.can_move("sem_resposta", "chamado"))
        self.assertFalse(v.can_move("sem_resposta", "achado"))

    def test_closing_a_business_is_always_possible(self):
        for stage in ("achado", "chamado", "respondeu", "demonstracao", "cadastrou"):
            self.assertTrue(v.can_move(stage, "sem_resposta"), stage)
            self.assertTrue(v.can_move(stage, "perdido"), stage)

    def test_unknown_stages(self):
        self.assertFalse(v.can_move("x", "achado"))
        self.assertFalse(v.can_move("achado", "x"))


class FakeCursor:
    """Responde por comando SQL (pelo texto inteiro) e guarda o que foi pedido, na ordem."""

    def __init__(self, answers=None):
        self.answers = answers or {}
        self.calls = []
        self._row = None
        self._rows = []
        self.rowcount = 0

    def execute(self, sql, args=()):
        self.calls.append((sql, args))
        self._row, self._rows = None, []
        if sql in self.answers:
            answer = self.answers[sql]
            answer = answer(args) if callable(answer) else answer
            if isinstance(answer, list):
                self._rows, self._row = answer, (answer[0] if answer else None)
            else:
                self._row = answer
        self.rowcount = 3 if sql == v.SQL_PURGE else 1

    def fetchone(self):
        return self._row

    def fetchall(self):
        return self._rows

    def ran(self, sql):
        return [args for text, args in self.calls if text == sql]

    def events(self):
        return [args[1] for text, args in self.calls if text == v.SQL_EVENT]


def stored(**over):
    data = dict(phone_hash=v.phone_hash("5584999998888"), email_hash=None)
    data.update(over)
    row = prospect(**data)
    row.pop("suppressed", None)
    return row


class AddProspectTests(unittest.TestCase):
    def test_a_new_record_is_saved_with_its_history(self):
        cur = FakeCursor({v.SQL_INSERT: {"id": "new-id"}})
        result = v.add_prospect(cur, good(), "gd")
        self.assertEqual(result, {"id": "new-id", "created": True, "reason": None})
        saved = cur.ran(v.SQL_INSERT)[0]
        self.assertEqual(saved[0], "Pastelaria do Zé")
        self.assertEqual(saved[-1], "gd")
        self.assertEqual(cur.events(), ["criado"])

    def test_someone_on_the_blocked_list_does_not_come_back_by_another_door(self):
        cur = FakeCursor({v.SQL_PHONE_SUPPRESSED: {"found": 1}})
        result = v.add_prospect(cur, good(phone="+55 (84) 99999 8888"), "gd")
        self.assertEqual((result["id"], result["created"], result["reason"]), (None, False, "na_lista_de_bloqueio"))
        self.assertEqual(cur.ran(v.SQL_INSERT), [])

    def test_an_email_on_the_blocked_list_also_blocks(self):
        cur = FakeCursor({v.SQL_EMAIL_SUPPRESSED: {"found": 1}})
        result = v.add_prospect(cur, good(phone=None, email="dono@pastel.com.br"), "gd")
        self.assertEqual(result["reason"], "na_lista_de_bloqueio")

    def test_the_same_phone_or_email_returns_the_existing_record(self):
        cur = FakeCursor({v.SQL_DUPLICATE: {"id": "old-id", "business_name": "Pastelaria do Zé", "stage": "chamado"}})
        result = v.add_prospect(cur, good(), "gd")
        self.assertEqual((result["id"], result["created"], result["reason"]), ("old-id", False, "ja_existe"))
        self.assertEqual(cur.ran(v.SQL_INSERT), [])

    def test_bad_data_never_reaches_the_database(self):
        cur = FakeCursor()
        with self.assertRaises(v.ProspectError):
            v.add_prospect(cur, good(source=None), "gd")
        self.assertEqual(cur.calls, [])


class TouchAndReplyTests(unittest.TestCase):
    def test_a_touch_counts_and_is_recorded(self):
        cur = FakeCursor({v.SQL_ONE: stored()})
        v.record_touch(cur, "id1", "whatsapp", "gd", NOW)
        self.assertEqual(cur.ran(v.SQL_TOUCH), [(1, "whatsapp", "id1")])
        self.assertEqual(cur.events(), ["mensagem"])

    def test_an_email_touch_does_not_count_as_whatsapp(self):
        cur = FakeCursor({v.SQL_ONE: stored(email="a@b.com")})
        v.record_touch(cur, "id1", "email", "gd", NOW)
        self.assertEqual(cur.ran(v.SQL_TOUCH), [(0, "email", "id1")])

    def test_a_touch_that_breaks_a_rule_is_refused_in_plain_words(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="chamado", touches=2, whatsapp_touches=2, last_touch_at=NOW - 10 * DAY, last_channel="whatsapp")})
        with self.assertRaises(v.ProspectError) as caught:
            v.record_touch(cur, "id1", "whatsapp", "gd", NOW)
        self.assertEqual(caught.exception.status, 409)
        self.assertIn("2 mensagens de WhatsApp", caught.exception.message)
        self.assertEqual(cur.ran(v.SQL_TOUCH), [])

    def test_a_blocked_contact_cannot_be_touched(self):
        cur = FakeCursor({v.SQL_ONE: stored(), v.SQL_PHONE_SUPPRESSED: {"found": 1}})
        with self.assertRaises(v.ProspectError) as caught:
            v.record_touch(cur, "id1", "whatsapp", "gd", NOW)
        self.assertIn("pediu para não receber", caught.exception.message)

    def test_every_refusal_reason_has_a_message(self):
        reasons = {"canal_desconhecido", "na_lista_de_bloqueio", "negocio_encerrado", "sem_esse_canal", "limite_de_contatos", "limite_de_whatsapp", "cedo_demais_para_o_proximo"}
        self.assertEqual(set(v.TOUCH_REFUSALS), reasons)

    def test_a_missing_record_is_a_404(self):
        with self.assertRaises(v.ProspectError) as caught:
            v.record_touch(FakeCursor(), "nope", "whatsapp", "gd", NOW)
        self.assertEqual(caught.exception.status, 404)

    def test_no_blocks_the_phone_and_the_email_and_wipes_the_record(self):
        cur = FakeCursor({v.SQL_ONE: stored(email="dono@pastel.com.br", email_hash=outreach.email_hash("dono@pastel.com.br"))})
        v.record_no(cur, "id1", "gd")
        self.assertEqual(cur.ran(v.SQL_SUPPRESS_PHONE), [(v.phone_hash("5584999998888"), "pediu")])
        self.assertEqual(len(cur.ran(outreach.SQL_SUPPRESS)), 1)
        self.assertEqual(cur.ran(outreach.SQL_SUPPRESS)[0][0], outreach.email_hash("dono@pastel.com.br"))
        self.assertEqual(cur.ran(v.SQL_WIPE_CONTACT), [("id1",)])
        self.assertEqual(cur.events(), ["nao_quer"])

    def test_the_wipe_removes_everything_that_identifies_the_person(self):
        sql = " ".join(v.SQL_WIPE_CONTACT.split())
        for column in ("contact_person", "phone", "phone_hash", "email", "email_hash", "instagram", "site", "note"):
            self.assertIn(f"{column} = NULL", sql)
        self.assertIn("stage = 'nao_quer'", sql)
        self.assertNotIn("business_name", sql)

    def test_saying_no_twice_changes_nothing_the_second_time(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="nao_quer")})
        self.assertEqual(v.record_no(cur, "id1", "gd"), {"ok": True, "already": True})
        self.assertEqual(cur.ran(v.SQL_WIPE_CONTACT), [])

    def test_a_reply_text_that_says_no_stops_everything(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="chamado", touches=1)})
        result = v.record_reply(cur, "id1", "gd", text="Não quero, obrigado")
        self.assertEqual((result["result"], result["stage"]), ("nao_quer", "nao_quer"))
        self.assertEqual(len(cur.ran(v.SQL_WIPE_CONTACT)), 1)

    def test_an_interested_reply_moves_to_answered_and_keeps_only_the_class(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="chamado", touches=1)})
        result = v.record_reply(cur, "id1", "gd", result="interessado")
        self.assertEqual((result["result"], result["stage"]), ("interessado", "respondeu"))
        self.assertEqual(cur.ran(v.SQL_REPLY), [("interessado", "id1")])
        self.assertEqual([args[3] for text, args in cur.calls if text == v.SQL_EVENT], ["interessado"])

    def test_later_snoozes_for_two_weeks_and_does_not_change_the_stage(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="chamado", touches=1)})
        result = v.record_reply(cur, "id1", "gd", text="Agora não, me chama mais tarde")
        self.assertEqual((result["result"], result["stage"]), ("adiar", "chamado"))
        self.assertEqual(cur.ran(v.SQL_SNOOZE), [(14, "id1")])

    def test_an_unclear_reply_asks_the_person_to_choose(self):
        cur = FakeCursor({v.SQL_ONE: stored()})
        with self.assertRaises(v.ProspectError) as caught:
            v.record_reply(cur, "id1", "gd", text="kkk")
        self.assertIn("Escolha", caught.exception.message)
        with self.assertRaises(v.ProspectError):
            v.record_reply(cur, "id1", "gd", result="talvez")

    def test_nobody_who_said_no_gets_a_new_conversation(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="nao_quer")})
        with self.assertRaises(v.ProspectError) as caught:
            v.record_reply(cur, "id1", "gd", result="interessado")
        self.assertEqual(caught.exception.status, 409)


def form(**over):
    data = dict(business_name="Sorveteria Gelo Bom", business_kind="sorveteria", city="Natal", phone="(84) 98888-7777", consent=True)
    data.update(over)
    return data


class InterestFormTests(unittest.TestCase):
    def test_the_box_has_to_be_ticked_by_the_person(self):
        for value in (None, False, "true", "sim", 1, "on"):
            with self.assertRaises(v.ProspectError, msg=repr(value)) as caught:
                v.clean_interest(form(consent=value))
            self.assertIn("marque a caixa", caught.exception.message)

    def test_a_way_to_answer_is_required(self):
        with self.assertRaises(v.ProspectError) as caught:
            v.clean_interest(form(phone=None, email=None))
        self.assertIn("WhatsApp ou um e-mail", caught.exception.message)

    def test_only_the_form_fields_count_and_the_origin_is_always_the_form(self):
        clean = v.clean_interest(form(source="visita", stage="pagando", instagram="x", note="n", site="s.com", source_note="outro"))
        self.assertEqual(clean["source"], "formulario_do_site")
        self.assertEqual(clean["source_note"], v.INTEREST_SOURCE_NOTE)
        self.assertIsNone(clean["instagram"])
        self.assertIsNone(clean["site"])
        self.assertIsNone(clean["note"])
        self.assertNotIn("stage", clean)

    def test_bad_data_is_refused_in_plain_words(self):
        for change in ({"business_name": ""}, {"city": ""}, {"phone": "12"}, {"business_kind": "cassino"}):
            with self.assertRaises(v.ProspectError, msg=str(change)):
                v.clean_interest(form(**change))
        with self.assertRaises(v.ProspectError):
            v.clean_interest("texto solto")

    def test_the_closed_form_is_closed_by_default(self):
        import os
        from unittest.mock import patch

        with patch.dict(os.environ, {"INTEREST_OPEN": ""}):
            self.assertFalse(v.interest_open())
        for value in ("1", "true", "SIM", "yes"):
            with patch.dict(os.environ, {"INTEREST_OPEN": value}):
                self.assertTrue(v.interest_open(), value)
        with patch.dict(os.environ, {"INTEREST_OPEN": "talvez"}):
            self.assertFalse(v.interest_open())

    def test_the_consent_text_is_short_specific_and_names_who_will_call(self):
        text = v.INTEREST_CONSENT_TEXT
        self.assertIn("Vem Tecnologia", text)
        self.assertIn("WhatsApp", text)
        self.assertIn("parar", text)
        self.assertLess(len(text), 300)

    def test_the_thank_you_does_not_promise_a_time(self):
        for word in ("hoje", "agora", "minutos", "horas", "24", "imediat"):
            self.assertNotIn(word, v.INTEREST_THANKS.lower())


class AddInboundTests(unittest.TestCase):
    def test_a_new_request_enters_as_answered_and_leaves_proof_of_the_consent(self):
        cur = FakeCursor({v.SQL_INSERT: {"id": "new-id"}})
        result = v.add_inbound(cur, form(), ip="10.1.2.3", secret="segredo")
        self.assertEqual(result, {"id": "new-id", "created": True, "reason": None})
        self.assertEqual(cur.ran(v.SQL_REPLY), [("interessado", "new-id")])
        self.assertEqual(cur.events(), ["criado", "resposta"])
        proof = cur.ran(consent.SQL_RECORD)[0]
        self.assertEqual(proof[0], v.phone_hash("(84) 98888-7777"))  # sem e-mail, vale a impressão digital do telefone
        self.assertEqual(proof[1:4], ("contato", "contato_comercial", True))
        self.assertEqual(proof[4], v.INTEREST_TEXT_VERSION)
        self.assertEqual(proof[5], consent.text_sha256(v.INTEREST_CONSENT_TEXT))
        self.assertEqual(proof[6], "site")
        self.assertNotIn("10.1.2.3", str(proof))

    def test_with_an_email_the_proof_uses_the_email_fingerprint(self):
        cur = FakeCursor({v.SQL_INSERT: {"id": "new-id"}})
        v.add_inbound(cur, form(email="Dono@Gelo.com.br"), secret="s")
        self.assertEqual(cur.ran(consent.SQL_RECORD)[0][0], outreach.email_hash("dono@gelo.com.br"))

    def test_someone_who_asked_to_stop_is_not_added_and_no_proof_is_written(self):
        cur = FakeCursor({v.SQL_PHONE_SUPPRESSED: {"found": 1}})
        result = v.add_inbound(cur, form())
        self.assertEqual((result["created"], result["reason"]), (False, "na_lista_de_bloqueio"))
        self.assertEqual(cur.ran(v.SQL_INSERT), [])
        self.assertEqual(cur.ran(consent.SQL_RECORD), [])

    def test_an_existing_business_is_reopened_as_answered(self):
        cur = FakeCursor({v.SQL_DUPLICATE: {"id": "old-id", "business_name": "Sorveteria Gelo Bom", "stage": "sem_resposta"}})
        result = v.add_inbound(cur, form())
        self.assertEqual((result["id"], result["created"], result["reason"]), ("old-id", False, "ja_existe"))
        self.assertEqual(cur.ran(v.SQL_INSERT), [])
        self.assertEqual(cur.ran(v.SQL_REPLY), [("interessado", "old-id")])
        self.assertEqual(len(cur.ran(consent.SQL_RECORD)), 1)

    def test_without_the_box_nothing_reaches_the_database(self):
        cur = FakeCursor()
        with self.assertRaises(v.ProspectError):
            v.add_inbound(cur, form(consent=False))
        self.assertEqual(cur.calls, [])

    def test_a_form_request_comes_first_in_the_list_of_the_day(self):
        answered = prospect(id="f", stage="respondeu", source="formulario_do_site", reply_kind="interessado", replied_at=NOW - timedelta(minutes=3), touches=0)
        today = v.today_list([prospect(id="n"), answered], NOW)
        self.assertEqual([item["id"] for item in today["items"]], ["f", "n"])
        self.assertEqual(today["items"][0]["move"]["action"], "responder")


class StageAndForgetTests(unittest.TestCase):
    def test_moving_forward(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="respondeu")})
        self.assertEqual(v.set_stage(cur, "id1", "demonstracao", "gd"), {"ok": True, "stage": "demonstracao", "already": False})
        self.assertEqual(cur.ran(v.SQL_SET_STAGE), [("demonstracao", "id1")])

    def test_the_same_stage_is_not_an_error(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="respondeu")})
        self.assertTrue(v.set_stage(cur, "id1", "respondeu", "gd")["already"])
        self.assertEqual(cur.ran(v.SQL_SET_STAGE), [])

    def test_backwards_is_refused(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="cadastrou")})
        with self.assertRaises(v.ProspectError) as caught:
            v.set_stage(cur, "id1", "chamado", "gd")
        self.assertEqual(caught.exception.status, 409)

    def test_no_through_the_stage_button_is_the_same_as_no(self):
        cur = FakeCursor({v.SQL_ONE: stored(stage="chamado")})
        result = v.set_stage(cur, "id1", "nao_quer", "gd")
        self.assertEqual(result["stage"], "nao_quer")
        self.assertEqual(len(cur.ran(v.SQL_WIPE_CONTACT)), 1)

    def test_unknown_stage(self):
        with self.assertRaises(v.ProspectError):
            v.set_stage(FakeCursor({v.SQL_ONE: stored()}), "id1", "voando", "gd")

    def test_forgetting_deletes_the_record_and_keeps_only_fingerprints(self):
        cur = FakeCursor({v.SQL_ONE: stored(email="dono@pastel.com.br", email_hash=outreach.email_hash("dono@pastel.com.br"))})
        v.forget_prospect(cur, "id1")
        self.assertEqual(cur.ran(v.SQL_SUPPRESS_PHONE), [(v.phone_hash("5584999998888"), "titular")])
        self.assertEqual(cur.ran(v.SQL_DELETE), [("id1",)])
        order = [sql for sql, _ in cur.calls]
        self.assertLess(order.index(v.SQL_SUPPRESS_PHONE), order.index(v.SQL_DELETE))

    def test_purge_old_removes_closed_records_after_24_months(self):
        cur = FakeCursor()
        self.assertEqual(v.purge_old(cur), 3)
        self.assertEqual(cur.ran(v.SQL_PURGE), [(24,)])
        self.assertIn("'sem_resposta', 'perdido', 'nao_quer'", " ".join(v.SQL_PURGE.split()))
        self.assertNotIn("pagando", v.SQL_PURGE)


class OverviewTests(unittest.TestCase):
    def test_the_overview_joins_today_and_the_funnel(self):
        rows = [prospect(id="1"), prospect(id="2", stage="pagando", touches=1)]
        cur = FakeCursor({v.SQL_LIST: rows, v.SQL_TOUCHES_TODAY: {"n": 4}})
        result = v.overview(cur, NOW)
        self.assertEqual([item["id"] for item in result["today"]["items"]], ["1"])
        self.assertEqual(result["today"]["touches_today"], 4)
        self.assertEqual(result["funnel"]["paying"], 1)

    def test_the_view_tells_what_kind_of_answer_came_so_the_draft_fits_it(self):
        answered = prospect(id="1", stage="respondeu", touches=1, replied_at=NOW, reply_kind="duvida", last_touch_at=NOW - timedelta(days=1))
        self.assertEqual(v.view_of(answered, NOW)["reply_kind"], "duvida")
        self.assertIsNone(v.view_of(prospect(id="2"), NOW)["reply_kind"])

    def test_the_list_marks_who_is_on_the_blocked_list(self):
        sql = " ".join(v.SQL_LIST.split())
        self.assertIn("phone_suppression", sql)
        self.assertIn("email_suppression", sql)


class MigrationTests(unittest.TestCase):
    """O banco e o código têm de falar das mesmas coisas: etapas, tipos, origens e canais."""

    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8")

    def values_of(self, column):
        match = re.search(rf"{column}[^\n]*?IN \(([^)]*)\)", self.sql, re.DOTALL)
        self.assertIsNotNone(match, column)
        return tuple(re.findall(r"'([a-z_]+)'", match.group(1)))

    def test_stages(self):
        self.assertEqual(set(self.values_of("stage text NOT NULL DEFAULT 'achado' CHECK \\(stage")), set(v.STAGES))

    def test_kinds_sources_and_channels(self):
        self.assertEqual(set(self.values_of("business_kind text NOT NULL CHECK \\(business_kind")), set(v.KINDS))
        self.assertEqual(set(self.values_of("source text NOT NULL CHECK \\(source")), set(v.SOURCES))
        self.assertEqual(set(self.values_of("last_channel text CHECK \\(last_channel IS NULL OR last_channel")), set(v.CHANNELS))
        self.assertEqual(set(self.values_of("channel text CHECK \\(channel IS NULL OR channel")), set(v.CHANNELS))

    def test_reply_kinds(self):
        self.assertEqual(set(self.values_of("reply_kind text CHECK \\(reply_kind IS NULL OR reply_kind")), set(v.REPLY_KINDS) - {"nao_quer"})

    def test_sources_include_every_origin_of_the_email_gate(self):
        for source in outreach.SOURCES:
            self.assertIn(source, v.SOURCES)

    def test_the_phone_pattern_accepts_what_the_code_produces(self):
        pattern = re.search(r"phone ~ '([^']+)'", self.sql).group(1)
        for phone in ("5584999998888", "558432221234", "5555999998888"):
            self.assertTrue(re.match(pattern, phone), phone)
        for bad in ("84999998888", "5504999998888", "55849999988"):
            self.assertFalse(re.match(pattern, bad), bad)

    def test_the_tables_that_must_exist(self):
        for table in ("phone_suppression", "sales_prospects", "sales_events"):
            self.assertIn(f"CREATE TABLE IF NOT EXISTS {table}", self.sql)

    def test_the_same_phone_or_email_cannot_enter_twice(self):
        self.assertIn("CREATE UNIQUE INDEX IF NOT EXISTS sales_prospects_phone", self.sql)
        self.assertIn("CREATE UNIQUE INDEX IF NOT EXISTS sales_prospects_email", self.sql)

    def test_the_history_never_keeps_what_the_person_wrote(self):
        events = self.sql.split("CREATE TABLE IF NOT EXISTS sales_events")[1]
        self.assertNotIn("message", events.split(");")[0])
        self.assertIn("detail text CHECK (detail IS NULL OR length(detail) <= 60)", events)


if __name__ == "__main__":
    unittest.main()
