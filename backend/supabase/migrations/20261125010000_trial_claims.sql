-- Billing step 3 (docs/plans/2026-11-25-billing-trial-limits.md): one free trial per owner account and per
-- normalised email. Rows are never deleted (also not when a shop is deleted), so a new shop never brings a new trial.
-- Emails are stored only as SHA-256 of the normalised address (see backend/src/billing/trial-claims.ts).
-- Additive: until this runs every new shop gets a trial, as before.

CREATE TABLE IF NOT EXISTS public."TrialClaim" (
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "storeId" TEXT,
  "claimedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "TrialClaim_pkey" PRIMARY KEY ("kind", "value"),
  CONSTRAINT "TrialClaim_kind_check" CHECK ("kind" IN ('user', 'email')),
  CONSTRAINT "TrialClaim_value_check" CHECK (length("value") BETWEEN 1 AND 128)
);

-- Owners of shops that already had a trial (anything billed and not exempt) have used theirs.
WITH owners AS (
  SELECT DISTINCT ON (u."id") u."id" AS "userId", u."email", b."storeId"
  FROM public."StoreBilling" b
  JOIN public."StoreMembership" m ON m."storeId" = b."storeId" AND m."role" = 'OWNER'
  JOIN public."User" u ON u."id" = m."userId"
  WHERE b."status" <> 'exempt'
  ORDER BY u."id", b."createdAt"
), emails AS (
  SELECT o.*, split_part(lower(trim(o."email")), '@', 2) AS "domain",
         split_part(split_part(lower(trim(o."email")), '@', 1), '+', 1) AS "local"
  FROM owners o WHERE o."email" LIKE '%_@_%'
)
INSERT INTO public."TrialClaim" ("kind", "value", "storeId")
SELECT 'user', "userId"::text, "storeId" FROM owners
UNION ALL
SELECT 'email', encode(sha256(convert_to(
  CASE WHEN "domain" IN ('gmail.com', 'googlemail.com') THEN replace("local", '.', '') || '@gmail.com'
       ELSE "local" || '@' || "domain" END, 'UTF8')), 'hex'), "storeId"
FROM emails
ON CONFLICT DO NOTHING;

ALTER TABLE public."TrialClaim" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."TrialClaim" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."TrialClaim" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."TrialClaim" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    -- Claims are only ever added and read; never changed or removed by the app.
    REVOKE ALL ON public."TrialClaim" FROM jelly_backend;
    GRANT SELECT, INSERT ON public."TrialClaim" TO jelly_backend;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'TrialClaim' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."TrialClaim" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$isolate$;
