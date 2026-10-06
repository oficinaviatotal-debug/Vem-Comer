# Assistente do cardápio (tela, voz e passos)

Aba **Assistente** no painel do dono (visível para dono e gerente). Serve para quem
tem pouco estudo ou pouca prática com celular: o assistente pergunta em voz alta, o
celular escuta sozinho a resposta (sem tocar a cada vez) e, no fim, o cardápio é
cadastrado de uma vez pela rota descrita em `docs/cardapio-assistido.md`.

## Como a conversa anda

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

- `frontend/src/assistant/assistantLogic.ts`: entender a fala (pratos, tipo de negócio,
  comandos, preços).
- `frontend/src/assistant/assistantFlow.ts`: os passos como funções puras.
- `frontend/src/assistant/assistantPrompts.ts`: o que ele fala.
- `frontend/src/assistant/voiceIO.ts`: falar e escutar como promessas.
- `frontend/src/assistant/MenuAssistant.tsx` e `assistant.css`: a tela.
- `tests/assistant/*.test.mjs`: 35 testes da lógica e dos passos.

## Como foi verificado

- Testes automáticos da lógica e dos passos (35).
- Conversa completa num navegador Chromium simulando celular (390 x 844), com a voz
  simulada: tipo de negócio, três categorias por voz, nove preços por voz, cadastro; e
  outro roteiro só por toque (digitar preço inválido, corrigir preço na conferência,
  tirar prato, recusa do servidor, botão "Ver o cardápio").

## Limites conhecidos

- **Voz e microfone reais não foram testados em um celular.** O comportamento do
  reconhecimento de voz do Chrome no Android (tempo de resposta, abrir o microfone sem
  um toque a cada resposta, qualidade das vozes) precisa ser visto num aparelho.
- O tempo entre o fim da fala e a resposta depende do reconhecimento do próprio
  celular (em geral 1 a 2 segundos depois do silêncio).
- A voz é a do celular. Se o aparelho só tiver a voz simples do sistema, ela continua
  robótica; áudio gravado profissional exigiria um serviço pago.
- Falar o cardápio inteiro de uma vez ("meus pratos são A, B, C...") para pratos que
  **não** estão no modelo precisa de um modelo de linguagem (serviço pago). Hoje o
  assistente cobre isso com os modelos prontos e com o toque para adicionar.
- Ainda não há foto, melhoria de imagem nem logomarca: são as próximas etapas.
