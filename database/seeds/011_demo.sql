INSERT INTO companies (
    name,
    slug,
    segment,
    subsegment,
    is_online
)
VALUES (
    'Restaurante Exemplo',
    'restaurante-exemplo',
    'Alimentação',
    'Restaurante',
    TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO menus (company_id, name)
SELECT id, 'Lanches'
FROM companies
WHERE slug = 'restaurante-exemplo'
AND NOT EXISTS (
    SELECT 1
    FROM menus
    WHERE company_id = companies.id
    AND name = 'Lanches'
);

INSERT INTO products (
    company_id,
    menu_id,
    name,
    description,
    price
)
SELECT
    c.id,
    cat.id,
    'Hambúrguer',
    'Hambúrguer artesanal',
    25.00
FROM companies c
JOIN menus cat ON cat.company_id = c.id
WHERE c.slug = 'restaurante-exemplo'
AND cat.name = 'Lanches'
AND NOT EXISTS (
    SELECT 1
    FROM products
    WHERE company_id = c.id
    AND name = 'Hambúrguer'
);
