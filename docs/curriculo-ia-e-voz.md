# Currículo por foto e voz, IA para o dono e comandos de voz

Desenho de 06/10/2026 a partir da fala do GD (benchmark do texto da V4 e entrevista do currículo).
Detalhe e listas completas em `docs/planilhas/Vem-Trabalhar-planilhas.xlsx`, abas `Entrevista do currículo`,
`Tarefas por área`, `IA para o dono`, `Comandos de voz` e `Benchmark`. Nada disto está programado ainda.

## Os 3 pilares de IA, para cada dono que comprar o software

1. Conteúdo em escala: uma ideia vira 10 formatos (post, carrossel, story, texto de WhatsApp, cartaz com QR,
   roteiro de vídeo, e-mail, promoção, legenda, mensagem). Vale para prato, vaga, lição e currículo.
2. Análise de dados e decisão mais rápida: margem baixa, desperdício, vaga parada, onde a nota perde pontos,
   onde o aluno desiste. Todo número mostra de onde vem; a sugestão é do sistema, a decisão é do dono.
3. Imagens profissionais: foto do prato melhorada a partir da real, logomarca, banner, cartaz da vaga, capa de
   curso. Imagem criada do zero leva "imagem ilustrativa". Nunca criar pessoa que não existe (currículo, depoimento).

Gestão por voz e por foto, em linguagem simples. Ação que mexe com dinheiro, preço ou apaga algo lê em voz alta,
pede confirmação e tem "desfazer". Cada empresa vê só o que é seu (isolamento por `company_id` já existe).

Estado: foto do cardápio pronta (falta chave de IA e teste com cardápios reais); logomarca pronta (PR #25 aguardando
merge); isolamento por empresa existe. O resto é a fazer.

## Entrevista do currículo

38 etapas, tudo de toque ou voz. A pessoa tira uma foto do currículo velho (ou fala, ou toca), o sistema monta um
rascunho, marca com "?" o que não entendeu e pergunta o que falta.

Por experiência (volta à etapa de lugar enquanto houver "mais uma"): lugar, função, início, fim, o que fazia,
ferramentas, público atendido, resultado, o que aprendeu, o que desenvolveu, motivo da saída (opcional, só para o
sistema, nunca aparece).

Quem nunca trabalhou: "Buscar na vida", 11 áreas (administrativo, mecânica, logística, vendas, atendimento,
cozinha, cuidados, reparos e obra, campo, tecnologia, liderança) com perguntas de sim ou não e as mesmas perguntas
de seguimento. Bico, ajuda em negócio da família e voluntariado valem como experiência.

Fim: formação, habilidades (até 8), idiomas, apresentação em 3 tons, modelo e cor (26 modelos, 9 paletas), ouvir,
salvar. Depois, no máximo 3 cursos sugeridos com o motivo: curso livre nosso primeiro, curso de parceiro com a
etiqueta "Parceiro".

Regras: só escreve o que a pessoa disse e ela confirma cada trecho; áudio apagado depois de virar texto; não
pergunta idade, estado civil, filhos, saúde, religião nem cor; não cobra nem destaca tempo parado; cargo de
profissão regulada só com registro; pode parar e voltar. Na semana de teste o currículo só aparece na tela;
baixar o PDF libera com o pagamento (a confirmar com o GD, junto com a pergunta de currículo básico grátis).

`Tarefas por área`: 13 áreas com cargos, tarefas, ferramentas, habilidades e cursos. São as listas de tocar da
entrevista e as mesmas que alimentam o match (habilidades, ferramentas, função).

## Comandos de voz

32 frases de exemplo (Vem Comer, Vem Trabalhar, gerais e do dono da plataforma); 13 pedem confirmação. O
reconhecimento de voz do celular pode precisar de internet: verificar como fica em 2G e sempre oferecer o botão de
toque como alternativa.

## Benchmark

