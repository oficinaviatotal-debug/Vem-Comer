-- Entrega e retirada (pedido do GD, 07/10/2026: "o que eu vendo e cardapio, venda e entrega"; requisitos 7, 42, 62).
--
-- O restaurante cadastra as regioes que atende. Cada regiao cobre o COMECO de alguns CEPs ("30140" cobre de
-- 30140-000 a 30140-999), com taxa, pedido minimo e prazo combinado. Sem servico de mapa pago: o CEP decide.
-- O cliente informa o CEP e o endereco; o servidor acha a regiao, confere o minimo e SOMA a taxa ao total.
--
-- O tipo, a taxa, a regiao e o endereco ficam COPIADOS no pedido: mudar ou apagar a regiao depois nao altera
-- o pedido de hoje. Endereco e telefone sao dados pessoais (LGPD): so o dono do restaurante e o proprio cliente,
-- pelo codigo de acompanhamento, leem.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
CREATE TABLE IF NOT EXISTS delivery_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name varchar(60) NOT NULL,
    cep_prefixes text[] NOT NULL CHECK (cardinality(cep_prefixes) BETWEEN 1 AND 40),
    fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
    min_order numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
    eta_minutes smallint CHECK (eta_minutes BETWEEN 5 AND 240),
    active boolean NOT NULL DEFAULT true,
    position smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_zones_company ON delivery_zones (company_id, position);

-- Retirada no local: ligada por padrao. Pausa da entrega: o dono para as entregas por um tempo sem apagar nada.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accepts_pickup boolean NOT NULL DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS delivery_paused boolean NOT NULL DEFAULT false;

-- 'mesa' (QR da mesa), 'retirada', 'entrega' e 'balcao' (pedido sem tipo: o que sempre existiu).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type varchar(10) NOT NULL DEFAULT 'balcao'
    CHECK (order_type IN ('mesa', 'retirada', 'entrega', 'balcao'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone varchar(60);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone varchar(15);

-- Pedidos de mesa que ja existem: eram os que tinham mesa.
UPDATE orders SET order_type = 'mesa' WHERE table_id IS NOT NULL AND order_type = 'balcao';
