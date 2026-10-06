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
4. No topo, o **CMV dos últimos 30 dias** pelas vendas e quanto das vendas já tinha ficha.

A lista mostra primeiro os pratos com custo alto, depois os de atenção, depois os sem ficha.

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

## O que fica guardado (`database/migrations/006_custos.sql`)

- `ingredients`: insumo por restaurante, quantidade na unidade base (g, ml ou un) e preço da embalagem.
  Nome único por restaurante (sem diferenciar maiúscula).
- `product_ingredients`: a ficha técnica (quanto de cada insumo vai numa porção).
- `products.portion` e `products.extra_cost`.
- `order_items.unit_cost`: o custo do prato **no momento do pedido**. Assim o CMV de um mês antigo não muda
  quando o frango encarece. Se a conta falhar, o pedido segue sem custo (nunca trava o cliente).
- `companies.cmv_target`: a meta do restaurante.

## Segurança

- Só dono e gerente leem ou mudam custo; toda consulta é presa ao restaurante do login.
- Um prato só aceita insumo do mesmo restaurante.
- O cliente nunca vê custo: a rota pública de produtos não mudou.
- Trocar a unidade de um insumo que já está em ficha (peso para líquido, por exemplo) é recusado:
  as quantidades das fichas ficariam erradas. O dono cria outro insumo.

## Limites desta versão

- É o **CMV teórico** (pela ficha técnica). O CMV real, pelo estoque (estoque inicial + compras − estoque final),
  depende da entrada de notas e do estoque: é o item 22 (compra inteligente).
- Cadastro de insumo e de ficha é por toque e digitação. Voz e foto da nota vêm depois, reaproveitando o
  assistente do cardápio.
- O aviso de margem baixa aparece na aba Custos; o alerta no painel e por mensagem é o item 10 (alertas).

## Testes

- `backend/test_costing.py`: as contas, as unidades, os números no formato brasileiro.
- `backend/test_costs_endpoints.py`: login, cargo, restaurante, cada rota e o custo gravado no pedido.
- `tests/costs/costLogic.test.mjs`: a lógica da tela (custo ao vivo, frases, ordem da lista).
