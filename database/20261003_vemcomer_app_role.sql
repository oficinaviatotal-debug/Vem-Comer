-- Provisionamento do papel dedicado do backend Vem Comer.
-- A senha NAO deve ser armazenada neste arquivo ou no Git.
-- O papel permanece NOLOGIN ate a definicao da senha no Supabase.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'vemcomer_app'
    ) THEN
        CREATE ROLE vemcomer_app NOLOGIN;
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

CREATE POLICY vemcomer_app_all ON vemcomer.companies FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.users FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.menus FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.products FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.tables FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.orders FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.order_items FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.payments FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.order_events FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);
CREATE POLICY vemcomer_app_all ON vemcomer.feedbacks FOR ALL TO vemcomer_app USING (true) WITH CHECK (true);

-- Prova de privilegios:
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