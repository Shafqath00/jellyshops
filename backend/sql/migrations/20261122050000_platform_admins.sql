-- Platform super-admins (platform.jellyshop.io) and a log of what they do.
-- Rows in "PlatformAdmin" are added by hand in SQL only (never through the app), for example:
--   INSERT INTO "PlatformAdmin" ("userId", "role", "createdBy")
--   SELECT "id", 'OWNER', 'initial setup' FROM "User" WHERE "email" = '<owner email>';
-- See docs/plans/2026-11-22-subdomain-tenancy-plan.md section 6 (platform admin) and step 9. Additive only.
CREATE TABLE IF NOT EXISTS "PlatformAdmin" (
  "userId" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdBy" TEXT NOT NULL,
  CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "PlatformAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformAdmin_role_check" CHECK ("role" IN ('OWNER', 'SUPPORT')),
  CONSTRAINT "PlatformAdmin_createdBy_check" CHECK (char_length("createdBy") BETWEEN 1 AND 200)
);

-- Every platform-admin action, kept apart from the per-shop "AuditEvent" log (these may not belong to one shop).
CREATE TABLE IF NOT EXISTS "PlatformAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "storeId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PlatformAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformAuditEvent_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlatformAuditEvent_action_check" CHECK (char_length("action") BETWEEN 1 AND 100)
);
CREATE INDEX IF NOT EXISTS "PlatformAuditEvent_created_idx" ON "PlatformAuditEvent" ("createdAt" DESC);

DO $isolate$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['PlatformAdmin', 'PlatformAuditEvent'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon', table_name); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', table_name); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
      -- The app may read admins but never add or change them; it may only add log entries.
      IF table_name = 'PlatformAdmin' THEN
        EXECUTE format('GRANT SELECT ON public.%I TO jelly_backend', table_name);
      ELSE
        EXECUTE format('GRANT SELECT, INSERT ON public.%I TO jelly_backend', table_name);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = table_name AND policyname = 'backend_access') THEN
        EXECUTE format('CREATE POLICY backend_access ON public.%I TO jelly_backend USING (true) WITH CHECK (true)', table_name);
      END IF;
    END IF;
  END LOOP;
END
$isolate$;
