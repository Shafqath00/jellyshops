-- Shoppers were emailed "Thank you for your order" as soon as checkout created the order,
-- before they had typed their card. Orders are created as PENDING_PAYMENT and only the
-- Stripe webhook (payment_intent.succeeded) moves them to PAID.
--
-- From now on:
-- * nothing is queued when an order is created;
-- * the order confirmation (type PLACED, dedupe key 'placed:<order>') is queued when the
--   order goes from PENDING_PAYMENT to PAID, so once per order however often Stripe retries;
-- * the separate "Payment confirmed" email is skipped for that first payment (the
--   confirmation already says it is paid) and still sent for later payments, such as a
--   balance due after an order edit;
-- * "Order cancelled" is only sent for orders that were paid. An unpaid checkout that is
--   abandoned, replaced or declined is cancelled quietly.
CREATE OR REPLACE FUNCTION jelly_order_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."status"='PAID' THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."id",'PLACED','placed:'||NEW."id"); END IF;
 ELSIF NEW."status" IS DISTINCT FROM OLD."status" THEN
  IF NEW."status"='PAID' AND OLD."status"='PENDING_PAYMENT' THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."id",'PLACED','placed:'||NEW."id"); END IF;
  IF NEW."status" IN ('PROCESSING','SHIPPED','DELIVERED') THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."id",NEW."status",lower(NEW."status")||':'||NEW."id"); END IF;
  IF NEW."status"='CANCELLED' AND OLD."status"<>'PENDING_PAYMENT' THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."id",'CANCELLED','cancelled:'||NEW."id"); END IF;
  IF NEW."status" IN ('CANCELLED','REFUNDED') THEN UPDATE "DigitalEntitlement" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."id" AND "revokedAt" IS NULL; END IF;
 END IF; RETURN NEW;
END $$;

-- An order confirmation queued before this change for an order that is still unpaid
-- (or was never paid) must not go out.
DELETE FROM "OrderNotification" n
 USING "Order" o
 WHERE o."storeId"=n."storeId" AND o."id"=n."orderId"
   AND n."type"='PLACED' AND n."status"='QUEUED' AND n."attempts"=0
   AND o."status" IN ('PENDING_PAYMENT','CANCELLED');

CREATE OR REPLACE FUNCTION jelly_payment_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status"='REFUNDED' THEN UPDATE "DigitalEntitlement" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId" AND "revokedAt" IS NULL; END IF;
 IF NEW."status"='PAID' AND (TG_OP='INSERT' OR OLD."status" IS DISTINCT FROM NEW."status") THEN
  -- The order's payment is announced by the order confirmation (queued when the order goes from
  -- PENDING_PAYMENT to PAID; the webhook settles both in one statement). Only a payment taken on an
  -- order that is no longer waiting, such as a cancelled one, gets its own email.
  IF NOT EXISTS(SELECT 1 FROM "Order" WHERE "storeId"=NEW."storeId" AND "id"=NEW."orderId" AND "status" IN ('PENDING_PAYMENT','PAID')) THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."orderId",'PAYMENT_CONFIRMED','paid:'||NEW."orderId"); END IF;
  IF EXISTS(SELECT 1 FROM "Order" WHERE "storeId"=NEW."storeId" AND "id"=NEW."orderId" AND "status" IN ('CANCELLED','REFUNDED')) THEN RETURN NEW; END IF;
  INSERT INTO "DigitalEntitlement"("id","storeId","orderId","variantId","assetId","maxDownloads","expiresAt")
   SELECT md5(random()::text||a."id"||i."variantId"),i."storeId",i."orderId",i."variantId",a."id",a."maxDownloads",CASE WHEN a."expiresAfterDays" IS NULL THEN NULL ELSE CURRENT_TIMESTAMP+make_interval(days=>a."expiresAfterDays") END
   FROM "OrderItem" i JOIN "ProductVariant" v ON v."storeId"=i."storeId" AND v."id"=i."variantId" JOIN "DigitalAsset" a ON a."storeId"=v."storeId" AND a."productId"=v."productId"
   WHERE i."storeId"=NEW."storeId" AND i."orderId"=NEW."orderId" AND i."fulfillmentType"='DIGITAL' AND a."archivedAt" IS NULL
   ON CONFLICT("storeId","orderId","variantId","assetId") DO NOTHING;
  IF EXISTS(SELECT 1 FROM "DigitalEntitlement" WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId") THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."orderId",'DIGITAL_READY','digital:'||NEW."orderId"); END IF;
  IF EXISTS(SELECT 1 FROM "OrderItem" WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId") AND NOT EXISTS(SELECT 1 FROM "OrderItem" WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId" AND "fulfillmentType"='PHYSICAL') AND NOT EXISTS(SELECT 1 FROM "OrderItem" i WHERE i."storeId"=NEW."storeId" AND i."orderId"=NEW."orderId" AND NOT EXISTS(SELECT 1 FROM "DigitalEntitlement" e WHERE e."storeId"=i."storeId" AND e."orderId"=i."orderId" AND e."variantId"=i."variantId")) THEN
   UPDATE "Order" SET "fulfilmentStatus"='FULFILLED' WHERE "storeId"=NEW."storeId" AND "id"=NEW."orderId";
  END IF;
 END IF; RETURN NEW;
END $$;

-- Allowed order status changes (same list as backend/src/commerce/order-status.ts).
-- Any other change, such as PENDING_PAYMENT straight to SHIPPED, is refused whatever code asks for it.
CREATE OR REPLACE FUNCTION jelly_order_status_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE allowed TEXT[];
BEGIN
 IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN RETURN NEW; END IF;
 allowed := CASE OLD."status"
  WHEN 'PENDING_PAYMENT' THEN ARRAY['PAID','CANCELLED']
  WHEN 'PENDING' THEN ARRAY['PAID','CANCELLED']
  WHEN 'PAID' THEN ARRAY['CONFIRMED','PROCESSING','SHIPPED','CANCELLED','REFUNDED']
  WHEN 'CONFIRMED' THEN ARRAY['PROCESSING','SHIPPED','CANCELLED','REFUNDED']
  WHEN 'PROCESSING' THEN ARRAY['SHIPPED','REFUNDED']
  WHEN 'SHIPPED' THEN ARRAY['DELIVERED','REFUNDED']
  WHEN 'DELIVERED' THEN ARRAY['REFUNDED']
  ELSE ARRAY[]::TEXT[]
 END;
 IF NOT (NEW."status" = ANY(allowed)) THEN
  RAISE EXCEPTION 'ORDER_TRANSITION_INVALID: % to %', OLD."status", NEW."status" USING ERRCODE = 'check_violation';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS jelly_order_status_guard_trigger ON "Order";
CREATE TRIGGER jelly_order_status_guard_trigger BEFORE UPDATE OF "status" ON "Order" FOR EACH ROW EXECUTE FUNCTION jelly_order_status_guard();
