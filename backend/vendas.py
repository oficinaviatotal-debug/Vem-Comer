"""Máquina de vendas do Vem: do primeiro contato com um restaurante até ele pagar (migração 021).

Desenho em docs/maquina-de-vendas-do-vem.md. Esta peça é o **caderno inteligente** do dono do sistema (o GD):
guarda os negócios que o Vem quer conquistar, diz quem procurar hoje, em que horário, por qual canal e o que dizer
em seguida, e conta o que deu certo. **Nada aqui envia mensagem a ninguém.** Quem escreve é uma pessoa do Vem, uma
mensagem por vez, pelo canal que o próprio negócio divulgou (ou pediu); depois ela toca em "Já mandei" e o sistema
lembra do próximo passo. Isso é a regra de compliance/obligations.json (EMAIL-PROSPECCAO-EMPRESA) e do plano de
crescimento (docs/plano-de-crescimento-90-dias.md, seção 6): nada de mensagem fria em massa por WhatsApp ou
Telegram; e-mail em volume só com provedor, domínio autenticado e o advogado (e passando por outreach.check_contact).

Regras (todas com teste):
- todo negócio entra com a ORIGEM do contato e uma nota de onde foi visto; sem isso não entra;
- no máximo 3 contatos por negócio (2 por WhatsApp), com pelo menos 5 dias entre eles (7 entre mensagens de pessoa);
  depois disso o negócio é encerrado como "sem resposta" e não é procurado de novo;
- "não quero" (ou "pare", "sair", "não me chame"…) vale na hora e para sempre: o telefone e o e-mail vão para a lista
  de bloqueio (só a impressão digital) e o resto do contato é apagado da ficha; quem saiu não volta por outra porta;
- quem respondeu é atendido primeiro, em qualquer dia; o que é primeiro contato ou lembrete não é sugerido no domingo;
- o sistema sugere no máximo 10 por dia e avisa quando passam de 15 mensagens no mesmo dia;
- o horário sugerido é o de folga de cada tipo de negócio (a cozinha cheia não atende conversa de vendas);
- quem pede para apagar os dados some da ficha e só fica a impressão digital no bloqueio (LGPD art. 18);
- o formulário "quero que o Vem fale comigo" do site só existe se o GD ligar (INTEREST_OPEN=1), exige a caixa de
  autorização marcada pela própria pessoa e guarda a prova do aceite (consent_records) com a impressão digital do texto.

Sem Flask. As rotas (vendas_api.py) usam estas funções.
"""

from __future__ import annotations

import hashlib
import os
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import consent
import outreach

# Brasília não tem horário de verão desde 2019: um deslocamento fixo de -3 horas basta e não depende de tabela de fusos.
BR = timezone(timedelta(hours=-3))

# ---------------------------------------------------------------- vocabulário

STAGES = ("achado", "chamado", "respondeu", "demonstracao", "cadastrou", "pagando", "nao_quer", "sem_resposta", "perdido")
STAGE_LABELS = {
    "achado": "Achado",
    "chamado": "Já chamei",
    "respondeu": "Respondeu",
    "demonstracao": "Viu a demonstração",
    "cadastrou": "Cadastrou",
    "pagando": "Pagando",
    "nao_quer": "Não quer",
    "sem_resposta": "Sem resposta",
    "perdido": "Perdido",
}
# Depois destas etapas o sistema não sugere mais nada de venda.
CLOSED_STAGES = ("pagando", "nao_quer", "sem_resposta", "perdido")
# A ordem natural do caminho; a etapa só anda para frente (voltar é "respondeu" de novo, pela resposta da pessoa).
RANK = {"achado": 0, "chamado": 1, "respondeu": 2, "demonstracao": 3, "cadastrou": 4, "pagando": 5}

KINDS = ("restaurante", "lanchonete", "pizzaria", "pastelaria", "sorveteria", "acai", "padaria", "bar", "hamburgueria", "marmitaria", "confeitaria", "outro")
KIND_LABELS = {
    "restaurante": "Restaurante",
    "lanchonete": "Lanchonete",
    "pizzaria": "Pizzaria",
    "pastelaria": "Pastelaria",
    "sorveteria": "Sorveteria",
    "acai": "Açaí",
    "padaria": "Padaria",
    "bar": "Bar",
    "hamburgueria": "Hamburgueria",
    "marmitaria": "Marmitaria",
    "confeitaria": "Confeitaria",
    "outro": "Outro negócio de comida",
}

# As mesmas origens do e-mail para empresas (outreach.SOURCES), mais a visita em pessoa e o formulário do site.
SOURCES = outreach.SOURCES + ("visita", "formulario_do_site")
SOURCE_LABELS = {
    "anuncio_publico": "Anúncio público",
    "site_da_empresa": "Site da empresa",
    "indicacao": "Indicação",
    "parceiro": "Parceiro",
    "pedido_do_contato": "Pediu contato",
    "visita": "Visita",
    "formulario_do_site": "Formulário do site",
}

CHANNELS = ("whatsapp", "email", "ligacao", "instagram", "presencial")
CHANNEL_LABELS = {
    "whatsapp": "WhatsApp",
    "email": "E-mail",
    "ligacao": "Ligação",
    "instagram": "Instagram",
    "presencial": "Pessoalmente",
}
# Canais em que uma pessoa fala com outra (esperam mais entre uma mensagem e outra do que o e-mail).
PERSON_CHANNELS = ("whatsapp", "ligacao", "instagram", "presencial")

REPLY_KINDS = ("interessado", "duvida", "quer_saber_origem", "adiar", "nao_quer")

# ---------------------------------------------------------------- limites

MAX_TOUCHES = 3
MAX_WHATSAPP_TOUCHES = 2
MIN_DAYS_BETWEEN = 5
PERSON_WAIT_DAYS = 7
EMAIL_WAIT_DAYS = outreach.MIN_DAYS_BETWEEN
SNOOZE_DAYS = 14
DEMO_FOLLOWUP_DAYS = 3
SIGNUP_FOLLOWUP_DAYS = 2
TODAY_LIMIT = 10
DAILY_TOUCH_NOTICE = 15
PURGE_MONTHS = 24

