"""Horário de funcionamento: validação, "aberto agora" (inclusive virando a noite) e frases para o cliente."""
import unittest
from datetime import datetime, time, timezone
from unittest.mock import MagicMock

import hours

B = hours.BRAZIL


def at(day, hour, minute=0):
    """Um instante no relógio de Brasília. Dia 12/10/2026 é segunda-feira."""
    return datetime(2026, 10, 12 + day, hour, minute, tzinfo=B)


def week_payload(shifts_by_day, closed=()):
    return {
        "week": [
            {"weekday": d, "closed": d in closed, "shifts": [] if d in closed else shifts_by_day.get(d, shifts_by_day.get("all", []))}
            for d in range(7)
        ]
    }


def rows_for(week):
    """O que o banco devolveria para uma semana já validada."""
    out = []
    for day in week:
        first = day["shifts"][0] if day["shifts"] else None
        second = day["shifts"][1] if len(day["shifts"]) > 1 else None
        out.append(
            {
                "weekday": day["weekday"],
                "opens_at": hours.clock(first[0]) if first else None,
                "closes_at": hours.clock(first[1]) if first else None,
                "accepts_orders": not day["closed"],
                "opens_at_2": hours.clock(second[0]) if second else None,
                "closes_at_2": hours.clock(second[1]) if second else None,
            }
        )
    return out


LUNCH_DINNER = [{"opens": "11:00", "closes": "15:00"}, {"opens": "18:00", "closes": "23:00"}]


def standard_rows():
    """Segunda a sábado 11h-15h e 18h-23h; domingo fechado."""
    return rows_for(hours.normalize_week(week_payload({"all": LUNCH_DINNER}, closed=(6,))))


class ClockTests(unittest.TestCase):
    def test_reads_the_ways_people_write_a_time(self):
        for text, expected in (("18:30", 1110), ("18h", 1080), ("18h30", 1110), ("8:05", 485), ("00:00", 0), ("23:59", 1439),
                               ("08:05:00", 485), (" 11:00 ", 660), ("24:00", 0), ("24h", 0)):
            self.assertEqual(hours.to_minutes(text), expected, text)
        self.assertEqual(hours.to_minutes(time(18, 30)), 1110)

    def test_rejects_what_is_not_a_time(self):
        for bad in ("", "abc", "25:00", "12:60", "18", "18:5", "1800", None, 18, "-1:00"):
            self.assertIsNone(hours.to_minutes(bad), repr(bad))

    def test_writes_it_back_for_the_panel_and_for_the_customer(self):
        self.assertEqual(hours.clock(1110), "18:30")
        self.assertEqual(hours.clock(0), "00:00")
        self.assertEqual(hours.say(1110), "18h30")
        self.assertEqual(hours.say(1080), "18h")
        self.assertEqual(hours.say(0), "0h")

    def test_a_shift_that_closes_before_it_opens_runs_past_midnight(self):
        self.assertEqual(hours.duration(660, 900), 240)
        self.assertEqual(hours.duration(1080, 120), 480)  # 18h às 2h


