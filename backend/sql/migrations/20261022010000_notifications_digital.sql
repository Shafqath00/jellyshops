ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fulfillmentType" TEXT NOT NULL DEFAULT 'PHYSICAL' CHECK ("fulfillmentType" IN ('PHYSICAL','DIGITAL'));
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "fulfillmentType" TEXT NOT NULL DEFAULT 'PHYSICAL' CHECK ("fulfillmentType" IN ('PHYSICAL','DIGITAL'));
CREATE TABLE "StoreNotificationBranding" (
 "storeId" TEXT PRIMARY KEY REFERENCES "Store"("id"), "brandName" TEXT, "replyTo" TEXT, "accentColor" TEXT NOT NULL DEFAULT '#192642', "logoUrl" TEXT
);
CREATE TABLE "OrderNotification" (
 "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "orderId" TEXT NOT NULL,
 "type" TEXT NOT NULL CHECK ("type" IN ('PLACED','PAYMENT_CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUND_PROCESSED','DIGITAL_READY')),
 "dedupeKey" TEXT NOT NULL UNIQUE, "snapshot" JSONB NOT NULL DEFAULT '{}', "status" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("status" IN ('QUEUED','SENDING','ACCEPTED','FAILED','UNCERTAIN')),
 "attempts" INTEGER NOT NULL DEFAULT 0, "availableAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseUntil" TIMESTAMPTZ,
 "lastError" TEXT, "providerMessageId" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("storeId","orderId") REFERENCES "Order"("storeId","id")
);
CREATE INDEX "OrderNotification_ready_idx" ON "OrderNotification"("availableAt") WHERE "status"='QUEUED';
CREATE TABLE "DigitalAsset" (
 "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "productId" TEXT NOT NULL, "storageKey" TEXT NOT NULL UNIQUE,
 "filename" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" BIGINT NOT NULL CHECK ("sizeBytes">0),
 "maxDownloads" INTEGER CHECK ("maxDownloads">0), "expiresAfterDays" INTEGER CHECK ("expiresAfterDays">0),
 "archivedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("storeId","id"), FOREIGN KEY("storeId","productId") REFERENCES "Product"("storeId","id")
);
CREATE TABLE "DigitalEntitlement" (
 "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "variantId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
 "tokenHash" TEXT, "maxDownloads" INTEGER, "downloadCount" INTEGER NOT NULL DEFAULT 0 CHECK ("downloadCount">=0),
 "expiresAt" TIMESTAMPTZ, "revokedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("storeId","orderId","variantId","assetId"),
 FOREIGN KEY("storeId","orderId") REFERENCES "Order"("storeId","id"), FOREIGN KEY("storeId","assetId") REFERENCES "DigitalAsset"("storeId","id")
);
CREATE TABLE "DigitalDownloadAttempt" (
 "id" TEXT PRIMARY KEY, "entitlementId" TEXT NOT NULL REFERENCES "DigitalEntitlement"("id"), "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION jelly_queue_notification(s TEXT,o TEXT,t TEXT,k TEXT,extra JSONB DEFAULT '{}') RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE n TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "StoreOrderManagementSettings" WHERE "storeId"=s AND enabled=TRUE) THEN RETURN; END IF;
 n:=md5(random()::text||clock_timestamp()::text);
 INSERT INTO "OrderNotification"("id","storeId","orderId","type","dedupeKey","snapshot") SELECT n,s,o,t,k,to_jsonb(ord)||jsonb_build_object('items',COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM "OrderItem" i WHERE i."storeId"=s AND i."orderId"=o),'[]'::jsonb))||extra FROM "Order" ord WHERE ord."storeId"=s AND ord."id"=o ON CONFLICT("dedupeKey") DO NOTHING;
 IF FOUND THEN INSERT INTO "OrderEvent"("id","storeId","orderId","type","details") VALUES(md5(random()::text),s,o,'NOTIFICATION_QUEUED',jsonb_build_object('notificationId',n,'type',t)); END IF;
END $$;
CREATE FUNCTION jelly_order_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."id",'PLACED','placed:'||NEW."id");
 ELSIF NEW."status" IS DISTINCT FROM OLD."status" THEN
  IF NEW."status" IN ('PROCESSING','SHIPPED','DELIVERED','CANCELLED') THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."id",NEW."status",lower(NEW."status")||':'||NEW."id"); END IF;
  IF NEW."status" IN ('CANCELLED','REFUNDED') THEN UPDATE "DigitalEntitlement" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."id" AND "revokedAt" IS NULL; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER jelly_order_notification_trigger AFTER INSERT OR UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION jelly_order_notifications();
CREATE FUNCTION jelly_placed_item_snapshot() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "OrderNotification" SET "snapshot"=jsonb_set("snapshot",'{items}',COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM "OrderItem" i WHERE i."storeId"=NEW."storeId" AND i."orderId"=NEW."orderId"),'[]'::jsonb))
 WHERE "dedupeKey"='placed:'||NEW."orderId" AND "attempts"=0 AND EXISTS(SELECT 1 FROM "Order" o WHERE o."storeId"=NEW."storeId" AND o."id"=NEW."orderId" AND o."status"='PENDING_PAYMENT');
 RETURN NEW;
