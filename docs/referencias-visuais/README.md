# Referências visuais do GD

Três imagens que o GD mandou em 07/10/2026, às 13:21. Ficam aqui, no repositório, para não se perderem de novo
("nunca mais perca"). São referência de marca e de tela: o aplicativo é feito em código, não colado a partir delas.

## 1. `vem-trabalhar-logomarca-cartaz.jpg`

Cartaz da logomarca do Vem Trabalhar. Uma seta em forma de "play" azul, com um profissional correndo com uma maleta
sobre degraus de gráfico e prédios, um globo de conexões e quatro ícones redondos (pessoas, notebook, aperto de mão,
lupa). O nome é "VemTrabalhar®" (Vem em azul-marinho, Trabalhar em azul). O lema é "Conexões que transformam vidas".
Abaixo, cinco pilares (Vagas, Empresas, Talentos, Tecnologia, Resultados) e o botão "O seu próximo passo começa aqui".

## 2. `templates-principais-vem-comer-e-vem-trabalhar.jpg`

Prancha "Templates principais" (web, app, materiais, e-mail e QR code): Vem Comer à esquerda, Vem Trabalhar à direita.
Cada lado traz a tela de site no notebook e a de app no celular, o card (restaurante ou vaga), a página de venda, o QR
da mesa ou da empresa, o e-mail de marketing, a página do profissional, os QR codes por público e as aplicações
(mesas, embalagens, uniformes, redes sociais, anúncios, assinatura de e-mail, site e app).

Vem Comer, o que a prancha mostra:

- Início "Comida boa, mais perto de você!" com busca, chips de categoria (Pizzas, Hambúrguer, Sushi, Massas, Self
  Service, Saudável, Doces, Bebidas) e promoção "Combo Especial R$ 29,90".
- Card de restaurante com nota, distância e selos "Entrega", "Retirada" e "No local".
- Página de venda "Seu restaurante no próximo nível!" com o botão "Quero meu sistema".
- Cartaz de QR da mesa "Faça seu pedido aqui" e e-mail "As melhores ofertas da sua região!".
- Quatro QR codes: clientes, restaurantes, compra do sistema e divulgação geral.

**Decidido pelo GD (07/10, 13:27):** a busca "restaurantes na sua região" **não entra agora**. Cada restaurante divulga o próprio
link (WhatsApp, pessoas, QR na loja) e ele abre a loja dele. O catálogo geral só entra numa primeira atualização, depois de 3
meses e de mais de 100 restaurantes, bares e sorveterias por região (item 68 dos requisitos). Esta prancha vale, por enquanto,
pelas cores, pelos cartões, pelos chips e pelos materiais; a página inicial de catálogo fica de fora.

## 3. `vem-comer-identidade-visual.jpg`

