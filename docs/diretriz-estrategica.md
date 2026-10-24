# Diretriz estratégica do GD (22/10/2026): o que entra, o que melhora e o que sai

O GD mandou dois textos às 12:50 e 12:53 e pediu: **"analisa, reanalisa, analisa novamente, verifique o que é possível dentro do que você
vem construindo, o que é possível integrar, melhorar, evoluir. O restante, caso necessário, pode descartar"**. Às 12:54 completou:
**"Você analisa, você decide, você aproveita e você expurga o que não prestar."** (item 85 de `docs/requisitos-do-dono-vem-comer.md`.)

Os textos estão, sem alteração, em `docs/diretrizes-do-gd/`. O texto 1 chegou inteiro (16 blocos, de "Missão" a "Declaração final"). O texto 2 chegou
em dois pedaços: o começo ("Gestão que gera demanda. Inteligência que gera riqueza." e a missão) e o fim ("Quarto", "Quinto" e o parágrafo sobre
testes e critérios de aceite). **O miolo ("Primeiro" a "Terceiro") não chegou.** O GD respondeu "essa é a continuidade", então trabalhei com o que há e não
inventei o que falta.

Isto aqui é **análise e decisão de engenharia**. Não é o "pode" para ir ao ar nem para juntar nada. As decisões que tomei valem até o GD mudar.

## 1. Resposta curta

1. **A direção está certa e já é a do projeto.** Quase tudo nos textos já estava pedido pelo GD antes (itens 51, 55, 60, 63, 66, 68, 75 e 83 dos
   requisitos, o plano de 90 dias, o `LIVING_SYSTEM_SPINE.md`, o desenho dos dez agentes). O que os textos acrescentam de verdade é **a ordem de
   pensar** (demanda → recorrência → riqueza → plataforma sustentável) e **a regra final: planejado não é entregue**.
2. **A maior lacuna entre o texto e o código é "gerar demanda" e "recorrência".** Hoje o sistema ajuda o dono a *atender* e a *entender o que vendeu*; ele ainda
   não ajuda a *trazer cliente* nem a *fazer voltar* (não há cupom, campanha, fidelidade, aviso ao cliente final nem página pública para o Google).
3. **Um trecho briga com uma decisão do próprio GD:** "facilitar a descoberta de estabelecimentos" (um catálogo). O item 68 (07/10) diz que **não há catálogo agora**, só
   depois de 3 meses e de mais de 100 estabelecimentos por região. **Mantenho o item 68.** A descoberta, por enquanto, vem pelo Google (página pública de cada cardápio).
4. **Adoto a regra do fim do texto 2 como lei do projeto:** nenhum módulo conta como entregue sem estar implementado e validado. Montei o **quadro de entrega** (seção 6) com a prova
   de cada um. Conclusão honesta dele: **nenhum módulo foi validado com um restaurante de verdade ainda.**
5. **Expurgo** o que não cabe (seção 5): varredura ampla de mercado, perfil de consumidor inferido, meta que sobe sozinha, expansão antecipada.

## 2. Como li (três passadas)

1. **Classificar:** cada frase virou uma de quatro coisas: já existe, já está desenhado, é novo, ou é só intenção.
2. **Conferir com evidência:** cada "já existe" foi procurado no código e nos documentos, com arquivo (por exemplo, "não há cupom": busquei `cupom`, `coupon`, `fidelidade` e `loyalty`
   em `backend`, `frontend` e `database`, e não achei; "não há página para o Google": busquei `schema.org` e `JobPosting`, e não achei).
3. **Procurar choque:** com a lei (LGPD, regras das plataformas), com as regras que o GD já deu (14/10: portal primeiro, nada de mensagem fria; 22/10: menos escrita, menos dado,
   menos informação) e dos trechos entre si.

## 3. O texto, bloco a bloco

Estados: **Código com teste** (está no `main` ou em PR com teste), **Só desenho** (documento, sem código), **Falta**. "Em PR" quer dizer que ainda não foi juntado ao `main`.