# Horário de folga de cada tipo de negócio, em hora cheia de Brasília (começa, termina). É a leitura da engenharia
# para o horário em que o dono tem tempo de ouvir; o GD ajusta pelo que ouvir dos donos.
WINDOWS = {
    "restaurante": (14, 17),
    "lanchonete": (14, 17),
    "hamburgueria": (14, 17),
    "marmitaria": (14, 17),
    "confeitaria": (14, 17),
    "pizzaria": (14, 17),
    "pastelaria": (14, 16),
    "padaria": (14, 16),
    "sorveteria": (9, 11),
    "acai": (9, 11),
    "bar": (10, 16),
    "outro": (14, 17),
}


class ProspectError(Exception):
    """Erro que a tela mostra em frase inteira, com o código HTTP que a rota devolve."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ---------------------------------------------------------------- texto, telefone e contato

def _plain(text) -> str:
    """Minúsculas, sem acento e com um espaço só entre as palavras: para comparar texto."""
    base = unicodedata.normalize("NFD", str(text or "").lower())
    base = "".join(ch for ch in base if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", base).strip()


def normalize_phone(value) -> str | None:
    """Telefone brasileiro só com dígitos e o 55 na frente; None se não parecer um telefone do Brasil.

    Aceita "(84) 99999-8888", "+55 84 99999-8888", "084 9999-8888" (celular antigo, sem o 9) e fixo de 8 dígitos."""
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        return None
    digits = re.sub(r"\D", "", str(value))
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("55") and len(digits) in (12, 13):
        digits = digits[2:]
    if digits.startswith("0") and len(digits) in (11, 12):
        digits = digits[1:]  # o 0 de antes do DDD
    if len(digits) == 10 and digits[2] in "6789":
        digits = digits[:2] + "9" + digits[2:]  # celular antigo, de antes do nono dígito
    if len(digits) not in (10, 11) or digits[0] == "0" or digits[1] == "0":
        return None
    if len(digits) == 11 and digits[2] != "9":
        return None
    if len(digits) == 10 and digits[2] not in "2345":
        return None
    return "55" + digits


def is_mobile(phone: str | None) -> bool:
    """Só celular recebe WhatsApp: 55 + DDD + 9 + oito dígitos."""
    return bool(phone) and len(phone) == 13 and phone[4] == "9"


def phone_hash(phone: str) -> str:
    normalized = normalize_phone(phone)
    if normalized is None:
        raise ValueError("telefone inválido")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def phone_display(phone: str | None) -> str:
    """55 84 99999-8888 vira (84) 99999-8888, para a tela."""
    if not phone or len(phone) not in (12, 13):
        return ""
    ddd, rest = phone[2:4], phone[4:]
    return f"({ddd}) {rest[:-4]}-{rest[-4:]}"


_HANDLE_RE = re.compile(r"^[a-z0-9._]{1,30}$")


def normalize_instagram(value) -> str | None:
    """@pizzariadoze, instagram.com/pizzariadoze/ ou pizzariadoze viram pizzariadoze."""
    if not isinstance(value, str):
        return None
    text = value.strip().lower()
    match = re.search(r"instagram\.com/([a-z0-9._]+)", text)
    if match:
        text = match.group(1)
    text = text.lstrip("@").strip("/ ")
    if not _HANDLE_RE.match(text) or text in {"p", "reel", "explore", "accounts", "stories"} or text.endswith(".") or ".." in text:
        return None
    return text


_URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"']+", re.IGNORECASE)
_EMAIL_FIND_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+")
_PHONE_FIND_RE = re.compile(r"(?:\+?55\s*)?\(?\b0?[1-9][1-9]\)?[\s.\-]*9?\s?\d{4}[\s.\-]?\d{4}\b")
_HANDLE_FIND_RE = re.compile(r"(?<![\w@.])@([A-Za-z0-9._]{2,30})\b")
_WAME_RE = re.compile(r"wa\.me/(\+?\d{10,15})", re.IGNORECASE)

_SOCIAL_HOSTS = ("instagram.com", "facebook.com", "fb.com", "wa.me", "api.whatsapp.com", "whatsapp.com", "linktr.ee", "t.me", "tiktok.com", "youtube.com", "youtu.be", "ifood.com.br")


def parse_contact_text(text) -> dict:
    """Lê um texto colado ou falado (legenda de anúncio, cartão de visita) e separa o que parece contato.

    Só ajuda a preencher a ficha: quem confere e confirma é a pessoa. Nunca inventa: o que não achar vem vazio."""
    raw = str(text or "")[:2000]
    phones: list[str] = []
    for match in _WAME_RE.finditer(raw):
        phone = normalize_phone(match.group(1))
        if phone and phone not in phones:
            phones.append(phone)
    emails = [m.group(0).lower() for m in _EMAIL_FIND_RE.finditer(raw)]
    without_emails = _EMAIL_FIND_RE.sub(" ", raw)
    for match in _PHONE_FIND_RE.finditer(without_emails):
        phone = normalize_phone(match.group(0))
        if phone and phone not in phones:
            phones.append(phone)
    instagram = None
    for match in re.finditer(r"instagram\.com/([A-Za-z0-9._]+)", raw, re.IGNORECASE):
        instagram = normalize_instagram(match.group(1))
        if instagram:
            break
    if instagram is None:
        for match in _HANDLE_FIND_RE.finditer(without_emails):
            instagram = normalize_instagram(match.group(1))
            if instagram:
                break
    site = None
    for match in _URL_RE.finditer(raw):
        url = match.group(0).rstrip(".,;)")
        if not any(host in url.lower() for host in _SOCIAL_HOSTS):
            site = url if url.lower().startswith("http") else "https://" + url
            break
    name = None
    for line in raw.splitlines():
        cleaned = re.sub(r"[^\w\s&'\-.,áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]", " ", line)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -.,")
        if not cleaned or len(cleaned) < 3 or len(cleaned) > 60:
            continue
        if _EMAIL_FIND_RE.search(line) or _URL_RE.search(line) or _PHONE_FIND_RE.search(line) or "@" in line:
            continue
        if sum(ch.isdigit() for ch in cleaned) > 3:
            continue
        name = cleaned
        break
    return {
        "name": name,
        "phone": phones[0] if phones else None,
        "other_phones": phones[1:],
        "email": emails[0] if emails else None,
        "instagram": instagram,
        "site": site,
    }


# ---------------------------------------------------------------- o que a pessoa respondeu

_STOP_PATTERNS = (
    r"\bnao quero\b", r"\bnao tenho interesse\b", r"\bsem interesse\b", r"\bnao me interessa\b", r"\bpare\b", r"\bpara de\b",
    r"\bparar\b", r"\bsair\b", r"\bme tire\b", r"\bme tira\b", r"\btire meu\b", r"\btira meu\b", r"\bremov", r"\bdescadastr",
    r"\bnao (?:me )?(?:chame|chamem|envie|enviem|mande|mandem|escreva|escrevam|incomode|incomodem|procure|procurem|ligue|liguem)\b",
    r"\bspam\b", r"\bdenunci", r"\bbloque", r"\bnao insista",
)
_BARE_NO = {"nao", "n", "no", "nao obrigado", "nao obrigada", "nao, obrigado", "nao, obrigada", "nao valeu", "nao quero nao"}
_FOUND = r"(?:conseguiu|conseguiram|arrumou|arrumaram|pegou|pegaram|achou|acharam|obteve|obtiveram|descobriu|descobriram)"
_ORIGIN_PATTERNS = (
    rf"\bonde (?:voce |voces )?{_FOUND} (?:o |a )?(?:meu|minha|esse|essa|este|esta)",
    rf"\bcomo (?:voce |voces )?{_FOUND}",
    r"\bquem (?:te |lhe |voces )?(?:passou|deu|forneceu|indicou)",
    r"\bde onde (?:voce |voces )?(?:tirou|tiraram|veio|vieram|pegou|pegaram|conseguiu|conseguiram)",
    r"\b(?:meu|esse) (?:numero|contato|telefone|whatsapp) (?:foi|veio)",
    r"\bcomo (?:voces )?tem (?:o )?meu",
)
_LATER_PATTERNS = (r"\bagora nao\b", r"\bmais tarde\b", r"\bdepois\b", r"\bsemana que vem\b", r"\bmes que vem\b", r"\bproxima semana\b", r"\bproximo mes\b", r"\bmomento nao\b", r"\bestou ocupad[oa]\b", r"\bestamos ocupad")
_INTEREST_PATTERNS = (
    r"\bquero\b", r"\btenho interesse\b", r"\binteressad[oa]\b", r"\bme mostra\b", r"\bme mostre\b", r"\bpode mostrar\b", r"\bpode ligar\b", r"\bpode falar\b",
    r"\bpode mandar\b", r"\bmanda\b", r"\bmande\b", r"\bvamos\b", r"\bbora\b", r"\bgostei\b", r"\binteressante\b", r"\bdemonstra", r"\btestar\b", r"\bteste\b", r"\bfazer um teste\b",
)
_AFFIRMATIVE = {"sim", "s", "ok", "pode", "pode ser", "claro", "com certeza", "tenho", "beleza", "blz", "fechado", "topo"}
_QUESTION_PATTERNS = (r"\?", r"\bquanto\b", r"\bpreco\b", r"\bvalor\b", r"\bmensalidade\b", r"\bcusta\b", r"\bcomo funciona\b", r"\bcomo e\b", r"\bo que e\b", r"\bquem e\b", r"\bqual\b", r"\bquais\b", r"\bonde\b", r"\bcomo\b")


def classify_reply(text) -> str | None:
    """Lê o que o negócio respondeu e devolve uma classe: nao_quer, quer_saber_origem, adiar, interessado, duvida.

    None se não deu para entender. É só uma sugestão: a pessoa confirma com um toque, menos o "não quero", que o
    sistema sempre propõe parar (errar para o lado de parar custa um contato; errar para o outro lado, a confiança)."""
    plain = _plain(text)
    if not plain:
        return None
    bare = plain.strip(" .!,;:")
    if bare in _BARE_NO or any(re.search(pattern, plain) for pattern in _STOP_PATTERNS):
        return "nao_quer"
    if any(re.search(pattern, plain) for pattern in _ORIGIN_PATTERNS):
        return "quer_saber_origem"
    if any(re.search(pattern, plain) for pattern in _LATER_PATTERNS):
        return "adiar"
    if any(re.search(pattern, plain) for pattern in _QUESTION_PATTERNS):
        return "duvida" if not any(re.search(pattern, plain) for pattern in _INTEREST_PATTERNS) else "interessado"
    if bare in _AFFIRMATIVE or any(re.search(pattern, plain) for pattern in _INTEREST_PATTERNS):
        return "interessado"
    return None


# ---------------------------------------------------------------- a ficha

def _text(data: dict, key: str, low: int, high: int, label: str, *, required: bool = False) -> str | None:
    value = data.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ProspectError(f"Falta {label}.")
        return None
    if not isinstance(value, str):
        raise ProspectError(f"{label[0].upper()}{label[1:]} precisa ser texto.")
    value = re.sub(r"\s+", " ", value).strip()
    if not low <= len(value) <= high:
        raise ProspectError(f"{label[0].upper()}{label[1:]} precisa ter de {low} a {high} letras.")
    return value


def clean_prospect(data) -> dict:
    """Confere e arruma os dados de um negócio novo. Devolve só campos conhecidos; erro em frase inteira."""
    if not isinstance(data, dict):
        raise ProspectError("Mande os dados do negócio.")
    name = _text(data, "business_name", 2, 80, "o nome do negócio", required=True)
    kind = data.get("business_kind") or "outro"
    if kind not in KINDS:
        raise ProspectError("Escolha o tipo do negócio na lista.")
    city = _text(data, "city", 2, 60, "a cidade", required=True)
    neighborhood = _text(data, "neighborhood", 2, 60, "o bairro")
    person = _text(data, "contact_person", 2, 60, "o nome da pessoa")
    source = data.get("source")
    if source not in SOURCES:
        raise ProspectError("Diga de onde veio o contato (anúncio público, site, indicação, visita…).")
    source_note = _text(data, "source_note", 3, 300, "onde você viu o contato", required=True)
    note = _text(data, "note", 1, 300, "a anotação")

    phone = None
    if data.get("phone") not in (None, ""):
        phone = normalize_phone(data.get("phone"))
        if phone is None:
            raise ProspectError("Esse telefone não parece um telefone do Brasil. Confira o DDD e os números.")
    email = None
    if data.get("email") not in (None, ""):
        email = outreach.normalize_email(data.get("email"))
        if email is None:
            raise ProspectError("Esse e-mail não parece certo. Confira antes de salvar.")
    instagram = None
    if data.get("instagram") not in (None, ""):
        instagram = normalize_instagram(data.get("instagram"))
        if instagram is None:
            raise ProspectError("Esse Instagram não parece certo. Use só o nome da conta, como pizzariadoze.")
    site = _text(data, "site", 4, 200, "o endereço do site")
    if site and not re.match(r"^https?://", site, re.IGNORECASE):
        site = "https://" + site

    if not (phone or email or instagram or site) and source != "visita":
        raise ProspectError("Falta um jeito de falar com o negócio: telefone, e-mail, Instagram ou site.")
    return {
        "business_name": name,
        "business_kind": kind,
        "city": city,
        "neighborhood": neighborhood,
        "contact_person": person,
        "phone": phone,
        "phone_hash": phone_hash(phone) if phone else None,
        "email": email,
        "email_hash": outreach.email_hash(email) if email else None,
        "instagram": instagram,
        "site": site,
        "source": source,
        "source_note": source_note,
        "note": note,
    }


def channels_of(prospect: dict) -> list[str]:
    """Os canais que esta ficha permite, do melhor para o pior para uma conversa de pessoa para pessoa."""
    channels: list[str] = []
    phone = prospect.get("phone")
    if is_mobile(phone):
        channels.append("whatsapp")
    if prospect.get("email"):
        channels.append("email")
    if phone:
        channels.append("ligacao")
    if prospect.get("instagram"):
        channels.append("instagram")
    return channels


def wait_days(channel: str | None) -> int:
    return EMAIL_WAIT_DAYS if channel == "email" else PERSON_WAIT_DAYS


@dataclass(frozen=True)
class Decision:
    ok: bool
    reason: str

    def __bool__(self) -> bool:
        return self.ok


def can_touch(prospect: dict, channel: str, now: datetime | None = None, *, suppressed: bool = False) -> Decision:
    """A função única que libera ou barra "já mandei uma mensagem". Cada barreira tem um motivo curto e testável."""
    now = now or datetime.now(timezone.utc)
    if channel not in CHANNELS:
        return Decision(False, "canal_desconhecido")
    if suppressed:
        return Decision(False, "na_lista_de_bloqueio")
    stage = prospect.get("stage")
    if stage in CLOSED_STAGES:
        return Decision(False, "negocio_encerrado")
    if channel != "presencial" and channel not in channels_of(prospect):
        return Decision(False, "sem_esse_canal")
    # Quem já respondeu está numa conversa: responder não tem limite de contatos nem de espera.
    if stage in ("respondeu", "demonstracao", "cadastrou"):
        return Decision(True, "ok")
    touches = int(prospect.get("touches") or 0)
    if touches >= MAX_TOUCHES:
        return Decision(False, "limite_de_contatos")
    if channel == "whatsapp" and int(prospect.get("whatsapp_touches") or 0) >= MAX_WHATSAPP_TOUCHES:
        return Decision(False, "limite_de_whatsapp")
    last = prospect.get("last_touch_at")
    if last is not None:
        wait = max(MIN_DAYS_BETWEEN, wait_days(prospect.get("last_channel")))
        if now - last < timedelta(days=wait):
            return Decision(False, "cedo_demais_para_o_proximo")
    return Decision(True, "ok")


# ---------------------------------------------------------------- o próximo passo

@dataclass(frozen=True)
class Move:
    action: str
    reason: str
    channel: str | None = None
    due: datetime | None = None
    priority: int = 0
    tags: tuple[str, ...] = field(default_factory=tuple)

    @property
    def ready(self) -> bool:
        return self.action not in {"esperar", "parar"}


def _days(delta: timedelta) -> int:
    return max(0, int(delta.total_seconds() // 86400))


def next_move(prospect: dict, now: datetime | None = None, *, suppressed: bool = False) -> Move:
    """O que fazer com este negócio agora. Só sugere: a pessoa decide e toca."""
    now = now or datetime.now(timezone.utc)
    stage = prospect.get("stage") or "achado"
    if suppressed or stage in CLOSED_STAGES:
        return Move("parar", "Encerrado: não procurar mais.")

    snooze = prospect.get("snooze_until")
    if snooze is not None and now < snooze:
        return Move("esperar", "Pediu para falar depois.", due=snooze)

    chans = channels_of(prospect)
    stage_since = prospect.get("stage_since") or prospect.get("created_at") or now

    if stage == "respondeu":
        replied = prospect.get("replied_at") or stage_since
        answered_at = prospect.get("last_touch_at")
        channel = prospect.get("last_channel") or (chans[0] if chans else None)
        origin = prospect.get("reply_kind") == "quer_saber_origem"
        if answered_at is None or answered_at < replied:
            if origin:
                return Move("responder_origem", "Perguntou de onde veio o contato: diga a origem e ofereça parar.", channel=channel, priority=110, tags=("privacidade",))
            return Move("responder", "Respondeu: responda hoje.", channel=channel, priority=100)
        due = answered_at + timedelta(days=(PERSON_WAIT_DAYS if origin else DEMO_FOLLOWUP_DAYS))
        if now < due:
            return Move("esperar", "Você já respondeu: espere a vez dele.", due=due)
        if origin:
            return Move("encerrar", "Perguntou da origem do contato e não voltou: encerrar e não procurar de novo.", priority=20)
        return Move("convidar_para_demonstracao", f"Você respondeu há {_days(now - answered_at)} dias: convide para ver a demonstração.", channel=channel, priority=60)
    if stage == "demonstracao":
        due = stage_since + timedelta(days=DEMO_FOLLOWUP_DAYS)
        if now >= due:
            return Move("perguntar_se_travou", f"Viu a demonstração há {_days(now - stage_since)} dias e não se cadastrou: pergunte se travou.", channel=prospect.get("last_channel") or (chans[0] if chans else None), priority=70)
        return Move("esperar", "Viu a demonstração há pouco.", due=due)
    if stage == "cadastrou":
        due = stage_since + timedelta(days=SIGNUP_FOLLOWUP_DAYS)
        if now >= due:
            return Move("ajudar_a_comecar", "Cadastrou e ainda não está pagando: ofereça ajuda para montar o cardápio.", channel=prospect.get("last_channel") or (chans[0] if chans else None), priority=80)
        return Move("esperar", "Cadastrou há pouco.", due=due)

    touches = int(prospect.get("touches") or 0)
    if touches == 0:
        if not chans:
            return Move("achar_contato", "Falta um jeito de falar com o negócio: veja onde ele divulga o contato.", priority=10)
        return Move("primeiro_contato", "Ainda não foi procurado.", channel=chans[0], priority=50)

    last = prospect.get("last_touch_at") or stage_since
    last_channel = prospect.get("last_channel")
    due = last + timedelta(days=max(MIN_DAYS_BETWEEN, wait_days(last_channel)))
    if now < due:
        return Move("esperar", "Já foi chamado: espere a resposta.", due=due)
    options = [c for c in chans if not (c == "whatsapp" and int(prospect.get("whatsapp_touches") or 0) >= MAX_WHATSAPP_TOUCHES)]
    if touches >= MAX_TOUCHES or not options:
        return Move("encerrar", f"Sem resposta depois de {touches} contato{'s' if touches != 1 else ''}: encerrar e não procurar de novo.", priority=20)
    channel = last_channel if last_channel in options else options[0]
    return Move("lembrete", f"Chamado há {_days(now - last)} dias, sem resposta: um lembrete só.", channel=channel, priority=40)


def good_time(kind: str, now: datetime) -> bool:
    """Segunda a sábado, na hora de folga do tipo de negócio."""
    local = now.astimezone(BR)
    start, end = WINDOWS.get(kind) or WINDOWS["outro"]
    return local.weekday() != 6 and start <= local.hour < end


def window_label(kind: str) -> str:
    start, end = WINDOWS.get(kind) or WINDOWS["outro"]
    return f"{start}h às {end}h"


# ---------------------------------------------------------------- o que a tela mostra

def view_of(prospect: dict, now: datetime | None = None, *, suppressed: bool = False) -> dict:
    """A ficha do jeito que a tela precisa: etiquetas em português, canais e o próximo passo."""
    now = now or datetime.now(timezone.utc)
    move = next_move(prospect, now, suppressed=suppressed)
    stage = prospect.get("stage") or "achado"
    since = prospect.get("stage_since") or prospect.get("created_at") or now
    phone = prospect.get("phone")
    return {
        "id": str(prospect["id"]),
        "business_name": prospect.get("business_name"),
        "kind": prospect.get("business_kind"),
        "kind_label": KIND_LABELS.get(prospect.get("business_kind"), "Outro"),
        "city": prospect.get("city"),
        "neighborhood": prospect.get("neighborhood"),
        "contact_person": prospect.get("contact_person"),
        "phone": phone_display(phone),
        "whatsapp": phone if is_mobile(phone) else None,
        "email": prospect.get("email"),
        "instagram": prospect.get("instagram"),
        "site": prospect.get("site"),
        "source": prospect.get("source"),
        "source_label": SOURCE_LABELS.get(prospect.get("source"), ""),
        "source_note": prospect.get("source_note"),
        "note": prospect.get("note"),
        "stage": stage,
        "stage_label": STAGE_LABELS.get(stage, stage),
        "days_in_stage": _days(now - since),
        "touches": int(prospect.get("touches") or 0),
        "channels": channels_of(prospect),
        "last_channel": prospect.get("last_channel"),
        "reply_kind": prospect.get("reply_kind"),
        "move": {
            "action": move.action,
            "reason": move.reason,
            "channel": move.channel,
            "due": move.due.isoformat() if move.due else None,
            "tags": list(move.tags),
        },
        "window": window_label(prospect.get("business_kind") or "outro"),
        "good_time": good_time(prospect.get("business_kind") or "outro", now),
    }


def today_list(prospects: list[dict], now: datetime | None = None, *, touches_today: int = 0, limit: int = TODAY_LIMIT) -> dict:
    """Quem procurar hoje, do mais importante para o menos. Quem respondeu vem primeiro e aparece em qualquer dia."""
    now = now or datetime.now(timezone.utc)
    sunday = now.astimezone(BR).weekday() == 6
    ranked = []
    for prospect in prospects:
        move = next_move(prospect, now, suppressed=bool(prospect.get("suppressed")))
        if not move.ready:
            continue
        if sunday and move.action in {"primeiro_contato", "lembrete"}:
            continue
        since = prospect.get("stage_since") or prospect.get("created_at") or now
        ranked.append((-move.priority, since, str(prospect.get("id")), prospect))
    ranked.sort(key=lambda item: (item[0], item[1], item[2]))
    shown = [view_of(item[3], now, suppressed=bool(item[3].get("suppressed"))) for item in ranked[: max(0, limit)]]
    notes: list[str] = []
    if sunday:
        notes.append("Hoje é domingo: restaurante cheio. Os primeiros contatos e lembretes voltam na segunda; quem respondeu continua aqui.")
    if touches_today >= DAILY_TOUCH_NOTICE:
        notes.append(f"Já são {touches_today} mensagens hoje. Por hoje chega: conversa demais cansa quem recebe.")
    return {"items": shown, "more": max(0, len(ranked) - len(shown)), "touches_today": touches_today, "notes": notes}


def _rate(part: int, whole: int) -> float:
    return round(part / whole, 3) if whole else 0.0


def funnel(prospects: list[dict]) -> dict:
    """Quantos negócios há em cada etapa e qual origem traz quem responde, se cadastra e paga."""
    by_stage = {stage: 0 for stage in STAGES}
    by_source: dict[str, dict] = {}
    for prospect in prospects:
        stage = prospect.get("stage") or "achado"
        by_stage[stage] = by_stage.get(stage, 0) + 1
        source = prospect.get("source") or "outro"
        row = by_source.setdefault(source, {"source": source, "label": SOURCE_LABELS.get(source, source), "total": 0, "chamados": 0, "responderam": 0, "cadastraram": 0, "pagando": 0})
        row["total"] += 1
        touched = int(prospect.get("touches") or 0) > 0 or stage not in ("achado",)
        replied = prospect.get("replied_at") is not None or stage in ("respondeu", "demonstracao", "cadastrou", "pagando")
        signed = stage in ("cadastrou", "pagando")
        if touched:
            row["chamados"] += 1
        if replied:
            row["responderam"] += 1
        if signed:
            row["cadastraram"] += 1
        if stage == "pagando":
            row["pagando"] += 1
    sources = sorted(by_source.values(), key=lambda row: (-row["pagando"], -row["cadastraram"], -row["responderam"], -row["total"], row["source"]))
    for row in sources:
        row["taxa_resposta"] = _rate(row["responderam"], row["chamados"])
        row["taxa_cadastro"] = _rate(row["cadastraram"], row["responderam"])
        row["taxa_pagamento"] = _rate(row["pagando"], row["cadastraram"])
    total = len(prospects)
    labels = [{"stage": stage, "label": STAGE_LABELS[stage], "count": by_stage.get(stage, 0)} for stage in STAGES]
    return {"total": total, "by_stage": labels, "by_source": sources, "paying": by_stage.get("pagando", 0)}


def can_move(frm: str, to: str) -> bool:
    """A etapa anda para frente; quem disse "não quero" não muda mais; quem parou de responder pode voltar se escrever."""
    if frm not in STAGES or to not in STAGES:
        return False
    if frm == to:
        return True
    if frm == "nao_quer":
        return False
    if to == "nao_quer":
        return True
    if frm in ("sem_resposta", "perdido"):
        return to in RANK and RANK[to] >= RANK["respondeu"]
    if to in ("sem_resposta", "perdido"):
        return True
    return RANK[to] > RANK[frm]


# ---------------------------------------------------------------- banco

SQL_COLUMNS = """
id, business_name, business_kind, city, neighborhood, contact_person, phone, email, instagram, site, source,
source_note, stage, touches, whatsapp_touches, last_touch_at, last_channel, replied_at, reply_kind, stage_since,
snooze_until, company_id, note, added_by, created_at, updated_at
"""
SQL_LIST = f"""
SELECT {SQL_COLUMNS},
  (EXISTS (SELECT 1 FROM phone_suppression s WHERE s.phone_hash = p.phone_hash)
   OR EXISTS (SELECT 1 FROM email_suppression e WHERE e.email_hash = p.email_hash)) AS suppressed
