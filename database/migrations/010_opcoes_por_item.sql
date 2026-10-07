-- Opcoes por item: tamanho, adicionais, sabor, "sem cebola" e observacao (pedido do GD, 07/10/2026,
-- requisitos 66 e 67; lacuna apontada em docs/matriz-de-capacidade.md).
--
-- O dono monta, para cada prato, grupos de escolha. Exemplo de um acai:
--   Tamanho      (escolher 1, obrigatorio)  300 ml, 500 ml +R$ 6,00, 700 ml +R$ 11,00
--   Adicionais   (ate 5, opcional)          Leite ninho +R$ 3,00, Banana, Granola
--   Retirar      (ate 3, opcional)          Sem leite condensado, Sem granola
-- O preco do prato e o preco base; cada opcao soma o seu "price_delta" (nunca negativo).
--
-- O que o cliente escolheu fica COPIADO na linha do pedido (order_items.options, em jsonb): se o dono
-- mudar o preco do tamanho amanha, o pedido de hoje continua com o que o cliente viu e pagou.
-- O servidor recalcula o preco com as opcoes; o valor que o celular manda nunca vale.
--
-- Seguro para rodar mais de uma vez. O instalador roda esta migracao ANTES de subir a nova versao.
CREATE TABLE IF NOT EXISTS option_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name varchar(60) NOT NULL,
    min_choices smallint NOT NULL DEFAULT 0 CHECK (min_choices BETWEEN 0 AND 20),
    max_choices smallint NOT NULL DEFAULT 1 CHECK (max_choices BETWEEN 1 AND 20),
    position smallint NOT NULL DEFAULT 0,
    CHECK (max_choices >= min_choices)
);

CREATE INDEX IF NOT EXISTS option_groups_product ON option_groups (product_id, position);
CREATE INDEX IF NOT EXISTS option_groups_company ON option_groups (company_id);

CREATE TABLE IF NOT EXISTS option_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    name varchar(60) NOT NULL,
    price_delta numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
    -- Desligar uma opcao ("acabou o bacon") sem apagar: some do cardapio, o pedido antigo fica igual.
    active boolean NOT NULL DEFAULT true,
    position smallint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS option_items_group ON option_items (group_id, position);

-- O que o cliente escolheu: [{"group": "Tamanho", "name": "500 ml", "price": "6.00"}, ...]
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Observacao livre do cliente para a cozinha ("sem cebola", "bem passado"). Curta de proposito.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS note varchar(140);
