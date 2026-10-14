-- Conformidade (LGPD e comunicação por e-mail): prova de aceite, lista de bloqueio e contato de divulgação.
-- Ver compliance/obligations.json (LGPD-ACEITE-PROVA, LGPD-REVOGACAO, EMAIL-LISTA-BLOQUEIO, EMAIL-PROSPECCAO-EMPRESA).
--
-- consent_records: um registro por aceite ou por retirada de aceite. SÓ RECEBE LINHAS NOVAS: o gatilho abaixo
--   recusa UPDATE, DELETE e TRUNCATE, mesmo para o usuário do site. A pessoa aparece só pela impressão digital
--   (SHA-256) do e-mail, não pelo e-mail; assim o registro pode ficar guardado como prova mesmo depois do pedido
--   de apagar a conta (a prova de que houve consentimento não é dado novo sobre a pessoa).
-- email_suppression: quem pediu para não receber divulgação (ou reclamou, ou o e-mail voltou). Só a impressão
--   digital; a mesma regra vale nos dois produtos (as impressões digitais são trocadas entre eles).
-- outreach_contacts: empresa que o sistema pode procurar uma vez, com a origem do e-mail e a base legal anotadas.
--   Candidato NUNCA entra aqui: candidato só entra por cadastro dele, com confirmação.
-- outreach_log: cada tentativa de envio e o que aconteceu (para o limite diário, os 2 lembretes e o freio).
-- email_controle: UMA linha só; o envio congela sozinho se as reclamações ou os e-mails devolvidos passarem do limite.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migração ANTES de subir a nova versão.

CREATE TABLE IF NOT EXISTS consent_records (
    seq bigserial PRIMARY KEY,
    id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    subject_hash text NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
    subject_kind text NOT NULL CHECK (subject_kind IN ('dono', 'cliente', 'candidato', 'empresa', 'contato')),
    purpose text NOT NULL CHECK (purpose IN (
        'termos', 'privacidade', 'maior_de_18', 'ia_foto_exterior', 'alertas_email', 'divulgacao_email'
    )),
    granted boolean NOT NULL,
    document_version text NOT NULL CHECK (length(document_version) BETWEEN 1 AND 40),
    document_sha256 text CHECK (document_sha256 IS NULL OR document_sha256 ~ '^[0-9a-f]{64}$'),
    channel text NOT NULL CHECK (channel IN ('site', 'painel', 'email', 'api', 'presencial')),
    ip_hash text CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_records_subject ON consent_records (subject_hash, purpose, seq DESC);

CREATE OR REPLACE FUNCTION consent_records_so_acrescenta() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'consent_records so recebe linhas novas (nada e alterado nem apagado)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consent_records_sem_alterar ON consent_records;
CREATE TRIGGER consent_records_sem_alterar
    BEFORE UPDATE OR DELETE ON consent_records
    FOR EACH ROW EXECUTE FUNCTION consent_records_so_acrescenta();

DROP TRIGGER IF EXISTS consent_records_sem_truncar ON consent_records;
CREATE TRIGGER consent_records_sem_truncar
    BEFORE TRUNCATE ON consent_records
    FOR EACH STATEMENT EXECUTE FUNCTION consent_records_so_acrescenta();

CREATE TABLE IF NOT EXISTS email_suppression (
    email_hash text PRIMARY KEY CHECK (email_hash ~ '^[0-9a-f]{64}$'),
    reason text NOT NULL CHECK (reason IN ('pediu', 'reclamacao', 'devolvido', 'titular')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL CHECK (email = lower(email) AND length(email) <= 200),
    email_hash text NOT NULL UNIQUE CHECK (email_hash ~ '^[0-9a-f]{64}$'),
    kind text NOT NULL CHECK (kind = 'empresa'),
    source text NOT NULL CHECK (source IN ('anuncio_publico', 'site_da_empresa', 'indicacao', 'parceiro', 'pedido_do_contato')),
    source_note text NOT NULL CHECK (length(source_note) BETWEEN 3 AND 300),
    legal_basis text NOT NULL CHECK (legal_basis IN ('interesse_legitimo', 'consentimento')),
    free_mail boolean NOT NULL DEFAULT false,
    added_by text NOT NULL CHECK (length(added_by) BETWEEN 1 AND 60),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id uuid NOT NULL REFERENCES outreach_contacts(id) ON DELETE CASCADE,
    step text NOT NULL CHECK (step IN ('primeiro', 'lembrete')),
    outcome text NOT NULL CHECK (outcome IN ('enviado', 'erro', 'devolvido', 'reclamacao', 'descadastro', 'respondeu')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_log_contact ON outreach_log (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_log_day ON outreach_log (created_at DESC);

CREATE TABLE IF NOT EXISTS email_controle (
    id smallint PRIMARY KEY CHECK (id = 1),
    congelado boolean NOT NULL DEFAULT false,
    motivo text,
    desde timestamptz
);

INSERT INTO email_controle (id, congelado) VALUES (1, false) ON CONFLICT (id) DO NOTHING;
