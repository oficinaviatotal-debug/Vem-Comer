
## Câmera só para o próprio site (15/10/2026)

- O porteiro (`deploy/vps/Caddyfile`) mandava `Permissions-Policy: camera=()`, que **bloqueia a câmera para todo mundo,
  inclusive para o nosso site**. Para o garçom ler o QR da mesa dentro do aplicativo ("Abrir mesa") passou a ser
  `camera=(self)`: só o próprio site pode pedir a câmera, e ainda assim o navegador **pergunta à pessoa** antes de abrir.
  Páginas embutidas de outro endereço continuam sem câmera (o site também não pode ser embutido: `X-Frame-Options: DENY`).
  Localização continua bloqueada (`geolocation=()`).
- A imagem da câmera é lida na hora, no próprio celular, para achar o QR: **não é gravada, não é enviada e não passa pelo
  servidor**. A câmera fecha ao ler, ao cancelar e ao sair da tela (há teste para isso).
- A mudança só vale depois que o servidor for atualizado (o Caddyfile entra na imagem do site).

## Login do painel e renovação (07/10/2026)

- Cada login vale 8 horas no servidor (`TOKEN_MAX_AGE_SECONDS`). Com o painel aberto, a tela renova
  o login a cada 20 minutos e quando o celular volta para a tela (`POST /api/auth/refresh`), então
  ninguém é deslogado no meio do expediente.
- A renovação confere no banco que a pessoa continua ativa e no mesmo restaurante, e usa o cargo
  do banco (mudou o cargo, muda o acesso na próxima renovação). Pessoa desativada perde o acesso em
  até 20 minutos.
- Depois de 30 dias do login com senha (`SESSION_MAX_DAYS`), mesmo renovando, é preciso entrar de novo.
- Quando o login acaba, qualquer tela que receba "não autenticado" leva à tela de entrada, com o
  e-mail já preenchido e o aviso "Seu acesso terminou", em vez de um erro que não sai.
