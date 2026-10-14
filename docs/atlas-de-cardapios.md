# Atlas de cardápios: da carrocinha ao restaurante de 100 mesas

Criado em 14/10/2026, a pedido do GD: "pesquisar em todos os estilos de cardápio, em todos os segmentos, para a gente
fazer o melhor possível, que se adapta a todos". Este documento serve a três coisas: (1) saber o que o sistema precisa
entender de um cardápio, (2) dizer, sem enfeite, o que o modelo atual já cobre e o que não cobre, (3) dar à leitura
por foto uma lista de cardápios reais para ser testada assim que a chave de IA for instalada.

Primeiro a regra do projeto (promessa do GD, 14/10): **falar sempre a verdade**. Por isso cada afirmação abaixo vem
marcada:

- **[P1]…[P8]**: eu vi no print do Google que o GD mandou em 14/10/2026 (arquivos `google-cardapios-01…08` em
  `docs/referencias-visuais/`). **[Alô]**: a foto do cardápio real de salgados (`cardapio-real-alo-coxinha-salgados-20261014.jpg`).
- **[S]**: li no site do concorrente em 14/10 (endereços no fim).
- **[E]**: conhecimento meu do mercado, **não conferido hoje**. Vale como hipótese, não como fato.

Limite da pesquisa: os prints do Google são modelos, anúncios e cardápios de internet, quase todos com letra pequena.
Servem para ver **como os cardápios se organizam**, não para medir o tamanho do mercado. Cardápio de cliente de
verdade, fotografado no balcão, ainda não tenho (pedido no fim).

---

## 1. Em uma página

1. **Não existe "o cardápio". Existem uns 14 jeitos de montar um preço**, e quase todo negócio mistura três ou
   quatro deles. O sistema não pode ser feito por segmento; tem que ser feito por jeito de preço. O segmento só
   ajuda a sugerir o ponto de partida.
2. **Cada tamanho e cada sabor é um produto de verdade**: "Coca-Cola 200 ml", "1 L", "2 L", "Zero" e "Light" têm
   preço, custo, CMV, estoque, código, peso e foto próprios. É assim que o sistema já é (a ficha técnica e o CMV são por
   produto) e é assim que a leitura por foto já cadastra ("Calabresa (G)" e "Calabresa (Broto)" são dois produtos).
   *Correção de 14/10:* a primeira versão deste atlas recomendava juntar os tamanhos num produto só, com o preço
   somando diferença. Isso estava errado: apagaria o custo, o CMV e o estoque de cada tamanho. O GD apontou o erro e
   a recomendação foi tirada. O que os concorrentes mostram na tela [P6][P7] é só **aparência**: um cartão com
   botões de tamanho. Por baixo, cada tamanho continua com os seus números.
