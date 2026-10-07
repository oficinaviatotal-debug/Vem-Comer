
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
