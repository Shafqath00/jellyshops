-- Billing step 2 (docs/plans/2026-11-25-billing-trial-limits.md): grace period after a failed payment, an 'expired'
-- status for trials that ended without payment, and a record of billing emails so each one goes once.
-- Additive: the code checks for the new column and table and works the old way until this runs.

ALTER TABLE public."StoreBilling" ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMPTZ;

ALTER TABLE public."StoreBilling" DROP CONSTRAINT IF EXISTS "StoreBilling_status_check";
ALTER TABLE public."StoreBilling" ADD CONSTRAINT "StoreBilling_status_check"
  CHECK ("status" IN ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired', 'exempt'));

CREATE INDEX IF NOT EXISTS "StoreBilling_grace_idx" ON public."StoreBilling" ("graceEndsAt") WHERE "status" = 'past_due';

-- One row per email sent: "trial-day-10", "trial-day-13", "trial-ended", "payment-failed:<grace end>",
-- "shop-closed:<grace end>". The primary key makes sending once safe across several server instances.
CREATE TABLE IF NOT EXISTS public."BillingReminder" (
  "storeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sentTo" TEXT,
  "sentAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "BillingReminder_pkey" PRIMARY KEY ("storeId", "kind"),
  CONSTRAINT "BillingReminder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES public."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BillingReminder_kind_check" CHECK (length("kind") BETWEEN 1 AND 80)
);

ALTER TABLE public."BillingReminder" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."BillingReminder" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."BillingReminder" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."BillingReminder" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."BillingReminder" TO jelly_backend;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'BillingReminder' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."BillingReminder" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$isolate$;
