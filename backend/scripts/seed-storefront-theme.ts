import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { createSupabasePool } from "../src/database/client.js";

const storeId = process.env.STOREFRONT_STORE_ID;
if (!storeId) throw new Error("STOREFRONT_STORE_ID is required");
const document = createDefaultStorefrontDocument(storeId);
const layout = { sections: document.regions.template.map((section) => ({ kind: "inline", section })) };
const pool = createSupabasePool();

try {
  await pool.query(
    'UPDATE "StorefrontTemplate" SET "layout" = $1::jsonb, "revision" = "revision" + 1, "updatedAt" = NOW() WHERE "storeId" = $2 AND "id" = $3',
    [JSON.stringify(layout), storeId, "home"],
  );
  console.log("Seeded the full storefront starter layout.");
} finally {
  await pool.end();
}
