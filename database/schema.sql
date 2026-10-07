CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    segment VARCHAR(100),
    subsegment VARCHAR(100),
    is_online BOOLEAN NOT NULL DEFAULT TRUE,
    pix_key_type VARCHAR(10) CHECK (pix_key_type IN ('cpf', 'cnpj', 'phone', 'email', 'random')),
    pix_key VARCHAR(77),
    pix_receiver_name VARCHAR(25),
    pix_city VARCHAR(15),
    logo_key VARCHAR(32),
    owner_phone VARCHAR(20),
    terms_version VARCHAR(20),
    terms_accepted_at TIMESTAMPTZ,
    signup_source VARCHAR(20),
    cmv_target SMALLINT NOT NULL DEFAULT 35 CHECK (cmv_target BETWEEN 5 AND 90),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_hours (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    opens_at TIME,
    closes_at TIME,
    accepts_orders BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (company_id, weekday)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (
        role IN (
            'OWNER',
            'MANAGER',
            'WAITER',
            'CASHIER',
            'KITCHEN',
            'COURIER'
        )
    ),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, email)
);

CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    image_key VARCHAR(32),
    portion VARCHAR(60),
    extra_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (extra_cost >= 0),
    yield_portions SMALLINT NOT NULL DEFAULT 1 CHECK (yield_portions BETWEEN 1 AND 500),
    portion_grams NUMERIC(8,1) CHECK (portion_grams > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    unit VARCHAR(2) NOT NULL CHECK (unit IN ('g', 'ml', 'un')),
    package_qty NUMERIC(12,3) NOT NULL CHECK (package_qty > 0),
    package_price NUMERIC(10,2) NOT NULL CHECK (package_price >= 0),
    yield_pct SMALLINT NOT NULL DEFAULT 100 CHECK (yield_pct BETWEEN 1 AND 100),
    stock_qty NUMERIC(12,3) CHECK (stock_qty >= 0),
    stock_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ingredients_company_name ON ingredients (company_id, lower(name));

CREATE TABLE product_ingredients (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (product_id, ingredient_id)
);

CREATE INDEX product_ingredients_ingredient ON product_ingredients (ingredient_id);

CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    number INTEGER NOT NULL CHECK (number > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'livre' CHECK (status IN ('livre', 'ocupada')),
    UNIQUE (company_id, number)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
    total_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('pix', 'cartao', 'dinheiro')),
    payment_change NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (payment_change >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    unit_cost NUMERIC(10,2) CHECK (unit_cost >= 0)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
    method VARCHAR(30) NOT NULL CHECK (method IN ('PIX', 'CARD', 'CASH')),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    transaction_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE TABLE order_events (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    food_rating VARCHAR(30),
    service_rating VARCHAR(30),
    delivery_rating VARCHAR(30),
    comment VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_events_order ON order_events(order_id);
CREATE UNIQUE INDEX users_email_unique ON users(lower(email));