FROM sales_prospects p
ORDER BY p.stage_since DESC
LIMIT 1000
"""
SQL_ONE = f"SELECT {SQL_COLUMNS}, phone_hash, email_hash FROM sales_prospects WHERE id = %s FOR UPDATE"
SQL_VIEW_ONE = f"""
SELECT {SQL_COLUMNS},
  (EXISTS (SELECT 1 FROM phone_suppression s WHERE s.phone_hash = p.phone_hash)
   OR EXISTS (SELECT 1 FROM email_suppression e WHERE e.email_hash = p.email_hash)) AS suppressed
FROM sales_prospects p
WHERE p.id = %s
"""
SQL_DUPLICATE = """
SELECT id, business_name, stage FROM sales_prospects
WHERE (%s::text IS NOT NULL AND phone_hash = %s) OR (%s::text IS NOT NULL AND email_hash = %s)
LIMIT 1
"""
SQL_PHONE_SUPPRESSED = "SELECT 1 AS found FROM phone_suppression WHERE phone_hash = %s"
SQL_EMAIL_SUPPRESSED = "SELECT 1 AS found FROM email_suppression WHERE email_hash = %s"
SQL_SUPPRESS_PHONE = "INSERT INTO phone_suppression (phone_hash, reason) VALUES (%s, %s) ON CONFLICT (phone_hash) DO NOTHING"
SQL_INSERT = """
INSERT INTO sales_prospects
  (business_name, business_kind, city, neighborhood, contact_person, phone, phone_hash, email, email_hash, instagram,
   site, source, source_note, note, added_by)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
