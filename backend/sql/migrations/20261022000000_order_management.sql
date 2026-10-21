-- Order management extends the existing authoritative order records.
ALTER TABLE "Order" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision">0),
 ADD COLUMN "taxMinor" INTEGER CHECK ("taxMinor">=0), ADD COLUMN "discountMinor" INTEGER CHECK ("discountMinor">=0),
 ADD COLUMN "deliverySnapshot" JSONB, ADD COLUMN "billingAddress" JSONB, ADD COLUMN "customerNote" TEXT,
 ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN "balanceDueMinor" INTEGER NOT NULL DEFAULT 0 CHECK ("balanceDueMinor">=0),
 ADD COLUMN "lifecycle" TEXT NOT NULL DEFAULT 'OPEN', ADD COLUMN "fulfilmentStatus" TEXT NOT NULL DEFAULT 'UNFULFILLED';
DO $$ DECLARE c RECORD; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='"Order"'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%subtotalMinor%' AND pg_get_constraintdef(oid) LIKE '%totalMinor%' LOOP
 EXECUTE format('ALTER TABLE "Order" DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_breakdown_check" CHECK ("totalMinor"::BIGINT="subtotalMinor"::BIGINT+"shippingMinor"::BIGINT+COALESCE("taxMinor",0)::BIGINT-COALESCE("discountMinor",0)::BIGINT);
ALTER TABLE "OrderItem" ADD COLUMN "productTitleSnapshot" TEXT, ADD COLUMN "variantTitleSnapshot" TEXT,
 ADD COLUMN "fulfillmentType" TEXT NOT NULL DEFAULT 'PHYSICAL' CHECK ("fulfillmentType" IN ('PHYSICAL','DIGITAL')),
 ADD COLUMN "taxMinor" INTEGER, ADD COLUMN "discountMinor" INTEGER;
CREATE TABLE "StoreOrderManagementSettings" ("storeId" TEXT PRIMARY KEY REFERENCES "Store"(id), enabled BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE "OrderEvent" (id TEXT PRIMARY KEY,"storeId" TEXT NOT NULL,"orderId" TEXT NOT NULL,type TEXT NOT NULL,"actorId" TEXT,details JSONB NOT NULL DEFAULT '{}',"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), FOREIGN KEY("storeId","orderId") REFERENCES "Order"("storeId",id));
CREATE INDEX ON "OrderEvent"("storeId","orderId","createdAt");
CREATE TABLE "OrderNote" (id TEXT PRIMARY KEY,"storeId" TEXT NOT NULL,"orderId" TEXT NOT NULL,body TEXT NOT NULL,"actorId" TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), FOREIGN KEY("storeId","orderId") REFERENCES "Order"("storeId",id));
CREATE TABLE "OrderRevision" (id TEXT PRIMARY KEY,"storeId" TEXT NOT NULL,"orderId" TEXT NOT NULL,number INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('PENDING','APPLIED','FAILED','EXPIRED')),snapshot JSONB NOT NULL,"deltaMinor" INTEGER NOT NULL DEFAULT 0,"idempotencyKey" TEXT NOT NULL,"requestHash" TEXT NOT NULL,"expiresAt" TIMESTAMPTZ,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"appliedAt" TIMESTAMPTZ,UNIQUE("storeId","orderId","idempotencyKey"),UNIQUE("storeId",id),FOREIGN KEY("storeId","orderId") REFERENCES "Order"("storeId",id));
CREATE UNIQUE INDEX ON "OrderRevision"("storeId","orderId") WHERE status='PENDING';
CREATE TABLE "OrderEditHold" ("revisionId" TEXT NOT NULL REFERENCES "OrderRevision"(id),"storeId" TEXT NOT NULL,"variantId" TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),released BOOLEAN NOT NULL DEFAULT FALSE,PRIMARY KEY("revisionId","variantId"),FOREIGN KEY("storeId","variantId") REFERENCES "InventoryLevel"("storeId","variantId"));
CREATE TABLE "OrderTransaction" (id TEXT PRIMARY KEY,"storeId" TEXT NOT NULL,"orderId" TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('PAYMENT','REFUND')),"amountMinor" INTEGER NOT NULL CHECK("amountMinor">=0),status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUCCEEDED','FAILED')),"paymentIntentId" TEXT,"stripeRefundId" TEXT UNIQUE,"revisionId" TEXT REFERENCES "OrderRevision"(id),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),FOREIGN KEY("storeId","orderId") REFERENCES "Order"("storeId",id));
CREATE INDEX ON "OrderTransaction"("paymentIntentId");
CREATE TABLE "OrderOperation" (id TEXT PRIMARY KEY,"storeId" TEXT NOT NULL,"orderId" TEXT NOT NULL,kind TEXT NOT NULL,payload JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','SUCCEEDED','FAILED')),attempts INTEGER NOT NULL DEFAULT 0,"leaseUntil" TIMESTAMPTZ,"lastError" TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE("storeId","orderId",id),FOREIGN KEY("storeId","orderId") REFERENCES "Order"("storeId",id));
CREATE INDEX ON "OrderOperation"(status,"leaseUntil");
CREATE TABLE "OrderFulfilment" (id TEXT PRIMARY KEY,"storeId" TEXT NOT NULL,"orderId" TEXT NOT NULL,items JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'SHIPPED' CHECK(status IN ('SHIPPED','DELIVERED')),"trackingNumber" TEXT,carrier TEXT,"trackingUrl" TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"deliveredAt" TIMESTAMPTZ,FOREIGN KEY("storeId","orderId") REFERENCES "Order"("storeId",id));
CREATE TABLE "OrderReturn" (id TEXT PRIMARY KEY,"storeId" TEXT NOT NULL,"orderId" TEXT NOT NULL,items JSONB NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','RECEIVED')),sellable BOOLEAN,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"receivedAt" TIMESTAMPTZ,FOREIGN KEY("storeId","orderId") REFERENCES "Order"("storeId",id));
INSERT INTO "OrderRevision" (id,"storeId","orderId",number,status,snapshot,"idempotencyKey","requestHash","appliedAt") SELECT 'original-'||o.id,o."storeId",o.id,1,'APPLIED',jsonb_build_object('order',to_jsonb(o),'items',COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM "OrderItem" i WHERE i."orderId"=o.id),'[]'::jsonb)),'original','original',o."createdAt" FROM "Order" o;
UPDATE "Order" SET lifecycle=CASE WHEN status='CANCELLED' THEN 'CANCELLED' WHEN status='REFUNDED' THEN 'CLOSED' ELSE 'OPEN' END,"fulfilmentStatus"=CASE WHEN status='DELIVERED' THEN 'DELIVERED' WHEN status='SHIPPED' THEN 'FULFILLED' ELSE 'UNFULFILLED' END;
-- Capture future checkouts at transaction end, after their line snapshots exist.
CREATE FUNCTION jelly_capture_original_order_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "OrderRevision" (id,"storeId","orderId",number,status,snapshot,"idempotencyKey","requestHash","appliedAt")
 SELECT 'original-'||o.id,o."storeId",o.id,1,'APPLIED',jsonb_build_object('order',to_jsonb(o),'items',COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM "OrderItem" i WHERE i."orderId"=o.id),'[]'::jsonb)),'original','original',o."createdAt" FROM "Order" o WHERE o.id=NEW.id ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER jelly_capture_original_order_revision AFTER INSERT ON "Order" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION jelly_capture_original_order_revision();
