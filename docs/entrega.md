# Entrega e retirada: tipo do pedido, endereço e taxa por região do CEP (parte do servidor)

Lacuna número 2 de `matriz-de-capacidade.md`: o GD vende cardápio, venda e entrega, e o pedido não tinha endereço,
tipo nem taxa. Requisitos 7, 42 e 62. Item de 10/10 do plano da semana, adiantado para 08/10.

**Estado em 08/10:** o servidor está pronto e testado. **Ainda não há tela** (cliente escolher entrega e digitar o
endereço; dono cadastrar as regiões): vem em seguida. Até lá nada muda: pedido sem tipo continua sendo pedido de
balcão, pelo mesmo preço de sempre, e o celular com a versão antiga continua funcionando.

## Como o dono monta

Cada restaurante cadastra as **regiões** que atende. Cada região tem:

| Campo | O que é |
|---|---|
| Nome | "Centro", "Bairro Norte" (até 60 letras, sem repetir) |
| Começos de CEP | `30140` cobre de 30140-000 a 30140-999. De 3 a 8 números cada, até 40 por região. Aceita `30140, 30150-9` |
| Taxa | quanto o cliente paga pela entrega (vazio = grátis), até R$ 999,99 |
| Pedido mínimo | valor dos pratos para entregar ali (vazio = sem mínimo), até R$ 9.999,99 |
| Prazo | minutos combinados (5 a 240), opcional |
| Ligada | desligar uma região sem apagar |

Também há duas chaves do restaurante: **retirada no local** (ligada por padrão) e **pausar entrega** ("hoje não
estamos entregando": para as entregas sem apagar nada; retirada e mesa continuam).

Sem serviço de mapa pago: **o CEP decide a região**. Se dois começos de CEP batem, vale o mais longo (`30140` ganha
de `301`); empate vai para a região mais barata.

## O que o cliente manda e o que o servidor faz

No pedido, três campos novos, todos opcionais:

```json
{"order_type": "entrega", "address": {"cep": "30140-071", "street": "Rua das Flores", "number": "123",
 "neighborhood": "Norte", "complement": "ap 4", "reference": "em frente à padaria"}, "phone": "(31) 99999-8888"}
```

- **mesa**: pedido com `table_id` (QR da mesa). Não paga taxa. Mesa com entrega é recusada.
- **retirada**: sem taxa; telefone opcional. Recusada se o restaurante desligou a retirada.
- **entrega**: exige nome (não vale "Cliente Balcão"), telefone com DDD, e endereço com CEP, rua, número e bairro.
  O servidor acha a região pelo CEP, confere o **pedido mínimo sobre os pratos** (a taxa não ajuda a passar) e **soma a
  taxa da região ao total**. A taxa que o celular mostrou ou mandou é ignorada, como o preço dos pratos.
- **sem tipo e sem mesa**: pedido de balcão, como sempre foi.
- O total já com a taxa é o que vai para o pagamento, o Pix (valor do QR) e a conferência do troco em dinheiro.
- O **CMV e o custo dos pratos não mudam**: a taxa não entra em `order_items`, então frete não vira "venda de comida".
- O tipo, a taxa, o nome da região e o endereço ficam **copiados no pedido**: mudar ou apagar a região amanhã não
  altera o pedido de hoje.
- Qualquer erro (CEP fora de área, falta de rua, telefone inválido, entrega pausada, abaixo do mínimo) recusa o
  pedido inteiro com uma frase que o cliente entende, e nada é gravado.

## Rotas

- `GET /api/companies/<id>/delivery` (pública): `{pickup, delivery, paused, zones: [{name, fee, min_order,
  eta_minutes}]}`, só regiões ligadas e **sem** a lista de CEPs.
- `GET /api/companies/<id>/delivery/quote?cep=30140-071` (pública): `{available: true, zone, fee, min_order,
  eta_minutes}` ou `{available: false, reason, message}` com `reason` = `invalid_cep`, `out_of_area`, `paused` ou
  `no_delivery`. É o "entrega no meu CEP?" antes de o cliente digitar o resto.
- `GET /api/admin/delivery` (dono ou gerente): tudo, com ids e começos de CEP, inclusive regiões desligadas.
- `PUT /api/admin/delivery` (dono ou gerente): troca retirada, pausa e regiões pelo que foi enviado. Mande o `id` da
  região para mantê-la; sem `id`, nasce uma nova; o que não está na lista é apagado. A lista `zones` é obrigatória:
  um envio sem ela é recusado em vez de apagar tudo sem querer. `{"zones": []}` tira todas.
- `GET /api/orders/<id>` (cliente, com o código de acompanhamento) e `GET /api/companies/<id>/admin/orders`
  (painel): cada pedido volta com `order_type`, `delivery_fee`, `delivery_zone`, `delivery_address` e
  `customer_phone`.

## Por dentro

- Migração `011_entrega.sql` (segura para rodar mais de uma vez; o instalador roda antes de subir a nova versão):
  tabela `delivery_zones`; colunas `accepts_pickup` e `delivery_paused` em `companies`; `order_type`, `delivery_fee`,
  `delivery_zone`, `delivery_address` (jsonb) e `customer_phone` em `orders`. Pedidos que já existem: com mesa viram
  `mesa`, os outros ficam `balcao`.
- Regras e SQL em `backend/delivery.py`; rotas em `backend/app.py`. 29 + 29 testes (`test_delivery.py`,
  `test_delivery_endpoint.py`).

## Privacidade (LGPD)

Endereço e telefone são dados pessoais. Só leem: o dono ou gerente do restaurante (painel) e o próprio cliente (pelo
código de acompanhamento, que vale 7 dias). A lista pública de regiões não traz CEP nem endereço de ninguém.
Prazo para apagar endereço e telefone de pedido antigo: **a decidir** (conferir com o advogado; o prazo das fotos de
prova do item 56 também).

## O que ainda não faz

- **Telas**: cliente escolhe mesa, retirada ou entrega, digita o CEP, vê a taxa e o endereço; dono cadastra as
  regiões (por voz, "centro, taxa 5, CEPs 30110 e 30120") e pausa a entrega; cozinha vê o endereço no pedido.
- **Estados "pronto" e "saiu para entrega"** e o motoqueiro (código de entrega, acerto do dinheiro, fotos de prova,
  pagamento por faixa de distância: itens 42, 56 e 62): planejado para 11/10 em diante.
- **Preencher a rua pelo CEP** (ViaCEP): hoje o cliente digita o endereço. Fica para depois, porque depende de o
  celular do cliente alcançar um serviço de fora.
- **Horário de funcionamento** (entrega fora do horário): 11/10.
- **Quem paga a taxa** (item 62 aberto): hoje o cliente paga a taxa da região e o restaurante acerta com o
  motoqueiro por fora.
