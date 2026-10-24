# Máquina de vendas do Vem

Como o Vem Tecnologia (o GD) conquista bares, restaurantes, pastelarias, sorveterias e outros negócios de comida, com o máximo de automação que as regras permitem, sem mensagem fria em massa e sem nada que o advogado ainda não tenha visto.

Estado: **servidor pronto e testado; nada envia mensagem; formulário público fechado.** A tela do painel do GD é a próxima rodada.

## 1. Duas frentes, duas responsabilidades

| | Quem faz | O que faz | Onde está |
|---|---|---|---|
| **A. Vender o Vem para o restaurante** | Vem Tecnologia (GD) | Achar negócios, entrar em contato com cuidado, mostrar a demonstração, acompanhar até ele pagar | Esta máquina (`backend/vendas.py`, migração 021) |
| **B. O restaurante vender para o cliente dele** | O dono do restaurante | Divulgar o próprio link (pastelaria, sorveteria, pizzaria…), no Instagram, no WhatsApp, no balcão | Tela "Meu link" / Divulgar (`docs/divulgacao-do-restaurante.md`, rodada 29) |

A frente B é do dono do restaurante: o Vem entrega a ferramenta (link, cartão para compartilhar, QR), mas o trabalho de divulgar é dele. A frente A é do Vem: o sistema ajuda a achar, lembrar, escrever e medir, e uma pessoa do Vem aperta o botão de enviar.

## 2. O que "automatizado" quer dizer aqui

Automatizar é tirar trabalho da pessoa, não tirar a pessoa do meio. O sistema:

- lista **quem procurar hoje** (no máximo 10), em ordem de importância: quem respondeu primeiro, depois quem viu a demonstração e não se cadastrou, depois os primeiros contatos e lembretes;
- mantém na tela **quem está esperando resposta** (com a data em que volta a ser a vez), para a pessoa anotar a resposta quando ela chegar;
- diz **por qual canal** e **em que horário** (cada tipo de negócio tem uma hora de folga: a cozinha cheia não atende conversa de vendas);
- guarda **de onde veio cada contato** (obrigatório);
- lembra do **próximo passo** (esperar, lembrete, convidar para a demonstração, perguntar se travou, ajudar a montar o cardápio, encerrar);
- lê um texto colado ou falado (anúncio, cartão, conversa) e **separa telefone, e-mail, Instagram e site**;
- **conta o que deu certo**: funil por etapa e por origem do contato;
- cuida sozinho das regras de proteção (bloqueio, limites, apagar).

O que o sistema **não** faz: enviar a mensagem. Quem envia é uma pessoa do Vem, uma por vez, pelo canal que o próprio negócio divulgou. Depois toca em **"Já mandei"**. Isso segue `compliance/obligations.json` (EMAIL-PROSPECCAO-EMPRESA, VENDAS-CONTATO-COMERCIAL) e o plano de crescimento (seção 6).

## 3. O caminho de um negócio

Achado → Já chamei → Respondeu → Viu a demonstração → Cadastrou → Pagando.

Saídas: **Não quer** (para sempre), **Sem resposta** (encerrado depois de 3 contatos), **Perdido**.

A etapa só anda para frente. Voltar acontece pela resposta da pessoa ("respondeu" de novo).

| Situação | O que o sistema sugere |
|---|---|
| Sem nenhum canal de contato | Achar um contato (olhar onde o negócio divulga) |
| Nunca foi chamado | Primeiro contato, pelo canal que ele divulgou |
| Chamado, sem resposta | Esperar 5 dias (7 se foi mensagem de pessoa) e fazer **um** lembrete |
| 3 contatos sem resposta, ou 2 WhatsApp | Encerrar e não procurar de novo |
| Respondeu | Responder hoje (passa na frente de tudo, até no domingo) |
| Perguntou "de onde veio meu contato?" | Dizer a origem, oferecer parar. Se não voltar, encerrar |
| Pediu para falar depois | Esperar 14 dias |
| Você respondeu e ele não voltou | Convidar para a demonstração depois de 3 dias |
| Viu a demonstração e não se cadastrou | Perguntar se travou depois de 3 dias |
| Cadastrou e não está pagando | Oferecer ajuda para montar o cardápio depois de 2 dias |

## 4. As regras de proteção (todas com teste)

1. **Origem obrigatória.** Sem dizer de onde veio o contato (anúncio público, site da empresa, indicação, parceiro, pediu contato, visita, formulário do site), o negócio não entra.
2. **Poucos contatos.** No máximo 3 por negócio e 2 por WhatsApp, com pelo menos 5 dias entre eles.
3. **"Não quero" vale na hora e para sempre.** O telefone e o e-mail vão para a lista de bloqueio (só a impressão digital, nunca o número), o resto da ficha é apagado, e quem saiu não volta por outra porta (telefone novo, e-mail novo, mesmo negócio).
4. **O texto da resposta não é guardado.** Só o resultado ("interessado", "dúvida", "quer saber a origem", "adiar", "não quer").
5. **Quem pede para apagar é apagado** (LGPD art. 18): a ficha e o histórico somem, só fica a impressão digital no bloqueio.
6. **Guarda máxima de 24 meses** para negócio encerrado (a rotina agendada que chama isso ainda não existe: ver seção 8).
7. **Ritmo humano.** No máximo 10 sugestões por dia; aviso quando passam de 15 mensagens no mesmo dia; domingo só se responde.
8. **Só quem tem permissão mexe.** Todas as rotas do caderno são do administrador da plataforma. Cada mudança grava quem fez (identificador do usuário, sem nome nem e-mail).
9. **E-mail em volume não passa por aqui.** Só e-mail um a um. Volume exige provedor, domínio autenticado (SPF, DKIM, DMARC), descadastro de um clique e `outreach.check_contact` (ainda não existe provedor).

