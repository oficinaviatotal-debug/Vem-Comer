# Agentes que evoluem e aprendem nos ecossistemas

Desenho de 15/10/2026, a partir do vídeo do "Harvey" que o GD mandou às 08:33 com a pergunta **"como ampliar,
potencializar, deixar sempre em evolução e aprendizado e implementar nos ecossistemas?"** (item 75 de
`docs/requisitos-do-dono-vem-comer.md`). O vídeo e a leitura dele ficam no repositório privado do Vem Trabalhar
(`docs/referencias-visuais/`), porque são de terceiro.

Este arquivo diz **o que já existe**, **o que é só desenho** e **o que depende do GD**. **Nada deste desenho está
programado ainda.**

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
| Números do restaurante com "falar sempre a verdade" (sem dado, a resposta é "poucos dados") | `backend/insights.py`, painel "Seu negócio" | Código |
| Assistente do cardápio por voz, foto e planilha | `docs/assistente-cardapio-voz.md` | Voz e planilha funcionam; **foto e PDF dependem da chave de IA, ainda não instalada** |
| Notebook ligado 24 horas com o Claude | `docs/notebook-24h.md` | Guia pronto; **não sei se o GD já fez** |

| **Não** existe | O que falta |
|---|---|
| Qualquer **agente que rode sozinho** | Executor, agenda e botão de parar |
| **Registro de ações e resultados** (o "placar") | Tabelas e API |
| **Fila de aprovação** do dono do software | Tela "Aprovações" no grupo "Dono do sistema" |
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
Assinaturas e Chamados. **Não existe ainda.**

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

Do meu lado, **sem esperar resposta**: criar o **registro de ações** e a **fila de aprovação** no servidor (tabelas, API,
testes) e a tela **Aprovações** no grupo "Dono do sistema". Nada envia e nada roda sozinho nessa etapa.

**Depende do GD:**
1. Começar pela captação do Vem Comer?
2. Nos primeiros 30 dias, **nada sai sem o aval dele** (minha recomendação).
3. ~~Região e tipos de negócio~~ **Respondido em 15/10, 08:42: Rio Grande do Norte inteiro, todo tipo de operação de comida e hotéis.**
4. Domínio e e-mail de envio (itens já pendentes).
5. Advogado para a revisão do e-mail para empresas.
