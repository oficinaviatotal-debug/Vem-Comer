# Agentes que evoluem e aprendem nos ecossistemas

Desenho de 15/10/2026, a partir do vídeo do "Harvey" que o GD mandou às 08:33 com a pergunta **"como ampliar,
potencializar, deixar sempre em evolução e aprendizado e implementar nos ecossistemas?"** (item 75 de
`docs/requisitos-do-dono-vem-comer.md`). O vídeo e a leitura dele ficam no repositório privado do Vem Trabalhar
(`docs/referencias-visuais/`), porque são de terceiro.

Este arquivo diz **o que já existe**, **o que é só desenho** e **o que depende do GD**. **Nenhum agente roda ainda.**
Estão programados só o **registro de ações** e a **fila de aprovação** (migração 020, `backend/approvals.py`, tela
**Aprovações**): são o lugar onde os agentes vão propor e esperar o aval do GD, e **nada neles executa, envia ou muda
coisa nenhuma**.

## 1. O que o vídeo mostra, e o que não verifiquei

O "Harvey" é apresentado como um agente autônomo de vendas, aberto (GitHub, licença MIT), que roda **dentro do Claude
Code**, na assinatura que a pessoa já paga (o README diz "sem conta de API"). O laço: acha comércios locais que valem a
pena (exemplo na tela: "4,8 no Google e nenhum site"), pesquisa cada um, escreve um e-mail frio que cita um fato
específico, lê as respostas, conduz o funil (conversa, proposta, reunião), marca reunião de 15 minutos e mostra tudo num
painel local, com uma **fila de e-mails esperando aprovação**.

- Li as **imagens e as legendas**; o **áudio não foi transcrito** (não há ferramenta para isso aqui).
- É peça de venda de um criador ("comente HARVEY e receba o passo a passo"). **Não conferi** se o projeto existe como
  descrito, nem os termos de uso da assinatura em laço automático. **Não vou instalar nem rodar código de terceiro sem
  ler antes.** A regra do projeto já diz: extrair a capacidade e construir uma versão original (`BENCHMARK_INTELLIGENCE.md`).

## 2. O que o projeto já tem e o que não tem

| Já existe | Onde | Estado |
|---|---|---|
| O laço de 12 passos (observar até renovar), os agentes, os **três níveis de mudança** e o **God Mode** do GD, o "segundo cérebro" | `LIVING_SYSTEM_SPINE.md` | Só texto |
| O laço de benchmark (sinal até mudança no produto) | `BENCHMARK_INTELLIGENCE.md` | Só texto |
| A **trava** de e-mail para empresas: só empresa, origem e base legal anotadas, lista de bloqueio única, no máximo 3 envios, limite diário que cresce aos poucos, freio automático por reclamação ou devolução, descadastro de um clique | `backend/outreach.py` | **Código com teste. Nada envia:** não existe provedor de envio |
| **Registro de ações** (quem propôs, quem decidiu, resultado, custo; histórico que o banco não deixa alterar) e **fila de aprovação** do dono do software (nível 3) | `backend/approvals.py`, migração `020_registro_de_acoes.sql`, tela "Aprovações" | **Código com teste, inclusive no banco de verdade.** Ainda **não há agente** que proponha cartões, então a fila fica vazia |
| Números do restaurante com "falar sempre a verdade" (sem dado, a resposta é "poucos dados") | `backend/insights.py`, painel "Seu negócio" | Código |
| Assistente do cardápio por voz, foto e planilha | `docs/assistente-cardapio-voz.md` | Voz e planilha funcionam; **foto e PDF dependem da chave de IA, ainda não instalada** |
| Notebook ligado 24 horas com o Claude | `docs/notebook-24h.md` | Guia pronto; **não sei se o GD já fez** |

| **Não** existe | O que falta |
|---|---|
| Qualquer **agente que rode sozinho** | Executor, agenda e botão de parar |
| O **placar** por agente (taxa de resposta, reuniões, custo por reunião) | Cálculo sobre o registro, depois que houver ações de verdade |
| O **executor** que, depois do aval, faz a ação e conta o resultado e o custo | Código; a regra já existe (`approvals.finish`: só ação aprovada conclui) |
| Envio de e-mail | Domínio, SPF, DKIM, DMARC e provedor |
| Chave de IA no servidor | Script do servidor (nunca no chat) |
| Captação de contatos | Fontes permitidas, pesquisa, redação com fonte |