class NormalizeTests(unittest.TestCase):
    def test_a_normal_week_is_accepted_and_sorted(self):
        week = hours.normalize_week(
            {"week": list(reversed(week_payload({"all": LUNCH_DINNER[::-1]}, closed=(6,))["week"]))}
        )
        self.assertEqual([day["weekday"] for day in week], list(range(7)))
        self.assertEqual(week[0]["shifts"], [(660, 900), (1080, 1380)])  # turnos em ordem
        self.assertTrue(week[6]["closed"])
        self.assertEqual(week[6]["shifts"], [])

    def test_a_closed_day_ignores_whatever_shifts_came_with_it(self):
        payload = week_payload({"all": LUNCH_DINNER})
        payload["week"][2]["closed"] = True
        week = hours.normalize_week(payload)
        self.assertEqual(week[2]["shifts"], [])

    def test_seven_days_are_required_once_each(self):
        base = week_payload({"all": LUNCH_DINNER})["week"]
        for bad in ({}, {"week": "x"}, {"week": base[:6]}, {"week": base + [base[0]]}, None, [], {"week": [None] * 7}):
            with self.assertRaises(hours.HoursError, msg=str(bad)[:40]):
                hours.normalize_week(bad)
        duplicated = [dict(day) for day in base]
        duplicated[3]["weekday"] = 2
        with self.assertRaisesRegex(hours.HoursError, "duas vezes"):
            hours.normalize_week({"week": duplicated})
        for number in (-1, 7, "1", True, None, 1.5):
            broken = [dict(day) for day in base]
            broken[0]["weekday"] = number
            with self.assertRaises(hours.HoursError, msg=repr(number)):
                hours.normalize_week({"week": broken})

    def test_one_or_two_shifts_never_zero_or_three(self):
        for shifts in ([], [{"opens": "08:00", "closes": "09:00"}] * 3, "x", None):
            payload = week_payload({"all": LUNCH_DINNER})
            payload["week"][1]["shifts"] = shifts
            with self.assertRaisesRegex(hours.HoursError, "1 ou 2 turnos"):
                hours.normalize_week(payload)

    def test_bad_hours_are_explained(self):
        for shift, words in (
            ({"opens": "11:00", "closes": "11:00"}, "mesma hora"),
            ({"opens": "25:00", "closes": "11:00"}, "11:00 ou 18h30"),
            ({"opens": "abc", "closes": "11:00"}, "11:00 ou 18h30"),
            ({"opens": "11:00"}, "11:00 ou 18h30"),
            ("11:00", "hora de abrir"),
        ):
            payload = week_payload({"all": LUNCH_DINNER})
            payload["week"][0]["shifts"] = [shift]
            with self.assertRaisesRegex(hours.HoursError, words):
                hours.normalize_week(payload)

    def test_closed_must_be_a_real_yes_or_no(self):
        payload = week_payload({"all": LUNCH_DINNER})
        payload["week"][0]["closed"] = "false"
        with self.assertRaises(hours.HoursError):
            hours.normalize_week(payload)

    def test_two_shifts_that_touch_or_overlap_in_a_day_are_refused(self):
        for second in ({"opens": "14:00", "closes": "20:00"}, {"opens": "10:00", "closes": "12:00"}, {"opens": "11:00", "closes": "13:00"}):
            payload = week_payload({"all": LUNCH_DINNER})
            payload["week"][4]["shifts"] = [{"opens": "11:00", "closes": "15:00"}, second]
            with self.assertRaisesRegex(hours.HoursError, "se cruzam"):
                hours.normalize_week(payload)

    def test_closing_exactly_when_the_next_opens_is_fine(self):
        payload = week_payload({"all": []}, closed=())
        for day in payload["week"]:
            day["shifts"] = [{"opens": "08:00", "closes": "12:00"}, {"opens": "12:00", "closes": "20:00"}]
        hours.normalize_week(payload)

    def test_a_night_shift_may_not_run_over_the_next_days_opening(self):
        payload = week_payload({"all": [{"opens": "11:00", "closes": "15:00"}]})
        payload["week"][4]["shifts"] = [{"opens": "18:00", "closes": "12:00"}]  # sexta 18h até sábado 12h pisa no turno de sábado
        with self.assertRaisesRegex(hours.HoursError, "se cruzam"):
            hours.normalize_week(payload)

    def test_the_week_wraps_around_sunday_night_into_monday_morning(self):
        payload = week_payload({"all": [{"opens": "11:00", "closes": "15:00"}]})
        payload["week"][6]["shifts"] = [{"opens": "22:00", "closes": "12:00"}]  # domingo 22h até segunda 12h pisa na segunda
        with self.assertRaisesRegex(hours.HoursError, "se cruzam"):
            hours.normalize_week(payload)
        payload["week"][6]["shifts"] = [{"opens": "22:00", "closes": "02:00"}]  # até as 2h da manhã está livre
        hours.normalize_week(payload)

    def test_a_single_overnight_shift_is_fine(self):
        payload = week_payload({"all": [{"opens": "18:00", "closes": "02:00"}]})
        week = hours.normalize_week(payload)
        self.assertEqual(week[0]["shifts"], [(1080, 120)])


