# Custos, porção e CMV

Item 6 da ordem de trabalho (linha 8 de `docs/requisitos-do-dono-vem-comer.md`): "cadastro de porção,
gerência de produtos e de custos, CMV da cozinha. O cara nunca teve isso."

## O que o dono faz

Aba **Custos** do painel (só dono e gerente):

1. Cadastra os **insumos** como vêm na nota: nome, tamanho da embalagem e quanto pagou.
   Ex.: "Peito de frango, 1 kg, R$ 18,90". Unidades: kg, g, L, ml, unidade, dúzia.
2. Em cada prato, toca em **Montar ficha** e diz quanto vai de cada insumo em **uma porção**
   (ex.: 250 g de frango, 200 g de batata), a porção em palavras ("1 pessoa", "300 g") e outros custos
   por porção (embalagem, gás). O custo aparece enquanto ele digita.
3. Vê, em cada prato, uma frase só: "Custa R$ 7,43 e vende por R$ 25,00: CMV de 29,7%, dentro da meta
   de 35%." Quando passa da meta, a frase diz o preço que deixaria o prato na meta.
4. No topo, o **CMV dos últimos 30 dias** pelos pedidos que a cozinha aceitou (em preparo ou concluídos; pedido
   abandonado não conta) e quanto dessas vendas já tinha ficha.

A lista mostra primeiro os pratos com custo alto, depois os de atenção, depois os sem ficha.

## Rendimento, aproveitamento e padronização (pedido do GD, 06/10/2026)

- **A receita rende quantas porções.** A ficha guarda a receita inteira: frango à milanesa com 1,2 kg de peito,
  300 g de farinha e 4 ovos rende 6 porções. O custo da porção é o custo da receita ÷ 6, mais embalagem e gás
  por porção.
- **Peso de cada porção (g)**, para padronizar o prato (o garçom e a cozinha servem sempre igual).
- **Aproveitamento do insumo (%)**: o que sobra depois de limpar. 1 kg de peito que vira 850 g limpo = 85%.
  A ficha usa o peso limpo; o custo e o estoque voltam ao peso comprado.
- **Quantos pratos uma embalagem rende**: "1 kg dá 4,2 pratos de Frango à milanesa", em cada insumo.
- **Ficha falada**: botão "Falar a ficha". O dono fala, por exemplo, "1,2 quilo de peito de frango, 300 gramas de
  farinha de rosca, quatro ovos, rende 6 porções, porção de 250 gramas". A tela mostra o que entendeu e só salva
  quando ele toca em Salvar. Entende números falados ("duzentos e cinquenta", "um quilo e meio", "meia dúzia") e nomes
  curtos ("frango" acha "Peito de frango"). O que não entendeu aparece explicado. Peso sem unidade ("um peito") é
  recusado com o pedido "diga em gramas ou quilos". Lógica em `frontend/src/costs/recipeSpeech.ts`.

## Estoque pela ficha

- O dono toca em **Estoque** no insumo e diz "Contei: tenho agora 5 kg" ou "Comprei: somar 2 kg".
- Daí em diante, cada venda **aceita pela cozinha** tira do estoque o que a ficha diz (com o aproveitamento).
  A tela mostra o estoque de agora e para quantos dias dá, no ritmo dos últimos 30 dias.
- É estoque **teórico**. Contar de novo de vez em quando acerta a diferença (perda, desperdício, erro de porção);
  a diferença entre o teórico e o contado é a perda que o dono não via.
- Guardado em `ingredients.stock_qty` e `stock_at` (migração 007). Rota `POST .../admin/ingredients/<id>/stock`
  com `contagem`, `compra` ou `parar`.

## O que dá mais lucro (engenharia de cardápio)

Seção "O que dá mais lucro": cada prato com o que vendeu e o lucro sobre o custo dos ingredientes nos últimos 30 dias,
do maior para o menor, e o nome da engenharia de cardápio (Kasavana e Smith, 1982):

| Nome | Quando | Ação sugerida na tela |
| --- | --- | --- |
| Estrela | vende muito, margem alta | não mexer na receita; destaque no cardápio e nos posts |
| Cavalo de tração | vende muito, margem baixa | subir um pouco o preço, acertar a porção, acompanhamento mais barato |
| Quebra-cabeça | vende pouco, margem alta | promoção, foto melhor, combo, o garçom oferecer |
| Cão | vende pouco, margem baixa | repensar receita e preço, ou tirar do cardápio |

