-- When each store was last used (merchant, order, shopper visit) and where it is in the inactive-store stages.
-- Nothing acts on lifecycleState yet: this only starts recording. Additive only; every column optional or defaulted.
-- See docs/plans/2026-11-22-speed-cost-phase-2-migrations.md.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lastMerchantActivityAt" TIMESTAMPTZ;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lastOrderAt" TIMESTAMPTZ;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lastVisitAt" TIMESTAMPTZ;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lifecycleState" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lifecycleChangedAt" TIMESTAMPTZ;

DO $store_lifecycle$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Store_lifecycleState_check') THEN
    ALTER TABLE "Store" ADD CONSTRAINT "Store_lifecycleState_check" CHECK ("lifecycleState" IN ('active', 'quiet', 'paused', 'archived'));
  END IF;
END
$store_lifecycle$;
CREATE INDEX IF NOT EXISTS "Store_lifecycle_idx" ON "Store" ("lifecycleState", "lastMerchantActivityAt");

-- Every stage change, with the reason in plain words and when the merchant was emailed about it.
CREATE TABLE IF NOT EXISTS "StoreLifecycleEvent" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "fromState" TEXT NOT NULL,
  "toState" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "emailedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StoreLifecycleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreLifecycleEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreLifecycleEvent_reason_check" CHECK (char_length("reason") BETWEEN 1 AND 500)
);
CREATE INDEX IF NOT EXISTS "StoreLifecycleEvent_store_idx" ON "StoreLifecycleEvent" ("storeId", "createdAt" DESC);

ALTER TABLE public."StoreLifecycleEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StoreLifecycleEvent" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."StoreLifecycleEvent" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."StoreLifecycleEvent" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."StoreLifecycleEvent" TO jelly_backend;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'StoreLifecycleEvent' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."StoreLifecycleEvent" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$isolate$;

-- Starting values, so no store looks idle on the first day.
UPDATE "Store" SET "lastMerchantActivityAt" = "updatedAt" WHERE "lastMerchantActivityAt" IS NULL;
DO $first_orders$
BEGIN
  IF to_regclass('public."Order"') IS NOT NULL THEN
    UPDATE "Store" s SET "lastOrderAt" = o.latest
    FROM (SELECT "storeId", max("createdAt") AS latest FROM "Order" WHERE "status"::text NOT IN ('CANCELLED', 'PENDING_PAYMENT') GROUP BY "storeId") o
    WHERE o."storeId" = s."id" AND s."lastOrderAt" IS NULL;
  END IF;
END
$first_orders$;