class StatusTests(unittest.TestCase):
    def test_a_restaurant_with_no_hours_is_always_open(self):
        for now in (at(0, 3), at(2, 12), at(6, 23, 59)):
            result = hours.status([], now)
            self.assertEqual(result, {"configured": False, "open_now": True, "message": ""})

    def test_open_inside_a_shift_closed_between_shifts(self):
        rows = standard_rows()
        self.assertEqual(hours.status(rows, at(1, 12)), {"configured": True, "open_now": True, "message": "Aberto até 15h."})
        self.assertTrue(hours.status(rows, at(1, 20, 30))["open_now"])
        self.assertEqual(hours.status(rows, at(1, 16))["message"], "Fechado agora. Abre hoje às 18h.")

    def test_the_closing_minute_is_already_closed_and_the_opening_minute_is_open(self):
        rows = standard_rows()
        self.assertTrue(hours.status(rows, at(1, 11, 0))["open_now"])
        self.assertTrue(hours.status(rows, at(1, 14, 59))["open_now"])
        self.assertFalse(hours.status(rows, at(1, 15, 0))["open_now"])
        self.assertFalse(hours.status(rows, at(1, 10, 59))["open_now"])

    def test_the_words_for_when_it_opens_again(self):
        rows = standard_rows()
        self.assertEqual(hours.status(rows, at(1, 8))["message"], "Fechado agora. Abre hoje às 11h.")
        self.assertEqual(hours.status(rows, at(1, 23, 30))["message"], "Fechado agora. Abre amanhã às 11h.")
        # sábado de noite, domingo fechado: só abre segunda
        self.assertEqual(hours.status(rows, at(5, 23, 30))["message"], "Fechado agora. Abre segunda às 11h.")
        # domingo o dia todo: abre amanhã
        self.assertEqual(hours.status(rows, at(6, 12))["message"], "Fechado agora. Abre amanhã às 11h.")

    def test_minutes_are_spoken(self):
        rows = rows_for(hours.normalize_week(week_payload({"all": [{"opens": "18:30", "closes": "22:15"}]})))
        self.assertEqual(hours.status(rows, at(0, 10))["message"], "Fechado agora. Abre hoje às 18h30.")
        self.assertEqual(hours.status(rows, at(0, 19))["message"], "Aberto até 22h15.")

    def test_a_shift_past_midnight_stays_open_into_the_next_morning(self):
        rows = rows_for(hours.normalize_week(week_payload({"all": [{"opens": "18:00", "closes": "02:00"}]})))
        self.assertTrue(hours.status(rows, at(0, 23))["open_now"])
        self.assertEqual(hours.status(rows, at(1, 1, 30)), {"configured": True, "open_now": True, "message": "Aberto até 2h."})
        self.assertFalse(hours.status(rows, at(1, 2, 0))["open_now"])
        self.assertEqual(hours.status(rows, at(1, 5))["message"], "Fechado agora. Abre hoje às 18h.")

    def test_sunday_night_runs_into_monday_morning(self):
        rows = rows_for(hours.normalize_week(week_payload({"all": [{"opens": "18:00", "closes": "02:00"}]})))
        self.assertTrue(hours.status(rows, at(0, 1))["open_now"], "segunda 1h da manhã vem do turno de domingo")

    def test_a_day_closed_after_a_late_night_still_serves_the_tail(self):
        # sábado 18h às 2h; domingo fechado: domingo 1h ainda está aberto, domingo 3h não.
        payload = week_payload({"all": [{"opens": "11:00", "closes": "15:00"}]}, closed=(6,))
        payload["week"][5]["shifts"] = [{"opens": "18:00", "closes": "02:00"}]
        rows = rows_for(hours.normalize_week(payload))
        self.assertTrue(hours.status(rows, at(6, 1))["open_now"])
        self.assertFalse(hours.status(rows, at(6, 3))["open_now"])

    def test_every_day_closed(self):
        rows = rows_for(hours.normalize_week(week_payload({}, closed=tuple(range(7)))))
        result = hours.status(rows, at(2, 12))
        self.assertEqual(result, {"configured": True, "open_now": False, "message": "Fechado no momento."})

    def test_a_day_with_no_row_counts_as_closed(self):
        rows = [row for row in standard_rows() if row["weekday"] != 2]
        self.assertFalse(hours.status(rows, at(2, 12))["open_now"])
        self.assertTrue(hours.status(rows, at(1, 12))["open_now"])

    def test_the_clock_is_the_one_in_brasilia(self):
        rows = standard_rows()
        # 12/10/2026 21:00 UTC = 18:00 em Brasília (aberto); 12/10/2026 17:00 UTC = 14:00 em Brasília (aberto até 15h)
        self.assertTrue(hours.status(rows, datetime(2026, 10, 12, 21, 0, tzinfo=timezone.utc))["open_now"])
        self.assertEqual(hours.status(rows, datetime(2026, 10, 12, 17, 0, tzinfo=timezone.utc))["message"], "Aberto até 15h.")
        # 03:00 UTC de terça = 00:00 de segunda em Brasília: fechado, abre hoje às 11h
        self.assertEqual(hours.status(rows, datetime(2026, 10, 13, 3, 0, tzinfo=timezone.utc))["message"], "Fechado agora. Abre hoje às 11h.")

    def test_times_that_come_from_the_database_as_time_objects(self):
        rows = [
            {"weekday": d, "opens_at": time(11, 0), "closes_at": time(15, 0), "accepts_orders": True, "opens_at_2": None, "closes_at_2": None}
            for d in range(7)
        ]
        self.assertTrue(hours.status(rows, at(3, 12))["open_now"])
        self.assertFalse(hours.status(rows, at(3, 16))["open_now"])


