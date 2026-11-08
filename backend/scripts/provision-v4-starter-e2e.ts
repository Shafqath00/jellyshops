import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parse } from "dotenv";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSupabasePool } from "../src/database/client.js";

const localEnvironmentFile = fileURLToPath(new URL("../../jellyshops/.env", import.meta.url));
const approvedProjectRef = process.argv[2];
const supabaseUrl = process.env.SUPABASE_URL;
const adminKey = process.env.SUPABASE_SECRET_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!approvedProjectRef || !supabaseUrl || !adminKey || !anonKey || !databaseUrl) {
  throw new Error("An approved Supabase project ref and the existing backend Supabase configuration are required.");
}
const authTarget = new URL(supabaseUrl);
const databaseTarget = new URL(databaseUrl);
const approvedAuth = authTarget.hostname === `${approvedProjectRef}.supabase.co`;
const approvedDatabase = databaseTarget.hostname === `db.${approvedProjectRef}.supabase.co`
  || databaseTarget.hostname.endsWith(".pooler.supabase.com") && databaseTarget.username.endsWith(`.${approvedProjectRef}`);
if (!approvedAuth || !approvedDatabase) {
  throw new Error("The approved E2E project ref does not match both configured Supabase targets.");
}

const localValues = parse(await readFile(localEnvironmentFile).catch(() => Buffer.from("")));
async function remember(key: string, value: string): Promise<void> {
  if (localValues[key]) return;
  await appendFile(localEnvironmentFile, `${key}=${value}\n`, { mode: 0o600 });
  localValues[key] = value;
}

