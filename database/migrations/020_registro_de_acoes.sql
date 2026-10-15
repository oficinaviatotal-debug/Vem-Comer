-- Registro de ações dos agentes e fila de aprovação do dono do software (desenho em docs/agentes-e-aprendizado.md,
-- itens 4 e 5; níveis de autorização em docs/LIVING_SYSTEM_SPINE.md).
--
-- agent_actions: uma linha por ação que um agente propôs ou fez, com o cartão que o dono lê (o quê, por quê, a
--   evidência, o risco e o que acontece se recusar), o nível de autorização, quem decidiu, o resultado e o custo.
--   Nível 1 (reversível e pequeno): o sistema faz e conta; nasce "feita" ou "falhou", nunca espera ninguém.
--   Nível 3 (método, dinheiro, texto legal, canal novo, custo novo, dado pessoal, código em produção): nasce
--   "pendente" e só o dono do software decide. O nível 2 (o dono do restaurante aprova) entra quando houver a fila
--   do restaurante, com a coluna do restaurante; por isso ainda não é aceito aqui.
--   Aprovar NÃO executa nada: só libera. Quem executa (ainda não existe) depois conta o resultado.
-- agent_action_events: o histórico de cada ação. SÓ RECEBE LINHAS NOVAS (o banco recusa alterar ou apagar), para
--   ser a prova de quem propôs, quem decidiu e quando. Não guarda texto de pessoa de fora, só o que o agente
--   escreveu e a decisão do dono.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migração ANTES de subir a nova versão.

CREATE TABLE IF NOT EXISTS agent_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent text NOT NULL CHECK (agent ~ '^[a-z][a-z0-9_]{1,39}$'),
    kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_]{1,39}$'),
    level smallint NOT NULL CHECK (level IN (1, 3)),
    title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
    what text NOT NULL CHECK (char_length(what) BETWEEN 3 AND 1000),
    why text NOT NULL DEFAULT '' CHECK (char_length(why) <= 600),
    risk text NOT NULL DEFAULT '' CHECK (char_length(risk) <= 600),
    if_refused text NOT NULL DEFAULT '' CHECK (char_length(if_refused) <= 400),
    -- [{"fact": "...", "source": "...", "date": "2026-10-15"}]: cada fato com a fonte e a data
    evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array' AND jsonb_array_length(evidence) <= 8),
    status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada', 'mudanca', 'feita', 'falhou')),
    decision_note text NOT NULL DEFAULT '' CHECK (char_length(decision_note) <= 500),
    decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
    decided_at timestamptz,
    result text NOT NULL DEFAULT '' CHECK (char_length(result) <= 1000),
    cost_cents integer NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
    done_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- nível 1 nunca espera: só "feita" ou "falhou"
    CHECK (level <> 1 OR status IN ('feita', 'falhou')),
    -- quem decidiu tem hora; quem terminou tem hora
    CHECK (status NOT IN ('aprovada', 'recusada', 'mudanca') OR decided_at IS NOT NULL),
    CHECK (status NOT IN ('feita', 'falhou') OR done_at IS NOT NULL),
    -- nível 3 precisa de evidência para chegar à fila (cada item com fato, fonte e data é conferido pelo servidor)
    CHECK (level <> 3 OR jsonb_array_length(evidence) >= 1)
);

CREATE INDEX IF NOT EXISTS agent_actions_fila ON agent_actions (created_at) WHERE level = 3 AND status = 'pendente';
CREATE INDEX IF NOT EXISTS agent_actions_recentes ON agent_actions (created_at DESC);

CREATE TABLE IF NOT EXISTS agent_action_events (
    seq bigserial PRIMARY KEY,
    action_id uuid NOT NULL REFERENCES agent_actions(id) ON DELETE RESTRICT,
    event text NOT NULL CHECK (event IN ('proposta', 'aprovada', 'recusada', 'mudanca', 'feita', 'falhou')),
    -- "agente:captacao" ou "dono". Sem chave estrangeira de propósito: o histórico não pode ser alterado nem por apagar um usuário.
    actor text NOT NULL CHECK (char_length(actor) BETWEEN 3 AND 60),
    actor_user uuid,
    note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_action_events_acao ON agent_action_events (action_id, seq);

CREATE OR REPLACE FUNCTION agent_action_events_so_acrescenta() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'agent_action_events so recebe linhas novas (nada e alterado nem apagado)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_action_events_sem_alterar ON agent_action_events;
CREATE TRIGGER agent_action_events_sem_alterar
    BEFORE UPDATE OR DELETE ON agent_action_events
    FOR EACH ROW EXECUTE FUNCTION agent_action_events_so_acrescenta();

DROP TRIGGER IF EXISTS agent_action_events_sem_truncar ON agent_action_events;
CREATE TRIGGER agent_action_events_sem_truncar
    BEFORE TRUNCATE ON agent_action_events
    FOR EACH STATEMENT EXECUTE FUNCTION agent_action_events_so_acrescenta();