class ClosedReasonTests(unittest.TestCase):
    def test_pause_beats_everything_even_at_the_table(self):
        rows = standard_rows()
        for from_table in (True, False):
            code, message = hours.closed_reason(True, rows, from_table, at(1, 12))
            self.assertEqual(code, "paused")
            self.assertEqual(message, hours.PAUSED_MESSAGE)
        self.assertEqual(hours.closed_reason(True, [], False, at(1, 12))[0], "paused")

    def test_outside_the_hours_a_delivery_or_pickup_is_refused_with_the_when(self):
        code, message = hours.closed_reason(False, standard_rows(), False, at(1, 16))
        self.assertEqual((code, message), ("closed_now", "Fechado agora. Abre hoje às 18h."))

    def test_a_table_order_ignores_the_schedule(self):
        self.assertIsNone(hours.closed_reason(False, standard_rows(), True, at(1, 16)))
        self.assertIsNone(hours.closed_reason(False, standard_rows(), True, at(6, 12)))

    def test_inside_the_hours_or_with_no_hours_the_order_goes_in(self):
        self.assertIsNone(hours.closed_reason(False, standard_rows(), False, at(1, 12)))
        self.assertIsNone(hours.closed_reason(False, [], False, at(1, 3)))


class ViewTests(unittest.TestCase):
    def test_the_public_view_has_no_shifts_just_the_answer(self):
        view = hours.public_view(standard_rows(), False, at(1, 16))
        self.assertEqual(view, {"configured": True, "open_now": False, "message": "Fechado agora. Abre hoje às 18h.", "paused": False})
        self.assertEqual(set(view), {"configured", "open_now", "message", "paused"})

    def test_the_owner_view_has_the_seven_days_ready_to_edit(self):
        view = hours.admin_view(standard_rows(), True, at(1, 12))
        self.assertEqual(len(view["week"]), 7)
        self.assertEqual(view["week"][0], {"weekday": 0, "name": "segunda", "closed": False,
                                           "shifts": [{"opens": "11:00", "closes": "15:00"}, {"opens": "18:00", "closes": "23:00"}]})
        self.assertEqual(view["week"][6], {"weekday": 6, "name": "domingo", "closed": True, "shifts": []})
        self.assertTrue(view["orders_paused"])
        self.assertTrue(view["configured"])
        self.assertTrue(view["open_now"])
        self.assertEqual(view["open_message"], "Aberto até 15h.")
        self.assertNotIn("message", view, "o painel usa 'message' para a resposta de salvar: nao pode colidir")

    def test_an_unconfigured_restaurant_shows_seven_closed_days_and_says_so(self):
        view = hours.admin_view([], False, at(1, 12))
        self.assertFalse(view["configured"])
        self.assertTrue(view["open_now"])
        self.assertTrue(all(day["closed"] for day in view["week"]))

    def test_the_week_in_one_line(self):
        week = hours.normalize_week(week_payload({"all": LUNCH_DINNER}, closed=(6,)))
        self.assertEqual(hours.summary(week), "Seg a sáb 11h às 15h e 18h às 23h · Dom fechado")
        payload = week_payload({"all": [{"opens": "11:00", "closes": "22:00"}]})
        payload["week"][5]["shifts"] = [{"opens": "11:00", "closes": "23:30"}]
        self.assertEqual(hours.summary(hours.normalize_week(payload)),
                         "Seg a sex 11h às 22h · Sáb 11h às 23h30 · Dom 11h às 22h")


