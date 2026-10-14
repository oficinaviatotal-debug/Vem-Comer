"""Conferência do registro de obrigações legais (compliance/obligations.json).

A lei vira regra do sistema assim: cada obrigação tem um controle e uma prova. A prova é um arquivo de
código ou de teste que existe de verdade. Este conferidor roda em toda alteração (GitHub Actions) e
recusa a alteração se o registro disser uma coisa e o código outra, por exemplo:

- obrigação marcada como "implementado" sem arquivo de prova, ou com um teste que não existe mais;
- obrigação "planejado" sem dizer qual é o próximo passo;
- obrigação que depende do advogado, do contador ou do dono sem a pergunta ou a ação escrita;
- fonte oficial citada que não está em sources.json.

Uso:
    python3 compliance/check.py            confere (código de saída 1 se houver erro)
    python3 compliance/check.py --painel   imprime o painel por produto
    python3 compliance/check.py --velhas   lista o que não é reverificado há mais de 90 dias

Só usa a biblioteca padrão do Python.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "compliance")

STATUS = {
    "implementado": "O sistema já cumpre e há teste ou arquivo que prova",
    "parcial": "Cumpre em parte; o que falta está escrito",
    "planejado": "Ainda não feito; o próximo passo está escrito",
    "depende_de_advogado": "Só o advogado resolve; a pergunta está escrita",
    "depende_de_contador": "Só o contador resolve; a pergunta está escrita",
    "depende_do_dono": "Só o dono resolve; a ação está escrita",
    "nao_se_aplica": "Não se aplica hoje; o motivo está escrito",
}
PRODUTOS = {"vem_comer", "vem_trabalhar"}
AREAS = {
    "dados-pessoais", "internet", "consumidor", "trabalho", "propriedade", "acessibilidade",
    "comunicacao", "pagamento", "seguranca", "entrega",
}
CAMPOS = ("id", "area", "norma", "exige", "aplica_a", "controle", "status")
DIAS_VELHA = 90


def carregar(nome: str):
    with open(os.path.join(BASE, nome), encoding="utf-8") as arquivo:
        return json.load(arquivo)


def prova_existe(referencia: str, raiz: str = ROOT) -> str | None:
    """Devolve None se a prova existe, ou o motivo de não existir.

    "arquivo" precisa existir. "arquivo::Nome" também precisa ter o texto Nome dentro do arquivo
    (nome de classe ou de teste), assim apagar ou renomear o teste faz a conferência falhar.
    """
    caminho, _, simbolo = referencia.partition("::")
    completo = os.path.join(raiz, caminho)
    if not os.path.isfile(completo):
        return f"arquivo não existe: {caminho}"
    if simbolo:
        with open(completo, encoding="utf-8", errors="replace") as arquivo:
            if simbolo not in arquivo.read():
                return f"{caminho} não contém {simbolo}"
    return None


def conferir(obrigacoes, fontes, hoje: dt.date | None = None, raiz: str = ROOT):
    """Devolve (erros, avisos). Erro derruba a conferência; aviso só aparece."""
    hoje = hoje or dt.date.today()
    erros: list[str] = []
    avisos: list[str] = []
    ids_fontes = {f.get("id") for f in fontes}
    vistos: set[str] = set()

    for ob in obrigacoes:
        oid = ob.get("id", "?")
        for campo in CAMPOS:
            if not ob.get(campo):
                erros.append(f"{oid}: falta o campo '{campo}'")
        if oid in vistos:
            erros.append(f"{oid}: id repetido")
        vistos.add(oid)

        if ob.get("area") not in AREAS:
            erros.append(f"{oid}: área desconhecida '{ob.get('area')}'")
        status = ob.get("status")
        if status not in STATUS:
            erros.append(f"{oid}: status desconhecido '{status}'")
            continue
        produtos = ob.get("aplica_a") or []
        if not set(produtos) <= PRODUTOS:
            erros.append(f"{oid}: produto desconhecido em aplica_a: {produtos}")

        provas = ob.get("evidencias") or []
        if status == "implementado":
            if not provas:
                erros.append(f"{oid}: 'implementado' sem evidências")
            if ob.get("falta"):
                erros.append(f"{oid}: 'implementado' não pode ter 'falta' (use 'parcial')")
        if status == "parcial":
            if not provas:
                erros.append(f"{oid}: 'parcial' sem evidências do que já existe")
            if not ob.get("falta"):
                erros.append(f"{oid}: 'parcial' precisa dizer o que falta")
        for prova in provas:
            problema = prova_existe(prova, raiz)
            if problema:
                erros.append(f"{oid}: evidência inválida ({problema})")

        if status == "planejado" and not ob.get("proximo_passo"):
            erros.append(f"{oid}: 'planejado' precisa do 'proximo_passo'")
        if status in ("depende_de_advogado", "depende_de_contador") and not ob.get("pergunta"):
            erros.append(f"{oid}: '{status}' precisa da 'pergunta'")
        if status == "depende_do_dono" and not ob.get("acao"):
            erros.append(f"{oid}: 'depende_do_dono' precisa da 'acao'")
        if status == "nao_se_aplica" and not ob.get("motivo"):
            erros.append(f"{oid}: 'nao_se_aplica' precisa do 'motivo'")

        for fonte in ob.get("fontes") or []:
            if fonte not in ids_fontes:
                erros.append(f"{oid}: fonte '{fonte}' não está em sources.json")

        verificado = ob.get("verificado_em")
        if verificado:
            try:
                data = dt.date.fromisoformat(verificado)
            except ValueError:
                erros.append(f"{oid}: verificado_em inválido '{verificado}'")
            else:
                if data > hoje:
                    erros.append(f"{oid}: verificado_em no futuro")
                elif (hoje - data).days > DIAS_VELHA:
                    avisos.append(f"{oid}: não é reverificada há {(hoje - data).days} dias")
        elif not ob.get("a_verificar"):
            erros.append(f"{oid}: sem verificado_em (se ainda não foi conferida na fonte, marque a_verificar)")
        elif ob.get("a_verificar"):
            avisos.append(f"{oid}: ainda não conferida na fonte oficial")

    for fonte in fontes:
        for campo in ("id", "nome", "url", "modo"):
            if not fonte.get(campo):
                erros.append(f"fonte {fonte.get('id', '?')}: falta o campo '{campo}'")
        if fonte.get("modo") not in ("auto", "manual"):
            erros.append(f"fonte {fonte.get('id', '?')}: modo deve ser 'auto' ou 'manual'")
        if fonte.get("modo") == "auto" and not fonte.get("ancoras"):
            erros.append(f"fonte {fonte.get('id', '?')}: modo 'auto' precisa de âncoras")
        if fonte.get("modo") == "manual" and not fonte.get("resumo_verificado"):
            erros.append(f"fonte {fonte.get('id', '?')}: modo 'manual' precisa do resumo_verificado")
        for oid in fonte.get("obrigacoes") or []:
            if oid not in vistos:
                erros.append(f"fonte {fonte.get('id', '?')}: obrigação '{oid}' não existe")
    return erros, avisos


def painel(obrigacoes) -> str:
    linhas = []
    for produto in sorted(PRODUTOS):
        itens = [o for o in obrigacoes if produto in o.get("aplica_a", [])]
        contagem: dict[str, int] = {}
        for item in itens:
            contagem[item["status"]] = contagem.get(item["status"], 0) + 1
        linhas.append(f"{produto}: {len(itens)} obrigações")
        for status in STATUS:
            if contagem.get(status):
                linhas.append(f"  {status}: {contagem[status]}")
    return "\n".join(linhas)


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    obrigacoes = carregar("obligations.json")
    fontes = carregar("sources.json")
    erros, avisos = conferir(obrigacoes, fontes)
    if "--painel" in argv:
        print(painel(obrigacoes))
        return 0
    if "--velhas" in argv:
        print("\n".join(a for a in avisos if "reverificada" in a) or "nenhuma")
        return 0
    for aviso in avisos:
        print(f"AVISO  {aviso}")
    for erro in erros:
        print(f"ERRO   {erro}", file=sys.stderr)
    if erros:
        print(f"\n{len(erros)} erro(s) no registro de obrigações.", file=sys.stderr)
        return 1
    print(f"Registro de obrigações em ordem: {len(obrigacoes)} obrigações, {len(fontes)} fontes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
