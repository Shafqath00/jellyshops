ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "configurationSnapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "configurationKey" TEXT NOT NULL DEFAULT '';

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_pkey";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("orderId", "variantId", "configurationKey");