## 5. O formulário "Quero que o Vem fale comigo"

Para quem chega sozinho (pelo link, por indicação, por um cartão) e quer ser chamado.

- **Nasce fechado.** Sem `INTEREST_OPEN=1` no servidor, as duas rotas públicas respondem 404 e nada é gravado.
- A pessoa informa nome do negócio, tipo, cidade e WhatsApp **ou** e-mail, e **marca a caixa** com o texto exato: "Autorizo a Vem Tecnologia a falar comigo por WhatsApp, telefone ou e-mail sobre o Vem Comer. Posso pedir para parar a qualquer momento, e eles param na hora."
- A caixa não vem marcada, e sem ela nada é guardado.
- A prova do aceite fica em `consent_records` (só se acrescenta, nunca se altera), com a impressão digital do texto, a versão e uma impressão digital da rede (nunca o IP puro).
- Campo escondido contra robô: quem o preenche recebe "deu certo" e nada é guardado.
- Limite por rede: quem insiste é desacelerado (429).
- Contato que já pediu para sair recebe uma recusa simples, sem dizer por quê.
- O agradecimento é o mesmo para quem já estava na lista e para quem é novo (não revela quem já é conhecido).

**Ainda falta:** confirmação em duas etapas por e-mail (precisa de provedor). Enquanto não existe, a **primeira mensagem** a quem veio por formulário deve dizer "você deixou o contato no site; se não foi você, responda NÃO".

### Como ligar (só com o "pode" do GD)

No servidor, no arquivo de ambiente, acrescentar `INTEREST_OPEN=1` e reiniciar o serviço. Para fechar de novo, apagar a linha e reiniciar. Não liga sozinho em nenhum cenário.

## 6. O que existe hoje

| Peça | Arquivo |
|---|---|
| Tabelas: `sales_prospects`, `sales_events`, `phone_suppression`; novo motivo `contato_comercial` no aceite | `database/migrations/021_vendas_do_vem.sql` |
| Regras e leitura de contato | `backend/vendas.py` |
| Rotas do administrador (`/api/platform/sales…`) e formulário público (`/api/interest…`) | `backend/vendas_api.py` |
| Inventário de dados (toda coluna classificada) e obrigação de conformidade | `backend/inventario_dados.json`, `compliance/obligations.json` |
| Testes | `backend/test_vendas.py`, `test_vendas_db.py` (banco de verdade), `test_vendas_endpoint.py` |

Rotas do administrador: ver o resumo do dia (quem procurar hoje, quem está esperando) e o funil; ler um texto colado; anotar um negócio; "já mandei"; registrar a resposta; mudar a etapa; apagar uma ficha (pede para escrever APAGAR).

## 7. O que fica desligado, de propósito

- **Nenhum envio.** Não existe código que mande WhatsApp, Telegram, SMS ou e-mail para um negócio.
- **Formulário público fechado** até o "pode" do GD.
- **Nada de lista comprada, raspagem de Instagram ou de sites com login, nem depoimento inventado.**
- **Nada com mensagem fria em massa por WhatsApp ou Telegram.**

## 8. Próximos passos

1. Tela **"Vendas"** no painel do GD (visual novo): lista de hoje, colar ou falar um contato, "Já mandei", resultado da resposta, funil por origem, rascunho da primeira mensagem e do lembrete, link `wa.me` / `mailto:` para a pessoa enviar um a um.
2. Formulário "Quero que me chamem" na página de vendas.
3. Rotina agendada que chama a guarda de 24 meses.
4. Resumo diário para o GD (quantos para chamar, quem respondeu).
5. Provedor de e-mail, domínio, SPF/DKIM/DMARC e confirmação em duas etapas.

## 9. Decisões que são do GD

- **"Pode" para ligar o formulário público** (`INTEREST_OPEN=1`) e, depois, para qualquer envio de verdade.
- **Advogado**: parecer sobre o interesse legítimo para o primeiro contato com negócio que divulgou o telefone em público; texto da mensagem de apresentação; texto do formulário.
- **Horários de folga** de cada tipo de negócio (hoje são a leitura da engenharia: restaurante 14h–17h, pastelaria e padaria 14h–16h, sorveteria e açaí 9h–11h, bar 10h–16h).
- **Limites** (3 contatos, 2 por WhatsApp, 5 dias) valem como ponto de partida; o GD ajusta pelo que ouvir dos donos.
