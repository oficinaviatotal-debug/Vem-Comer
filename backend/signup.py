"""Cadastro do restaurante pela internet: regras puras e o SQL.

O dono se cadastra sozinho (nome do restaurante, nome dele, e-mail, senha, aceite dos termos) e já
entra no painel. Nada aqui fala com o banco: a rota em app.py usa as regras e os comandos SQL abaixo.

O que protege a porta (ninguém precisa de e-mail confirmado para isto funcionar):
- só abre quando o administrador liga SIGNUP_OPEN=1 no .env (veja deploy/vps/abrir-cadastro.sh);
- limite por endereço de rede (por hora e por dia) e limite geral por dia (contado no banco);
- campo escondido (honeypot) que só robô preenche;
- e-mail único em todo o sistema, senha que não seja das mais comuns;
- o aceite dos termos fica gravado com a versão dos termos e a hora.

Ainda NÃO existe: confirmação de e-mail e "esqueci a senha" (precisam de um serviço de e-mail), nem
CAPTCHA. Está em docs/cadastro-do-restaurante.md como próximos passos.
"""

from __future__ import annotations

import os
import re
import secrets
import threading
import time
import unicodedata
from collections import deque

# Versão do texto dos termos de uso que a tela mostra. Se o texto mudar, mude aqui e na tela
# (frontend/src/signup/signupLogic.ts, TERMS_VERSION). A rota recusa um cadastro feito com versão velha.
TERMS_VERSION = "2026-10-06"

NAME_MIN = 2
RESTAURANT_NAME_MAX = 120
OWNER_NAME_MAX = 100
EMAIL_MAX = 200
PASSWORD_MIN = 8
PASSWORD_MAX = 128

# Endereços que o sistema já usa ou que confundiriam: nunca viram o endereço de um restaurante.
RESERVED_SLUGS = frozenset(
    {
        "admin", "api", "app", "assets", "media", "painel", "entrar", "login", "logout", "sair",
        "cadastro", "cadastrar", "termos", "privacidade", "suporte", "ajuda", "contato", "www",
        "vem-comer", "vemcomer", "vem-trabalhar", "vemtrabalhar", "vem-estudar", "vemestudar",
        "teste", "test", "static", "public", "health", "saude", "restaurante", "restaurantes",
    }
)

# As senhas mais comuns em português e inglês (todas já com 8 ou mais letras: as menores o tamanho barra).
COMMON_PASSWORDS = frozenset(
    {
        "12345678", "123456789", "1234567890", "11111111", "00000000", "87654321", "12341234",
        "senha123", "senha1234", "senha@123", "mudar123", "brasil123", "brasil2026", "password",
        "password1", "password123", "qwertyui", "qwerty123", "abcd1234", "abc12345", "iloveyou",
        "restaurante", "restaurante123", "vemcomer", "vemcomer123", "admin123", "admin1234",
    }
)

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# DDDs que existem no Brasil.
_DDDS = frozenset(
    {
        11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
        71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97,
        98, 99,
    }
)

# ---------------------------------------------------------------------------- SQL (usado pela rota)

SQL_COUNT_TODAY = "SELECT count(*) AS n FROM companies WHERE created_at > NOW() - INTERVAL '1 day';"

SQL_EMAIL_TAKEN = "SELECT 1 AS taken FROM users WHERE lower(email) = %s LIMIT 1;"

# ON CONFLICT: se o endereço curto já existe, não dá erro; volta vazio e a rota tenta o próximo.
SQL_INSERT_COMPANY = """
INSERT INTO companies (name, slug, owner_phone, terms_version, terms_accepted_at, signup_source)
VALUES (%s, %s, %s, %s, NOW(), 'web')
ON CONFLICT (slug) DO NOTHING
RETURNING id, name, slug;
"""

SQL_INSERT_OWNER = """
INSERT INTO users (company_id, name, email, password_hash, role)
VALUES (%s, %s, %s, %s, 'OWNER')
RETURNING id, name, email, role;
"""


