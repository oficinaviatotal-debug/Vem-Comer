"""Horário de funcionamento e pausa de pedidos (migração 013).

O restaurante diz em que dias e horas recebe pedido: até dois turnos por dia (almoço e jantar), dia fechado, e turno que
passa da meia-noite (18h às 2h da manhã). Fora do horário o cardápio continua à vista, mas o cliente não consegue pedir
"de fora" (entrega e retirada). Pedido de MESA (QR na mesa) ignora o horário: quem já está sentado não é barrado na hora de
fechar. A pausa manual ("estamos lotados, pausa por favor") vale para todos os tipos, mesa inclusive.

Sem nenhum horário cadastrado, o restaurante está sempre aberto (é o que acontece com todos os que já existiam).

Os dias vão de 0 (segunda) a 6 (domingo), como `date.weekday()` do Python. O relógio é o de Brasília (UTC-3, sem horário de
verão desde 2019), como o da assinatura.

Este arquivo tem as regras e o SQL; as rotas em app.py conversam com o banco.
"""

from __future__ import annotations

import re
from datetime import datetime, time, timedelta, timezone

BRAZIL = timezone(timedelta(hours=-3))

DAY_MINUTES = 1440
WEEK_MINUTES = 7 * DAY_MINUTES
MAX_SHIFTS = 2

DAY_NAMES = ("segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo")

PAUSED_MESSAGE = "Estamos com uma pausa nos pedidos. Tente de novo em alguns minutos."

_CLOCK = re.compile(r"^\s*(\d{1,2})(?::|h)(\d{2})?\s*$")