class SaveTests(unittest.TestCase):
    def test_saving_replaces_the_whole_week_with_seven_rows(self):
        cur = MagicMock()
        week = hours.normalize_week(week_payload({"all": LUNCH_DINNER}, closed=(6,)))
        hours.save_week(cur, "co-1", week)
        calls = [(" ".join(c.args[0].split()), c.args[1]) for c in cur.execute.call_args_list]
        self.assertTrue(calls[0][0].startswith("DELETE FROM business_hours"))
        self.assertEqual(calls[0][1], ("co-1",))
        inserts = calls[1:]
        self.assertEqual(len(inserts), 7)
        self.assertEqual(inserts[0][1], ("co-1", 0, "11:00", "15:00", True, "18:00", "23:00"))
        self.assertEqual(inserts[6][1], ("co-1", 6, None, None, False, None, None))

    def test_a_one_shift_day_leaves_the_second_shift_empty(self):
        cur = MagicMock()
        week = hours.normalize_week(week_payload({"all": [{"opens": "18:00", "closes": "02:00"}]}))
        hours.save_week(cur, "co-1", week)
        first_insert = cur.execute.call_args_list[1].args[1]
        self.assertEqual(first_insert, ("co-1", 0, "18:00", "02:00", True, None, None))

    def test_what_is_saved_reads_back_the_same(self):
        week = hours.normalize_week(week_payload({"all": LUNCH_DINNER, 2: [{"opens": "18:00", "closes": "02:00"}]}, closed=(6,)))
        cur = MagicMock()
        hours.save_week(cur, "co-1", week)
        rows = []
        for call in cur.execute.call_args_list[1:]:
            _, weekday, opens, closes, accepts, opens2, closes2 = call.args[1]
            rows.append({"weekday": weekday, "opens_at": opens, "closes_at": closes, "accepts_orders": accepts,
                         "opens_at_2": opens2, "closes_at_2": closes2})
        self.assertEqual(hours.week_from_rows(rows), week)

    def test_the_queries_are_always_tied_to_one_restaurant(self):
        self.assertIn("WHERE company_id = %s", hours.SQL_ROWS)
        self.assertIn("WHERE company_id = %s", hours.SQL_DELETE)
        self.assertIn("WHERE id = %s", hours.SQL_PAUSED)
        self.assertIn("WHERE id = %s", hours.SQL_SET_PAUSED)


if __name__ == "__main__":
    unittest.main()
