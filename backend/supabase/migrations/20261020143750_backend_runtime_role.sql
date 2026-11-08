-- Credentials are provisioned per environment; this group role cannot log in.
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    CREATE ROLE jelly_backend NOLOGIN NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$role$;
GRANT USAGE ON SCHEMA public TO jelly_backend;
DO $permissions$
DECLARE relation record;
BEGIN
  FOR relation IN SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO jelly_backend', relation.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation.relname);
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = relation.oid AND polname = 'jelly_backend_access') THEN
      EXECUTE format('CREATE POLICY jelly_backend_access ON public.%I TO jelly_backend USING (true) WITH CHECK (true)', relation.relname);
    END IF;
  END LOOP;
END
$permissions$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jelly_backend;
REVOKE DELETE ON "User", "Store", "Order", "OrderItem", "Payment", "Refund", "StripeWebhookEvent" FROM jelly_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jelly_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO jelly_backend;
-- Future tables still need explicit RLS and a backend policy in their migration.
