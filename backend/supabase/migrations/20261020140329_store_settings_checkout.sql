ALTER TABLE "StoreSettings"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  ADD COLUMN "shippingMinor" INTEGER NOT NULL DEFAULT 0 CHECK ("shippingMinor" >= 0);

INSERT INTO "StoreSettings" ("storeId") SELECT "id" FROM "Store" ON CONFLICT ("storeId") DO NOTHING;

CREATE TABLE "StoreOrderCounter" (
  "storeId" TEXT PRIMARY KEY REFERENCES "Store"("id") ON DELETE RESTRICT,
  "value" BIGINT NOT NULL DEFAULT 0 CHECK ("value" >= 0)
);
-- Preserve existing references and safely continue if JS-prefixed numbers exist.
INSERT INTO "StoreOrderCounter" ("storeId", "value")
SELECT "storeId", MAX(substring("number" FROM 4)::bigint)
FROM "Order" WHERE "number" ~ '^JS-[0-9]+$' GROUP BY "storeId";
ALTER TABLE "StoreOrderCounter" ENABLE ROW LEVEL SECURITY;
