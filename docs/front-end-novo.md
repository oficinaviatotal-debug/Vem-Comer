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