END $$;
CREATE TRIGGER jelly_placed_item_snapshot_trigger AFTER INSERT ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION jelly_placed_item_snapshot();
CREATE FUNCTION jelly_payment_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status"='REFUNDED' THEN UPDATE "DigitalEntitlement" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId" AND "revokedAt" IS NULL; END IF;
 IF NEW."status"='PAID' AND (TG_OP='INSERT' OR OLD."status" IS DISTINCT FROM NEW."status") THEN
  PERFORM jelly_queue_notification(NEW."storeId",NEW."orderId",'PAYMENT_CONFIRMED','paid:'||NEW."orderId");
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
CREATE TRIGGER jelly_payment_notification_trigger AFTER INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION jelly_payment_notifications();
CREATE FUNCTION jelly_revision_digital_grants() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE granted INTEGER;
BEGIN
 IF NEW."status"='APPLIED' AND (TG_OP='INSERT' OR OLD."status" IS DISTINCT FROM NEW."status")
 AND EXISTS(SELECT 1 FROM "Payment" p JOIN "Order" o ON o."storeId"=p."storeId" AND o."id"=p."orderId" WHERE p."storeId"=NEW."storeId" AND p."orderId"=NEW."orderId" AND p."status"='PAID' AND o."status" NOT IN ('CANCELLED','REFUNDED')) THEN
  INSERT INTO "DigitalEntitlement"("id","storeId","orderId","variantId","assetId","maxDownloads","expiresAt")
   SELECT md5(random()::text||a."id"||i."variantId"),i."storeId",i."orderId",i."variantId",a."id",a."maxDownloads",CASE WHEN a."expiresAfterDays" IS NULL THEN NULL ELSE CURRENT_TIMESTAMP+make_interval(days=>a."expiresAfterDays") END
   FROM "OrderItem" i JOIN "ProductVariant" v ON v."storeId"=i."storeId" AND v."id"=i."variantId" JOIN "DigitalAsset" a ON a."storeId"=v."storeId" AND a."productId"=v."productId"
   WHERE i."storeId"=NEW."storeId" AND i."orderId"=NEW."orderId" AND i."fulfillmentType"='DIGITAL' AND a."archivedAt" IS NULL
   ON CONFLICT("storeId","orderId","variantId","assetId") DO NOTHING;
  GET DIAGNOSTICS granted=ROW_COUNT;
  IF granted>0 THEN PERFORM jelly_queue_notification(NEW."storeId",NEW."orderId",'DIGITAL_READY','digital-revision:'||NEW."id"); END IF;
  IF EXISTS(SELECT 1 FROM "OrderItem" WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId") AND NOT EXISTS(SELECT 1 FROM "OrderItem" i WHERE i."storeId"=NEW."storeId" AND i."orderId"=NEW."orderId" AND (i."fulfillmentType"='PHYSICAL' OR NOT EXISTS(SELECT 1 FROM "DigitalEntitlement" e WHERE e."storeId"=i."storeId" AND e."orderId"=i."orderId" AND e."variantId"=i."variantId"))) THEN UPDATE "Order" SET "fulfilmentStatus"='FULFILLED' WHERE "storeId"=NEW."storeId" AND "id"=NEW."orderId"; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER jelly_revision_digital_grant_trigger AFTER INSERT OR UPDATE ON "OrderRevision" FOR EACH ROW EXECUTE FUNCTION jelly_revision_digital_grants();
CREATE FUNCTION jelly_refund_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status"='SUCCEEDED' AND (TG_OP='INSERT' OR OLD."status" IS DISTINCT FROM NEW."status") THEN
  PERFORM jelly_queue_notification(NEW."storeId",NEW."orderId",'REFUND_PROCESSED','refund:'||NEW."id",jsonb_build_object('refundAmountMinor',NEW."amountMinor"));
  IF (SELECT COALESCE(SUM("amountMinor"),0) FROM "Refund" WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId" AND "status"='SUCCEEDED') >= (SELECT "totalMinor" FROM "Order" WHERE "storeId"=NEW."storeId" AND "id"=NEW."orderId") THEN
   UPDATE "DigitalEntitlement" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId" AND "revokedAt" IS NULL;
  END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER jelly_refund_notification_trigger AFTER INSERT OR UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION jelly_refund_notifications();
CREATE FUNCTION jelly_financial_event_notifications() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."type"='REFUND_PROCESSED' THEN
  PERFORM jelly_queue_notification(NEW."storeId",NEW."orderId",'REFUND_PROCESSED','refund-transaction:'||COALESCE(NEW."details"->>'requestId',NEW."details"->>'transactionId',NEW."id"),jsonb_build_object('refundAmountMinor',NEW."details"->'amountMinor'));
  IF jsonb_typeof(NEW."details"->'variantIds')='array' THEN UPDATE "DigitalEntitlement" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "storeId"=NEW."storeId" AND "orderId"=NEW."orderId" AND "variantId" IN (SELECT jsonb_array_elements_text(NEW."details"->'variantIds')) AND "revokedAt" IS NULL; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER jelly_financial_event_notification_trigger AFTER INSERT ON "OrderEvent" FOR EACH ROW EXECUTE FUNCTION jelly_financial_event_notifications();
-- Backend service credentials own these records. No direct Data API access.
ALTER TABLE "StoreNotificationBranding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalEntitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalDownloadAttempt" ENABLE ROW LEVEL SECURITY;
DO $isolate$
DECLARE table_name TEXT;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['StoreNotificationBranding','OrderNotification','DigitalAsset','DigitalEntitlement','DigitalDownloadAttempt'] LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',table_name);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon',table_name); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',table_name); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='jelly_backend') THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO jelly_backend',table_name);
   EXECUTE format('CREATE POLICY backend_access ON public.%I TO jelly_backend USING(true) WITH CHECK(true)',table_name);
  END IF;
 END LOOP;
END $isolate$;

