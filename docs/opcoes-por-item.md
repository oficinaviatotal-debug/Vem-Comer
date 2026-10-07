# Opções por item: tamanho, adicionais, "sem cebola" e observação (parte do servidor)

Lacuna apontada em `matriz-de-capacidade.md` (07/10/2026): o produto tinha um preço só e o pedido não guardava
escolha nenhuma. Sem isso não dá para vender açaí de 500 ml com complementos, pizza de tamanho, lanche com
adicional nem "sem cebola". Esta é a primeira da lista de prioridades da semana (08/10).

**Estado em 08/10:** o servidor está pronto e testado. **Ainda não há tela**: nem o cliente escolhe opção no
cardápio, nem o dono monta as opções no painel. Isso é o trabalho de 09/10. Até lá, tudo continua como antes: prato
sem opção vende pelo preço do prato.

## Como o dono monta (o que o servidor já aceita)

Cada prato tem até 8 **grupos de escolha**. Exemplo de um açaí:

| Grupo | Regra | Opções |
|---|---|---|
| Tamanho | escolher 1, obrigatório | 300 ml, 500 ml (+ R$ 6,00), 700 ml (+ R$ 11,00) |
| Adicionais | até 5, opcional | Leite ninho (+ R$ 3,00), Banana (+ R$ 2,50), Granola |
| Retirar | até 3, opcional | Sem leite condensado, Sem granola |

- O preço do prato é o **preço base**; cada opção soma o seu acréscimo (nunca negativo, no máximo R$ 999,99).
- `min_choices` 0 = opcional, 1 ou mais = obrigatório. `max_choices` 1 = escolher uma; mais = várias.
- Até 30 opções por grupo, nomes de até 60 letras, sem repetir nome dentro do prato ou do grupo.
- Cada opção pode ser **desligada** ("acabou o bacon"): some do cardápio, mas o pedido antigo fica igual.
- Grupo obrigatório com todas as opções desligadas deixa o prato **indisponível** (não vende sem o tamanho).

## O que o cliente manda e o que o servidor faz

No pedido, cada item aceita dois campos novos, os dois opcionais:

```json
{"id": "<prato>", "quantity": 2, "options": ["<id da opção>", "..."], "note": "bem gelado"}
```

- O cliente manda **só os ids** das opções. O servidor confere que cada uma é daquele prato, daquele
  restaurante e está ligada; confere mínimo e máximo de cada grupo; e **recalcula o preço**:
  `preço do prato + soma dos acréscimos`. O valor que o celular calculou (ou mandou) é ignorado.
- O que foi escolhido fica **copiado** na linha do pedido (`order_items.options`, com nome do grupo, nome da opção
  e preço da hora). Se o dono mudar o preço amanhã, o pedido de hoje não muda.
- `unit_price` da linha já inclui as opções; `total = unit_price × quantity`. Por isso o total do pedido, o
  pagamento, o Pix e o troco em dinheiro continuam funcionando sem mudança.
- A observação (`note`) tem até **140 letras**, uma linha só. Passou disso? O servidor **recusa** em vez de cortar:
  "alergia a amendoim" cortada no meio é perigo.
- Qualquer erro (opção que não existe mais, tamanho faltando, dois tamanhos, passou do máximo) recusa o pedido
  inteiro com uma frase que o cliente entende, e nada é gravado.

## Rotas

- `GET /api/companies/<id>/products` (pública): cada prato ganha `option_groups` com as opções ligadas
  (`id`, `name`, `min_choices`, `max_choices`, `items[{id, name, price_delta}]`). Grupo sem nenhuma opção ligada
  continua na lista, com `items` vazio, para a tela mostrar "indisponível agora".
- `POST /api/companies/<id>/orders` (pública): itens com `options` e `note`, como acima.
- `GET /api/orders/<id>` (cliente, com o código de acompanhamento) e `GET /api/companies/<id>/admin/orders`
  (painel): cada item volta com `options` e `note`.
- `GET /api/admin/products/<id>/options` (dono ou gerente): os grupos do prato com as opções desligadas também.
- `PUT /api/admin/products/<id>/options` (dono ou gerente): troca os grupos do prato pelos enviados. Mande o `id`
  do grupo e da opção quando só mudar o preço ou o nome: o id é mantido e o carrinho de quem está pedindo agora
  não quebra. Sem `id`, nasce uma opção nova. O que não está na lista é apagado. `{"groups": []}` tira tudo.
  Aceita preço como `6.5`, `"6.50"` ou `"6,50"`.

## Por dentro

- Migração `010_opcoes_por_item.sql` (segura para rodar mais de uma vez; o instalador roda antes de subir a nova
  versão): tabelas `option_groups` e `option_items`, e as colunas `options` (jsonb) e `note` em `order_items`.
  O banco também impede acréscimo negativo, máximo menor que o mínimo e observação com mais de 140 letras.
- Regras e SQL em `backend/item_options.py`; rotas em `backend/app.py`.
- Apagar o prato apaga os grupos dele (`ON DELETE CASCADE`).

## O que ainda não faz

- **Telas** (cliente escolhe, carrinho separa o mesmo prato com opções diferentes, painel mostra as opções e a
  observação para a cozinha, dono monta os grupos): 09/10.
- **Falar ou fotografar as opções** no cadastro do cardápio: 09/10, junto das telas. A importação de cardápio
  (voz, foto, arquivo) ainda só lê prato e preço.
- **Custo e CMV**: o custo do prato (`unit_cost`) não inclui o custo dos adicionais. Quem vende muito adicional vê o
  CMV um pouco otimista até a ficha técnica da opção existir.
- **Meio a meio** (duas metades de sabores diferentes, preço pela mais cara): não está nesta parte.
- **Prato esgotado** (o prato inteiro, não só uma opção): é o item "esgotado em um toque", planejado para 11/10.
  Hoje o servidor ainda não confere `products.active` ao receber o pedido.
