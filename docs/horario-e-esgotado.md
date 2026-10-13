# Horário de funcionamento, pausa de pedidos e "esgotou" em um toque

Três coisas pequenas que o cliente sente na hora (item "Horário de funcionamento e esgotado em um toque" da auditoria).
Pronto em 13/10/2026, **fora do ar até o GD juntar o pedido e atualizar a VPS** (a migração `013_horario_esgotado.sql` roda
sozinha no instalador, antes de subir a nova versão, e não mexe em nada que já existe).

## O que o cliente vê

- **Fora do horário** (só para entrega e retirada): o cardápio continua à vista, os botões viram "Sem pedidos agora" e um
  aviso diz a hora de abrir: "Fechado agora. Abre hoje às 18h. Você pode ver o cardápio e pedir quando abrir." Quem está
  **sentado na mesa** (QR) nunca é barrado pelo horário: já está no restaurante.
- **Pausa do dono** (vale para todos, mesa inclusive): "Estamos com uma pausa nos pedidos. Tente de novo em alguns minutos."
- **Prato esgotado**: continua no cardápio, mais claro, com o selo "Esgotado" no lugar do botão. Se o cliente já tinha o
  prato no pedido, ele sai sozinho e a tela avisa ("Pastel de carne acabou e saiu do seu pedido.").
- O cardápio aberto no celular **se atualiza sozinho**: a cada minuto pergunta de novo se está aberto e, quando o cliente volta
  para a página, também confere os pratos. Se mesmo assim mandar o pedido, o servidor recusa com a frase pronta (e a tela a
  mostra como veio, com o nome do prato).
- Restaurante **sem horário cadastrado** (todos os que já existiam) continua aberto a qualquer hora. Um servidor antigo que não
  manda o horário não fecha nada.

## O que o dono vê

- **Aba Horário** (dono e gerente): o estado agora ("Aberto agora · Aberto até 23h." / "Fechado agora. Abre hoje às 18h."), a
  chave **Pausar os pedidos** (vale na hora) e os sete dias. Cada dia tem **Aberto/Fechado**, um ou dois turnos
  (almoço e jantar) com hora de abrir e de fechar, e "+ Outro turno": num dia 11h–22h ele já divide em 11h–15h e 18h–22h.
  Fechar antes de abrir quer dizer que passa da meia-noite (18h às 2h). **Copiar para todos os dias** (no primeiro dia aberto)
  espalha o horário; uma linha resume tudo ("Seg a sex 11h às 15h e 18h às 23h · Sáb 11h às 23h · Dom fechado").
- **Salvar horário** só liga quando algo mudou ("Não salvo" aparece enquanto isso; "Descartar" volta ao que está salvo). Os
  mesmos testes do servidor rodam antes de enviar e o problema vem em frase ("segunda: preencha a hora de abrir e a de fechar.",
  "Os turnos de sexta e de sábado se cruzam."). **Tirar o horário (sempre aberto)** pede dois toques.
- **Faixa na tela Pedidos** (dono, gerente e cozinha): "Aberto até 23h." e o botão **Pausar pedidos**; pausado, a faixa fica
  vermelha com **Voltar a receber**. Se não conseguir ler (sem sinal), a faixa some e Pedidos segue funcionando.
- **Produtos** (qualquer funcionário, a cozinha inclusive): **Esgotou** / **Voltou** em cada prato (muda na hora e volta atrás
  se o servidor recusar), selo "Esgotado" e, com algum prato esgotado, a barra "N pratos esgotados" com **Voltou tudo**
  (começo do dia).

## Falar o horário

Botão 🎙️ **Falar o horário** (some se o aparelho não tem reconhecimento de voz):

> De segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado.

- Dias: "segunda", "segunda a sexta", "segunda, quarta e sexta", "sexta a segunda" (passa pelo fim de semana), "fim de semana",
  "dias de semana", "todos os dias", "sete dias por semana", plural ("aos sábados") e "-feira".
