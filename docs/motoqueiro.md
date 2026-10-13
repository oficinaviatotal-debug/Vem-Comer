# Motoqueiro: código de entrega e dinheiro em aberto (item 42, primeiro pedaço)

Pronto em 13/10/2026 (migração `015_motoqueiro.sql`, `backend/courier.py`, pasta `frontend/src/courier/`).

## O que o GD pediu

> Na entrega, o cliente passa o **código** que recebeu e o motoqueiro registra. O dinheiro fica **"em aberto" no caixa em
> nome do motoqueiro** até o acerto. (item 42; o item 56 acrescenta: "a entrega só fecha com o código do cliente")

## Como funciona, em 4 passos

1. **O pedido de entrega nasce com um código de 4 números**, sorteado pelo servidor (`secrets`). Só o cliente o vê, na
   tela de acompanhamento do pedido: "Código de entrega 0 4 2 7. Passe ao entregador só quando receber o seu pedido".
   Pedido de mesa, balcão ou retirada não tem código.
2. **Cozinha toca em "Pronto para entrega"** (como antes). O pedido aparece na tela do motoqueiro em **Prontos para pegar**.
3. **Motoqueiro toca em "Peguei"**: o pedido vira `saiu para entrega` e fica no nome dele (o cliente vê "Na rua").
   Outro motoqueiro não consegue pegar o mesmo pedido (erro 409 "Outro motoqueiro já pegou este pedido").
4. **Na porta, "Entreguei"**: ele pede ao cliente os 4 números e digita. Certo: o pedido vira `concluido`, com hora de
   saída e de entrega. **Errou 5 vezes: trava** (423), e o restaurante fecha a entrega pela tela dele (o código fica
   bloqueado mesmo que alguém acerte depois).

### O dinheiro

- Pedido pago em **dinheiro** e ainda não confirmado pelo caixa: ao entregar, o valor do pedido fica **em aberto em nome do
  motoqueiro** (`cash_received`). A tela dele mostra "Receber R$ 50,00 em dinheiro. Leve R$ 50,00 de troco" (o troco vem do
  "troco para quanto" que o cliente informou) e, depois de entregar, "Guarde R$ 50,00 para o acerto com o caixa".
- Esse dinheiro continua na tela dele **até o acerto**, mesmo de dias atrás ("Você está com R$ 62,50 em dinheiro de 2 entregas").
- **Acerto** (aba nova, para dono, gerente e caixa): lista o dinheiro em aberto por motoqueiro, com uma marca em cada
  entrega (todas marcadas de início). O caixa conta o dinheiro, desmarca o que não veio e toca em
  "Recebi R$ 62,50 de Ana (2 entregas)", **duas vezes** (a segunda confirma). Acertar também marca o pagamento desses
  pedidos como **pago**, como se o caixa tivesse tocado em "Pagamento recebido". Pix e cartão não entram aqui.
- A lista do acerto não se atualiza sozinha: o total que o caixa contou não muda debaixo do dedo dele.

## Quem vê o quê

| Perfil | O que vê |
|---|---|
| **Entregador** (`COURIER`) | Só a tela de **Entregas**: os prontos para pegar, os dele e os que entregou. Não vê os outros pedidos do restaurante, nem nome e telefone de quem não é entrega dele. O servidor recusa (403) a lista geral de pedidos e a troca de andamento por esse login: não dá para fechar o pedido "por fora", sem o código. |
| **Dono e gerente** | Aba **Entregas** (a mesma tela, e também o que outros motoqueiros levam: "Com outros motoqueiros", só leitura) e aba **Acerto**. Podem sair para entregar eles mesmos. |
| **Caixa** | Aba **Acerto**. |
| Garçom e cozinha | Nada novo. |

As abas Entregas e Acerto continuam funcionando **com o plano bloqueado**: o que já saiu para a rua termina, e o dinheiro
que volta é acertado (regra do item 66: pedidos em andamento terminam).

