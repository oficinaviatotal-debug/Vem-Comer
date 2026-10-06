# Cadastro do restaurante pela internet

O dono do restaurante cria o próprio cadastro, sozinho, num formulário de uma tela, e já cai no painel (que
abre o Assistente do cardápio). Sem ligar para ninguém e sem esperar o administrador.

**Estado: construído e FECHADO.** Nada abre para o público até o administrador mandar:

```
bash /opt/vem-comer/app/deploy/vps/abrir-cadastro.sh status   # ver se está aberto
bash /opt/vem-comer/app/deploy/vps/abrir-cadastro.sh abrir    # abrir (pede para digitar "abrir")
bash /opt/vem-comer/app/deploy/vps/abrir-cadastro.sh fechar   # fechar de novo
```

Abrir e fechar mexem em uma linha do `.env` (`SIGNUP_OPEN=1`) e reiniciam só o servidor do Vem Comer
(alguns segundos). Não mexem no banco nem nos restaurantes.

## O que o dono vê

| Endereço | O que abre |
| --- | --- |
| `https://SEU-ENDERECO/?cadastro=1` | Formulário: nome do restaurante, nome do dono, e-mail, WhatsApp (opcional), senha, aceite dos termos |
| `https://SEU-ENDERECO/?entrar=1` | Entrar com e-mail e senha, sem saber o link do restaurante |
| `https://SEU-ENDERECO/?termos=1` | Termos de uso e privacidade |
| `https://SEU-ENDERECO/` | Tela inicial, com os botões "Entrar" e (se o cadastro estiver aberto) "Cadastrar meu restaurante" |

- A senha pode ser mostrada na tela (botão "Mostrar"), então não há campo de repetir a senha.
- O WhatsApp é opcional e vai arrumado enquanto digita: `(84) 99999-1234`.
- Com o cadastro fechado, a página `?cadastro=1` diz "Cadastro ainda fechado" e leva para o "Entrar".
- Terminou: o dono já está entrado e vai para `/?empresa=<endereço-curto>&painel=1`. Sem nenhum cardápio
  ainda, o painel abre direto no Assistente por voz e toque.
- O endereço curto do restaurante sai do nome: "Saiteria do João" vira `saiteria-do-joao`. Se já existir,
  tenta `-2`, `-3` … `-9` e, por último, um sufixo sorteado. Palavras do sistema (`admin`, `api`, `media`,
  `painel`...) nunca viram endereço.

## O servidor

`POST /api/signup` (arquivo `backend/signup.py`, rota em `backend/app.py`) e `GET /api/signup/status`.

1. **Fechado = 404.** Sem `SIGNUP_OPEN=1`, as duas rotas se comportam como se não existissem (o `status` diz
   `open: false`).
2. **Armadilha de robô.** Um campo escondido (`website`): se vier preenchido, o pedido é recusado.
3. **Limite por rede.** 8 tentativas por hora e 20 por dia por endereço de rede. Folgado de propósito: na
   rede móvel muita gente divide o mesmo endereço. Muda por `SIGNUP_PER_IP_PER_HOUR` e
   `SIGNUP_PER_IP_PER_DAY`.
4. **Limite geral.** No máximo 200 restaurantes novos em 24 horas no servidor inteiro, contados no banco
   (`SIGNUP_MAX_PER_DAY`).
5. **Validação.** Nomes de 2 a 120 / 100 letras, e-mail com formato certo, WhatsApp brasileiro com DDD que
   existe, senha de 8 a 128 caracteres e fora da lista das mais comuns (`12345678`, `senha123`...).
6. **E-mail único em todo o sistema.** Antes desta mudança o mesmo e-mail podia existir em dois restaurantes,
   e o login (que só olha o e-mail) podia cair na conta errada, ou ser atrapalhado de propósito por quem
   cadastra o e-mail de outra pessoa. A migração `005_cadastro_publico.sql` cria um índice único por e-mail
   (sem diferenciar maiúsculas); se já houver e-mail repetido no banco, ela avisa e não cria o índice, e o
   servidor continua conferindo antes de gravar.
