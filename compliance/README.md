# Conformidade como código (o "agente da lei")

A lei vira regra do sistema em três peças. Tudo aqui usa só a biblioteca padrão do Python.

1. **Registro das obrigações** (`obligations.json`): cada obrigação legal que vale para o Vem Comer ou para o
   Vem Trabalhar, em português simples, com o controle que a cumpre, o estado (`implementado`, `parcial`,
   `planejado`, `depende_de_advogado`, `depende_de_contador`, `depende_do_dono`, `nao_se_aplica`) e a **prova**:
   um arquivo ou teste que existe de verdade.
2. **Conferidor** (`check.py`): roda em toda alteração (`.github/workflows/compliance.yml`) e recusa a alteração
   se o registro disser uma coisa e o código outra. Obrigação "implementado" sem prova, prova apagada ou renomeada,
   "planejado" sem próximo passo, "depende do advogado" sem a pergunta escrita: tudo isso derruba a conferência.
3. **Vigia da lei** (`legal_watch.py` + `.github/workflows/legal-watch.yml`): toda segunda-feira lê as páginas
   oficiais listadas em `sources.json`, confere que as frases-chave (âncoras) continuam lá, compara com a semana
   anterior e abre um aviso no GitHub com o relatório e as obrigações que podem ter mudado. Com o segredo
   `ANTHROPIC_API_KEY`, a IA lê o relatório e propõe a correção da engenharia. A IA propõe; a correção entra como
   alteração com teste e passa pelo conferidor.

O vigia **nunca** deixa o fluxo vermelho por mudança de lei: o atualizador automático do servidor trava quando o último
commit do `main` tem conferência vermelha. A mudança vira aviso (issue), não falha de fluxo.

## Comandos

```
python3 compliance/check.py            # confere o registro (código de saída 1 se houver erro)
python3 compliance/check.py --painel   # quantas obrigações em cada estado, por produto
python3 compliance/check.py --velhas   # o que não é reverificado há mais de 90 dias
python3 compliance/legal_watch.py --sem-gravar --saida relatorio.md   # lê as fontes agora
python3 -B -m unittest discover -s compliance -p 'test_*.py'          # testes
```

## Como acrescentar uma obrigação

Copie uma entrada de `obligations.json`, troque o `id` e escreva `exige` e `controle` em português simples.
Escolha o `status` e preencha o campo que ele pede (`evidencias`, `falta`, `proximo_passo`, `pergunta`, `acao` ou
`motivo`). Se a obrigação vem de uma página oficial, coloque a fonte em `sources.json` (modo `auto`, com 1 a 3
frases-chave copiadas do texto oficial) e liste o `id` em `fontes`. Marque `a_verificar: true` enquanto ninguém
tiver conferido na fonte.

## O que não está aqui

Pareceres jurídicos. O registro guarda a interpretação para a engenharia e a pergunta para o advogado ou o contador;
quem decide o que a lei exige é o profissional. Fontes de terceiros (PDF, artigo de escritório) ficam em modo
`manual`, com o resumo conferido e a data.
