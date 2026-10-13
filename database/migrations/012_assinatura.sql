-- Assinatura do restaurante (requisito 66, fala do GD em 07/10/2026): so o uso da plataforma, R$ 190 por mes,
-- pago no primeiro dia, vence no dia do mes em que entrou e bloqueia no dia seguinte.
--
-- Esta migracao so GUARDA os dados. Nada bloqueia enquanto o administrador nao ligar BILLING_ENFORCED=1 no servidor,
-- e restaurante sem linha em `subscriptions` (os de teste e os que o proprio GD criou) nunca e bloqueado.
--
-- A situacao (em dia, vencendo, vencida) NAO fica gravada: o servidor calcula pela data de hoje e por `paid_until`,
-- entao nao existe tarefa diaria que possa parar de rodar e deixar um restaurante bloqueado ou liberado por engano.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
CREATE TABLE IF NOT EXISTS plans (
    code varchar(40) PRIMARY KEY,
    name varchar(100) NOT NULL,
    price_cents integer NOT NULL CHECK (price_cents >= 0),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plans (code, name, price_cents)
VALUES ('vemcomer_mensal', 'Vem Comer: so o uso da plataforma, por mes', 19000)
ON CONFLICT (code) DO NOTHING;

-- Uma linha por restaurante. `price_cents` e COPIADO do plano na entrada: subir o preco depois vale so para quem
-- entrar depois ("quem entrou mais barato mantem o preco"). `anchor_day` e o dia do mes do vencimento (o dia em que
-- pagou pela primeira vez); NULL e `paid_until` NULL = ainda nao pagou o primeiro mes. `paid_until` e o ULTIMO dia
-- coberto: no dia seguinte, sem novo pagamento, bloqueia.
CREATE TABLE IF NOT EXISTS subscriptions (
    company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    plan_code varchar(40) NOT NULL REFERENCES plans(code),
    price_cents integer NOT NULL CHECK (price_cents >= 0),
    anchor_day smallint CHECK (anchor_day BETWEEN 1 AND 31),
    paid_until date,
    canceled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cada pagamento recebido. Nunca se apaga nem se altera: e o recibo.
CREATE TABLE IF NOT EXISTS subscription_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    amount_cents integer NOT NULL CHECK (amount_cents > 0),
    period_start date NOT NULL,
    period_end date NOT NULL,
    method varchar(20) NOT NULL DEFAULT 'pix' CHECK (method IN ('pix', 'dinheiro', 'transferencia', 'outro')),
    reference varchar(120),
    recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    paid_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_payments_company ON subscription_payments (company_id, paid_at DESC);
