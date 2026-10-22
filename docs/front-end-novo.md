# Front-end novo (feito do zero, a partir de 21/10/2026)

O GD disse (21/10/2026, 20:50): "tudo que não for possível recuperar, principalmente o front-end, tem que ser 100%
refeito". Este documento diz **o que fica**, **o que é refeito**, **como é o visual novo** e **como as telas novas
entram sem ir ao ar antes da hora**. A ideia de produto está em `docs/ideia-central.md` (rascunho para o GD aprovar) e
as regras de comportamento em `docs/principios-do-produto.md`.

## O que fica e o que sai

| Fica (tem prova) | Sai (é refeito) |
|---|---|
| O servidor, o banco e as regras (testes com banco de verdade a cada PR) | Todo o CSS antigo: `styles.css`, `ui.css`, `admin.css`, `nav.css` e os `.css` de cada pasta |
| A lógica sem tela, testada: pedidos, cardápio, custos, mesa, entrega, navegação (`frontend/src/*/…Logic.ts` e `tests/*`) | O painel único herdado (`AdminPanel.tsx`, quase 2 mil linhas) e as telas antigas, uma a uma |
| O cliente da API (`service/api.ts`), enquanto as telas novas não pedirem outra coisa | A marca provisória e os botões, cores e abas do painel antigo |
| As fontes (Bricolage Grotesque e Instrument Sans, já hospedadas no próprio site) | |

Regra: a lógica antiga só é reaproveitada se tiver teste. O que não tem teste é reescrito junto com a tela.

## O visual novo (`frontend/src/novo/`)

- **Norte:** a prancha "Templates principais" do GD: fundo branco, cartões bem arredondados, verde-floresta e
  laranja-brasa no Vem Comer, azul no Vem Trabalhar, títulos grossos e redondos, azulejos pêssego nas categorias,
  promoção em vermelho-brasa com botão amarelo.
- **Uma casa, dois temas:** as mesmas peças valem para os dois produtos. O Vem Trabalhar só troca as variáveis de cor
  (`.nv-work`). Um balãozinho pequeno liga um ao outro (laranja "Está com fome?", azul "Precisa de trabalho?").
- **O elemento de personalidade:** a **bolinha de voz**, em toda tela. É a regra "voz primeiro" virada em desenho. Ela
  pulsa devagar e para quando a pessoa pede menos movimento.