const admin = createClient(supabaseUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
let email = localValues.JELLY_E2E_EMAIL;
let password = localValues.JELLY_E2E_PASSWORD;
if (Boolean(email) !== Boolean(password)) throw new Error("The local E2E email and password must be configured together.");
if (!email || !password) {
  const suffix = randomUUID().slice(0, 12);
  email = `jelly-v4-e2e-${suffix}@example.test`;
  password = randomBytes(32).toString("base64url");
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Jelly V4 E2E Merchant" } });
  if (error) throw error;
  await remember("JELLY_E2E_EMAIL", email);
  await remember("JELLY_E2E_PASSWORD", password);
}

const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("The E2E merchant could not sign in");
const auth = { Authorization: `Bearer ${signedIn.data.session.access_token}` };
const app = createApp();
const pool = createSupabasePool();

try {
  const suffix = email.match(/jelly-v4-e2e-([a-f0-9]+)/)?.[1] ?? randomUUID().slice(0, 8);
  const definitions = [
    { pack: "fresh-market", key: "JELLY_E2E_FRESH_STORE_NAME", name: `Fresh Market E2E ${suffix}`, slug: `fresh-market-e2e-${suffix}`, product: "E2E Orchard Apples" },
    { pack: "artisan-boutique", key: "JELLY_E2E_ARTISAN_STORE_NAME", name: `Artisan Boutique E2E ${suffix}`, slug: `artisan-boutique-e2e-${suffix}`, product: "E2E Handcrafted Vase" },
  ] as const;

  for (const definition of definitions) {
    const name = localValues[definition.key] ?? definition.name;
    const storesResponse = await request(app).get("/api/me").set(auth);
    if (storesResponse.status !== 200) throw new Error(`Merchant setup failed: HTTP ${storesResponse.status}`);
    let store = (storesResponse.body.stores as Array<{ id: string; name: string }>).find((candidate) => candidate.name === name);
    if (!store) {
      const created = await request(app).post("/api/stores").set(auth).send({ name, slug: definition.slug, currency: "USD", country: "US" });
      if (created.status !== 201) throw new Error(`Dedicated store creation failed: HTTP ${created.status}`);
      store = created.body.store as { id: string; name: string };
    }
    await remember(definition.key, store.name);

    const installed = await request(app).post(`/api/stores/${store.id}/storefront/starters/${definition.pack}/install`).set(auth);
    if (installed.status !== 201) throw new Error(`${definition.pack} installation failed: HTTP ${installed.status}`);

    const catalogPath = `/api/stores/${store.id}/catalog`;
    const products = await request(app).get(`${catalogPath}/products?limit=100`).set(auth);
    if (products.status !== 200) throw new Error(`Catalog read failed: HTTP ${products.status}`);
    let product = (products.body.nodes as Array<{ id: string; handle: string }>).find((candidate) => candidate.handle === "e2e-featured-product");
    if (!product) {
      const created = await request(app).post(`${catalogPath}/products`).set(auth).send({
        handle: "e2e-featured-product", title: definition.product, description: `A real Catalog Product for ${definition.name}.`, status: "ACTIVE",
        variants: [{ title: "Standard", priceMinor: 2499, quantity: 10 }],
      });
      if (created.status !== 201) throw new Error(`Catalog Product creation failed: HTTP ${created.status}`);
      product = created.body as { id: string; handle: string };
    }

    // The current Catalog SQL adapter reads Collections but does not implement Collection writes.
    // Seed only this dedicated store's canonical Collection row, then associate the Product through the Catalog API.
    const collection = await pool.query<{ id: string }>(
      `SELECT "id" FROM "Collection" WHERE "storeId" = $1 AND "slug" = 'e2e-featured-collection'`, [store.id],
    );
    const collectionId = collection.rows[0]?.id ?? `collection-${randomUUID()}`;
    if (!collection.rows[0]) {
      await pool.query(
        `INSERT INTO "Collection" ("id", "storeId", "title", "slug", "description", "updatedAt")
         VALUES ($1, $2, $3, 'e2e-featured-collection', $4, CURRENT_TIMESTAMP)`,
        [collectionId, store.id, `${definition.product} Collection`, "Selected pieces for the E2E storefront."],
      );
    }
    const associated = await request(app).patch(`${catalogPath}/products/${product.id}`).set(auth).send({ collectionIds: [collectionId], status: "ACTIVE" });
    if (associated.status !== 200) throw new Error(`Catalog collection association failed: HTTP ${associated.status}`);
    await pool.query(
      `INSERT INTO "CollectionProduct" ("storeId", "collectionId", "productId", "position") VALUES ($1, $2, $3, 0)
       ON CONFLICT ("storeId", "collectionId", "productId") DO NOTHING`,
      [store.id, collectionId, product.id],
    );

    const contentPath = `/api/stores/${store.id}/content`;
    const blogs = await request(app).get(`${contentPath}/blogs`).set(auth);
    if (blogs.status !== 200) throw new Error(`Blog read failed: HTTP ${blogs.status}`);
    let blog = (blogs.body as Array<{ id: string; handle: string }>).find((candidate) => candidate.handle === "e2e-journal");
    if (!blog) {
      const created = await request(app).post(`${contentPath}/blogs`).set(auth)
        .send({ title: `${definition.name} Journal`, handle: "e2e-journal" });
      if (created.status !== 201) throw new Error(`Blog creation failed: HTTP ${created.status}`);
      blog = created.body as { id: string; handle: string };
    }
    const articles = await request(app).get(`${contentPath}/articles?blogId=${encodeURIComponent(blog.id)}`).set(auth);
    if (articles.status !== 200) throw new Error(`Article read failed: HTTP ${articles.status}`);
    let article = (articles.body as Array<{ id: string; handle: string; status: string }>).find((candidate) => candidate.handle === "e2e-store-story");
    if (!article) {
      const created = await request(app).post(`${contentPath}/articles`).set(auth).send({
        blogId: blog.id, title: `${definition.name} Store Story`, handle: "e2e-store-story",
        excerpt: "A short story from this dedicated test shop.", content: { text: "Thoughtful products for everyday life." },
      });
      if (created.status !== 201) throw new Error(`Article creation failed: HTTP ${created.status}`);
      article = created.body as { id: string; handle: string; status: string };
    }
    if (article.status !== "PUBLISHED") {
      const published = await request(app).post(`${contentPath}/articles/${article.id}/publish`).set(auth);
      if (published.status !== 200) throw new Error(`Article publication failed: HTTP ${published.status}`);
    }

    const workspace = await request(app).get(`/api/stores/${store.id}/storefront/workspace`).set(auth);
    const templates = await request(app).get(`/api/stores/${store.id}/storefront/templates`).set(auth);
    const detail = await request(app).get(`${catalogPath}/products/${product.id}`).set(auth);
    const collectionDetail = await request(app).get(`${catalogPath}/collections/${collectionId}`).set(auth);
    if (workspace.status !== 200 || templates.body.length !== 9 || detail.body.status !== "ACTIVE" ||
        !detail.body.variants?.length || collectionDetail.body.products?.[0]?.id !== product.id) {
      throw new Error(`${definition.pack} E2E data failed its read-back checks`);
    }
    const validation = await request(app).post(`/api/stores/${store.id}/storefront/validate`).set(auth)
      .send({ expectedGeneration: workspace.body.generation });
    if (validation.status !== 200 || !validation.body.ok) {
      throw new Error(`${definition.pack} validation failed: HTTP ${validation.status}; codes ${JSON.stringify((validation.body.diagnostics ?? []).map((item: { code: string }) => item.code))}`);
    }
    console.log(`${definition.pack}: dedicated store, nine templates, live Product/Collection/Blog/Article, and compiler validation ready`);
  }
  console.log(`Local E2E credentials and store names are stored only in ${path.relative(process.cwd(), localEnvironmentFile)} (git-ignored).`);
} finally {
  await pool.end();
  await client.auth.signOut();
}
