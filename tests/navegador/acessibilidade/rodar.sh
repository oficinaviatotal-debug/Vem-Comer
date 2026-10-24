#!/usr/bin/env bash
# Mede a acessibilidade do visual novo no navegador (leitor automático, contraste, tamanho de dedo e foco, letra grande).
# Não roda no GitHub (precisa de navegador); roda no computador de quem mexe no visual. Veja README.md.
#
# Uso:  tests/navegador/acessibilidade/rodar.sh [tudo|leitor|contraste|dedo|letra]
#       (sem argumento = tudo, uns 6 minutos)
set -uo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"
export PASTA="${PASTA:-${TMPDIR:-/tmp}/vem-comer-conferencia}"
export SAIDA="${SAIDA:-${TMPDIR:-/tmp}/vem-comer-acessibilidade}"
QUAL="${1:-tudo}"
mkdir -p "$SAIDA"

echo "montando a página de conferência em $PASTA ..."
(cd "$RAIZ/frontend" && npx vite build --config vite.preview-novo.config.ts --outDir "$PASTA" --emptyOutDir --logLevel warn) || { echo "não montou a página de conferência"; exit 2; }
if [ ! -d "$AQUI/node_modules/axe-core" ] && [ -z "${FERRAMENTAS:-}" ] && [ ! -d /opt/npm-tools/node_modules/axe-core ]; then
  (cd "$AQUI" && npm install --no-audit --no-fund) || { echo "não instalou as ferramentas"; exit 2; }
fi

FALHOU=0
passo() { echo; echo "== $*"; "$@" || FALHOU=1; }
cd "$AQUI"
case "$QUAL" in
  leitor)   passo env LARGURA=390 node leitor.mjs; passo env LARGURA=320 node leitor.mjs ;;
  contraste) passo env LARGURA=390 node contraste.mjs ;;
  dedo)     passo env LARGURA=390 node dedo-e-foco.mjs; passo env LARGURA=320 node dedo-e-foco.mjs ;;
  letra)    passo env LARGURA=360 FATOR=1.5 node letra-grande.mjs; passo env LARGURA=320 FATOR=1.5 node letra-grande.mjs; passo env LARGURA=360 FATOR=2 node letra-grande.mjs ;;
  tudo)
    passo env LARGURA=390 node leitor.mjs; passo env LARGURA=320 node leitor.mjs
    passo env LARGURA=390 node contraste.mjs
    passo env LARGURA=390 node dedo-e-foco.mjs; passo env LARGURA=320 node dedo-e-foco.mjs
    passo env LARGURA=360 FATOR=1.5 node letra-grande.mjs; passo env LARGURA=320 FATOR=1.5 node letra-grande.mjs; passo env LARGURA=360 FATOR=2 node letra-grande.mjs ;;
  *) echo "uso: rodar.sh [tudo|leitor|contraste|dedo|letra]"; exit 2 ;;
esac
echo
if [ "$FALHOU" = 0 ]; then echo "acessibilidade: tudo dentro do mínimo (resultados em $SAIDA)"; else echo "acessibilidade: tem defeito, veja acima (resultados em $SAIDA)"; fi
exit "$FALHOU"
