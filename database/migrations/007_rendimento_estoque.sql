-- Rendimento da receita, aproveitamento do insumo e estoque pela ficha (continuacao do 006).
--
-- 1) products.yield_portions: quantas porcoes a receita rende. A ficha guarda a receita inteira
--    (ex.: 1,2 kg de peito para um frango a milanesa que rende 6 pratos); o custo da porcao e o
--    custo da receita dividido por esse numero. 1 = a ficha ja e de uma porcao (como no 006).
-- 2) products.portion_grams: o peso de cada porcao servida, em gramas (padronizacao). Opcional.
-- 3) ingredients.yield_pct: aproveitamento do insumo, em %. Ex.: 1 kg de peito, limpo, vira 850 g = 85.
--    As quantidades da ficha sao do insumo ja limpo; o custo usa o aproveitamento.
-- 4) ingredients.stock_qty e stock_at: o que havia no estoque (contagem ou compra) e quando.
--    O estoque de agora e esse numero menos o que as vendas aceitas gastaram depois, pela ficha.
--    Vazio = o restaurante nao controla o estoque deste insumo.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS yield_portions smallint NOT NULL DEFAULT 1 CHECK (yield_portions BETWEEN 1 AND 500),
    ADD COLUMN IF NOT EXISTS portion_grams numeric(8,1) CHECK (portion_grams > 0);

ALTER TABLE ingredients
    ADD COLUMN IF NOT EXISTS yield_pct smallint NOT NULL DEFAULT 100 CHECK (yield_pct BETWEEN 1 AND 100),
    ADD COLUMN IF NOT EXISTS stock_qty numeric(12,3) CHECK (stock_qty >= 0),
    ADD COLUMN IF NOT EXISTS stock_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_company_created ON orders (company_id, created_at);