class HoursError(ValueError):
    """Horário que não dá para aceitar; a mensagem vai para a tela."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ---------------------------------------------------------------------------------------------- horas e minutos

def to_minutes(value) -> int | None:
    """"18:30", "18h", "18h30", "08:05:00" ou datetime.time -> minutos desde a meia-noite; None se não for hora."""
    if value is None:
        return None
    if isinstance(value, time):
        return value.hour * 60 + value.minute
    text = str(value).strip().lower()
    if re.fullmatch(r"\d{1,2}:\d{2}:\d{2}(\.\d+)?", text):
        text = text[: text.rindex(":")] if text.count(":") == 2 else text
    if text in ("24:00", "24h", "24h00"):
        return 0  # meia-noite que fecha o dia: o mesmo que 00:00 do dia seguinte
    match = _CLOCK.match(text)
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2) or 0)
    if hour > 23 or minute > 59:
        return None
    return hour * 60 + minute


def clock(minutes: int) -> str:
    """Minutos -> "18:30" (o que o painel e o banco guardam)."""
    minutes %= DAY_MINUTES
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def say(minutes: int) -> str:
    """Minutos -> "18h" ou "18h30" (o que o cliente lê)."""
    minutes %= DAY_MINUTES
    hour, minute = divmod(minutes, 60)
    return f"{hour}h" if minute == 0 else f"{hour}h{minute:02d}"


def duration(opens: int, closes: int) -> int:
    """Quanto dura o turno; fechar antes de abrir quer dizer que passa da meia-noite."""
    return closes - opens if closes > opens else closes + DAY_MINUTES - opens


# ---------------------------------------------------------------------------------------------- validação

def _bool(value, what: str) -> bool:
    if isinstance(value, bool):
        return value
    raise HoursError(f"{what}: use sim ou não.")


def _shift(raw, day_name: str) -> tuple[int, int]:
    if not isinstance(raw, dict):
        raise HoursError(f"{day_name}: cada turno precisa de hora de abrir e de fechar.")
    opens = to_minutes(raw.get("opens"))
    closes = to_minutes(raw.get("closes"))
    if opens is None or closes is None:
        raise HoursError(f"{day_name}: escreva as horas assim, 11:00 ou 18h30.")
    if opens == closes:
        raise HoursError(f"{day_name}: abrir e fechar na mesma hora não vale. Para o dia todo, use de 00:00 às 23:59.")
    return opens, closes


def normalize_week(data) -> list[dict]:
    """O que o painel mandou -> os 7 dias limpos, em ordem, cada um {weekday, closed, shifts: [(abre, fecha)]}.

    Recusa dia repetido ou faltando, mais de dois turnos, hora ruim e turnos que se cruzam (inclusive virando a
    noite sobre o turno do dia seguinte).
    """
    if not isinstance(data, dict) or not isinstance(data.get("week"), list):
        raise HoursError("Mande os 7 dias da semana.")
    entries = data["week"]
    if len(entries) != 7:
        raise HoursError("Mande os 7 dias da semana.")

    days: dict[int, dict] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise HoursError("Mande os 7 dias da semana.")
        weekday = entry.get("weekday")
        if isinstance(weekday, bool) or not isinstance(weekday, int) or not 0 <= weekday <= 6:
            raise HoursError("Dia da semana inválido.")
        if weekday in days:
            raise HoursError(f"{DAY_NAMES[weekday].capitalize()} apareceu duas vezes.")
        name = DAY_NAMES[weekday].capitalize()

        closed = _bool(entry.get("closed", False), name)
        shifts: list[tuple[int, int]] = []
        if not closed:
            raw = entry.get("shifts")
            if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_SHIFTS:
                raise HoursError(f"{name}: coloque 1 ou 2 turnos, ou marque como fechado.")
            shifts = sorted(_shift(item, name) for item in raw)
        days[weekday] = {"weekday": weekday, "closed": closed, "shifts": shifts}

    week = [days[number] for number in range(7)]

    # Nenhum turno pode pisar em outro, nem de um dia para o seguinte (a semana dá a volta).
    spans = sorted(
        (day["weekday"] * DAY_MINUTES + opens, day["weekday"] * DAY_MINUTES + opens + duration(opens, closes), day["weekday"])
        for day in week
        for opens, closes in day["shifts"]
    )
    if len(spans) > 1:
        for index, (start, end, weekday) in enumerate(spans):
            following = spans[(index + 1) % len(spans)]
            next_start = following[0] + (WEEK_MINUTES if index == len(spans) - 1 else 0)
            if end > next_start:
                first, second = DAY_NAMES[weekday], DAY_NAMES[following[2]]
                where = f"de {first}" if first == second else f"de {first} e de {second}"
                raise HoursError(f"Os turnos {where} se cruzam. Confira as horas.")
    return week


# ---------------------------------------------------------------------------------------------- do banco para a tela

def week_from_rows(rows) -> list[dict]:
    """Linhas de business_hours -> os 7 dias. Dia sem linha, ou marcado como fechado, é dia fechado."""
    by_day = {}
    for row in rows or []:
        weekday = row.get("weekday")
        if not isinstance(weekday, int) or not 0 <= weekday <= 6:
            continue
        shifts = []
        if row.get("accepts_orders", True):
            for first, second in (("opens_at", "closes_at"), ("opens_at_2", "closes_at_2")):
                opens, closes = to_minutes(row.get(first)), to_minutes(row.get(second))
                if opens is not None and closes is not None and opens != closes:
                    shifts.append((opens, closes))
        by_day[weekday] = {"weekday": weekday, "closed": not shifts, "shifts": sorted(shifts)}
    return [by_day.get(number, {"weekday": number, "closed": True, "shifts": []}) for number in range(7)]


def is_configured(rows) -> bool:
    return bool(rows)


def day_view(day: dict) -> dict:
    return {
        "weekday": day["weekday"],
        "name": DAY_NAMES[day["weekday"]],
        "closed": bool(day["closed"]),
        "shifts": [{"opens": clock(opens), "closes": clock(closes)} for opens, closes in day["shifts"]],
    }


def local_now(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)).astimezone(BRAZIL)


def _spans(week: list[dict]) -> list[tuple[int, int]]:
    return sorted(
        (day["weekday"] * DAY_MINUTES + opens, day["weekday"] * DAY_MINUTES + opens + duration(opens, closes))
        for day in week
        for opens, closes in day["shifts"]
    )


def _minute_of_week(now: datetime) -> int:
    return now.weekday() * DAY_MINUTES + now.hour * 60 + now.minute


def status(rows, now: datetime | None = None) -> dict:
    """Aberto ou fechado agora, e a frase para o cliente. Sem horário cadastrado: sempre aberto, sem frase."""
    if not is_configured(rows):
        return {"configured": False, "open_now": True, "message": ""}

    here = local_now(now)
    week = week_from_rows(rows)
    spans = _spans(week)
    point = _minute_of_week(here)

    for start, end in spans:
        # O turno da noite de domingo termina na madrugada de segunda: o mesmo ponto vale também uma semana depois.
        if start <= point < end or start <= point + WEEK_MINUTES < end:
            return {"configured": True, "open_now": True, "message": f"Aberto até {say(end % DAY_MINUTES)}."}

    if not spans:
        return {"configured": True, "open_now": False, "message": "Fechado no momento."}

    ahead = min(((start - point) % WEEK_MINUTES, start) for start, _ in spans)
    days_ahead = (point + ahead[0]) // DAY_MINUTES - point // DAY_MINUTES
    opens_text = say(ahead[1])
    if days_ahead == 0:
        when = f"hoje às {opens_text}"
    elif days_ahead == 1:
        when = f"amanhã às {opens_text}"
    else:
        when = f"{DAY_NAMES[ahead[1] // DAY_MINUTES]} às {opens_text}"
    return {"configured": True, "open_now": False, "message": f"Fechado agora. Abre {when}."}


def closed_reason(paused: bool, rows, from_table: bool, now: datetime | None = None) -> tuple[str, str] | None:
    """(código, frase) se o pedido NÃO pode entrar agora; None se pode. Pausa vale sempre; horário, só fora da mesa."""
    if paused:
        return "paused", PAUSED_MESSAGE
    if from_table:
        return None
    current = status(rows, now)
    if not current["open_now"]:
        return "closed_now", current["message"]
    return None


def public_view(rows, paused: bool, now: datetime | None = None) -> dict:
    """O que qualquer cliente pode ver: se há horário, se está aberto e a frase. Nada dos turnos em si."""
    current = status(rows, now)
    return {
        "configured": current["configured"],
        "open_now": current["open_now"],
        "message": current["message"],
        "paused": bool(paused),
    }


def admin_view(rows, paused: bool, now: datetime | None = None) -> dict:
    """A tela do dono: os 7 dias para editar, a pausa e como está agora."""
    current = status(rows, now)
    return {
        "configured": current["configured"],
        "week": [day_view(day) for day in week_from_rows(rows)],
        "orders_paused": bool(paused),
        "open_now": current["open_now"],
        "open_message": current["message"],
    }


def summary(week: list[dict]) -> str:
    """Uma linha para ouvir/ler: "Seg a sex 11h às 15h e 18h às 23h · Sáb 11h às 23h · Dom fechado"."""
    short = ("seg", "ter", "qua", "qui", "sex", "sáb", "dom")

    def text(day: dict) -> str:
        if day["closed"]:
            return "fechado"
        return " e ".join(f"{say(opens)} às {say(closes)}" for opens, closes in day["shifts"])

    groups: list[list] = []
    for day in week:
        label = text(day)
        if groups and groups[-1][2] == label and groups[-1][1] == day["weekday"] - 1:
            groups[-1][1] = day["weekday"]
        else:
            groups.append([day["weekday"], day["weekday"], label])
    parts = []
    for first, last, label in groups:
        span = short[first].capitalize() if first == last else f"{short[first].capitalize()} a {short[last]}"
        parts.append(f"{span} {label}")
    return " · ".join(parts)


# ---------------------------------------------------------------------------------------------- SQL

SQL_ROWS = """
    SELECT weekday, opens_at, closes_at, accepts_orders, opens_at_2, closes_at_2
    FROM business_hours
    WHERE company_id = %s
    ORDER BY weekday;
