-- Máquina de vendas do Vem: os restaurantes, bares, pastelarias e sorveterias que o Vem Tecnologia quer conquistar,
-- do primeiro contato até pagar. Desenho em docs/maquina-de-vendas-do-vem.md; regras em backend/vendas.py.
--
-- sales_prospects: um negócio que o Vem procura. É dado de pessoa (nome do contato, WhatsApp, e-mail), então cada linha
--   guarda DE ONDE veio o contato e por que podemos escrever (source e source_note). NINGUÉM RECEBE MENSAGEM DAQUI POR
--   ROBÔ: quem manda é uma pessoa do Vem, uma mensagem por vez, pelo canal que o próprio negócio divulgou. O sistema só
--   lembra, escreve o rascunho e conta o que aconteceu.
-- sales_events: a história de cada negócio (criado, mensagem enviada, respondeu, mudou de etapa). Só a classe do que
--   aconteceu, nunca o texto da resposta da pessoa.
-- phone_suppression: telefones de quem disse "não quero". Só a impressão digital (SHA-256), como em email_suppression:
--   quem saiu não volta por outra porta, nem se o número for cadastrado de novo.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migração ANTES de subir a nova versão.

-- O formulário "quero que o Vem fale comigo" (desligado até o GD ligar) grava o aceite de quem pede contato comercial.
-- A finalidade nova entra na lista de finalidades de consent_records. A tabela continua só recebendo linhas novas:
-- trocar a regra de uma coluna não altera nem apaga nenhum registro.
ALTER TABLE consent_records DROP CONSTRAINT IF EXISTS consent_records_purpose_check;
ALTER TABLE consent_records ADD CONSTRAINT consent_records_purpose_check CHECK (purpose IN (
    'termos', 'privacidade', 'maior_de_18', 'ia_foto_exterior', 'alertas_email', 'divulgacao_email', 'contato_comercial'
));

CREATE TABLE IF NOT EXISTS phone_suppression (
    phone_hash text PRIMARY KEY CHECK (phone_hash ~ '^[0-9a-f]{64}$'),
    reason text NOT NULL CHECK (reason IN ('pediu', 'titular')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_prospects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name text NOT NULL CHECK (length(business_name) BETWEEN 2 AND 80),
    business_kind text NOT NULL CHECK (business_kind IN (
        'restaurante', 'lanchonete', 'pizzaria', 'pastelaria', 'sorveteria', 'acai', 'padaria', 'bar',
        'hamburgueria', 'marmitaria', 'confeitaria', 'outro'
    )),
    city text NOT NULL CHECK (length(city) BETWEEN 2 AND 60),
    neighborhood text CHECK (neighborhood IS NULL OR length(neighborhood) BETWEEN 2 AND 60),
    contact_person text CHECK (contact_person IS NULL OR length(contact_person) BETWEEN 2 AND 60),
    phone text CHECK (phone IS NULL OR phone ~ '^55[1-9][1-9][0-9]{8,9}$'),
    phone_hash text CHECK (phone_hash IS NULL OR phone_hash ~ '^[0-9a-f]{64}$'),
    email text CHECK (email IS NULL OR (email = lower(email) AND length(email) <= 200)),
    email_hash text CHECK (email_hash IS NULL OR email_hash ~ '^[0-9a-f]{64}$'),
    instagram text CHECK (instagram IS NULL OR instagram ~ '^[a-z0-9._]{1,30}$'),
    site text CHECK (site IS NULL OR length(site) <= 200),
    source text NOT NULL CHECK (source IN (
        'anuncio_publico', 'site_da_empresa', 'indicacao', 'parceiro', 'pedido_do_contato', 'visita',
        'formulario_do_site'
    )),
    source_note text NOT NULL CHECK (length(source_note) BETWEEN 3 AND 300),
    stage text NOT NULL DEFAULT 'achado' CHECK (stage IN (
        'achado', 'chamado', 'respondeu', 'demonstracao', 'cadastrou', 'pagando', 'nao_quer', 'sem_resposta', 'perdido'
    )),
    touches smallint NOT NULL DEFAULT 0 CHECK (touches BETWEEN 0 AND 10),
    whatsapp_touches smallint NOT NULL DEFAULT 0 CHECK (whatsapp_touches BETWEEN 0 AND 10),
    last_touch_at timestamptz,
    last_channel text CHECK (last_channel IS NULL OR last_channel IN ('whatsapp', 'email', 'ligacao', 'instagram', 'presencial')),
    replied_at timestamptz,
    reply_kind text CHECK (reply_kind IS NULL OR reply_kind IN ('interessado', 'duvida', 'quer_saber_origem', 'adiar')),
    stage_since timestamptz NOT NULL DEFAULT now(),
    snooze_until timestamptz,
    company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
    note text CHECK (note IS NULL OR length(note) <= 300),
    added_by text NOT NULL CHECK (length(added_by) BETWEEN 1 AND 60),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- O mesmo telefone ou e-mail não entra duas vezes (a segunda tentativa devolve o negócio que já existe).
CREATE UNIQUE INDEX IF NOT EXISTS sales_prospects_phone ON sales_prospects (phone_hash) WHERE phone_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_prospects_email ON sales_prospects (email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_prospects_stage ON sales_prospects (stage, stage_since DESC);
CREATE INDEX IF NOT EXISTS sales_prospects_company ON sales_prospects (company_id) WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_events (
    seq bigserial PRIMARY KEY,
    id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    prospect_id uuid NOT NULL REFERENCES sales_prospects(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('criado', 'mensagem', 'resposta', 'etapa', 'adiado', 'nao_quer')),
    channel text CHECK (channel IS NULL OR channel IN ('whatsapp', 'email', 'ligacao', 'instagram', 'presencial')),
    detail text CHECK (detail IS NULL OR length(detail) <= 60),
    by_user text NOT NULL CHECK (length(by_user) BETWEEN 1 AND 60),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_events_prospect ON sales_events (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_events_day ON sales_events (created_at DESC);
