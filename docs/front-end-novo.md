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
acompanhamento do pedido, o menu geral e a bolinha de voz. As escolhas do prato e a sacola passaram a existir na rodada
seguinte (abaixo).

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
(cardápio → escolhas → sacola → enviado). **Ainda sem destino:** o acompanhamento do pedido e o código Pix depois de enviar;
por enquanto o fluxo termina em "Pedido enviado ao restaurante." e avisa quem o monta por `onSent`. Esse é o próximo passo.

**Como foi conferido:** 41 testes de conta (18 + 23), `tests/novo/toque.test.mjs` (regras do desenho, 21 testes) e
`tests/novo/fluxo.test.mjs` (9 testes: ordem do envio, nada de preço, nada importado do antigo, folha como diálogo). Em 320,
360, 390 e 480 px: sem rolagem lateral, nenhum botão com menos de 44 px e o toque cai onde deve. Para ver:
`preview-novo.html#/escolhas`, `#/escolhas-erro`, `#/sacola` e `#/entrega` (tudo funciona na página, com dados de exemplo).

## Como as telas novas entram, sem ir ao ar antes da hora

- Tudo mora em `frontend/src/novo/` e **não é importado pelo aplicativo**: o `index.html` e o `main.tsx` não mudam.
  Um teste (`tests/novo`) garante que o visual novo não depende do antigo e que só a página de conferência usa dados
  de exemplo.
- Para ver: `cd frontend && npx vite build --config vite.preview-novo.config.ts --outDir /tmp/novo` e abrir
  `preview-novo.html#/loja`, `#/hoje`, `#/cozinha`, `#/vagas`, `#/escolhas`, `#/escolhas-erro`, `#/sacola` ou `#/entrega`
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
