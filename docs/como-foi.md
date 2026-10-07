# "Como foi?": o retorno de quem usa, para a melhoria de todo dia

Pedido do GD (07/10/2026): no fim de cada tarefa, perguntar ao cliente o que melhorar (a voz, uma
fonte, uma sombra, um botão) e ir melhorando um pouco todo dia.

## Na tela

- Um cartão pequeno, de linha fina, logo depois que a tarefa termina: três rostinhos (Ruim, Mais ou
  menos, Bom). Depois do toque, um campo "O que podemos melhorar?" para **falar** ou escrever, com
  **Pular** e **Enviar**. O × fecha.
- Aparece hoje em três lugares: no fim do Assistente do cardápio (falado, foto ou modelo), depois de
  salvar a ficha de um prato (Custos) e depois de salvar a logomarca.
- A mesma tarefa só pergunta de novo no dia seguinte, naquele celular. Nunca fica na frente do
  próximo passo.

## No servidor

- Tabela `feedback` (migração `008_retorno.sql`): restaurante, pessoa, tarefa, rostinho, comentário
  (até 500 caracteres), data. Rota `POST /api/admin/feedback`, para qualquer pessoa logada, sempre
  gravada no restaurante do login. Limite de 20 respostas por pessoa por hora.

## A melhoria diária

No terminal do servidor:

```
bash /opt/vem-comer/app/deploy/vps/ver-retorno.sh       # último dia
bash /opt/vem-comer/app/deploy/vps/ver-retorno.sh 7     # últimos 7 dias
```

Mostra, por tarefa, quantos bons, médios e ruins, e a lista do que pediram para melhorar (com o nome
do restaurante, nunca e-mail ou nome de pessoa). O GD cola o resultado aqui; o Claude transforma em
pequenas mudanças, cada uma numa aprovação (PR) que o GD aprova. Nada muda sozinho no sistema.

Próximo passo, quando o e-mail do sistema existir: o servidor manda esse resumo todo dia de manhã.

## Testes

- `backend/test_feedback.py`: validação e limite.
- `backend/test_feedback_endpoint.py` (CI): login, restaurante do login, banco simulado.
- `tests/ui/feedbackLogic.test.mjs`: rostinhos, texto, "uma vez por dia" e armazenamento quebrado.
- O resumo (`ver-retorno.sh`) foi rodado contra um Postgres 16 local com a migração aplicada duas vezes.
