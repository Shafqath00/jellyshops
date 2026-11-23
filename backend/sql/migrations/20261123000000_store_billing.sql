-- Billing state, one row per shop (docs/plans/2026-11-23-phase-4-billing-and-limits.md, step 4b).
-- The plans themselves and their limits live in code (backend/src/billing/plans.ts). A shop with no row is on the
-- default plan and never paused, so the code works before this runs. Every shop that exists when this runs is marked
-- 'exempt' (never limited, never charged; owner decision 2026-11-23). Additive only.
CREATE TABLE IF NOT EXISTS "StoreBilling" (
  "storeId" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'standard',
  "status" TEXT NOT NULL,
  "trialEndsAt" TIMESTAMPTZ,
  "currentPeriodEnd" TIMESTAMPTZ,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StoreBilling_pkey" PRIMARY KEY ("storeId"),
  CONSTRAINT "StoreBilling_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreBilling_status_check" CHECK ("status" IN ('trialing', 'active', 'past_due', 'paused', 'canceled', 'exempt')),
  CONSTRAINT "StoreBilling_plan_check" CHECK ("plan" ~ '^[a-z][a-z0-9-]{0,31}$'),
  CONSTRAINT "StoreBilling_trial_check" CHECK ("status" <> 'trialing' OR "trialEndsAt" IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoreBilling_subscription_key" ON "StoreBilling" ("stripeSubscriptionId") WHERE "stripeSubscriptionId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "StoreBilling_customer_idx" ON "StoreBilling" ("stripeCustomerId") WHERE "stripeCustomerId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "StoreBilling_trial_idx" ON "StoreBilling" ("trialEndsAt") WHERE "status" = 'trialing';

INSERT INTO "StoreBilling" ("storeId", "status")
SELECT "id", 'exempt' FROM "Store"
ON CONFLICT ("storeId") DO NOTHING;

ALTER TABLE public."StoreBilling" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StoreBilling" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."StoreBilling" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."StoreBilling" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."StoreBilling" TO jelly_backend;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'StoreBilling' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."StoreBilling" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$isolate$;
