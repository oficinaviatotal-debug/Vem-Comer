-- Provisionamento do papel dedicado do backend Vem Comer.
-- A senha NAO deve ser armazenada neste arquivo ou no Git.
-- Defina a senha forte fora do repositorio antes de executar o CREATE ROLE.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'vemcomer_app'
    ) THEN
        CREATE ROLE vemcomer_app LOGIN;
    END IF;
END
$$;

REVOKE ALL ON SCHEMA public FROM vemcomer_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM vemcomer_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM vemcomer_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM vemcomer_app;

GRANT USAGE ON SCHEMA vemcomer TO vemcomer_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    vemcomer.companies,
    vemcomer.users,
    vemcomer.menus,
    vemcomer.products,
    vemcomer.tables,
    vemcomer.orders,
    vemcomer.order_items,
    vemcomer.payments,
    vemcomer.order_events,
    vemcomer.feedbacks
TO vemcomer_app;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA vemcomer TO vemcomer_app;

-- Prova efetiva de privilégios:
SELECT
    has_schema_privilege('vemcomer_app', 'vemcomer', 'USAGE') AS vemcomer_usage,
    has_table_privilege('vemcomer_app', 'vemcomer.companies', 'SELECT') AS companies_select,
    has_table_privilege('vemcomer_app', 'vemcomer.companies', 'INSERT') AS companies_insert,
    has_table_privilege('vemcomer_app', 'vemcomer.companies', 'UPDATE') AS companies_update,
    has_table_privilege('vemcomer_app', 'vemcomer.companies', 'DELETE') AS companies_delete,
    has_table_privilege('vemcomer_app', 'public.orders', 'SELECT') AS public_orders_select,
    has_table_privilege('vemcomer_app', 'public.orders', 'INSERT') AS public_orders_insert,
    has_table_privilege('vemcomer_app', 'public.orders', 'UPDATE') AS public_orders_update,
    has_table_privilege('vemcomer_app', 'public.orders', 'DELETE') AS public_orders_delete;

-- Esperado:
-- vemcomer_usage = true
-- companies_* = true
-- public.orders_* = false
