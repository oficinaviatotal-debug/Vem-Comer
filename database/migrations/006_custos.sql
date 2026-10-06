-- Custo do prato, porcao e CMV (item 6 da ordem de trabalho).
--
-- 1) ingredients: o que o restaurante compra (insumo), com o tamanho da embalagem e o preco pago.
--    A quantidade fica guardada na unidade base: g (para kg e g), ml (para L e ml) ou un (unidade, duzia).
--    Ex.: "Frango, 1 kg por R$ 18,90" fica unit='g', package_qty=1000, package_price=18.90.
-- 2) product_ingredients: a ficha tecnica do prato (quanto de cada insumo vai em uma porcao),
--    na mesma unidade base do insumo. Apagar o prato ou o insumo apaga a linha da ficha.
-- 3) products.portion: o tamanho da porcao, em palavras do dono ("1 pessoa", "300 g").
--    products.extra_cost: outros custos por prato que nao sao insumo (embalagem, gas), em reais.
-- 4) order_items.unit_cost: o custo do prato no momento do pedido. Assim o CMV de um mes antigo nao
--    muda quando o preco do frango sobe. Vazio quando o prato ainda nao tinha ficha.
-- 5) companies.cmv_target: meta de CMV do restaurante, em % do preco. Comeca em 35 (o Sebrae cita
--    25% a 35% como faixa boa para restaurante); o dono muda.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
CREATE TABLE IF NOT EXISTS ingredients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name varchar(80) NOT NULL,
    unit varchar(2) NOT NULL CHECK (unit IN ('g', 'ml', 'un')),
    package_qty numeric(12,3) NOT NULL CHECK (package_qty > 0),
    package_price numeric(10,2) NOT NULL CHECK (package_price >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ingredients_company_name ON ingredients (company_id, lower(name));

CREATE TABLE IF NOT EXISTS product_ingredients (
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS product_ingredients_ingredient ON product_ingredients (ingredient_id);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS portion varchar(60),
    ADD COLUMN IF NOT EXISTS extra_cost numeric(10,2) NOT NULL DEFAULT 0 CHECK (extra_cost >= 0);

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2) CHECK (unit_cost >= 0);

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS cmv_target smallint NOT NULL DEFAULT 35 CHECK (cmv_target BETWEEN 5 AND 90);
