-- Motoqueiro, primeiro pedaco (requisito 42): codigo de entrega, quem levou, hora de cada passo e o dinheiro que o
-- motoqueiro recebeu ate o acerto com o caixa.
--
-- O cliente recebe um CODIGO de 4 numeros ao fazer o pedido de entrega e so o passa ao motoqueiro quando recebe o
-- pedido. O motoqueiro so fecha a entrega digitando esse codigo. Errou 5 vezes, trava: o restaurante fecha pela tela dele.
-- Pedidos de entrega que ja existem ficam sem codigo (coluna vazia) e fecham como sempre fecharam.
--
-- Dinheiro: quando o cliente paga em dinheiro, o valor do pedido fica "em aberto" em nome do motoqueiro
-- (cash_received) ate o caixa fazer o acerto (cash_settled_at). Pix e cartao nao entram aqui.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_code varchar(4);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS code_attempts smallint NOT NULL DEFAULT 0 CHECK (code_attempts >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_received numeric(10,2) CHECK (cash_received >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_settled_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_settled_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- A tela do motoqueiro e o acerto do caixa olham so os pedidos de entrega ainda abertos ou com dinheiro em aberto.
CREATE INDEX IF NOT EXISTS orders_courier_open ON orders (company_id, status)
    WHERE order_type = 'entrega';
CREATE INDEX IF NOT EXISTS orders_cash_open ON orders (company_id, courier_id)
    WHERE cash_received IS NOT NULL AND cash_settled_at IS NULL;
