"""Vigia das fontes oficiais da lei.

Roda toda semana (GitHub Actions, .github/workflows/legal-watch.yml) e também pode ser rodada à mão.
Para cada fonte "auto" de compliance/sources.json:

1. baixa a página oficial e tira o texto;
2. confere que as "âncoras" (frases-chave das regras que o sistema cumpre) continuam lá;
3. compara com o que foi visto da última vez (hash da página e o trecho em volta de cada âncora);
4. escreve um relatório com as obrigações do registro que podem ter mudado.

Se algo mudou, o fluxo abre um aviso no GitHub com o relatório. Se houver a chave da IA configurada,
a IA lê o relatório e propõe a correção da engenharia no mesmo aviso. A correção sempre vira uma
alteração com testes (o conferidor compliance/check.py não deixa o registro mentir).

Fontes "manual" (PDF, páginas de órgãos que mudam o layout) não são lidas aqui: o resumo conferido
fica no registro e a rotina com a IA compara à mão.

Códigos de saída: 0 nada mudou; 3 algo mudou ou uma âncora sumiu; 2 nenhuma fonte pôde ser lida.
Só usa a biblioteca padrão do Python.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import html.parser
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
TIMEOUT = 40
JANELA_ANTES = 80
JANELA_DEPOIS = 900
USER_AGENT = "VemTecnologia-VigiaLegal/1.0 (+conformidade; leitura semanal de textos oficiais)"
API_URL = os.getenv("ANTHROPIC_API_URL", "https://api.anthropic.com/v1/messages")
API_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-sonnet-5-5"


# ---------------------------------------------------------------- texto

class _Texto(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.partes: list[str] = []
        self._ignorar = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self._ignorar += 1
        elif tag in ("p", "br", "div", "li", "tr", "h1", "h2", "h3", "h4"):
            self.partes.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self._ignorar:
            self._ignorar -= 1

    def handle_data(self, data):
        if not self._ignorar:
            self.partes.append(data)


def decodificar(corpo: bytes, content_type: str = "") -> str:
    """A maioria das páginas do Planalto é windows-1252; outras são UTF-8."""
    achado = re.search(r"charset=([\w-]+)", content_type or "", re.I)
    if not achado:
        achado = re.search(rb"charset=[\"']?([\w-]+)", corpo[:4000], re.I)
        nome = achado.group(1).decode("ascii", "ignore") if achado else ""
    else:
        nome = achado.group(1)
    for tentativa in (nome, "utf-8", "cp1252", "latin-1"):
        if not tentativa:
            continue
        try:
            return corpo.decode(tentativa)
        except (LookupError, UnicodeDecodeError):
            continue
    return corpo.decode("latin-1", "replace")


def texto_da_pagina(corpo: bytes, content_type: str = "") -> str:
    leitor = _Texto()
    leitor.feed(decodificar(corpo, content_type))
    return " ".join("".join(leitor.partes).split())


def normalizar(texto: str) -> str:
    """Sem acento, minúsculo, espaços simples: âncora e página são comparadas do mesmo jeito."""
    sem = unicodedata.normalize("NFKD", texto or "")
    sem = "".join(c for c in sem if not unicodedata.combining(c))
    sem = sem.replace(" ", " ")
    return " ".join(sem.lower().split())


def trecho_em_volta(texto_norm: str, ancora_norm: str) -> str | None:
    posicao = texto_norm.find(ancora_norm)
    if posicao < 0:
        return None
    inicio = max(0, posicao - JANELA_ANTES)
    return texto_norm[inicio: posicao + len(ancora_norm) + JANELA_DEPOIS]


def impressao(texto_norm: str) -> str:
    return hashlib.sha256(texto_norm.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- vigia

def examinar(fonte: dict, texto_norm: str, anterior: dict | None) -> dict:
    """Compara a página de agora com a da última vez."""
    ancoras = fonte.get("ancoras", [])
    trechos: dict[str, str] = {}
    faltando: list[str] = []
    for ancora in ancoras:
        trecho = trecho_em_volta(texto_norm, normalizar(ancora))
        if trecho is None:
            faltando.append(ancora)
        else:
            trechos[ancora] = trecho
    resultado = {
        "id": fonte["id"],
        "ancoras_faltando": faltando,
        "sha256": impressao(texto_norm),
        "tamanho": len(texto_norm),
        "trechos": trechos,
        "trechos_mudados": [],
    }
    if anterior is None:
        resultado["situacao"] = "ancora_perdida" if faltando else "novo"
        return resultado
    for ancora, trecho in trechos.items():
        antes = (anterior.get("trechos") or {}).get(ancora)
        if antes is not None and antes != trecho:
            resultado["trechos_mudados"].append({"ancora": ancora, "antes": antes, "depois": trecho})
    if faltando:
        resultado["situacao"] = "ancora_perdida"
    elif resultado["trechos_mudados"]:
        resultado["situacao"] = "mudou"
    elif anterior.get("sha256") != resultado["sha256"]:
        resultado["situacao"] = "mudou_fora_das_ancoras"
    else:
        resultado["situacao"] = "igual"
    return resultado


def baixar(url: str) -> tuple[bytes, str]:
    pedido = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(pedido, timeout=TIMEOUT) as resposta:  # noqa: S310 (URLs vêm do registro)
        return resposta.read(), resposta.headers.get("Content-Type", "")


def vigiar(fontes: list[dict], estado: dict, buscar=baixar, hoje: dt.date | None = None):
    """Devolve (resultados, novo_estado). `buscar` pode ser trocada nos testes."""
    hoje = hoje or dt.date.today()
    resultados = []
    novo = dict(estado)
    for fonte in fontes:
        if fonte.get("modo") != "auto":
            continue
        try:
            corpo, tipo = buscar(fonte["url"])
            texto = normalizar(texto_da_pagina(corpo, tipo))
            if len(texto) < 500:
                raise ValueError("página curta demais para ser o texto da lei")
        except (urllib.error.URLError, OSError, ValueError) as erro:
            resultados.append({"id": fonte["id"], "situacao": "erro", "erro": str(erro)[:200]})
            continue
        resultado = examinar(fonte, texto, estado.get(fonte["id"]))
        resultados.append(resultado)
        if resultado["situacao"] != "ancora_perdida" or fonte["id"] not in estado:
            novo[fonte["id"]] = {
                "sha256": resultado["sha256"],
                "tamanho": resultado["tamanho"],
                "visto_em": hoje.isoformat(),
                "trechos": resultado["trechos"],
            }
        else:
            novo[fonte["id"]] = {**estado[fonte["id"]], "visto_em": hoje.isoformat()}
    return resultados, novo


def precisa_de_atencao(resultados: list[dict]) -> bool:
    return any(r["situacao"] in ("mudou", "mudou_fora_das_ancoras", "ancora_perdida") for r in resultados)


def so_erros(resultados: list[dict]) -> bool:
    return bool(resultados) and all(r["situacao"] == "erro" for r in resultados)


# ---------------------------------------------------------------- relatório

ROTULOS = {
    "mudou": "MUDOU o trecho de uma regra que o sistema cumpre",
    "mudou_fora_das_ancoras": "mudou em outra parte da página (pode ser alteração ou só ruído)",
    "ancora_perdida": "uma frase-chave sumiu (a regra pode ter mudado de lugar ou de texto)",
    "erro": "não foi possível ler a página agora",
}


def relatorio(resultados: list[dict], fontes: list[dict], obrigacoes: list[dict], hoje: dt.date | None = None) -> str:
    hoje = hoje or dt.date.today()
    por_fonte = {f["id"]: f for f in fontes}
    por_id = {o["id"]: o for o in obrigacoes}
    linhas = [f"# Vigia legal: relatório de {hoje.strftime('%d/%m/%Y')}", ""]
    atencao = [r for r in resultados if r["situacao"] in ROTULOS]
    if not atencao:
        linhas.append("Nenhuma mudança nas fontes lidas.")
        return "\n".join(linhas) + "\n"
    for r in atencao:
        fonte = por_fonte.get(r["id"], {"nome": r["id"], "url": ""})
        linhas += [f"## {fonte['nome']}", f"Situação: {ROTULOS[r['situacao']]}", f"Fonte: {fonte.get('url', '')}", ""]
        if r.get("erro"):
            linhas += [f"Erro: {r['erro']}", ""]
        for ancora in r.get("ancoras_faltando", []):
            linhas.append(f"- Frase-chave que não foi achada: “{ancora}”")
        for mudanca in r.get("trechos_mudados", []):
            linhas += [
                f"- Trecho ao redor de “{mudanca['ancora']}” mudou.",
                f"  - Antes: {mudanca['antes'][:600]}",
                f"  - Depois: {mudanca['depois'][:600]}",
            ]
        afetadas = fonte.get("obrigacoes", [])
        if afetadas:
            linhas += ["", "Obrigações do registro que dependem desta fonte:"]
            for oid in afetadas:
                ob = por_id.get(oid)
                if ob:
                    linhas.append(f"- {oid} ({ob['status']}): {ob['exige']}")
        linhas.append("")
    linhas += [
        "## O que fazer",
        "1. Ler o trecho novo na fonte oficial e decidir se a obrigação aumentou, diminuiu ou continua igual.",
        "2. Ajustar compliance/obligations.json (texto, status, verificado_em) e, se a regra mudou, o código e os testes.",
        "3. Rodar `python3 compliance/check.py` e a suíte do backend. Nenhuma obrigação pode ficar 'implementado' sem prova.",
        "4. Se envolver cobrança, contrato, dado sensível ou prazo, registrar a pergunta ao advogado.",
    ]
    return "\n".join(linhas) + "\n"


# ---------------------------------------------------------------- IA (opcional)

PROMPT_IA = """Você é o revisor de conformidade legal do Vem Comer e do Vem Trabalhar (sistemas brasileiros).
Abaixo está um relatório do que mudou nas fontes oficiais da lei e as obrigações do nosso registro que dependem delas.
Para cada mudança:
1. diga em uma frase se a obrigação AUMENTOU, DIMINUIU ou continua IGUAL (ou se não dá para saber só pelo trecho);
2. liste o que precisa mudar na engenharia (tabela, tela, texto, teste, prazo), no menor passo possível;
3. diga se precisa de pergunta ao advogado ou ao contador (e escreva a pergunta).
Não invente artigos. Se o trecho não bastar, peça para abrir a fonte. Responda em português simples, com tópicos curtos.