3. **Descrição embaixo do nome, subseção e foto por produto são o padrão.** Descrição e subseção entraram hoje (PR #64).
   Foto por produto a tela do cliente já mostra; falta o jeito fácil de o dono colocar (uma foto por prato, na hora).
4. **A primeira pergunta não deve ser "qual o seu segmento".** Deve ser "como você quer cadastrar?" (foto, arquivo,
   falar, modelo). Foto e arquivo funcionam para qualquer segmento sem escolher nenhum. Segmento só aparece no
   caminho "modelo", com busca e voz (seção 6).
5. **A maior parte dos jeitos cabe no que já existe** (grupos de escolha com mínimo e máximo). O que falta de
   verdade é pouco, e está na seção 5 em ordem de valor.

---

## 2. Os jeitos de montar um preço

"Hoje" = o que o servidor e a tela do cliente já fazem (`item_options.py`, `menu_import.py`, `menu_templates.py`).

| # | Jeito | Exemplo visto | Hoje |
|---|---|---|---|
| J1 | Prato simples: nome e preço | Quase todos | **Cabe** |
| J2 | Descrição embaixo do nome (ingredientes) | Lanches numerados com ingredientes [P2]; pizzas doces [P3]; pratos "Picanha na manteiga: picanha grelhada, arroz, farofa e vinagrete" [P3] | **Cabe** (14/10, PR #64) |
| J3 | Subseção dentro da categoria | Bebidas > Sucos, Cremes, Destilados [P4]; Pizzas > Doces [P3] | **Cabe** (14/10, PR #64) |
| J4 | Tamanho com preço próprio | Porções P/M/G [P2]; Broto/Grande [P3]; Marmita mini/média/grande [P7]; Pizza Média/Grande/Família [P6]; copo 300/400 ml [P1] | **Cabe, do jeito certo:** cada tamanho é um produto (preço, custo, CMV, estoque, foto próprios). A leitura por foto e planilha já cria um produto por tamanho. Agrupar na tela do cliente (cartão com botões de tamanho) é só visual e ainda não existe |
| J5 | Escada de quantidade | "10 un. R$ 5,00 … 90 un. R$ 45,00, 100 un. R$ 45,00" [P2]; "R$ 49,90 o cento" [P3]; "R$ 85,00 o cento" [P5]; mini pastel "R$ 2,00" a unidade [P3] | Mesmo caso do J4: cada quantidade é um produto ("Salgado frito, 50 un.", "100 un."), com o custo da embalagem e do salgado dele. É como o cardápio da [Alô] já funciona |
| J6 | Escolher N sabores de uma lista | "Escolha até 4 sabores, mínimo 25 de cada" [P3]; "até 2 sabores" [P3]; "Até 2 sabores e 6 fatias / Até 3 sabores e 8 fatias" [P6]; "dois sabores 50/50" [Alô] | **Cabe em parte:** grupo "Sabores" com máximo 4 e preço extra zero. **Não cabe:** mínimo por sabor (vai na descrição) e meio a meio com preço pela média ou pelo mais caro |
| J7 | Montar em etapas | Sorveteria: casquinha/cascão/milkshake com 1, 2 ou 3 bolas → escolher sabores → coberturas "+R$ 2 cada" [P3] | **Cabe em parte:** 3 grupos (tamanho, sabores, coberturas com +2,00). **Não cabe:** o limite de sabores seguir o número de bolas (fica o máximo geral) |
| J8 | Adicional | "ADICIONAIS" (bacon, queijo, ovo…) [P4]; "Peça também" [P6] | **Cabe** (grupo opcional). Venda cruzada ("Peça também") **não existe** |
| J9 | Combo | "Combos mais pedidos": lanche + batata + refrigerante, com preço e foto [P8] | **Não cabe direito.** Dá para fazer um prato "Combo" com grupos "escolha o lanche" e "escolha a bebida", mas não referencia os pratos do cardápio |
| J10 | Número ou código do item | Lanches 01 a 19 [P2]; bebidas com "Cód." [P4] | **Não cabe.** Cliente que pede por número no WhatsApp e dono que tem planilha com código precisam |
| J11 | "Serve N pessoas" | "Serve 1 pessoa", "Serve 2 pessoas" [P4] | Só na descrição |
| J12 | Encomenda com antecedência | "Encomendar 2 dias de antecedência" [P3] | **Não cabe.** Horário de funcionamento existe; antecedência por produto não |
| J13 | Promoção "de/por" e destaque | Preço riscado R$ 49,90 → R$ 39,90 e vitrine "Destaques" [P6]; "Promoções" [P8] | **Não existe** |
| J14 | Cardápio por período | Café da manhã, almoço, happy hour [E]; Suitable tem "Disponibilidade" por categoria [S] | **Não existe** por categoria (só horário da loja e "esgotou") |
| J15 | Por peso, por pessoa | Self-service a quilo e rodízio [E]; Saipos fala de self-service com balança [S, a reconferir] | **Não existe** (preço é sempre por unidade) |
| J16 | Etiquetas e alérgenos | Vegano, sem glúten, picante [E] | **Não existe** |

O que os cardápios têm em comum, e vale para o desenho do aplicativo: **foto grande por produto, nome em destaque,
descrição curta, preço sempre visível, botão "+" sempre no mesmo lugar** [P6][P8]. As telas dos concorrentes que o
GD admira (Anota AI, Sischef, iFood) têm vitrine "Destaques" com foto no topo, abas de categoria que rolam de lado, e
um carrinho que aparece no rodapé [P6][P8].

---

## 3. Segmento por segmento

Para cada um: como o cardápio costuma ser montado, e o que o dono precisa decidir. A coluna de evidência diz de onde
veio. "Modelo" = já existe modelo pronto no cadastro (`menu_templates.py`: lanchonete, pizzaria, restaurante, bar,
açaí, padaria, churrasco, japonês). Os demais não existem ainda.

| Segmento | Jeitos (seção 2) | Evidência | Modelo |
|---|---|---|---|
| **Carrocinha, barraca, ambulante** (pastel, espetinho, caldo de cana, cachorro-quente) | J1, J4. Cardápio de 5 a 15 itens, sem foto, preço redondo | [E]. "Menu Lan" tem pastéis a R$ 15 e porções P/M/G [P2] | Não |
| **Salgados avulsos e de festa** | J1, J5, J6, J12 | Escada por unidade [P2], cento com sabores [P3][P5], foto real [Alô] | Não |
| **Lanchonete, sanduíches, hamburgueria** | J1, J2, J8, J9, J10 | Numerados com ingredientes [P2]; combos [P8]; adicionais [P4] | Sim (lanchonete) |
| **Pastelaria** | J1, J4, J6 (mini pastéis até 4 sabores) | Pastéis e porções P/M/G [P2]; mini pastéis R$ 85 o cento [P5] | Não |
| **Pizzaria** | J2, J4, J6, meio a meio, bordas, pizza doce | Broto/Grande com ingredientes [P3]; Média 2 sabores e 6 fatias, Grande 3 sabores e 8 fatias [P6]; Goomer e Suitable (abaixo) | Sim |
| **Marmitaria, comida caseira, PF** | J4, J2, prato do dia | Marmita mini R$ 12 / média R$ 16 / grande, "mistura e acompanhamento à sua escolha" [P7]; pratos principais e porções [P3] | Parte (restaurante) |
| **Self-service, quilo** | J15 | [E] | Não |
| **Restaurante à la carte (até 100 mesas)** | J1, J2, J3, J11, mesas e garçom | Entradas, saladas, pratos "serve 2 pessoas" a R$ 59,90 a R$ 89,90 [P4] | Sim |
| **Café da manhã, cafeteria, padaria** | J1, J9, J14 | [E] | Sim (padaria) |
| **Bolos, tortas, doces, brigadeiro** | J4 (fatia/inteiro/kg), J12 | [E]. "Bolo no pote", "Brownie" em "Doces/Sobremesas" [P1] | Não |
| **Sorveteria, milkshake** | J4 (bolas), J6, J7 | Casquinha/cascão/milkshake de 1 a 3 bolas, 14 sabores, 7 coberturas a +R$ 2 [P3] | Não |
| **Açaí e sucos** | J4 (300/400/500 ml), J7, J8, J9 | "300 ml / 400 ml" no painel Anota AI [P1]; açaiteria com copos e combos com foto [P7][P8] | Sim (açaí) |
| **Bar, petiscos, tira-gosto, porções** | J1, J4, J3 | Tira-gosto R$ 18 / 28 / 35 e adicionais [P4]; porções P/M/G [P2] | Sim (bar) |
| **Cervejas, drinks, destilados** | J1, J3, J10 | Lista com código, subseções e dose/garrafa [P4]; drink menu com descrição [P4]; cervejas [P5] | Parte (bar) |
| **Churrasco, espetinhos** | J1, J4 | [E] | Sim |
| **Japonês** | J9 (combos de peças), rodízio (J15) | Sushi delivery com foto por peça [P7] | Sim |
| **Crepe, waffle, doces montados** | J7 | [E] | Não |
| **Comida regional** (tapioca, cuscuz, carne de sol, baião) | J1, J7 (recheios) | [E] | Não |
| **Hotel, pousada** | J1 + vários idiomas | Menuart mostra bandeiras de vários países para trocar o idioma [P1]; Economy Software tem "Cardápio digital para hotéis" [P8] | Não |
| **Buffet e eventos** | por pessoa, orçamento | [E]. Fora do escopo agora | Não |

### Pizzaria: o que os concorrentes fazem (lido em 14/10)

- **Goomer** [S]: uma pizza usa **dois grupos**. Um auxiliar, escondido, com o prefixo "[G]", onde ficam todos os sabores,
  cada um com tamanho e preço; e um principal, visível, onde se escolhe "2 ou 3 sabores". O preço do meio a meio é
  calculado por **"valor médio"** ou **"valor da mais cara"**, e tem que bater com o sistema de gestão do
  restaurante. O nome do tamanho tem que ser escrito igual em todos os produtos (ponto frágil: erro de digitação quebra
  o cardápio).
- **Suitable** [S]: a categoria tem um **tipo "PIZZA"**, depois os tamanhos, depois etapas opcionais (**massa, borda,
  complemento**), cada uma com preço extra; existe a opção **"cobrança pelo maior valor"**; e a categoria tem
  **"Disponibilidade"** (quando pode ser pedida). O texto que li não explica como os sabores são cadastrados.

Lição: os dois concorrentes tratam pizza como **um tipo especial**, e só quem monta o cardápio à mão aguenta isso. Para
o Vem Comer, a leitura por foto tem que entregar a pizza já montada: um produto para cada sabor e tamanho
("Calabresa Broto", "Calabresa Grande"), cada um com o seu custo e CMV; o meio a meio vira uma **regra de preço da
categoria** (média ou mais caro, escolhida uma vez), e borda e massa viram adicionais.

---

## 4. Foto: uma por produto

Pedido do GD (14/10, 09:42): "tem que ter uma imagem para cada produto. Não pode ser uma imagem e vários valores
distintos."

Regras para o desenho:

1. **Cada produto tem a sua foto.** "Produto" é cada linha que se vende: Coca-Cola 2 L, Coca-Cola Zero, Calabresa Broto,
   Calabresa Grande. Na [Alô], o que o cardápio mostra é a lista de produtos com preço (Salgado de festa um sabor 100 un.,
   Pastéis fritos 50 un., Empadas…), e cada linha pede a sua foto, não uma foto só para "Salgados de festa". Se um
   produto ainda não tem foto, a tela pode mostrar a de outro tamanho do mesmo produto, mas isso é uma escolha do dono, nunca
   automática, e só quando o desenho de agrupar tamanhos existir (seção 5, item 9).
2. **Nunca foto inventada.** O sistema não gera foto de comida nem usa foto de banco de imagens: o cliente vê no prato
   o que o dono vende. Quem não tem foto aparece com um espaço marcado "sem foto ainda", como no painel do
   Anota AI [P1], e a conferência lembra o dono.
3. **O caminho fácil da foto:** depois de cadastrar, o assistente pergunta "quer tirar a foto de cada prato agora?" e
   abre a câmera **um prato por vez**, mostrando o nome, com "pular" sempre à mão. Já existe a foto de prato com
   melhoria automática (`fotos-dos-pratos.md`); falta esse laço no assistente.
4. **Foto que já está no cardápio** (alguns cardápios têm foto por item): ideia a testar, **não prometida**. A leitura
   teria que devolver a posição de cada foto para recortar. Só entra se o teste com cardápios reais mostrar que funciona.

---

## 5. O que falta no modelo, em ordem de valor

Critério: quantos segmentos da seção 3 destravam, dividido pelo tamanho da mudança. Nada aqui exige banco novo nem
motor novo: são campos e regras em cima de `products` e dos grupos de opções que já existem.

| Ordem | Mudança | Destrava | Tamanho |
|---|---|---|---|
| 1 | **Ficha completa do produto:** código do produto (`code`), código de barras (`barcode`), unidade (un, kg, L), peso ou volume líquido (`net_qty` + g/ml/un) e NCM. Tudo opcional, na migração 018. A leitura passa a preencher o código quando o cardápio é numerado (lanches 01 a 18 [P2]) e o peso/volume quando o nome diz ("2 L", "300 ml") | Todos: o dono que tem planilha com código, balança, bar com bebida de vários tamanhos (J10, J15) | Pequena |
| 2 | **Dados fiscais por produto** (CEST, CFOP, CST/CSOSN e origem), **sem** calcular nada. Calcular imposto e emitir nota fiscal depende do regime de cada restaurante e de um serviço de emissão: é um módulo à parte, com o contador | Prepara a nota fiscal sem prometer o que só o contador pode definir | Pequena para guardar; grande para emitir |
| 3 | **Foto por prato, um de cada vez, no assistente** | Todos (seção 4) | Média (só tela) |
| 4 | **Preço "de/por" e destaques**, mais "Peça também" no carrinho | Aumenta o ticket em todos (J13, J8) | Média |
| 5 | **Meio a meio** com regra por categoria (média ou mais caro) e mínimo por sabor | Pizzaria, salgado de festa (J6) | Média |
| 6 | **Disponibilidade por categoria e antecedência** (café da manhã, almoço, "encomendar 2 dias antes") | Café, bolos, salgados de festa (J12, J14) | Média |
| 7 | **Combo que referencia pratos do cardápio** | Lanchonete, açaí, japonês (J9) | Média a grande |
| 8 | **Preço por quilo e por pessoa**, etiquetas de alérgeno | Self-service, rodízio, restaurante (J15, J16) | Média |
| 9 | **Agrupar na tela do cliente** (um cartão "Coca-Cola" com botões 200 ml, 1 L, 2 L, Zero), só visual, por um campo de família; cada botão é o produto com os seus números | Bebidas, pizzas, marmitas: lista mais curta para o cliente | Média |
| 10 | **Limite de sabores que segue a escolha anterior** (3 bolas = 3 sabores) | Sorveteria (J7) | Média |
| 11 | **Foto na opção** (cada sabor de salgado, de sorvete ou de pizza com a sua foto na hora de escolher) | Salgado de festa, sorveteria, pizzaria | Média |

Os itens 1 e 2 são pequenos, não mudam nada do que já funciona e completam a ficha do produto como o GD pediu (código,
código de barras, NCM, peso, unidade). São os próximos a construir, antes do meio a meio.

---

## 6. Como o dono escolhe o segmento (a pergunta do GD: botão para cada um, falar, ou escolher?)

Recomendação: **os três, mas só no caminho "modelo", e nunca como primeira pergunta.**

1. **Primeira tela: "Como você quer cadastrar o seu cardápio?"** Quatro entradas grandes, nesta ordem: **Foto** (abre a
   câmera na hora), **Arquivo** (planilha, PDF, o que alguém fez no Canva), **Falar**, **Começar de um modelo**. Foto e
   arquivo não perguntam segmento: a IA lê e descobre sozinha o que o negócio vende.
2. **Só em "Começar de um modelo"** aparece a escolha do segmento: caixa de busca com microfone no topo ("tapioca",
   "marmita", "bolo", "pastel") e, abaixo, as figuras dos segmentos mais comuns. A busca aceita sinônimos:
   "pastel" leva a Pastelaria; "marmita" a Marmitaria. Quem não achar o seu diz em voz alta o que vende e a IA monta a lista.
3. **Os 20 ou mais modelos** da seção 3 viram a lista do passo 2. Hoje são 8.
4. Currículo e vaga seguem o mesmo desenho: **Foto, Arquivo, Falar, Modelo**. Para vaga, "foto" é o print do anúncio.
   O que faltar, o sistema pergunta, um item de cada vez.

---

## 7. Testes de aceitação para a leitura por foto

Quando a chave de IA estiver instalada, estes são os cardápios para testar. Para cada um, o resultado esperado.
**Os prints do Google têm letra pequena: o teste de verdade usa a foto original que o dono tira no balcão.** Estes
servem para conferir a estrutura. Onde o preço não dá para ler, o certo é **deixar vazio e perguntar**, nunca chutar.

| # | Cardápio | Resultado esperado |
|---|---|---|
| T1 | Salgados em escada, "Petisco" [P2] | Um produto por quantidade ("Salgado frito, 10 un." R$ 5 … "100 un." R$ 45), com os sabores na descrição (coxinha, pastel de carne, bolinha de queijo, risole, travesseiro, enrolado de salsicha) |
| T2 | "Skina dos Salgados" [P3] | Salgado de festa R$ 49,90 o cento, 7 sabores, "até 4 sabores, mínimo 25 de cada". Assados/esfihas R$ 65,00 o cento, 7 sabores, "até 2 sabores", **antecedência de 2 dias**. Mini pastéis R$ 2,00 a unidade, 5 sabores. Horário: segunda a sábado 08h às 20h30, domingo 09h às 13h30 |
| T3 | Sorveteria [P3] | Casquinha, Cascão e Milkshake, cada um com 1, 2 ou 3 bolas a R$ 5, R$ 8 e R$ 10; 14 sabores; 7 coberturas a +R$ 2 cada |
| T4 | Pizzas doces, Broto e Grande [P3] | Dois produtos por sabor ("Banana nevada (Broto)" R$ 45, "Banana nevada (Grande)" R$ 55 e assim por diante), com os ingredientes na descrição de cada um |
| T5 | Comida caseira [P3] | Categorias Porções, Pratos principais e Bebidas; descrição de cada prato principal (ex.: picanha, arroz, farofa e vinagrete); preço R$ 20 em todos (o modelo repete o preço) |
| T6 | Lanches numerados "Ops!" [P2] | 18 lanches visíveis (o print corta a lista) com **código** 01 a 18 e ingredientes na descrição. Os preços aparecem em branco no print: o resultado esperado é preço vazio e a pergunta ao dono |
| T7 | Bebidas de bar com código [P4] | Categoria Bebidas com subseções (Sucos, Cremes, Destilados…), código do item, preço de cada. Com letra pequena, devolver "não deu para ler" nos itens duvidosos em vez de chutar |
| T8 | Marmita mini/média/grande [P7] | Três produtos ("Marmita mini" R$ 12, "Marmita média" R$ 16, "Marmita grande" sem preço legível), todos com a descrição "arroz, feijão, mistura e acompanhamento à sua escolha" |
| T9 | Salgados de festa [Alô] | O que já foi provado em teste simulado (`RealMenuExampleTests`): 13 itens com a quantidade no nome, 5 bebidas, Açaí sem preço (coberto por fita), nota sobre o painel cortado. Falta só a leitura real |
| T10 | Mini pastéis a R$ 85 o cento, "até 4 sabores" [P5] | Produto "Mini pastéis (cento)" R$ 85, com os 5 sabores na descrição e a regra "até 4 sabores" na descrição até existir o grupo de sabores |

---

## 8. O que eu preciso do GD

1. **3 a 5 fotos tiradas por você de cardápios de verdade, de cada segmento que você conhece** (a pastelaria da
   esquina, a marmitaria, a padaria…): fotografadas no balcão, não da internet. É com elas que se prova a leitura. Não
   precisa ser de cliente; vale o do vizinho.
2. **Dizer quais segmentos vêm primeiro.** Minha proposta: os que mais aparecem na sua conversa, **salgados, lanches,
   pizzas, marmita, açaí, bar**. Pode trocar.
3. **O sinal verde para os itens 1 e 2 da seção 5** (código, código de barras, NCM, unidade e peso/volume por produto;
   dados fiscais guardados, sem calcular imposto). E confirmar se "KNAI" é o NCM.
4. **O contador** (quando você quiser chamar): define o que entra na nota fiscal de cada tipo de restaurante (MEI,
   Simples…). Sem ele, o sistema só guarda os campos.

---

## Fontes

- [Goomer: Pizzas para cardápio digital em tablet (central de ajuda)](https://ajuda.goomer.com.br/cardapio-digital/painel/cardapio/cardapio-principal/criar-pizza/pizzas-para-cardapio-digital-em-tablet) [S], lido em 14/10/2026
- [Suitable: Cardápio para pizzarias](https://intercom.help/suitableapp/pt-BR/articles/5978580-cardapio-para-pizzarias) [S], lido em 14/10/2026
- [Saipos: sistema para restaurante self-service](https://saipos.com/sistema/restaurante-self-service) e [Saipos: cardápio de pizza](https://saipos.com/cardapio/cardapio-de-pizza): páginas dos concorrentes. A leitura de self-service com balança e dos cardápios de bar foi feita antes, nesta sessão, e **não foi reconferida hoje**; por isso J15 está marcado como "a reconferir".
- Prints do GD de 14/10/2026: `docs/referencias-visuais/google-cardapios-01…08` e `cardapio-real-alo-coxinha-salgados-20261014.jpg`.
- Código atual: `backend/item_options.py` (grupos de escolha), `backend/menu_import.py`, `backend/menu_photo.py`, `backend/menu_file.py`, `backend/menu_templates.py`; documentos `opcoes-por-item.md`, `cardapio-por-foto.md`, `cardapio-assistido.md`.
