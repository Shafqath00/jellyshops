-- Phase 2 of order tracking: shipment progress and exceptions, and the notifications they send.
-- Additive: existing rows keep their values; only the allowed sets grow.

-- Shipments can be out for delivery as well as shipped or delivered.
DO $shipment_status$
DECLARE constraint_name TEXT;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = '"OrderFulfilment"'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%SHIPPED%DELIVERED%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "OrderFulfilment" DROP CONSTRAINT %I', constraint_name);
  END IF;
END $shipment_status$;
ALTER TABLE "OrderFulfilment" ADD CONSTRAINT "OrderFulfilment_status_check" CHECK (status IN ('SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'));

-- A shipment has at most one open problem. Cleared automatically when it is delivered.
ALTER TABLE "OrderFulfilment" ADD COLUMN IF NOT EXISTS "exception" TEXT CHECK ("exception" IN ('DELAYED', 'DELIVERY_FAILED'));

-- New notification types. The queue function and outbox are unchanged.
DO $notification_type$
DECLARE constraint_name TEXT;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = '"OrderNotification"'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%REFUND_PROCESSED%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "OrderNotification" DROP CONSTRAINT %I', constraint_name);
  END IF;
END $notification_type$;
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_type_check" CHECK ("type" IN (
  'PLACED', 'PAYMENT_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'SHIPMENT_DELAYED', 'DELIVERY_FAILED', 'CANCELLED', 'REFUND_PROCESSED', 'DIGITAL_READY'
));
