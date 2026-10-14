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
