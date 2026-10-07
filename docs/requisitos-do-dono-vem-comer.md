# O que o dono pediu para o Vem Comer

Este arquivo guarda o que o dono do projeto (GD) pediu, com as palavras dele, para que nada se perca
entre uma conversa e outra. Cada pedido tem uma situação: **feito**, **em andamento** ou **falta**.
Ele é a régua: antes de dizer que algo está pronto, conferimos aqui.

O dono fala o texto por voz; as frases abaixo foram só limpadas (pontuação, repetições). Ele ainda vai
passar mais material (benchmarking, conversas antigas). Quando chegar, entra aqui.

Como ele quer trabalhar: tem 25 anos de gerência e diretoria e vai passar o conhecimento tópico por tópico,
em conversa, para levar essa gestão a milhares de pessoas que comem, vendem, procuram e oferecem emprego.
Cada tópico vira regra neste arquivo antes de virar tela.

## Modelo de negócio (decisivo)

> "Ele comprou o sistema. Vai ter o dono do restaurante que ele mesmo vai tirar foto, ele mesmo vai
> cadastrar. Eu sou só o dono do software, eu não vou ter gerência em nada. Estou só vendendo a solução
> de gestão e tecnologia para ele."

O dono do projeto vende uma assinatura de software (SaaS). Ele **não opera nada pelos clientes**. Logo:

- O restaurante precisa se cadastrar sozinho pela internet, sem ninguém no meio. **Construído e FECHADO**
  (`docs/cadastro-do-restaurante.md`): a tela e o servidor existem, mas o cadastro só abre quando o
  administrador roda `abrir-cadastro.sh abrir`. Falta, antes de abrir: revisão dos termos por advogado,
  contato de suporte, confirmação de e-mail e "esqueci a senha" (precisam de um serviço de e-mail).
- Precisa aprender a usar sozinho: o assistente explica, fala e conserta o que o dono errou.
- Precisa de cobrança da assinatura e de período de teste. **Falta construir.** Preços do Vem Trabalhar e regra do teste
  (1 semana, sem baixar nada) decididos em 06/10: `docs/assinatura-e-cobranca.md`. Preço do Vem Comer ainda aberto.
- Suporte tem de ser quase todo automático (o assistente responde; pouca coisa chega a uma pessoa).
- Segurança e isolamento entre restaurantes têm de ser tão bons quanto os de um produto grande.
- LGPD: o restaurante é quem decide sobre os dados dos clientes dele; o Vem Comer é o operador dos dados.
  Termos de uso e política de privacidade precisam existir e ser aceitos no cadastro. **Texto preliminar
  escrito e aceite gravado (versão e hora); falta a revisão de um advogado.**

## Para quem é

> "Milhares de pessoas: sorveteria, pizzaria, hamburgueria, sanduicheria, cachorro-quente, carrinhos,
> açaiteria, diversos segmentos de alimentos que fazem bilhões de entregas todos os dias. Desde o cara
> que trabalha sozinho até o cara grande."

- O ambulante que é garçom, comprador e cozinheiro ao mesmo tempo, sem CNPJ (trabalha no CPF), com
  só o telefone na mão, sem escritório e sem computador, e às vezes sem saber escrever.
- O restaurante grande, com 50 a 100 funcionários, muitas entregas, vários motoboys, bar com mesas
  internas e externas, em vários andares.
- Às vezes a mesma pessoa atende o balcão e o WhatsApp, "oi, bom dia, tem tal produto?", e demora a responder.

**Regra de ouro:** "automação 100%, o máximo possível, precisar do ser humano o mínimo possível."
Funciona para quem é analfabeto e para quem vai usar 100% das funções.

## O que se espera do produto

