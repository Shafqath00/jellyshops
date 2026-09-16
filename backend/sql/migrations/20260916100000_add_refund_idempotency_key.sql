ALTER TABLE "Refund" ADD COLUMN "stripeIdempotencyKey" TEXT;
UPDATE "Refund" SET "stripeIdempotencyKey" = 'refund-' || "id" WHERE "stripeIdempotencyKey" IS NULL;
ALTER TABLE "Refund" ALTER COLUMN "stripeIdempotencyKey" SET NOT NULL;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_stripeIdempotencyKey_key" UNIQUE ("stripeIdempotencyKey");