RETURNING id
"""
SQL_EVENT = "INSERT INTO sales_events (prospect_id, kind, channel, detail, by_user) VALUES (%s, %s, %s, %s, %s)"
SQL_TOUCH = """
UPDATE sales_prospects SET
  touches = touches + 1,
  whatsapp_touches = whatsapp_touches + %s,
  last_touch_at = now(), last_channel = %s,
  stage = CASE WHEN stage = 'achado' THEN 'chamado' ELSE stage END,
  stage_since = CASE WHEN stage = 'achado' THEN now() ELSE stage_since END,
  updated_at = now()
WHERE id = %s
"""
SQL_SET_STAGE = "UPDATE sales_prospects SET stage = %s, stage_since = now(), updated_at = now() WHERE id = %s"
SQL_REPLY = """
UPDATE sales_prospects SET
  replied_at = now(), reply_kind = %s,
  stage = CASE WHEN stage IN ('achado', 'chamado', 'sem_resposta', 'perdido') THEN 'respondeu' ELSE stage END,
  stage_since = CASE WHEN stage IN ('achado', 'chamado', 'sem_resposta', 'perdido') THEN now() ELSE stage_since END,
  snooze_until = NULL, updated_at = now()
WHERE id = %s
"""
SQL_SNOOZE = "UPDATE sales_prospects SET snooze_until = now() + make_interval(days => %s), updated_at = now() WHERE id = %s"
# Quem disse "não quero" perde da ficha tudo o que identifica a pessoa; ficam o nome do negócio e a origem (para a conta
# de qual origem funciona) e as impressões digitais na lista de bloqueio.
SQL_WIPE_CONTACT = """
UPDATE sales_prospects SET
  contact_person = NULL, phone = NULL, phone_hash = NULL, email = NULL, email_hash = NULL, instagram = NULL, site = NULL,
  note = NULL, snooze_until = NULL, stage = 'nao_quer', stage_since = now(), updated_at = now()
