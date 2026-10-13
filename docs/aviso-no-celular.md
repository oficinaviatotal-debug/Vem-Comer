# Aviso no celular com o app fechado (item 52, primeiro pedaço)

Pronto em 13/10/2026 (migração `016_avisos_no_celular.sql`, `backend/push.py`, `frontend/public/sw.js`, pasta `frontend/src/push/`).

## O que muda para quem trabalha no restaurante

Antes, o painel só apitava e vibrava **com o app aberto na frente** (`alertDevice.ts`). Agora, quem toca em **Ativar aviso**
recebe uma notificação no celular mesmo com o app fechado ou a tela bloqueada:

| Quando | Quem recebe | O que aparece na tela bloqueada |
|---|---|---|
| Entra pedido novo | dono, gerente, cozinha, caixa | "Pedido novo" e "Mesa 4", "Entrega", "Retirada" ou "Balcão" |
| Uma mesa chama (garçom, conta, água, limpeza) | dono, gerente, garçom | "Mesa 4 chama o garçom" |
| Uma entrega fica pronta | motoqueiros, dono, gerente | "Entrega pronta" |
| Um dono pede ajuda (botão "Preciso de ajuda") | **o administrador da plataforma** (e-mail em `PLATFORM_ADMIN_EMAILS`), em qualquer restaurante em que tenha entrado | "Chamado de ajuda" e "Pizzaria do Zé: Foto" ("Chamado de novo" se ele pedir outra vez) |

A mensagem **nunca leva nome, telefone, endereço nem valor**: ela aparece com a tela bloqueada (o aviso do chamado leva só o nome do restaurante e o assunto; o texto que o dono escreveu fica na caixa de chamados).
Tocar na notificação abre o painel. Se o painel já está aberto e na frente, o aviso não repete por cima (ele mesmo apita).

## Como o dono liga

Uma faixa no topo do painel (e da tela do motoqueiro): **Ativar aviso** / **Agora não** (volta depois de uma semana).
Depois de ligado: **Testar aviso** (manda uma notificação de teste só para os celulares dessa pessoa e diz quantos receberam)
e **Desligar**. Cada pessoa liga no próprio celular; cada uma guarda até 5 aparelhos.

- **Android (Chrome):** funciona direto no navegador.
- **iPhone:** só depois de "Adicionar à Tela de Início" e abrir pelo ícone (regra da Apple, iOS 16.4 ou mais novo). A tela explica isso.
- Se a pessoa tocar em "Bloquear" na pergunta do navegador, a faixa explica como liberar (cadeado ao lado do endereço > Notificações).

## Como funciona por dentro

1. O celular se inscreve no serviço de notificação do navegador (Google, Mozilla, Apple ou Microsoft) com a **chave pública**
   deste servidor (`GET /api/push/config`) e entrega ao servidor o endereço secreto e as chaves daquele aparelho
   (`POST /api/companies/<id>/push/subscribe`). Fica em `push_subscriptions`.
2. Quando o evento acontece (`create_company_order`, `create_table_call`, `update_order_status` com `pronto`), o servidor
   chama `push.notify_*`. O envio roda **em segundo plano**, depois de o pedido já estar gravado: um erro aqui vira uma linha de
   log e nunca derruba a resposta ao cliente. Sem celular inscrito, não faz nada.
3. A mensagem é criptografada com as chaves do aparelho e assinada com a chave VAPID do servidor (biblioteca `pywebpush`).
4. Se o serviço responde 404 ou 410 ("esse aparelho não existe mais"), a inscrição é apagada. Outras falhas contam ponto; depois de 8 seguidas, sai.

A chave do servidor nasce sozinha no banco (`push_config`, uma linha) na primeira vez e anda junto com o backup. A privada nunca
sai do servidor. Se o banco for refeito do zero, a chave muda: os celulares com inscrição velha passam a aparecer como desligados
e a pessoa só toca em Ativar aviso de novo (a inscrição velha é trocada).

## Segurança

- **O servidor chama um endereço que vem de fora**, então o endereço do aparelho só vale se for **HTTPS, porta 443, sem usuário e de um
  serviço de notificação conhecido** (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.push.apple.com`,
  `*.notify.windows.com`). Endereço da rede interna (`api`, `db`, `127.0.0.1`, `169.254.169.254`) é recusado antes de gravar.
- A empresa e a pessoa vêm do login, nunca do corpo do pedido; ninguém desliga o aparelho de outra pessoa.
- Só quem está ativo e tem o cargo certo **dessa empresa** recebe (cozinha não recebe chamada de mesa; motoqueiro não recebe pedido novo).
- O endereço secreto do aparelho nunca aparece em resposta, tela nem log.
- Teste: um aviso a cada 10 segundos por pessoa.

## Ligar e desligar

- `docker-compose.yml` liga com `PUSH_ENABLED: ${PUSH_ENABLED:-1}`. Para desligar tudo no servidor, `PUSH_ENABLED=0` no `.env`
  e `docker compose up -d` de novo. Sem a variável (testes, instalações antigas), o aviso fica quieto e a tela não mostra a faixa.
- `VAPID_SUBJECT` (opcional): o contato enviado ao serviço de notificação. Sem ele, usa o endereço do site.
- O Caddy serve `/sw.js` sem guardar cópia (`no-cache`), para a versão nova do "robô" chegar logo.

## Testes

- `backend/test_push.py` (67): endereços aceitos e recusados, as chaves do aparelho, mensagens sem dado pessoal, quem recebe o quê,
  o banco não fica preso durante o envio, aparelho que sumiu é apagado, as 4 rotas (login, outra empresa, desligado, limite do teste),
  e os quatro pontos onde o aviso nasce (pedido, mesa, entrega pronta, chamado de ajuda). **Um teste manda uma mensagem de verdade pela biblioteca para um servidor de mentira na
  própria máquina e abre a mensagem com a chave do aparelho** (criptografia, assinatura VAPID, `TTL`, `Urgency`).
- `tests/push/pushLogic.test.mjs` (11) e `tests/push/serviceWorker.test.mjs` (10): rodam o `sw.js` de verdade numa casca que imita o navegador
  (mostra o texto, corta texto grande, endereço de fora vira a página inicial, fica quieto com o painel na frente, toque abre ou foca o painel).
- Navegador de verdade (Chromium, 390 px, com as peças de push simuladas): convite, ativar, testar, voltar depois, desligar, "Agora não",
  permissão negada, servidor desligado, inscrição de chave velha, erro do servidor.

## O que ainda não foi visto

- **Num Android de verdade com o servidor de verdade.** O Chromium daqui não alcança o serviço de notificação do Google, então a
  entrega até o celular foi provada contra um servidor de mentira. O primeiro teste de verdade é: abrir o painel no Chrome do celular,
  tocar em Ativar aviso, tocar em Testar aviso e ver a notificação chegar.
- Para o GD receber o chamado de ajuda: entrar no painel com o e-mail que está em `PLATFORM_ADMIN_EMAILS` no celular dele e tocar em **Ativar aviso** (uma vez por celular).
- O aviso do **cliente** (pedido saiu, chegou) usa o mesmo mecanismo, mas ainda não foi ligado; o cliente não tem login, então precisa de um passo próprio.
