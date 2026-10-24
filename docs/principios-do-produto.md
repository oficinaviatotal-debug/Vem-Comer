# Princípios do produto (Vem Trabalhar e Vem Comer)

Ditados pelo GD em 14/10/2026 (08:01 e 08:24). Valem para os dois ecossistemas e para tudo o que for construído daqui para frente.
Quando uma proposta ou um código brigar com um destes pontos, ele perde.

## 1. O portal é a casa; os outros canais são portas

Tudo acontece **dentro do portal**: conversa, atendimento, cadastro, pedido, vaga, curso. WhatsApp, e-mail, Telegram e
Instagram servem para **trazer a pessoa e avisar**. Mesmo quando um canal externo for usado, a função dele é levar para
dentro do ecossistema, onde a pessoa vê tudo o que existe.

- Toda mensagem que sai leva um **link que abre a tela certa, já preenchida** (a vaga, o pedido, o curso, o cardápio).
- A prévia do link no WhatsApp e no Instagram é bonita e diz em uma frase o que a pessoa vai encontrar.
- Conversa dentro do WhatsApp só se um dia valer a pena, e só quando a pessoa escreve primeiro (API oficial, CNPJ
  verificado, custo por mensagem). Não é o caminho principal.
- Mensagem fora do portal continua só com aceite, com como sair e com os freios do banco de comunicação (proposta 003).

## 2. Voz primeiro, botão depois, texto por último

- O mínimo de escrita e o máximo de comando de voz. Quem não sabe ler ou escrever usa o sistema inteiro.
- A voz precisa ser **audível** e funcionar em qualquer aparelho, inclusive o Android simples e o sinal fraco.
- Toda resposta tem um **botão grande** que faz a mesma coisa. Teclado é a última opção.
- **Regra de entrada (GD, 22/10/2026, 19:10: "tudo tem que ter entrada por comando de voz, entrada escrita ou entrada por foto").** Tudo que o
  sistema recebe da pessoa tem de poder entrar por **voz**, por **escrita** ou por **foto**, e quem escolhe é ela. Tela que só tem toque, ou que oferece um
  só caminho onde os outros fazem sentido, está incompleta. Foto vale onde há o que fotografar (cardápio, prato, logomarca, QR da mesa); nos outros lugares
  valem a voz e a escrita.

## 3. Conversa que entende, nada de robô de menu

Não é "digite 1 para…". A IA entende a fala solta, lembra o que a pessoa já disse, **pergunta só o que falta**, mostra o
que entendeu e pede a confirmação com um toque. Cada tela faz uma pergunta. A resposta vira ação (cartão, aba,
botão), não parágrafo. Chatbot mecânico e burro já não é suportável.

## 4. Tudo à vista, com abas, cores e botões

Nada escondido: preço, regra, passo seguinte. Aba para cada área, cor que significa algo, botão com verbo. Rápido,
fluido, objetivo, sem cansar.

**Quem toca, sobe; quem informa, fica liso.** Botão tem espessura e afunda no toque (impressão de 3D, pedido do GD em
22/10/2026); informação fica rente ao chão. Em tela de compra, o cartão inteiro é o botão: o caminho do pedido tem de
ter o menor número de toques possível, e nada que parece botão pode ser mudo.

## 5. Capta informação sem interrogar

Cada interação alimenta o perfil e os dados (com aceite). A pessoa não preenche formulário: conversa, fala, tira foto,
manda arquivo, e o sistema organiza. Dado conferido na entrada (preço, CPF/CNPJ, telefone, CEP).

## 6. Vivo, que desenvolve a pessoa

O sistema ensina e sugere o próximo passo (curso, ajuste no currículo, prato, preço). Humano, vivo, fácil e que gera
resultado.

## 7. Automático ao máximo, o dono autoriza o que pesa

Agentes e aprendizado rodando 24 horas, renovando o sistema todo dia. Ação de maior impacto pede a autorização do GD
(lista na proposta 004).

## 8. O sistema conversa: diz o que fazer, como fazer, o que falta e o que ficou por fazer