"""

SQL_PAUSED = "SELECT orders_paused FROM companies WHERE id = %s;"

SQL_SET_PAUSED = "UPDATE companies SET orders_paused = %s WHERE id = %s;"

SQL_DELETE = "DELETE FROM business_hours WHERE company_id = %s;"

SQL_INSERT = """
    INSERT INTO business_hours (company_id, weekday, opens_at, closes_at, accepts_orders, opens_at_2, closes_at_2)
    VALUES (%s, %s, %s, %s, %s, %s, %s);
"""


def fetch_rows(cur, company_id) -> list[dict]:
    cur.execute(SQL_ROWS, (str(company_id),))
    return list(cur.fetchall() or [])


def fetch_paused(cur, company_id) -> bool:
    cur.execute(SQL_PAUSED, (str(company_id),))
    row = cur.fetchone()
    return bool(row and row.get("orders_paused"))


def save_week(cur, company_id, week: list[dict]) -> None:
    """Troca a semana inteira (7 linhas). Quem chama já travou a linha do restaurante e confirma a transação."""
    cur.execute(SQL_DELETE, (str(company_id),))
    for day in week:
        first = day["shifts"][0] if day["shifts"] else None
        second = day["shifts"][1] if len(day["shifts"]) > 1 else None
        cur.execute(
            SQL_INSERT,
            (
                str(company_id),
                day["weekday"],
                clock(first[0]) if first else None,
                clock(first[1]) if first else None,
                not day["closed"],
                clock(second[0]) if second else None,
                clock(second[1]) if second else None,
            ),
        )
