-- The backend may read platform admins but never add, change or remove them (they are added by hand in SQL), and
-- may only add entries to their log, never change or remove them. 20261122050000 granted only those rights, but
-- the schema's default privileges (20261020143750_backend_runtime_role) had already given new tables full rights:
-- take the extra ones back. Additive and safe to run twice.
DO $read_only$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."PlatformAdmin" FROM jelly_backend;
    REVOKE UPDATE, DELETE, TRUNCATE ON public."PlatformAuditEvent" FROM jelly_backend;
  END IF;
END
$read_only$;
