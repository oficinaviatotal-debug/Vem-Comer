# 0001 — Backend oficial do Vem Comer

- **Status:** proposta, aguardando aval do dono do produto (GD Oliveira)
- **Data:** 05/10/2026

## Contexto
Hoje existem três implementações que se sobrepõem para o Vem Comer:

1. **`backend/` (Flask + Postgres)**, neste repositório: login com token de 8 horas, cargos (OWNER, MANAGER, WAITER, CASHIER, KITCHEN, COURIER), isolamento por empresa (`company_id`), preço calculado no servidor, pedido criado como `PENDING_PAYMENT` com pagamento `PENDING` registrado, bloqueio de login por tentativas e testes automáticos no CI.
2. **`vem-tecnologia-runtime` (Node + SQLite)**, rotas `/api/v1/vem-comer/*`: sem login, sem multiempresa, qualquer chamada pode criar item, pedido ou mudar status.
3. **Funções do Supabase** (comando de voz e outras).

Ter dois lugares gravando pedidos significa duas fontes da verdade e uma superfície aberta sem autenticação.

## Decisão
1. O **Flask + Postgres deste repositório é o backend oficial** do Vem Comer. Todo pedido, cardápio, mesa, usuário e pagamento é gravado só nele.
2. O `vem-tecnologia-runtime` fica como **orquestrador de agentes e tarefas**. Ele não guarda dados de negócio do Vem Comer.
3. As rotas de negócio do runtime (`/api/v1/vem-comer/*` e `/api/v1/vem-trabalhar/*`) **não podem ficar acessíveis pela internet** até terem login, ou serão removidas.
4. O Vem Trabalhar mantém dados totalmente separados, como já decidido.

## Motivos
- Login, cargos e isolamento por empresa já existem e estão testados.
- Postgres atende melhor vários estabelecimentos no mesmo sistema.
- Já há CI com testes de pagamento, QR, isolamento por empresa e verificação de segredos.

## O que ainda falta (verificado no código em 05/10/2026)
- **Pagamento Pix:** `backend/mvp_payment.py` (assinatura do webhook, idempotência, conferência de valor) existe e tem testes, mas **não está ligado ao `app.py`**. O estado do pagamento está só em memória, e a tabela `payment_webhook_events` (migração 002) ainda não é usada. Não há provedor de pagamento real.
- **Isolamento por empresa:** `backend/tenant_policy.py` usa o nome `tenant_id`, enquanto o app usa `company_id`. É preciso alinhar antes de ligar.
- **Link da mesa:** `table_url()` em `backend/table_qr.py` monta `/c/<empresa>/mesa/<n>`, mas o app lê `?empresa=<slug>&mesa=<id>`. Hoje o painel gera o QR pelo endpoint novo, que usa o formato real.
- **Segurança de produção** (`SECURITY.md`): sessão com cookie seguro, limite de tentativas compartilhado entre instâncias e revisão do token de acompanhamento do pedido.
- **Hospedagem:** o repositório não tem script de deploy nem evidência de que este backend esteja publicado. Falta definir onde ele roda.

## Riscos a conferir na hospedagem
- Confirmar que o servidor web (proxy) **não publica** as rotas `/api/v1/*` do runtime.
- Confirmar que `FLASK_DEBUG=false`, que `SECRET_KEY` é longa e aleatória e que o CORS aceita só o endereço real do app.