## 3. O laço único

Todo agente do ecossistema segue o mesmo laço, e só muda **de onde vêm os dados** e **o que ele faz no fim**:

**achar → entender → preparar → pedir o OK (conforme o nível) → agir → medir → aprender → renovar.**

Regras que valem para todos:

1. **Cada fato escrito tem fonte e data** ("tem 4,8 no Google" só entra se houver de onde vem). Sem fonte, a frase não sai.
2. **A IA não escreve preço, salário nem prazo**: vêm do banco.
3. **Diz que é assistente** quando fala com alguém.
4. **O nível de autorização decide quem aprova** (níveis 1, 2 e 3 do `LIVING_SYSTEM_SPINE.md`): reversível e pequeno, o
   sistema faz e conta no resumo do dia; preço, promoção e campanha, o dono do restaurante aprova com um toque; método,
   dinheiro, texto legal, canal novo, custo novo, dado pessoal e **qualquer código em produção**, só o GD.
5. **Botão de parar e teto de gasto por dia**, sempre.

## 4. "Sempre em evolução e aprendendo": memória e placar

Aprender não é o agente mudar sozinho; é **medir, propor e passar por aprovação**:

- **Registro de cada ação:** qual agente, o quê, para quem, **fontes dos fatos**, nível de autorização, quem aprovou,
  **resultado** (respondeu? agendou? fechou? por que não?) e custo.
- **Placar por agente:** taxa de resposta, reuniões, custo por reunião. Dentro do Vem Comer: pedidos, ticket médio, CMV.
- **Revisão semanal:** o agente de aprendizado lê o registro e **propõe** mudanças no "manual" do agente (texto,
  ordem, horário, público). Nível 1 aplica e avisa no resumo; níveis 2 e 3 vão para a fila.
- **O manual de cada agente é arquivo versionado no repositório, com teste.** Mudar o manual é pull request, como o
  código, com a volta pronta. Assim o agente **não deriva** e dá para ver o que mudou e por quê.
- **O que aprendeu vira teste** ("conhecimento que se pode testar de novo", do Spine). Módulo sem revisão há três meses
  entra no resumo do dia.

## 5. A fila do dono do software ("Aprovações")

É o God Mode do GD: um cartão por decisão, com **o quê, por quê, a evidência, o risco, o que acontece se recusar** e
três botões (aprovar, recusar, pedir mudança). Fica no menu da esquerda, no grupo **Dono do sistema**, junto de
Assinaturas e Chamados. **Existe desde 15/10/2026** (aguardando o aval do GD para entrar no ar).

Como funciona, em regras que o servidor e o banco aplicam (todas com teste):
- **Dois jeitos de entrar.** Nível 1 (reversível e pequeno): o sistema faz e conta; entra no registro já como "feita" ou
  "falhou" e **nunca espera ninguém**. Nível 3 (método, dinheiro, texto legal, canal novo, custo novo, dado pessoal,
  código em produção): entra "pendente" e **só o dono do software decide**. O nível 2 (o dono do restaurante aprova)
  entra quando houver a fila do restaurante; por isso o banco ainda não o aceita.
- **Sem evidência não entra na fila:** cada fato do cartão precisa de **fonte e data** ("sem fonte, a frase não sai"),
  e o cartão precisa dizer o risco e o que acontece se recusar.
- **Aprovar só libera.** Quem executa conta o resultado e o custo depois, e **só uma ação aprovada pode ser concluída**.
- **Decide-se uma vez.** Repetir a mesma decisão não é erro; mudar de ideia depois é recusado (o agente propõe um cartão
  novo). Pedir mudança exige dizer o que mudar.
- **Quem decidiu vem do login**, nunca do que a tela manda, e só administrador da plataforma abre e decide.
- **Histórico que não se altera:** cada passo (proposta, decisão, conclusão) vira uma linha que o banco não deixa
  mudar nem apagar; apagar o usuário que decidiu não mexe no histórico.

