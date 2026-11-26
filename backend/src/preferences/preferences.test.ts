import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultStorePreferences } from "@jelly/storefront-schema";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import type { AuthProvider } from "../auth/types.js";
import type { CommerceDatabase } from "../commerce/repository.js";
import { errorHandler } from "../http/errors.js";
import { UrlRedirectService } from "./redirects.js";
import { collectSeoHealth } from "./seo-health.js";
import { createPreferencesRouter, createPublicPreferencesRouter, createRedirectsRouter } from "./routes.js";
import { StorePreferencesService, type PreferenceMediaRecord } from "./service.js";

const owner = { userId: "owner-1", email: "owner@example.test", displayName: "Sam Owner" };
const media: Record<string, PreferenceMediaRecord> = {
  "store-a:icon": { id: "icon", url: "/api/public/media/store-a/icon", mimeType: "image/png", width: 64, height: 64 },
  "store-a:wide": { id: "wide", url: "/api/public/media/store-a/wide", mimeType: "image/jpeg", width: 1200, height: 630 },
  "store-a:tiny": { id: "tiny", url: "/api/public/media/store-a/tiny", mimeType: "image/png", width: 16, height: 16 },
  "store-b:theirs": { id: "theirs", url: "/api/public/media/store-b/theirs", mimeType: "image/png", width: 64, height: 64 },
};

let database: IntegrationDatabase;
let db: CommerceDatabase;
let preferences: StorePreferencesService;
let redirects: UrlRedirectService;

beforeEach(async () => {
  database = await createPGliteDatabase();
  await seedStore(database, "store-a", "store-a");
  await seedStore(database, "store-b", "store-b");
  db = { transaction: (work) => database.transaction((tx) => work(tx)) };
  preferences = new StorePreferencesService(db, async (storeId, mediaId) => media[`${storeId}:${mediaId}`] ?? null);
  redirects = new UrlRedirectService(db);
});
afterEach(async () => { await database.close(); });

function app(role: "OWNER" | "ADMIN" | "STAFF" | null) {
  const auth: AuthProvider = { verify: async () => ({ ...owner, storeIds: role ? ["store-a"] : [], storeRoles: role ? { "store-a": role } : {} }) };
  return express().use(express.json())
    .use("/api/stores/:storeId/preferences", createPreferencesRouter(auth, preferences, db))
    .use("/api/stores/:storeId/redirects", createRedirectsRouter(auth, redirects))
    .use("/api/public/stores/:storeId", createPublicPreferencesRouter(preferences, redirects))
    .use(errorHandler);
}
const auth = { Authorization: "Bearer test" };

