# Assistente do cardápio (tela, voz e passos)

Aba **Assistente** no painel do dono (visível para dono e gerente). Serve para quem
tem pouco estudo ou pouca prática com celular: o assistente pergunta em voz alta, o
celular escuta sozinho a resposta (sem tocar a cada vez) e, no fim, o cardápio é
cadastrado de uma vez pela rota descrita em `docs/cardapio-assistido.md`.

Na primeira vez que o dono entra no painel sem nenhum prato cadastrado, esta aba abre
sozinha. Ao terminar, o botão **Continuar: mesas, Pix e pedidos** abre o guia.

## Falar o cardápio (o caminho mais rápido, desde 07/10/2026)

Pedido do GD: o guia antigo pedia "próximo, voltar, pular" e travava com frase normal ("eu já tenho um
cardápio e quero mandar uma foto" virou nome de categoria). Agora o primeiro cartão é **Falar o meu
cardápio**, e o dono fala do jeito dele:

- "X-tudo 25 reais, X-salada 22 e de bebida Coca lata 6" → três pratos com preço, em Lanches e Bebidas.
- Pode falar em várias frases. "De bebida", "pizzas:", "na parte de lanches" mudam a categoria e ela
  vale para as frases seguintes. Sem categoria falada, o sistema adivinha pelo prato (Coca é bebida,
  X- é lanche, coxinha é salgado) e o dono confere no fim.
- Corrigir falando: "não, o X-tudo é 26" troca o preço; "tira a Coca" tira da lista. Prato falado sem
  preço fica "sem preço" e o preço dito logo depois ("vinte e cinco") vai para ele.
- "Pronto" (ou "só isso", "acabou") pergunta só os preços que faltaram e vai para a conferência.
- Dá também para escrever no campo "Ou escreva" ("X-tudo 25, Coca 6"): o mesmo entendimento.
- Na primeira tela, uma frase com prato e preço já entra direto nesse caminho; "foto" abre a foto.

Regras que não mudam: preço que não for um número limpo fica vazio e é perguntado (nunca chutado);
número que é parte do nome ("Coca 2 litros", "Pizza quatro queijos", "Açaí 500 ml") não vira preço;
conversa sem preço ("agora vou falar as bebidas", "bom dia") não vira prato; lista longa sem preço
aparece como "não separei isto" para o dono tocar. Detalhes em `frontend/src/assistant/spokenMenu.ts`.

### O que o primeiro teste no celular mostrou (GD, 07/10/2026) e o que mudou

O GD falou o cardápio num celular de verdade pela primeira vez e apareceram três problemas:

1. **O assistente cortava no meio.** O celular fecha o microfone na primeira pausa (cerca de 1,5 s) e o
   assistente já respondia "Anotei...", falando por cima do dono. Agora, na tela de falar o cardápio, ele
   **espera 3 segundos de silêncio de verdade** antes de fechar a frase e **reabre o microfone sozinho** nas
   pausas, juntando tudo o que foi dito. A tela mostra "Ouvindo… pode falar com pausas, eu espero" e as
   palavras aparecem conforme ele fala. Nas perguntas curtas ("sim", "pronto", um preço) nada mudou: a
   primeira frase fechada é a resposta. A regra está em `hearing.ts`, com teste usando um microfone falso.
2. **Conversa virava prato.** "Vamos lá x-tudo 25" virava o prato "Vamos lá x-tudo", "Vamos fazer 55" virava
   um prato de R$ 55 e "unidade se for o combo 3" virava um prato de R$ 3. Agora as palavras de abertura
   ("vamos lá", "vou falar", "bora", "o próximo é"...) saem do nome, conversa com número e sem prato é
   ignorada, e frase de preço condicional ("unidade se for o combo") não vira prato.
3. **Preço absurdo passava.** Coca lata saiu R$ 300,00 (provavelmente um "3,00" mal ouvido). O sistema
   **nunca muda o preço sozinho**, mas agora marca o prato com "Confira: R$ 300,00? Era R$ 3,00?" na lista e
   na conferência, e a voz avisa: "Confira o preço de Coca lata: 300 reais. Era 3 reais? Para corrigir, diga o
   nome e o preço." O teto de cada tipo (bebida R$ 80, lanche R$ 120, prato R$ 400...) está em `priceCheck.ts`.

A voz que responde é escolhida pela internet do celular (`docs/voz-do-guia.md`).

## Como a conversa anda (pelo tipo de negócio)

1. **Tipo de negócio.** Fala ("lanchonete", "pizzaria", "boteco", "sushi"...) ou toca
   num dos 8 cartões grandes. Apelidos comuns funcionam (marmitaria, sorveteria,
   espetinho...). Se a fala bater com dois tipos, não adivinha: pede o toque.
2. **Pratos, uma categoria por vez.** A tela mostra os pratos do modelo como botões.
   O dono toca, ou fala: "tenho x-burguer, x-salada e pastel de carne". Os nomes que
   estão no modelo são reconhecidos mesmo com plural, sem acento ou com uma letra
   trocada pelo reconhecedor de voz; o que não está no modelo vira prato novo, com o
   nome do jeito que foi dito. "Pronto" (sozinho ou no fim da frase) passa para a
   próxima categoria; "nenhum" ou "não vendo nada aqui" limpa a categoria; "todos"
   marca tudo; "voltar" volta. Também dá para digitar em "Outro prato".
3. **Preços, um prato por vez.** "X-Burguer. Quanto custa?" e a resposta falada
   ("dezoito e cinquenta", "vinte", "cinco e noventa") ou digitada. "Pular" tira o prato.
   Preço que não for entendido nunca é chutado: o assistente pergunta de novo.
4. **Conferir.** Lista agrupada por categoria; cada preço pode ser corrigido tocando
   nele e cada prato pode ser tirado. "Cadastrar" (falado) ou o botão envia tudo.

## Decisões de segurança e honestidade

- Lista falada sem pontuação (vários pratos que não estão no modelo, um atrás do outro)
  **não** é salva como um prato só: aparece na tela como "não separei isto" e o dono
  toca para adicionar se for mesmo um prato. Detalhe e limites em `assistantLogic.ts`.
- Comandos só valem em frases curtas (até 4 palavras) e só quando a frase não nomeia
  um prato do modelo, para "X-Tudo" não ser lido como "tudo".
- Se o microfone não ouvir nada duas vezes seguidas, o assistente para de escutar e
  mostra como liberar o microfone; tudo continua funcionando por toque.
- O microfone só abre depois que a voz do assistente termina, para ele não ouvir a si
  mesmo. Tocar em "Ouvindo… toque para parar" desliga a escuta automática até tocar em
  "Falar" de novo.
- O assistente não cadastra nada sozinho: só envia depois de "cadastrar" ou do botão.

## Arquivos

- `frontend/src/assistant/spokenMenu.ts`: entender o cardápio falado (prato e preço juntos,
  categorias, correções).
- `frontend/src/assistant/assistantLogic.ts`: entender a fala (pratos, tipo de negócio,
  comandos, preços).
- `frontend/src/assistant/assistantFlow.ts`: os passos como funções puras.
- `frontend/src/assistant/assistantPrompts.ts`: o que ele fala.
- `frontend/src/assistant/voiceIO.ts`: falar e escutar como promessas.
- `frontend/src/assistant/hearing.ts`: a escuta (pergunta curta ou ditado com pausas), sem depender do navegador.
- `frontend/src/assistant/priceCheck.ts`: preço que parece erro de ouvido.
- `frontend/src/assistant/MenuAssistant.tsx` e `assistant.css`: a tela.
- `tests/assistant/*.test.mjs`: testes da lógica e dos passos.

## Como foi verificado

- Testes automáticos da lógica e dos passos (35), mais 29 do ditado com pausas, da conversa que virava prato e do
  preço absurdo (07/10/2026).
- Conversa completa num navegador Chromium simulando celular (390 x 844), com a voz
  simulada: tipo de negócio, três categorias por voz, nove preços por voz, cadastro; e
  outro roteiro só por toque (digitar preço inválido, corrigir preço na conferência,
  tirar prato, recusa do servidor, botão "Ver o cardápio").

## Limites conhecidos

- **Voz e microfone reais não foram testados em um celular.** O comportamento do
  reconhecimento de voz do Chrome no Android (tempo de resposta, abrir o microfone sem
  um toque a cada resposta, qualidade das vozes) precisa ser visto num aparelho.
- O tempo entre o fim da fala e a resposta depende do reconhecimento do próprio
  celular (em geral 1 a 2 segundos depois do silêncio). Na tela de falar o cardápio o assistente soma 3
  segundos de espera própria. **O ditado com pausas ainda não foi testado num celular**: a lógica está testada
  com um microfone falso, mas o Chrome do Android pode tocar o som de "microfone ligado" a cada reabertura.
  Se incomodar, o próximo passo é testar o modo contínuo do navegador.
- A ficha técnica por voz (painel de Custos) também fala frases longas e ainda usa a escuta antiga, que fecha
  na primeira pausa.
- A voz natural do servidor está pronta mas desligada até escolher o provedor
  (`docs/voz-do-guia.md`); até lá, a voz é a do celular.
- Falar uma lista de pratos **sem preço** e sem pausa ("coxinha pastel empada quibe") não dá para
  separar com segurança: aparece como "não separei isto". Com o preço depois de cada prato, separa.
- A categoria adivinhada pode errar para pratos fora do dicionário (vai para "Pratos"); o dono vê
  na conferência.
- Ainda não há foto, melhoria de imagem nem logomarca: são as próximas etapas.
