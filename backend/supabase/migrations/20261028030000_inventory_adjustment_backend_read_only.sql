-- The stock history is written only by the jelly_log_inventory_change() trigger (SECURITY DEFINER), never by
-- the backend role. New tables get read/write for jelly_backend through default privileges, so take the
-- write rights away again and keep the log read-only for application code.
DO $readonly$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public."InventoryAdjustment" FROM jelly_backend;
  END IF;
END
$readonly$;
