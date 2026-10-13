-- Avisos no celular com o app fechado (requisito 52): o servidor manda uma notificacao quando entra pedido novo,
-- quando uma mesa chama o garcom e quando uma entrega fica pronta para o motoqueiro pegar.
--
-- push_config: UMA linha so, o par de chaves que identifica este servidor perante os servicos de notificacao do Google,
--   da Mozilla, da Apple e da Microsoft (padrao VAPID). Nasce sozinha na primeira vez que alguem ativa o aviso. A chave
--   privada nunca sai do servidor. Fica no banco (e nao num arquivo) para andar junto com o backup: se o banco for
--   restaurado, os celulares ativados continuam valendo, pois cada um foi inscrito com a chave publica desta linha.
-- push_subscriptions: um aparelho que ativou o aviso. O "endpoint" e o endereco secreto que o aparelho recebeu do servico
--   de notificacao; por isso e unico e nunca aparece em tela nem em log. Se a mesma pessoa entra de novo no mesmo
--   aparelho, a linha e reaproveitada (e passa para quem entrou por ultimo). Quando o servico responde "esse aparelho
--   nao existe mais" (404 ou 410), a linha e apagada.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
CREATE TABLE IF NOT EXISTS push_config (
    id smallint PRIMARY KEY CHECK (id = 1),
    public_key text NOT NULL,
    private_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint text NOT NULL UNIQUE CHECK (length(endpoint) <= 1000),
    p256dh text NOT NULL CHECK (length(p256dh) <= 200),
    auth text NOT NULL CHECK (length(auth) <= 100),
    failures smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_ok_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_company ON push_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions (user_id, created_at DESC);
