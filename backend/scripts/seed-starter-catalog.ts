import { createSupabasePool } from "../src/database/client.js";

type SeedProduct = { id: string; storeId: string; slug: string; title: string; description: string; productType: string; variantId: string; variantTitle: string; sku: string; priceMinor: number; quantity: number };

const products: SeedProduct[] = [
  { id: "product-vanilla-cake", storeId: "store-demo", slug: "vanilla-celebration-cake", title: "Vanilla Celebration Cake", description: "Vanilla bean sponge, cloud cream, raspberry preserve, and a confetti crown.", productType: "Cakes", variantId: "vanilla-cake", variantTitle: "1 kg", sku: "SB-CAKE-VAN-1KG", priceMinor: 149900, quantity: 9 },
  { id: "product-berry-cloud", storeId: "store-demo", slug: "berry-cloud-bento", title: "Berry Cloud Bento", description: "A tiny berry sponge made for two, finished with blush buttercream.", productType: "Cakes", variantId: "berry-cloud", variantTitle: "500 g", sku: "SB-BENTO-BRY", priceMinor: 74900, quantity: 3 },
  { id: "product-lemon-tart", storeId: "store-demo", slug: "lemon-joy-tart", title: "Lemon Joy Tart", description: "Silky lemon curd in a crisp almond shell with toasted meringue.", productType: "Tarts", variantId: "lemon-tart", variantTitle: "6 inch", sku: "SB-TART-LEM", priceMinor: 89900, quantity: 7 },
  { id: "product-cookie-box", storeId: "store-demo", slug: "afternoon-cookie-box", title: "Afternoon Cookie Box", description: "Six soft-centred cookies: sea salt chocolate, pistachio, and brown butter.", productType: "Gifts", variantId: "cookie-box", variantTitle: "Box of 6", sku: "SB-COOKIE-6", priceMinor: 59900, quantity: 12 },
  { id: "product-meadow-candle", storeId: "store-bloom-home", slug: "after-rain-candle", title: "After Rain Candle", description: "Wet leaves, cedar, and a trace of wild jasmine in soy wax.", productType: "Candles", variantId: "meadow-candle", variantTitle: "220 g", sku: "BH-CAN-RAIN", priceMinor: 109900, quantity: 8 },
  { id: "product-linen-spray", storeId: "store-bloom-home", slug: "quiet-linen-mist", title: "Quiet Linen Mist", description: "A fine mist of lavender leaf, cotton blossom, and pale woods.", productType: "Home fragrance", variantId: "linen-spray", variantTitle: "100 ml", sku: "BH-MIST-LIN", priceMinor: 74900, quantity: 14 },
  { id: "product-incense", storeId: "store-bloom-home", slug: "amber-hour-incense", title: "Amber Hour Incense", description: "Slow-burning sticks with amber resin, sandalwood, and orange peel.", productType: "Incense", variantId: "incense", variantTitle: "24 sticks", sku: "BH-INC-AMB", priceMinor: 39900, quantity: 20 },
  { id: "product-ceramic-tray", storeId: "store-bloom-home", slug: "pebble-catchall", title: "Pebble Catchall", description: "A hand-glazed oval tray for rings, matches, or tiny daily treasures.", productType: "Objects", variantId: "ceramic-tray", variantTitle: "Moss glaze", sku: "BH-OBJ-PEB", priceMinor: 89900, quantity: 2 },
];

const pool = createSupabasePool();
try {
  await pool.query("BEGIN");
  for (const product of products) {
    await pool.query(`INSERT INTO "Product" ("id", "storeId", "title", "description", "status", "slug", "productType", "tags", "updatedAt") VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6,$7,NOW()) ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "description"=EXCLUDED."description", "status"='ACTIVE', "slug"=EXCLUDED."slug", "productType"=EXCLUDED."productType", "updatedAt"=NOW()`, [product.id, product.storeId, product.title, product.description, product.slug, product.productType, [product.productType]]);
    await pool.query(`INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "sku", "priceMinor", "options", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'{}',NOW()) ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "sku"=EXCLUDED."sku", "priceMinor"=EXCLUDED."priceMinor", "archivedAt"=NULL, "updatedAt"=NOW()`, [product.variantId, product.storeId, product.id, product.variantTitle, product.sku, product.priceMinor]);
    await pool.query(`INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "reserved", "updatedAt") VALUES ($1,$2,$3,0,NOW()) ON CONFLICT ("storeId", "variantId") DO UPDATE SET "quantity"=EXCLUDED."quantity", "updatedAt"=NOW()`, [product.storeId, product.variantId, product.quantity]);
  }
  await pool.query("COMMIT");
  console.log(`Seeded ${products.length} starter catalog products.`);
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally { await pool.end(); }
