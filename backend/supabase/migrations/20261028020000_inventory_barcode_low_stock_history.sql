-- Barcode and low-stock threshold per variant, and an append-only log of every on-hand stock change.

ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "barcode" TEXT,
  ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER;

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_barcode_check" CHECK ("barcode" IS NULL OR length("barcode") BETWEEN 1 AND 64),
  ADD CONSTRAINT "ProductVariant_lowStockThreshold_check" CHECK ("lowStockThreshold" IS NULL OR "lowStockThreshold" >= 0);

CREATE INDEX IF NOT EXISTS "ProductVariant_storeId_barcode_idx" ON "ProductVariant"("storeId", "barcode") WHERE "barcode" IS NOT NULL;

CREATE TABLE "InventoryAdjustment" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryAdjustment_reason_check" CHECK ("reason" IN ('initial', 'sale', 'restock', 'manual')),
    CONSTRAINT "InventoryAdjustment_delta_check" CHECK ("quantityDelta" <> 0),
    CONSTRAINT "InventoryAdjustment_variant_fkey" FOREIGN KEY ("storeId", "variantId") REFERENCES "ProductVariant"("storeId", "id") ON DELETE CASCADE
);

CREATE INDEX "InventoryAdjustment_storeId_variantId_id_idx" ON "InventoryAdjustment"("storeId", "variantId", "id" DESC);

-- Every path that changes on-hand stock (checkout settlement, refunds, order edits, the stock page, the
-- product editor) updates "InventoryLevel", so one trigger records them all. Callers that know why stock
-- changed set transaction-local settings (jelly.inventory_reason / _note / _actor); otherwise a decrease is
-- a sale and an increase is a restock. Reservations (the "reserved" column) are not logged.
-- SECURITY DEFINER so a writer without direct access to the log can never have its stock update blocked by it.
CREATE FUNCTION jelly_log_inventory_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $log$
DECLARE
  delta INTEGER;
  kind TEXT;
  note TEXT;
  actor TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := NEW."quantity";
    kind := 'initial';
  ELSE
    delta := NEW."quantity" - OLD."quantity";
    kind := CASE WHEN delta < 0 THEN 'sale' ELSE 'restock' END;
  END IF;
  IF delta = 0 THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND nullif(current_setting('jelly.inventory_reason', true), '') = 'manual' THEN
    kind := 'manual';
    note := left(nullif(current_setting('jelly.inventory_note', true), ''), 500);
    actor := nullif(current_setting('jelly.inventory_actor', true), '');
  END IF;
  INSERT INTO "InventoryAdjustment" ("storeId", "variantId", "quantityDelta", "quantityAfter", "reason", "note", "actor")
  VALUES (NEW."storeId", NEW."variantId", delta, NEW."quantity", kind, note, actor);
  RETURN NULL;
END
$log$;

REVOKE ALL ON FUNCTION jelly_log_inventory_change() FROM PUBLIC;

CREATE TRIGGER "InventoryLevel_log_change"
AFTER INSERT OR UPDATE OF "quantity" ON "InventoryLevel"
FOR EACH ROW EXECUTE FUNCTION jelly_log_inventory_change();

-- Backend service credentials own these records. No direct Data API access.
ALTER TABLE "InventoryAdjustment" ENABLE ROW LEVEL SECURITY;
DO $isolate$
BEGIN
  REVOKE ALL ON public."InventoryAdjustment" FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."InventoryAdjustment" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."InventoryAdjustment" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT ON public."InventoryAdjustment" TO jelly_backend;
    CREATE POLICY backend_access ON public."InventoryAdjustment" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
