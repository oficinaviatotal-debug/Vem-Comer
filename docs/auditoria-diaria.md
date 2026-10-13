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

- [x] Reforma visual: cardápio do cliente, tela da mesa, carrinho e acompanhamento (PR #33 juntado em 07/10; fotos de tela a 390 e 320 px, ainda não vista num celular de verdade)
- [x] Opções por item (tamanho, adicionais, observação): servidor juntado (PR #34); telas do cliente (PR #37) e do painel com voz (PR #38) prontas, CI verde, esperando junção
- [~] Entrega: servidor (PR #39), aba do dono com voz (PR #40), tela do cliente com CEP, endereço e taxa (PR #41) e pedido do painel mostrando endereço, telefone e taxa: prontos, CI verde, esperando junção. **Faltam** os estados "pronto" e "saiu para entrega"
- [~] Assinatura de R$ 190: pagamento no primeiro dia, vencimento e bloqueio no dia seguinte. **Pronta com cobrança manual** (servidor, telas do dono, do cliente e do GD, script `cobranca.sh`; vem DESLIGADA, ligar é decisão do GD). Faltam a empresa de pagamento (cobrança automática) e a decisão sobre pagamento atrasado
- [~] Horário de funcionamento, pausa de pedidos e esgotado em um toque: **pronto** (servidor, painel do dono com voz, cardápio do cliente; `docs/horario-e-esgotado.md`), CI e junção pendentes; falta ver no celular
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

## Balanço do 6º dia (13/10)

**O que é verdade, sem enfeite**

- Nada foi construído nem auditado entre 09 e 12/10: a sessão ficou parada e as rotinas diárias só chegaram hoje. As telas das
  opções e da entrega (PRs #37 a #41) foram feitas em 08/10, adiantadas em relação ao plano.
- Nada foi juntado desde 08/10 e a VPS não foi atualizada (ou não sei). Por isso, **nada do que fiz depois do PR #35 está no ar**.
- "Pronto" aqui é PR com CI verde e tela conferida em foto de tela de computador (390 e 320 px). Nenhuma tela foi vista num
  celular de verdade, e a entrega nunca foi testada contra um servidor de verdade fora do banco de teste.

**Versão única para juntar de uma vez**

Os PRs #36 a #41 mais o pedido do painel com endereço foram reunidos num PR só (`release/rc-20261013`), para o GD juntar com um
toque. As emendas não deram conflito; 460 testes do front passam e os 532 do servidor dão o mesmo resultado do `main` (4 falhas
antigas por falta de biblioteca de QR e Pix neste ambiente, que também falham no `main`).

**O que ficou de fora e por quê**

| Item | Por que não entrou |
|---|---|
| Estados "pronto" e "saiu para entrega" | O servidor só aceita pendente, em preparo e concluído; muda a regra do pedido, então merece o próprio dia |
| Horário de funcionamento e esgotado em um toque | Parados em 09 a 12/10 |
| Assinatura de R$ 190, vencimento e bloqueio | Parada; a cobrança automática depende da empresa de pagamento (decisão do GD) |
| Cadastro em 3 dias, "ficou bom?" e botão de ajuda | Parado; o teste cronometrado só faz sentido depois da VPS atualizada |
| Reinstalação na VPS e teste cronometrado | Depende do GD rodar o comando |
| Vem Trabalhar além do levantamento | Só "o que couber"; segurança do banco e comando de voz esperam o GD |

**Quantos dias faltam (minha estimativa, sem contar a espera pelas decisões do GD)**

- **Vem Comer, para vender de verdade: cerca de 10 dias de trabalho.** Estados da entrega 1; horário e esgotado 1,5;
  assinatura com cobrança manual 2; cadastro em 3 dias 2; teste no celular e correções 2; VPS e auditoria geral 1,5.
  Com cobrança automática, mais 2 depois que a empresa de pagamento estiver escolhida.
- **Vem Trabalhar:** 6,5 dias para vagas funcionando sem pagamento e 11 a 13 com pagamento e escolas (levantamento de 08/10).

**Nova ordem (a que eu sigo se o GD não disser outra)**

1. Juntar o PR único, atualizar a VPS e testar no celular (GD). Destrava tudo que depende de teste real.
2. Cadastro em 3 dias: é a promessa de venda do Vem Comer.
3. Assinatura de R$ 190 com bloqueio no dia seguinte (cobrança manual primeiro).
4. Estados da entrega, depois horário e esgotado em um toque.
5. Teste cronometrado, reinstalação e auditoria geral.
6. Vem Trabalhar: segurança do banco, comando de voz, vagas.

**Decisões que só o GD toma**

1. Juntar o PR único.
2. Rodar o comando da VPS e testar o cardápio falado com pausas (mandar print).
3. Escolher a empresa de pagamento com divisão e informar o CNPJ.
4. Confirmar as faixas do motoqueiro (R$ 7 até 5 km, R$ 10 até 10 km, R$ 15 até 15 km) e quem paga a taxa.
5. Autorizar a correção de segurança do banco do Vem Trabalhar (`docs/propostas/001`) e a nova publicação do comando de voz.
6. Dar o aval ao PR #6 (decisão 0001, backend oficial).

**Referências guardadas em 13/10:** o anúncio de curso (08/10) e o anúncio da Empregare (10/10) estão no repositório privado do
Vem Trabalhar (`docs/referencias-visuais/`, PR #4); o texto do benchmark está em `docs/benchmark-comida-rh-cursos.md`.

## Pauta do 6º dia (13/10)

1. Passar o checklist item por item, com a foto da tela quando for tela.
2. O que ficou de fora e por quê.
3. Quantos dias faltam para completar cada produto, com o que já sabemos.
4. Nova ordem do que falta.
5. Decisões que só o GD toma.