Registro do que o GD trouxe (texto da V4, anúncio da gentia.tech, sites de RH) e do que serve para nós. A
afirmação de que nenhum site de RH atende do autônomo à empresa de mil funcionários é do GD; não foi verificada.
O agente de benchmark da aba `Sistema vivo` só pesquisa e acrescenta linhas; não muda o sistema.

Benchmarks trazidos pelo GD em 06 e 07/10/2026 (texto e números são dos anúncios; não verificados):

| De onde | O que promete | O que vira no Vem |
| --- | --- | --- |
| monday.com, "Sidekick" (anúncio) | IA dentro da ferramenta, usando os dados da própria empresa, que acha, prioriza e monta plano de ação | **Gerente de bolso** no Vem Comer (pergunta por texto ou voz e "plano da semana" com as 3 ações que mais dão dinheiro, a partir de Custos, vendas e estoque); **coach do currículo** para o candidato; **assistente de recrutamento** para a empresa |
| Quickin, "Pré-entrevista por voz feita por agente de IA" (anúncio no Instagram; diz mais de 150 mil entrevistas e 40% menos tempo do recrutador) | O candidato responde por áudio; a IA transcreve e resume para o recrutador | **Pré-entrevista por voz** antes do RH parceiro: o candidato responde por áudio (no app ou WhatsApp) às perguntas da vaga; o sistema transcreve, resume e liga às 20 + 20 perguntas do match; o RH ou a empresa escuta primeiro os que mais combinam |
| Anúncio de plataforma de treinamento (texto colado pelo GD, sem o nome da empresa; diz que a produtividade de quem cobre uma vaga aberta cai até 45%) | Trilha de entrada (onboarding) por cargo e área, enviada sozinha quando o colaborador entra; o gestor define prazos e acompanha | **Trilha de entrada por cargo** no Vem Trabalhar: ao importar a equipe ou contratar, a pessoa recebe a trilha do cargo (cursos do catálogo + regras da casa); o gestor põe prazo e vê o andamento. **Trilha de cobertura**: quando uma vaga abre, quem cobre recebe um curso curto daquela função. No Vem Comer, a ficha técnica de cada prato vira o cartão de treino da cozinha ("como montar o X da casa") |
| Mindsight (anúncio colado pelo GD) | O gestor explica por alto o que precisa; o sistema organiza competências, senioridade e requisitos e sugere perfis; tour guiado sem falar com ninguém | **Vaga falada ou escrita por alto**: "preciso de um chapeiro para a noite, sem experiência, que more perto" vira a vaga completa (as 20 respostas do match, requisitos, competências da aba Importar equipe, benefícios) para a empresa conferir; junto com a **vaga por foto**, são três entradas para o mesmo resultado. Depois o sistema mostra os candidatos que mais combinam, com o motivo. **Demonstração sozinha**: tour guiado com dados de exemplo, como o guia do painel do Vem Comer |
| Agente de vendas "OS" (anúncio colado pelo GD; exemplo de vendedores convertendo 20% e 8% na mesma campanha) | O problema não é só a velocidade de resposta, é a variação entre atendentes; agente atende com o mesmo critério a qualquer hora, registra e mede toda conversa, mostra onde o funil vaza | **Atendente padrão** no WhatsApp do restaurante (item 17) e no comercial do Vem Trabalhar, sempre se apresentando como assistente e passando para uma pessoa quando precisa. **Funil medido**: Vem Comer (leu o QR → abriu o cardápio → pôs no carrinho → pediu → pagou) e Vem Trabalhar (viu a vaga → candidatou → entrevistado → contratado; empresa: visitou → publicou → assinou). **Variação entre pessoas**: ticket médio e sugestão aceita por garçom (item 11, garçom com meta) e nota por RH parceiro, para treinar quem converte menos |
| Uniateneu, programa de parceiros (anúncio colado pelo GD) | Quem já capta alunos vende graduação, pós e técnicos de uma instituição que diz ter nota máxima no MEC; comissão de até 100% da matrícula e até 70% das mensalidades | Confirma o modelo da aba `Parcerias` e mostra que 50% e 30% são piso para negociar. Uniateneu entra na aba `Faculdades` como "não contatada". O banco de pessoas do Vem Comer e do Vem Trabalhar e a escola própria levam alunos aos parceiros, sempre com a etiqueta "Parceiro", preço total e duração claros, e sem a comissão mexer no match |
| Connect, treinamentos de SST em EAD (anúncio colado pelo GD) | Revender treinamento com certificado assinado eletronicamente e com a logo de quem revende; visão por cliente; matrícula arrastando uma planilha; trilhas; download a qualquer hora | **Certificado premium**: modelo único e bonito, com logo da escola (e do parceiro, quando o curso for dele), assinatura eletrônica, código e QR que abrem uma página pública de conferência; entra sozinho no currículo. **Empresas treinando a equipe**: matrícula pela planilha da aba `Importar equipe`, trilha por cargo, painel por empresa (quem fez, quem atrasou), certificado com a logo da empresa. **SST oficial** (NR) só com parceiro habilitado; os nossos são "noções". Tipo de assinatura eletrônica a confirmar com advogado. **Currículo premium**: os 26 modelos no mesmo padrão visual do layout, PDF leve com QR |
| Solids, "RH Gestor" (anúncio colado pelo GD) | Avaliação de fit cultural para reduzir turnover | **Jeito da casa**: a empresa responde em toque como trabalha (ritmo, rotina, como corrige erro, comunicação, metas, uniforme, horários) e o candidato responde as perguntas gêmeas; entra no bloco "Jeito de trabalhar" do match, com o motivo. **Retenção medida**: o sistema pergunta à empresa aos 30, 60 e 90 dias se a pessoa continua, para calibrar os pesos do match com dados reais. Cuidado: "ter a cara da empresa" não pode virar filtro de aparência, idade, cor, classe ou origem; só comportamento e condições de trabalho, e nunca elimina sozinho |
| Select (anúncio colado pelo GD) | Recrutador para de ser "gestor de status": vagas, candidatos e histórico num lugar só; painel e indicadores em tempo real com prazo (SLA); admissão digital; central de WhatsApp com candidatos | **Status automático para o candidato** (recebido, em análise, entrevista, resultado), avisado pelo canal que ele escolheu; ninguém fica sem resposta. **Painel da vaga** para o gestor: candidatos em cada etapa, dias aberta, prazo de cada etapa e aviso quando passa do prazo. **Admissão digital** depois do "contratado": documentos só nessa etapa, guardados com cuidado, e em seguida a trilha de entrada do cargo. **Central de WhatsApp** depende da API oficial (custo por conversa) |
| Web Gerencial, recrutamento com IA (anúncio colado pelo GD) | A contratação errada custa de novo e de novo: demissão, rescisão, novo processo, queda de produtividade | **Calculadora "quanto custa errar uma contratação"** na página pública do Vem Trabalhar: salário, dias de vaga aberta, treinamento e produtividade perdida dão uma estimativa simples (sem calcular rescisão como cálculo trabalhista; "confirme com seu contador"); serve de porta de entrada para empresas, com aceite para contato. **Indicador de contratações que ficaram** (30, 60 e 90 dias), que mostra à empresa o quanto o match acerta |
| vagas.trabalho, "Grupos de vagas de trabalho no WhatsApp" (post no Instagram) | A página pede o estado e o número por mensagem direta e abre grupos primeiro nos estados com mais interesse | **Canal de vagas por cidade, com aceite**: a pessoa entra pelo link ou QR e escolhe cidade e área (não pegamos o número de ninguém). Preferir o canal do WhatsApp, em que os seguidores não veem o número uns dos outros, ao grupo, em que todos veem. As cidades abrem na ordem do número de inscritos, como no post; cada aviso leva para a vaga verificada no Vem Trabalhar. O mesmo modelo serve para promoções dos restaurantes do Vem Comer, só para quem pediu |
| Burger King, atendente no horário noturno (post de página de vagas) | Requisitos e benefícios claros: maior de 18, escala 6x1, trilha de carreira, Total Pass, descontos em faculdades, vale-transporte, contato por WhatsApp | Caso de teste da **vaga por foto**: cada benefício vira um campo marcado; "descontos em faculdades" liga a vaga aos cursos parceiros da aba `Faculdades` e "trilha de carreira" liga à trilha por cargo. "Maior de 18" é exigência da lei para trabalho noturno (CLT, art. 404), então o sistema aceita; idade só entra como requisito quando a lei exige |
| Webinar de IA em vendas (anúncio; evento gratuito e online em 08/10, 14h) | Aula gratuita ao vivo como porta de entrada para vender o produto | **Aula aberta do Vem**, uma por mês para cada público: "Quanto cada prato te dá de lucro" (Vem Comer), "Currículo que chama para entrevista" (candidato), "Contratar sem errar" (empresa). Inscrição com aceite para receber o lembrete e o material, o que cresce o banco do jeito certo; gravação em áudio e resumo em texto para quem tem internet fraca; no fim, o teste grátis do produto |
| The Members (anúncio; promete escola EAD com app da própria marca e "chancela do MEC" no plano business) | App com a marca, rede social interna, notificações, gamificação e IA que tira dúvidas 24 horas | Para a escola do Vem: **app da escola (PWA) com a marca Vem**, comunidade da turma com moderação, aviso de aula e de prazo, gamificação (pontos, medalhas, dias seguidos) e **tutor 24 horas que só responde com o material do curso** (a mesma trava da linha do WOS). "Chancela do MEC": não verificado e pede cuidado. Curso livre não precisa de autorização do MEC, e diploma com validade só sai de instituição credenciada; na prática, isso costuma ser um certificado de extensão emitido por uma faculdade parceira. Para nós, é uma parceria paga da aba `Faculdades`, com o nome da faculdade no certificado, e nunca "reconhecido pelo MEC" nos nossos cursos livres |
| VR, painel de risco trabalhista (anúncio) | O RH vê o risco trabalhista antes que vire processo | **Alertas da equipe** para quem importou a equipe no Vem Trabalhar e para a escala do Vem Comer: férias perto de vencer, horas extras acima do combinado, trabalho noturno, intervalo, documento de admissão faltando, exame ou treinamento obrigatório vencendo. Só com os dados que a empresa lançou, só o dono e o RH veem, e cada alerta diz "confirme com seu contador ou advogado": é aviso de prazo, não parecer jurídico. Regras e prazos conferidos pelo advogado antes de ligar |
| Helena, "white label" (anúncio; CRM, atendimento no WhatsApp, app próprio, garantia de implantação, comunidade e academia) | Revender a plataforma com a própria marca, com time de apoio e comunidade de empreendedores | **Parceiro com a própria marca** (depois do portal do parceiro): consultoria, contador ou agência oferece o Vem Comer ou o Vem Trabalhar com a logo dela no topo e "tecnologia Vem" no rodapé, com painel dos clientes e comissão, e a **academia do parceiro** dentro da escola. Combina com a visão do GD: tudo acontece no ambiente virtual, e a credibilidade vem da orientação e do que os dados ensinam. Cada cliente do parceiro continua isolado como qualquer empresa, e o parceiro só vê o que o cliente autorizar |
| empregare, e-book "Perguntas comportamentais para identificar os melhores talentos" (post) | Material grátis em troca do contato | **Materiais grátis com aceite**: "20 perguntas para entrevistar bem" (das nossas 20 + 20), "Ficha técnica e CMV em 1 página" com a calculadora, "Checklist da primeira semana do funcionário". O download pede só nome, e-mail ou WhatsApp e a caixa de aceite, e diz o que a pessoa vai receber; cada material termina no teste grátis |
| Focus, banco de talentos de estagiários (post) | Estudantes de Administração, Psicologia (ABA), Fonoaudiologia e Fisioterapia mandam currículo por e-mail com o título da vaga | **Tipo de vaga "estágio"** e **banco de talentos**: a pessoa marca "aceito ser encontrada por empresas" e escolhe por quanto tempo; a empresa procura no banco e convida. A vaga de estágio pede o que a Lei do Estágio (11.788/2008) pede: termo de compromisso com a instituição de ensino, até 6 horas por dia e 30 por semana (ensino superior e médio), bolsa e auxílio-transporte no estágio não obrigatório, e um supervisor com formação ou experiência na área; o sistema avisa quando falta algo. Abre a porta das faculdades como parceiras |
| WOS, agente de WhatsApp "Boss" (anúncio; diz que clientes nem acreditam que é IA e que investiu mais de R$ 30 milhões; não verificado) | "Trava anti-alucinação": quando a informação não está na base, o agente não adivinha e chama o dono para dizer o que responder; não substitui o time, melhora o resultado | **Trava "não sei, vou confirmar"** em todos os assistentes do Vem. Preço, horário, taxa de entrega, estoque, salário e prazo nunca são escritos pela IA: saem do banco de dados, e a IA só escolhe qual dado mostrar. Quando a resposta não está na base, o assistente diz "vou confirmar com a casa" e avisa o dono na hora; a resposta do dono entra na base e a próxima pergunta igual já sai respondida (o sistema vivo aprendendo). Diferente do anúncio, o nosso sempre diz que é assistente. No Vem Trabalhar vale o mesmo para vaga, salário e status da candidatura |
| Articulate (anúncio; "Crie treinamentos ilimitados, internamente. Com IA. Feito por você.") | A empresa cria os próprios treinamentos com IA, sem aumentar a carga da equipe | **Criador de treino da empresa**: o dono fala, fotografa ou escreve como se faz (fechar o caixa, montar o X-tudo, limpar a chapa) e o sistema monta um curso curto no padrão Vem (passos, imagem, teste de 3 perguntas, certificado interno); o dono confere antes de publicar, e o curso fica só para a equipe dele. No Vem Comer, a ficha técnica de cada prato vira o treino daquele prato; no Vem Trabalhar, entra na trilha de entrada do cargo. É também a máquina que ajuda a escola a chegar aos 200 cursos por região, sempre com revisão humana antes de publicar |

