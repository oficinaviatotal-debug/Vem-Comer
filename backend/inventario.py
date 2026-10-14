"""Inventário de dados pessoais (LGPD art. 37, registro das operações de tratamento).

A fonte é `inventario_dados.json`, que fica ao lado deste arquivo para seguir junto com o servidor. Daqui saem:
- a página pública de privacidade (o que guardamos, para quê, com quem dividimos, por quanto tempo);
- a conferência (`test_inventario_dados.py`): tabela nova ou campo pessoal novo no banco sem registro derruba o CI.
Sem Flask e sem banco: só lê o arquivo.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

ARQUIVO = Path(__file__).with_name("inventario_dados.json")

PAPEIS = ("controlador", "operador")
REVISOES = ("proposta_da_engenharia", "pendente_do_advogado", "pendente_do_contador", "revisado")
CAMPOS_OBRIGATORIOS = (
    "id", "titular", "papel_da_plataforma", "dados", "campos", "finalidade", "base_legal",
    "compartilha_com", "guarda", "eliminacao", "revisao_juridica",
)
CAMPO_RE = re.compile(r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$")

# Pedaços de nome de coluna que indicam dado de pessoa (o nome da coluna é dividido por "_").
PEDACOS_PESSOAIS = frozenset({
    "name", "nome", "email", "phone", "telefone", "whatsapp", "whats", "address", "endereco", "cpf", "cnpj",
    "cep", "ip", "hash", "comment", "message", "note", "endpoint", "p256dh", "auth", "password", "pix",
    "contact", "reference", "customer", "owner", "description", "response", "url",
})


@lru_cache(maxsize=1)
def carregar() -> dict:
    with ARQUIVO.open(encoding="utf-8") as arquivo:
        return json.load(arquivo)


def campos_inventariados(inventario: dict | None = None) -> set[str]:
    inventario = inventario or carregar()
    return {campo for categoria in inventario["categorias"] for campo in categoria["campos"]}


def tabelas_conhecidas(inventario: dict | None = None) -> set[str]:
    inventario = inventario or carregar()
    com_campos = {campo.split(".")[0] for campo in campos_inventariados(inventario)}
    return com_campos | set(inventario["tabelas_sem_dado_pessoal"])


def parece_pessoal(coluna: str) -> bool:
    return any(pedaco in PEDACOS_PESSOAIS for pedaco in coluna.split("_"))


def problemas_de_forma(inventario: dict | None = None) -> list[str]:
    """Erros de preenchimento do arquivo (sem olhar o banco)."""
    inventario = inventario or carregar()
    erros: list[str] = []
    bases = inventario.get("bases_legais", {})
    ids: set[str] = set()
    vistos: dict[str, str] = {}
    for categoria in inventario.get("categorias", []):
        cid = categoria.get("id", "?")
        for campo in CAMPOS_OBRIGATORIOS:
            if campo not in categoria or categoria[campo] in ("", None):
                erros.append(f"{cid}: falta '{campo}'")
        if cid in ids:
            erros.append(f"{cid}: id repetido")
        ids.add(cid)
        if categoria.get("papel_da_plataforma") not in PAPEIS:
            erros.append(f"{cid}: papel_da_plataforma deve ser controlador ou operador")
        if categoria.get("base_legal") not in bases:
            erros.append(f"{cid}: base_legal desconhecida '{categoria.get('base_legal')}'")
        if categoria.get("revisao_juridica") not in REVISOES:
            erros.append(f"{cid}: revisao_juridica desconhecida '{categoria.get('revisao_juridica')}'")
        if not categoria.get("campos") and not categoria.get("onde"):
            erros.append(f"{cid}: sem campos no banco precisa dizer 'onde' os dados ficam")
        for campo in categoria.get("campos", []):
            if not CAMPO_RE.match(campo):
                erros.append(f"{cid}: campo '{campo}' fora do formato tabela.coluna")
            elif campo in vistos:
                erros.append(f"{campo}: está em '{vistos[campo]}' e em '{cid}'")
            else:
                vistos[campo] = cid
    return erros
