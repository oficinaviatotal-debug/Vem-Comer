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

## Décima sexta rodada: o que vai dentro de cada prato, e entradas claras (22/10/2026)

Pedido do GD (22/10, 19:10 e 19:13): **toda função aceita voz, escrita ou foto, e a pessoa escolhe**; quem não escreve bem (o dono do cachorro-quente que mandou
fazer a folha do cardápio numa lan house) tira **uma foto** e o sistema lê **cada prato, o que vai dentro e o preço**, ou **fala** ("cadastre um X-Tudo, no X-Tudo
custa R$ 25, vai ter ovo, bacon, hambúrguer, salame e etc.") ou **anexa** o arquivo, ou escreve do jeito dele, e **no fim edita**. Sem mudar o desenho: só os
botões que a pessoa toca. Não é o "pode" para ir ao ar nem para juntar.

**O que mudou** (arquivos: `assistant/spokenMenu.ts` e `assistantFlow.ts`, que o painel antigo também usa; `painel/menuSetupLogic.ts` e `MenuSetupScreen.tsx`;
`novo/MenuSetup.tsx`, `copy.ts`, `types.ts`, `parts.tsx`, `novo.css`):

1. **A porta tem seis botões, cada um diz o que faz:** Tirar foto do cardápio (câmera), Escolher foto do celular (uma ou mais), Falar os pratos, Escrever os pratos,
   **Anexar arquivo** (planilha, PDF ou o cardápio que alguém fez) e Começar de um modelo. Quando o servidor não lê foto ou arquivo, esses ficam apagados com o
   motivo, e os que funcionam sem ele (falar, escrever, modelo) vêm primeiro.
2. **Falar começa a ouvir na hora** (sem um segundo toque). **Escrever** abre a mesma tela com o campo já pronto: **um prato por linha**; depois do preço, o
   que vier na linha é o que vai dentro ("x-tudo 25, ovo, bacon, salame"). A bolinha da porta leva a falar; **na tela de falar ela não aparece** (já existe o botão
   grande "Falar", e a bolinha cobria a lixeira dos pratos).
3. **A fala entende a ordem inteira**: tira "eu quero que você cadastre um", acha o prato, o preço e a lista que vem depois de "vai ter / tem / leva / com"
   (ou antes do preço); "e etc" some; quantidades ("2 ovos", "200 g de carne") ficam na lista e **não viram preço**; "pão de forma", "queijo coalho" e "2 fatias de
   queijo" ficam inteiros mesmo sem vírgula (o celular quase nunca põe). Várias falas se completam: primeiro o prato, depois "custa 25, vai ter ovo e bacon".
   A frase da tela diz o que anotou: "Anotei X-Tudo, R$ 25,00. Dentro: Ovo, bacon, hambúrguer, salame." (lista com mais de 8 vira "Dentro: 11 ingredientes.").
4. **A foto já trazia o que vai dentro** (o servidor lê a descrição de cada prato); agora ela **aparece** na conferência, embaixo do prato, e **segue para o
   cadastro**. O prato que a foto leu sem lista fica sem nada (**nunca se inventa**).
5. **O lápis tem o campo "O que vai dentro (se quiser)"**; "Pronto" grava, apagar o campo tira a lista, e preço recusado não muda nada (nem a lista).
6. **Fala ou escrita sem prato antes** ("vai ter ovo e bacon", "custa 25") agora diz "Não achei de qual prato é isso. Diga o nome do prato primeiro". Antes
   a tela dizia "já estavam anotados", o que não era verdade.

**Limites, ditos com franqueza:**

- Fala corrida **sem pausa** entre dois pratos ("x-tudo 25 leva ovo e bacon x-salada 22") não tem como saber onde a lista acaba: **nada é cortado, nenhum preço
  some**, e o pedaço duvidoso vai para a lista "não entendi" para a pessoa encaixar. Falando com uma pausa (ou escrevendo uma linha por prato) fica certo.
- Escrito em linha, **tudo que vem depois do único preço da linha é lista**; linha com mais de um preço é lida como sempre.
- O cadastro **só acrescenta**: prato que já existe no cardápio não é mudado por aqui.
- Sem a chave da IA a fala é entendida por regras de palavras (as de cima); fala livre, de qualquer jeito, precisa da chave, que só o GD digita em `configurar-ia.sh`.
- O servidor guarda até 500 letras por prato; a tela corta a lista em 300 e em 8 itens na frase.

**Como foi conferido:** `tests/assistant/spokenInside.test.mjs` (16) e `tests/novo/ingredientes.test.mjs` (14) são novos; mudaram `fluxo`, `menuSetupLogic` e
`toque` (porta de seis botões, campo de texto no lugar do campo de uma linha, bolinha só na porta e no fim). 1.342 testes passam nas pastas do CI, com tipos,
build, segurança e conformidade. Em 320, 360, 390 e 480 px: sem rolagem lateral, nenhum botão com menos de 44 px, nenhum toque coberto. No navegador, com a tela de
verdade, um servidor de mentira e um microfone de mentira: **184 conferências, todas certas**, incluindo a frase do GD inteira, a lista que chega no cadastro (conferida
no que foi enviado ao servidor), a foto com e sem lista, escrever em linhas, o lápis com o campo novo e a porta com tudo ligado e com cada parte desligada.
Para ver: `preview-novo.html#/cardapio` (a porta de seis botões), `#/cardapio-falar`, `#/cardapio-ouvindo`, `#/cardapio-escrever`, `#/cardapio-conferir`,
`#/cardapio-editando` (com lista) e `#/cardapio-editando-sem-lista`.

**O que ainda falta:** foto do prato e opções do prato; a Logomarca; a bolinha de voz que escuta e navega em **todas** as telas e o microfone ao lado de cada campo
de escrever (a conta é a do item 90 dos requisitos).

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Décima sétima rodada: o sistema que conversa, "O que falta" no Hoje (22/10/2026)

O GD aprovou a porta de seis botões do cardápio (20:31: "está perfeito os botões ali de falar, de anexar ou de tirar foto") e deixou um princípio para tudo:
**o sistema tem de conversar com o cliente e com o empresário, dizendo o que fazer, como fazer, o que falta e o que ficou por fazer**, de um jeito vivo, fácil e
intuitivo. Ficou como o princípio 8 de `docs/principios-do-produto.md` e o item 92 dos requisitos. Nada vai ao ar sem o "pode".

**A primeira aplicação: "O que falta" no Hoje do dono** (`hoje/todayLogic.ts` faz a conta, `novo/OwnerToday.tsx` desenha, `hoje/TodayScreen.tsx` busca os fatos):

- Até **três passos**, em ordem: **cardápio vazio** ("Tire uma foto do cardápio, fale os pratos ou comece de um modelo." → Montar), **Pix sem cadastrar**
  ("Cadastre a sua chave. O cliente paga pelo celular e o dinheiro vai para a sua conta." → Cadastrar), **nenhuma mesa** ("Cadastre as mesas e imprima o QR Code.
  Se você só entrega, pode deixar assim." → Cadastrar) e **N pratos sem foto** ("A foto ajuda o cliente a escolher. Toque para pôr." → Pôr fotos).
- Cada passo diz **o que falta**, **como resolver** e tem um botão que leva à tela certa (o texto também é tecla, e leva ao mesmo lugar). Os botões têm 44 px ou mais.
- **Só se diz o que o servidor confirmou.** Cada fato vem de uma busca (pratos, mesas, Pix) que vale sozinha: se uma falha, ela não vira "falta" e a tela
  guarda o que já sabia; se nada veio, não aparece lista nem frase de erro nova. **Quando nada falta, a tela não diz nada** (não finge que está tudo pronto).
- **Só dono e gerente** veem a lista, e só eles fazem as buscas de mesas e de Pix. Cozinha, caixa, garçom e entregador não veem nem pedem.
- Atualiza a cada minuto (junto com as vendas), sem tirar nada do que já está no Hoje.

**O que a lista ainda não faz:**

- Não tem "já sei, não quero" para o passo que o dono não vai fazer (quem só entrega ainda vê "Nenhuma mesa cadastrada", com a frase dizendo que pode deixar assim).
  Guardar essa escolha pede um lugar para guardar no servidor; fica para decidir.
- Só olha quatro coisas (cardápio, Pix, mesas, fotos). Horário, regiões de entrega, logomarca e equipe ainda não entram.
- Pratos sem foto contam pelo que o cardápio público manda (`thumb_url` vazio); um emoji conta como foto.

**Como foi conferido:** `tests/novo/todayLogic.test.mjs` (+8: em dia, sem resposta do servidor, os passos e as telas para onde levam, singular e plural, teto de três,
quem pode ver, as contas das respostas, o Hoje levando a lista) e `toque.test.mjs` (+1: a seção só aparece quando há passo e o texto e o botão levam à mesma tela).
512 testes passam só na pasta do visual novo. No navegador, com a tela de verdade e um servidor de mentira (11 conferências): os três passos em ordem e as telas
certas ao tocar, cardápio vazio sem falar de foto, tudo em dia sem lista, busca que falha não vira "falta", nada veio sem frase de erro, cozinha sem lista e sem
as buscas do dono, gerente com no máximo três. Em 320 a 480 px: sem rolagem lateral e sem botão menor que 44 px.
Para ver: `preview-novo.html#/hoje-falta` (Pix, mesas e fotos), `#/hoje-comecando` (cardápio vazio, Pix e mesas) e `#/hoje` (sem lista, como antes).

**Onde o princípio ainda precisa chegar:** o próximo passo depois de cadastrar o cardápio; o cliente (em que passo o pedido está e o que ele faz agora); a conferência
(o que falta em cada prato); e as mensagens de erro das telas antigas.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Décima oitava rodada: foto do prato e o próximo passo depois de cadastrar (22/10/2026)

O GD disse "Prossiga" (20:41) depois de deixar o princípio 8 (o sistema conversa e diz o que falta). Segui pela tela de cadastro do cardápio, onde estávamos, e pela
foto do prato, que era o que ficava faltando no "toda entrada por voz, escrita ou foto" (item 90). Nada vai ao ar sem o "pode".

**Foto do prato, no lápis** (`novo/Dishes.tsx`, `painel/DishesScreen.tsx`, `painel/dishesLogic.ts`):

- Ao mudar um prato, abaixo de "O que vem no prato", aparece **"Foto do prato"** com a foto de hoje (ou o garfo e a faca, se não tem), o botão **Tirar foto** (abre a
  câmera de trás do celular), o botão **Escolher do celular** (galeria) e, quando já tem foto, **Tirar a foto** (apaga). Em prato novo a caixa não aparece, porque a
  foto precisa de um prato já cadastrado: o dono salva e volta no lápis.
- A foto é reduzida no próprio celular antes de seguir (a mesma rotina das fotos do cardápio) e vai para o servidor. **"Foto salva." só aparece depois que o servidor
  respondeu certo**; se não deu, a tela diz "Não consegui enviar a foto. Veja se o celular está com internet e tente de novo." e a foto de antes continua como estava.
  A frase do servidor, quando vem, passa como veio.
- Trocar de prato no meio do envio não mistura as respostas: o prato certo recebe a foto e a frase não aparece no prato errado.
- Quem não pode mexer no cardápio (cozinha, caixa, garçom) não vê foto, nem aviso, nem lápis.

**O sistema avisa o que falta nos Pratos:** o dono e o gerente veem a frase "N pratos estão sem foto. Toque no lápis do prato para pôr a foto." no alto da lista e a
etiqueta **"Sem foto"** em cada prato sem foto. A conta usa só a foto que o servidor entrega e que a tela aceita (um endereço inválido conta como sem foto).

**O que falta, depois de cadastrar o cardápio** (`painel/menuSetupLogic.ts`, `novo/MenuSetup.tsx`): a tela "Cardápio cadastrado" ganhou a lista **"O que falta"**,
em frases curtas e com o botão certo por perto:

- "Os pratos novos entraram sem foto. Toque em Ver os pratos e ponha a foto de cada um." (sempre que entrou prato novo, porque a importação ainda não leva foto);
- "N pratos ficaram de fora por falta de preço. Toque em Cadastrar mais pratos e diga o preço." (conta só os que a pessoa deixou sem preço antes de cadastrar);
- "N pratos já existiam e não foram mudados. Para mudar um deles, toque no lápis em Ver os pratos." (o servidor só acrescenta, não troca o que já tem).

A frase lida em voz alta (região viva) traz as mesmas linhas, para quem usa leitor de tela. Nada é inventado: se o servidor não disse quantos entraram, não há linha de "sem foto".

**Limites que ficam:**

- A importação do cardápio (foto, arquivo ou fala) **ainda não leva foto de prato**: cada prato novo precisa da foto depois, no lápis.
- O lápis de prato chama `PUT /api/admin/products/<id>` (PR #76 do servidor): **o PR #76 precisa ir para o ar antes desta tela**.
- Pratos com emoji no lugar da foto contam como "sem foto" nos Pratos (a tela aceita só foto do servidor), mas o "O que falta" do Hoje conta emoji como foto
  (pelo que o cardápio público manda). A diferença é pequena e fica anotada para acertar quando o Hoje usar a mesma regra.
- Foto de logomarca e de QR ainda não têm entrada própria.

**Como foi conferido:** `tests/novo/dishesLogic.test.mjs` (+4: etiqueta e frase só para quem pode mexer, singular e plural, foto nova no prato certo), `menuSetupLogic.test.mjs` (+1: as
três linhas de "O que falta") e `toque.test.mjs` (+2: a caixa da foto no lápis e a lista no cadastrado). 520 testes passam só na pasta do visual novo. No navegador, com a
tela de verdade e servidor de mentira: Pratos (19 conferências: tirar foto, escolher, apagar, erro, troca de prato no meio do envio, quem não pode mexer) e o cadastro do
cardápio (187 conferências, incluindo a lista "O que falta" com todos os pratos com preço e com um prato sem preço que ficou de fora). Em 320 a 480 px: sem rolagem
lateral e sem botão menor que 44 px.
Para ver: `preview-novo.html#/pratos` (frase e etiquetas), `#/pratos-foto`, `#/pratos-foto-enviando`, `#/pratos-foto-erro` e `#/cardapio-cadastrado`.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Décima nona rodada: opções do prato, tamanho, adicionais e retirar (22/10/2026)

O GD disse "Dê total continuidade" (20:56). Segui a ordem que já estava dita: depois da foto do prato, as **opções do prato**, no mesmo lápis. O servidor já guarda
tudo isso (`GET` e `PUT /api/admin/products/<id>/options`, já no ar no `main`) e a tela antiga já tinha as contas; esta rodada refaz a tela no visual novo, sem
mudar regra nenhuma. Nada vai ao ar sem o "pode".

**Como se chega:** no lápis do prato (só prato que já existe) aparece **"Opções do prato"** com o resumo de hoje ("Sem opções. Serve para tamanho, adicional ou
retirar algo." ou "2 grupos de opções: Tamanho, Adicionais.") e o botão **Montar as opções** (ou **Mudar as opções**). Ele abre a tela das opções no lugar da lista;
ao voltar, o lápis está como estava, com o foco no mesmo botão.

**A tela** (`novo/DishOptions.tsx`, contas em `painel/optionsLogic.ts`, tela de verdade em `painel/DishOptionsScreen.tsx`):

- **Três jeitos de montar, a pessoa escolhe:** **Falar as opções** (a bolinha grande: ouve, mostra as palavras e, ao tocar de novo, usa o que ouviu), **escrever**
  (a mesma frase, na caixa "Ou escreva as opções", botão Anotar) e **modelos para tocar** (Tamanho, Adicionais, Retirar, Outro grupo). Foto não entra aqui: não há o que
  fotografar numa escolha de tamanho.
- **A frase falada ou escrita** usa o entendedor que já existia (`service/spokenOptions`): "tamanho pequeno, médio mais 5, grande mais 10. Adicionais bacon 4, ovo 2. Sem
  cebola". Ele só **monta o rascunho na tela**; a tela mostra **"Você disse"**, **"Entendi"** e **"Ainda não foi salvo"**. Preço duvidoso fica vazio e a frase avisa;
  se o limite de grupos (8) ou de opções (30) deixou algo de fora, a frase diz o quê. Não entendeu: a lista fica como estava e a frase ensina a falar. Não ouviu: diz que não ouviu.
- **Cada grupo** tem nome, **"O cliente precisa escolher? Sim / Não"**, **"Pode escolher até"** e (se obrigatório) **"Tem que escolher pelo menos"**, com menos e mais de 44 px, e a
  regra em palavras do jeito que o cliente vai ver ("O cliente escolhe 1."). Cada opção tem nome, **preço a mais** (vazio = não custa a mais) e **Tem / Acabou**; dá para
  pôr outra opção, tirar uma opção e tirar o grupo (pede um segundo toque).
- **O sistema conversa (princípio 8):** a frase de cima diz o que fazer (sem opções: "fale, escreva ou toque em um modelo"; com opções: "o cliente escolhe antes de pedir…");
  a barra de baixo diz **o que falta** ("Falta salvar. O cliente só vê depois de salvar." ou "Tem 2 coisas para acertar antes de salvar."); e o botão principal de baixo **guia o
  próximo passo**: com coisa por salvar é **Salvar as opções**, e sem nada por salvar vira **Voltar aos pratos**. Sair com coisa por salvar pede um segundo toque
  ("Sair sem salvar? Toque de novo").
- **Só salva quando a pessoa toca em Salvar.** Antes, a tela confere com as mesmas regras do servidor (nome vazio, opção repetida, preço inválido, mínimo maior que o número de
  opções) e diz o que acertar, sem mandar nada. Depois do "salvo" a tela diz **"Opções salvas. O cliente já vê no cardápio."** só depois da resposta certa do servidor; se o
  servidor recusar com frase, ela passa como veio; sem frase boa, "Não consegui salvar as opções. Tente de novo." e nada do que foi montado some. Dois toques seguidos mandam um só pedido.
- **Honestidade:** se as opções não abriram, a tela diz isso e oferece Tentar de novo; **não** finge que o prato "não tem opções" (sem microfone, sem modelos, sem salvar).
  Sem reconhecedor de voz no celular, o botão de falar não aparece e a frase diz que o celular não escuta.
- **Os ids do servidor ficam:** mudar só o preço de uma opção não troca a opção de quem está pedindo agora (o servidor mantém pelo id).
- **Só dono e gerente** chegam ao lápis (a cozinha não vê lápis, logo não vê opções); o servidor confere de novo.

**O que ainda não faz:**

- Não mexe na ordem dos grupos nem das opções (só acrescenta e tira).
- A importação do cardápio (foto, arquivo ou fala) ainda não cria opções; é preciso entrar no lápis de cada prato.
- Não copia as opções de um prato para outro (ex.: o mesmo "Tamanho" em cinco pizzas); fica para decidir se vale.

**Como foi conferido:** `tests/novo/optionsLogic.test.mjs` (26: a tela por grupo, setas, Sim/Não, frase falada e limites, o que falta na barra, resumo do lápis) e `toque.test.mjs` (+3: campo afundado,
botão em relevo, barra que guia). 549 testes passam só na pasta do visual novo. No navegador, com a tela de verdade e um servidor de mentira (58 conferências): resumo e botão
no lápis, abrir devagar e abrir com erro, modelo Tamanho, preço, Tem/Acabou, Sim/Não e as setas, escrever, falar com reconhecedor de mentira (parar, silêncio), salvar com
duplo toque (um pedido só, preço com duas casas), frase do servidor que passa como veio, erro sem frase, tirar grupo com dois toques, sair com e sem coisa por salvar,
sem microfone, cozinha sem lápis, e 320 a 480 px sem rolagem lateral e sem botão menor que 44 px.
Para ver: `preview-novo.html#/pratos-mudar-opcoes` (o lápis com o resumo), `#/pratos-opcoes`, `#/pratos-opcoes-vazio`, `#/pratos-opcoes-ouvi`, `#/pratos-opcoes-erros`,
`#/pratos-opcoes-salvo`, `#/pratos-opcoes-sair`, `#/pratos-opcoes-carregando`, `#/pratos-opcoes-erro` e `#/pratos-opcoes-sem-microfone`.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Vigésima rodada: a logomarca do restaurante, por foto, por escolha ou criada em três toques (23/10/2026)

O GD disse "Pode prosseguir com os demais. Pode continuar." (22/10, 21:27) e, hoje, "Pode pegar seguir..." e "Prosseguir" (23/10, 15:10). Li como continuar construindo, não como
"pode" para ir ao ar nem para juntar. Seguindo a ordem do cadastro do cardápio, a vez foi da **logomarca** (a entrada "Marca" do menu). O servidor já guarda e entrega a
logomarca (`POST` e `DELETE /api/admin/company/logo`, já no ar no `main`, e `logo_url` na empresa pública) e a tela antiga já tinha as contas (tipos de comida, cores, seis modelos,
o ajuste da margem vazia); esta rodada refaz a tela no visual novo, **sem mudar regra nenhuma e sem servidor novo**. Aplica o item 90 (voz, escrita ou foto) e o princípio 8 (o sistema conversa).

**A tela** (`novo/Logo.tsx`, contas em `painel/logoViewLogic.ts`, desenhos em `painel/LogoPictures.tsx`, tela de verdade em `painel/LogoScreen.tsx`):

- **Início: o que o cliente vê agora e três jeitos de trocar.** Um quadro liso mostra a logomarca de hoje (ou "Sem logomarca"). Embaixo: **Tirar foto da logomarca** (abre a câmera
  de trás), **Escolher do celular** e **Criar minha logomarca** (ou "Criar outra logomarca"); com logomarca, também **Remover a logomarca** (dois toques; o primeiro muda o botão
  para "Toque de novo para remover" e some sozinho depois de uns segundos). Pelo menos uma frase diz sempre **o que falta e o que fazer**: sem logomarca, "O seu cardápio ainda está
  sem logomarca. Sem ela, o cliente vê só o nome do restaurante" e "tire uma foto da sua placa, escolha uma imagem ou crie uma de graça em três toques"; com logomarca, "É esta a
  logomarca que o cliente vê no alto do cardápio" e "Quer trocar?…".
- **"Ficou bom?" antes de salvar.** A imagem da foto ou do celular passa pelo mesmo preparo da tela antiga (PNG e JPG pequenos seguem como estão; os grandes são reduzidos aqui;
  arquivo que não é imagem é recusado com frase). A tela mostra **a que você mandou** e, se havia margem vazia em volta, **depois do ajuste** (vem escolhida; um botão volta para a
  original), e **como o cliente vê** (o selo redondo ao lado do nome do restaurante). Avisa quando a imagem é **clara demais** (some no fundo branco) ou **pequena** (fica borrada).
  **Nada é enviado até tocar em "Sim, usar esta".** Dá para tirar outra foto, escolher outra imagem ou cancelar ("Nada foi salvo.").
- **Criar em três toques, com voz, escrita e toque.** Passo 1, **o que você vende** (13 figuras; o tipo já vem marcado quando o nome diz, e a figura adivinhada mostra "parece ser este"
  se a pessoa escolher outra); o botão **Falar o que eu vendo** entende "pizzaria", "lanche", "açaí"… com as mesmas palavras que já adivinhavam pelo nome do restaurante, e a tela
  diz "Entendi: Pizza. Se estiver certo, toque em Continuar", ou "Não entendi. Toque em uma das figuras", ou "Não ouvi nada". Passo 2, **a cor da fachada** (nove cores, com prévia que
  muda). Passo 3, **o modelo** (seis desenhos) e o **nome na logomarca**: já vem escrito, dá para escrever (até 40 letras) ou **Falar o nome** ("pizzaria do zé" vira "Pizzaria do Zé");
  se o nome ficou cortado em algum modelo, a frase manda escrever uma versão mais curta. A barra de baixo é fixa e guia: **Continuar** (só com o tipo escolhido; sem ele diz
  "Toque em uma figura para continuar"), **Voltar**, e no fim **Usar esta logomarca**, que só então desenha o PNG aqui no celular e manda. Sem nome, não manda e diz o que escrever.
- **Honestidade.** "Logomarca salva. O cliente já vê no cardápio." só aparece depois da resposta certa do servidor; "Logomarca removida. O cardápio volta a mostrar só o nome." também.
  Se o servidor recusa com frase (imagem pequena demais, por exemplo), a frase passa como veio e a pessoa continua onde estava ("Ficou bom?" ou o passo 3), podendo tentar de novo sem
  escolher tudo outra vez; erro sem frase boa vira "Não consegui enviar a logomarca. Tente de novo." **Se a logomarca não abriu, a tela diz isso e oferece Tentar de novo: nunca finge que
  o restaurante está sem logomarca.** Erro do navegador em inglês não aparece: só as frases nossas, em português, passam. O arquivo vai com o nome `logomarca.png` (ou `.jpg`, `.webp`),
  nunca com o nome que o celular deu à foto. Dois toques seguidos mandam uma só chamada.
- **Voz sem a chave da IA.** O falar do criar usa só o ditado do celular e palavras fixas; não precisa da chave (que só o GD digita em `configurar-ia.sh`). Sem reconhecedor de voz,
  o botão de falar não aparece e a frase manda tocar numa figura (ou escrever o nome).
- **Só dono e gerente** (é a regra do menu: "Marca" só aparece para eles) e o servidor confere de novo.

**O que ainda não faz:**

- **Foto de placa não vira logomarca limpa:** o sistema tira a margem vazia e centraliza, e avisa se está clara ou pequena, mas **não tira o fundo** nem endireita foto torta. Quem tem o
  arquivo da logomarca (PNG com fundo transparente) fica com o melhor resultado.
- O topo do painel ainda não troca a logomarca sozinho: a tela avisa a casca (`onChanged`), e a casca nova ainda não está ligada.
- A logomarca ainda não entra nos posts da semana nem no QR pequeno (etapas seguintes). O QR ainda não tem entrada por foto.
- Os desenhos feitos por código continuam sendo de logomarca simples; não substituem um designer.

**Como foi conferido:** `tests/novo/logoViewLogic.test.mjs` (27: começo do criar e tipo adivinhado, cor que acompanha o tipo até a pessoa escolher, passos, limite do nome,
palavras ditas para cada um dos 13 tipos, nome falado, frases de entendi/não entendi/não ouvi, frase de erro só em português, nome do arquivo enviado, cada parte da tela) e
`toque.test.mjs` (+4: rótulos de câmera e de arquivos, relevo só no que se toca, grupo de escolhas e barra fixa, remover em dois toques). 580 testes passam só na pasta do visual novo.
No navegador, com a tela de verdade e um servidor de mentira (67 conferências): abrir devagar, com logomarca, sem logomarca e com erro (e Tentar de novo), escolher imagem e conferir
(nada enviado antes do "sim", a versão ajustada e a original, o arquivo enviado com o tamanho certo, imagem que já enche tudo sem ajuste), servidor recusando com frase e com erro
sem frase, tentar de novo sem escolher outra vez, dois toques (uma chamada só), arquivo que não é imagem, cancelar, escolher outra imagem, remover em dois toques (e o primeiro
toque que desarma sozinho), remover com erro e recusado, criar de ponta a ponta (tipo, cor, modelo, nome limitado a 40, voltar sem perder o que escolheu, salvar PNG), criar sem
pista e sem nome, voz com reconhecedor de mentira (entendi, não entendi, tocar para parar, nome falado), sem microfone, voltar, e 320 a 480 px sem rolagem lateral e sem botão menor que 44 px.
Para ver: `preview-novo.html#/logomarca` (com logomarca), `#/logomarca-sem`, `#/logomarca-salva`, `#/logomarca-removida`, `#/logomarca-erro-imagem`, `#/logomarca-remover`,
`#/logomarca-removendo`, `#/logomarca-carregando`, `#/logomarca-erro`, `#/logomarca-conferir`, `#/logomarca-conferir-simples`, `#/logomarca-conferir-avisos`,
`#/logomarca-conferir-erro`, `#/logomarca-conferir-salvando`, `#/logomarca-criar`, `#/logomarca-criar-ouvindo`, `#/logomarca-criar-entendi`, `#/logomarca-criar-nao-entendi`,
`#/logomarca-criar-cores`, `#/logomarca-criar-modelos`, `#/logomarca-criar-cortado`, `#/logomarca-criar-sem-nome` e `#/logomarca-criar-sem-microfone`.

**Ainda não está ligado ao painel público** (o painel antigo continua mandando).

## Vigésima primeira rodada: a casca do painel, para tudo funcionar junto (23/10/2026)

O GD disse "Faça o que for necessário para poder em alto nível corrigir e fazer tudo funcional" (23/10, 15:25). Li como continuar construindo, não como "pode" para ir ao ar nem para
juntar. Até aqui cada tela nova existia sozinha (Hoje, Pedidos, Cozinha, Mesas, Entregas, Acerto, Assistente, Produtos, Categorias, Marca), mas **ninguém as ligava entre si**: faltavam
a entrada, o menu e a regra de quem abre o quê. Esta rodada faz a **casca**: com ela o painel novo funciona do começo ao fim, com todas as telas, sem mudar nenhuma regra do servidor.

**Como ligar (e desligar).** O painel novo é uma chave, **desligada por padrão**: quem abre o painel como sempre continua no painel antigo. `?novo=1` no endereço do painel
(por exemplo `…/?empresa=seu-restaurante&painel=1&novo=1`) liga e **o aparelho lembra**; `?novo=0` desliga e esquece. Também liga na construção com `VITE_PAINEL_NOVO=1`.
Armazenamento bloqueado (aba privada) faz a chave valer só para aquela abertura. O código do painel novo só é baixado por quem liga a chave.

**O que a casca faz** (`painel/PanelShell.tsx`, contas em `painel/shellLogic.ts`, `painel/loginLogic.ts`, `painel/useSession.ts` e `painel/useWatchers.ts`):

- **Entrar no visual novo** (`novo/Login.tsx`): nome do restaurante, e-mail e senha, "Mostrar a senha", e uma frase por vez que diz o que fazer. E-mail vazio ou sem @ e senha vazia
  **não vão ao servidor** e o foco vai ao campo certo; senha errada passa a frase do servidor; **sem sinal diz "sem conexão" (nunca chama de senha errada um pedido que nem chegou)** e
  erro do servidor vira frase nossa, sem inglês. O e-mail perde os espaços das pontas.
- **Quem pode abrir o quê vem do menu** (o mesmo `menuFor` que já mandava): dono, gerente, garçom, caixa, cozinha e entregador cada um vê as suas telas. O garçom abre **Mesas** como a tela
  de atender (não o cadastro de QR); a cozinha em Pedidos vê a fila da cozinha; **o entregador cai direto nas entregas dele**, como sempre. Restaurante com plano bloqueado só abre Pedidos,
  Entregas, Acerto de caixa e Plano, e **cai em como pagar**. O dono do sistema ganha Aprovações, Assinaturas e Chamados, com os números do servidor.
- **O menu** (`painel/PanelMenu.tsx`): em grupos (Vender, Cardápio, Números, Minha loja e, para o dono do sistema, Dono do sistema), com a frase de cada tela, o número de pedidos em aberto, "Ver o cardápio do cliente", "Preciso de ajuda"
  (só dono e gerente) e Sair. Esc fecha.
- **Avisos que chegam sozinhos** (`novo/Notices.tsx`): "Chegou um novo pedido" (com **Ver pedidos**), "N mesa chamando" (com **Atender**), plano vencendo (leve) e plano bloqueado (urgente, com
  **Ver plano**), em **qualquer tela** em que a pessoa esteja. O celular vibra uma vez por pedido novo e uma vez por chamada (a mesma chamada não vibra de novo). O que já estava aberto ao
  chegar no painel não faz alarde. Nas telas que já olham os pedidos (Pedidos, Cozinha, Hoje) o painel **não pergunta em dobro**.
- **Login que acaba.** O login dura 8 horas no servidor e se renova sozinho enquanto o painel está aberto e ao voltar de um celular que dormiu. Se acabar, qualquer tela percebe e a **entrada
  volta com o e-mail preenchido, o foco na senha e o aviso "Seu acesso terminou… não foi erro seu"**; o login velho é apagado do aparelho.
- **Primeira vez do dono neste aparelho:** com o cardápio vazio, vai direto ao Assistente (voz e foto). Resposta do servidor que não é uma lista **nunca vira "cardápio vazio"**.
- **"O que falta" do Hoje leva à tela certa** (mesas chamando → atender; sem mesa → cadastro de mesas; sem Pix → Pagamento).
- **As telas que ainda não foram refeitas abrem como sempre, dentro de uma moldura nova** (`novo/LegacyFrame.tsx`): título, menu e uma frase dizendo que aquela tela ainda está no
  desenho antigo e funciona igual. São baixadas só quando alguém abre; se não baixarem (sem sinal), a pessoa recebe uma frase e um botão, nunca tela em branco.

**Um defeito de verdade, achado pela prova no navegador e corrigido** (`service/api.ts`, vale também para o painel antigo): se a pessoa tocava em **Sair** enquanto a renovação do login
estava a caminho, a resposta atrasada **gravava o login de volta** no aparelho (num celular compartilhado, o próximo a abrir entraria como o anterior). Agora a resposta velha não mexe em
nada se o login mudou ou saiu, e uma resposta velha de "login acabou" também não derruba um login novo. Travado pela prova no navegador (falha sem o conserto, passa com ele).

**O que ainda não está no visual novo** (abre como sempre, dentro da moldura): cadastro de mesas e QR, Equipe, Resumo, Custos, Seu negócio, Pagamento (Pix), Meu link, Horário, Regiões de
entrega, Plano, Aprovações, Assinaturas, Chamados, a tela inicial do entregador, a faixa de pausar pedidos, o botão de avisos no celular (push), a folha de ajuda. O código dessas peças
foi **copiado** para `painel/legacyPanels.tsx` (o painel antigo não foi tocado) e some quando o painel antigo for apagado.

**Limites honestos:**

- O **"Guia passo a passo"** do painel antigo não foi recriado (o "O que falta" do Hoje cumpre o papel). A marca do topo do menu ainda não troca sozinha quando a logomarca muda
  (`onChanged` não está ligado). Os avisos ficam **fixos no alto da página** (não acompanham a rolagem: o painel esconde a rolagem lateral, o que desliga o "grudar").
  O botão de avisos no celular só aparece no Hoje.
- A marca de "guia visto" é uma por navegador e por usuário.
- **A bolinha de voz do painel já abre telas falando** (vigésima segunda rodada); falta o microfone ao lado de cada campo e a voz do lado do cliente.
- Nada disso vai ao ar sem o "pode". **Para as telas de Produtos funcionarem de verdade no servidor, o PR #76 precisa entrar antes** (a rota para editar prato).

**Como foi conferido:** `tests/novo/shellLogic.test.mjs` (24: a chave, o que cada função abre, plano bloqueado, qual tela é nova e qual é antiga, primeira vez do dono, quando olhar pedidos e
chamadas, os avisos e a ordem deles) e `loginLogic.test.mjs` (9: conferência dos campos, frase de cada problema, tela de entrada). **613 testes passam só na pasta do visual novo (1452 no total
das pastas de teste).** No navegador, com o aplicativo de verdade (a casca inteira, não a prévia) e um servidor de mentira (**95 conferências**): chave desligada, ligada e lembrada; entrar
(vazio, sem @, sem senha, senha errada, sem sinal, servidor com defeito, senha visível, espaços); o menu de cada função (dono, garçom, cozinha, entregador, plano bloqueado, dono do sistema)
e cada item dele; as telas novas e as antigas dentro da moldura; faixas de pedido novo e de chamada, com vibração uma vez só; "não pergunta em dobro" em Pedidos; login que acaba (401 em
qualquer pedido e na renovação) e entrar de novo; Sair com renovação a caminho; ajuda, cardápio do cliente; 320 px sem rolagem lateral.
Para ver sem servidor: `preview-novo.html#/entrar` (e `#/entrar-preenchido`, `#/entrar-sem-email`, `#/entrar-email-ruim`, `#/entrar-sem-senha`, `#/entrar-senha-errada`,
`#/entrar-sem-sinal`, `#/entrar-servidor`, `#/entrar-acabou`, `#/entrar-entrando`, `#/entrar-senha-visivel`), `#/avisos`, `#/avisos-plano`, `#/avisos-pedido`, `#/avisos-mesas`,
`#/avisos-bloqueado` e `#/tela-antiga`.

**Ainda não está ligado para o público:** a chave `?novo=1` vem desligada.

## Vigésima segunda rodada: a bolinha de voz do painel, falar o nome da tela (23/10/2026)

O GD escreveu, às 17:19 de 23/10, "Esqueça esse pode juntar que falei, e vamos perseguir ." e, às 17:20, "Prosseguir, corrigindo minha escrita acima". Li assim: **o "pode juntar"
que ele tinha dito fica sem efeito** (nada foi nem será juntado sem um "pode" novo e claro) e **"perseguir" quer dizer "prosseguir"**. Segui o plano do documento de mercado: a aposta
mais forte do Vem é **falar com o dono que escreve pouco**, então a primeira coisa é a bolinha de voz funcionar de verdade (item 90 e item 92 do GD).

**O que a bolinha faz agora** (`painel/useVoiceNav.ts`, contas em `painel/voiceNavLogic.ts`, ligada na casca em `painel/PanelShell.tsx`): em **toda tela do painel novo**, inclusive as
antigas dentro da moldura, um toque na bolinha abre o microfone; a pessoa fala o nome de uma tela ("pedidos", "mesas", "números", "montar o cardápio", "pix", "horário"...); o painel
**abre a tela, responde numa faixa acima da bolinha ("Você disse: … / Abrindo os pedidos.") e diz a mesma frase em voz alta**. Tocar de novo enquanto ouve cancela. A faixa tem botão Fechar
(44 px) e some sozinha em 8 segundos; com o menu aberto ela não aparece. O celular **só ouve depois do toque**, nunca por conta própria.

**"Como está o dia?"** (`hoje/briefLogic.ts`, busca em `painel/readBriefing.ts`): a pessoa pergunta ("como está o dia", "resumo do dia", "me atualiza", "quantos pedidos", "quanto vendi hoje") e a bolinha
**lê o dia em voz alta**, sem abrir tela, com as mesmas contas do Hoje: "Bom dia, João. 1 pedido esperando, o mais antigo há 3 minutos. 2 na cozinha. 1 a caminho. 2 Pix para conferir, R$ 78,50 no total.
2 mesas chamando. Vendas de hoje: R$ 420,00 em 12 pedidos." Os números vêm do servidor **na hora da pergunta** (nada fica guardado); enquanto vêm, a faixa diz "Olhando como está o dia…". Cada pedaço
vale sozinho e tem limite de 10 segundos: **busca que falhou nunca vira zero**, a fala diz "Não consegui ler os pedidos agora" (ou as vendas, ou as mesas) em vez de "nenhum pedido". Vendas só para dono e
gerente; mesas só para quem vai a uma mesa; Pix só para quem confere Pix. A faixa fica o tempo de ler (de 8 a 20 segundos). Se a pessoa toca de novo antes da resposta chegar, a resposta velha é descartada.

**Regras de honestidade** (todas com teste):

- **Só abre telas e lê o dia.** Não cria, não muda e não apaga nada; palavra errada, no máximo, abre a tela errada, e basta falar de novo. Por isso não pede confirmação.
- **Só leva ao que o menu mostra àquela pessoa** (a lista vem de `allowedViews`, a mesma do menu). O garçom que fala "custos" ouve "Não posso abrir os custos para você agora…"; com plano bloqueado,
  só abre o que o menu deixa. Testado para todas as funções, com e sem plano bloqueado e com e sem dono do sistema: **nunca leva a tela fora da lista**.
- **Não entendeu: diz o que falar.** "Não entendi. Diga, por exemplo: pedidos, abrir mesa ou mesas." com exemplos **das telas dela** (nunca a tela em que já está). Sem ninguém falar, ou com o
  microfone negado, a faixa diz o que fazer ("toque na bolinha e fale de novo; se o celular pedir o microfone, toque em Permitir"). Celular que não escuta manda ao menu. **Nunca silêncio.**
- **A frase mais comprida ganha**: "montar cardápio" abre o Assistente, "cardápio" abre Produtos, "taxa de entrega" abre Regiões, "pagar o plano" abre Plano, "pix para conferir" abre Pedidos.
  O garçom e a cozinha, que não abrem "Abrir mesa", ouvem "mesas" em vez de recusa. "Ajuda" diz o que se pode falar.
- A tela que já tem escuta própria (o **Assistente do cardápio**, "Falar os pratos") **continua com a dela**; a bolinha só usa a voz do painel quando a tela não passa a função (`novo/parts.tsx`).

**Como as peças se dividem:** `novo/voice.ts` (só o canal que entrega a voz às telas), `novo/VoiceBubble.tsx` (a faixa, só visual, com `role="status"`), `painel/voiceNavLogic.ts` (conta pura, sem
microfone nem rede), `painel/useVoiceNav.ts` (microfone e fala, usa o `hear` e o `speakAsync` que o Assistente já usa), `hoje/briefLogic.ts` (a fala do dia, conta pura) e `painel/readBriefing.ts` (as buscas).
Frases da faixa e do resumo em `novo/voiceCopy.ts` (motor em `novo/phrasing.ts`; ver a vigésima terceira rodada).

**Limites honestos:**

- A lista de palavras é **palpite meu** sobre como o dono fala. Vale ouvir donos de verdade e ajustar: é só acrescentar frases em `voiceNavLogic.ts` (o teste confere que nenhuma frase fica em duas telas).
- O reconhecimento é o do próprio navegador do celular (precisa de internet e de permissão do microfone). Onde o navegador não oferece, a bolinha avisa e manda ao menu. **Não foi testado em um Android
  de verdade**, só com um microfone de teste no navegador.
- **Ainda não faz**: cadastrar ou mudar coisas por voz no painel (**marcar prato esgotado ou de volta, feito na vigésima quinta rodada**; o resto, não), responder perguntas além do resumo do dia ("qual prato vende mais?"), microfone ao lado de cada campo de escrever (**feito na vigésima quarta rodada** para os campos de texto livre do painel novo), e a voz do lado do cliente (**feita na vigésima sexta rodada**: põe prato na sacola com Desfazer, abre as escolhas, busca e abre telas; nunca envia, paga nem chama o garçom).
- Nada disso vai ao ar sem o "pode": a chave `?novo=1` continua desligada por padrão.

**Como foi conferido:** `tests/novo/voiceNavLogic.test.mjs` (25: a fala sem acento e sem pontuação, cada tela do menu tem frase, nenhuma frase em duas telas, a frase mais comprida, o que cada função não abre, bloqueio por plano,
"já está aqui" com a preposição certa, ajuda, não entendi, exemplos, as perguntas sobre o dia, o tempo da faixa, e a ligação na casca e na moldura), `tests/novo/briefLogic.test.mjs` (11: a fala do dia para cada função,
singular e plural, Pix, vendas só para quem vê, **cada busca que falha vira "não consegui ler" e nunca zero**, os minutos falados, a hora de Brasília e a busca com limite de tempo) e `toque.test.mjs` (a bolinha da tela
manda em tudo). No navegador, com o aplicativo de verdade, um servidor de mentira e um **microfone de teste** (**29 conferências novas, 124 no total**): ouvindo, cancelar, "pedidos", "já está aqui", "mesas" na moldura antiga
e de lá a uma tela nova, não entendi, ninguém falar, microfone negado, Fechar, menu aberto, a bolinha própria do Assistente, garçom ("custos" recusa, "mesa" abre a nova), celular que não escuta, 320 px sem rolagem lateral,
"como está o dia" (dono, servidor com defeito, garçom, e resposta velha descartada).
**649 testes passam só na pasta do visual novo (1488 no total das pastas de teste)**; tipos, build, segurança e conformidade em ordem.

## Vigésima terceira rodada: as frases da voz não cansam nem envelhecem (23/10/2026)

O GD escreveu, às 17:49 de 23/10: "Lembre de atualizar essas frases em tempos para não ficarem ultrapassadas e, ou cansativas. .. sejam dinâmicas e inteligentes e atualizadas... Pode prosseguir com os demais, também."
Li assim: **a bolinha e o resumo do dia não podem dizer sempre a mesma frase** (cansa), **têm de falar de acordo com a hora e com o que está acontecendo** (inteligente) e **têm de ser revistas de tempos em tempos** (não envelhecem).

**O que mudou** (motor em `novo/phrasing.ts`, textos em `novo/voiceCopy.ts`, ligado em `painel/useVoiceNav.ts`, `painel/voiceNavLogic.ts` e `hoje/briefLogic.ts`):

- **Não repete.** Cada situação tem de 3 a 5 formas de dizer a mesma coisa ("Abrindo os pedidos." / "Certo, abrindo os pedidos." / "Vamos para os pedidos." / "Indo para os pedidos."). Elas saem numa **sacola embaralhada**: todas passam
  uma vez antes de qualquer uma voltar, e a mesma frase **nunca sai duas vezes seguidas** (testado com 60 sorteios diferentes).
- **Encurta com o uso.** As primeiras vezes a bolinha explica ("Estou ouvindo. Diga a tela que você quer abrir."); depois de 3 vezes fica "Pode falar." / "Estou ouvindo." / "Diga." O "Não entendi" e o aviso de microfone também
  ficam curtos. **A conta fica só no celular da pessoa** (guarda um número e o dia, nada do restaurante); quem passa **21 dias** sem ouvir uma frase volta a ouvir a explicação completa.
- **Os exemplos andam.** O "Não entendi. Diga, por exemplo: pedidos, abrir mesa ou mesas." mostra três telas dela, e **na vez seguinte mostra outras três** (sempre só telas que o menu dela mostra, nunca a que já está aberta).
- **O resumo do dia fala conforme o dia.** A saudação às vezes diz o dia da semana ("Bom dia, João. Hoje é sexta-feira."). **Pedido esperando há 20 minutos ou mais (a cor vermelha da comanda) puxa a atenção**: "Atenção: 2 pedidos esperando, o mais
  antigo há 25 minutos." As vendas usam o jeito da hora ("Até agora, R$ 420,00 em 12 pedidos." de manhã; "No dia, …" à noite), e o "ainda sem vendas" não promete nada: de manhã "O dia está começando", depois "Hoje ainda não teve venda".
  No fim, enquanto a pessoa ainda está aprendendo, vem uma dica ("Para abrir, diga pedidos."), **só quando há pedido esperando e a pessoa abre a tela de Pedidos**; depois de 3 vezes ela some.
- **Os fatos nunca mudam, só o jeito.** Todas as formas de cada situação dizem os mesmos números e os mesmos nomes (teste confere o número, o tempo, o singular e o plural em todas). **Busca que falhou continua dizendo
  que falhou, em qualquer forma**, e nunca vira "nenhum pedido".
- **O que é ordem não varia.** Nome de botão ("Fechar", "Tentar de novo") e instrução de como fazer ficam sempre iguais; só saudação, confirmação, "não entendi" e resumo mudam. Quem aprendeu onde tocar não pode ter o botão trocado de nome.

**Como as frases ficam atualizadas** (a parte do "em tempos" do GD):

1. **O que é dado nunca envelhece**: hora, dia da semana, números, e os exemplos saem das telas que o menu mostra naquele momento (quando entra uma tela nova com palavras em `voiceNavLogic.ts`, os exemplos já a incluem).
2. **O que é redação tem data de revisão**: `PHRASES_REVIEWED` em `novo/voiceCopy.ts` (hoje, 2026-10-23). A rotina, escrita no topo do mesmo arquivo: **a cada uns 2 meses, ou quando entra uma tela nova**, ler cada lista em voz alta,
   trocar a forma que já cansa ou que fala de algo que mudou, e mexer na data. Próxima revisão marcada para **por volta de 23/12/2026**.
3. **O teste não deixa a qualidade cair**: `tests/novo/phrasing.test.mjs` confere **toda forma de toda lista** (mínimo de 3 formas, frase curta de ouvir, termina em ponto, sem palavra difícil, sem "em os"/"de o", sem número faltando,
   a forma curta é mesmo mais curta, sem forma repetida). Não há prazo que quebre o teste: um prazo vencido derrubaria a publicação automática sem culpa de ninguém.

**Limites honestos:** as redações são **minhas** e nunca passaram por um ouvido de dono de restaurante; ouvir o GD e donos e trocar o que soar estranho é a revisão que mais vale. As frases do **resto do sistema** (avisos, telas de entrada,
textos de ajuda do Hoje, o cliente) **ainda são fixas** de propósito: são instrução ("toque em Tentar de novo"), e instrução que muda de um dia para o outro atrapalha; se o GD quiser variar algum texto desses, é um a um.

**Como foi conferido:** `tests/novo/phrasing.test.mjs` (26: a sacola, as duas formas e a uma só, o encurtar com o uso, o contador no celular com prazo e com armazenamento quebrado, os exemplos andando, a hora do dia, a escrita de cada forma do banco,
os fatos em todas as formas, a bolinha e o resumo do dia com o sorteio de verdade e o resumo "de sempre" sem ele). No navegador, com o aplicativo de verdade e o microfone de teste (**129 conferências, 5 novas**): o convite não repete, explica nas
primeiras vezes e fica curto depois, o "não entendi" muda de jeito e de exemplos e fica curto, só a contagem fica no celular. **675 testes passam só na pasta do visual novo (1514 no total das pastas de teste)**; tipos, build, segurança e conformidade em ordem.

## Vigésima quarta rodada: o microfone ao lado dos campos de escrever (23/10/2026)

"Pode prosseguir com os demais" (GD, 23/10, 17:49). O próximo item do plano do item 90 ("toda entrada por voz, escrita ou foto"): **todo campo de texto livre ganha um microfone ao lado**.

**Como funciona** (`novo/DictateButton.tsx`, texto em `novo/dictation.ts`, escuta em `painel/useVoiceNav.ts`, entregue às telas por `novo/voice.ts`): a pessoa toca no microfone dentro do campo, **fala**, e o que ela disse **aparece no campo**, arrumado
(primeira letra maiúscula, sem ponto no fim; nada é trocado nem "corrigido"). O painel **lê de volta** o que escreveu ("Ficou assim: Pastel de carne.") e mostra na mesma faixa da bolinha. A pessoa vê o campo e corrige à mão se precisar.
**Nada é salvo**: o prato só vai ao servidor quando ela toca no botão de salvar de sempre (provado no navegador: zero envios ao servidor depois de ditar).

**Onde entra agora** (campos de texto livre das telas novas): nome do prato, "o que vem no prato" e a busca em Pratos; nome da categoria; nome do grupo de opções, nome de cada opção e o campo "escreva as opções" (nesse, de várias linhas, a fala vai **depois** do que já está escrito);
busca do tipo de negócio e "acrescentar prato" no "começar de um modelo". **Onde não entra, de propósito:** senha, e-mail, **preço**, código de entrega, número da mesa e envio de arquivo (número falado vira erro fácil: "doze noventa" tem de virar 12,90, e isso fica para quando houver
conferência por voz) — um teste garante que nenhum desses ganha microfone. O campo do **Assistente do cardápio** já tinha o ditado dele e continua com ele.

**Regras de honestidade** (todas com teste):

- **Só depois do toque**, e **só um microfone por vez** (o mesmo da bolinha): tocar no microfone do campo enquanto ouve cancela e não escreve nada; **mudar de tela enquanto ouve também cancela**.
- **Sem fala, o campo fica como estava**: a faixa diz o que fazer ("Não ouvi nada. Toque no microfone do campo e fale de novo. Se o celular pedir o microfone, toque em Permitir."). Nunca silêncio.
- **Celular que não escuta: o microfone do campo nem aparece** (botão que não leva a lugar nenhum não entra). Fora do painel (conferência de imagem, telas do cliente) também não aparece.
- Cada microfone tem **44 px**, nome claro para o leitor de tela ("Falar o nome do prato"), marca de "ouvindo" que não depende só da cor e respeita quem pediu menos movimento.
- As frases de volta ("Escrevi: …" / "Anotei: …" / "Ficou assim: …") variam e encurtam pelo mesmo motor da rodada 23.

**Limites honestos:**

- **Não foi testado em Android de verdade**, só com microfone de teste no navegador; as palavras que o celular entende e acentua (ex.: "açaí") dependem do reconhecimento dele.
- O reconhecimento de voz é o do **próprio navegador**. No Chrome, o áudio costuma ir ao serviço de voz do Google para virar texto. Isso já valia para o Assistente do cardápio e vale para a bolinha e o ditado. **Não encontrei o aviso disso nos textos de privacidade do projeto: vale incluir
  e conferir com o advogado antes de abrir ao público.**
- **Ainda sem microfone:** campos das telas antigas dentro da moldura (equipe, custos, horário, regiões…, que serão refeitas), do lado do cliente (a casca do cliente ainda não está ligada) e de preço (ver acima). **Cadastrar pelo painel falando a frase inteira** ("novo prato pastel de carne dezoito reais") continua não existindo.
- Nada disso vai ao ar sem o "pode": a chave `?novo=1` continua desligada por padrão.

**Como foi conferido:** `tests/novo/dictation.test.mjs` (7: o texto do campo, limite, o que não é inventado, campo de várias linhas, o botão, onde o microfone entra e **onde nunca entra**, e as regras da escuta). No navegador, com o aplicativo de verdade e o microfone de teste
(**139 conferências, 10 novas**): o formulário do prato tem microfone no nome e no "o que vem no prato" e **nenhum no preço**, o que se fala vai para o campo arrumado, o painel diz o que escreveu na faixa e em voz alta, **nada foi salvo**, sem ninguém falar o campo fica como estava,
o botão e a bolinha ficam marcados ouvindo, tocar de novo cancela, mudar de tela cancela, a categoria recebe o nome falado, e celular que não escuta não mostra microfone.
**682 testes passam só na pasta do visual novo (1521 no total das pastas de teste)**; tipos, build, segurança e conformidade em ordem.

## Vigésima quinta rodada: "acabou o pastel de carne", a voz marca o prato, mas só depois do "sim" (23/10/2026)

"Pode prosseguir com os demais" (GD, 23/10, 17:49). Até aqui a bolinha só **abria telas e lia o dia**. Esta é a primeira coisa que ela **muda**: a pessoa fala **"acabou o pastel de carne"** (ou "voltou o açaí") e o prato fica esgotado (ou volta) no cardápio do cliente, sem abrir a tela de Produtos.

**Como funciona** (conta em `painel/voiceDishLogic.ts`, ida ao servidor em `painel/voiceDish.ts`, escuta e pergunta em `painel/useVoiceNav.ts`, botões na faixa em `novo/VoiceBubble.tsx`):

1. A pessoa toca na bolinha e fala. A voz entende "acabou", "esgotou", "terminou", "faltou", "ficou sem", "não tem mais" (esgotar) e "voltou", "chegou", "tem de novo", "tira o esgotado", "desmarca" (voltar), mais o resto da frase como nome do prato.
2. A voz **busca a lista de pratos na hora** (só lê, nada muda) e acha o prato.
3. **Pergunta antes**, com o nome que entendeu, na faixa e em voz alta: "Marcar Pastel de carne como esgotado? Toque em Sim, ou toque na bolinha e diga sim." Dois botões de 44 px: **Sim** e **Não**.
4. **Só depois do "sim"** (no botão ou falado na bolinha) o pedido vai ao servidor. A voz então diz **o que o servidor confirmou** ("Pronto: Pastel de carne marcado como esgotado. Para desfazer, diga: voltou Pastel de carne.") e a tela de Pratos, se estiver aberta, lê a lista de novo na hora.

**Regras de honestidade e de segurança** (todas com teste):

- **Nunca muda na primeira frase.** Um teste garante que só existe **uma** escrita no servidor em todo o fluxo, que ela só roda dentro da confirmação, e que o gancho de voz e as contas não falam com o servidor.
- **Não adivinha.** Mais de um prato com a palavra ("açaí" com o de 300 e o de 500): lista os nomes ("Açaí 300ml ou Açaí 500ml") e **pede o nome inteiro**, sem perguntar nem marcar nada. Nenhum prato: diz isso e **abre Pratos** para a pessoa procurar. Nunca marca "o parecido".
- **Já está assim**: "Pastel de carne já está marcado como esgotado. Não mudei nada." Sem pergunta.
- **A pergunta some e nada é marcado** se a pessoa disser "não", disser **outra frase**, tocar para cancelar, fechar, ficar em silêncio ou deixar passar **30 segundos**.
- **"Não" ganha de "sim"** ("não pode" é não). Frase com "não" no pedido ("não acabou o pastel") não vira pedido.
- **Conversa de movimento não é prato**: "o pedido chegou", "a entrega terminou", "a mesa 4 chamou" não viram pedido de prato.
- **Só para quem o servidor deixa marcar**: dono, gerente e cozinha. Garçom, caixa e entregador veem Produtos no menu, mas o servidor recusaria; a voz **nem faz a pergunta** (um teste confere os papéis com a regra do servidor).
- **A voz só afirma o que o servidor confirmou.** Servidor com defeito ou resposta diferente: "Não consegui confirmar a marcação do prato. Veja na tela de produtos como ficou." (**não** jura que nada mudou, porque o pedido pode ter chegado). Recusa com motivo (4xx): a frase do servidor aparece como veio. Lista que não carrega: "Não consegui ver os pratos agora", **nunca** "nenhum prato".
- "Acabou" sozinho, sem nome de prato, continua só abrindo a tela de Produtos.
- As frases (pergunta, "pronto", "já estava", "mais de um", "não achei") variam e encurtam pelo mesmo motor da rodada 23; os nomes dos botões, **Sim** e **Não**, nunca variam.

**Limites honestos:**

- **Não foi testado em Android de verdade**, só com microfone de teste. O que o celular ouve de "açaí" ou "pastéis" pode vir diferente; a conta ignora acento e plural, mas as **listas de palavras ("acabou", "voltou"…) são palpite meu** para afinar com donos de verdade.
- Só marca **esgotado** e **de volta**. **Preço por voz** continua fora (número falado precisa de conferência própria), e "voltou tudo" não foi ligado à voz.
- A pergunta usa a lista do servidor **na hora da fala**: se o prato mudou de nome um segundo depois, a confirmação vale para o prato que foi perguntado (o mesmo `id`).
- Nada disso vai ao ar sem o "pode": a chave `?novo=1` continua desligada por padrão.

**Como foi conferido:** `tests/novo/voiceDishLogic.test.mjs` (18 testes: o que a pessoa pediu, qual prato, o plural, empate, nenhum, a lista de nomes, a resposta, a regra de papéis conferida com o servidor, o "sim" e o "não", e as garantias de que nada é marcado antes do "sim"). No navegador, com o aplicativo de verdade e o microfone de teste
(**163 conferências, 24 novas**): pergunta com o nome certo e Sim/Não, nada no servidor antes do "sim", o servidor recebeu o pedido certo uma vez, o "não" não manda nada, o "sim" falado na bolinha vale, dois açaís pedem o nome inteiro, prato já esgotado não pergunta, prato que não existe abre Pratos,
outra frase/silêncio/cancelar derrubam a pergunta, servidor com defeito e recusa 4xx, lista que não carrega, garçom e caixa sem pergunta, cozinha marca, e a tela de Pratos mostra o prato esgotado logo depois.
**700 testes passam só na pasta do visual novo (1539 no total das pastas de teste)**; tipos, build, segurança e conformidade em ordem.

## Vigésima sexta rodada: a voz do lado do cliente, só na sacola e sempre com Desfazer (23/10/2026)

"Continue" (GD, 23/10, 20:13). Até aqui a bolinha do cardápio do cliente era só enfeite. Agora o caminho do cliente no visual novo (`loja/OrderFlow.tsx`: cardápio, escolhas do prato, sacola, acompanhamento, mesa) **está ligado ao aplicativo atrás da mesma chave `?novo=1`** (sem a chave, o cliente continua no aplicativo de sempre) e a bolinha **ouve**.

**O que a pessoa pode dizer** (conta em `loja/shopVoiceLogic.ts`, microfone e sacola em `loja/useShopVoice.ts`, achar o prato em `loja/dishFinder.ts`):

- **"Quero dois pastéis de carne"**, "um açaí 500", ou só o nome do prato: o prato simples **entra na sacola** com a quantidade dita, a faixa diz como a sacola ficou ("A sacola está com 2 itens, R$ 18,00.") e traz o botão **Desfazer**, que tira da sacola só o que a voz pôs.
- **Prato com tamanho ou extras** ("uma pizza", "duas pizzas"): a voz **abre a folha das escolhas** já com a quantidade dita e manda tocar em **Adicionar**. Quem escolhe o tamanho é a pessoa; a voz não adivinha.
- **"Tirar um pastel de carne"**: tira da sacola e diz como ficou.
- **"Buscar suco"**, "tem suco?": escreve na caixa de busca que a pessoa vê e lê o que achou.
- **"Abrir a sacola"**, "cardápio", "acompanhar o pedido", "chamar o garçom", "voltar": abre a tela; se falta algo (sacola vazia, sem pedido, sem mesa) diz o que falta.
- "Ajuda" ensina frases com pratos de verdade do cardápio.

**Regras de honestidade e de segurança** (todas com teste):

- **A voz nunca envia o pedido, nunca paga e nunca chama o garçom.** O gancho nem conhece essas ações (um teste confere que ele só usa a sacola, abrir tela, escrever na busca e abrir a folha). "Enviar o pedido" abre a sacola e **manda tocar em Enviar pedido**; já dentro da sacola, só repete onde tocar. "Chamar o garçom" abre a tela da mesa e **manda tocar em Chamar garçom ou Pedir a conta**.
- **Não adivinha:** dois pratos parecidos ("pastel"): lista os nomes e pede o nome inteiro; prato que não existe: diz e ensina a dizer como está na tela.
- **Diz a verdade do cardápio:** restaurante fechado, prato esgotado ou indisponível: a voz diz isso e **não põe nada na sacola**. Cardápio ainda abrindo ou que não abriu: diz isso, nunca "não achei".
- Quantidade acima do máximo da sacola é recusada com a frase certa; "quero ver a sacola" não vira prato.
- Os nomes dos botões que a voz cita (Adicionar, Enviar pedido, Chamar garçom, Pedir a conta, Tentar de novo, Desfazer) **são os da tela**, e um teste lê o código das telas para conferir.
- As frases variam e encurtam pelo mesmo motor da rodada 23, sempre com os mesmos fatos.

**Defeitos reais que a conferência no navegador achou e eu corrigi:**

1. A faixa da voz ficava **escondida atrás da folha das escolhas** (a folha cobre a tela inteira): agora a faixa sobe para o alto, por cima de tudo, enquanto a folha está aberta.
2. Dentro da sacola, "enviar o pedido" respondia só "você está na sacola": agora diz onde tocar.
3. Dentro da tela da mesa, "chamar o garçom" respondia só "você já está na mesa": agora diz quais botões tocar.

**Limites honestos:**

- **Não foi testado em Android de verdade**, só com microfone de teste. As listas de palavras ("quero", "tirar", "buscar", "abrir"…) e como o celular escreve os pratos são **palpite meu** para afinar com clientes de verdade.
- O fim do cardápio novo do cliente **traz o link "Sou da equipe ou dono"** (como o aplicativo de sempre; o endereço vem do `App.tsx`, o link some se o endereço não vier), com altura de dedo.
- A voz do cliente, como a do painel, usa o reconhecimento do navegador (no Chrome o áudio vai para o Google). O texto de privacidade sobre isso **continua dependendo de advogado**.
- Nada disso vai ao ar sem o "pode": a chave `?novo=1` continua desligada por padrão.

**Como foi conferido:** `tests/novo/shopVoiceLogic.test.mjs` (25 testes: quantidade, plural, máximo, número no nome, prato com escolhas, fechado/esgotado/indisponível, mais de um, nenhum, tirar, telas, nunca envia, busca, cardápio não pronto, ajuda, conta da sacola, frases com os mesmos fatos, nomes de botão, ligação no `App.tsx` e no `OrderFlow`). No navegador, com o aplicativo de verdade e o microfone de teste
(**199 conferências, 36 novas**): prato simples na sacola com a quantidade dita, Desfazer, folha de escolhas com a faixa por cima e quantidade 2, Adicionar pelo toque, esgotado e indisponível sem pôr nada, busca escrita na caixa, sacola aberta por voz, "enviar" que não envia, **nenhuma chamada ao servidor em toda a conversa**, restaurante fechado, mesa (garçom e cardápio), celular sem voz (o toque nos pratos segue valendo), sem a chave o aplicativo de sempre, e 320 px sem rolagem lateral com o botão Enviar e a bolinha lado a lado.
**726 testes passam só na pasta do visual novo (1565 no total das pastas de teste)**; 200 conferências no navegador (a do link da equipe entrou); tipos, build, segurança e conformidade em ordem.

## Vigésima sétima rodada: o Horário no visual novo, com pausa na hora e horário falado (24/10/2026)

"Continue" (GD, 23/10, 20:13). O Horário era uma das telas ainda no desenho antigo dentro da moldura. Agora é uma tela nova (`novo/Hours.tsx`, ligada em `painel/HoursScreen.tsx`, contas em `painel/hoursViewLogic.ts`), atrás da mesma chave `?novo=1`. **Nenhuma regra mudou:** quem decide se o restaurante está aberto, o que vale e as palavras que o cliente lê continua sendo o servidor (`backend/hours.py`); a edição dos dias, a conferência do que foi digitado e a linha-resumo são as mesmas da tela antiga (`service/hoursDraft`), já testadas.

**O que a tela mostra, de cima para baixo:**

- **Como o cliente vê o restaurante agora:** *Aberto agora*, *Fechado agora* (com a frase que o servidor escreveu, por exemplo "Abrimos amanhã às 11h."), *Pedidos pausados* ou *Sem horário* ("o restaurante recebe pedido a qualquer hora"). A pausa ganha de tudo: pausado nunca aparece como aberto.
- **O botão de pausar** (*Pausar os pedidos agora* / *Voltar a receber pedidos*): **vale na hora, num toque**, e não mexe nos dias nem perde o que a pessoa estava editando.
- **Os sete dias**, cada um um cartão com o botão *Aberto/Fechado*, campos de hora *Abre* e *Fecha*, *Outro turno (almoço e jantar)* (no máximo dois), botão *Tirar o turno 2* (em linha própria, com o nome escrito) e *Copiar para todos os dias* só no primeiro dia aberto. A semana em uma linha ("Seg a sáb 11h às 22h · Dom fechado") fica embaixo.
- **Salvar horário** na barra de baixo (apagado enquanto nada mudou, ligado no primeiro horário), o selo *Não salvo* com *Descartar*, e o que falta acertar escrito em frases ("Quarta: abrir e fechar na mesma hora não vale…"). Se o servidor recusar, a tela mostra a frase dele e **mantém o que a pessoa digitou**.
- **Tirar o horário (sempre aberto)** pede **dois toques**: o primeiro vira *Toque de novo para tirar o horário* e expira em 4 segundos.

**Falar o horário** (botão da tela e bolinha): "de segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado". As palavras viram horas na tela com a lista do que foi entendido e **"Ainda não foi salvo"**: a pessoa confere e toca em *Salvar horário*. Falar nunca grava sozinho (um teste lê o código e confere que `saveAdminHours` só é chamado pelo botão Salvar, depois da conferência). Enquanto ouve, mostra as palavras que chegam, *Pronto* (ou tocar na bolinha de novo) e *Cancelar*. Se não entendeu ou não ouviu nada, a tela diz isso e ensina a frase. Sem microfone no celular, o botão de falar não aparece e tudo se faz tocando.

**Defeitos reais que a conferência no navegador achou e eu corrigi:**

1. Em celular de 320 e 360 px, com dois turnos no dia, a **hora ficava cortada** ("11:00 A"): o botão de tirar o turno (um X) comia o espaço. Agora ele vai numa linha própria, com o nome escrito (*Tirar o turno 2*), e as duas horas ficam com a largura toda; a conferência passou a medir a largura de cada campo.
2. O aviso "quarta: abrir e fechar na mesma hora não vale" saía com o dia em **minúscula**: a tela agora começa cada aviso com maiúscula.
3. (Só do teste, não da tela.) O microfone de teste repetia a mesma frase a cada volta do ditado; passou a falar uma vez. E a conferência antiga do "esgotado" falhava de vez em quando porque a fala do celular troca o ponto por vírgula em uma das três formas da frase: agora aceita as duas.

**Limites honestos:**

- **Não foi testado em Android de verdade**, só com microfone de teste. O entendimento do que a pessoa fala é o da tela antiga (`service/spokenHours`); frases fora do padrão podem não ser entendidas, e a tela avisa.
- O campo de hora é o do próprio navegador (`type="time"`): o seletor muda de aparência de um celular para outro.
- Nada disso vai ao ar sem o "pode": a chave `?novo=1` continua desligada por padrão. A tela antiga (`service/HoursPanel.tsx`) continua no código, sem uso na moldura nova.

**Como foi conferido:** `tests/novo/hoursViewLogic.test.mjs` (24 testes: aberto, fechado, pausado e sem horário; pausa que ganha de tudo; tela abrindo ou com erro sem dias inventados; sete dias em ordem; turnos; copiar só no primeiro dia aberto; resumo igual ao da tela antiga; só salva o que mudou; frases do que falta acertar; fala entendida, não entendida, não ouvida e ouvindo; tirar o horário; **salvar só no botão**; **pausa num toque e tirar em dois**; nomes de botão iguais aos das frases; frases sem jargão e sem exclamação; ligação na casca; tamanho de dedo e página de conferência). No navegador, com o aplicativo de verdade e o microfone de teste (**247 conferências, 47 novas**): sem horário salvo, salvar, editar e descartar, abrir o domingo, dois turnos, pausa sem perder a edição, horário falado pelo botão e pela bolinha sem gravar até o Salvar, fala sem sentido e silêncio, ouvindo e cancelar, tirar o horário (primeiro toque expira, dois toques tiram), servidor recusando, conferência da tela, pausado ao abrir, servidor fora com *Tentar de novo*, celular sem microfone, e 320 px sem rolagem lateral com campos e botões do tamanho de um dedo. A página de conferência (`preview-novo.html#/horario`) tem as 11 situações: `#/horario`, `#/horario-fechado`, `#/horario-pausado`, `#/horario-sem`, `#/horario-ouvindo`, `#/horario-entendi`, `#/horario-nao-entendi`, `#/horario-problema`, `#/horario-salvo`, `#/horario-carregando`, `#/horario-erro`.
**1589 testes passam no total das pastas de teste (750 só na pasta do visual novo)**; 247 conferências no navegador; tipos, build, segurança e conformidade em ordem.

## Vigésima oitava rodada: acessibilidade medida em todas as telas, e o que ela consertou (24/10/2026)

"Eu já diria que você continuasse fazendo as programações, verificando os botões, verificando os comandos, a acessibilidade…" (GD, 23/10, 21:22). Em vez de olhar tela por tela, montei uma **medição de máquina** que passa por todas as telas da página de conferência (mais de 160) e achou defeitos que nenhum teste de lógica via. Detalhes, números e o que só um celular de verdade responde estão em `docs/acessibilidade.md`.

**Medições** (`tests/navegador/acessibilidade/`, `rodar.sh`; precisam de navegador, então rodam no computador e não no GitHub): leitor automático axe-core (WCAG 2.2 AA), contraste de verdade com foto do fundo atrás de cada texto (pega degradê e relevo 3D), tamanho de dedo e contorno de foco ao andar com Tab, e letra ×1,5 e ×2 em 360 e 320 px. A lista de telas vem do próprio `preview.tsx`, então tela nova entra sozinha.

**O que foi consertado:**

- **Contraste:** texto de apoio (`#566a5f` → `#4d6157`, era 4,37:1), texto de link (`#b84200`, o primeiro ajuste ainda dava 4,27:1), azul do Vem Trabalhar (`#1f63ff` → `#1650e0`, era 4,2:1 com letra branca), balãozinho de atalho laranja, e o cartão de prato em edição (opacidade 0,6 → 0,8).
- **Leitor de tela:** o aviso saía com `role` dentro da linha da lista (`<li>`), o que quebra a lista (o papel foi para o texto de dentro); o atalho para o outro lado virou região com nome ("Outro caminho"); o código de entrega passou a ser lido pelo nome falado; "Informações do restaurante" e "Chamar o atendente" ganharam `role="group"`, porque nome em caixa sem papel é ignorado.
- **Letra grande:** abas que descem de linha, linhas de conta, total do dia, passos, células do Hoje, cabeçalho da lista de pratos e mensagens que quebram a palavra em vez de sair da tela.

**Resultado:** leitor automático 0 defeitos (390 e 320 px); contraste 0 abaixo do mínimo; 0 alvos com menos de 44 px e 0 sem contorno de foco; 0 telas rolando de lado com letra ×1,5 (360 e 320 px) e ×2 (360 px).

**Teste que roda no GitHub:** `tests/novo/acessibilidade.test.mjs` (17 testes): as contas de contraste das cores do sistema visual (os dois temas, incluindo o brilho dos botões no ponto onde a letra começa), nenhum `role` em `<li>`, `aria-label` só em quem pode ter nome, o atalho em `<nav>`, e as regras de CSS da letra grande. Um erro de acessibilidade já consertado não volta sem um teste vermelho.

**Os comandos de voz (a outra metade do pedido do GD):** conferi, para cada uma das seis funções (dono, gerente, garçom, caixa, cozinha, entregador), **toda frase de voz do painel e do cliente**. Achado real: quem falava só **"enviar"** ou **"terminar"** na sacola não era entendido (as palavras estavam na lista do envio, mas nenhuma frase de tela as ligava). Agora a voz abre a sacola e diz onde tocar em *Enviar pedido*; **a voz continua sem nunca enviar**. O que passou na conferência: toda frase leva à tela dela; ninguém é levado a uma tela que o menu dele não mostra; nenhuma resposta fica em silêncio; marcar prato esgotado só para quem o servidor deixa e só depois do "sim"; "acabou" sozinho ou com "não" não marca nada. O roteiro **"o que dá para falar"** (`docs/comandos-de-voz.md`) é **gerado do código** por `tests/novo/comandosDeVoz.test.mjs` (10 testes): se uma frase entrar ou sair e o roteiro não for atualizado, o teste fica vermelho.

**Como foi conferido:** `tests/novo/acessibilidade.test.mjs` (17), `tests/novo/comandosDeVoz.test.mjs` (10) e 1 teste novo em `shopVoiceLogic`; dois testes antigos (`toque.test.mjs`) passaram a esperar o que o conserto mudou de propósito (papel `img` no código de entrega; opacidade 0,8 no prato em edição). **1617 testes passam no total das pastas de teste (778 só na pasta do visual novo)**; tipos, build, segurança e conformidade em ordem; no navegador, com o aplicativo de verdade, **247 conferências certas**. A medição completa de acessibilidade (`rodar.sh`) passou com as ferramentas da pasta nova, em 162 telas.

**Limites honestos:** medição de máquina não substitui TalkBack e VoiceOver de verdade, microfone real, teclado do celular cobrindo botões, sol forte nem mão suja. Isso foi para a lista de pendências de teste em celular (`docs/teste-no-celular.md`, "Fica para depois"), como o GD pediu. Nada disso mexe no que o público vê sem o "pode": a chave `?novo=1` continua desligada.

## Vigésima nona rodada: Divulgar, o "Meu link" vira link, mensagem pronta e cartão de prato (24/10/2026)

"…o marketing, a venda, a busca de clientes, a retenção, a recorrência, a captação de novos clientes, o disparo de e-mails, a captura de e-mails, a captura de WhatsApp, captura de Telegram, imagens, marketing…" (GD, 23/10, 21:22). Comecei pelo que dá valor já e **não depende de nenhuma decisão do GD**: ajudar o dono a divulgar o restaurante com o que ele já tem (o link, o nome, os pratos, os preços, as fotos). **Tudo nasce no toque do dono; nada é enviado sozinho; nenhum dado de cliente entra.** O mapa completo (o que já existe, o que vem e o que só sai com o "pode") está em `docs/divulgacao-do-restaurante.md`.

A tela antiga "Meu link" (`nav/ShareLinkView.tsx`) saiu da moldura nova. A nova é `novo/Share.tsx` (só desenho, por props), ligada em `painel/ShareScreen.tsx`, com as contas em `painel/shareLogic.ts`, o desenho da imagem em `painel/shareCardDraw.ts`, o que fala com o navegador em `painel/shareCardRender.ts` e as frases em `novo/shareCopy.ts`.

**O que a tela mostra:**

- **Seu link** (inteiro, marcável com um toque): *Copiar o link* (vira *Link copiado*) e *Abrir para conferir*. Se o celular recusar copiar, o texto aparece **marcado** para segurar e copiar, e o botão não mente.
- **Mensagem pronta:** o balão como o cliente vai ler, *Mandar no WhatsApp* (abre com o texto pronto e **sem número**: quem recebe é o dono quem escolhe), *Copiar a mensagem* e *Outra mensagem* (cinco formas de dizer a mesma coisa, sem repetir, sempre com o nome e o link; a primeira é a da tela antiga, palavra por palavra).
- **Cartão de um prato:** os pratos disponíveis (foto primeiro; 8 e *Ver mais*), nunca esgotado, sem nome ou sem preço. Ao escolher, a tela monta no celular uma imagem PNG: **Feed** (1080 × 1350, 4:5) ou **Status** (1080 × 1920, 9:16, com o texto no miolo, longe de onde o aplicativo põe os botões dele), com a foto do prato cobrindo o cartão, o nome do restaurante, o nome grande do prato, o preço em etiqueta laranja, "Peça pelo celular" e o link. *Mandar o cartão* abre o compartilhar do celular com a imagem e o texto (só aparece se o celular sabe), *Baixar a imagem* guarda na galeria. O texto que vai junto também tem *Outro texto*, *Copiar o texto* e *Mandar o texto no WhatsApp*. A marca **"Feito com o Vem Comer"** no pé do cartão vem ligada e o dono desliga num toque (escolha minha; o GD pode inverter).
- **Onde colocar:** dicas de WhatsApp, Instagram e o atalho para Mesas.

**Defeitos reais que a conferência achou e eu corrigi:**

1. **Nome do prato desenhado fora do cartão** no teste do desenho: depois da etiqueta do preço (que escreve centralizado) o nome do prato continuava centralizado e passava da margem. O teste "nada sai da imagem" achou; agora cada texto volta ao alinhamento dele.
2. **Foto clara apagava o nome do prato.** Vendo a imagem em tamanho real, com um prato branco a letra ficava fraca (a sombra do fundo começava longe do texto). A sombra agora **nasce acima do nome do prato** e chega forte onde a primeira linha começa, mais uma sombra leve na letra. Criei um teste que calcula o contraste da letra **sobre uma foto branca** (4,5:1) e confere, mudando a sombra, que o teste fica vermelho.
3. O preço **colava no nome do prato** (a letra "j" encostava na etiqueta): mais espaço.
4. O fundo do cartão sem foto, com círculos laranja e amarelo, ficava **enlameado** (cor sobre verde): passou a ser um prato abstrato em dois tons de verde mais claro.
5. (Só da conferência no navegador, não da tela.) O endereço das fotos do servidor de teste é outro e a política de segurança do navegador bloqueava a imagem; **em produção a foto é do mesmo endereço do site** (`VITE_API_URL=/api`, Caddy entrega `/media`) e passa. A conferência libera esse endereço só no ambiente de teste.

**Limites honestos:**

- O cartão **ainda não tem QR Code** (o servidor sabe gerar; falta uma rota). Anotado em `docs/divulgacao-do-restaurante.md`.
- **Não foi testado em celular de verdade**: compartilhar imagem para o Instagram e para o status do WhatsApp, baixar para a galeria e as permissões de copiar entraram como item 13 da lista de `docs/teste-no-celular.md`.
- Foto de outro endereço sem permissão suja o desenho e o navegador não deixa salvar a imagem: nesse caso o cartão sai **sem foto** (já previsto no código; só dá para provar em teste de unidade, porque o teste de navegador entrega a permissão sozinho).
- Nada disso vai ao ar sem o "pode": a chave `?novo=1` continua desligada.

**Como foi conferido:** `tests/novo/shareLogic.test.mjs` (25 testes: link só do restaurante; primeira mensagem igual à da tela antiga; link sozinho na última linha; "Outra mensagem" nunca repete; sem nome não inventa nome; frases bem escritas e sem promessa que o sistema não sabe; WhatsApp sem número; só vira cartão o prato disponível, com nome e preço, foto primeiro; texto do cartão com o preço do cadastro; os dois tamanhos 4:5 e 9:16; nomes cortados em vez de estourar; nome de arquivo seguro; o que a tela mostra em cada situação) e `tests/novo/shareCardDraw.test.mjs` (22 testes, com um papel de mentira que anota cada traço: foto cobrindo sem entortar, quebra de linha, letra que encolhe, tudo escrito e nada fora da imagem nos 8 casos feed/status × foto/sem foto × marca/sem marca, miolo seguro do status, ordem preço-convite-link, contraste sobre foto branca). No navegador, com o aplicativo de verdade, **43 conferências novas**: copiar o link e ler na área de transferência, abrir o WhatsApp com o texto, trocar a mensagem oito vezes, escolher o prato, montar o cartão do Feed e do Status com o tamanho exato, a foto entrando no cartão (leitura de um ponto da imagem), tirar a marca, baixar um PNG de verdade com o nome certo, compartilhar com a imagem e o texto, foto que sumiu, celular que recusa copiar, sem pratos, só esgotados, servidor fora com *Tentar de novo*, lista longa, atalho para Mesas, "meu link" falado e 320 px sem rolagem lateral. A página de conferência (`preview-novo.html#/divulgar`) tem 13 situações: `#/divulgar`, `#/divulgar-prato`, `#/divulgar-status`, `#/divulgar-sem-foto`, `#/divulgar-comprido`, `#/divulgar-muitos`, `#/divulgar-sem-prato`, `#/divulgar-esgotados`, `#/divulgar-carregando`, `#/divulgar-erro`, `#/divulgar-copiado`, `#/divulgar-manual`, `#/divulgar-sem-nome`.
**Totais da rodada 29:** 1664 testes do front-end passam nas pastas do CI (`novo` 825); `tsc` sem erro; build de produção ok; teste de segurança e `compliance/check.py` em ordem (52 obrigações); **291 conferências certas no navegador** com o aplicativo de verdade (247 antigas + 44 da tela Divulgar); **acessibilidade medida em 175 telas** (13 novas): leitor automático 0 defeitos em 390 e 320 px, contraste de 229 combinações de texto 0 abaixo do mínimo, 2762 elementos tocáveis 0 abaixo de 44 px e 0 sem contorno de foco, letra ×1,5 e ×2 sem tela que role de lado e sem texto cortado. **Nada vai ao ar:** a chave `?novo=1` continua desligada e nada foi juntado.

## Como as telas novas entram, sem ir ao ar antes da hora

- Tudo mora em `frontend/src/novo/` (e nas pastas irmãs `cozinha/`, `hoje/`, `loja/`, `painel/`). **Só o `App.tsx` importa o painel novo, atrás da chave `?novo=1`, que vem desligada**
  (rodada 21): sem a chave, o aplicativo é o de sempre. Um teste (`tests/novo`) garante que o visual novo não depende do antigo e que só a página de conferência usa dados
  de exemplo.
- Para ver: `cd frontend && npx vite build --config vite.preview-novo.config.ts --outDir /tmp/novo` e abrir
  `preview-novo.html#/loja`, `#/hoje`, `#/cozinha`, `#/vagas`, `#/escolhas`, `#/escolhas-erro`, `#/sacola`, `#/entrega`, `#/loja-pedido`, `#/pedido`, `#/pedido-rua`, `#/pedido-pronto`, `#/mesa`, `#/mesa-chamada`, `#/loja-mesa`, `#/menu`, `#/menu-garcom`, `#/mesas`, `#/mesas-calmo`, `#/mesas-qr`, `#/mesas-carregando`, `#/mesas-erro`, `#/mesa-aberta`, `#/pedidos`, `#/pedidos-caixa`, `#/pedidos-garcom`, `#/pedidos-cozinha`, `#/pedidos-calmo`, `#/pedidos-erro`, `#/pedidos-enviando`, `#/entregas`, `#/entregas-pegar`, `#/entregas-entregues`, `#/entregas-codigo`, `#/entregas-bloqueado`, `#/entregas-erro`, `#/entregas-calmo`, `#/entregas-carregando`, `#/entregas-gerente`, `#/acerto`, `#/acerto-confirmar`, `#/acerto-calmo`, `#/acerto-erro`, `#/acerto-carregando`, `#/cardapio` (e as outras 16 telas `#/cardapio-…`, listadas na décima terceira rodada), `#/pratos` ou `#/categorias` (e as outras 18 telas `#/pratos-…` e `#/categorias-…`, listadas na décima quarta rodada), `#/logomarca` (e as outras 22 telas `#/logomarca-…`, listadas na vigésima rodada), `#/entrar`, `#/avisos` e `#/tela-antiga` (e as outras, listadas na vigésima primeira rodada), `#/divulgar` (e as outras 12 telas `#/divulgar-…`, listadas na vigésima nona rodada)
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
- **Divulgação (o que sobra da lista do GD de 23/10, 21:22):** a tela Divulgar está feita; **página pública do restaurante com prévia bonita**, **QR do link**, **Meus clientes com consentimento**, **cupom e fidelidade**, **captura de e-mail, WhatsApp e Telegram** e **disparo de e-mail** estão ordenados, com o que precisa do "pode" do GD, em `docs/divulgacao-do-restaurante.md`.
- **Teste em celular de verdade (Android e iPhone):** fica para depois, a pedido do GD (23/10, 21:22). O roteiro de 13 itens (voz, microfone, campo de hora, teclado, TalkBack e VoiceOver, letra grande, aviso com o aplicativo fechado, foto, copiar e abrir outro app, celular simples, sol forte e mão suja, rede ruim, compartilhar o cartão do prato) está em `docs/teste-no-celular.md`, seção "Fica para depois".
- **O GD precisa dizer se é isso.** Se não for, o que muda é o sistema de cores e peças, não o resto do plano.