Regras para os dois: número sempre do próprio sistema, com a origem; preço, salário e prazo nunca escritos pela IA, e,
quando a resposta não está na base, o assistente diz que vai confirmar e chama uma pessoa; o candidato sabe que fala com um assistente e vê a
transcrição; ninguém é eliminado automaticamente (a pessoa pode pedir revisão humana, LGPD art. 20); áudio apagado depois
de virar texto, salvo autorização; sempre há o caminho por texto para quem não pode falar; dados de uma empresa nunca
vão para outra.

## Para o código (ordem sugerida, depois das decisões do GD)

1. Cadastro de pessoa e currículo (tabelas separadas das de restaurante, mesmo login e isolamento).
2. Entrevista em etapas com salvamento a cada resposta; leitura de foto por IA reaproveitando a peça da foto do
   cardápio; voz por reconhecimento do próprio celular (Web Speech) antes de qualquer serviço pago.
3. Modelos de currículo em tela e PDF (começar com 3 e chegar a 26).
4. Sugestão de curso a partir do que a pessoa disse.
5. Comandos de voz do dono, começando pelos que não mexem em dinheiro.

## Pontos para o advogado

LGPD (consentimento separado e revogável; revisão de decisão automatizada), Lei 9.029/1995 (nada discriminatório
no match e na entrevista), perguntas opcionais como o motivo da saída, uso de foto de currículo e de áudio, aviso de
imagem ilustrativa (Código de Defesa do Consumidor). Também: frases sobre MEC nos certificados (curso livre x
certificado de faculdade parceira); regras e prazos dos alertas da equipe (férias, horas extras, noturno, intervalo);
o que a vaga de estágio precisa pela Lei 11.788/2008; canal de WhatsApp e materiais grátis só com aceite.