| # | Pedido (palavras do dono) | Situação |
|---|---|---|
| 1 | **Cadastro automatizado, com comando de voz.** O assistente conversa, o dono fala ou toca, sem digitar. | Em andamento: Assistente do cardápio (PR #19, #20). Falta testar com a voz no celular dele. |
| 2 | **Subir foto do prato** (foto, galeria ou vídeo). | Em andamento: PR de fotos. |
| 3 | **Melhorar a foto automaticamente, para todo mundo.** Os concorrentes sobem foto tirada da internet, sem melhoria nem personalização. | Em andamento: contraste, luz, cor e nitidez no servidor. Falta calibrar com fotos reais. |
| 4 | **Bater uma foto do cardápio inteiro e o sistema cadastrar tudo sozinho**, com categorias (comida, bebida, sobremesa). | Em andamento: tela, servidor e script da chave prontos e testados com IA simulada (`docs/cardapio-por-foto.md`). Falta: chave de IA paga e teste com cardápios reais. |
| 5 | **Criação de logomarca** (se não tem, o sistema pergunta cores/fachada e cria). | Construída (aba **Marca** do painel): 13 tipos de comida, 9 cores da fachada, 6 modelos, desenhada no celular, sem custo e sem internet; quem já tem logomarca envia a sua. Aparece no cardápio do cliente. Falta ver no aparelho real e usar a logomarca nos posts e no QR. `docs/logomarca.md`. |
| 6 | **Cardápio com categorias e imagem do que ele usou.** QR de mesa e link do cardápio. | Feito (cardápio, QR de mesa). Fotos: em andamento. |
| 7 | **Cadastro com CEP; entrega roteirizada pelo CEP; a cozinha recebe o pedido.** | Falta (cozinha recebe: existe a tela de pedidos; CEP e rota: falta). |
| 8 | **Cadastro de porção** (padronização mínima), **gerência de produtos e de custos, CMV da cozinha.** "O cara nunca teve isso." | Construído (aba **Custos** do painel): insumos como vêm na nota, ficha técnica por porção, custo e CMV de cada prato contra a meta do dono (começa em 35%), preço sugerido e CMV dos últimos 30 dias pelos pedidos. Também: receita que rende N porções e peso da porção, aproveitamento do insumo, quantos pratos cada embalagem rende, ficha falada por voz, estoque pela ficha (contagem e compra, baixa pelas vendas aceitas, dias de estoque) e ranking de lucro com engenharia de cardápio e ação sugerida. É o CMV pela ficha; o CMV pelo estoque real vem com a compra inteligente (linha 22). `docs/custos-e-cmv.md`. |
| 9 | **Entrega em grande escala:** vários motoqueiros, rotas por região, controle de produtos por motoqueiro. | Falta. |
| 10 | **Bar e salão:** mesas internas e externas, no primeiro andar, do lado de fora; quantidade de mesas por área e por garçom. | Parcial: mesas e QR existem; áreas e garçom por área faltam. |
| 11 | **Garçom com meta.** "Eles não têm meta." | Falta. |
| 12 | **Sugestão na hora de vender:** "o cara já consumiu cinco doses de uísque, ofereça um prato que combina (queijo, fritas, salame, peixe)" para aumentar o ticket médio. | Falta. Regra de cuidado: sugerir comida e água; nunca empurrar mais bebida alcoólica. |
| 13 | **Agentes de venda, marketing e psicologia** que, quando o cliente abre o link, tentam aumentar o ticket médio e a recorrência (de uma para duas vezes por semana, no mesmo horário). Ocasiões: dia a dia, família, festa, aniversário. | Falta. |
| 14 | **Disparo de publicidade por e-mail**, uma ou duas vezes por semana, por cliente ou por região. | Falta. Só com autorização do cliente (LGPD) e opção de sair. |
| 15 | **Alertas de gestão:** custo, onde está errando, gargalo na cozinha pela quantidade de pedidos, compra demais (vai estragar), quantos dias de estoque, vai faltar produto. | Falta. |
| 16 | **Pix por restaurante.** | Feito (Pix estático, confirmação manual). Falta o teste real de R$ 1,00. |
| 17 | **Atendimento no WhatsApp organizado** (o mesmo número do balcão). | Falta (a definir: API oficial do WhatsApp tem custo). |
| 18 | **Qualidade de gestão de "um diretor que passou por cinco multinacionais em dez estados"**, levada ao Vem Comer e ao Vem Trabalhar. | Direção geral. |
| 19 | **Ser encontrado** (benchmark: ferramentas que otimizam o site para o Google e para as respostas de IA). Cada restaurante precisa de uma página pública que robôs e IAs entendam: nome, endereço, horário, cardápio com preço e foto (dados estruturados schema.org), prévia bonita ao colar o link no WhatsApp, mapa do site. | Falta. Hoje o cardápio é montado por JavaScript no celular; robôs que não rodam JavaScript veem pouco. Exige servir a página já pronta (pré-renderizada) para cada restaurante. |
| 20 | **Semana de ofertas** (benchmark de varejo: promoção concentrada nos primeiros dias do mês). O restaurante escolhe pratos, desconto e datas; o sistema troca os preços sozinho e volta ao normal no fim. | Falta. |
| 21 | **Funcionar no Brasil inteiro:** do sinal fraco (2G, 3G) ao 5G e além, em todos os estados, culturas e sotaques. "Um sistema vivo, que nunca fica obsoleto." | Em andamento: foto reduzida no celular antes de subir. Falta: envio que continua depois que o sinal volta, páginas leves, vocabulário regional na fala (macaxeira, aipim, mandioca). |
| 22 | **Compra inteligente (CMV):** quando o dono dá entrada na nota, o sistema guarda os preços e avisa onde o queijo está mais barato, onde o refrigerante está mais em conta (supermercado, atacadista). Alertas de estoque. | Falta. Fontes de preço legítimas: as notas dos próprios donos, tabelas de atacadistas parceiros, dados públicos. Não copiar sites sem permissão. |
| 23 | **Dois posts por semana, por restaurante**, com o nome dele ("Saiteria do João", "Coxinha Prime", "Frango no pote") e um QR Code pequeno do Vem Comer e do Vem Trabalhar embaixo (mini publicidade). Cláusula no contrato e nos termos de uso. Cada restaurante coloca o link no seu Instagram. | Falta. No começo o sistema cria a imagem e o dono toca para publicar. Publicar sozinho no Instagram exige aprovação da Meta. |
| 24 | **Base de clientes para disparos** (e-mail, WhatsApp, Telegram): onde achar e como alcançar o consumidor final, "sem consumidor não existe negócio". | Falta. Só com autorização do cliente e opção de sair. |
| 25 | **Três papéis:** o consumidor final; o dono do restaurante (quem comprou); e o dono do software (melhoria contínua, gestão, cobrança, recebimento, colocar no ar). | Direção geral. |
| 26 | **Uma pessoa, vários papéis, nos dois produtos.** "Quem oferece emprego também come e vice-versa": quem come também vende, procura ou oferece emprego, e quem oferece emprego também precisa de cursos. Vem Comer e Vem Trabalhar são um ecossistema só. | Falta decidir e construir: um único cadastro/login para os dois (hoje são dois sistemas separados). Direção geral. |
| 27 | **Gestão de gente completa para quem contrata:** avaliação do perfil na entrada e, com o tempo, avaliação de resultado e de comportamento dos funcionários mais antigos. | Falta. Vem Trabalhar. |
| 28 | **Aba de cursos**, para quem procura emprego e para quem contrata: atividades didáticas e lúdicas, com inteligência artificial, certificado, prêmio, e cursos interligados que se repetem ao longo do tempo (recorrência). "Diferente de tudo que há no mercado." | Falta. Vem Trabalhar (depois do Vem Comer). |
| 29 | **Sistema vivo, em constante operação, com robôs de IA** buscando informação e trabalhando: captação de clientes em várias pontas, recorrência, faturamento e valores, desenvolvimento de cursos. | Falta. Valem as regras de sempre: só com autorização de quem recebe, dentro das regras de cada canal, e com um humano vendo o que é enviado em nome de terceiros. |
| 30 | **Interface simples, clicável, editável e funcional**, completa mas fácil, "diferente de tudo que há no mercado". Régua: o ambulante sem estudo e o diretor de uma rede usam a mesma tela. | Direção geral; vale para toda tela nova. |
| 31 | **Vem Estudar:** catálogo de cursos curtos (até 80 h) com certificado no perfil da pessoa. Começa com cursos públicos; curso próprio ou de parceiro vem com CNPJ e nota. | Falta. Confirmar com o GD o sentido de "não precisa de Mac" (`docs/benchmark-ecossistema.md`, seção 4). Vem Trabalhar. |
| 32 | **Faculdades parceiras** (Uninassau e técnicos), dentro da plataforma, com taxa de matrícula e percentual da mensalidade. | Falta. Só com contrato escrito; antes disso, só link para o site oficial. |
| 33 | **Aba RH:** o match usa todas as respostas do candidato e todos os requisitos da vaga e explica o porquê. | Falta. A decisão final é humana. Vem Trabalhar. |
| 34 | **RH terceirizado:** empresa sem RH envia N candidatos; o RH parceiro faz videochamada, preenche relatório de 20 perguntas mais relatório escrito, e devolve à empresa. | Falta. Consentimento do candidato. O GD define quem são os RH parceiros e quem paga. |
| 35 | **Currículo por voz, vídeo e foto** para quem nunca trabalhou ou não sabe escrever; grátis para o candidato. | Falta. Referência mais próxima: VC_CV da Vagas.com.br (texto). Vem Trabalhar. |
| 36 | **Testes de perfil, caráter e competência por voz, vídeo e áudio.** | Falta. Instrumentos validados, consentimento, sem rejeição automática. |
| 37 | **Captação pelo Instagram próprio** do Vem Comer e do Vem Trabalhar. | Falta. Conteúdo e link; sem mensagem direta em massa. |
| 38 | **CPF ou CNPJ em todo cadastro** (fala do GD, 07/10/2026). No Vem Comer, os autônomos sem CNPJ são cerca de cinco vezes os que têm: é para eles que o sistema existe. Cursos livres (do Vem e de outros) podem ser vendidos com CPF ou CNPJ; curso técnico ou com MEC exige CNPJ. | Em parte: o cadastro do restaurante não pede documento hoje. Falta o campo "CPF ou CNPJ" (com conferência dos dígitos) na escola e no recebimento. Questão tributária: o GD vê depois com o contador. Curso livre dá **certificado**; "diploma" fica para curso regulado. |
| 39 | **Posts prontos para o Instagram do restaurante**: dois por semana (segunda e sexta) e, quando o dono pedir, a tela pergunta qual promoção, prato, combo ou oferta do dia e cria a imagem. Sempre com as cores e a logomarca do restaurante (criada no sistema, enviada em arquivo ou tirada da foto da fachada). | Falta (detalha o item 23). Imagem feita por modelo nosso com as cores da casa, sem custo de IA; o dono toca para postar. Postar sozinho no Instagram exige conta profissional e aprovação da Meta. |
| 40 | **Ordem dos canais de envio:** primeiro e-mail (barato, sem custo para o dono), depois Telegram, depois WhatsApp. O dono informa o e-mail que vai usar ou cria um só para pedidos. | Falta. Só para quem autorizou, com link para sair. Provedor de e-mail a escolher (preço por mil envios). |
| 41 | **Todo pedido chega à cozinha e sai impresso**: cupom na impressora térmica do caixa e da cozinha, com o QR do Vem Comer e do Vem Trabalhar no rodapé. O cupom vai grampeado na embalagem da entrega com os valores, para economizar papel. | Falta. Impressora térmica pelo navegador: modelo de 58 mm e 80 mm; Bluetooth ou app de impressão no Android a testar no aparelho real. |
| 42 | **Entrega com motoqueiro:** o caixa libera o pedido por região; o motoqueiro leva e recebe por Pix, cartão ou dinheiro. Dinheiro fica "em aberto" no caixa em nome do motoqueiro (pedido nº, troco para quanto) até o acerto. Na entrega, o cliente passa o **código** que recebeu (e-mail ou tela do pedido) e o motoqueiro registra pelo app do motoqueiro ou por WhatsApp; o sistema guarda o tempo de cada entrega e a eficiência de cada motoqueiro. | Falta (detalha os itens 7 e 9). Regiões por CEP e bairro, cadastradas pelo restaurante com a taxa de cada uma, sem pagar serviço de mapa. App do motoqueiro: página leve com PIN. |
| 43 | **Voz conforme o aparelho e a internet:** no 2G, a voz do próprio celular; no 3G, 4G e 5G, a melhor voz disponível (frases gravadas e voz natural do servidor). Sempre a mais rápida e a mais fácil. | Em andamento (07/10/2026). |
| 44 | **Visual de ponta:** intuitivo, fácil de ler e de usar, bonito, com abas bem divididas; benchmark do que há de mais novo e ideia própria. | Em andamento (07/10/2026). |
| 45 | **Conta da mesa pelo QR, junto com o garçom:** o cliente lê o QR da mesa, abre a conta e pede comida e bebida. O cupom sai na cozinha (comida), no balcão (bebida) e no caixa. O garçom lê o mesmo QR da mesa e lança o que pediram a ele; tudo cai na mesma conta. | Em parte: QR por mesa e pedido pelo cliente existem; falta a conta aberta da mesa, o lançamento do garçom, a separação cozinha/balcão por categoria e a impressão. |
| 46 | **Taxa de serviço (10%) opcional, conforme a cidade e o estado:** um botão liga ou desliga; quando ligada, aparece como opcional, com o nome que o restaurante escolher, sem entrar sozinha no total; no caixa e no app do garçom fica marcado se o cliente pagou ou não. | Falta. O texto na conta e as regras locais o advogado confere. |
| 47 | **Fechamento e conciliação do caixa:** quando sobra ou falta dinheiro, o sistema compara pedidos, pagamentos, taxas e trocos e aponta o lançamento mais provável do erro (por exemplo, taxa paga e não marcada, troco anotado errado, pedido em dinheiro sem baixa), com o grau de certeza. | Falta. É uma indicação para o dono conferir, nunca uma acusação a um funcionário. |
| 48 | **Mesa com situação de verdade:** livre → ocupada (conta aberta) → conta pedida → paga → **aguardando limpeza** → livre. Paga não libera a mesa: o cliente pode continuar sentado (dia de festa, fila na porta). Alerta no painel e no app do garçom para mesas paradas, vazias ou esperando limpeza. O garçom limpa, toca "Mesa limpa", acomoda as pessoas novas e abre outra conta. | Falta. |
| 49 | **Conta paga e o cliente fica: "pago até aqui".** A conta paga é encerrada (baixa no caixa e no estoque) e uma conta nova começa a partir daquele momento, na mesma mesa, com o aviso "continua na mesa com uma conta nova". Na tela e no cupom: "pago até aqui; daqui para a frente, conta nova". Acaba com o "eu já paguei / não paguei". | Falta. |
| 50 | **Um aplicativo só, com acesso por papel:** a senha do garçom só abre as mesas (abrir, pedir, fechar) e, onde o garçom recebe, o recebimento. Cada pagamento registra **quem recebeu** (garçom ou caixa), com a forma (Pix, cartão, dinheiro), para a auditoria e a conciliação do item 47. | Em parte: os papéis já existem no login (dono, gerente, garçom, caixa, cozinha, entregador); faltam as telas do garçom e o registro de quem recebeu. |
| 51 | **Agente de marketing pelo horário do restaurante:** 2 horas antes de abrir, e-mail com o link do cardápio; durante o funcionamento, campanha de promoção para pelo menos 25% dos clientes que já compram e 10% de clientes novos por dia; 2 horas antes de fechar, aviso "faltam 2 horas para pedir". O banco cresce todo dia. | Falta. Só para quem autorizou (LGPD), com link para sair em cada mensagem, e com teto de mensagens por pessoa por dia somando todos os restaurantes (três por dia de cada restaurante vira spam e derruba a entrega dos e-mails). "Clientes novos" = pessoas que pediram ofertas do Vem Comer, nunca listas compradas ou coletadas. |
| 52 | **Um app só: o site que vira ícone na tela do celular** (PWA), com notificação. O cliente toca "Adicionar à tela inicial" e recebe avisos de quem autorizou. | Decidido pelo Claude, 07/10/2026: não fazer site e app separados. No Android a notificação funciona pelo Chrome; no iPhone só depois de adicionar à tela inicial (iOS 16.4 ou mais novo). Falta: aviso para instalar, notificação push (servidor e permissão). |
| 53 | **Balãozinho cruzado, pequeno e discreto:** no Vem Comer, "Precisa de trabalho? Clique" com a logo do Vem Trabalhar; no Vem Trabalhar, "Está com fome? Clique" com a logo do Vem Comer. | Falta. Fecha com um toque e não volta na mesma visita; nunca cobre o botão de pedir. |
| 54 | **QR do Vem Comer e do Vem Trabalhar em toda comunicação:** cupom impresso, e-mails (propaganda, campanha, promoção, convite, aniversário), imagens dos posts, telas de fim de pedido. | Falta (amplia os itens 23 e 41). Em e-mail, o QR vai como imagem pequena e também como link (muitos leitores de e-mail escondem imagens). |
| 55 | **Inteligência de dados nos dois ecossistemas** (benchmark dos modelos de previsão de séries no tempo, 07/10/2026; o GD não quer mercado financeiro): coleta de dados de alta qualidade, informação de alta qualidade e gestão de alta qualidade, com o que o mercado tem de melhor. | Falta. Em camadas: (1) **coleta certa na entrada**: conferência de preço, CPF/CNPJ, telefone e CEP, voz e foto sempre com confirmação, sem duplicados; (2) **indicadores**: ticket médio, horário de pico, prato que mais vende e que mais dá lucro, CMV, tempo de preparo e de entrega, funil do QR ao pagamento; no Vem Trabalhar, tempo para contratar, contratações que ficaram (30/60/90 dias), vagas por cargo e cidade; (3) **previsão**: movimento por dia e hora, sugestão de compra e de escala, hora fraca para promoção; no Vem Trabalhar, demanda de vagas por cargo, cidade e época, faixa salarial e procura por cursos. Previsão só com histórico (umas 8 semanas), sempre em faixa ("de 18 a 25"), começando por médias no nosso servidor e depois um modelo pequeno rodando à noite. Preço só como sugestão que o dono aprova. Perfil de pessoa nunca sai desses dados: só das respostas dela, com aceite. |
| 56 | **Pedido com prova, contra o golpe do "meu pedido não veio"** (fala do GD, 07/10/2026). Cada pedido tem uma sequência de fotos ligada ao número dele: a cozinha fotografa os itens prontos; o caixa fotografa a sacola lacrada (número do lacre e do pedido visíveis, com o cupom); o motoqueiro fotografa na retirada e na entrega. Cada foto guarda hora e autor. A entrega só fecha com o código do cliente. Na disputa, o dono vê a linha do tempo numa tela. | Falta (detalha o item 42). Reclamação repetida da mesma pessoa vai ao dono, que decide; o sistema nunca bloqueia um cliente sozinho. Termo de uso e prazo de guarda das fotos: conferir com o advogado. |
| 57 | **Mesa viva** (benchmark Chamaii, 07/10/2026). Suporte de mesa com logomarca, QR, NFC e o número grande. A tela da mesa tem Chamar garçom, Ver cardápio, Pedir a conta e Trabalhe aqui. Cada chamada tem tipo (garçom, conta, água, limpeza), vai para quem resolve, e o tempo até a resposta vira a meta do garçom (item 11). "Como foi?" ao sair. Cardápio do cliente com busca, chips de categoria, Destaques, preço antigo riscado, "Esgotado" e vídeo do prato (só ao toque; em 2G só a foto). | Primeira parte pronta (PR da Mesa viva): tela da mesa com Chamar garçom, Pedir a conta, Água, Limpeza e Ver cardápio; aviso no painel com tempo de espera, vibração e apito; "Atender" guarda a hora e quem atendeu. Falta: "Como foi?" ao sair, busca e chips no cardápio, Destaques, preço antigo riscado, "Esgotado", vídeo do prato, NFC gravado pelo painel no Android (Chrome) com suporte para imprimir, e o tempo de resposta virar a meta do garçom (item 11). Detalhes em `docs/mesa-viva.md`. |
| 58 | **Perguntas comportamentais** (e-book da empregare, trazido pelo GD). Entrevista falada em quatro caixas (situação, o que fez, como fez, resultado), primeiro no currículo e depois na avaliação de comportamento e desempenho dos funcionários, com pontos fracos e cursos indicados. | Falta. Consentimento e decisão final humana (LGPD, art. 20). O banco de perguntas e os instrumentos precisam ser conferidos por quem entende de RH. |
| 59 | **Estúdio de Curso** (anúncios do Articulate e do Content Studio, vistos pelo GD). Quem cria o treinamento (escola, RH, dono de restaurante) fala, manda PDF, foto ou vídeo, e o sistema monta lições, quiz e certificado para ele só revisar. O procedimento da própria casa vira treinamento da equipe, e o resultado alimenta a avaliação. | Falta (detalha os itens 28 e 31). |
| 60 | **Sistema vivo por dentro do ecossistema, em três níveis, com Modo Deus** (fala do GD, 07/10/2026). Os agentes e robôs ficam dentro do Vem, aprendem com os dados dele e se atualizam todo dia; fonte de fora só para captar clientes e fazer benchmark. **Nível 1** (conteúdo e configuração, desfazível): o sistema faz e avisa no "Boletim do dia". **Nível 2** (preço, promoção, desconto, campanha com a base do dono): o dono do estabelecimento aprova com um toque. **Nível 3, Modo Deus** (método do match e da nota, comissão, preço de plano, texto legal, fluxo de dinheiro, canal novo, custo novo, dado pessoal, código em produção): o GD decide num cartão com o motivo, o que muda, o risco e os botões Aprovar, Não e Falar comigo, também por voz. | Falta (detalha o item 29 e `LIVING_SYSTEM_SPINE.md`). O sistema não reescreve o próprio código em produção: propõe pull request com testes, e o GD aprova e faz o merge. Se pequenas mudanças de código podem entrar sozinhas fica para o GD decidir. |
| 61 | **Time de agentes com um revisor** (vídeo sobre times de agentes do Claude, 07/10/2026). Cada agente tem uma responsabilidade e uma entrega (observador, aprendiz, redator, guardião, testador, estudante, revisor, gerente). O revisor dá uma nota de "quanto está pronto" antes de a proposta ir a quem decide. O time que funciona bem é salvo como skill. **Conselho de 5 vozes para decisão de nível 3** (vídeo sobre o LLM Council, ideia de Andrej Karpathy, 07/10/2026): o cartão do Modo Deus traz o veredito de cinco vozes (contrário, primeiros princípios, expansionista, forasteiro, executor), com revisão cega entre elas e um presidente que junta tudo e mostra também onde discordam. A pergunta ao conselho não revela o que o dono quer. Foi testado à mão em 07/10 numa decisão real do projeto. | Falta. Limite assumido: cinco vozes da mesma IA compartilham o mesmo viés, então consenso não é prova; só um dono de restaurante real dizendo "eu pago" valida. |
| 62 | **Pagamento do motoqueiro por distância** (fala do GD, 07/10/2026): R$ 7 até 5 km, R$ 10 até 10 km e R$ 15 até 15 km. | Falta (detalha o item 42). O sistema aplica por regiões do CEP (zona 1, 2 e 3), sem serviço de mapa pago, e cada restaurante ajusta. Aberto: quem paga, o cliente na taxa de entrega ou o restaurante. |
| 63 | **Quem ganha dinheiro com o quê** (fala do GD, 07/10/2026). O estabelecimento, com margem, orientação e CMV; a empresa, com velocidade e acerto na contratação; o candidato, com emprego e salário; a escola, com matrícula e curso; o motoqueiro, com as entregas; o garçom, com salário e gorjetas; o GD, com a venda dos sistemas e a participação na lucratividade de todos. | Direção geral. O plano completo está no documento "Plano de Crescimento Vem". |
| 64 | **Conversar com o sistema** (fala do GD, 07/10/2026). O dono fala ou escreve no painel, como conversa com o Claude, pede mudança ou informação, e o sistema executa por dentro, sozinho, dentro dos três níveis do item 60. O sistema é autônomo: aprende com os dados dele, tem agentes de autodesenvolvimento, autoprogramação e autogestão, e usa o mínimo possível de fonte de fora. | Falta o canal de conversa com o agente Gerente (item 61). Dois limites assumidos com o GD: o código de produção só muda depois da aprovação do dono, e o modelo de linguagem que "pensa" é, no começo, um serviço de fora. |
| 65 | **Modo garçom** (fala do GD, 07/10/2026). Mesas cadastradas por área e por garçom. O garçom assume a mesa pelo QR ou abrindo pelo número no aplicativo (e toca em quantas pessoas são). O aplicativo compara o ticket de cada mesa com a média da área e do restaurante e avisa o garçom, e sugere pratos com margem boa e ingrediente em estoque, que combinem com o que a mesa ainda não pediu, para ele oferecer e vender mais. **A comparação entre pessoas e regiões é interna e só da gestão** (dono e gerente), vista de cada garçom isolado e de cada região, nunca mostrada à equipe: serve para ver quem precisa de treino, quem está com algum problema, e qual região está com muito fluxo para pouca gente. | Falta; proposta de 14 a 23/10, depois do RC. Uma sugestão por vez por mesa, com intervalo; nunca bebida alcoólica; preço vem do cardápio, não da IA. O garçom vê só o alerta das mesas dele contra a média da área (um número, sem nome de colega) e nunca ranking. A gestão vê, por garçom e por região, ticket por pessoa, mesas por garçom no pico, tempo de resposta às chamadas (Mesa viva) e chamadas sem resposta, junto com o contexto (tempo de casa, turno), para não julgar só pelo número. O sistema só mostra pontos de atenção em palavras neutras; a decisão sobre pessoas é sempre do gestor. Combinar com o contador ou advogado como avisar a equipe de que o desempenho é medido. Ticket por pessoa depende da contagem de pessoas. |

Os itens 31 a 37 vêm do benchmark (`docs/benchmark-ecossistema.md`, seção 9) e nenhum entra no RC de 13/10.
Os itens 38 a 65 são falas do GD de 07/10/2026.

## Como o dono testou e o que não funcionou (guia antigo)

- O botão ficava mal posicionado; a voz era muito robótica; o guia pedia para escrever.
- Pediu "Pratos" como exemplo; o dono digitou "Bebidas" e o guia travou. Falar "bebidas" em voz alta
  também não mudou o caminho: continuou nos pratos.
- Conclusão do dono: para quem não sabe escrever, aquilo não é funcional. Troca: o Assistente do cardápio
  (tocar ou falar, uma categoria por vez, sem digitar).

## Cuidados que valem para tudo

- Dados pessoais e e-mail de cliente: só com consentimento, com como sair (LGPD).
- Sugestões de venda não podem manipular nem empurrar bebida alcoólica; venda de bebida alcoólica só para maior de idade.
- Um aviso errado é pior que nenhum: só avisamos "foto escura" etc. quando a medida é segura.
- Cada passo precisa funcionar com uma mão só, no celular, no meio da cozinha.

## Ordem de trabalho proposta

1. Fotos dos pratos, melhoradas (em andamento).
2. Cadastro do restaurante pela internet, sem ajuda (construído e fechado; falta e-mail confirmado, "esqueci a
   senha", revisão dos termos e abrir com `abrir-cadastro.sh`).
3. Foto do cardápio inteiro cadastrando sozinha (pronta; falta ligar a chave de IA e testar com cardápios reais).
4. Logomarca (construída; falta ver no aparelho real).
5. Assinatura e cobrança (teste grátis, plano).
6. Porção, custo e CMV.
7. Entrega por CEP e região.
8. Salão: áreas, garçom, metas, sugestão de venda.
9. E-mail e recorrência (com consentimento).
10. Alertas de estoque e gargalo.
11. Página pública de cada restaurante pronta para Google, IA e WhatsApp (pré-renderizada, dados estruturados).

Em paralelo, antes de vender de verdade: teste real de Pix de R$ 1,00, domínio próprio, backup fora do servidor.