**O que a tela ainda não faz:** o "placar" por agente, o aviso no celular quando chega um cartão (o aviso dos
administradores já existe para pagamentos; falta ligar) e a revisão semanal do agente de aprendizado.

## 6. Onde aplicar primeiro (ordem proposta)

1. **Captação do Vem Comer (o padrão do Harvey).** É o único motor de receita. O agente **só prepara** (lista, pesquisa com
   fonte, primeira mensagem) e **o GD aprova cada envio** nos primeiros 30 dias.

   **Alvo definido pelo GD (15/10/2026, 08:42): o estado do Rio Grande do Norte inteiro, todo tipo de operação de comida:
   bares, restaurantes, lanchonetes, hotéis e qualquer loja de refeição, "buscando no Instagram".**

   De onde vêm os contatos (o que é permitido e o que não é):
   - **Lista base: cadastro público de empresas (dados abertos do CNPJ, Receita Federal), filtrado por RN e pelas atividades
     de alimentação (CNAE, divisão 56) e hospedagem (divisão 55).** É a única fonte que dá a lista **completa** e oficial.
     Limites: só quem tem CNPJ (ambulante e delivery caseiro sem registro ficam de fora); o e-mail do cadastro muitas
     vezes é o do contador, não o do dono; o telefone costuma ser mais útil. **Hoje o `outreach.py` não aceita "cadastro
     público do CNPJ" como origem** (aceita: anúncio público, site da empresa, indicação, parceiro, pedido do contato). Incluir
     essa origem muda regra de conformidade (nível 3, decisão do GD) e **precisa da revisão do advogado**. Baixar e filtrar esses
     arquivos roda no servidor ou no notebook, não no meu ambiente de trabalho (a rede daqui é restrita).
   - **Enriquecimento:** o site da própria empresa, o perfil dela no Google (pela interface oficial, conferindo termos e
     custo) e o **endereço do Instagram que a empresa publica nos próprios canais**.
   - **Instagram:** a API oficial (Business Discovery) **consulta uma conta cujo @ já se conhece**, a partir de uma conta
     profissional sua, e devolve seguidores, quantidade de publicações e métricas. **Ela não busca por cidade nem por tipo de
     negócio.** Coleta automática no Instagram sem permissão contraria os termos da Meta e pode **derrubar as contas do
     GD** (Vem Tecnologia, Via Total). Por isso: a busca por cidade e tipo é **feita por você** (como já faz, mandando prints,
     que eu leio) ou por indicação; a mensagem direta no Instagram é **enviada por você**, preparada por mim.
   - **Hotel** entra pelo restaurante e pelo bar do hotel. **Pedido por quarto não está no produto hoje** (a conferir).

   **Prioridade da lista (pontuação com fonte):** sem cardápio digital nem site, boa nota e muitas avaliações, região turística
   ou de muito movimento. Ordem sugerida: Grande Natal (Natal, Parnamirim), litoral (Tibau do Sul e Pipa, Nísia Floresta, litoral
   norte), Mossoró e depois o interior (Caicó e o Seridó).

   **Antes de enviar qualquer e-mail:** domínio com SPF, DKIM e DMARC; provedor de envio; revisão do advogado (LGPD,
   interesse legítimo, identificação de quem envia, descadastro).
   **WhatsApp e Instagram não entram como envio automático de mensagem fria:** costumam bloquear a conta; as regras de cada
   plataforma devem ser conferidas. No começo, o agente prepara e o GD manda.
2. **Sucesso do restaurante, dentro do Vem Comer.** Um resumo por semana com **três ações** tiradas do "Seu negócio" (pratos
   sem foto, prato com custo alto, horário com fila), em linguagem simples. É o agente de aprendizado olhando os dados do
   próprio restaurante; usa o que já existe em `insights.py`.
3. **Leitura de cardápio que melhora com as correções do dono**, com consentimento (liga ao `atlas-de-cardapios.md`).
4. **Vem Trabalhar:** a mesma estrutura (vaga parada, candidato sem resposta, conversa de currículo e de vaga, ver
   `docs/navegacao-e-conversa.md`), depois do motor de conversa.

