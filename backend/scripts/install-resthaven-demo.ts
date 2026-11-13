import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parse } from "dotenv";
import request from "supertest";

/**
 * Fills a store with the Resthaven demo content (jellyshops/packages/storefront-themes/src/themes/jelly-resthaven/
 * demo-content.json): installs the Resthaven starter, uploads the photos, creates the collections and products,
 * publishes the information pages, adds the reviews and publishes the storefront. Safe to run again: whatever
 * exists (by handle) is left alone.
 *
 *   npx tsx scripts/install-resthaven-demo.ts --dry-run
 *   npx tsx scripts/install-resthaven-demo.ts <approved-supabase-project-ref> [--slug resthaven-demo] [--name "Resthaven demo"]
 *
 * It signs in as the local test merchant in jellyshops/.env (JELLY_E2E_EMAIL / JELLY_E2E_PASSWORD, git-ignored) and
 * never creates users. The approved project ref must match both the auth and the database the backend is configured
 * for, so a script run against the wrong project stops before writing anything.
 */
const themeFolder = fileURLToPath(new URL("../../jellyshops/packages/storefront-themes/src/themes/jelly-resthaven/", import.meta.url));
const localEnvironmentFile = fileURLToPath(new URL("../../jellyshops/.env", import.meta.url));

interface DemoVariant { sku: string; options: Record<string, string>; priceMinor: number; stock: number }
interface DemoProduct {
  handle: string; title: string; type: string; vendor: string; collections: string[]; description: string; images: string[];
  options?: Array<{ name: string; values: string[] }>; variants: DemoVariant[]; tags: string[]; specifications: Record<string, string>; compareAtPriceMinor?: number;
}
interface DemoPack {
  currency: string;
  collections: Array<{ handle: string; title: string; image: string; description: string }>;
  products: DemoProduct[];
  reviews: Array<{ product: string; rating: number; title: string; body: string; author: string }>;
  pages: Array<{ handle: string; title: string; body: string[] }>;
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : fallback; };
const approvedProjectRef = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1]?.startsWith("--") !== true);
const slug = option("slug", "resthaven-demo");
const storeName = option("name", "Resthaven demo");

const pack = JSON.parse(readFileSync(path.join(themeFolder, "demo-content.json"), "utf8")) as DemoPack;
const slugOf = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const photoFile = (name: string) => path.join(themeFolder, "assets", `${name}.webp`);
const images = [...new Set([...pack.products.flatMap((product) => product.images), ...pack.collections.map((collection) => collection.image)])];

// The pack must be complete before anything is written.
const missing = images.filter((name) => !existsSync(photoFile(name)));
if (missing.length) throw new Error(`Photos missing from the theme's assets folder: ${missing.join(", ")}`);
const photoCount = pack.products.reduce((sum, product) => sum + product.images.length, 0);
console.log(`Pack: ${pack.products.length} products, ${pack.products.reduce((sum, product) => sum + product.variants.length, 0)} variants, ${pack.collections.length} collections, ${images.length} photos, ${pack.reviews.length} reviews, ${pack.pages.length} pages.`);
if (flag("dry-run")) {
  console.log(`Dry run: nothing written. Would fill the store "${storeName}" (/${slug}) with ${photoCount} product photo placements.`);
  process.exit(0);
}

const { createApp } = await import("../src/app.js");
const { createSupabasePool } = await import("../src/database/client.js");

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!approvedProjectRef || !supabaseUrl || !anonKey || !databaseUrl) {
  throw new Error("Usage: install-resthaven-demo.ts <approved Supabase project ref> (and the backend's Supabase configuration).");
}
const authTarget = new URL(supabaseUrl);
const databaseTarget = new URL(databaseUrl);
const approvedAuth = authTarget.hostname === `${approvedProjectRef}.supabase.co`;
const approvedDatabase = databaseTarget.hostname === `db.${approvedProjectRef}.supabase.co`
  || databaseTarget.hostname.endsWith(".pooler.supabase.com") && databaseTarget.username.endsWith(`.${approvedProjectRef}`);
if (!approvedAuth || !approvedDatabase) throw new Error("The approved project ref does not match both configured Supabase targets.");

const localValues = parse(await readFile(localEnvironmentFile).catch(() => Buffer.from("")));
const email = localValues.JELLY_E2E_EMAIL;
const password = localValues.JELLY_E2E_PASSWORD;
if (!email || !password) throw new Error("jellyshops/.env needs the test merchant (JELLY_E2E_EMAIL and JELLY_E2E_PASSWORD).");

