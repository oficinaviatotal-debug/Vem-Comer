# Testar o Vem Comer no celular (guia do GD)

Escrito em 14/10/2026. Serve para o GD usar o Vem Comer de verdade no celular, achar o que está errado e passar para mim corrigir.

## O que está no ar hoje (conferido de fora em 14/10/2026, 08:55)

- Endereço: **https://srv2017596.hstgr.cloud** (nome da Hostinger; domínio próprio ainda não registrado).
- `/api/health` respondeu "ok" na versão `bc06bb10da7e`, a mesma do ramo `main` (PR #58, 13/10, 18h).
- `manifest.json` (instalável, `display: standalone`, ícones 192 e 512) e `sw.js` (aviso no celular) estão publicados.
- **Cadastro público fechado** (`/api/signup/status` diz `open: false`). Não consegui saber se já existe algum restaurante de teste:
  o servidor não tem lista pública de restaurantes, só a busca pelo endereço curto.
- Não conferi: tela por tela, voz, aviso no celular. Isso só se vê no aparelho.

## Passo 1: criar um restaurante de teste (uma vez, no servidor)

O cadastro por fora está fechado de propósito. Quem cria é o administrador, no terminal do servidor.

1. Abra o painel da Hostinger: https://hpanel.hostinger.com → VPS → o servidor `srv2017596` → **Terminal do navegador**
   (se o botão não aparecer no celular, abra o painel no computador ou me mande um print da tela).
2. Cole e aperte Enter: `bash /opt/vem-comer/app/deploy/vps/criar-restaurante.sh`
3. Ele pergunta nome do restaurante, endereço curto (ex.: `teste-gd`), seu nome, e-mail e senha (a senha não aparece). No fim mostra o resumo: digite `s`.
4. Anote o endereço curto e a senha. Para o painel: `https://srv2017596.hstgr.cloud/?entrar=1`

Alternativa: às 21h, no notebook, abra este chat no aplicativo Claude e mande uma mensagem; eu faço o passo 1 por lá.

## Passo 2: instalar no celular

- **Android (Chrome):** abra o endereço → toque nos **três pontinhos, no canto de cima à direita** → **Instalar app** (ou **Adicionar à tela inicial**) → **Instalar**. O ícone verde do Vem Comer aparece na tela inicial.
- **iPhone (Safari, iOS 16.4 ou mais novo):** abra o endereço no **Safari** → toque no ícone de **compartilhar** (quadrado com seta para cima, **embaixo, no meio**) → role e toque em **Adicionar à Tela de Início** → **Adicionar**. Só pelo ícone da tela inicial o aviso no celular funciona no iPhone.

## Passo 3: roteiro do teste (marque o que funcionou)

1. Entrar com o e-mail e a senha. O painel deve abrir na aba **Assistente**.
2. Tocar em **Falar o meu cardápio** e dizer: "X-tudo 25 reais, X-salada 22 e de bebida Coca lata 6". Conferir os três pratos e preços e **Cadastrar**.
3. Ver o cardápio pronto; corrigir um preço falando ("não, o X-tudo é 26").
4. Criar duas mesas, abrir o link ou QR de uma mesa em outro celular e pedir como cliente (adicionar, ver pedido, enviar com Pix).
5. No painel do dono: receber o pedido, mudar o estado, tocar em "Pagamento recebido".
6. Permitir as notificações e pedir de novo com o aplicativo **fechado**: o aviso chegou?
7. Aba **Custos**: cadastrar um insumo e montar uma ficha falando.
8. Pedido de **entrega** com CEP (se o restaurante ligou a entrega).
9. Tocar em **Guia** e ver se a voz e o piscar acompanham.

**Ainda não funciona (não é erro seu):** foto do cardápio com IA (falta a chave paga), conversa de atendimento no portal, Pix automático, cobrança (desligada), melhoria de foto calibrada.

## Como me contar um erro (copie e preencha)

```
Tela e aba:
O que eu fiz (passo a passo):
O que aconteceu:
O que eu esperava:
Hora aproximada:
Celular e navegador (ex.: Android, Chrome):
Print ou gravação de tela: (anexe)
Atrapalha o uso? (não deixa pedir / incomoda / só estético)
```

Um erro por mensagem, com o print. Eu repito no meu lado, corrijo, testo e digo qual versão contém a correção.

## Fica para depois: testar o visual novo em celular de verdade (Android e iPhone)

Pedido do GD em 23/10/2026, 21:22: "Em relação aos testes, coloque junto com as outras pendências que faremos depois." **Nada abaixo foi feito ainda**, e o que foi conferido até aqui foi num navegador de computador com microfone de teste (`docs/acessibilidade.md` e `docs/front-end-novo.md`). O visual novo (`?novo=1`) só deve ir ao ar depois deste roteiro, e depois do "pode" do GD.

Quando o GD puder, com **um Android (Chrome) e um iPhone (Safari)**, na ordem em que mais pode dar errado:

1. **Voz.** Falar em português de verdade, em cozinha com barulho e em sala calma: preço ("vinte e cinco reais", "dezoito e cinquenta"), horário ("de segunda a sexta das 11 às 15 e das 18 às 23"), prato esgotado ("acabou o pastel de carne"), nome de tela na bolinha ("pedidos", "mesas"), "desfazer", "sim" e "não". Anotar o que o aparelho **não** entendeu para eu afinar as listas de palavras (`service/spokenHours`, `assistant/voiceIO`, `novo/voice`). No iPhone, conferir se o microfone existe no Safari e o que a tela faz quando não existe (deve mostrar só os botões, sem erro).
2. **Microfone e permissão.** O pedido de permissão aparece na hora certa? Se a pessoa negar, a tela explica e continua tocável? Funciona com o aplicativo instalado na tela inicial?
3. **Campo de hora.** O seletor de hora do aparelho (12 h ou 24 h, rodinha ou teclado) deixa preencher "11:00" e "22:30" sem erro? Os dois turnos cabem na tela?
4. **Teclado em cima dos botões.** Com o teclado aberto, **Salvar**, **Cadastrar** e **Enviar o pedido** continuam à vista ou o teclado cobre? A barra de baixo respeita o "queixo" do iPhone e a barra do Android?
5. **Leitor de tela de verdade.** TalkBack (Android) e VoiceOver (iPhone), nas telas principais: cardápio do cliente, sacola, acompanhar o pedido, Hoje, Pedidos, Cozinha, Pratos, Horário. A ordem faz sentido? Os avisos (pedido novo, erro, "salvo") são lidos sozinhos? O código de entrega é lido por inteiro?
6. **Letra grande.** Aumentar o texto do aparelho ao máximo (Android: Tamanho da fonte; iPhone: Texto maior) e passar pelas mesmas telas: algo rola de lado ou fica cortado?
7. **Instalar na tela inicial e aviso.** Pedir de novo com o aplicativo **fechado**: o aviso chegou? A cozinha vibra e apita pedido novo (o iPhone não vibra pelo navegador, e a tela deve continuar avisando de outro jeito)?
8. **Foto e câmera.** Cardápio por foto, foto do prato, logomarca: abrir a câmera e a galeria, foto grande (5 a 10 MB), foto de lado. Demora? Aparece o que está acontecendo?
9. **Copiar e abrir outro aplicativo.** Copiar o código Pix, ligar para o restaurante (`tel:`), abrir o WhatsApp, compartilhar o link do cardápio.
10. **Celular simples.** Em um Android de entrada (2 a 3 GB), as telas abrem rápido? A rolagem trava? As peças em relevo (3D) pesam?
11. **Sol forte e mão suja.** Na rua (entregador) e na cozinha: dá para ler com o brilho baixo? Os botões acertam com o dedo molhado ou engordurado?
12. **Rede ruim.** Com o sinal indo e voltando, o pedido sai duas vezes? As mensagens de erro dizem o que fazer?
13. **Cartão do prato (tela Meu link).** Escolher um prato com foto e outro sem: o cartão aparece em poucos segundos? *Mandar o cartão* abre o menu de compartilhar com a imagem e o texto, e o Instagram (feed) e o status do WhatsApp **aceitam a imagem sem cortar o nome nem o preço**? *Baixar a imagem* guarda na galeria (Android) ou em Arquivos (iPhone)? *Copiar o link* funciona sem pedir permissão, e quando o aparelho recusa o texto aparece marcado? A foto grande (5 a 10 MB) deixa o celular lento ao montar o cartão? O texto do cartão em *Status* fica longe dos botões que o Instagram põe em cima e embaixo?
14. **Tela Vendas (só o dono do sistema).** Com o servidor de vendas no ar: o rascunho do primeiro contato aparece para um negócio com WhatsApp e *Abrir o WhatsApp com a mensagem* abre o aplicativo **com o número e o texto prontos, sem enviar**? *Abrir o e-mail* abre o programa de e-mail com o assunto e o texto? *Ligar* abre o discador? *Copiar a mensagem* funciona sem pedir permissão (e, quando o aparelho recusa, o texto aparece marcado)? *Já mandei* anota **um** contato mesmo com sinal ruim e dois toques? *Anotar um negócio*: colar um anúncio, **falar** o anúncio com o microfone, e conferir se *Separar os contatos* acha o telefone? O formulário cabe com o teclado aberto, e *Guardar o negócio* continua à vista?

**Como me contar:** o mesmo modelo de erro acima (um erro por mensagem, com print). Quando o GD me mandar "testei o item 3 e deu certo", eu risco aqui. Os itens 1 e 5 são os que mais podem mudar o desenho; o 13, o cartão; o 14, a tela Vendas.