## O que fica gravado (para a auditoria e, depois, a eficiência)

`orders`: `delivery_code`, `code_attempts`, `courier_id`, `picked_up_at`, `delivered_at`, `cash_received`,
`cash_settled_at`, `cash_settled_by`. `order_events`: `COURIER_PICKUP`, `STATUS_SAIU_PARA_ENTREGA`, `STATUS_CONCLUIDO`,
`COURIER_DELIVERED`, `CASH_SETTLED`. A conta de tempo por entrega e por motoqueiro sai destes campos (fica para depois).

## Segurança

- O código **nunca** vai para a tela do motoqueiro nem para o painel da equipe: a lista dele só diz "tem código"
  (`needs_code`). O teste `test_courier_endpoint.py` confere que o número não aparece em nenhuma resposta dele.
- Comparação do código em tempo constante (`hmac.compare_digest`), 5 tentativas por pedido, contadas no servidor
  (`SELECT … FOR UPDATE`: dois toques ao mesmo tempo não contam em dobro nem fecham duas vezes). A tentativa errada é gravada
  mesmo que a tela feche.
- Código mal digitado (menos de 4 números) não conta tentativa.
- Tudo é limitado ao restaurante do login (cada comando SQL tem `company_id`; um teste confere); um motoqueiro só fecha pedido
  que está livre ou é dele.
- Tocar duas vezes em "Peguei" ou "Entreguei" é seguro: a segunda resposta diz "já estava", sem repetir nada. Por isso,
  **sem sinal na porta**, a tela diz "Toque em Entreguei de novo quando o sinal voltar: não tem problema repetir".
- Pedido de entrega **de antes desta mudança não tem código** e fecha como sempre fechou (sem código).

## O que ainda falta (de propósito, para a próxima etapa)

- **Pagamento do motoqueiro por distância** (item 62: R$ 7 até 5 km, R$ 10 até 10 km, R$ 15 até 15 km) e **quem paga**
  (cliente na taxa ou restaurante): depende do GD confirmar.
- **Fotos de prova** (item 56): retirada e entrega.
- **Tempo por entrega e eficiência** de cada motoqueiro (os campos já estão gravados).
- Fechar a entrega por **WhatsApp** (item 42) e o aviso do código por e-mail.
- Quando o restaurante fecha a entrega pelo botão do painel (por exemplo, código travado), a hora de entrega não é gravada.
- Mostrar no cartão do pedido, para a equipe, **quem é o motoqueiro**.
- Cartão na porta (maquininha): hoje só o dinheiro entra no acerto.

## Como foi conferido

- `backend/test_courier.py` (47) e `backend/test_courier_endpoint.py` (43): regras e rotas, inclusive "o motoqueiro não passa
  por fora", código errado, trava, repetição, outro restaurante e quem pode o quê. Os testes foram quebrados de propósito
  (tirar o bloqueio do login de motoqueiro, não gravar a tentativa errada, aceitar qualquer código, tirar o filtro do
  restaurante no acerto) e cada quebra foi pega.
- O SQL inteiro rodou num **PostgreSQL 16 de verdade** (migração duas vezes; listas por motoqueiro; pegar; contar tentativa;
  entregar com dinheiro; acerto que recusa motoqueiro e restaurante errados; segundo acerto que não acha nada).
- `tests/courier/courierLogic.test.mjs` (20) e `tests/customer/deliveryCode.test.mjs`: agrupar, links de telefone e mapa,
  dinheiro e troco, resposta do servidor, acerto. Entraram no CI (`frontend-logic.yml`).
- As telas rodaram no **Chromium a 390 e 320 px** com um servidor de mentira: Peguei, código com letras, código errado
  (mensagem com as tentativas que restam), sem sinal (mantém o código digitado), código certo, trava na 5ª, acerto em dois
  toques que recomeça se mudar uma marca, nomes compridos sem rolagem lateral e o código na tela do cliente. **Ainda não foi
  visto num celular de verdade.**
