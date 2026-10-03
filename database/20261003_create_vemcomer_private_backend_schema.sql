BEGIN;

CREATE SCHEMA vemcomer;

CREATE TABLE vemcomer.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    segment VARCHAR(100),
    subsegment VARCHAR(100),
    is_online BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vemcomer.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES vemcomer.companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('OWNER','MANAGER','WAITER','CASHIER','KITCHEN','COURIER')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, email)
);

CREATE TABLE vemcomer.menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES vemcomer.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE vemcomer.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES vemcomer.companies(id) ON DELETE CASCADE,
    menu_id UUID REFERENCES vemcomer.menus(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vemcomer.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES vemcomer.companies(id) ON DELETE CASCADE,
    number INTEGER NOT NULL CHECK (number > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'livre' CHECK (status IN ('livre','ocupada')),
    UNIQUE (company_id, number)
);

CREATE TABLE vemcomer.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES vemcomer.companies(id),
    table_id UUID REFERENCES vemcomer.tables(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT','em preparo','concluido')),
    total_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('pix','cartao','dinheiro')),
    payment_change NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (payment_change >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vemcomer.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES vemcomer.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES vemcomer.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0)
);

CREATE TABLE vemcomer.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES vemcomer.orders(id),
    method VARCHAR(30) NOT NULL CHECK (method IN ('PIX','CARD','CASH')),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    transaction_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE TABLE vemcomer.order_events (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES vemcomer.orders(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vemcomer.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES vemcomer.companies(id),
    food_rating VARCHAR(30),
    service_rating VARCHAR(30),
    delivery_rating VARCHAR(30),
    comment VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_company ON vemcomer.users(company_id);
CREATE INDEX idx_products_company ON vemcomer.products(company_id);
CREATE INDEX idx_orders_company ON vemcomer.orders(company_id);
CREATE INDEX idx_orders_status ON vemcomer.orders(status);
CREATE INDEX idx_order_events_order ON vemcomer.order_events(order_id);

ALTER TABLE vemcomer.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vemcomer.feedbacks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA vemcomer FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA vemcomer FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA vemcomer FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA vemcomer
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA vemcomer
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;