| Trecho dos textos | O que já existe (onde) | Estado | Decisão |
|---|---|---|---|
| **Missão** (gestão de alto nível para toda a cadeia alimentícia, simples e acessível) | Princípios do GD (`principios-do-produto.md`); visual novo para quem lê pouco (PR #75) | Em andamento | **Adoto** como norte. Já vale: "se brigar com simplicidade, perde" |
| **Objetivo central** (ciclo: aquisição, ativação, vendas, recorrência, aprendizagem, expansão) | Cada etapa tem um pedaço, nenhuma é medida de ponta a ponta | Parcial | **Melhoro:** o ciclo vira um **funil medido** (cadastrou, pôs 10 pratos, recebeu o 1º pedido, está pagando, voltou). Ver seção 4, item C |
| **Compromisso com o estabelecimento:** novos clientes | Nada (sem campanha, cupom ou página pública) | Falta | **Entra.** É a maior lacuna |
| …aumentar a frequência de compra | Nada: o pedido de mesa guarda só o nome, sem identidade de cliente | Falta | **Entra** pelo aviso opcional no celular (seção 4, item E), sem pedir telefone nem e-mail |
| …melhorar o ticket médio | `backend/insights.py` calcula ticket médio e compara com o período anterior (só com dados suficientes) | Código com teste (`main`) | **Já coberto**; a sugestão de venda no prato é do agente Vendas (desenho) |
| …controlar custos, proteger margens | Custo do prato, CMV, estoque de insumos (`costing.py`, `docs/custos-e-cmv.md`) | Código com teste (`main`) | **Já coberto** |
| …reduzir desperdícios | Só o rendimento e a perda dentro do custo do prato; nenhum controle de desperdício de verdade | Parcial | **Adio**: sem restaurante usando, não há como medir |
| …tomar decisões fundamentadas | Painel "Seu negócio" com "falar sempre a verdade" (sem dado, diz "poucos dados"); "Hoje" novo (PR #75) | Código com teste | **Já coberto** |
| **Compromisso com o consumidor:** escolher, pedir, transparência | Cardápio, escolhas, sacola, Pix, acompanhar o pedido; preço, taxa e total vêm sempre do servidor | Código com teste (PR #75 / `main`) | **Já coberto** |
| …descobrir estabelecimentos | Nada, **por decisão do GD (item 68)** | Falta (de propósito) | **Mantenho a decisão.** Ver choque 1 |
| …ofertas pertinentes e preferências de comunicação | `consent.py` guarda o aceite e a retirada; descadastro de um toque em e-mail | Parcial | **Entra** com regra: um teto de mensagens por pessoa por dia, somando todos os restaurantes (já dito no item 51) |
| **Compromisso com o proprietário:** receita recorrente | `subscription.py`, cobrança manual, bloqueio no dia seguinte; vem desligado (`docs/assinatura-e-cobranca.md`) | Código com teste (`main`), desligado | **Já coberto**; falta cobrança automática (empresa de pagamento) |
| …aquisição eficiente, retenção, expansão, controle de custos | Plano de 90 dias aprovado em 14/10; agentes de Prospecção e Retenção em desenho | Só desenho | **Já coberto**; o que falta é **medir** (item C) |
| **Inteligência de mercado** (radar contínuo de informações empresariais, comerciais, operacionais e regionais) | Vigia da lei toda segunda-feira (`compliance/legal_watch.py`); `BENCHMARK_INTELLIGENCE.md` e `atlas-de-cardapios.md` (documentos) | Parcial | **Aproveito só o que é sério e barato** (fontes oficiais e abertas). A varredura ampla sai (seção 5) |
| **Aquisição de clientes** (máquina comercial própria) | Trava de e-mail para empresas com limites e descadastro (`backend/outreach.py`, **nada envia**); lista do RN pelos dados abertos de CNPJ (desenho) | Código com teste, sem envio | **Já coberto**; precisa de domínio com SPF, DKIM e DMARC, provedor de envio e advogado. Primeiros 30 dias: o GD aprova cada envio |
| **Geração de demanda** (campanhas, ofertas sustentáveis, catálogo digital, relacionamento) | Foto melhorada, logomarca, QR de mesa e link por restaurante; nenhuma campanha | Falta | **Entra**, com a regra de **margem** (choque 4) |
| **Comunicação inteligente** (mensagem, canal, frequência e horário pelas permissões e resultados) | Ordem dos canais (item 40), aceite e descadastro, aviso no celular da equipe (`push.py`) | Parcial | **Entra** como regra dos agentes de Campanhas e Retenção. Cliente final: aviso ainda não ligado |
| **Recorrência** (fidelização, reativação, personalização legítima) | Nada | Falta | **Entra** em versão pequena (item E). Personalização por perfil inferido, não (seção 5) |
| **Inteligência contínua** (agentes que observam, analisam, preveem, recomendam, executam o autorizado) | Os dez agentes (`agentes-e-aprendizado.md`, seção 10); registro de ações e fila de aprovação (PR #71) | Só desenho + código em PR | **Já coberto.** Nenhum roda. Falta a chave de IA (pelo script dele), o executor e o botão de parar |
| **Superação mensal** (metas progressivas, desvios, elevar objetivos) | Nada | Falta | **Entra com travas** (choque 3) |
| **Princípio econômico** (valor mensurável para o estabelecimento, benefício real ao consumidor, resultado positivo da plataforma) | Mensalidade e pagamentos gravados; custo de cada ação de agente gravado (`agent_actions.cost_cents`); sem conta que junte tudo | Parcial | **Entra:** o **placar da plataforma** (item C) |
| **Princípio de execução** (finalidade, objetivo, fundamento, limite, teste, medida) | Pedaços: registro de operações da LGPD (parcial), evidência com fonte e data nos cartões, pull request com teste, resultado e custo no registro | Parcial | **Adoto como regra testável.** Tabela na seção 4, item D |
| **Visão de longo prazo** (do empreendedor individual a grandes redes, várias regiões) | Um login por restaurante; **não há várias lojas sob um dono** | Falta | **Adio** até o primeiro cliente real e a resposta do GD sobre "um login só" |
| **Declaração final** (incansável, segurança, confiabilidade, simplicidade, sustentabilidade) | Segurança e conformidade com teste a cada PR | Código com teste | **Adoto.** Agente "incansável" tem teto de gasto e botão de parar |
| **Texto 2, abertura:** "Gestão que gera demanda. Inteligência que gera riqueza." e a missão em três pés (prosperidade do estabelecimento, valor para o consumidor, e a plataforma sustentável) | A página de venda hoje diz "Seu restaurante no próximo nível!" | Frase nova | **Aproveito como candidata à frase da página de venda.** O GD escolhe; não publico nada |
| **Texto 2, Quarto** (previsões, recomendações e agentes que automatizem o autorizado) | Item 55 (previsão só com cerca de 8 semanas de histórico, em faixa, preço só como sugestão); níveis 1, 2 e 3 | Só desenho | **Já coberto.** Previsão **espera dados reais** |
| **Texto 2, Quinto** (canais, regiões, integrações, segmentos conforme capacidade e resultado comprovado) | Item 68: catálogo só depois de 3 meses e mais de 100 por região | Regra existente | **Adoto** e acrescento as travas da seção 4, item G |
| **Texto 2, parágrafo final** (testes, critérios de aceite, evidência; planejado não é entregue) | Testes e CI a cada PR; quadro novo | — | **Adoto como lei.** Seção 6 |

## 4. Choques, regras novas e o que aproveito

### Choques e como resolvi

1. **Descoberta de estabelecimentos × item 68.** O GD disse em 07/10 que não haveria catálogo agora, e o plano de 14/10 diz que ele vende o *uso* do software, sem misturar um restaurante
   com o outro. **Resolvi:** manter. A descoberta vem pelo Google, com a página pública de cada cardápio (item F). O catálogo geral fica como está no item 68.
2. **"Menos dados" (22/10) × "radar" e "personalização".** A regra de 22/10 manda pedir menos ao usuário. **Resolvi:** a inteligência trabalha só com o que a **operação já grava** (pedidos, custos, avaliações).
   Nada novo é perguntado ao dono. Perfil de pessoa vem só das respostas dela, com aceite (já dito no item 55).
3. **Meta que sobe todo mês, sem fim.** Meta que sobe sempre empurra agentes (e pessoas) para spam, para empurrar bebida, para esconder custo. **Resolvi:** quem fixa e eleva a meta é **o GD** (nível 3); nenhum agente
   eleva a própria meta; uma meta de volume só vale se a qualidade não cair (avaliação, reclamação, descadastro e chamado de ajuda não podem piorar); **Jurista e Humanidade podem barrar** (proposta que já está na seção 10 do documento dos agentes).
4. **Promoção que come a margem.** O texto pede "ofertas economicamente sustentáveis". **Resolvi:** toda sugestão de desconto mostra a **margem que sobra** com o custo cadastrado do prato (`costing.py`). Sem custo cadastrado, o sistema **não sugere desconto**, só pede o custo.
   Margem negativa nunca vira sugestão. Preço e promoção são nível 2: o dono aprova com um toque.
5. **Mensagem ao cliente.** Um cliente de vários restaurantes não pode ser lotado. **Resolvi:** teto por pessoa por dia somando todos os restaurantes (item 51), aceite separado para "aviso do pedido" (utilidade) e "ofertas do restaurante" (marketing), saída com um toque.
6. **Agente decidindo sobre pessoa.** A LGPD (art. 20) dá o direito de rever decisão automatizada. **Resolvi:** vale a regra de 14/10, **nenhum robô decide sobre uma pessoa**; recomendar ao dono é permitido, negar algo a alguém não. A obrigação `LGPD-DECISAO-AUTOMATIZADA` do registro de obrigações continua "planejada" e passa a ter essa regra como base.
7. **Verdade nos números.** O placar e as metas seguem o "falar sempre a verdade" do painel: sem dado suficiente, aparece "poucos dados", nunca um número inventado ou uma promessa de resultado.

### O que aproveito, em ordem, e o que cada um precisa

| | O quê | Por quê | Precisa de |
|---|---|---|---|
| **A** | **Terminar o que o dono toca:** entregas, acerto do caixa, cadastro do cardápio por voz e foto, a bolinha de voz | Sem tela, nada do texto chega a ninguém | Nada além do que já estou fazendo (PR #75, rascunho) |
| **B** | **Quadro de entrega** (seção 6), atualizado a cada PR | É a regra final do texto 2 | Nada |
| **C** | **Placar da plataforma** no grupo "Dono do sistema": funil (cadastrou, pôs pratos, 1º pedido, pagando, voltou), mensalidades, custo dos agentes, "poucos dados" quando for o caso. É o lugar das **metas mensais do GD** | Responde "estamos melhorando?" sem inventar | PR à parte, com teste. Usa tabelas que já existem. Depende do PR #71 para o custo dos agentes |
| **D** | **Cartão de aprovação com "objetivo", "como vou medir" e "limite"** como campos obrigatórios (hoje exige o quê, por quê, evidência, risco e o que acontece se recusar) | É o "princípio de execução" virando regra que o servidor aplica | Entra junto do **primeiro agente** (muda a migração do PR #71) |
| **E** | **Voltar e trazer:** aviso opcional no celular do cliente (PWA, **sem pedir telefone nem e-mail**), em dois aceites separados (pedido pronto; ofertas do restaurante); cupom simples com a margem à vista | Fecha o ciclo "vender, fazer voltar" com o mínimo de dado | O "pode" do GD, o advogado (oferta e CDC), e restaurante usando |
| **F** | **Página pública de cada cardápio para o Google** (marcação de restaurante e cardápio) | Descoberta sem catálogo; já está no plano de 90 dias | Decidir o endereço dos domínios (pendente) |
| **G** | **Travas de expansão:** nova região, canal ou segmento só quando houver, por exemplo, restaurantes pagando na região há 2 meses, resposta a chamado de ajuda dentro de 1 dia útil e nenhum erro de pedido aberto. Os **números exatos são proposta minha, o GD ajusta** | É o "conforme a capacidade e resultado comprovado" do Quinto | Primeiros clientes |
| **H** | **Previsões** (movimento por dia e hora, hora fraca para promoção) | É o Quarto | Cerca de 8 semanas de histórico real (item 55) |

## 5. O que expurgo, e por quê

| Sai | Motivo |
|---|---|
| **Varredura ampla do mercado** ("radar contínuo" de tudo) | Sem consumidor nem dado hoje, só dá custo de IA e risco de coleta indevida. Ficam o vigia da lei e o benchmark semanal quando houver agente |
| **Catálogo geral de estabelecimentos agora** | Choque 1 (item 68) |
| **Personalização por perfil inferido do consumidor** | Contraria o item 55 e a regra de menos dados; só vale o que a pessoa respondeu, com aceite |
| **Meta que o próprio agente eleva** | Choque 3 |
| **Tratar qualquer módulo "planejado" como entregue** | Regra final do texto 2 |
| **Expansão antecipada** (regiões, segmentos, integrações) | Só depois das travas do item G |
| **Várias lojas sob um dono / redes grandes agora** | Nenhum cliente pediu; adio até o primeiro cliente real |
| **Desperdício como módulo** | Sem restaurante usando não há o que medir; fica no custo do prato |

## 6. Quadro de entrega (primeira versão)

Regra: um módulo só muda de estado com **prova** (arquivo, teste ou conferência). A coluna "Prova que falta" é o critério de aceite do próximo estado. Os estados são:
**Só desenho**, **Em PR** (feito e testado, não juntado), **No `main`** (juntado, com teste e conferência verde, **mas fechado ao público**), **Validado** (um restaurante de verdade usou e o resultado foi medido).
**Nenhum módulo está "Validado".** O cadastro público está fechado e a cobrança desligada, de propósito.

| Módulo | Estado | Prova que existe | Prova que falta |
|---|---|---|---|
| Cardápio e pedido pelo QR (cliente) | No `main` (tela antiga); tela nova em PR #75 | Testes de lógica e de segurança; conferência de imagem 320 a 480 px | Um restaurante real; teste no Android |
| Pix direto na conta do restaurante | No `main` | `test_pix*.py` | Pix real de R$ 1,00 |
| Custos e CMV | No `main` | `test_costing.py`, `test_costs_*.py` | Dono real cadastrando custos |
| Painel "Seu negócio" | No `main` (PR #69) | `test_business_*.py`, `test_insights.py` | Dono real lendo e entendendo |
| Assistente do cardápio por voz, foto e planilha | No `main` | Testes do assistente; voz e planilha sem IA | **Chave de IA no servidor** (foto e PDF dependem dela) |
| Entrega: endereço, taxa, retirada | Servidor no `main`; tela do cliente: PR #41 (antiga) e PR #75 (nova) | `test_delivery*.py` | Entrega de verdade |
| Motoqueiro e acerto do caixa | Servidor e telas antigas no `main`; telas novas em construção | `test_courier*.py` | Uma entrega real com código |
| Mesa viva (chamar garçom, pedir a conta) | Servidor no `main`; telas: PR #72 (antiga) e PR #75 (nova: mesa do cliente e mesas do painel) | `test_table_calls*.py` | Um salão real |
| Abrir mesa pelo QR (garçom) | Em PR #72 (antiga) e PR #75 (nova) | Testes de lógica | Garçom real |
| Menu geral, Hoje, cozinha, pedidos e caixa (visual novo) | Em PR #75 (rascunho), conferência verde | 1102 testes locais, 5 verificações verdes, imagens | Ligar as telas ao painel (hoje só existem soltas) |
| Assinatura, bloqueio e cobrança manual | No `main`, **desligado** | `test_subscription*.py` | Empresa de pagamento; advogado |
| Cadastro do restaurante pela internet | No `main`, **fechado** | `test_signup.py` | O "pode" do GD |
| Conformidade como código | No `main` (PR #67, #68) | `compliance/check.py` a cada PR; vigia toda segunda | Advogado nas 10 obrigações que dependem dele |
| Fila de aprovação e registro de ações | Em PR #71 | `test_approvals*.py`, inclusive no banco de verdade | Um agente que proponha cartões |
| Trava de e-mail para empresas | No `main`, **nada envia** | `test_outreach.py` | Domínio com SPF, DKIM e DMARC; provedor; advogado |
| Os dez agentes | **Só desenho** | `agentes-e-aprendizado.md` | Chave de IA, executor, botão de parar, teto de gasto |
| Aviso no celular da equipe | No `main` | `test_push.py` | Android de verdade |
| Aviso no celular do cliente | **Falta** | — | Tudo |
| Campanha, cupom, fidelidade | **Falta** | — | Tudo |
| Página pública para o Google | **Falta** | — | Tudo |
| Placar da plataforma e metas | **Falta** | — | Tudo |
| Previsões | **Falta** | — | 8 semanas de dados |
| Várias lojas sob um dono | **Falta** | — | Pedido de cliente real |
| Vem Trabalhar | Outro repositório | Ver o repositório do Vem Trabalhar | — |

## 7. O que preciso do GD

1. **Manter o item 68** (sem catálogo agora)? Estou mantendo.
2. **O miolo do texto 2** ("Primeiro" a "Terceiro") existe? Se existir, mande; se não, tudo bem.
3. **Placar da plataforma** (item C) como o próximo trabalho de servidor, em PR à parte e fechado, depois que as telas do dono estiverem prontas? Preparo quando ele disser.
4. **A frase "Gestão que gera demanda. Inteligência que gera riqueza."** para a página de venda? Só publico com o "pode".
5. **Onde guardar os textos dele.** Guardei em `docs/diretrizes-do-gd/`, no repositório público, porque o repositório privado não está ligado a esta sessão. Se ele preferir o privado, eu movo.