## 7. Onde roda

- **Captação e testes do GD:** o notebook ligado 24 horas com o Claude (`docs/notebook-24h.md`) combina com o jeito do
  vídeo e usa a assinatura dele. **Os termos de usar a assinatura em laço automático precisam ser conferidos** antes de
  depender disso.
- **O que os clientes usam** (assistente do cardápio, conversa, avisos): **no servidor**, com a chave de IA instalada por
  script, com teto de gasto por restaurante e botão de desligar. Um produto vendido não pode depender da assinatura
  pessoal do GD.

## 8. Riscos (ditos com franqueza)

- **LGPD e e-mail frio para empresa:** a trava existe, mas a revisão do advogado ainda não.
- **Reputação do domínio:** e-mail em volume sem aquecimento e sem SPF/DKIM/DMARC cai em spam.
- **Deriva do agente:** por isso o manual é versionado e a mudança passa por aprovação.
- **Custo de IA:** sem teto, um laço descuidado gasta à toa.
- **Código de terceiro:** não rodar sem ler.
- **Promessas de anúncio** (resultados, números) **não são prova**.

## 9. Próximos passos

**Feito (15/10/2026, aguardando o aval do GD):** o **registro de ações** e a **fila de aprovação** no servidor (tabelas,
API, testes) e a tela **Aprovações** no grupo "Dono do sistema". Nada envia e nada roda sozinho.

**Do meu lado, sem esperar resposta:** o modelo da **lista de captação** do RN (empresas com fonte, data e situação,
sem enviar nada) e o aviso no celular do GD quando chegar um cartão.

**Depende do GD:**
1. Começar pela captação do Vem Comer?
2. Nos primeiros 30 dias, **nada sai sem o aval dele** (minha recomendação).
3. ~~Região e tipos de negócio~~ **Respondido em 15/10, 08:42: Rio Grande do Norte inteiro, todo tipo de operação de comida e hotéis.**
4. Domínio e e-mail de envio (itens já pendentes).
5. Advogado para a revisão do e-mail para empresas.

## 10. O elenco dos dez agentes (pedido do GD, 22/10/2026, 11:55)

O GD lembrou, no meio do trabalho: **"Não esquecer dos agentes de Marketing, retenção, prospecção, estratégia, tecnologia e
engenharia, jurista, vendas, campanhas, humanidade, criação de riquezas."** (item 83 de `docs/requisitos-do-dono-vem-comer.md`).
Os agentes da parte "Agent organization" do `docs/LIVING_SYSTEM_SPINE.md` (orquestrador, olheiro, tecnologia, segurança, conversão, operação, margem,
aprendizado) ficam como a **estrutura**; estes dez são o **elenco com nome que o GD quer ver**. Todos seguem o mesmo laço da
seção 3, o mesmo registro de ações e a mesma fila de aprovação. **Nenhum roda ainda.** Falta a chave de IA no servidor (instalada
por ele, por script, nunca no chat), o executor e o botão de parar.

