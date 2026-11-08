-- What the variant's shipping details were when the customer ordered it, so editing a product later never
-- rewrites an old order. Needs the columns from 20261028040000_variant_shipping_details.sql.

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "shippingSnapshot" JSONB;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_shippingSnapshot_check" CHECK ("shippingSnapshot" IS NULL OR jsonb_typeof("shippingSnapshot") = 'object');

-- Fills the snapshot for every new order line, whichever code path creates it (checkout, order edits, imports).
-- An explicit snapshot is kept as it is: order edits re-insert unchanged lines and must not take today's values.
CREATE FUNCTION jelly_snapshot_order_item_shipping() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $snapshot$
DECLARE
  details JSONB;
BEGIN
  IF NEW."shippingSnapshot" IS NOT NULL THEN RETURN NEW; END IF;
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'weightGrams', v."weightGrams", 'lengthMm', v."lengthMm", 'widthMm', v."widthMm", 'heightMm', v."heightMm",
    'countryOfOrigin', v."countryOfOrigin", 'hsCode', v."hsCode"))
  INTO details
  FROM "ProductVariant" v WHERE v."storeId" = NEW."storeId" AND v."id" = NEW."variantId";
  NEW."shippingSnapshot" := CASE WHEN details IS NULL OR details = '{}'::jsonb THEN NULL ELSE details END;
  RETURN NEW;
END
$snapshot$;

CREATE TRIGGER "OrderItem_snapshot_shipping"
BEFORE INSERT ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION jelly_snapshot_order_item_shipping();
