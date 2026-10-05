# Sistema visual do Vem Comer

Base para o Vem Comer, o Vem Trabalhar e os próximos produtos. Tudo mora em
`frontend/src/styles.css` (tokens e fontes), `frontend/src/ui.css` (peças
reutilizáveis) e `frontend/src/admin.css` (painel do dono).

## Ideia central: a comanda

Quem usa o produto está num restaurante. A tela imita o papel que já existe ali:
a **comanda** do garçom. Ficha branca com borda inferior serrilhada, linha
tracejada separando o cabeçalho, itens ligados ao preço por pontinhos e o número
da mesa em destaque. É o único elemento "de personalidade"; o resto é quieto.

Onde usar: pedidos do painel, carrinho, acompanhamento do pedido, resumo.
Classes: `.comanda-wrap` (sombra) + `.comanda` (ficha), `.leader-row` + `.leader`
(pontinhos), `.money` (valores).

## Cores

| Nome | Valor | Uso |
| --- | --- | --- |
| Folha | `#123B2B` | texto de destaque, superfícies escuras |
| Mata | `#1E6B3C` | verde da marca: estados positivos, "pronto" |
| Brasa | `#C2410C` | botão de ação principal (texto branco, 5,2:1) |
| Brasa viva | `#FF6F00` | laranja do logo: **só realce** (contorno do guia, foco, aba ativa), nunca texto |
| Papel | `#F4F5EF` | fundo da página |
| Comanda | `#FFFFFF` | fichas e formulários |
| Sol | `#FFC83A` | atenção: "Aguardando", mesa ocupada, contador |
| Tinta | `#1B2A22` | texto |
| Névoa | `#5D6B63` | texto secundário |
| Alerta | `#B42318` | erro e ação destrutiva |

Regra: laranja só onde está a próxima ação. Os contrastes das combinações usadas
são verificados por `tests/ui/tokens.test.mjs` (mínimo 4,5:1).

## Tipografia

- **Bricolage Grotesque Bold**: títulos, número da mesa, preços.
- **Instrument Sans Regular e Bold**: todo o resto.

Arquivos em `frontend/public/fonts/` (hospedados no próprio site, porque a
política de segurança só aceita a própria origem), em WOFF com o alfabeto latino
(acentos do português incluídos). Licença SIL OFL: os textos `OFL-*.txt` ficam
junto das fontes e devem continuar lá.

Escala: 12, 14, 16, 18, 22, 28, 36 px (`--t-xs` a `--t-3xl`).

## Forma e espaço

Dois raios, de propósito: `--r-sm` (10 px) para campos e botões, `--r-md` (16 px)
para fichas. Pílula só em etiquetas (`.chip`). Espaços de 4 em 4 (`--s1`..`--s7`).
Alvos de toque com no mínimo 44 px (botões 48 px).

## Escrita

Frases curtas, verbo no começo do botão ("Aceitar pedido", "Adicionar Mesa"),
o mesmo nome do começo ao fim do fluxo, estados vazios que dizem o que fazer
("Crie a primeira acima, por exemplo Pratos"). Ações que apagam pedem dois toques
(`ConfirmButton`).

## Imagens e ícones

Fotos em WebP (`/images/*.webp` em 1200 px e `*-sm.webp` em 480 px). Ícones do
app e `manifest.json` em `frontend/public/`. Os ícones saem do emblema do logo
atual (raster); se você tiver o logo em vetor, vale regerar.

## O que falta

O cardápio do cliente ainda usa o layout antigo (já com as fontes e cores novas).
Ele será refeito com a comanda como carrinho e acompanhamento do pedido.
