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
imagem ilustrativa (Código de Defesa do Consumidor).
