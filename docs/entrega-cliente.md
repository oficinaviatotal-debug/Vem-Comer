# Entrega: tela do cliente

O que o cliente vê quando o restaurante entrega. Depende do servidor da entrega (pedido #39, `docs/entrega.md`) e fica em cima
da tela de opções por item (pedido #37).

## Quando aparece

- Só em pedido **sem mesa**. Quem leu o QR da mesa pede como sempre: sem retirada, sem entrega, sem taxa.
- Só quando o restaurante entrega (tem região ligada e não pausou). Sem isso, nada muda e o pedido sai como saía (balcão).
- Entrega **pausada** (o dono tocou em "Pausar agora"): o cliente lê "A entrega está pausada agora. Você pode retirar no local."
- O restaurante que desligou a retirada mostra só a entrega, sem escolha.

## O caminho do cliente

1. No carrinho, **Como você quer receber?**: *Retirar no local* (padrão) ou *Receber em casa*.
2. Em *Receber em casa*: **CEP** (a máscara põe o traço; com 8 números o sistema pergunta ao servidor) e logo aparece
   "Entregamos em Centro. Taxa de entrega R$ 5,00. Prazo de cerca de 40 min." ou "Ainda não entregamos nesse CEP. Você pode retirar no local."
3. Rua, número (ou S/N), complemento e ponto de referência (opcionais), bairro e **telefone com DDD** (máscara `(31) 99999-8888`).
   O nome fica obrigatório na entrega.
4. A comanda mostra **Pratos**, **Taxa de entrega** e **Total**. O botão e o "Tenho o valor certinho" do dinheiro já
   contam a taxa. O Pix é gerado pelo servidor com o total que ele calculou.
5. Se faltar algo, a mensagem diz uma coisa por vez, na ordem da tela (nome, CEP, rua, número, bairro, telefone, pedido mínimo).
6. No acompanhamento: "Entrega" no alto, "Entrega em: rua, número, complemento, bairro · Telefone", a linha da taxa antes do total
   e, quando fica pronto, "já vai sair para o seu endereço". Retirada mostra "Retirada no local".

## O que o celular não decide

A taxa que aparece é a que o **servidor** respondeu para aquele CEP, só como prévia. Ao enviar, o servidor acha a região de
novo, confere o pedido mínimo sobre os pratos e soma a taxa dele. O que o celular mandou de taxa não existe: o pedido leva só
`order_type`, `address` e `phone`. Se algo mudou no meio (o dono pausou, o CEP saiu da área), a frase do servidor aparece como
veio, em vez de "confira a internet".

## Privacidade (LGPD)

- Endereço e telefone vão ao servidor só no pedido de entrega; quem lê é o dono ou gerente do restaurante e o próprio cliente
  (pelo código de acompanhamento). A lista pública de regiões não traz CEP nem dado de ninguém.
- O aparelho **lembra o endereço e o telefone** do último pedido de entrega, só naquele celular e para aquele restaurante
  (`vc_delivery_<restaurante>`), para o cliente não digitar de novo. O botão **Esquecer meu endereço neste aparelho** apaga na hora.
  Sem armazenamento (aba anônima), o app funciona igual, sem lembrar.
- Prazo para apagar endereço e telefone de pedido antigo no servidor: ainda a decidir (`docs/entrega.md`).

## Como foi conferido

- 16 testes novos (`tests/customer/delivery.test.mjs`) e 2 no `labels.test.mjs`: o que é oferecido (mesa, sem entrega, pausada, erro ao carregar), máscara de
  CEP e telefone, a mesma regra de telefone do servidor, taxa e mínimo vindos da resposta do servidor, cada problema na ordem da tela,
  o que vai junto do pedido, o endereço na comanda, frases do servidor sem virar "confira a internet", memória do aparelho
  (outro restaurante, apagar, armazenamento quebrado ou bloqueado).
- Tela em 390 e 320 px, sem rolagem lateral, com servidor de mentira: retirada, entrega com CEP parcial e completo, cada erro,
  fora da área, pedido mínimo da região, falha ao conferir o CEP e "Tentar de novo", dinheiro (total com a taxa), corpo enviado
  conferido (sem taxa, com endereço e telefone só com números), acompanhamento com endereço e taxa, endereço lembrado no pedido
  seguinte e apagado pelo botão, retirada enviando só `order_type`.

## Não conferido

- Contra o servidor de verdade (depende de #39 e da migração 011 na VPS).
- Celular de verdade: teclado numérico no CEP e no telefone, preenchimento automático do Android.
- Preencher a rua pelo CEP (ViaCEP): fica para depois, porque depende de o celular do cliente alcançar um serviço de fora.
- O painel de pedidos do restaurante ainda não mostra o tipo, o endereço e a taxa (próximo passo).