Ditado pelo GD em 22/10/2026, 20:31: o sistema "sempre tem que se comunicar com o cliente e com o empresário, orientando o que fazer, como fazer, o que
falta, o que deixa de fazer. Tem que ser sempre algo vivo, comunicativo, fácil, intuitivo e que dialogue com as pessoas que vão utilizar".

- **Toda tela responde quatro perguntas** sem a pessoa precisar procurar: o que faço agora? como faço? o que falta? o que ficou por fazer? A resposta é uma
  frase curta e um **botão que leva ao lugar certo**, não um manual.
- **Só se diz o que o sistema sabe de verdade.** "Falta" nasce de um dado que o servidor confirmou; busca que falhou não vira "falta", e quando nada falta o
  sistema não finge que está tudo pronto, só não diz nada.
- Vale para o dono (o que falta para vender: cardápio, Pix, mesas, fotos) e para o cliente (em que passo o pedido está, o que ele precisa fazer, quanto falta).
- Erro também conversa: diz o que aconteceu e o que fazer, sem culpar a pessoa.

## Como a pessoa chega: link que vira ícone (proposta, aguarda o OK do GD)

Pergunta do GD (14/10, 08:25): só o link, link sempre no ar, ou baixar aplicativo? O link pode virar ícone na tela inicial com notificação?

**Proposta: portal na web que se instala como aplicativo (PWA).** É um endereço sempre no ar (fica no servidor, com backup
diário e atualização automática); a pessoa toca em "Instalar" ou "Adicionar à tela inicial" e ele vira um **ícone**, abre
em tela cheia e recebe **notificação** com o aplicativo fechado.

| | Link com ícone (PWA) | Aplicativo de loja |
|---|---|---|
| Código | um só, para todos os aparelhos | um por sistema, ou um embrulho do mesmo portal |
| Atualização | na hora, para todo mundo | depende da pessoa atualizar e da revisão da loja |
| Entrada | toca no link recebido no WhatsApp ou e-mail | procura na loja, baixa, abre |
| Notificação | sim, pelo navegador, sem custo por mensagem | sim |
| Custo e prazo | nenhum de loja | conta de desenvolvedor, revisão e regras das lojas |

- **Android (Chrome):** instala e recebe notificação direto.
- **iPhone:** só depois de "Adicionar à Tela de Início" e de abrir pelo ícone (iOS 16.4 ou mais novo). Não há aviso automático
  de instalação: a tela precisa **mostrar, com seta, onde tocar**.
- **O Vem Comer já é assim:** tem `manifest.json` com ícones e tela cheia, `sw.js` e notificação com o app fechado
  (`docs/aviso-no-celular.md` do Vem Comer). Provado com servidor de mentira; **falta o teste num Android de verdade**, e o aviso
  para o cliente final ainda não foi ligado.
- O Vem Trabalhar novo nasce do mesmo jeito. O aplicativo de loja, se vier, é um embrulho do mesmo portal (nada é refeito) e
  entra só depois de uso real.
- A notificação é por aceite da pessoa, e o e-mail é o aviso de reserva para quem não instalou.

## O que isto muda no que já está escrito

| Onde | Antes | Agora |
|---|---|---|
| Vem Trabalhar, candidato pelo WhatsApp (Vivagas como referência) | Conversa e currículo dentro do WhatsApp | O link da vaga abre a vaga no portal; a conversa, a voz e o currículo acontecem lá |
| Vem Comer, requisito 69 (d) | Atendimento por conversa no WhatsApp | Balão de conversa dentro do portal, na página do restaurante; o WhatsApp leva o cliente até lá |
| Custo | WhatsApp oficial por mensagem | Custo do canal só no aviso; a conversa no portal não paga mensagem à Meta |
| Proposta 003 (captação) | Link para criar a primeira vaga por voz | Igual: já era portal primeiro |

## Riscos que ficam de olho

- **Quem não abre link.** Parte do público só vive no WhatsApp. Medir quantos abrem o link e, se for pouco, testar a
  conversa curta dentro do WhatsApp (só quando a pessoa escreve primeiro) como porta, sempre terminando no portal.
- **Portal lento é pior que WhatsApp.** A primeira tela precisa abrir em poucos segundos no 4G fraco; isso entra nas metas
  de qualidade.
