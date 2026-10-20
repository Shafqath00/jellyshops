-- Application data is served by Express, never directly by browser database roles.
-- Run as the application migration owner. Does not touch auth/storage/extensions.
DO $isolation$
DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT c.oid, n.nspname, c.relname, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
  LOOP
    IF relation.relkind = 'S' THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC, anon, authenticated', relation.nspname, relation.relname);
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC, anon, authenticated', relation.nspname, relation.relname);
      IF relation.relkind IN ('r', 'p') THEN
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', relation.nspname, relation.relname);
      END IF;
    END IF;
  END LOOP;
  FOR relation IN
    SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', relation.signature);
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp', relation.signature);
  END LOOP;
END
$isolation$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
