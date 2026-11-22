-- Indexes for foreign keys that had none (listed by the Supabase performance advisor on 2026-11-20).
-- Deleting a store, product or order makes Postgres check every table pointing at it; without these indexes each
-- check reads the whole child table. Additive only.
-- On a large database build these with CREATE INDEX CONCURRENTLY, one statement at a time, outside a transaction.
CREATE INDEX IF NOT EXISTS "BackInStockRequest_productId_idx" ON "BackInStockRequest" ("productId");
CREATE INDEX IF NOT EXISTS "BackInStockRequest_variantId_idx" ON "BackInStockRequest" ("variantId");
CREATE INDEX IF NOT EXISTS "DigitalAsset_storeId_productId_idx" ON "DigitalAsset" ("storeId", "productId");
CREATE INDEX IF NOT EXISTS "DigitalDownloadAttempt_entitlementId_idx" ON "DigitalDownloadAttempt" ("entitlementId");
CREATE INDEX IF NOT EXISTS "DigitalEntitlement_storeId_assetId_idx" ON "DigitalEntitlement" ("storeId", "assetId");
CREATE INDEX IF NOT EXISTS "OrderEditHold_revisionId_storeId_idx" ON "OrderEditHold" ("revisionId", "storeId");
CREATE INDEX IF NOT EXISTS "OrderEditHold_storeId_variantId_idx" ON "OrderEditHold" ("storeId", "variantId");
CREATE INDEX IF NOT EXISTS "OrderFulfilment_storeId_orderId_idx" ON "OrderFulfilment" ("storeId", "orderId");
CREATE INDEX IF NOT EXISTS "OrderNote_storeId_orderId_idx" ON "OrderNote" ("storeId", "orderId");
CREATE INDEX IF NOT EXISTS "OrderNotification_storeId_orderId_idx" ON "OrderNotification" ("storeId", "orderId");
CREATE INDEX IF NOT EXISTS "OrderReturn_storeId_orderId_idx" ON "OrderReturn" ("storeId", "orderId");
CREATE INDEX IF NOT EXISTS "OrderTransaction_revisionId_idx" ON "OrderTransaction" ("revisionId");
CREATE INDEX IF NOT EXISTS "OrderTransaction_storeId_revisionId_idx" ON "OrderTransaction" ("storeId", "revisionId");
CREATE INDEX IF NOT EXISTS "OrderTransaction_storeId_orderId_idx" ON "OrderTransaction" ("storeId", "orderId");
CREATE INDEX IF NOT EXISTS "ProductReview_productId_idx" ON "ProductReview" ("productId");
CREATE INDEX IF NOT EXISTS "ThemeInstall_packageId_idx" ON "ThemeInstall" ("packageId");
CREATE INDEX IF NOT EXISTS "ThemeInstall_versionId_idx" ON "ThemeInstall" ("versionId");
CREATE INDEX IF NOT EXISTS "ThemeUpgradeBackup_fromVersionId_idx" ON "ThemeUpgradeBackup" ("fromVersionId");
CREATE INDEX IF NOT EXISTS "ThemeUpgradeBackup_packageId_idx" ON "ThemeUpgradeBackup" ("packageId");
CREATE INDEX IF NOT EXISTS "ThemeUpgradeBackup_toVersionId_idx" ON "ThemeUpgradeBackup" ("toVersionId");