describe("store preferences", () => {
  it("starts from the defaults, saves, and refuses an out-of-date revision", async () => {
    expect(await preferences.get("store-a")).toMatchObject({ available: true, revision: 0, preferences: defaultStorePreferences() });
    const next = defaultStorePreferences();
    next.seo.homeTitle = "Harbour beds";
    next.tracking.googleAnalyticsId = "G-AB12CD34EF";
    const saved = await preferences.save("store-a", { revision: 0, preferences: next }, { userId: "owner-1", name: "Sam" });
    expect(saved.revision).toBe(1);
    expect(saved.preferences.seo.homeTitle).toBe("Harbour beds");
    await expect(preferences.save("store-a", { revision: 0, preferences: next }, { userId: "owner-1", name: "Sam" })).rejects.toMatchObject({ status: 409, code: "PREFERENCES_REVISION_CONFLICT" });
    expect((await preferences.get("store-b")).preferences.seo.homeTitle).toBe("");
  });

  it("returns each problem with its field and keeps the old values", async () => {
    const bad = defaultStorePreferences();
    bad.seo.homeDescription = "x".repeat(161);
    bad.tracking.metaPixelId = "<script>";
    await expect(preferences.save("store-a", { revision: 0, preferences: bad }, { userId: "owner-1", name: null })).rejects.toMatchObject({
      status: 422,
      issues: expect.arrayContaining([
        { path: "seo.homeDescription", message: "Homepage description can be up to 160 characters." },
        { path: "tracking.metaPixelId", message: "A Meta Pixel ID is a number of 8 to 20 digits." },
      ]),
    });
    expect((await preferences.get("store-a")).revision).toBe(0);
  });

  it("only accepts this store's photos that suit their use, and takes their address from the file", async () => {
    const save = (patch: (p: ReturnType<typeof defaultStorePreferences>) => void) => {
      const next = defaultStorePreferences(); patch(next);
      return preferences.save("store-a", { revision: 0, preferences: next }, { userId: "owner-1", name: null });
    };
    const image = (mediaId: string) => ({ mediaId, url: "https://evil.example/x.png", width: 1, height: 1, alt: "" });
    await expect(save((p) => { p.seo.favicon = image("theirs"); })).rejects.toMatchObject({ issues: [{ path: "seo.favicon", message: "That photo is no longer in your files. Choose another." }] });
    await expect(save((p) => { p.seo.favicon = image("wide"); })).rejects.toMatchObject({ issues: [{ path: "seo.favicon", message: "Use a PNG, WebP or GIF for the browser tab icon." }] });
    await expect(save((p) => { p.seo.favicon = image("tiny"); })).rejects.toMatchObject({ issues: [{ path: "seo.favicon", message: "The icon must be at least 32 × 32 pixels." }] });
    await expect(save((p) => { p.seo.socialImage = image("tiny"); })).rejects.toMatchObject({ issues: [{ path: "seo.socialImage" }] });
    const saved = await save((p) => { p.seo.favicon = image("icon"); p.seo.socialImage = { ...image("wide"), alt: "Our showroom" }; });
    expect(saved.preferences.seo.favicon).toEqual({ mediaId: "icon", url: "/api/public/media/store-a/icon", width: 64, height: 64, alt: "" });
    expect(saved.preferences.seo.socialImage).toMatchObject({ url: "/api/public/media/store-a/wide", width: 1200, alt: "Our showroom" });
  });

  it("keeps a history of who changed which sections, newest first, up to 50", async () => {
    let revision = 0;
    for (let i = 0; i < 52; i += 1) {
      const next = defaultStorePreferences();
      next.business.phone = `+44 20 7946 ${String(1000 + i)}`;
      if (i === 51) next.social.instagram = "https://instagram.com/harbour";
      revision = (await preferences.save("store-a", { revision, preferences: next }, { userId: "owner-1", name: "Sam" })).revision;
    }
    const history = await preferences.history("store-a");
    expect(history).toHaveLength(50);
    expect(history[0]).toMatchObject({ actorName: "Sam", sections: ["business", "social"] });
    expect(history[1].sections).toEqual(["business"]);
  });

  it("lets owners and admins in, keeps staff and other shops out", async () => {
    expect((await request(app("OWNER")).get("/api/stores/store-a/preferences").set(auth)).status).toBe(200);
    expect((await request(app("ADMIN")).get("/api/stores/store-a/preferences").set(auth)).status).toBe(200);
    expect((await request(app("STAFF")).put("/api/stores/store-a/preferences").set(auth).send({ revision: 0, preferences: defaultStorePreferences() })).status).toBe(403);
    expect((await request(app("OWNER")).get("/api/stores/store-b/preferences").set(auth)).status).toBe(404);
    expect((await request(app("STAFF")).get("/api/stores/store-a/redirects").set(auth)).status).toBe(403);
  });

  it("saves through the API and shows the result to storefront pages", async () => {
    const next = defaultStorePreferences();
    next.seo.homeTitle = "Harbour";
    const saved = await request(app("OWNER")).put("/api/stores/store-a/preferences").set(auth).send({ revision: 0, preferences: next });
    expect(saved.status).toBe(200);
    expect(saved.headers["cache-control"]).toBe("no-store");
    const shown = await request(app(null)).get("/api/public/stores/store-a/preferences");
    expect(shown.body.preferences.seo.homeTitle).toBe("Harbour");
    expect((await request(app("OWNER")).get("/api/stores/store-a/preferences/history").set(auth)).body.changes[0]).toMatchObject({ actorName: "Sam Owner", sections: ["seo"] });
  });
});

