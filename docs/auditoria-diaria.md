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
| 07/10 (qua) | Requisitos 66 e 67, matriz de capacidade, imagens guardadas. Reforma visual: cores da marca, cardápio do cliente e tela da mesa. | Nada hoje. | Dizer se o catálogo de restaurantes entra. Juntar o PR #33. |
| 08/10 (qui) | Reforma visual: carrinho e acompanhamento do pedido. Opções por item: banco de dados e API. | Levantar o que existe e o que falta; juntar o PR #2 se estiver certo. | Mandar a logomarca como arquivo (PNG com fundo transparente ou SVG). |
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
- [ ] Opções por item (tamanho, adicionais, observação)
- [ ] Entrega: tipo do pedido, endereço, taxa por região, estados "pronto" e "saiu para entrega"
- [ ] Assinatura de R$ 190: pagamento no primeiro dia, vencimento e bloqueio no dia seguinte
- [ ] Horário de funcionamento e esgotado em um toque
- [ ] Cadastro em até 3 dias: arquivo, "ficou bom?" na logomarca, botão de ajuda, teste cronometrado
- [ ] Cardápio falado testado no celular do GD
- [ ] Reinstalação na VPS aplicando as migrações até a 009 e as novas

Vem Trabalhar:

- [ ] PR #2 juntado (parceria 50% e 30%, validação de CPF e CNPJ)
- [ ] Estado levantado em 08/10: o que existe, o que falta, quantos dias

Antes de vender de verdade (do `docs/roadmap.md`):

- [ ] Teste real de Pix de R$ 1,00
- [ ] Domínio próprio
- [ ] Backup fora do servidor

## Pauta do 6º dia (13/10)

1. Passar o checklist item por item, com a foto da tela quando for tela.
2. O que ficou de fora e por quê.
3. Quantos dias faltam para completar cada produto, com o que já sabemos.
4. Nova ordem do que falta.
5. Decisões que só o GD toma.
