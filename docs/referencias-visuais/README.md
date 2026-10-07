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

- O laranja da prancha (`#FF6F00`) é o mesmo do aplicativo (`--brasa-viva`, em `frontend/src/styles.css`).
- Os verdes diferem: o aplicativo usa `--mata #1E6B3C` e `--folha #123B2B`; a prancha manda `#2E7032` e `#1B4332`.
- O laranja `#FF6F00` sobre branco tem contraste de uns 2,8 para 1. Não serve para texto, nem para botão de letra
  branca. Fica para destaque, foco e ícone; o botão cheio continua em `--brasa #C2410C`.
- Proposta para a reforma visual: adotar `#2E7032` como verde principal, `#1B4332` como apoio escuro e `#FAE9D2`
  como fundo de apoio, mantendo o botão cheio em `--brasa`. O GD confirma antes de mexer nas cores.
- As peças da prancha 3 (ícone, selo, versão circular, horizontal) vêm numa imagem só. Para usar no aplicativo,
  precisam dos arquivos originais, em PNG com fundo transparente ou SVG.