Linhas de corte: popular = vendeu pelo menos 70% do que caberia a cada prato numa divisão igual; margem alta = margem
por porção maior ou igual à média ponderada pelas vendas. Só entram pratos com ficha e com preço. Fonte do método:
[Beancount: engenharia de cardápio](https://beancount.io/pt/blog/2026/07/08/menu-engineering-food-cost-percentage-stars-plowhorses-puzzles-dogs-matrix).
Essas ações são o começo da gestão de promoções e campanhas; o disparo (e-mail, WhatsApp, posts) é o item 9.


## As contas (`backend/costing.py`)

- Custo da porção = soma de (quantidade usada × preço da embalagem ÷ tamanho da embalagem) + outros custos.
- CMV do prato = custo ÷ preço de venda, em %.
- Meta: começa em 35% e o dono muda (5% a 90%). Fonte da faixa: o Sebrae cita 25% a 35% como estimativa
  boa para restaurante ([Sebrae PR](https://sebraepr.com.br/comunidade/artigo/entendendo-o-cmv-de-restaurante-como-fazer-o-calculo-e-sua-importancia)).
- Situação: **na meta** (até a meta), **atenção** (até 10 pontos acima), **custo alto** (mais que isso),
  **sem ficha**, **sem preço**.
- Preço sugerido = custo ÷ meta, arredondado para cima no centavo (o mesmo cálculo do exemplo do Sebrae:
  prato de R$ 4 com meta de 30% → cerca de R$ 13,30).
- Prato sem ficha tem custo **desconhecido**, não zero.
- "1.000" sem vírgula é lido como mil (jeito brasileiro); "0,250" e "0.250" são decimais. A tela manda os
  números já convertidos, como número, para não haver dúvida no servidor.

## O que fica guardado (`database/migrations/006_custos.sql`)

- `ingredients`: insumo por restaurante, quantidade na unidade base (g, ml ou un) e preço da embalagem.
  Nome único por restaurante (sem diferenciar maiúscula).
- `product_ingredients`: a ficha técnica (quanto de cada insumo vai numa porção).
- `products.portion` e `products.extra_cost`.
- `order_items.unit_cost`: o custo do prato **no momento do pedido**. Assim o CMV de um mês antigo não muda
  quando o frango encarece. Se a conta falhar, ou der um custo absurdo (erro de digitação), o pedido segue sem
  custo: a conta do custo nunca trava o cliente. Uma ficha com porção acima de R$ 100.000 é recusada.
- `companies.cmv_target`: a meta do restaurante.

## Segurança

- Só dono e gerente leem ou mudam custo; toda consulta é presa ao restaurante do login.
- Um prato só aceita insumo do mesmo restaurante.
- O cliente nunca vê custo: a rota pública de produtos não mudou.
- Trocar a unidade de um insumo que já está em ficha (peso para líquido, por exemplo) é recusado:
  as quantidades das fichas ficariam erradas. O dono cria outro insumo.

## Limites desta versão

- O estoque é teórico (pela ficha) até a entrada de notas do item 22.
- É o **CMV teórico** (pela ficha técnica). O CMV real, pelo estoque (estoque inicial + compras − estoque final),
  depende da entrada de notas e do estoque: é o item 22 (compra inteligente).
- Cadastro de insumo e de ficha é por toque e digitação. Voz e foto da nota vêm depois, reaproveitando o
  assistente do cardápio.
- O aviso de margem baixa aparece na aba Custos; o alerta no painel e por mensagem é o item 10 (alertas).

## Testes

- `backend/test_costing.py`: as contas, as unidades, os números no formato brasileiro.
- `backend/test_costs_endpoints.py`: login, cargo, restaurante, cada rota e o custo gravado no pedido.
- `tests/costs/costLogic.test.mjs`: a lógica da tela (custo ao vivo, frases, ordem da lista).
- `backend/test_costs_view.py`: rendimento, aproveitamento, estoque e o custo gravado no pedido.
- `tests/costs/recipeSpeech.test.mjs`: a ficha falada.
