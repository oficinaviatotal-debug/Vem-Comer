-- Pedidos de ajuda do dono ("Preciso de ajuda"): quando o dono trava no cadastro do cardapio, na foto, na logomarca ou em
-- qualquer tela, ele toca num botao, escolhe o assunto e o pedido chega a uma pessoa (pedido do GD, 07/10/2026:
-- "suporte quando o dono trava", cardapio todo cadastrado em ate 3 dias).
--
-- Uma linha por pedido. Enquanto ninguem resolve, o status fica "open". Se o dono pedir de novo com um pedido ainda
-- aberto, nao nasce outra linha: o pedido e atualizado e sobe o contador "repeats" (a caixa do administrador mostra
-- quem esta chamando de novo). O texto do dono e curto (500 letras) e nunca vai para fora do painel do administrador.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
CREATE TABLE IF NOT EXISTS help_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    topic varchar(12) NOT NULL CHECK (topic IN ('cardapio', 'foto', 'logo', 'pedidos', 'plano', 'erro', 'outro')),
    screen varchar(40) NOT NULL DEFAULT '',
    message varchar(500) NOT NULL DEFAULT '',
    contact_phone varchar(20),
    status varchar(8) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    repeats smallint NOT NULL DEFAULT 0 CHECK (repeats BETWEEN 0 AND 9),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS help_requests_open ON help_requests (status, created_at);
CREATE INDEX IF NOT EXISTS help_requests_company ON help_requests (company_id, status, created_at);