- **Só o necessário:** cada tela responde uma pergunta (a cozinha: "o que faço agora?"; o dono: "o que está esperando
  e o que devo fazer?"; o cliente: "o que posso pedir?"). Botão com verbo. Sem texto em letra maiúscula, sem enfeite.
- **Régua de qualidade (testada em `tests/novo`):** toque de 44 px ou mais, contraste de texto de 4,5:1 ou mais,
  movimento respeita `prefers-reduced-motion`, foco visível, 360 px de largura, nada depende de rede para desenhar.
- **Cores (Vem Comer):** Folha `#1B4332` (letra), Mata `#2E7032` (verde), Brasa viva `#FF6F00` (ação, nunca letra),
  Brasa `#C74700` (laranja que passa como letra), Sol `#FFC83A` (atenção e botão da promoção), Pêssego `#FDEEDF`
  (azulejos). **Vem Trabalhar:** Tinta `#0B2A6F`, Azul `#0F4BD1`, Azul vivo `#1F63FF`.

## Telas da primeira rodada (só desenhadas, com dados de exemplo)

1. **Cardápio do cliente** (o link do restaurante): marca do restaurante, aberto até, busca, categorias, pratos em 2 por
   linha (eram 3; ver a quinta rodada) com foto grande, sacola, bolinha de voz e o balãozinho do Vem Trabalhar. (O desenho também tinha tempo de
   entrega, taxa, cidade e promoção; o servidor não tem esses dados no cardápio e a tela de verdade não os mostra.)
2. **Hoje do dono:** o que está esperando (número grande), o que fazer agora (mesa chamando, Pix a conferir), vendas
   do dia com as horas, e quatro atalhos.
3. **Cozinha:** uma comanda por pedido, a mais antiga primeiro, fita que muda de cor pelo tempo, observação do cliente
   em destaque e botão grande.
4. **Vem Trabalhar (quem procura trabalho):** busca, atalhos (Vagas, Cursos, Currículo, Perfil), vagas perto, e a
   bolinha de voz para falar o currículo.

## Segunda rodada: a cozinha ligada aos pedidos (22/10/2026)

A primeira tela a sair do desenho. Ela lê os pedidos do mesmo caminho da tela antiga (`fetchAdminOrders`) e troca o
status pelo mesmo caminho (`updateOrderStatus`); as palavras do fluxo (Aceitar pedido, Pedido pronto, Pronto para
entrega, Saiu para entrega) vêm de `service/orderStatus.ts`, a regra que o servidor aceita.

- `frontend/src/cozinha/kitchenLogic.ts`: a conta, sem tela. Pedidos do servidor viram comandas; três etapas (Novos,
  Fazendo, Prontos); a mais antiga primeiro; a observação do cliente em destaque; data estragada nunca inventa espera.
- `frontend/src/cozinha/KitchenScreen.tsx`: busca a cada 5 s, apita no pedido novo (por número do pedido, não por
  quantidade), segura o botão enquanto envia e diz em frase inteira quando falha.
- `frontend/src/novo/Kitchen.tsx`: agora responde ao toque (etapa e botão), mostra etapa vazia e erro.
- Testes: `tests/novo/kitchenLogic.test.mjs` (15). Um deles é uma cerca: nada do aplicativo importa o visual novo nem
  a cozinha nova enquanto o GD não disser "pode".
- A página de conferência (`#/cozinha`) passa pedidos de exemplo pela mesma conta, então o que se vê ali é o caminho real.

**O que a cozinha nova ainda não faz (e a antiga faz):** mostrar a forma de pagamento, o troco, o endereço e o
telefone, e o botão "Pagamento recebido". Isso é assunto do caixa e da entrega (itens 5 e 6 da ordem abaixo). A lista
antiga de pedidos dentro de `AdminPanel.tsx` **só sai quando essas duas telas existirem**, para ninguém ficar sem
confirmar pagamento. Também falta a casca nova (menu e entrada) para a cozinha entrar no aplicativo.

## Terceira rodada: o "Hoje" do dono ligado aos dados (22/10/2026)

A segunda tela a sair do desenho. Responde "o que está esperando e o que eu preciso fazer agora?" com os mesmos números
da tela antiga: os pedidos (mesmas regras de `nav/navLogic.ts`), as mesas chamando (`mesa/callsLogic.ts`) e as vendas do
dia (as contas do servidor, `backend/insights.py`). Nada é estimado; onde o servidor não tem número, a tela diz isso.

- `frontend/src/hoje/todayLogic.ts`: a conta, sem tela. Saudação e data no horário de Brasília; pedidos esperando (e há
  quanto tempo), na cozinha, a caminho, mesas chamando; "Para fazer agora" (Atender a mesa e Conferir o Pix, este só
  para quem pode confirmar Pix); vendas do dia com as barras por hora até agora; quatro atalhos.
- `frontend/src/hoje/TodayScreen.tsx`: busca os pedidos a cada 5 s, as mesas a cada 6 s e as vendas a cada minuto. Uma
  busca que falha nunca apaga o que está na tela.
- `frontend/src/novo/OwnerToday.tsx`: agora responde ao toque e não conhece nome de tela do painel (quem monta os dados diz).
- Testes: `tests/novo/todayLogic.test.mjs` (18), mais a cerca que mantém `novo/`, `cozinha/` e `hoje/` fora do aplicativo.
- Não faz ainda: o apito de mesa chamando e de pedido novo no Hoje (a cozinha nova já apita); isso continua na barra de
  chamadas do painel antigo até a casca nova entrar.
- Só para dono e gerente. Cozinha, caixa e garçom terão a própria tela inicial (itens 1, 5 e 6 da ordem abaixo).

## Quarta rodada: o cardápio do cliente ligado aos dados (22/10/2026)

A vitrine que o cliente vê ao tocar no link do restaurante ou ler o QR da mesa. Repete o que o servidor diz, com as
regras da tela antiga (`customer/menuGroups.ts`, `options.ts`, `openness.ts`, `cart.ts`).

- `frontend/src/loja/shopLogic.ts`: a conta, sem tela. Categorias na ordem do restaurante e pratos dentro delas
  (com os subtítulos), "a partir de" quando tamanho ou extras mudam o preço, Esgotado, Indisponível agora, "Sem pedidos
  agora" quando o restaurante está em pausa, sem receber pedido ou fora do horário (quem está na mesa nunca vê "fechado
  pelo horário"), a pílula "Aberto até 23h", busca sem acento (só em cardápio de 8 pratos ou mais), azulejos de categoria
  com a foto do primeiro prato que tem foto, sacola em centavos exatos.
- `frontend/src/loja/ShopScreen.tsx`: busca restaurante, categorias e pratos; pergunta de novo a cada minuto se o
  restaurante abriu, fechou ou pausou; o prato que acaba sai da sacola e a tela avisa uma vez. Falha não apaga a tela.
- `frontend/src/novo/ShopMenu.tsx`: agora recebe pratos agrupados, aviso, busca de verdade, sacola e os toques.
- Testes: `tests/novo/shopLogic.test.mjs` (17).
- **O que o desenho tinha e o servidor não tem, e por isso a tela de verdade não mostra:** promoção ("Promoções da
  semana"), cidade, taxa e tempo de entrega no topo (a taxa depende do endereço) e "Mais pedidos" (o servidor não manda
  popularidade; os pratos vêm por categoria). Se o GD quiser promoção, é um recurso novo (servidor, painel do dono e
  tela), e fica para ele decidir.
- **O que falta para o cliente conseguir pedir:** a tela das escolhas (tamanho, extras, observação), a sacola (mudar
  quantidade, nome, pagamento em Pix, entrega ou retirada), o acompanhamento do pedido e a tela da mesa. "Escolher" e
  "Ver sacola" já avisam quem usa a tela (`onChoose`, `onBag`); a tela antiga continua sendo a que vai ao ar.
- A bolinha de voz continua sendo desenho (a busca por voz da tela antiga ainda não foi refeita).

## Quinta rodada: profundidade (3D) e tudo tocável (22/10/2026)

Pedido do GD, 22/10/2026, 07:30: "o visual pode ser alterado para dar impressão de 3D, e tudo precisa ser clicável, ou
seja, facilidade ao comprar".

**A regra do desenho (uma só, no cabeçalho de `novo.css`):** a luz vem de cima. Toda peça que se toca tem brilho em
cima, **borda grossa embaixo** (a "espessura", sempre numa cor mais escura da própria peça) e sombra no chão, e **afunda
quando o dedo aperta**. O que só informa (pílulas de horário, tempo de espera, ícone do aviso, etiquetas) fica **liso, sem
borda**; painéis que só agrupam têm sombra macia. Assim o dono e o cliente não precisam aprender o que é botão: o desenho
mostra. Campos de escrever são o contrário: **afundados**. Quem pediu menos movimento recebe a mudança sem animação.

**Toque estendido (`nv-hit`):** o botão principal de um cartão cobre o cartão inteiro (por um pedaço de CSS, sem mudar a
conta), então tocar em qualquer lugar vale. Os botões de dentro (− e +, fechar o balão) ficam por cima. Quem é toque
estendido não se mexe sozinho: o cartão é que afunda (se o botão se mexesse, a área de toque encolheria no meio do aperto).

| Peça | O que o toque faz |
| --- | --- |
| Cartão do prato (cardápio) | Põe um na sacola; se o prato tem tamanho ou extras, abre as escolhas. Esgotado ou restaurante fechado: não é botão |
| Promoção | O cartão inteiro pede a promoção; "Ver todas" lista (só aparece com promoção de verdade, que o servidor ainda não tem) |
| Balãozinho do Vem Trabalhar / do Vem Comer | O balão inteiro é o link; o X fecha |
| Hoje: caixas "na cozinha", "a caminho", "mesa chamando" | Levam a Pedidos, Entregas (só gerente) e Mesas. Sem a tela para aquela pessoa, a caixa fica lisa e só informa |
| Hoje: cada "para fazer agora" | O texto leva à tela do assunto (chamada: Mesas; Pix: Pedidos); o botão faz a ação (Atender, Conferir) |
| Hoje: vendas | O cartão inteiro abre os números |
| Vem Trabalhar | Campos de busca escrevem de verdade; o cartão da vaga inteiro abre os detalhes; atalhos e abas respondem |
| Cozinha | **Só o botão grande avança o pedido.** O resto da comanda é para ler: um toque sem querer ali mudaria um pedido |

**Escolhas que fiz e o GD pode trocar:**

- Pratos em **2 por linha** (eram 3): o cartão inteiro tocável precisa de espaço, e foto maior vende mais. Voltar para 3 é
  trocar `repeat(2, ...)` por `repeat(3, ...)` em `.nv-grid`.
- O aviso de **Pix** leva aos pedidos pelo texto, mas só o botão "Conferir" confere: conferir pagamento por um toque sem
  querer não é "facilidade", é erro caro.
- O botão de menu **deixou de aparecer** nas telas que não têm para onde levá-lo (antes aparecia e não fazia nada).

**Ainda sem destino, porque a tela não existe** (aparecem no desenho e avisam quem usa a tela por `onMenu`, `onPromo`): o
menu geral e a bolinha de voz. As escolhas do prato, a sacola, o acompanhamento do pedido, a mesa e o menu geral passaram a
existir nas rodadas seguintes (abaixo).

**Como foi conferido:** `tests/novo/toque.test.mjs` (14 nesta rodada; 21 com a sexta) lê o CSS e as telas e garante a regra (borda grossa só no que toca,
afundar no toque, toque estendido por cima, nada de botão fantasma). Em 320, 360, 390 e 480 px a conferência mede sem
rolagem lateral, nenhum botão com menos de 44 px e, ponto a ponto (`elementFromPoint`), que tocar no centro e nos cantos de
cada cartão cai no botão dele.

## Sexta rodada: escolhas do prato e sacola (22/10/2026)

O GD respondeu "Ok" ao visual em 3D, e eu segui com o que faltava para fechar o caminho de comprar (isso não é o "pode" de
ir ao ar). Duas telas novas, na mesma linguagem (borda grossa embaixo e afundar no toque = toca; o que só informa fica liso;
campos de escrever afundados; 44 px ou mais em tudo que se toca):

**Escolhas do prato** (`novo/Choices.tsx`, a folha que sobe de baixo): foto, nome e descrição; cada conjunto do restaurante
("Tamanho": escolha 1; "Adicionais": até 3) com uma etiqueta lisa que diz a regra (laranja quando é obrigatório); **a linha
inteira de cada opção é o botão** (60 px): solta, sobe; marcada, afunda e fica verde; escolha única é redonda, a de várias é
quadrada; quando o limite de extras chega, as outras apagam. Embaixo: observação (contador de 140 letras), mais e menos, e o
botão grande "Adicionar · R$ 24,00" (ou "Salvar" ao mudar uma linha da sacola). Faltou o tamanho? O aviso em vermelho
aparece no conjunto e a folha rola até ele. Fecha pelo X, pelo fundo escurecido e pelo Esc; a tela de trás não rola; o Tab
não sai da folha; o foco volta para onde estava.

**Sacola** (`novo/Bag.tsx`): a comanda (cada prato com o que a pessoa escolheu, mais, menos, "Mudar opções" e "Observação"),
o total com pontinhos de cardápio e, na entrega, a taxa do CEP. O **menos de quem está em 1 vira lixeira** (tirar o último
prato é tirar o prato do pedido, e o nome do botão diz isso). Depois: como receber (só quando o restaurante oferece mais de
um jeito), o nome (obrigatório na entrega), o endereço de entrega (CEP com a resposta do servidor em uma frase: região, taxa,
prazo, ou por que não entrega; rua, número, complemento, bairro, referência, telefone com DDD; "Esquecer meu endereço neste
aparelho"), como pagar (Pix só se o restaurante cadastrou a chave; no dinheiro, "vou pagar com" e "Tenho o valor certinho") e
o botão grande "Enviar pedido · R$ 73,00" fixo embaixo. O aviso de erro vem em frase inteira, em voz alta para quem usa
leitor de tela, e a tela o traz para a vista.

**De onde vem cada número (nada inventado):** a conta é toda das regras antigas, que já eram testadas
(`customer/options.ts`, `cart.ts`, `delivery.ts`, `payment.ts`, `labels.ts`), agora em dois arquivos de conta pura:
`loja/choicesLogic.ts` (18 testes) e `loja/bagLogic.ts` (23 testes). O preço de cada prato, a taxa, o pedido mínimo e a
região são do servidor; a tela só **mostra** o que ele anunciou e diz em palavras o que falta. O que vai ao servidor é a
carga pronta (`orderPayloadOf`): códigos e quantidades, **nunca preço**.

**Ligação ao servidor** (ainda fora do aplicativo público): `loja/useShop.ts` (busca restaurante, cardápio, mesa, entrega e
Pix; mantém a sacola; repete o que o servidor diz a cada minuto e ao voltar para a tela; prato que acaba sai da sacola e a
tela avisa uma vez), `ShopScreen.tsx` (cardápio, agora só desenha), `ChoicesScreen.tsx` (a folha como diálogo),
`BagScreen.tsx` (nome, endereço, telefone, pagamento; taxa do CEP; **envia uma vez só**: dois toques seguidos mandam um
pedido; confere antes; só guarda nome, endereço e pedido neste aparelho depois que o servidor aceitou) e `OrderFlow.tsx`
(cardápio → escolhas → sacola → acompanhamento, ver a sétima rodada).

**Como foi conferido:** 41 testes de conta (18 + 23), `tests/novo/toque.test.mjs` (regras do desenho, 21 testes) e
`tests/novo/fluxo.test.mjs` (9 testes: ordem do envio, nada de preço, nada importado do antigo, folha como diálogo). Em 320,
360, 390 e 480 px: sem rolagem lateral, nenhum botão com menos de 44 px e o toque cai onde deve. Para ver:
`preview-novo.html#/escolhas`, `#/escolhas-erro`, `#/sacola` e `#/entrega` (tudo funciona na página, com dados de exemplo).

## Sétima rodada: acompanhar o pedido e pagar com Pix (22/10/2026)

Pedido do GD, 22/10, 09:56: "Faça como especialista e ajuste o que for necessário". Primeiro, a revisão do que já estava
feito; depois, a peça que faltava para fechar o caminho do cliente.

**Revisão, o que foi ajustado:**
- Contraste: o texto de exemplo dos campos (placeholder) estava em 3,45 : 1 e a etiqueta "obrigatório" em 4,27 : 1; ambos
  agora passam de 4,5 : 1 (um teste calcula a razão de contraste de verdade).
- O contador de extras ("2 de 3") fica vermelho ao passar do limite.
- Escolha única agora funciona com as setas do teclado (`novo/keys.ts`), como em qualquer grupo de opções.
- No 320 px: o ícone do botão não estoura, "Ver sacola" não quebra de linha e o telefone não se parte no meio.

**A tela de acompanhamento** (`novo/Tracking.tsx`, uma "comanda" que só informa, lisa, com o que toca em relevo):
- Cabeça: "Entrega" ou "Retirada" (ou "Mesa 4"), código curto do pedido e o nome de quem pediu.
- Para onde vai: "Entrega em: …" (endereço e telefone) ou "Retirada no local.". O telefone aparece no formato (84) 99999-8888.
- Situação em frase grande ("Em preparo", "Saiu para entrega", "Pronto!") e uma linha de passos com o atual em laranja.
  Quem usa leitor de tela ouve a mudança sozinha (`aria-live`).
- **Código de entrega** (quando o servidor manda): quatro números grandes, e a frase dizendo para passar ao entregador
  só quando ele chegar. O leitor de tela lê o número inteiro, não um dígito solto.
- **Pix:** quando o pagamento é Pix, o bloco do Pix vem **antes** da comanda, porque é o que o cliente precisa fazer
  agora: valor, para quem vai, "Copiar código Pix" (só liga quando o código chegou do servidor), QR para ler com outro
  aparelho e dois passos escritos. Se copiar não for permitido pelo aparelho, o código aparece selecionado para copiar à
  mão. Se o restaurante não tem Pix cadastrado ou o servidor falha, a tela diz isso em frase inteira.
- **Avaliação** quando o pedido termina: comida e atendimento (quatro opções cada: ótima/ótimo, boa/bom, regular, ruim) e comentário de até 500 letras, enviada
  **uma vez por visita**, sem nota inventada. O pedido entregue sai da lista com "Fechar este pedido".
- Sem internet: a tela avisa que mostra o último estado conhecido e tenta de novo sozinha.

**De onde vem cada coisa (nada inventado):** situação, código de entrega, taxa, total, forma de pagamento, chave e código
Pix vêm do servidor. A tela só traduz (`loja/trackingLogic.ts`, 21 testes, usando as mesmas funções de texto e de pagamento
da tela antiga). Consulta a cada 5 segundos, pausa com a aba escondida; 401 ou 404 significa "este pedido não existe mais"
e a tela para de perguntar e tira o pedido da lista.

**Ligação ao servidor** (`loja/TrackingScreen.tsx`, ainda fora do aplicativo público): um bloco por pedido guardado neste
aparelho (`orderMemory`), com consulta, Pix e avaliação. `OrderFlow.tsx` agora termina **no acompanhamento**, não mais em
"Pedido enviado"; ao reabrir o cardápio, quem já tem pedido em andamento cai direto nele. O cardápio ganhou o botão
"Acompanhar o seu pedido" (com o número, quando há mais de um) e ele só aparece quando leva a algum lugar.

**Escolhas que o GD pode mudar:** o roteiro guiado "Me ajude" do Pix da tela antiga **não foi recriado** (no lugar entram os
dois passos escritos); a bolinha de voz continua sendo só desenho.

**Como foi conferido:** `tests/novo/trackingLogic.test.mjs` (21), `toque.test.mjs` (35, com a regra do 3D, contraste e
telefone sem quebra) e `fluxo.test.mjs` (14, com consulta, Pix, avaliação uma vez só e o fluxo abrindo no acompanhamento).
Em 320, 360, 390 e 480 px, nas 12 telas de conferência: sem rolagem lateral, nenhum botão com menos de 44 px. Para ver:
`preview-novo.html#/loja-pedido`, `#/pedido`, `#/pedido-rua` e `#/pedido-pronto`. **Ainda sem tela:** menu geral, mesa
(chamar garçom, conta; veio na oitava rodada) e a bolinha de voz que fala.

## Oitava rodada: a mesa do cliente (22/10/2026)

O GD respondeu "Sim" (22/10, 10:14) à pergunta "é isso que você quer para o acompanhamento e o Pix? Se sim, sigo com a tela
da mesa". Não é o "pode" de ir ao ar. A tela da mesa é a que abre quando o cliente lê o QR colado na mesa.

**A tela** (`novo/Table.tsx`): o título é "Mesa 4" (ou "Sua mesa" enquanto o número não chegou) com o nome do restaurante;
"O que você precisa agora?"; o botão mais largo e mais alto, verde, "Ver cardápio e pedir"; "Acompanhar o seu pedido" só
para quem já pediu; dois botões grandes, **Chamar garçom** e **Pedir a conta**; dois menores, **Água** e **Limpeza**; e
"Trabalhe aqui" (só se houver endereço https do Vem Trabalhar). O nome de cada botão nunca muda: o que muda é a etiqueta e a
cor, e o desenho segue a regra do 3D:
- pronto: pêssego, borda grossa, afunda no toque;
- **Chamado** (nos primeiros 60 s): amarelo e afundado, sem borda grossa (não há o que tocar agora), com "Aguarde um instante,
  já vai chegar.";
- **Ainda não veio?** (passado 1 minuto): sobe de novo e deixa avisar outra vez;
- **Atendido**: verde, com o sinal de certo, e deixa chamar de novo na hora.

Quem usa leitor de tela ouve cada botão por inteiro ("Pedir a conta. Chamado. Aguarde um instante, já vai chegar."). O botão
recém-chamado **não** usa `disabled`, e sim `aria-disabled`: continua focável para o leitor dizer que já foi chamado, e o toque
nele não faz nada. A confirmação ("Avisamos o atendente.") é lida em voz alta e some em 6 s; o erro é um alerta com a
ação ("chame o atendente com a mão").

**De onde vem cada coisa (nada inventado, nenhuma regra mudou):** a conta é a da mesa antiga (`mesa/callsLogic`: a chamada vale
2 horas, o botão deixa chamar de novo depois de 1 minuto, uma chamada por tipo) e vive em `loja/tableLogic.ts` (13 testes,
um deles confere que o estado de cada botão bate com o `buttonState` antigo em todos os momentos). Quem decide se atenderam é
o servidor: a tela pergunta a cada 8 s, só enquanto há chamada aberta e a aba está à vista; chamada que o servidor não conhece
mais (404) volta ao normal; sem internet, espera e tenta de novo.

**Ligação ao servidor** (`loja/TableScreen.tsx`, ainda fora do aplicativo público): um toque manda uma chamada pequena; dois
toques seguidos mandam uma só; a chamada só é guardada neste aparelho depois que o servidor aceitou (recarregar a página não
deixa chamar o garçom duas vezes sem querer); o número da mesa vem do `useShop`, sem nova busca. `OrderFlow.tsx` agora abre
na mesa para quem leu o QR (quem já pediu abre no acompanhamento; mesa que o servidor não conhece cai direto no cardápio), e o
cardápio ganhou o botão **"Mesa 4: chamar o garçom"** para voltar à mesa.

**Conferido:** `tests/novo/tableLogic.test.mjs` (13), `toque.test.mjs` (41, com 3D por estado, contraste de cada estado, leitor
de tela e 320 px) e `fluxo.test.mjs` (16). Em 320, 360, 390 e 480 px, nas 15 telas de conferência: sem rolagem lateral, nenhum
botão com menos de 44 px. No navegador: tocar vira "Chamado", o segundo toque não muda nada, a confirmação some em 6 s,
movimento reduzido sem animação, teclado com Tab e Enter. Para ver: `preview-novo.html#/mesa`, `#/mesa-chamada` e `#/loja-mesa`.
**Ainda sem tela:** menu geral (veio na nona rodada) e a bolinha de voz que fala; o painel da mesa do dono (o que chega ao garçom)
continua o antigo.
## Nona rodada: o menu geral de quem trabalha no restaurante (22/10/2026)

O GD deixou a escolha da sequência comigo ("faça conforme melhor evolução", 22/10, 11:01). Escolhi o menu geral primeiro,
porque sem ele nenhuma tela nova pode trocar a antiga e o "Hoje" tem atalhos sem destino. A ordem que segue: mesas no painel do
dono (atender quem chamou o garçom), caixa e entrega, cadastro do cardápio por voz e foto com a logomarca, a bolinha de voz que
fala (depende da chave de IA, que só o GD coloca pelo script no servidor) e o Vem Trabalhar. Nada vai ao ar sem o "pode".

**A tela** (`novo/MainMenu.tsx`): abre do lado do botão de menu, por cima da tela (dentro da coluna de 480 px, mesmo numa janela
larga). Em cima, o restaurante e "João, Dono". Depois, os grupos de sempre: Hoje, Vender, Cardápio, Números, Minha loja e Dono do
sistema. **Cada função é um cartão que se toca** (borda grossa embaixo, afunda no toque) com ícone, nome e uma frase do que faz.
A tela de agora fica afundada e verde (como a opção marcada) e é anunciada como "página atual". O número de pedidos em aberto
(e de chamados e aprovações) vem numa pílula lisa e também é falado ("3 em aberto"). No fim, o que não é tela: **Ver o
cardápio do cliente**, **Preciso de ajuda** (só quem pode) e **Sair**, discreto, em vermelho.

**Nenhuma regra mudou:** quem vê o quê continua sendo decidido por `nav/navLogic.menuFor`, as regras de sempre das abas (o dono vê
tudo; o gerente também, com "Seu negócio"; o garçom vê Hoje, Pedidos, Abrir mesa, Mesas, Produtos, Categorias e Resumo; caixa e
cozinha menos; o que é do dono do sistema e o plano só aparecem para quem tem direito; restaurante bloqueado por falta de
pagamento mantém só o permitido). A conta nova está em `painel/menuLogic.ts` (11 testes, um deles compara cada papel, com e sem
plano e dono do sistema, com o menu antigo linha por linha).

**Cuidados de menu aberto** (`painel/PanelMenu.tsx`, que usa `loja/useSheetBehavior.ts`, o mesmo da folha das escolhas, agora num
arquivo só): a tela de trás não rola, o Esc fecha, o foco entra no menu e volta ao botão que o abriu, o Tab não sai dele, tocar
fora fecha, escolher uma tela fecha sozinho. Movimento reduzido: sem animação. **Escolha minha que o GD pode mudar:** o "Guia
passo a passo" da tela antiga não foi recriado (era uma visita guiada pelas telas antigas); fica o "Preciso de ajuda".

**Ainda não está ligado ao painel público.** O que falta para o menu novo valer de verdade é cada função ter a sua tela nova (hoje
só Hoje e Cozinha têm); até lá o painel antigo continua mandando. Os ícones do menu (28 novos) estão em `novo/Icons.tsx`.

**Como foi conferido:** `tests/novo/menuLogic.test.mjs` (11), `toque.test.mjs` (45, com o 3D, a tela de agora, o diálogo e o
contraste de cada estado) e `fluxo.test.mjs` (19). Em 320, 360, 390 e 480 px, nas 17 telas de conferência: sem rolagem lateral e
nenhum botão com menos de 44 px. No navegador: foco entra no título do menu, Esc fecha, o Tab não sai, tocar fora fecha, o
garçom vê só as sete telas dele. Para ver: `preview-novo.html#/menu` e `#/menu-garcom`.

## Décima rodada: mesas do painel, para atender quem chamou (22/10/2026)

O GD aprovou o menu ("Perfeito, Claude", 11:26) e lembrou para quem tudo isto é feito: gente que mal lê, de quem não tem
funcionário nenhum a casas com 100, 200, 300 pessoas, garçons e cozinheiros. "Menos burocracia, mais facilidade, menos escrita,
menos dados, menos informações." Por isso a tela de mesas não tem formulário: **quem chama vem primeiro, e atender é um toque**.
Segui a ordem que anunciei (a segunda tela). Nada vai ao ar sem o "pode".

**A tela** (`novo/Desk.tsx`): no topo, "Mesas" e a frase "4 mesas chamando" (ou "Ninguém chamando agora"). Embaixo, um cartão por
chamado, o pior primeiro: nome da mesa grande, o que ela quer, há quanto tempo, e o botão verde **"Já atendi"**. A fita de cima é
verde, amarela ou vermelha, **pelo que o servidor já diz** (`backend/table_calls.py`: demorando depois de 3 minutos, urgente depois
de 7 ou quando o cliente tocou duas vezes), e uma pílula repete em palavra ("Está demorando", "Urgente", "Chamou de novo"): a cor
sozinha nunca informa. Tocar no nome da mesa abre a mesa. Depois, o jeito de abrir uma mesa sem escrever: **Ler o QR da mesa**, ou
digitar o número (teclado de números), e **Todas as mesas**: uma ficha por mesa, em três colunas, com "Chamando", "2 chamados",
"1 pedido" ou "Sem pedido" (o sistema nunca diz "livre" ou "ocupada", porque não sabe).

**A mesa aberta** (`novo/DeskTable.tsx`): título, uma frase do que existe ("2 chamados abertos e 2 pedidos em andamento"), os chamados
dela com o mesmo "Já atendi", os pedidos andando (nome, estado, há quanto tempo, valor) e **"Fazer um pedido para esta mesa"**
(abre o cardápio do cliente em outra aba, para o garçom pedir por quem não usa o celular). Nada ali muda um pedido nem o dinheiro:
a única coisa que se faz é atender um chamado. A câmera (`novo/QrScan.tsx`) é um quadrado com moldura, dica e "Cancelar".

**Honestidade:** nenhuma regra mudou. A conta é a da tela antiga: o QR só abre mesa **deste** restaurante (outro restaurante, um
site qualquer ou uma mesa fora do cadastro dizem por que não abriram), o número aceita "4", "04" e "mesa 4", e o chamado vale por
2 horas. A ordem (urgente, depois demorando, depois o resto; dentro de cada grupo, quem espera mais) é minha e está testada
(`painel/deskLogic.ts`, 15 testes). Os chamados aparecem mesmo que a lista de mesas não abra (a ficha vira "Tentar de novo"), e
nesse caso o cartão só informa, sem abrir mesa.

**Ligação ao servidor** (`painel/DeskScreen.tsx`): pergunta os chamados a cada 6 s e os pedidos a cada 8 s, **só com a aba à vista**.
Uma busca que falha nunca apaga o que está na tela. **"Já atendi" vai ao servidor e só depois o cartão some**; se não deu, o cartão
fica e a tela diz "Não deu para marcar como atendida. Confira a internet e toque de novo." Um chamado que acabou de ser atendido
não volta por uma busca que já tinha saído (`withoutAnswered`). **Chamado novo faz o aparelho vibrar e apitar uma vez**, e o que
vira urgente apita mais uma; o que já estava aberto quando a tela abriu não faz alarde (as mesmas regras do aviso antigo). O leitor
de QR (`painel/useQrReader.ts`) usa o leitor do próprio navegador, não grava nem envia nada, e desliga a câmera ao ler, ao
cancelar e ao sair. Aparelho que não lê QR aqui dentro recebe a frase que diz o que fazer.

**Cuidados de acessibilidade:** a frase de quantas mesas chamam mora sempre na página e é lida em voz alta quando muda; cada botão
"Já atendi" é lido por inteiro ("Já atendi. Mesa 7. Chama o garçom. há 8 min, chamou de novo. Urgente."); o foco vai para o
próximo botão depois de atender, para o título ao abrir uma mesa e para a frase ao voltar; o erro é alerta.

**Escolha minha que o GD pode mudar:** o aviso "N mesas chamando" que o painel antigo põe no topo de **todas** as telas
(`mesa/CallsBar`) não foi recriado aqui. O "Hoje" já mostra os chamados e esta tela os atende. Um aviso que acompanha o garçom em
qualquer tela é da casca do painel e entra na hora de ligar tudo.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando). A outra tela de mesa do menu antigo, a de
**cadastrar mesas e imprimir o cartaz com QR**, é do dono, não do garçom, e fica para a rodada do cadastro.

**Como foi conferido:** `tests/novo/deskLogic.test.mjs` (15), `toque.test.mjs` (53, com o 3D, as pílulas, o contraste e o 320 px),
`fluxo.test.mjs` (23). Em 320, 360, 390 e 480 px, nas 23 telas de conferência: sem rolagem lateral e nenhum botão com menos
de 44 px. No navegador, com a tela de verdade e um servidor de mentira: abre com os chamados e a lista; a primeira busca é
silenciosa; chamado novo entra e vibra uma vez; "Já atendi" chega ao servidor com o código certo e o foco vai ao próximo botão;
atendido não volta mesmo que o servidor ainda o mande; erro deixa o cartão e diz o que fazer; abrir a mesa leva o foco ao título;
QR da mesa abre a mesa, QR de outro restaurante e QR que não é de mesa dizem por quê, e a câmera desliga em todos os casos.
Para ver: `preview-novo.html#/mesas`, `#/mesas-calmo`, `#/mesas-qr`, `#/mesas-carregando`, `#/mesas-erro` e `#/mesa-aberta`.

## Décima primeira rodada: pedidos e caixa (22/10/2026)

O GD pediu "segurança de todas as entradas e acessos, ataques, e front-end profissional" (11:53). Esta é a terceira tela da sequência
(depois do menu e das mesas): **onde o pedido é aceito, andado e pago**. Primeiro fiz uma varredura de segurança do visual novo, depois a
tela. Nada vai ao ar sem o "pode".

**A tela** (`novo/Orders.tsx`): "Pedidos" e uma frase ("3 pedidos novos para aceitar"). Quatro etapas, duas por linha: **Novos**
(esperando aceite), **Andamento** (em preparo, pronto, a caminho), **Receber** (tudo que ainda não foi pago, em qualquer etapa) e **Feitos**
(os 20 mais novos já encerrados). Quem não confirma pagamento (garçom, cozinha) **não tem a aba Receber**. Um cartão por pedido, o que
espera mais em cima, com a fita verde, amarela ou vermelha pelo tempo (até 10 min, até 20, depois) e a espera também em número:
mesa, entrega ou retirada em letra grande; nome e código curto (#A1B2); a etapa e o pagamento **em palavra** ("Aguardando", "Dinheiro:
receber", "Pix pago"); para entrega e retirada, o endereço, a região, a referência, **o telefone como botão de ligar** e quem está com a
entrega; os itens com as escolhas e a observação do cliente; o total (e "Itens R$ 42,00 + entrega R$ 6,00" quando há taxa); e, no
dinheiro, **"Cliente paga com R$ 50,00 · devolver R$ 8,00"**. Embaixo, no máximo três botões: **"Pagamento recebido"** (laranja, só dono,
gerente e caixa, só enquanto não está pago), o **botão grande que avança o pedido** (verde: "Aceitar pedido", "Pedido pronto", "Pronto
para entrega", "Saiu para entrega", "Entregue") e o atalho pequeno "Já saiu para entrega". Na aba Receber o dinheiro vem primeiro; nas
outras, o avanço. O caixa abre direto em Receber. Cada botão é lido com a mesa e o código ("Aceitar pedido. Mesa 7, pedido A1B2."), para
dois botões iguais nunca soarem iguais.

**Honestidade:** nenhuma regra mudou. As palavras e o próximo passo do pedido vêm de `service/orderStatus.ts` (o que o servidor aceita);
como o pedido sai, de `service/orderHandling.ts`; o chip de pagamento e quem confirma o dinheiro, de `customer/payment.ts`. O valor, a
taxa e o total são os que o servidor gravou. **O troco a devolver é a única conta nova: o que o cliente entrega menos o total** (o servidor
já exige que ele entregue pelo menos o total). Uma comanda de cozinha e um cartão de caixa leem as mesmas linhas (`linesOf`).

**Ligação ao servidor** (`painel/OrdersScreen.tsx`): pergunta os pedidos a cada 5 s, **também com a aba escondida** (como a tela antiga e a
cozinha: o aparelho precisa apitar pedido novo mesmo com a tela em segundo plano). Apita pedido novo **por número do pedido**, não por
quantidade (o servidor só manda os 200 mais recentes). Uma busca que falha nunca apaga a tela: aparece "Sem conexão com o servidor. Os
pedidos na tela podem estar desatualizados." e some sozinha quando volta. **Um toque por vez.** **Antes de mandar um toque, a tela olha o
pedido de novo no servidor**: se outra pessoa já mexeu (já aceitou, já saiu, já foi pago), **não manda**, atualiza e diz "Este pedido já
mudou. A tela foi atualizada." Isso existe porque o servidor aceita qualquer estado vindo de qualquer estado (ver abaixo): sem isso, um
toque velho levaria um pedido encerrado de volta para "Aguardando". A tela antiga só escrevia o erro no console; esta diz o que fazer:
"Não deu para mudar o pedido. Confira a internet e toque de novo." e "Não deu para marcar como pago. Confira a internet e toque de novo."

**Segurança: o que achei e o que fiz**

Consertado agora, no visual novo (com teste):
1. **Link do Vem Trabalhar no cardápio** vinha do servidor e ia direto para `href`. Agora só vale endereço `https` (a mesa já fazia assim).
2. **Imagem do QR Pix** vinha do servidor e ia direto para `src`. Agora só vale `data:image/png;base64,…` de tamanho razoável; qualquer outra
   coisa (endereço de fora, SVG, texto) some.
3. Varredura: nenhum HTML injetado (`dangerouslySetInnerHTML`, `innerHTML`, `eval`) nas telas novas, links externos com `noopener noreferrer`,
   o telefone só vira `tel:` com dígitos, nada de dado pessoal guardado no aparelho. Um teste cobre cada ponto.
4. **No papel de cada pessoa:** a cozinha e o entregador **não veem endereço nem telefone** de quem pediu (só a região); garçom, caixa,
   gerente e dono veem. Isto é só o mínimo na tela.

**Não consertado, e é do servidor** (digo com franqueza; proponho um PR à parte, com teste, e não junto nada sem o "pode"):
- **S1. Quem vê telefone e endereço de todos os clientes.** `GET /companies/<id>/admin/orders` manda o telefone e o endereço dos últimos 200
  pedidos para **qualquer login do restaurante** (menos entregador). Pela LGPD (mínimo necessário), cozinha e garçom não deveriam receber. A tela
  esconde, mas o dado ainda chega ao aparelho. Só o servidor resolve.
- **S2. Qualquer estado a partir de qualquer estado.** `PUT /orders/<id>/status` aceita qualquer das cinco palavras vinda de qualquer outra, para
  qualquer papel (menos entregador). Um toque errado, ou um login de cozinha compartilhado e comprometido, pode reabrir pedido encerrado ou
  encerrar pedido que ninguém fez. A tela nova confere antes de mandar, o que encurta a janela, mas **só o servidor pode impedir**.
- **S3. Ninguém assina o que fez.** `order_events` e `payments` não guardam **quem** mudou o pedido ou confirmou o dinheiro (só a hora).
  Num caso de dinheiro faltando no caixa não há como saber quem marcou "Pagamento recebido".

**Escolhas minhas que o GD pode mudar:**
- Os "Feitos" mostram só os 20 mais novos (para conferir, não para arquivo); histórico e números ficam em "Seu negócio".
- Pedido entregue e ainda não pago **continua em Receber** (e só depois de pago vai para Feitos); quem não tem a aba Receber o vê em Feitos.
- **Não há botão de cancelar:** o servidor não tem estado "cancelado".
- As telas de **entregas** (entregador, com código do cliente) e de **acerto do caixa** foram refeitas na rodada seguinte (décima segunda).
- Esta tela ainda **não guarda a regra de quem pode abrir** (rota por papel): isso é da casca do painel, na hora de ligar tudo.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

**Como foi conferido:** `tests/novo/ordersLogic.test.mjs` (28), `toque.test.mjs` (59), `fluxo.test.mjs` (28), `trackingLogic.test.mjs` (+1);
1102 testes passam no total. Em 320, 360, 390 e 480 px, nas 30 telas de conferência: sem rolagem lateral e nenhum botão com menos de 44 px.
No navegador, com a tela de verdade e um servidor de mentira: dois toques seguidos mandam um envio só; "Aceitar" e "Pagamento recebido"
chegam com o código certo; o foco volta ao pedido; pedido novo vibra uma vez; pedido que já mudou **não** é mandado e não volta para trás;
erro ao avançar e ao receber deixam o botão pronto de novo; sem servidor, os pedidos ficam e a frase some quando volta; garçom não tem a
aba nem o botão de pagamento; cozinha não vê telefone nem rua; o caixa abre em Receber.
Para ver: `preview-novo.html#/pedidos`, `#/pedidos-caixa`, `#/pedidos-garcom`, `#/pedidos-cozinha`, `#/pedidos-calmo`, `#/pedidos-erro` e `#/pedidos-enviando`.

## Décima segunda rodada: entregas e acerto do caixa (22/10/2026)

Quarta tela da sequência (depois do menu, das mesas e dos pedidos): **quem leva o pedido até a porta e quem confere o dinheiro que
ele traz de volta**. O GD pediu "mais facilidade, intuitivo, dinâmico" e "menos escrita, menos dado": por isso cada tela mostra só o que
a pessoa precisa naquele momento. Nada vai ao ar sem o "pode".

**Entregas** (`novo/Deliveries.tsx`, ligada em `painel/DeliveriesScreen.tsx`): título "Entregas" e uma frase ("2 para pegar · 1 a caminho").
Três etapas, curtas para caber em 320 px: **Pegar**, **Na rua**, **Entregues**. Abre sozinha na etapa que tem trabalho (quem já está com um
pedido na rua vê a rua) e **não pula de aba depois** debaixo do dedo. Cada entrega é um cartão: o nome e o código curto; o **endereço em letra
grande**, com a região e a referência; **quanto receber na porta e o troco a levar** ("Receber R$ 48,00 em dinheiro · Leve R$ 52,00 de troco",
ou "Valor exato, sem troco"); **Ligar** e **Mapa** lado a lado; e embaixo um botão verde só: **Peguei**, depois **Entreguei**. "Entreguei" abre o
campo dos **4 números do cliente** (o teclado de números sobe e o foco já está no campo); só deixa confirmar com os 4. O pedido que não tem
código diz isso e deixa confirmar. A entrega que outro motoqueiro levou aparece só para ver (gerente), **sem botão, sem telefone, sem mapa e
sem dinheiro**. No alto fica sempre a **dívida dele com o caixa** ("Você está com R$ 73,00 em dinheiro de 2 entregas. Entregue ao caixa para
o acerto."), porque não pode sumir com a mudança de aba.

**Honestidade e correção:** nenhuma regra mudou. Quem pode pegar, se o código está certo, quantas tentativas sobram e quanto dinheiro está em
aberto é decisão do servidor (`backend/courier.py`); o telefone, o mapa, o dinheiro e o código vêm da mesma conta da tela antiga
(`courier/courierLogic.ts`, já testada). **Uma correção em relação à tela antiga:** o dinheiro de uma entrega fechada por outro motoqueiro dizia
"ainda com você" também para o gerente; agora diz "ainda com o motoqueiro" quando não é dele.

**Ligação ao servidor:** pergunta a cada 10 s, **só com a tela à vista** (poupa a bateria do motoqueiro; volta a perguntar assim que a tela
volta). Apita (e vibra) quando aparece entrega **nova para pegar**, por número do pedido, e abrir a tela pela primeira vez não faz barulho.
**Um toque por vez.** Código errado: mostra a frase do servidor ("Restam 2 tentativas"), **apaga o que foi digitado** e deixa tentar de novo.
Bloqueado: o campo some e a tela manda avisar o restaurante. **Sem sinal ao entregar:** "Não sei se a entrega foi registrada… não tem
problema repetir", e repetir é seguro porque o servidor responde "já estava fechada". Uma busca que falha nunca apaga a lista.

**Acerto do caixa** (`novo/Settle.tsx`, ligada em `painel/SettleScreen.tsx`): um cartão por motoqueiro, com o **total que ele deve** no alto e cada
entrega como linha que se marca (cliente, região, hora, valor). **Tudo vem marcado**; o caixa tira o que o motoqueiro não trouxe. O botão diz
o que vai acontecer: **"Recebi R$ 72,50 de Ana Silva (3 entregas)"**. **Dinheiro pede dois toques:** o primeiro troca o botão para verde com
"Toque de novo para confirmar" e repete a frase embaixo; se a marcação mudar, ou passarem 4 s, o primeiro toque se perde. **Antes de mandar, a
tela olha o servidor de novo:** se uma entrega marcada já foi acertada por outra pessoa, ou o valor mudou, **não manda nada**, atualiza e diz
"Esta lista já mudou… confira de novo". **A lista não se atualiza sozinha, de propósito:** o total que o caixa contou não pode mudar debaixo
dele; ela atualiza ao abrir, no botão "Atualizar a lista" e depois de acertar. Sem sinal: "Nada foi acertado."

**Como foi conferido:** `tests/novo/deliveriesLogic.test.mjs` (19), `settleLogic.test.mjs` (15), `fluxo.test.mjs` (+7), `toque.test.mjs` (+7);
1150 testes passam no total. Em 320, 360, 390 e 480 px, nas 14 telas novas de conferência: sem rolagem lateral, nenhum botão com menos de 44 px
e nenhum toque coberto por outra peça. No navegador, com a tela de verdade e um servidor de mentira (53 conferências): dois toques em "Peguei"
mandam um envio só; o campo do código recebe o foco, só aceita números e no máximo 4; código errado apaga o campo; **três erros bloqueiam** e
o servidor recebe exatamente 3 tentativas; sem sinal ao entregar avisa que repetir é seguro e a mesma entrega fecha depois; entrega nova vibra
uma vez; a aba não pula; sem servidor a lista fica e a frase some sozinha; no acerto, o primeiro toque não manda nada, mexer na marcação
desarma, em 4 s desarma sozinho, a lista não pergunta sozinha, sem sinal diz que nada foi acertado, o servidor recebe **só a entrega marcada**,
e lista que já mudou **não é mandada**.
Para ver: `preview-novo.html#/entregas`, `#/entregas-pegar`, `#/entregas-entregues`, `#/entregas-codigo`, `#/entregas-bloqueado`,
`#/entregas-erro`, `#/entregas-calmo`, `#/entregas-carregando`, `#/entregas-gerente`, `#/acerto`, `#/acerto-confirmar`, `#/acerto-calmo`,
`#/acerto-erro` e `#/acerto-carregando`.

**O que ainda falta no menu de quem trabalha** (o menu tem 21 entradas; estas têm tela nova, as outras ainda são as antigas):

| Entrada do menu | Tela nova |
| --- | --- |
| Hoje, Pedidos, Abrir mesa, Mesas, Entregas, Acerto de caixa | **Pronta** (desenho + ligação, fora do painel público) |
| Assistente (montar o cardápio por foto, arquivo ou voz) | **Pronta** na décima terceira rodada (falta o caminho "começar de um modelo") |
| Produtos, Categorias | **Prontas** na décima quarta rodada (ver, esgotar, criar, **mudar** e remover; faltam foto e opções do prato) |
| Seu negócio, Custos, Pagamento | Falta |
| Meu link, Horário, Regiões de entrega, Marca, Equipe, Plano | Falta |
| Aprovações, Assinaturas, Chamados (dono do sistema) | Falta |

**Ainda não resolvido:** a regra de quem pode abrir cada tela (casca do painel, na hora de ligar tudo) e o aviso de "N mesas chamando" no
topo de qualquer tela. As lacunas de servidor S1 a S3 continuam como estavam; nada foi mexido no servidor.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Décima terceira rodada: montar o cardápio por foto, arquivo ou voz (22/10/2026)

Quinta tela da sequência (menu, mesas, pedidos, entregas e acerto, e agora o **cadastro do cardápio**). Continua o que o GD delegou ("Ok, prossiga", 22/10, 14:21).
Segue o princípio dele: ferramenta fácil para quem escreve pouco, **menos escrita, menos dado**. Nada vai ao ar sem o "pode".

**Telas** (`novo/MenuSetup.tsx`, ligada em `painel/MenuSetupScreen.tsx`; as contas estão em `painel/menuSetupLogic.ts`):

1. **Como você quer montar?** Três cartões grandes: **Foto do cardápio** (câmera de trás), **Arquivo do cardápio** (planilha, e PDF quando o servidor lê) e
   **Falar os pratos**. Antes de o servidor responder **não aparece cartão nenhum** (a ordem só se decide quando se sabe o que cada um faz). Depois, o que
   funciona vem primeiro e o que o servidor ainda não lê fica **liso, com o porquê escrito**. Falar sempre funciona; sem microfone, escreve-se.
2. **Páginas** (só na foto): miniaturas das fotos (só as do próprio aparelho, `blob:`), um X de 44 px para tirar uma, "Tirar outra página", "Escolher da galeria"
   (várias de uma vez) e **Ler o cardápio**. Cabem 4 páginas; se vierem mais, a tela diz que as outras ficaram de fora.
3. **Lendo:** "Lendo o cardápio…" com **Cancelar**. A leitura tem prazo de 100 s; uma resposta que chega depois de cancelar não muda a tela.
4. **Falar:** a tecla grande do microfone (ouvindo, ela pulsa e a frase diz que está ouvindo). As palavras aparecem enquanto a pessoa fala, e **tocar para
   parar não joga fora o que já foi ouvido**. Um campo "Ou escreva os pratos" faz a mesma coisa. Valem frases como "x-tudo 25, coca 6", "bebidas coca lata 6",
   "tira x-salada" e "pronto". Cada prato entra com o preço, ou "sem preço" (nunca zero). Lixeira tira.
5. **Conferir:** o **prato sem preço fica separado no alto**, com o lápis amarelo. O resto aparece por categoria, com lápis (muda nome e preço; **Pronto**
   confirma) e lixeira. **Preço que parece engano de escuta** ("300" no lugar de "3,00") é apontado e **só muda se a pessoa tocar em "Usar 3,00"**. A tecla
   **Cadastrar N pratos** fica presa embaixo, com a nota de quantos pratos sem preço não entram.
6. **Cadastrado:** "Cardápio cadastrado" com a contagem **do servidor** (novos e já existentes). Sem resposta do servidor, a tela não escreve número.

**Honestidade e cuidado:** nenhuma regra mudou. Ler foto, planilha e PDF é decisão do servidor (foto e PDF precisam da chave da IA). Entender a fala,
tirar prato e conferir preço vêm da lógica do assistente antigo, que já era testada (`assistant/assistantFlow`, `spokenMenu`, `priceCheck`, `menuPhotoLogic`,
`doorLogic`). **Prato sem preço nunca vai ao cardápio** e a tela diz quantos ficam de fora. O cadastro **só acrescenta** (o que já existe não repete) e tem
trava de um toque por vez. **Uma correção:** a frase de "sem sinal" ao cadastrar não afirma mais "nada foi cadastrado" (a resposta pode ter se perdido depois de o
servidor cadastrar); agora manda conferir a internet e tocar de novo, porque o que já entrou não repete. Nome de prato e de categoria que vêm do servidor ou da
fala **nunca entram como HTML**.

**Como foi conferido:** `tests/novo/menuSetupLogic.test.mjs` (42), `fluxo.test.mjs` (+6), `toque.test.mjs` (+9) e a lista de palavras proibidas; 1207 testes
passam no total (novo: 384). Em 320, 360, 390 e 480 px, nas 17 telas de conferência do cardápio: sem rolagem lateral, nenhum botão com menos de 44 px e nenhum
toque coberto. No navegador, com a tela de verdade, um servidor de mentira e um reconhecedor de voz de mentira (77 conferências): só aparece cartão depois de o
servidor responder; sem leitura no servidor, Falar vem primeiro e foto e arquivo ficam desligados com o porquê; duas fotos viram duas miniaturas; nada é mandado
antes de tocar em Ler; cancelar não deixa a resposta tardia mudar a tela; sem internet a foto fica e dá para tentar de novo; foto sem cardápio é descartada;
planilha grande demais é recusada antes de ir ao servidor; texto com HTML aparece como texto; **dois toques em Cadastrar mandam um cadastro só**, com só os pratos
que têm preço, já com o nome e o preço corrigidos; erro do servidor passa como veio; falar e escrever dão o mesmo resultado; o microfone mostra as palavras na hora
e tocar para parar as guarda. (Achado de passagem: o Chrome novo traz o reconhecedor de voz também sem prefixo, e o aplicativo já olha os dois.)
Para ver: `preview-novo.html#/cardapio`, `#/cardapio-sem-foto`, `#/cardapio-sem-ia`, `#/cardapio-carregando`, `#/cardapio-erro`, `#/cardapio-foto`,
`#/cardapio-foto-erro`, `#/cardapio-lendo`, `#/cardapio-falar`, `#/cardapio-ouvindo`, `#/cardapio-sem-microfone`, `#/cardapio-conferir`, `#/cardapio-editando`,
`#/cardapio-sem-preco`, `#/cardapio-vazio`, `#/cardapio-erro-cadastro` e `#/cardapio-cadastrado`.

**O que ainda falta no cadastro do cardápio** (por isso o menu ainda não troca a entrada "Assistente"):

| Item | Situação |
| --- | --- |
| Foto, arquivo e falar os pratos; conferir e cadastrar | **Pronto** (desenho + ligação, fora do painel público) |
| "Começar de um modelo" (escolher o tipo de negócio e tocar nos pratos) | Falta; esse caminho só existe na tela antiga |
| Produtos (ver, esgotar, criar, mudar, remover) e Categorias | **Prontos** na décima quarta rodada; foto e opções do prato seguem faltando |
| Logomarca (entrada "Marca" do menu) | Falta |
| A bolinha de voz que escuta e navega | Falta (o que passa de navegar e ler precisa da chave da IA, que ele mesmo digita em `configurar-ia.sh`) |

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Décima quarta rodada: pratos e categorias (22/10/2026)

Segunda tela do cadastro do cardápio (a primeira foi montar por foto, arquivo ou voz). Continua o que o GD delegou ("Ok, prossiga", 22/10, 14:21) e
segue o princípio dele: ferramenta fácil, **menos escrita, menos dado**. Nada vai ao ar sem o "pode".

**Telas** (`novo/Dishes.tsx` e `novo/Categories.tsx`, ligadas em `painel/DishesScreen.tsx` e `painel/CategoriesScreen.tsx`; as contas estão em
`painel/dishesLogic.ts` e a rede em `painel/dishesApi.ts`):

1. **Pratos.** Os pratos do restaurante por categoria, com "Sem categoria" no fim. Cada cartão tem foto (sem foto, um garfo), nome, preço e o selo
   "Esgotado" (e o de opções, quando o prato tem). Três botões por prato: **Esgotou / Voltou**, o **lápis** (mais abaixo) e a **lixeira** com dois toques (o primeiro só avisa
   "Toque de novo para remover" e desarma sozinho em 4 s). Esgotou e Voltou valem na hora na tela e **voltam atrás se o servidor recusar**. Quando há
   esgotados, uma faixa no alto diz quantos e traz **Voltou tudo**. A busca (sem maiúscula nem acento) só aparece a partir de 8 pratos.
   **Novo prato:** nome, preço, categoria (se houver alguma) e um texto opcional. Antes de mandar, a tela confere nome vazio, preço que não entendeu e
   prato repetido na mesma categoria. O formulário fica aberto e guarda a categoria, para quem cadastra vários seguidos.
   **Mudar o prato (o lápis):** entre o Esgotou e a lixeira. Abre o mesmo formulário já preenchido com o que o prato tem (preço escrito como se digita:
   "25,00"), com **Salvar** e **Cancelar**; o cartão do prato fica apagado com a frase "Mudando este prato" e os botões dele param. **Só vai ao servidor o que
   a pessoa mexeu**; sem mexer em nada, Salvar só fecha. O nome só é "arrumado" (inicial maiúscula, espaços) se a pessoa mexeu nele: um nome salvo
   em minúscula não é renomeado sem ninguém pedir. Repetido só conta quando o nome ou a categoria mudam, e o prato não conta contra si mesmo: mudar só o
   preço nunca é barrado. Quando termina, o foco volta para o lápis do prato.
2. **O que esgotou** (cozinha). A mesma tela, sem Novo prato e sem lixeira: a cozinha só marca o que esgotou e o que voltou.
3. **Categorias.** Cada categoria com quantos pratos tem; "Adicionar categoria" (nome limpo e com inicial maiúscula; vazio e repetido não vão ao
   servidor); lixeira com dois toques. A tela diz que **os pratos não somem: ficam sem categoria**.

**Honestidade e cuidado:**

- A lista é a do servidor; nada é inventado. Antes de ela chegar a tela diz "Abrindo os pratos…" e **não** diz "Nenhum prato ainda" nem oferece criar.
- Uma busca da lista que saiu antes de um toque **nunca desfaz o toque** (a resposta velha é descartada). Com a tela à vista a lista pergunta de novo
  a cada 30 s e quando a pessoa volta à tela, para ver o que outro aparelho marcou.
- Recusa do servidor (erro 4xx) passa como veio; sem sinal ou erro 5xx usa a nossa frase. **"Sem sinal" ao adicionar não afirma que nada entrou**: manda
  olhar a lista antes de tentar de novo, porque a resposta pode ter se perdido depois de o servidor cadastrar. Login vencido volta ao login.
- **"Sem sinal" ao salvar uma mudança também não afirma que nada mudou**: manda olhar a lista, porque a resposta pode ter se perdido depois de o servidor
  salvar (a tela olha a lista de novo logo depois de cada Salvar, tenha dado certo ou não). Se outro aparelho removeu o prato com o formulário aberto,
  Salvar não manda nada e diz "Esse prato não está mais na lista. Alguém o removeu."
- Nome de prato e de categoria que vêm do servidor **nunca entram como HTML** (nem dentro do campo do lápis).
- **Defeito pego pela prova no navegador, já corrigido:** a busca da lista, que roda logo depois de um cadastro que falhou, apagava a frase de erro
  ("veja na lista se o prato já entrou") antes de alguém lê-la. Agora o erro da ação e o erro da lista são separados, e um teste trava isso.

**Servidor (PR #76, em rascunho) e o que mudou de comportamento:**

- O lápis usa `PUT /api/admin/products/<id>`, **rota nova do PR #76**. Esse PR precisa entrar na `main` **antes** da tela nova ir ao ar. Num servidor sem
  a rota o lápis responde "O servidor ainda não sabe mudar prato. Falta atualizá-lo." e nada se perde.
- A rota só aceita dono e gerente, confere de novo nome (1 a 150 letras; passou do limite, recusa em vez de cortar), texto (até 500, uma linha), preço
  (maior que zero, até 99.999,99) e categoria, recusa prato repetido na mesma categoria (409) e **só muda o que veio** (campo ausente fica como está).
  Pedidos antigos guardam o preço da época (`order_items.unit_price`), então mudar o preço não mexe no que já foi vendido.
- **Prato que já foi pedido não se apaga mais** (409, com a frase "Este prato já foi pedido… Para tirar do ar, toque em Esgotou."). Conferi o banco do
  VPS: o instalador carrega `database/schema.production.sql`, onde os itens de pedido apagam junto (`ON DELETE CASCADE`); sem essa trava, apagar um prato
  levaria embora os itens dos pedidos antigos e as vendas. O servidor trava a linha do prato antes de decidir, para um pedido novo com ele não entrar no meio; e criar ou mudar um prato passa um de cada vez por restaurante, para dois toques seguidos não furarem a conferência de repetido.
- Criar prato com preço zero passou a ser recusado (a mesma regra do cadastro por foto, arquivo ou voz).

**O que a tela não faz:**

- **Esconder um prato de verdade** (sem ser "Esgotou"): o banco não tem uma coluna de "ativo" nos pratos. Precisaria de uma mudança no banco, que só faço
  com o "pode" do GD. Hoje o **Esgotou** faz o papel: o cliente vê o prato, mas não consegue pedir.
- **Foto e opções do prato** (grupos de escolhas) ficam para a próxima rodada; hoje a tela só mostra o que já existe.

**Como foi conferido:** `tests/novo/dishesLogic.test.mjs` (41), `fluxo.test.mjs` (+13), `toque.test.mjs` (+8) e a lista de palavras proibidas;
446 testes passam só na pasta do visual novo, e todas as outras pastas de teste do CI também. Em 320, 360, 390 e 480 px, nas 20 telas de conferência de pratos e categorias: sem rolagem lateral, nenhum
botão com menos de 44 px e nenhum toque coberto. No navegador, com a tela de verdade e um servidor de mentira (167 conferências): Esgotou aparece na
hora e **volta atrás** quando o servidor recusa (erro, sem sinal e recusa com frase); toque repetido enquanto espera manda **um** pedido só; dois pratos tocados
juntos chegam os dois; uma busca atrasada não desfaz o toque; remover pede dois toques, desarma em 4 s e trava os outros botões enquanto espera; prato novo sem
nome, com preço que não entendeu ou repetido **não vai ao servidor**, e vai **uma vez** mesmo com toque e Enter repetidos; resposta perdida depois de cadastrar
mostra o prato na lista; o login vencido volta ao login; a cozinha não vê Novo prato, lápis nem lixeira; texto com HTML aparece como texto.
**O lápis:** abre preenchido e com o foco no nome; salvar sem mexer em nada não fala com o servidor; só o campo mexido vai (preço sozinho, nome e categoria
juntos, texto apagado vai vazio, "Sem categoria" vai como nulo); nome de outro prato da mesma categoria, preço ruim, zero e nome vazio não vão; toque e
Enter repetidos mandam **um** pedido só; sem sinal, erro, recusa, prato não achado e servidor sem a rota mostram a frase certa e **deixam o formulário
aberto com o que foi digitado** (e tentar de novo depois funciona); resposta perdida depois de salvar mostra o preço novo na lista; prato removido por outro
aparelho fecha o formulário com a frase; trocar para o lápis de outro prato recomeça com os dados dele; Cancelar não manda nada e leva o foco de volta; os
lápis esperam enquanto algo é removido ou salvo; HTML no nome e no texto aparece como texto; prato já pedido não se apaga e a frase do servidor chega à tela.
Para ver: `preview-novo.html#/pratos`, `#/pratos-cozinha`, `#/pratos-novo`, `#/pratos-novo-erro`, `#/pratos-mudar` (o lápis, formulário preenchido), `#/pratos-mudar-erro` (nome que já existe), `#/pratos-remover`, `#/pratos-busca`,
`#/pratos-sem-resultado`, `#/pratos-vazio`, `#/pratos-vazio-cozinha`, `#/pratos-sem-categorias`, `#/pratos-carregando`, `#/pratos-erro`, `#/categorias`,
`#/categorias-vazio`, `#/categorias-remover`, `#/categorias-repetida`, `#/categorias-erro` e `#/categorias-carregando`.

**O que ainda falta no cadastro do cardápio:**

| Item | Situação |
| --- | --- |
| Foto, arquivo e falar os pratos; conferir e cadastrar | **Pronto** (décima terceira rodada) |
| Ver, esgotar, criar e remover pratos; categorias | **Pronto** (desenho + ligação, fora do painel público) |
| Mudar nome, preço, texto e categoria de um prato | **Pronto** (o lápis); depende da rota nova do PR #76 de servidor, que só entra com o "pode" |
| Esconder um prato de verdade (sem ser Esgotou) | Falta; precisa de uma coluna nova no banco, só com o "pode" |
| Foto do prato e opções do prato | Falta (próxima rodada) |
| "Começar de um modelo" (escolher o tipo de negócio e tocar nos pratos) | Falta; esse caminho só existe na tela antiga |
| Logomarca (entrada "Marca" do menu) | Falta |
| A bolinha de voz que escuta e navega | Falta (o que passa de navegar e ler precisa da chave da IA, que ele mesmo digita em `configurar-ia.sh`) |

**Ainda não resolvido:** quem abre cada tela, na casca do painel. O servidor deixa dono e gerente criar e apagar, e deixa dono, gerente e cozinha marcar
esgotado; o garçom não marca nem cria. O menu antigo mostra Produtos e Categorias ao garçom, e a casca nova precisa decidir o que ele vê. A cozinha entra em
Pratos no modo "O que esgotou"; Categorias é só de dono e gerente.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Décima quinta rodada: começar de um modelo (22/10/2026)

Quarto jeito de montar o cardápio, o que mais serve a quem escreve pouco: **escolher o tipo do negócio e tocar nos pratos que vende**, sem digitar nenhum
nome. Continua o que o GD delegou ("Prossiga", 22/10, 18:45, depois de eu perguntar qual item vinha agora) e segue o princípio dele: **menos escrita, menos
dado**. Nada vai ao ar sem o "pode", e **nada vai ao servidor até o Cadastrar**.

**Telas** (`novo/MenuModel.tsx`, ligada na tela de montar `novo/MenuSetup.tsx` e em `painel/MenuSetupScreen.tsx`; as contas estão em
`painel/menuModelLogic.ts`, que usa as contas testadas do assistente antigo, sem mudar nenhuma regra):

1. **A porta** ganhou o quarto cartão, **"Começar de um modelo"**. Ele só precisa da lista de tipos, que o servidor sempre tem; por isso fica sempre pronto
   (depois dos que leem foto e arquivo quando eles funcionam, e logo depois de "Falar os pratos" quando não funcionam).
2. **O tipo do negócio.** "O que você vende?", um campo de busca ("tapioca, bolo, pizza…", sem ligar para maiúscula nem acento) e os tipos em teclas
   grandes, duas por linha, com o desenho que o servidor manda (🥪 Lanchonete, 🍕 Pizzaria, 🥙 Tapiocaria…). Tocar abre o modelo; enquanto abre, as teclas esperam e a
   frase diz "Abrindo o modelo…". Enter na busca não manda nada. **Voltar nunca trava.**
3. **Tocar nos pratos, categoria por categoria.** O nome da categoria grande, quantos estão marcados, **Marcar todos / Tirar todos**, e cada prato é uma tecla de
   marcar (a caixa afunda e fica verde; o leitor de tela ouve "marcado"). **"Falta um prato? Escreva aqui"** acrescenta um prato que o modelo não tem, já
   marcado (se já existe, só marca; se já está marcado, diz isso). A tecla presa embaixo diz para onde vai: "Próxima: Salgados" e, na última, "Colocar os
   preços (5)". Se **nenhum** prato ficou marcado em lugar nenhum, ela não segue e diz "Marque pelo menos um prato para seguir." Uma categoria sem nada marcado
   simplesmente fica de fora ("Nenhum marcado. Esta categoria fica de fora."). Voltar anda uma categoria e **o que foi marcado fica**; da primeira, volta
   aos tipos.
4. **O preço, um prato por vez.** Categoria pequena em cima, o nome do prato grande, "Quanto você cobra?" e um campo grande de número (teclado de números),
   já com o foco. "Próximo prato" (no último, "Conferir tudo"); vírgula, ponto e "R$" valem; texto que não é número, ou campo vazio num prato sem preço,
   **não segue** e diz "Não entendi esse preço. Escreva só números, por exemplo 18,50." **"Tirar este prato"** tira da lista e já mostra o seguinte. Voltar
   mostra o prato de antes **com o preço que a pessoa já escreveu**, e Enter com esse preço segue sem pedir de novo.
5. **Conferir e cadastrar** são as da conferência de sempre (a mesma de foto, arquivo e voz): lápis para mudar nome e preço, lixeira, aviso de preço que
   parece engano, "Cadastrar N pratos". O texto de cima diz "Confira os pratos e os preços. Corrija o que precisar e cadastre." Voltar da conferência volta
   ao último preço. O prato do modelo cujo nome a pessoa muda passa a ser dela (assim o nome novo vale).

**Honestidade e cuidado:**

- **O preço de cada prato é sempre o que a pessoa escreveu**: o modelo vem sem preço e nenhum palpite é preenchido.
- A lista de tipos e o modelo escolhido que vêm do servidor são lidos com desconfiança: só entra o que tem identificador simples e nome, repetido sai, categoria
  sem prato sai, e há tetos (60 tipos, 40 categorias, 200 pratos por categoria). Resposta que não é uma lista vira frase ("O servidor respondeu algo que não
  entendi."), lista vazia vira "Ainda não há modelos prontos." e modelo sem nenhum prato vira "Esse modelo veio sem pratos."; nenhuma dessas mostra "não achei"
  nem "nenhum tipo" como se fosse verdade, e todas têm **Tentar de novo** (ou tocar no tipo outra vez).
- "Sem sinal" ao abrir a lista ou o modelo só manda olhar a internet e tentar de novo; **não afirma nada que não se sabe**. A frase de recusa do próprio
  servidor (por exemplo "Modelo nao encontrado") passa como veio.
- Um tipo por vez: dois toques seguidos pedem o modelo **uma vez**. Voltar enquanto o modelo abre leva à porta na hora, e **a resposta que chega tarde não muda a
  tela** (cada espera tem o seu número, e sair da tela solta as duas). Voltar aos tipos reaproveita a lista que já veio.
- O foco vai para a frase de aviso a cada etapa **e a cada categoria nova** (o leitor de tela fala o nome da categoria e quantos estão marcados); nos preços fica
  no campo do preço, que recomeça vazio (ou com o preço já escrito) a cada prato.
- Nome de categoria e de prato, e o desenho do tipo, **nunca entram como HTML**.

**Servidor:** nenhuma mudança. As rotas `GET /api/admin/menu/templates` e `/templates/<id>` (só dono e gerente) já existiam e o cadastro só acrescenta (o que já
existe não repete), como nos outros jeitos de montar. O PR #76 (rota do lápis dos pratos) continua precisando entrar antes da tela de pratos ir ao ar; este item
não depende dele.

**O que a tela não faz:**

- Os tipos e os pratos de cada modelo são os que o servidor tem hoje (18 tipos). Trocar ou ampliar os modelos é mudança no servidor, e é do GD decidir o que vender
  em cada tipo.
- Não guarda um rascunho: sair no meio do marcar volta ao começo (nada tinha ido ao servidor, então nada se perde fora do que foi tocado).

**Como foi conferido:** `tests/novo/menuModelLogic.test.mjs` (31), `fluxo.test.mjs` (+6), `toque.test.mjs` (+5; e três que liam o código da tela de montar
passaram a ler o arquivo compartilhado), `menuSetupLogic.test.mjs` (porta de quatro cartões); 488 testes passam só na pasta do visual novo (1.311 no CI inteiro),
com tipos, build, segurança e conformidade. Em 320, 360, 390 e 480 px, nas telas de conferência do modelo (mais a porta): sem rolagem lateral, nenhum botão
com menos de 44 px e nenhum toque coberto. No navegador, com a tela de verdade e um servidor de mentira (159 conferências, contando as da porta e das outras
maneiras de montar): a busca filtra na hora e ignora acento; "não achei" com a palavra escrita; Enter na busca não sai da tela; marcar, desmarcar, Marcar todos,
Tirar todos; anotar o prato que faltava (e anotar de novo não repete); a conta do botão muda a cada prato marcado; Voltar guarda o que foi marcado; preço ruim,
vazio e "R$ 25" (vale 25); Tirar este prato; Voltar mostra o preço já escrito; conferência com os preços do jeito escrito; lápis muda o nome; **um** cadastro só, com
os pratos que ficaram e o preço de cada um (e antes dele, nenhum envio); lista de tipos sem sinal, torta e vazia mostram a frase certa e o Tentar de novo traz a
lista; espera da lista e do modelo; dois toques pedem uma vez; Voltar durante a espera leva à porta e a resposta tardia não muda a tela; modelo sem sinal, não
achado e sem pratos deixam os tipos para tocar de novo; HTML no nome, na categoria e no desenho aparece como texto; o foco da tela de preço não é tomado.
Para ver: `preview-novo.html#/cardapio-modelo` (os tipos), `#/cardapio-modelo-carregando`, `#/cardapio-modelo-erro`, `#/cardapio-modelo-busca`, `#/cardapio-modelo-sem-resultado`,
`#/cardapio-modelo-abrindo`, `#/cardapio-modelo-erro-abrir`, `#/cardapio-modelo-marcar`, `#/cardapio-modelo-marcar-ultima`, `#/cardapio-modelo-marcar-nenhum`, `#/cardapio-modelo-preco`,
`#/cardapio-modelo-preco-erro` e `#/cardapio-modelo-conferir`; a porta com os quatro cartões é `#/cardapio`.

**O que ainda falta no cadastro do cardápio:** foto do prato e opções do prato; a Logomarca; a bolinha de voz que escuta e navega (o que passa de navegar e ler
precisa da chave da IA, que ele mesmo digita em `configurar-ia.sh`); e a regra de quem abre cada tela na casca do painel.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Como as telas novas entram, sem ir ao ar antes da hora

- Tudo mora em `frontend/src/novo/` e **não é importado pelo aplicativo**: o `index.html` e o `main.tsx` não mudam.
  Um teste (`tests/novo`) garante que o visual novo não depende do antigo e que só a página de conferência usa dados
  de exemplo.
- Para ver: `cd frontend && npx vite build --config vite.preview-novo.config.ts --outDir /tmp/novo` e abrir
  `preview-novo.html#/loja`, `#/hoje`, `#/cozinha`, `#/vagas`, `#/escolhas`, `#/escolhas-erro`, `#/sacola`, `#/entrega`, `#/loja-pedido`, `#/pedido`, `#/pedido-rua`, `#/pedido-pronto`, `#/mesa`, `#/mesa-chamada`, `#/loja-mesa`, `#/menu`, `#/menu-garcom`, `#/mesas`, `#/mesas-calmo`, `#/mesas-qr`, `#/mesas-carregando`, `#/mesas-erro`, `#/mesa-aberta`, `#/pedidos`, `#/pedidos-caixa`, `#/pedidos-garcom`, `#/pedidos-cozinha`, `#/pedidos-calmo`, `#/pedidos-erro`, `#/pedidos-enviando`, `#/entregas`, `#/entregas-pegar`, `#/entregas-entregues`, `#/entregas-codigo`, `#/entregas-bloqueado`, `#/entregas-erro`, `#/entregas-calmo`, `#/entregas-carregando`, `#/entregas-gerente`, `#/acerto`, `#/acerto-confirmar`, `#/acerto-calmo`, `#/acerto-erro`, `#/acerto-carregando`, `#/cardapio` (e as outras 16 telas `#/cardapio-…`, listadas na décima terceira rodada), `#/pratos` ou `#/categorias` (e as outras 18 telas `#/pratos-…` e `#/categorias-…`, listadas na décima quarta rodada)
  (a pasta pública vai junto, por causa das fontes).
- Cada tela ganha um PR próprio: ligada aos dados de verdade (por props), com teste, e a tela antiga correspondente
  sai no mesmo PR. **Nada disso vira o que o público vê sem o "pode" do GD.**

## Ordem proposta (por valor no dia a dia)

1. Cozinha e pedidos (quem está de mãos sujas e precisa de clareza).
2. Hoje do dono e o menu.
3. Cardápio do cliente e a sacola, já com a bolinha de voz de verdade.
4. Cadastro do cardápio por voz e foto, e a logomarca.
5. Mesa, garçom (Abrir mesa) e caixa.
6. Entrega e motoqueiro.
7. Vem Trabalhar: vagas, currículo por voz, empresa.
8. Dono do sistema (Aprovações, assinaturas, chamados).

## O que o desenho ainda não resolve (e o que depende do GD)

- **Foto do prato:** nas imagens os pratos são emojis. Na tela de verdade entra a foto do restaurante, melhorada
  pelo sistema (sem inventar nada). O visual depende de boas fotos.
- **A marca do Vem Trabalhar:** falta o arquivo original (SVG ou PNG com fundo transparente). Na tela, por ora, vai
  só o nome em letra.
- **A bolinha de voz ainda não fala:** é desenho. A conversa de verdade (portal primeiro) é uma obra à parte.
- **O GD precisa dizer se é isso.** Se não for, o que muda é o sistema de cores e peças, não o resto do plano.
