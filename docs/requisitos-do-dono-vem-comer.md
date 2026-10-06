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

- O restaurante precisa se cadastrar sozinho pela internet, sem ninguém no meio (hoje o cadastro público
  está fechado de propósito; só o administrador cria restaurante por script). **Falta.**
- Precisa aprender a usar sozinho: o assistente explica, fala e conserta o que o dono errou.
- Precisa de cobrança da assinatura e de período de teste. **Falta.**
- Suporte tem de ser quase todo automático (o assistente responde; pouca coisa chega a uma pessoa).
- Segurança e isolamento entre restaurantes têm de ser tão bons quanto os de um produto grande.
- LGPD: o restaurante é quem decide sobre os dados dos clientes dele; o Vem Comer é o operador dos dados.
  Termos de uso e política de privacidade precisam existir e ser aceitos no cadastro. **Falta.**

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
| 5 | **Criação de logomarca** (se não tem, o sistema pergunta cores/fachada e cria). | Falta. |
| 6 | **Cardápio com categorias e imagem do que ele usou.** QR de mesa e link do cardápio. | Feito (cardápio, QR de mesa). Fotos: em andamento. |
| 7 | **Cadastro com CEP; entrega roteirizada pelo CEP; a cozinha recebe o pedido.** | Falta (cozinha recebe: existe a tela de pedidos; CEP e rota: falta). |
| 8 | **Cadastro de porção** (padronização mínima), **gerência de produtos e de custos, CMV da cozinha.** "O cara nunca teve isso." | Falta. |
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
2. Cadastro do restaurante pela internet, sem ajuda (e-mail confirmado, proteção contra abuso, termos e LGPD).
3. Foto do cardápio inteiro cadastrando sozinha (pronta; falta ligar a chave de IA e testar com cardápios reais).
4. Logomarca.
5. Assinatura e cobrança (teste grátis, plano).
6. Porção, custo e CMV.
7. Entrega por CEP e região.
8. Salão: áreas, garçom, metas, sugestão de venda.
9. E-mail e recorrência (com consentimento).
10. Alertas de estoque e gargalo.
11. Página pública de cada restaurante pronta para Google, IA e WhatsApp (pré-renderizada, dados estruturados).

Em paralelo, antes de vender de verdade: teste real de Pix de R$ 1,00, domínio próprio, backup fora do servidor.