Prancha de identidade do Vem Comer: logomarca completa (pin verde com cloche laranja e sorriso, linhas de velocidade,
"Vem Comer®" em letra cursiva e "Pedido fácil, comida que chega."), ícone, logotipo, versão horizontal, paleta,
tipografia, ícone de app, selo, QR oficial, versão circular, e as aplicações (fachada, embalagem, uniforme do
entregador, app, assinatura de e-mail, marca d'água, post e banner). A faixa final diz "Mais que comida, são momentos
que importam."

Paleta oficial, como está escrita na prancha:

| Cor | Código | Papel |
|---|---|---|
| Verde principal | `#2E7032` | confiança, saúde, crescimento |
| Laranja principal | `#FF6F00` | energia, apetite, movimento |
| Apoio | `#FAE9D2` | leveza, acessibilidade, equilíbrio |
| Apoio escuro | `#1B4332` | segurança, estabilidade, profissionalismo |

A tipografia principal é o script itálico da própria logomarca; a de apoio é uma fonte moderna e legível (a prancha
mostra "AaBbCc0123", sem dizer o nome).

## Como isso se liga ao código

Cores (adotadas na reforma visual de 07/10, em `frontend/src/styles.css`): `--mata #2E7032` (verde principal),
`--folha #1B4332` (apoio escuro), `--papel-2 #FAE9D2` (apoio) e `--brasa-viva #FF6F00` (laranja da marca).
O laranja `#FF6F00` sobre branco tem contraste de uns 2,8 para 1: não serve para texto nem para botão de letra branca.
Fica para destaque, foco e ícone; o botão cheio usa `--brasa #C74700`.

Peças da prancha "Templates principais" (lado do Vem Comer) e onde estão:

| Peça da prancha | Estado |
|---|---|
| Aplicativo do celular (cardápio, chips, cartões) | Feito na reforma visual de 07/10, sem a busca de restaurantes |
| Cartaz de QR da mesa "Faça seu pedido aqui" | **Feito em 13/10:** Painel > Mesas > "Cartaz para imprimir" (baixa a imagem ou imprime em A4) |
| Landing "Seu restaurante no próximo nível!" | **Feita em 13/10:** endereço `?sistema=1`, é o destino do QR "Para compra do sistema" |
| Início "Comida boa, mais perto de você!" e card de restaurante com nota e distância | Fora por decisão do GD (07/10, item 68): catálogo só depois de 3 meses e mais de 100 negócios por região |
| E-mail de marketing, QR codes por público, aplicações (uniforme, embalagem, redes sociais) | Material de divulgação, não é tela. Os endereços dos QR: clientes = link do restaurante; restaurantes = `?cadastro=1`; compra do sistema = `?sistema=1` |

As peças da prancha 3 (ícone, selo, versão circular, horizontal) vêm numa imagem só. Para usar no aplicativo
precisam dos arquivos originais, em PNG com fundo transparente ou SVG. Até lá o cartaz e a página de venda usam
`frontend/public/logo-vem-comer.png`.

O lado do Vem Trabalhar da mesma prancha, e o cartaz da logomarca azul, foram para o front-end do Vem Trabalhar
(repositório dele, `docs/front-end.md`).

## 4. `tela-assistente-planilha-gd-20261014.jpg`

Print que o GD mandou em 14/10/2026, às 09:26, do próprio celular (aparenta ser Android) já dentro do painel como "GD, Dono":
aba **Assistente**, "Passo 1 de 3 · Foto do cardápio", com o texto "Escolha a planilha do seu cardápio" e o botão
"Escolher a planilha". Mostra duas coisas: (1) o servidor no ar ainda não lê foto nem PDF, porque a chave de IA não está
ligada, então só aparece a planilha; (2) o título do passo dizia "Foto do cardápio" com a planilha na tela. O item (2) foi
corrigido no mesmo dia (`progressText` agora recebe o que o servidor lê).

## 5. `cardapio-real-alo-coxinha-salgados-20261014.jpg`

Foto do cardápio real da "Alô Coxinha" (salgados de festa, pastéis, empadas, pães, sonho de noiva, shakes e açaí), que
o GD mandou em 14/10/2026, às 09:29, como exemplo do que o sistema deve ler: "Se eu quiser mandar essa foto, você
cadastrar todos os produtos e já entregar o cardápio pronto." Tem pontos difíceis de verdade: preço escrito à mão por cima
do impresso, preço coberto por fita (Açaí), painel cortado na lateral, chamada de propaganda ("a partir de R$ 2,00") e
quantidade na linha ("100 un."). As lições estão no prompt de `backend/menu_photo.py` e no teste `RealMenuExampleTests`.

## 6. `google-cardapios-01…08-*-20261014.jpg`

Oito prints da busca de imagens do Google que o GD fez do próprio celular em 14/10/2026, entre 09:35 e 09:44, com o
pedido: "pesquisar melhor, em todos os estilos de cardápio, em todos os segmentos", "da carrocinha ao restaurante com
100 mesas". São modelos, anúncios e cardápios da internet, não clientes reais. Servem de referência de **estrutura**.
A análise, com o que cada um mostra, está em `docs/atlas-de-cardapios.md` (as marcas P1 a P8 do atlas são estes arquivos, na ordem):

| Marca | Arquivo | O que mostra |
|---|---|---|
| P1 | `google-cardapios-01-busca-anota-ai-olaclick-edicao-em-massa-…` | Anúncios do Anota AI e OlaClick, **painel "Edição em massa" do Anota AI** (itens com foto, "300 ml"/"400 ml - Cópia" sem foto, categorias Açaí, Aperitivos, Doces/Sobremesas), Menuart com categorias e troca de idioma |
| P2 | `…02-salgados-escada-lanches-numerados-pasteis-…` | Salgados a R$ 5 por 10 un. até R$ 45 por 100, lanches numerados com ingredientes, pastéis e porções P/M/G |
| P3 | `…03-sorveteria-salgados-de-festa-pizzas-doces-comida-caseira-…` | Sorveteria (bolas, sabores, coberturas +R$ 2), salgados de festa a R$ 49,90 o cento com "até 4 sabores, mínimo 25 de cada", pizzas doces Broto/Grande, comida caseira |
| P4 | `…04-bebidas-drinks-tira-gosto-saipos-…` | Cardápio com "serve 2 pessoas", tira-gosto e adicionais, bebidas com código e subseções, drink menu |
| P5 | `…05-bar-cervejas-mini-pasteis-cento-…` | Bar e cervejas, mini pastéis R$ 85 o cento "até 4 sabores", pack de hambúrguer |
| P6 | `…06-anota-ai-pizzas-destaques-peca-tambem-…` | App Anota AI: abas, "Destaques" com foto, preço riscado, "Pizza Média até 2 sabores e 6 fatias", "Peça também" no carrinho |
| P7 | `…07-marmita-acaiteria-saipos-whatsmenu-…` | Marmita mini/média/grande, açaiteria com foto, sushi delivery, mensagem de pedido no WhatsApp |
| P8 | `…08-sischef-combos-hotel-ifood-…` | Sischef (cardápio por QR com nota e tempo de entrega), combos com foto, cardápio para hotel, app do iFood |

Observação: o print da empresa de talentos droove.tech que veio junto está guardado no repositório do Vem Trabalhar
(`droove-alocacao-de-talentos-14-10.jpg`).
