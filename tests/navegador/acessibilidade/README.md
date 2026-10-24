# Medir a acessibilidade do visual novo (no navegador)

Quatro medições que rodam sobre as **mais de 160 telas da página de conferência** (`frontend/preview-novo.html`, dados de exemplo, sem servidor). Não rodam no GitHub (precisam de navegador); o que elas consertaram fica guardado em `tests/novo/acessibilidade.test.mjs`, que roda no GitHub.

| Medição | O que mede | Mínimo |
| --- | --- | --- |
| `leitor.mjs` | leitor automático axe-core (WCAG 2.2 AA e boas práticas): nomes de botões, papéis, listas, pontos de referência, ordem de títulos | 0 defeitos |
| `contraste.mjs` | contraste **de verdade**, fotografando o fundo atrás de cada tipo de texto (pega degradê e relevo 3D, que o leitor não calcula) | 4,5:1 (3:1 para letra grande) |
| `dedo-e-foco.mjs` | tamanho de toque e contorno de foco ao andar com a tecla Tab | 44 × 44 px; contorno de 2 px |
| `letra-grande.mjs` | letras ×1,5 e ×2 (quem aumentou o texto do celular): nada rola de lado nem sai cortado | 0 telas |

## Como rodar

```bash
tests/navegador/acessibilidade/rodar.sh          # tudo (uns 6 minutos)
tests/navegador/acessibilidade/rodar.sh leitor   # só uma medição: leitor | contraste | dedo | letra
```

O `rodar.sh` monta a página de conferência numa pasta temporária, instala as ferramentas se faltarem (`npm install` aqui dentro: axe-core, playwright, pngjs; o navegador vem de `npx playwright install chromium`) e roda cada medição em dois ou três tamanhos de celular (390, 360 e 320 px). Sai com erro se achar defeito.

Variáveis, quando precisar: `ROTAS="loja sacola"` (só algumas telas), `LARGURA`, `FATOR` (letra), `CHROMIUM` (caminho de um Chrome), `FERRAMENTAS` (pasta `node_modules` que já tenha as ferramentas), `PASTA` (onde montar a conferência), `SAIDA` (onde gravar os resultados em JSON).

A lista de telas vem de `frontend/src/novo/preview.tsx`: tela nova que entra na página de conferência entra sozinha na medição.

## O que cada defeito achado ensinou

Está em `docs/acessibilidade.md` (o que foi medido, o que foi consertado e o que só um celular de verdade confere).
