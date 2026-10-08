# Sprint de 6 dias até o RC e auditoria diária (07/10 a 13/10/2026)

Combinado com o GD em 07/10, às 13:25: entregar o máximo até 13/10, auditar todo dia e, no 6º dia, sentar com o
checklist inteiro, reorganizar o que faltar e calcular quantos dias faltam para completar o Vem Comer e o Vem Trabalhar.

## Como é a auditoria diária (de manhã, cerca de 8h)

1. O que ficou pronto desde a última auditoria.
2. O que travou e por quê.
3. O que é de hoje.
4. O que depende do GD (decisão, arquivo, conta).
5. Riscos para o dia 13.

Regra de "pronto": só conta o que tem PR com CI verde e, quando é tela, foto da tela conferida no celular. "Juntado" é
decisão do GD, e eu nunca junto PR.

## Plano por dia (proposta; cada auditoria ajusta o dia seguinte)

| Dia | Vem Comer | Vem Trabalhar | Do GD |
|---|---|---|---|
| 07/10 (qua) | Requisitos 66 a 68, matriz de capacidade, imagens guardadas. Reforma visual do cliente feita: cores da marca, cardápio, tela da mesa, carrinho e acompanhamento (fotos de tela conferidas a 390 e 320 px). | Nada hoje. | Juntar o PR #33. (O catálogo de restaurantes ficou para depois de 3 meses.) |
| 08/10 (qui) | Reforma visual: conferir o painel do dono em foto de tela depois da troca de cores (ainda não olhei). Opções por item: banco de dados e API (feito em 07/10, juntado). Adiantar as telas das opções. | Levantar o que existe e o que falta; juntar o PR #2 se estiver certo. | Mandar a logomarca como arquivo (PNG com fundo transparente ou SVG). |
| 09/10 (sex) | Opções por item: telas do cliente e do painel, voz e foto lendo as opções. | O que couber. | Testar o cardápio falado no celular. |
| 10/10 (sáb) | Entrega: tipo do pedido, endereço, taxa por região do CEP e retirada. | O que couber. | Confirmar as faixas do motoqueiro e quem paga a taxa. |
| 11/10 (dom) | Entrega: painel com "pronto" e "saiu para entrega". Horário de funcionamento e esgotado em um toque. | O que couber. | |
| 12/10 (seg) | Assinatura de R$ 190: pagamento no primeiro dia, vencimento, bloqueio no dia seguinte. Cadastro em 3 dias: arquivo, "ficou bom?" na logomarca e botão de ajuda. | O que couber. | Decidir o preço de lançamento e a empresa de pagamento. |
| 13/10 (ter) | Auditoria geral, teste cronometrado do cadastro, reinstalação na VPS. | Auditoria geral. | **Sentar com o checklist.** |

Cabe tudo? Provavelmente não. A auditoria de cada dia diz o que escorregou, e no dia 13 dizemos o que passa para depois e
quantos dias faltam.

## Checklist do RC (13/10)

Vem Comer:

- [ ] Reforma visual: cardápio do cliente, tela da mesa, carrinho e acompanhamento
- [ ] Opções por item (tamanho, adicionais, observação): servidor pronto e juntado (PR #34, CI verde); faltam as telas do cliente e do painel e a voz
- [ ] Entrega: tipo do pedido, endereço, taxa por região, estados "pronto" e "saiu para entrega"
- [ ] Assinatura de R$ 190: pagamento no primeiro dia, vencimento e bloqueio no dia seguinte
- [ ] Horário de funcionamento e esgotado em um toque
- [ ] Cadastro em até 3 dias: arquivo, "ficou bom?" na logomarca, botão de ajuda, teste cronometrado
- [ ] Cardápio falado testado no celular do GD (correções do PR #35 juntadas em 07/10; falta atualizar a VPS e testar de novo)
- [ ] Reinstalação na VPS aplicando as migrações até a 010 (comando entregue ao GD em 07/10 à noite; sem confirmação de que rodou)

Vem Trabalhar:

- [x] PR #2 juntado (parceria 50% e 30%, validação de CPF e CNPJ), CI verde
- [x] Estado levantado em 08/10: `docs/estado-2026-10-08.md` no repositório do Vem Trabalhar (PR #3). Cerca de 6,5 dias para vagas funcionando sem pagamento e 11 a 13 com pagamento e escolas
- [ ] PR #3 juntado (comando de voz corrigido, CI das funções, estado e risco de segurança)
- [ ] Segurança do banco e das funções (1 dia, depende da autorização do GD)

Antes de vender de verdade (do `docs/roadmap.md`):

- [ ] Teste real de Pix de R$ 1,00
- [ ] Domínio próprio
- [ ] Backup fora do servidor

## Auditoria de 08/10 (dia 2 de 6)

**Pronto desde ontem** (PR com CI verde e juntado pelo GD):

- PR #34, opções por item no servidor (tamanho, adicionais, "sem cebola", observação), testado em banco real.
- PR #35, cardápio falado: espera 3 segundos de silêncio, ignora conversa e avisa preço estranho.
- PR #33, reforma visual e Mesa viva (juntado em 07/10).
- Vem Trabalhar: PR #2 já estava juntado, CI verde.

**Travado ou sem confirmação:**

- Não sei se o GD rodou o comando de atualização da VPS (migração 010 e voz). Sem isso não há como testar a voz nova.
- Painel do dono ainda não conferido em foto de tela depois da troca de cores.
- Instagram: falta o tipo de conta e o print do erro completo.
- PR #6 (decisão 0001, backend oficial) aberto desde 05/10 aguardando aval.

**De hoje:**

1. Conferir o painel do dono em foto de tela (390 px) e corrigir o que estiver feio.
2. Adiantar as telas das opções por item: folha de opções no cardápio do cliente e linha do carrinho por produto, opções e observação.
3. Vem Trabalhar: feito (levantamento e correção do comando de voz).

**Depende do GD:**

- Atualizar a VPS, testar o cardápio falado com pausas e mandar print.
- Juntar o PR #3 do Vem Trabalhar e autorizar (ou não) a correção de segurança: duas funções internas do banco são chamáveis sem login (`docs/propostas/001` no Vem Trabalhar). Nada foi alterado no Supabase.
- Autorizar a nova publicação do comando de voz do Vem Trabalhar.
- Logomarca como arquivo (PNG com fundo transparente ou SVG). Seguem pendentes os itens da lista anterior (Instagram, TikTok, WhatsApp da oficina, orçamento de impulsionamento).
- Escolher a empresa de pagamento com divisão e informar o CNPJ (bloqueia a assinatura de R$ 190 e o pagamento das escolas).

**Riscos para o dia 13:**

- A assinatura de R$ 190 (12/10) depende da escolha da empresa de pagamento. Sem ela, entrego a regra de vencimento e bloqueio com cobrança manual.
- Dois dias de entrega em seguida (10 e 11/10) são apertados; se a opção por item atrasar, a entrega por região do CEP é o que escorrega.
- Vem Trabalhar só anda com "o que couber": até 13/10 não passa do levantamento e da segurança.

## Pauta do 6º dia (13/10)

1. Passar o checklist item por item, com a foto da tela quando for tela.
2. O que ficou de fora e por quê.
3. Quantos dias faltam para completar cada produto, com o que já sabemos.
4. Nova ordem do que falta.
5. Decisões que só o GD toma.
