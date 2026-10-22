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
- As telas de **entregas** (entregador, com código do cliente) e de **acerto do caixa** ainda são as antigas; entram na rodada seguinte.
- Esta tela ainda **não guarda a regra de quem pode abrir** (rota por papel): isso é da casca do painel, na hora de ligar tudo.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

**Como foi conferido:** `tests/novo/ordersLogic.test.mjs` (28), `toque.test.mjs` (59), `fluxo.test.mjs` (28), `trackingLogic.test.mjs` (+1);
1102 testes passam no total. Em 320, 360, 390 e 480 px, nas 30 telas de conferência: sem rolagem lateral e nenhum botão com menos de 44 px.
No navegador, com a tela de verdade e um servidor de mentira: dois toques seguidos mandam um envio só; "Aceitar" e "Pagamento recebido"
chegam com o código certo; o foco volta ao pedido; pedido novo vibra uma vez; pedido que já mudou **não** é mandado e não volta para trás;
erro ao avançar e ao receber deixam o botão pronto de novo; sem servidor, os pedidos ficam e a frase some quando volta; garçom não tem a
aba nem o botão de pagamento; cozinha não vê telefone nem rua; o caixa abre em Receber.
Para ver: `preview-novo.html#/pedidos`, `#/pedidos-caixa`, `#/pedidos-garcom`, `#/pedidos-cozinha`, `#/pedidos-calmo`, `#/pedidos-erro` e `#/pedidos-enviando`.

## Como as telas novas entram, sem ir ao ar antes da hora

- Tudo mora em `frontend/src/novo/` e **não é importado pelo aplicativo**: o `index.html` e o `main.tsx` não mudam.
  Um teste (`tests/novo`) garante que o visual novo não depende do antigo e que só a página de conferência usa dados
  de exemplo.
- Para ver: `cd frontend && npx vite build --config vite.preview-novo.config.ts --outDir /tmp/novo` e abrir
  `preview-novo.html#/loja`, `#/hoje`, `#/cozinha`, `#/vagas`, `#/escolhas`, `#/escolhas-erro`, `#/sacola`, `#/entrega`, `#/loja-pedido`, `#/pedido`, `#/pedido-rua`, `#/pedido-pronto`, `#/mesa`, `#/mesa-chamada`, `#/loja-mesa`, `#/menu`, `#/menu-garcom`, `#/mesas`, `#/mesas-calmo`, `#/mesas-qr`, `#/mesas-carregando`, `#/mesas-erro`, `#/mesa-aberta`, `#/pedidos`, `#/pedidos-caixa`, `#/pedidos-garcom`, `#/pedidos-cozinha`, `#/pedidos-calmo`, `#/pedidos-erro` ou `#/pedidos-enviando`
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