7. **Termos.** O formulário manda a versão dos termos que o dono leu. Se for diferente da versão do servidor,
   o cadastro é recusado e pede para recarregar. Ficam gravados `terms_version` e `terms_accepted_at`.
8. **Tudo em uma transação.** Restaurante e dono nascem juntos ou não nascem.
9. **A senha** é guardada com hash (a mesma função do login) e nunca volta na resposta.
10. A resposta (`201`) já traz o token de sessão, como o login, com `Cache-Control: no-store`.

Erros voltam com `{"error": "...", "field": "email"}` para a tela marcar o campo certo.

## Banco de dados

Migração `database/migrations/005_cadastro_publico.sql` (segura para rodar várias vezes; o instalador roda
sozinha):

- `companies.created_at` (o banco do servidor ainda não tinha; os restaurantes que já existem ficam com a
  data da migração),
- `companies.owner_phone`, `terms_version`, `terms_accepted_at`, `signup_source` (`web` quando o dono se
  cadastrou sozinho; vazio quando o administrador criou),
- índice único `users_email_unique` em `lower(email)`.

## Antes de abrir para o público

1. **Advogado revisa** os termos (`frontend/src/signup/TermsPage.tsx`). O texto atual é preliminar e a tela
   avisa isso. Depois de revisar, mude `TERMS_REVIEWED` para `true` e a versão em `signupLogic.ts` e em
   `backend/signup.py` (um teste confere que as duas versões são iguais).
2. **Contato de suporte** (e-mail ou WhatsApp) em `SUPPORT_CONTACT`, na mesma página.
3. Saber que **ainda não existe** confirmação de e-mail nem "esqueci a senha". Quem esquecer a senha depende
   do administrador. Os dois precisam de um serviço de envio de e-mail (SMTP ou similar), que ainda não foi
   contratado.
4. Saber que **não há CAPTCHA**. Os limites acima seguram o básico. Se aparecer abuso, o próximo passo é um
   CAPTCHA (por exemplo Cloudflare Turnstile) e a confirmação de e-mail.
5. Teste real, com celular de verdade, no servidor, antes de divulgar o link.

## O que ainda não faz (próximos passos)

- Confirmação de e-mail e "esqueci a senha" (precisam de e-mail).
- CAPTCHA.
- Período de teste e cobrança da assinatura (requisito 5 da ordem de trabalho).
- Ditado por voz nos campos do formulário (hoje a voz começa no Assistente do cardápio, logo depois).
- Cadastro de funcionário com convite por link (hoje o dono cria os funcionários dentro do painel).

## Como foi testado

- `backend/test_signup.py`: regras (endereço curto, telefone, senha, termos), limites, e a rota com um banco
  de mentira (sucesso, endereço ocupado, e-mail repetido, corrida entre duas pessoas, limite do dia, robô,
  erro inesperado).
- Banco PostgreSQL 16 de verdade: schema de produção + migrações aplicados duas vezes, migração com e-mail
  repetido, e os comandos SQL do cadastro rodados com `PREPARE`/`EXECUTE`. (Foi assim que apareceu a falta da
  coluna `created_at` na tabela de restaurantes do servidor.)
- `deploy/vps/test_abrir_cadastro.py`: o script que abre e fecha, com um "docker" de mentira.
- `tests/signup/signupLogic.test.mjs` e `tests/ui/links.test.mjs`: regras da tela e endereços; o primeiro
  confere que a tela e o servidor concordam na versão dos termos, nos DDDs e nos nomes dos campos.
- Navegador de verdade (Chromium, tela de celular de 360 px, regras de segurança de produção e servidor de
  mentira): tela inicial com cadastro aberto e fechado, formulário vazio e com erros (foco no primeiro campo),
  telefone arrumado ao digitar, mostrar/esconder senha, armadilha de robô fora da tela, cadastro com sucesso
  indo para o painel, erro do servidor no campo certo, limite de tentativas, entrar (certo e senha errada) e
  termos. 35 conferências, nenhum erro no console e nenhuma rolagem lateral. Foi assim que apareceu o botão
  "Entrar" mudando de cor quando o botão de cadastro surgia (corrigido).
- **Ainda não foi testado com celular de verdade no servidor** (item 5 da lista acima).