const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("The test merchant could not sign in.");
const auth = { Authorization: `Bearer ${signedIn.data.session.access_token}` };
const app = createApp();
const pool = createSupabasePool();

function check(response: { status: number; body: unknown }, expected: number[], what: string): void {
  if (!expected.includes(response.status)) throw new Error(`${what} failed: HTTP ${response.status} ${JSON.stringify(response.body).slice(0, 300)}`);
}
const doc = (paragraphs: string[]) => ({ type: "doc", content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })) });

try {
  // 1. The store.
  const me = await request(app).get("/api/me").set(auth);
  check(me, [200], "Reading the merchant");
  let store = (me.body.stores as Array<{ id: string; slug: string }>).find((candidate) => candidate.slug === slug);
  if (!store) {
    const created = await request(app).post("/api/stores").set(auth).send({ name: storeName, slug, currency: pack.currency, country: "GB" });
    check(created, [201], "Creating the store");
    store = created.body.store as { id: string; slug: string };
    console.log(`Created the store "${storeName}" (/${slug}).`);
  } else console.log(`Using the existing store /${slug}.`);
  const storeId = store.id;

  // 2. The Resthaven starter (a draft that is already installed is kept).
  const installed = await request(app).post(`/api/stores/${storeId}/storefront/starters/jelly-resthaven/install`).set(auth);
  check(installed, [201, 409], "Installing the Resthaven starter");
  console.log(installed.status === 201 ? "Installed the Resthaven starter." : "The Resthaven starter was already installed.");

  // 3. Photos (matched by file name, so a second run does not upload them again).
  const existingMedia = await request(app).get(`/api/stores/${storeId}/media`).set(auth);
  check(existingMedia, [200], "Listing media");
  const mediaList = (Array.isArray(existingMedia.body) ? existingMedia.body : existingMedia.body.items ?? existingMedia.body.nodes ?? []) as Array<{ id: string; originalName?: string }>;
  const mediaIds = new Map<string, string>();
  for (const item of mediaList) if (item.originalName) mediaIds.set(item.originalName, item.id);
  let uploaded = 0;
  for (const name of images) {
    const file = `${name}.webp`;
    if (mediaIds.has(file)) continue;
    const response = await request(app).post(`/api/stores/${storeId}/media`).set(auth).attach("file", readFileSync(photoFile(name)), { filename: file, contentType: "image/webp" });
    check(response, [201], `Uploading ${file}`);
    mediaIds.set(file, response.body.id as string);
    uploaded += 1;
  }
  console.log(`Photos: ${uploaded} uploaded, ${images.length - uploaded} already there.`);

  // 4. Collections.
  const catalogPath = `/api/stores/${storeId}/catalog`;
  const collectionList = await request(app).get(`${catalogPath}/collections?limit=100`).set(auth);
  check(collectionList, [200], "Listing collections");
  const collectionIds = new Map<string, string>();
  for (const node of collectionList.body.nodes as Array<{ id: string; handle: string }>) collectionIds.set(node.handle, node.id);
  for (const collection of pack.collections) {
    if (collectionIds.has(collection.handle)) continue;
    const response = await request(app).post(`${catalogPath}/collections`).set(auth).send({ handle: collection.handle, title: collection.title, description: collection.description });
    check(response, [201], `Creating the ${collection.title} collection`);
    collectionIds.set(collection.handle, response.body.id as string);
  }
  console.log(`Collections: ${collectionIds.size}.`);

  // 5. Products.
  const productList = await request(app).get(`${catalogPath}/products?limit=100`).set(auth);
  check(productList, [200], "Listing products");
  const productIds = new Map<string, string>();
  for (const node of productList.body.nodes as Array<{ id: string; handle: string }>) productIds.set(node.handle, node.id);
  let created = 0;
  for (const product of pack.products) {
    if (productIds.has(product.handle)) continue;
    const options = (product.options ?? []).map((definition, position) => ({
      id: slugOf(definition.name), name: definition.name, type: "variant", required: true, position,
      values: definition.values.map((value, index) => ({ id: `${slugOf(definition.name)}-${slugOf(value)}`, label: value, position: index, priceAdjustmentMinor: 0 })),
    }));
    const cheapest = Math.min(...product.variants.map((variant) => variant.priceMinor));
    const variants = product.variants.map((variant) => {
      const optionEntries = Object.entries(variant.options);
      return {
        title: optionEntries.map(([, value]) => value).join(" / ") || "Default",
        sku: variant.sku,
        priceMinor: variant.priceMinor,
        ...(product.compareAtPriceMinor ? { compareAtPriceMinor: Math.round(variant.priceMinor * product.compareAtPriceMinor / cheapest / 100) * 100 } : {}),
        options: Object.fromEntries(optionEntries.map(([name, value]) => [slugOf(name), `${slugOf(name)}-${slugOf(value)}`])),
        trackInventory: true,
        quantity: variant.stock,
      };
    });
    const response = await request(app).post(`${catalogPath}/products`).set(auth).send({
      handle: product.handle, title: product.title, description: product.description, status: "ACTIVE",
      vendor: product.vendor, productType: product.type, tags: product.tags, specifications: product.specifications,
      media: product.images.map((name, index) => ({ mediaId: mediaIds.get(`${name}.webp`), altText: index === 0 ? product.title : `${product.title}, view ${index + 1}` })),
      collectionIds: product.collections.map((handle) => collectionIds.get(handle)).filter((id): id is string => Boolean(id)),
      options, variants, ...(options.length ? { inventoryOptionIds: options.map((option) => option.id) } : {}),
    });
    check(response, [201], `Creating ${product.title}`);
    productIds.set(product.handle, response.body.id as string);
    created += 1;
  }
  console.log(`Products: ${created} created, ${pack.products.length - created} already there.`);

  // 6. Information pages: written and published.
  const pageList = await request(app).get(`/api/stores/${storeId}/content/pages`).set(auth);
  check(pageList, [200], "Listing pages");
  const pages = new Map((pageList.body as Array<{ id: string; handle: string; status: string }>).map((page) => [page.handle, page]));
  for (const page of pack.pages) {
    let current = pages.get(page.handle);
    if (!current) {
      const response = await request(app).post(`/api/stores/${storeId}/content/pages`).set(auth).send({ title: page.title, handle: page.handle, content: doc(page.body) });
      check(response, [201], `Creating the ${page.title} page`);
      current = response.body as { id: string; handle: string; status: string };
    } else if (current.status !== "PUBLISHED") {
      check(await request(app).patch(`/api/stores/${storeId}/content/pages/${current.id}`).set(auth).send({ title: page.title, content: doc(page.body), noindex: false }), [200], `Writing the ${page.title} page`);
    }
    if (current.status !== "PUBLISHED") check(await request(app).post(`/api/stores/${storeId}/content/pages/${current.id}/publish`).set(auth), [200], `Publishing the ${page.title} page`);
  }
  console.log(`Pages: ${pack.pages.length} written and published.`);

  // 7. Reviews (added as published; the public form always files new reviews as waiting for approval).
  let reviews = 0;
  for (const [index, review] of pack.reviews.entries()) {
    const productId = productIds.get(review.product);
    if (!productId) continue;
    const result = await pool.query(
      `INSERT INTO "ProductReview" ("id","storeId","productId","rating","title","body","authorName","status","verifiedPurchase","createdAt","publishedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'published',FALSE, NOW() - ($8 || ' days')::interval, NOW() - ($8 || ' days')::interval) ON CONFLICT ("id") DO NOTHING`,
      [`review-demo-${storeId}-${index}`, storeId, productId, review.rating, review.title, review.body, review.author, String(3 + index * 4)],
    );
    reviews += result.rowCount ?? 0;
  }
  console.log(`Reviews: ${reviews} added.`);

  // 8. Check the draft and publish it.
  const workspace = await request(app).get(`/api/stores/${storeId}/storefront/workspace`).set(auth);
  check(workspace, [200], "Reading the storefront workspace");
  const validation = await request(app).post(`/api/stores/${storeId}/storefront/validate`).set(auth).send({ expectedGeneration: workspace.body.generation });
  if (validation.status !== 200 || !validation.body.ok) throw new Error(`The storefront did not validate: ${JSON.stringify((validation.body.diagnostics ?? []).map((item: { code: string }) => item.code))}`);
  const published = await request(app).post(`/api/stores/${storeId}/storefront/publish`).set(auth).send({ expectedGeneration: workspace.body.generation, idempotencyKey: `resthaven-demo-${workspace.body.generation}` });
  check(published, [200, 201], "Publishing the storefront");
  console.log(`Published. Store: /${slug}`);

  // 9. Read back what shoppers will see.
  const publicList = await request(app).get(`/api/public/stores/${storeId}/catalog/browse?limit=48`);
  console.log(`Shoppers see ${publicList.body.total ?? "?"} products.`);
} finally {
  await pool.end();
  await client.auth.signOut();
}
