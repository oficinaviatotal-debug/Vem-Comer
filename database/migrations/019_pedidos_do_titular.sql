-- Pedidos do titular dos dados e denúncias de conteúdo (LGPD art. 18 e 19; Marco Civil arts. 19 e 21).
-- Ver compliance/obligations.json (LGPD-DIREITOS-TITULAR, MCI-DENUNCIA-CONTEUDO) e backend/titular.py.
--
-- data_requests: um pedido por linha, com protocolo, prazo (15 dias para os pedidos da LGPD; meta de 2 dias para
--   denúncia de conteúdo) e andamento. A pessoa acompanha com o protocolo + um código que só ela recebe (aqui fica
--   só a impressão digital do código). identity_verified diz se a identidade foi conferida antes de entregar dado.
-- data_request_events: o histórico de cada pedido. SÓ RECEBE LINHAS NOVAS (o banco recusa alterar ou apagar), para
--   ser a prova de que o pedido foi recebido e respondido no prazo.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migração ANTES de subir a nova versão.

CREATE TABLE IF NOT EXISTS data_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol text NOT NULL UNIQUE CHECK (protocol ~ '^VC-[0-9]{4}-[0-9A-F]{8}$'),
    kind text NOT NULL CHECK (kind IN (
        'acesso', 'correcao', 'eliminacao', 'portabilidade', 'informacao_compartilhamento',
        'revogacao', 'oposicao', 'revisao_decisao', 'duvida', 'denuncia'
    )),
    channel text NOT NULL DEFAULT 'site' CHECK (channel IN ('site', 'painel', 'email', 'presencial')),
    contact text CHECK (contact IS NULL OR length(contact) <= 200),
    subject_hash text CHECK (subject_hash IS NULL OR subject_hash ~ '^[0-9a-f]{64}$'),
    description text CHECK (description IS NULL OR length(description) <= 4000),
    target_url text CHECK (target_url IS NULL OR length(target_url) <= 500),
    identity_verified boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida', 'em_analise', 'respondida', 'negada', 'encerrada')),
    response text CHECK (response IS NULL OR length(response) <= 4000),
    token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    due_at timestamptz NOT NULL,
    answered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (kind = 'denuncia' OR contact IS NOT NULL),
    CHECK (kind <> 'denuncia' OR target_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS data_requests_abertos ON data_requests (due_at) WHERE status IN ('recebida', 'em_analise');

CREATE TABLE IF NOT EXISTS data_request_events (
    seq bigserial PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES data_requests(id) ON DELETE RESTRICT,
    event text NOT NULL CHECK (event IN ('recebida', 'identidade_conferida', 'em_analise', 'respondida', 'negada', 'encerrada', 'conteudo_retirado', 'anotacao')),
    note text CHECK (note IS NULL OR length(note) <= 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_request_events_pedido ON data_request_events (request_id, seq);

CREATE OR REPLACE FUNCTION data_request_events_so_acrescenta() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'data_request_events so recebe linhas novas (nada e alterado nem apagado)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_request_events_sem_alterar ON data_request_events;
CREATE TRIGGER data_request_events_sem_alterar
    BEFORE UPDATE OR DELETE ON data_request_events
    FOR EACH ROW EXECUTE FUNCTION data_request_events_so_acrescenta();

DROP TRIGGER IF EXISTS data_request_events_sem_truncar ON data_request_events;
CREATE TRIGGER data_request_events_sem_truncar
    BEFORE TRUNCATE ON data_request_events
    FOR EACH STATEMENT EXECUTE FUNCTION data_request_events_so_acrescenta();
