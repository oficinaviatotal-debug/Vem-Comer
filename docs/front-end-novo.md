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

1. **Cardápio do cliente** (o link do restaurante): marca do restaurante, aberto até, tempo e taxa, busca, categorias,
   promoção, pratos em 3 por linha com foto grande, sacola, bolinha de voz e o balãozinho do Vem Trabalhar.
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

## Como as telas novas entram, sem ir ao ar antes da hora

- Tudo mora em `frontend/src/novo/` e **não é importado pelo aplicativo**: o `index.html` e o `main.tsx` não mudam.
  Um teste (`tests/novo`) garante que o visual novo não depende do antigo e que só a página de conferência usa dados
  de exemplo.
- Para ver: `cd frontend && npx vite build --config vite.preview-novo.config.ts --outDir /tmp/novo` e abrir
  `preview-novo.html#/loja`, `#/hoje`, `#/cozinha` ou `#/vagas` (a pasta pública vai junto, por causa das fontes).
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
