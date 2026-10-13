# Entrega: tela do dono (aba "Entrega")

Onde o restaurante cadastra as regiões que atende. Depende do servidor da entrega (pedido #39, `docs/entrega.md`):
sem ele a aba abre com erro e pede para tentar de novo, sem quebrar o resto do painel.

## O que o dono vê

Aba **Entrega** no painel (dono e gerente):

- **Retirada no local** (liga/desliga) e **Pausar a entrega** ("Pausar agora" / "Voltar a entregar"). As duas chaves valem **na
  hora**: gravam com as regiões que o servidor já tem, nunca com as que o dono ainda está editando.
- **Regiões**: nome, começo dos CEPs (`30110, 30120`; `30110` cobre de 30110-000 a 30110-999; vale o mais comprido),
  taxa, pedido mínimo, prazo em minutos e a chave "Entregando / Desligada". Debaixo de cada região uma frase diz o que o
  cliente vai ler ("CEP começando em 30110. Taxa de R$ 5,00. Pedido mínimo de R$ 20,00. Prazo de 40 minutos.").
- **Salvar regiões** só liga quando algo mudou; o aviso "Não salvo" aparece enquanto isso. Os mesmos testes do servidor rodam
  antes de enviar, e o que está errado vem em frase ("Centro: taxa inválida. Escreva assim: 5,50"). O servidor tem a palavra
  final e a mensagem dele aparece se recusar.
- **Remover região** pede dois toques. Pedido antigo não muda (o servidor guarda nome e taxa da hora do pedido).

## Falar as regiões

Botão 🎙️ **Falar as regiões** (some se o aparelho não tem reconhecimento de voz):

> Centro, taxa 5 reais, CEP 30110 e 30120, pedido mínimo 20, prazo 40 minutos. Norte, taxa 8, CEP 31000.

- Palavras antes de "taxa", "CEP", "mínimo" ou "prazo" são o nome; depois de uma região com dados, o próximo nome abre outra
  região (ponto final também separa).
- Entende "por 5 reais", "frete cinco e cinquenta", "grátis", "sem taxa", "sem mínimo", "a partir de 40", "meia hora",
  "uma hora e meia", "40 minutos", "prazo 45", CEP com ponto ou traço (`30.110`, `30130-000`) e número de 5 a 8 dígitos sem a
  palavra CEP.
- Conversa antes do nome é jogada fora ("eu entrego no centro", "bairro Savassi", "nova região Centro"). Nomes que parecem
  conversa ficam ("Nova Lima", "Cidade Nova", "Zona Sul").
- Falar de novo uma região que já existe **atualiza** só o que foi dito (mesmo id, o resto fica); CEPs ditos trocam os de antes.
- **Nada é gravado ao falar.** A tela mostra "Você disse / Entendi" e o que sobrou ("Norte: não ouvi a taxa. Fica grátis se
  você não preencher", "Não sei a que região pertence o número 7"); o dono confere e toca em Salvar regiões.
- Espera as pausas como o cardápio falado (3 s) e tem "Pronto" e "Cancelar".

## Como foi conferido

- 35 testes novos (`tests/ui/deliveryDraft.test.mjs`, `tests/ui/spokenZones.test.mjs`): ida e volta com o servidor sem perder
  id, dinheiro e CEP como o dono escreve, cada erro em frase, mesclagem da fala, limite de 20 regiões, vários jeitos de falar.
- Tela em 390 e 320 px de largura, sem rolagem lateral, com servidor de mentira e microfone de mentira: falar, conferir,
  salvar (corpo enviado conferido), erro do cliente (não vai ao servidor), erro do servidor, pausa na hora enviando as regiões
  salvas e não as editadas, falar de novo atualizando a mesma região, remover com confirmação.

## Não conferido

- Contra o servidor de verdade (a aba depende do #39 e da migração 011 na VPS).
- Reconhecimento de voz de um Android de verdade com CEP: o aparelho pode escrever "30110" ou "30.110" ou separar os números;
  os dois primeiros leem, o terceiro não.
- Tela do cliente (escolher entrega, digitar CEP e endereço) e pedidos do painel mostrando o endereço: ainda não feitos.