WHERE id = %s
"""
SQL_TOUCHES_TODAY = """
SELECT count(*) AS n FROM sales_events
WHERE kind = 'mensagem'
  AND created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
"""
SQL_DELETE = "DELETE FROM sales_prospects WHERE id = %s"
SQL_PURGE = """
DELETE FROM sales_prospects
WHERE stage IN ('sem_resposta', 'perdido', 'nao_quer') AND updated_at < now() - make_interval(months => %s)
"""


def _one(cur, sql, args=()):
    cur.execute(sql, args)
    return cur.fetchone()


def _is_suppressed(cur, phone_hash_value, email_hash_value) -> bool:
    if phone_hash_value and _one(cur, SQL_PHONE_SUPPRESSED, (phone_hash_value,)):
        return True
    return bool(email_hash_value and _one(cur, SQL_EMAIL_SUPPRESSED, (email_hash_value,)))


def add_prospect(cur, data, added_by: str) -> dict:
    """Anota um negócio. Devolve {id, created, reason}: reason é "na_lista_de_bloqueio" (quem saiu não volta por outra
    porta) ou "ja_existe" (o mesmo telefone ou e-mail já está na lista; devolve o que já existia)."""
    clean = clean_prospect(data)
    if _is_suppressed(cur, clean["phone_hash"], clean["email_hash"]):
        return {"id": None, "created": False, "reason": "na_lista_de_bloqueio"}
    existing = _one(cur, SQL_DUPLICATE, (clean["phone_hash"], clean["phone_hash"], clean["email_hash"], clean["email_hash"]))
    if existing:
        return {"id": str(existing["id"]), "created": False, "reason": "ja_existe", "business_name": existing["business_name"], "stage": existing["stage"]}
    row = _one(
        cur,
        SQL_INSERT,
        (
            clean["business_name"], clean["business_kind"], clean["city"], clean["neighborhood"], clean["contact_person"], clean["phone"],
            clean["phone_hash"], clean["email"], clean["email_hash"], clean["instagram"], clean["site"], clean["source"],
            clean["source_note"], clean["note"], added_by,
        ),
    )
    prospect_id = str(row["id"])
    cur.execute(SQL_EVENT, (prospect_id, "criado", None, clean["source"], added_by))
    return {"id": prospect_id, "created": True, "reason": None}


def _load(cur, prospect_id) -> dict:
    row = _one(cur, SQL_ONE, (str(prospect_id),))
    if not row:
        raise ProspectError("Não achei esse negócio.", 404)
    return row


def record_touch(cur, prospect_id, channel: str, by: str, now: datetime | None = None) -> dict:
    """"Já mandei": uma pessoa do Vem falou com o negócio por este canal. Conta, marca a data e começa a espera."""
    prospect = _load(cur, prospect_id)
    suppressed = _is_suppressed(cur, prospect.get("phone_hash"), prospect.get("email_hash"))
    decision = can_touch(prospect, channel, now, suppressed=suppressed)
    if not decision:
        raise ProspectError(TOUCH_REFUSALS.get(decision.reason, "Não dá para contar esse contato agora."), 409)
    cur.execute(SQL_TOUCH, (1 if channel == "whatsapp" else 0, channel, str(prospect_id)))
    cur.execute(SQL_EVENT, (str(prospect_id), "mensagem", channel, None, by))
    return {"ok": True}


TOUCH_REFUSALS = {
    "canal_desconhecido": "Esse canal não existe.",
    "na_lista_de_bloqueio": "Esse contato pediu para não receber mais nada. Não escreva.",
    "negocio_encerrado": "Esse negócio está encerrado. Não procure de novo.",
    "sem_esse_canal": "A ficha não tem esse canal. Complete o telefone, o e-mail ou o Instagram antes.",
    "limite_de_contatos": "Já foram 3 contatos sem resposta. Encerre o negócio em vez de escrever de novo.",
    "limite_de_whatsapp": "Já foram 2 mensagens de WhatsApp sem resposta. Use outro canal ou encerre.",
    "cedo_demais_para_o_proximo": "Cedo demais: espere alguns dias desde o último contato.",
}


def _suppress(cur, prospect: dict, reason: str = "pediu") -> None:
    if prospect.get("phone_hash"):
        cur.execute(SQL_SUPPRESS_PHONE, (prospect["phone_hash"], reason))
    if prospect.get("email"):
        outreach.suppress(cur, prospect["email"], reason)


def record_no(cur, prospect_id, by: str) -> dict:
    """"Não quero": para para sempre. Bloqueia o telefone e o e-mail e apaga o resto da ficha."""
    prospect = _load(cur, prospect_id)
    if prospect["stage"] == "nao_quer":
        return {"ok": True, "already": True}
    _suppress(cur, prospect)
    cur.execute(SQL_WIPE_CONTACT, (str(prospect_id),))
    cur.execute(SQL_EVENT, (str(prospect_id), "nao_quer", None, None, by))
    return {"ok": True, "already": False}


def record_reply(cur, prospect_id, by: str, *, text=None, result: str | None = None) -> dict:
    """O negócio respondeu. Vale o resultado que a pessoa escolheu; sem escolha, o sistema lê o texto e sugere."""
    prospect = _load(cur, prospect_id)
    if prospect["stage"] == "nao_quer":
        raise ProspectError("Esse negócio pediu para não ser procurado. Não registre nova conversa.", 409)
    if result is not None and result not in REPLY_KINDS:
        raise ProspectError("Esse resultado não existe.")
    kind = result or classify_reply(text)
    if kind is None:
        raise ProspectError("Não entendi a resposta. Escolha: quer saber mais, tem dúvida, falar depois ou não quer.")
    if kind == "nao_quer":
        outcome = record_no(cur, prospect_id, by)
        return {"ok": True, "result": "nao_quer", "stage": "nao_quer", **outcome}
    if kind == "adiar":
        cur.execute(SQL_SNOOZE, (SNOOZE_DAYS, str(prospect_id)))
        cur.execute(SQL_EVENT, (str(prospect_id), "adiado", None, f"{SNOOZE_DAYS} dias", by))
        return {"ok": True, "result": "adiar", "stage": prospect["stage"]}
    cur.execute(SQL_REPLY, (kind, str(prospect_id)))
    cur.execute(SQL_EVENT, (str(prospect_id), "resposta", None, kind, by))
    stage = "respondeu" if prospect["stage"] in ("achado", "chamado", "sem_resposta", "perdido") else prospect["stage"]
    return {"ok": True, "result": kind, "stage": stage}


def set_stage(cur, prospect_id, stage: str, by: str) -> dict:
    """Muda a etapa (por exemplo: mostrei a demonstração, ele se cadastrou, ele pagou). Só para frente."""
    if stage not in STAGES:
        raise ProspectError("Essa etapa não existe.")
    if stage == "nao_quer":
        return record_no(cur, prospect_id, by) | {"stage": "nao_quer"}
    prospect = _load(cur, prospect_id)
    if prospect["stage"] == stage:
        return {"ok": True, "stage": stage, "already": True}
    if not can_move(prospect["stage"], stage):
        raise ProspectError("Essa etapa não pode ser mudada assim. Quem disse não fica como não; as outras só andam para a frente.", 409)
    cur.execute(SQL_SET_STAGE, (stage, str(prospect_id)))
    cur.execute(SQL_EVENT, (str(prospect_id), "etapa", None, stage, by))
    return {"ok": True, "stage": stage, "already": False}


def forget_prospect(cur, prospect_id) -> dict:
    """Pedido de apagar os dados (LGPD art. 18): a ficha some; só ficam as impressões digitais na lista de bloqueio,
    para que a pessoa não seja cadastrada de novo por outra porta."""
    prospect = _load(cur, prospect_id)
    _suppress(cur, prospect, "titular")
    cur.execute(SQL_DELETE, (str(prospect_id),))
    return {"ok": True}


def purge_old(cur, months: int = PURGE_MONTHS) -> int:
    """Guarda de 24 meses: negócio encerrado há mais que isso é apagado. Devolve quantos."""
    cur.execute(SQL_PURGE, (int(months),))
    return cur.rowcount


def touches_today(cur) -> int:
    return int((_one(cur, SQL_TOUCHES_TODAY) or {}).get("n") or 0)


# ---------------------------------------------------------------- pedido de contato pelo site (desligado até o GD ligar)

INTEREST_TEXT_VERSION = "contato-2026-10-24"
# O texto que a pessoa vê ao lado da caixa. A impressão digital dele vai junto do aceite (LGPD art. 8º, §2º). O advogado confere.
INTEREST_CONSENT_TEXT = (
    "Autorizo a Vem Tecnologia a falar comigo por WhatsApp, telefone ou e-mail sobre o Vem Comer. "
    "Posso pedir para parar a qualquer momento, e eles param na hora."
)
INTEREST_SOURCE_NOTE = "Pediu contato pelo formulário do site"
INTEREST_THANKS = "Recebemos o seu pedido. Uma pessoa do Vem vai falar com você pelo contato que você deixou."
INTEREST_BLOCKED = "Não conseguimos registrar este contato agora."


def interest_open() -> bool:
    """O formulário público só abre com INTEREST_OPEN=1 (ou true/sim). Sem isso as rotas respondem 404."""
    return (os.getenv("INTEREST_OPEN") or "").strip().lower() in {"1", "true", "sim", "yes"}


def clean_interest(data) -> dict:
    """Confere o que a pessoa mandou pelo formulário. Só entram os campos do formulário; o resto é ignorado."""
    if not isinstance(data, dict):
        raise ProspectError("Mande os dados do formulário.")
    if data.get("consent") is not True:
        raise ProspectError("Para a gente falar com você, marque a caixa que autoriza o contato.")
    if not (data.get("phone") or data.get("email")):
        raise ProspectError("Deixe um WhatsApp ou um e-mail para a gente falar com você.")
    fields = {key: data.get(key) for key in ("business_name", "business_kind", "city", "neighborhood", "contact_person", "phone", "email")}
    fields.update(source="formulario_do_site", source_note=INTEREST_SOURCE_NOTE)
    return clean_prospect(fields)


def add_inbound(cur, data, *, ip: str | None = None, secret: str = "") -> dict:
    """Uma pessoa pediu para falarmos com ela. Entra (ou reabre o que já existe) como "respondeu", no alto da lista de hoje,
    e o aceite vira prova no registro. Quem está na lista de bloqueio não entra por aqui."""
    clean = clean_interest(data)
    if _is_suppressed(cur, clean["phone_hash"], clean["email_hash"]):
        return {"id": None, "created": False, "reason": "na_lista_de_bloqueio"}
    existing = _one(cur, SQL_DUPLICATE, (clean["phone_hash"], clean["phone_hash"], clean["email_hash"], clean["email_hash"]))
    if existing:
        prospect_id, created = str(existing["id"]), False
    else:
        row = _one(
            cur,
            SQL_INSERT,
            (
                clean["business_name"], clean["business_kind"], clean["city"], clean["neighborhood"], clean["contact_person"], clean["phone"],
                clean["phone_hash"], clean["email"], clean["email_hash"], None, None, clean["source"], clean["source_note"], None, "formulario",
            ),
        )
        prospect_id, created = str(row["id"]), True
        cur.execute(SQL_EVENT, (prospect_id, "criado", None, clean["source"], "formulario"))
    cur.execute(SQL_REPLY, ("interessado", prospect_id))
    cur.execute(SQL_EVENT, (prospect_id, "resposta", None, "formulario", "formulario"))
    consent.record_hash(
        cur,
        clean["email_hash"] or clean["phone_hash"],
        kind="contato",
        purpose="contato_comercial",
        granted=True,
        version=INTEREST_TEXT_VERSION,
        channel="site",
        document_sha256=consent.text_sha256(INTEREST_CONSENT_TEXT),
        ip=ip,
        secret=secret,
    )
    return {"id": prospect_id, "created": created, "reason": None if created else "ja_existe"}


def overview(cur, now: datetime | None = None) -> dict:
    """Tudo o que a tela "Vendas" precisa de uma vez: quem procurar hoje, o funil e as origens."""
    now = now or datetime.now(timezone.utc)
    cur.execute(SQL_LIST)
    rows = cur.fetchall()
    done_today = touches_today(cur)
    return {"today": today_list(rows, now, touches_today=done_today), "funnel": funnel(rows)}
