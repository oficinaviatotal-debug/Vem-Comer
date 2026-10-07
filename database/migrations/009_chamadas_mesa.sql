-- Mesa viva: o cliente toca na tela da mesa (Chamar garcom, Pedir a conta, Agua, Limpeza) e o painel
-- do restaurante avisa na hora (pedido do GD, 07/10/2026, requisito 57).
--
-- Uma linha por chamada. Enquanto ninguem atende, o status fica "open"; quando alguem do restaurante
-- toca em Atender, vira "answered" e guarda a hora e quem atendeu. O tempo entre as duas horas e o
-- numero que vira a meta do garcom. Se o cliente toca de novo no mesmo pedido ainda aberto, nao nasce
-- outra linha: so sobe o contador "repeats" (o painel mostra que o cliente chamou de novo).
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
CREATE TABLE IF NOT EXISTS table_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    kind varchar(12) NOT NULL CHECK (kind IN ('garcom', 'conta', 'agua', 'limpeza')),
    status varchar(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
    repeats smallint NOT NULL DEFAULT 0 CHECK (repeats BETWEEN 0 AND 9),
    created_at timestamptz NOT NULL DEFAULT now(),
    answered_at timestamptz,
    answered_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS table_calls_open ON table_calls (company_id, status, created_at);
CREATE INDEX IF NOT EXISTS table_calls_table ON table_calls (table_id, kind, status);