-- Server-only records: browser Data API roles receive no direct access.
DO $isolate$
DECLARE table_name TEXT;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['StoreOrderManagementSettings','OrderEvent','OrderNote','OrderRevision','OrderEditHold','OrderTransaction','OrderOperation','OrderFulfilment','OrderReturn'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',table_name);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon',table_name); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',table_name); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='jelly_backend') THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO jelly_backend',table_name);
   EXECUTE format('CREATE POLICY backend_access ON public.%I TO jelly_backend USING (true) WITH CHECK (true)',table_name);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='jelly_backend') THEN
  -- OrderItem is the effective projection. Each replacement is performed in the
  -- same transaction as an immutable OrderRevision; orders/payments stay undeletable.
  GRANT DELETE ON "OrderItem" TO jelly_backend;
  REVOKE DELETE ON "OrderRevision","OrderEvent","OrderTransaction" FROM jelly_backend;
 END IF;
END
$isolate$;
ALTER TABLE "OrderEditHold" ADD CONSTRAINT "OrderEditHold_revision_store_fk" FOREIGN KEY("storeId","revisionId") REFERENCES "OrderRevision"("storeId",id);
ALTER TABLE "OrderTransaction" ADD CONSTRAINT "OrderTransaction_revision_store_fk" FOREIGN KEY("storeId","revisionId") REFERENCES "OrderRevision"("storeId",id);
CREATE FUNCTION jelly_protect_order_revision_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW."storeId"<>OLD."storeId" OR NEW."orderId"<>OLD."orderId" OR NEW.number<>OLD.number OR NEW."deltaMinor"<>OLD."deltaMinor" OR NEW."idempotencyKey"<>OLD."idempotencyKey" OR NEW."requestHash"<>OLD."requestHash" THEN RAISE EXCEPTION 'Order revision purchase snapshots are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER jelly_protect_order_revision_snapshot BEFORE UPDATE ON "OrderRevision" FOR EACH ROW EXECUTE FUNCTION jelly_protect_order_revision_snapshot();
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='jelly_backend') THEN REVOKE UPDATE,DELETE ON "OrderEvent" FROM jelly_backend; END IF; END $$;
-- Preserve the meaning of historical whole-order shipments in the new ledger.
INSERT INTO "OrderFulfilment" (id,"storeId","orderId",items,status,"createdAt","deliveredAt")
SELECT 'legacy-shipment-'||o.id,o."storeId",o.id,jsonb_agg(jsonb_build_object('variantId',i."variantId",'configurationKey',i."configurationKey",'quantity',i.quantity)),CASE WHEN o.status='DELIVERED' THEN 'DELIVERED' ELSE 'SHIPPED' END,o."updatedAt",CASE WHEN o.status='DELIVERED' THEN o."updatedAt" ELSE NULL END
FROM "Order" o JOIN "OrderItem" i ON i."storeId"=o."storeId" AND i."orderId"=o.id WHERE o.status IN ('SHIPPED','DELIVERED') GROUP BY o.id;