| Agente | Cuida de | O que prepara (nunca age sozinho) | Dados que usa | Quem aprova | O que já existe |
|---|---|---|---|---|---|
| **Estratégia** | Para onde ir primeiro | As 3 prioridades da semana; desempata quando dois agentes querem coisas contrárias (ex.: campanha que come a margem) | Placar dos outros nove, `insights.py` | GD (nível 3) | Fila "Aprovações"; o laço |
| **Marketing** | Ser encontrado | Página pública do restaurante, texto de Google e Instagram, cartaz com o QR, foto melhor | Cardápio, fotos, avaliações do próprio restaurante | Dono, antes de publicar (nível 2) | Foto melhorada, logomarca, QR de mesa; página pública ainda falta |
| **Prospecção** | Achar restaurantes e vagas | Lista do RN (CNPJ, CNAE 55 e 56) com fonte e data, e a primeira mensagem | Cadastro público, site da empresa | **GD, cada envio** nos primeiros 30 dias | A trava `outreach.py`; nada envia |
| **Vendas** | Fechar | Resposta a quem se interessou, proposta, teste grátis até plano; dentro do restaurante, a sugestão de venda no prato (sem empurrar bebida alcoólica, nunca para menor) | Pedidos, cardápio, plano | Preço: dono (nível 2). Plano da plataforma: GD | `subscription.py`; sugestão de venda ainda falta |
| **Campanhas** | Trazer o cliente de volta com promoção | Cupom, horário parado, aniversário, só para quem **consentiu** e com como sair | Base de clientes com consentimento | Dono, um toque (nível 2) | `consent.py`; nada envia |
| **Retenção** | Não perder ninguém | Restaurante que esfriou (sem pedido, sem foto, cardápio velho), cliente que sumiu, candidato sem resposta | Pedidos, avaliações (rostinho), `feedback.py` | Aviso interno: sistema (nível 1). Mensagem a cliente: dono (nível 2) | `insights.py`, `feedback.py` |
| **Tecnologia e engenharia** | Produto rápido, seguro e simples | Melhoria, correção de segurança, ideia de ferramenta nova; sempre como pull request com testes e a volta pronta | Testes, erros, desempenho, benchmark | **GD, com o "pode"**; nunca mexe em produção sozinho | O trabalho que já faço; CI com cinco verificações |
| **Jurista** | Cumprir a lei | LGPD, termos, regras de bebida alcoólica, regras do trabalho (Vem Trabalhar), texto legal; marca "precisa do advogado" | `compliance/check.py`, registro de obrigações | GD **e advogado**. **Não substitui advogado** | Registro de obrigações e teste de conformidade |
| **Humanidade** | As pessoas | Linguagem simples, toque grande, voz, atenção a quem lê pouco; avisa quando o sistema está pesando para alguém (fila, chamado sem resposta, cozinha sobrecarregada); no Vem Trabalhar, candidato nunca fica sem resposta | Chamados, filas, avaliações | Nível 1 para texto e ordem; o resto, quem for o dono do assunto | As regras de linguagem simples, os testes de toque e de leitura por voz |
| **Criação de riquezas** | Sobrar mais dinheiro | Margem, CMV, preço do prato, desperdício, ticket médio, caixa da semana; para o ecossistema, receita por restaurante contra custo de IA | `costing.py`, `costs_view.py`, `insights.py` | Preço: dono (nível 2). Plano e custo da plataforma: GD | Custos e CMV do restaurante |

**Regras que valem para os dez**

1. **O dono do restaurante não vê "dez agentes".** Vê **uma voz** (a bolinha) e **"Hoje: 3 coisas"**, em frase curta. Os agentes
   trabalham por trás. Quem vê o nome de cada agente é o GD, em cada cartão da fila de aprovação. É a regra de 22/10 (menos
   escrita, menos dado, menos informação).
2. **Estratégia arbitra.** Dois agentes nunca mandam ao dono ao mesmo tempo sobre o mesmo assunto.
3. **Jurista e Humanidade podem barrar** uma ação antes de ela chegar à fila (proposta minha; o GD decide).
4. **Teto de gasto por agente e por restaurante, botão de parar por agente, manual versionado** (seção 4).
5. **Criação de riquezas é sobre o negócio** (margem, caixa, preço, receita). Não faz recomendação de investimento pessoal de
   ninguém e não mexe em dinheiro: Pix e cobrança continuam só pelo que já existe.

**O que entendi e quero que o GD confirme.** "Humanidade": entendi como o agente que cuida das **pessoas** (equipe, cliente,
candidato, quem lê pouco) e do **respeito** no tratamento. "Criação de riquezas": entendi como **gerar mais lucro e caixa** para o
restaurante e para o ecossistema. Se ele quis dizer outra coisa, ajusto.

**Ordem que proponho (pelos dados que já existem):** 1) Criação de riquezas e Retenção, porque `insights.py`, custos e
avaliações já existem; 2) Jurista e Tecnologia, que já rodam como trabalho meu; 3) Humanidade, que já vale como regra de toda tela
nova; 4) Prospecção, depois do domínio, de SPF, DKIM e DMARC e do advogado; 5) Marketing, Vendas e Campanhas, depois do consentimento
dos clientes e do envio; 6) Estratégia, quando houver placar de verdade para ela ler.