"""


def analisar_com_ia(texto_relatorio: str, chave: str, enviar=None) -> str | None:
    """Pede à IA a leitura do relatório. Devolve o texto, ou None se não deu certo (nunca derruba o fluxo)."""
    corpo = {
        "model": (os.getenv("VEM_IA_MODEL") or DEFAULT_MODEL).strip(),
        "max_tokens": 3000,
        "messages": [{"role": "user", "content": PROMPT_IA + texto_relatorio[:60000]}],
    }
    try:
        resposta = (enviar or _enviar_api)(corpo, chave)
        partes = [b.get("text", "") for b in resposta.get("content", []) if b.get("type") == "text"]
        texto = "\n".join(p for p in partes if p).strip()
        return texto or None
    except Exception:  # noqa: BLE001 (a análise é um extra: falhar não pode esconder o relatório)
        return None


def _enviar_api(corpo: dict, chave: str) -> dict:
    pedido = urllib.request.Request(
        API_URL,
        data=json.dumps(corpo).encode("utf-8"),
        method="POST",
        headers={"content-type": "application/json", "authorization": f"Bearer {chave}", "anthropic-version": API_VERSION},
    )
    with urllib.request.urlopen(pedido, timeout=120) as resposta:  # noqa: S310
        return json.loads(resposta.read().decode("utf-8"))


# ---------------------------------------------------------------- linha de comando

def _ler(caminho: str, padrao):
    try:
        with open(caminho, encoding="utf-8") as arquivo:
            return json.load(arquivo)
    except FileNotFoundError:
        return padrao


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv

    def opcao(nome, padrao=None):
        return argv[argv.index(nome) + 1] if nome in argv else padrao

    fontes = _ler(os.path.join(BASE, "sources.json"), [])
    obrigacoes = _ler(os.path.join(BASE, "obligations.json"), [])
    caminho_estado = opcao("--estado", os.path.join(BASE, "watch_state.json"))
    estado = _ler(caminho_estado, {})
    resultados, novo = vigiar(fontes, estado, buscar=baixar)
    texto = relatorio(resultados, fontes, obrigacoes)
    if "--ia" in argv and precisa_de_atencao(resultados) and os.getenv("ANTHROPIC_API_KEY"):
        analise = analisar_com_ia(texto, os.environ["ANTHROPIC_API_KEY"])
        if analise:
            texto += "\n## Leitura da IA (precisa de conferência humana)\n\n" + analise + "\n"
    saida = opcao("--saida")
    if saida:
        with open(saida, "w", encoding="utf-8") as arquivo:
            arquivo.write(texto)
    else:
        print(texto)
    if "--sem-gravar" not in argv:
        with open(caminho_estado, "w", encoding="utf-8") as arquivo:
            json.dump(novo, arquivo, ensure_ascii=False, indent=1, sort_keys=True)
    if so_erros(resultados):
        return 2
    return 3 if precisa_de_atencao(resultados) else 0


if __name__ == "__main__":
    sys.exit(main())