class SignupError(Exception):
    """Falha com mensagem pronta para o dono, o código HTTP e o campo da tela que tem o problema."""

    def __init__(self, message: str, status: int = 400, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.field = field


# ---------------------------------------------------------------------------- liga/desliga e limites

def is_open() -> bool:
    """O cadastro público só abre com SIGNUP_OPEN=1 (ou true/sim). Sem isso a rota responde 404."""
    return (os.getenv("SIGNUP_OPEN") or "").strip().lower() in {"1", "true", "sim", "yes"}


def _env_int(name: str, default: int) -> int:
    try:
        value = int((os.getenv(name) or "").strip())
    except ValueError:
        return default
    return value if value > 0 else default


def max_per_day() -> int:
    """Teto de cadastros novos nas últimas 24 horas, no servidor inteiro."""
    return _env_int("SIGNUP_MAX_PER_DAY", 200)


class SignupLimiter:
    """Cadastros por endereço de rede. Em memória (um processo só); zera ao reiniciar.

    Vários celulares na rede móvel dividem o mesmo endereço (CGNAT), por isso os limites não são
    apertados: servem para frear robô, não gente. Mudam por variável de ambiente.
    """

    def __init__(self, per_hour: int | None = None, per_day: int | None = None, clock=time.time):
        self.per_hour = per_hour or _env_int("SIGNUP_PER_IP_PER_HOUR", 8)
        self.per_day = per_day or _env_int("SIGNUP_PER_IP_PER_DAY", 20)
        self._clock = clock
        self._lock = threading.Lock()
        self._by_ip: dict[str, deque] = {}

    def check(self, ip: str) -> None:
        """Conta uma tentativa ou levanta SignupError(429)."""
        now = self._clock()
        with self._lock:
            if len(self._by_ip) > 5000:
                # não deixa a memória crescer com milhares de endereços diferentes
                for key in [k for k, v in self._by_ip.items() if not v or now - v[-1] > 86400]:
                    del self._by_ip[key]
            tries = self._by_ip.setdefault(str(ip), deque())
            while tries and now - tries[0] > 86400:
                tries.popleft()
            last_hour = sum(1 for t in tries if now - t <= 3600)
            if last_hour >= self.per_hour or len(tries) >= self.per_day:
                raise SignupError(
                    "Muitas tentativas de cadastro desta rede. Espere um pouco e tente de novo.", 429
                )
            tries.append(now)


# ---------------------------------------------------------------------------- limpeza e validação

def _clean_text(value) -> str:
    """Texto sem caracteres de controle, espaços das pontas e espaços repetidos (teclado de celular)."""
    if not isinstance(value, str):
        return ""
    value = "".join(" " if ch.isspace() else ch for ch in value)
    value = "".join(ch for ch in value if not unicodedata.category(ch).startswith("C"))
    return " ".join(value.split())


def slugify(text: str) -> str:
    """'Saiteria do João' -> 'saiteria-do-joao'. Só letras minúsculas sem acento, números e hífen."""
    text = unicodedata.normalize("NFKD", text or "")
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:40].strip("-")


def slug_candidates(name: str, token=lambda: secrets.token_hex(2)):
    """Endereços curtos para tentar, do melhor para o menos bonito: nome, nome-2 ... nome-9, nome-a1b2."""
    base = slugify(name)
    if not base:
        base = "meu-restaurante"
    elif len(base) < 3 or base in RESERVED_SLUGS:
        base = f"{base}-restaurante"
    yield base
    for number in range(2, 10):
        yield f"{base}-{number}"
    for _ in range(3):
        yield f"{base}-{token()}"


def normalize_phone(raw) -> str | None:
    """WhatsApp do dono em dígitos com DDI ('5584999999999'). None se não for um telefone brasileiro."""
    digits = re.sub(r"\D", "", raw if isinstance(raw, str) else "")
    if digits.startswith("55") and len(digits) in (12, 13):
        digits = digits[2:]
    if len(digits) not in (10, 11) or int(digits[:2]) not in _DDDS:
        return None
    if len(digits) == 11 and digits[2] != "9":
        return None
    if len(digits) == 10 and digits[2] in "01":
        return None
    return "55" + digits


def validate(data: dict) -> dict:
    """Confere o que o dono mandou. Devolve os dados limpos ou levanta SignupError(400, campo)."""
    restaurant = _clean_text(data.get("restaurant_name"))
    if len(restaurant) < NAME_MIN or len(restaurant) > RESTAURANT_NAME_MAX:
        raise SignupError("Digite o nome do restaurante.", 400, "restaurant_name")

    owner = _clean_text(data.get("owner_name"))
    if len(owner) < NAME_MIN or len(owner) > OWNER_NAME_MAX:
        raise SignupError("Digite o seu nome.", 400, "owner_name")

    email = _clean_text(data.get("email")).replace(" ", "").lower()
    if not _EMAIL_RE.match(email) or len(email) > EMAIL_MAX:
        raise SignupError("Esse e-mail não parece certo. Exemplo: nome@gmail.com", 400, "email")

    phone = None
    raw_phone = data.get("phone")
    if isinstance(raw_phone, str) and raw_phone.strip():
        phone = normalize_phone(raw_phone)
        if phone is None:
            raise SignupError("Esse WhatsApp não parece certo. Digite com o DDD.", 400, "phone")

    password = data.get("password")
    if not isinstance(password, str) or len(password) < PASSWORD_MIN:
        raise SignupError("A senha precisa ter pelo menos 8 letras ou números.", 400, "password")
    if len(password) > PASSWORD_MAX:
        raise SignupError("A senha é grande demais. Use até 128 caracteres.", 400, "password")
    if password.lower() in COMMON_PASSWORDS or len(set(password)) == 1 or password.lower() == email:
        raise SignupError("Essa senha é fácil de adivinhar. Escolha outra.", 400, "password")

    if data.get("accept_terms") is not True:
        raise SignupError("Para continuar, aceite os termos de uso.", 400, "accept_terms")
    if data.get("terms_version") != TERMS_VERSION:
        raise SignupError(
            "Os termos de uso foram atualizados. Recarregue a página e leia de novo.", 409, "accept_terms"
        )

    return {
        "restaurant_name": restaurant,
        "owner_name": owner,
        "email": email,
        "phone": phone,
        "password": password,
    }
