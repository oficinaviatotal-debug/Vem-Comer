# Painel "Seu negócio"

Aba do dono e do gerente (antes chamada "Resumo"). Responde, nesta ordem: quanto entrou e contra o quê, o que precisa
de atenção, quando a casa enche, quais pratos pagam, como está o serviço e quem fez o quê. Garçom, caixa e cozinha
continuam com o "Resumo" simples.

## Onde está

| Parte | Arquivo |
|---|---|
| Contas (sem banco, sem Flask) | `backend/insights.py` |
| Rota e SQL | `backend/business_api.py` → `GET /api/companies/<id>/admin/business?period=hoje\|7d\|30d` |
| Regras da tela (frases, barras) | `frontend/src/business/businessLogic.ts` |
| Tela | `frontend/src/business/BusinessPanel.tsx`, `business.css` |
| Testes | `backend/test_insights.py`, `test_business_api.py`, `test_business_db.py` (banco real); `tests/business/` |

## Regras que não mudam

- **Só venda de verdade**: pedido que a cozinha já aceitou (`order_status.SOLD_STATUSES`). Pedido esperando pagamento
  não entra.
- **Relógio de Brasília** (UTC-3). "Hoje" começa à meia-noite de Brasília, não à do servidor.
- **Comparação justa**: "hoje" é comparado com ontem **até a mesma hora**; 7 e 30 dias, com o período anterior do mesmo
  tamanho. Só compara com 5 pedidos ou mais dos dois lados.
- **Falar sempre a verdade**: sem dado suficiente a resposta é "poucos dados" (mediana de tempo com 5 registros ou mais;
  hora forte/fraca com 10 pedidos em 3 horários), nunca um número inventado.
- **Custo vem do pedido** (`order_items.unit_cost`, gravado na hora da venda). Prato sem custo fica fora do CMV e do
  lucro, e a tela mostra quanto das vendas tem custo (cobertura). O aviso de CMV alto só aparece com 50% ou mais de
  cobertura.
- **Cada tamanho/sabor é um produto**: aparece sozinho na lista de pratos.
- **Equipe em ordem alfabética, sem ranking**: a tela mostra o que cada um fez (chamados atendidos, entregas e o tempo
  do meio), não quem é "o melhor".
- **Tempo fora do razoável não conta** (cozinha acima de 4 h, chamado acima de 2 h, entrega acima de 3 h): é pedido
  esquecido aberto, não tempo de serviço.
- **Isolamento**: toda consulta é presa ao restaurante de quem está logado; outro restaurante dá 403.

## Avisos (com número e o lugar onde se resolve)

Vendas ou ticket 15–20% abaixo do período anterior, CMV 3 pontos acima da meta, pouco custo calculado, cozinha com
mediana de 30 min ou mais, chamado de mesa com mediana de 5 min ou mais, e "mesa chamando agora" (chamado aberto há mais
de 5 min). Boa notícia também aparece (vendas 20% acima).

## O que ainda não faz

- Não separa a taxa de entrega do faturamento (mostra o total da taxa no rodapé).
- Lucro não inclui custo de opcionais (adicionais) do pedido: o custo gravado é o do prato.
- Sem gráfico por semana/mês corrido nem exportação (próximos passos).