describe("URL redirects", () => {
  it("adds, lists, edits and removes redirects", async () => {
    const created = await redirects.create("store-a", { from: "old-beds/", to: "collections/beds" });
    expect(created).toMatchObject({ from: "/old-beds", to: "/collections/beds" });
    await expect(redirects.create("store-a", { from: "/old-beds", to: "/x" })).rejects.toMatchObject({ status: 409, code: "REDIRECT_EXISTS" });
    expect((await redirects.list("store-a", { q: "beds" })).total).toBe(1);
    expect((await redirects.list("store-b")).total).toBe(0);
    await expect(redirects.update("store-b", created.id, { from: "/a", to: "/b" })).rejects.toMatchObject({ status: 404 });
    expect(await redirects.update("store-a", created.id, { from: "/old-beds", to: "https://example.com/beds" })).toMatchObject({ to: "https://example.com/beds" });
    expect(await redirects.remove("store-b", [created.id])).toBe(0);
    expect(await redirects.remove("store-a", [created.id])).toBe(1);
  });

  it("refuses loops and protected addresses with plain messages", async () => {
    await redirects.create("store-a", { from: "/a", to: "/b" });
    await expect(redirects.create("store-a", { from: "/b", to: "/a" })).rejects.toMatchObject({ status: 422, message: "This would send shoppers round in a circle between redirects." });
    await expect(redirects.create("store-a", { from: "/checkout", to: "/a" })).rejects.toMatchObject({ status: 422 });
  });

  it("checks a CSV first, then saves only the good rows", async () => {
    await redirects.create("store-a", { from: "/kept", to: "/old-target" });
    const csv = "Redirect from,Redirect to\n/one,/collections/one\n/two,/\n/kept,/new-target\n,/missing\n/one,/collections/one-again\n/cart,/x\n";
    const check = await redirects.importCsv("store-a", csv, { apply: false, replace: false });
    expect(check).toMatchObject({ added: 2, replaced: 0, applied: false });
    expect(check.rows.map((row) => [row.line, row.problem === null])).toEqual([[1, false], [2, true], [3, false], [4, false], [5, true], [6, false]]);
    expect(check.rows[0].problem).toBe("Replaced by line 5 for the same address.");
    expect((await redirects.list("store-a")).total).toBe(1);
    const applied = await redirects.importCsv("store-a", csv, { apply: true, replace: true });
    expect(applied).toMatchObject({ added: 2, replaced: 1, applied: true });
    expect(await redirects.resolve("store-a", "/one")).toBe("/collections/one-again");
    expect(await redirects.resolve("store-a", "/kept")).toBe("/new-target");
  });

  it("resolves old addresses for storefront pages, with or without a query", async () => {
    await redirects.create("store-a", { from: "/sale", to: "/collections/sale" });
    await redirects.create("store-a", { from: "/sale?colour=red", to: "/collections/red" });
    expect(await redirects.resolve("store-a", "/sale/")).toBe("/collections/sale");
    expect(await redirects.resolve("store-a", "/sale?colour=red")).toBe("/collections/red");
    expect(await redirects.resolve("store-a", "/sale?colour=blue")).toBe("/collections/sale");
    expect(await redirects.resolve("store-b", "/sale")).toBeNull();
    const response = await request(app(null)).get("/api/public/stores/store-a/url-redirect").query({ path: "/sale" });
    expect(response.body).toEqual({ to: "/collections/sale" });
  });
});