- Horas: "11", "11h", "11h30", "11:30", "onze e meia", "vinte e duas", "meio-dia", "meia-noite", "10 da noite", "3 da tarde",
  "7 da manhã". "das 6 às 10 da noite" vale 18h às 22h. "Às 11 e 30 às 15" é 11h30; "das 11 às 15 e 18 às 23" não vira 15h18.
- Fechado: "domingo fechado", "domingo a gente fecha", "não abrimos domingo", "domingo é folga", "fechamos aos domingos".
  "Fecha às 23" é só a hora de fechar, não dia fechado. Também funciona com as horas antes dos dias ("das 11 às 23 de segunda a
  sábado").
- Os dias ditos **trocam** o que havia; os outros ficam como estavam. Dia dito duas vezes vale o último (a tela avisa).
- **Nada é gravado ao falar.** A tela mostra "Você disse / Entendi" e o que sobrou ("Faltou a hora de fechar", "Não ouvi os
  dias, então usei todos os dias da semana", "Se algum horário for da tarde ou da noite, diga assim: das 6 às 10 da noite");
  o dono confere e toca em Salvar horário.

## Regras no servidor (`backend/hours.py`)

- Dias de 0 (segunda) a 6 (domingo); relógio de Brasília (UTC-3 fixo); até 2 turnos por dia; turno pode passar da meia-noite;
  turnos que se cruzam (inclusive domingo à noite sobre segunda de manhã) são recusados com frase.
- Sem nenhuma linha em `business_hours` = sempre aberto. Erro ao ler o horário **nunca fecha** o restaurante.
- O horário só barra pedido que **não é de mesa**; a pausa barra todos. O que já foi pedido segue normalmente.
- O cliente só recebe `hours: {configured, open_now, message, paused}` (nunca os turnos).
- Rotas (todas com login): `GET/PUT/DELETE /api/admin/hours` (ler: dono, gerente e cozinha; gravar e tirar: dono e gerente),
  `PUT /api/admin/orders-pause` (dono, gerente e cozinha), `PUT /api/admin/products/<id>/sold-out` e
  `POST /api/admin/products/sold-out/reset` (dono, gerente e cozinha; só do próprio restaurante). O pedido recusado por horário
  ou pausa volta 403 com `code` (`closed_now` ou `paused`); prato esgotado volta 400 com o nome do prato.
- Pausa e esgotado **não são apagados** por nada: ficam até alguém tocar de novo.

## O que não entrou

- Feriado e dia especial com horário próprio (a tela avisa que vale o dia da semana).
- Esgotado por **opção** (um só tamanho ou adicional): as opções já podem ser desligadas (`opcoes-por-item.md`); a chave de um toque
  na lista de pratos é só do prato inteiro.
- Esgotar sozinho por estoque ou voltar sozinho no dia seguinte: hoje o dono toca em "Voltou tudo".
- Horário diferente para entrega e para o salão.

## Como foi conferido

- **Servidor:** 66 testes (`backend/test_hours.py` e `backend/test_hours_endpoint.py`): regras de dias e turnos, passagem da
  meia-noite, virada da semana, pausa, esgotado, permissões e isolamento entre restaurantes; mais um teste de ponta a ponta num
  **PostgreSQL de verdade** (salvar a semana, trocar, tirar, pausar, esgotar, pedido recusado sem gravar nada).
- **Telas:** 51 testes novos (`tests/ui/hoursDraft.test.mjs`, `tests/ui/spokenHours.test.mjs`,
  `tests/customer/openness.test.mjs`): edição dos dias, frases faladas (incluindo as armadilhas "15h18", "sete dias", "fecha às
  23"), quando o cardápio fecha, prato que some do pedido e as frases do servidor chegando ao cliente.
- **Fotos de tela a 390 e 320 px** do painel (Horário, falando, Pedidos com e sem pausa, Produtos com esgotado) e do cliente
  (fora do horário, pausado, prato esgotado, pedido recusado, atualização sozinha, mesa não barrada). Ainda **não foi visto num
  celular de verdade**: pede o teste do GD (a hora aparece em 24 h no celular em português; na foto de tela aparece AM/PM).
