ALTER TABLE "StripeConnectedAccount"
  DROP CONSTRAINT IF EXISTS "StripeConnectedAccount_pkey";

ALTER TABLE "StripeConnectedAccount"
  ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS "StripeConnectedAccount_current_store_idx"
  ON "StripeConnectedAccount" ("storeId")
  WHERE "isCurrent" = TRUE;