describe("SEO health", () => {
  const exec = (sql: string, values: unknown[] = []) => database.query(sql, values);
  const product = (id: string, title: string, extra: { description?: string; seoTitle?: string | null; seoDescription?: string | null; status?: string; store?: string } = {}) =>
    exec(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "description", "seoTitle", "seoDescription", "status", "updatedAt") VALUES ($1, $2, $3, $1, $4, $5, $6, $7::"ProductStatus", CURRENT_TIMESTAMP)`,
      [id, extra.store ?? "store-a", title, extra.description ?? "", extra.seoTitle ?? null, extra.seoDescription ?? null, extra.status ?? "ACTIVE"]);
  const photo = (productId: string, mediaId: string, alt: string | null, mediaAlt: string | null = null, store = "store-a") =>
    exec(`INSERT INTO "Media" ("id", "storeId", "type", "storageKey", "url", "mimeType", "byteSize", "originalName", "altText") VALUES ($1, $2, 'image', $1, '/x', 'image/png', 1, 'x.png', $3)`, [mediaId, store, mediaAlt])
      .then(() => exec(`INSERT INTO "ProductMedia" ("storeId", "productId", "mediaId", "altText") VALUES ($1, $2, $3, $4)`, [store, productId, mediaId, alt]));
  const find = (report: Awaited<ReturnType<typeof collectSeoHealth>>, id: string) => report.checks.find((entry) => entry.id === id);

  it("counts what is wrong among live products only, per store", async () => {
    await product("oak", "Oak bed", { description: "Solid oak.", seoDescription: "x".repeat(170) });
    await product("pine", "Pine bed");                                                   // no description at all
    await product("dupe-1", "Same name", { description: "a" });
    await product("dupe-2", "Same name", { description: "b" });
    await product("titled", "Own", { description: "a", seoTitle: "t".repeat(80) });
    await product("draft", "Draft one", { status: "DRAFT" });                              // never counted
    await product("other", "Other store", { store: "store-b" });                            // never counted
    await photo("oak", "m1", "Oak bed in a bedroom");
    await photo("oak", "m2", null, "Alt on the file itself");                               // the file's description counts
    await photo("oak", "m3", "  ");                                                        // blank is missing
    const report = await collectSeoHealth(db, "store-a", defaultStorePreferences());
    expect(report.counts.products).toBe(5);
    expect(find(report, "product-no-description")).toMatchObject({ total: 5, count: 1, items: [{ kind: "product", id: "pine", label: "Pine bed" }] });
    expect(find(report, "product-no-photo")?.count).toBe(4);
    expect(find(report, "product-photo-alt")).toMatchObject({ total: 3, count: 1, items: [{ id: "oak" }] });
    expect(find(report, "product-duplicate-title")).toMatchObject({ count: 2 });
    expect(find(report, "product-title-long")).toMatchObject({ count: 1, items: [{ id: "titled" }] });
    expect(find(report, "product-description-long")).toMatchObject({ count: 1, items: [{ id: "oak" }] });
    expect((await collectSeoHealth(db, "store-b", defaultStorePreferences())).counts.products).toBe(1);
  });

  it("checks published pages, posts and collections and leaves out hidden or archived ones", async () => {
    const page = (id: string, status: string, extra = "") => exec(`INSERT INTO "StorePage" ("id", "storeId", "title", "handle", "content", "status", "updatedAt" ${extra ? ", " + extra.split("=")[0] : ""}) VALUES ($1, 'store-a', $1, $1, '{}', $2::"ContentStatus", CURRENT_TIMESTAMP ${extra ? ", " + extra.split("=")[1] : ""})`, [id, status]);
    await page("about", "PUBLISHED");
    await page("done", "PUBLISHED", `"seoDescription"='Described'`);
    await page("hidden", "PUBLISHED", `"noindex"=true`);
    await page("draft-page", "DRAFT");
    await exec(`INSERT INTO "Blog" ("id", "storeId", "title", "handle", "updatedAt") VALUES ('b1', 'store-a', 'News', 'news', CURRENT_TIMESTAMP)`);
    await exec(`INSERT INTO "Article" ("id", "storeId", "blogId", "title", "handle", "excerpt", "content", "status", "updatedAt") VALUES ('p1', 'store-a', 'b1', 'No words', 'p1', '', '{}', 'PUBLISHED', CURRENT_TIMESTAMP), ('p2', 'store-a', 'b1', 'Has summary', 'p2', 'A summary', '{}', 'PUBLISHED', CURRENT_TIMESTAMP)`);
    await exec(`INSERT INTO "Collection" ("id", "storeId", "title", "slug", "description", "updatedAt") VALUES ('c1', 'store-a', 'Beds', 'beds', '', CURRENT_TIMESTAMP), ('c2', 'store-a', 'Sale', 'sale', 'On sale', CURRENT_TIMESTAMP)`);
    const report = await collectSeoHealth(db, "store-a", defaultStorePreferences());
    expect(report.counts).toMatchObject({ pages: 2, posts: 2, collections: 2 });
    expect(find(report, "page-no-description")).toMatchObject({ total: 2, count: 1, items: [{ kind: "page", id: "about" }] });
    expect(find(report, "post-no-description")).toMatchObject({ total: 2, count: 1, items: [{ kind: "post", id: "p1" }] });
    expect(find(report, "collection-no-description")).toMatchObject({ total: 2, count: 1, items: [{ kind: "collection", id: "c1" }] });
  });

  it("reports the state of each policy page", async () => {
    await exec(`INSERT INTO "StorePage" ("id", "storeId", "title", "handle", "content", "status", "updatedAt") VALUES ('pp', 'store-a', 'Privacy', 'privacy', '{}', 'PUBLISHED', CURRENT_TIMESTAMP), ('rp', 'store-a', 'Returns', 'returns', '{}', 'DRAFT', CURRENT_TIMESTAMP)`);
    const prefs = defaultStorePreferences();
    prefs.policies.shipping = "";
    const report = await collectSeoHealth(db, "store-a", prefs);
    expect(report.policies).toEqual({ privacy: "published", refund: "draft", terms: "missing", shipping: "unset" });
  });

  it("is served to owners and admins only, from saved preferences", async () => {
    await product("pine", "Pine bed");
    const ok = await request(app("ADMIN")).get("/api/stores/store-a/preferences/seo-health").set(auth);
    expect(ok.status).toBe(200);
    expect(ok.body.checks.find((entry: { id: string }) => entry.id === "product-no-description")).toMatchObject({ count: 1 });
    expect((await request(app("STAFF")).get("/api/stores/store-a/preferences/seo-health").set(auth)).status).toBe(403);
    expect((await request(app("OWNER")).get("/api/stores/store-b/preferences/seo-health").set(auth)).status).toBe(404);
  });
});
