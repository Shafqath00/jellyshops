import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogPostgresRepository } from "../../src/catalog/postgres-repository.js";
import { CatalogService, type CatalogAdmin } from "../../src/catalog/service.js";
import { ImageFetchError } from "../../src/catalog-bulk/image-fetch.js";
import { ProductBulkService, type ImageTools } from "../../src/catalog-bulk/service.js";
import { toCsv } from "../../src/catalog-bulk/sheet.js";
import { ApiError } from "../../src/http/errors.js";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

const file = (rows: string[][]) => Buffer.from(toCsv([["Handle", "Title", "Price", "SKU", "Image URLs"], ...rows]), "utf8");

describe("photos in imports and bulk photo upload", () => {
  let database: IntegrationDatabase;
  let catalog: CatalogAdmin;
  let bulk: ProductBulkService;
  let tools: Required<ImageTools>;
  let stored = 0;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261101000000_collection_description_document.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    const repository = new CatalogPostgresRepository(database);
    catalog = new CatalogService(repository, repository) as unknown as CatalogAdmin;
    stored = 0;
    tools = {
      // Stands in for the media service: the same bytes give the same file, as the real one does.
      upload: vi.fn(async (storeId: string, fileName: string, contents: Buffer) => {
        if (contents.toString() === "not-an-image") throw new ApiError(415, "MEDIA_TYPE_UNSUPPORTED", "Upload a PNG, JPEG, WebP, GIF, or AVIF image");
        const id = `media-${contents.toString()}`;
        const existing = await database.query(`SELECT 1 FROM "Media" WHERE "storeId"=$1 AND "id"=$2`, [storeId, id]);
        if (!existing.rows.length) {
          stored++;
          await database.query(`INSERT INTO "Media" ("id","storeId","type","storageKey","url","mimeType","byteSize","originalName","altText") VALUES ($1,$2,'image',$1,$3,'image/jpeg',1,$4,NULL)`, [id, storeId, `/api/public/media/${storeId}/${id}`, fileName]);
        }
        return { id };
      }),
      fetch: vi.fn(async (url: string) => {
        if (url.includes("missing")) throw new ImageFetchError("was not found (404)");
        if (url.includes("page")) return { buffer: Buffer.from("not-an-image"), fileName: "page.html" };
        return { buffer: Buffer.from(url.split("/").pop()!), fileName: url.split("/").pop()! };
      }),
    };
    bulk = new ProductBulkService(database, catalog, Date.now, tools);
  });
  afterEach(async () => { await database.close(); });

  const importFile = async (rows: string[][], mode: "create" | "update" | "upsert" = "upsert") => {
    const uploaded = await bulk.upload("store-a", "user-1", "photos.csv", file(rows));
    const checked = await bulk.check("store-a", uploaded.id, uploaded.mapping, mode);
    let view = await bulk.run("store-a", uploaded.id);
    while (view.status !== "finished") view = await bulk.run("store-a", uploaded.id);
    return { id: uploaded.id, checked, view };
  };
  const photos = async (handle: string) => (await catalog.findProducts("store-a", { handles: [handle] }))[0].media.map((media) => media.id);

  it("adds photos from web addresses to a new product, in the file's order", async () => {
    const { checked, view } = await importFile([["oak-bed", "Oak bed", "499", "OAK", "https://cdn.example.com/front.jpg; https://cdn.example.com/side.jpg"]]);
    expect(checked.plans[0]).toMatchObject({ action: "create" });
    expect(view.counts).toMatchObject({ created: 1, failed: 0 });
    expect(view.counts.photoProblems ?? 0).toBe(0);
    expect(await photos("oak-bed")).toEqual(["media-front.jpg", "media-side.jpg"]);
    expect(tools.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the product when a photo cannot be added and says which one in the report", async () => {
    const { id, view } = await importFile([["oak-bed", "Oak bed", "499", "OAK", "https://cdn.example.com/front.jpg; https://cdn.example.com/missing.jpg; https://cdn.example.com/page"]]);
    expect(view.counts).toMatchObject({ created: 1, failed: 0, photoProblems: 1 });
    expect(await photos("oak-bed")).toEqual(["media-front.jpg"]);
    const report = await bulk.report("store-a", id);
    expect(report.slice(1)).toEqual([
      ["2", "oak-bed", "Oak bed", "Image URLs", "Imported, but a photo was not added", expect.stringMatching(/missing\.jpg" was not found \(404\)\./)],
      ["2", "oak-bed", "Oak bed", "Image URLs", "Imported, but a photo was not added", expect.stringMatching(/page" is not a picture we can use/)],
    ]);
  });

  it("refuses unsafe or malformed photo addresses at the check, before anything is saved", async () => {
    const uploaded = await bulk.upload("store-a", "user-1", "photos.csv", file([
      ["a", "A", "5", "A", "http://cdn.example.com/a.jpg"],
      ["b", "B", "5", "B", "https://169.254.169.254/latest/meta-data"],
      ["c", "C", "5", "C", "https://localhost/c.jpg; front.jpg"],
      ["d", "D", "5", "D", Array.from({ length: 11 }, (_, index) => `https://cdn.example.com/${index}.jpg`).join(";")],
    ]));
    const checked = await bulk.check("store-a", uploaded.id, uploaded.mapping, "upsert");
    expect(checked.summary).toMatchObject({ problem: 4, create: 0 });
    expect(checked.problems.map((problem) => `${problem.handle}: ${problem.message}`)).toEqual([
      expect.stringMatching(/^a: .*must start with https/), expect.stringMatching(/^b: .*public internet/), expect.stringMatching(/^c: .*public internet/), expect.stringMatching(/^c: "front\.jpg" is not a web address/), expect.stringMatching(/^d: has 11 photos\. The most in one import is 10/),
    ]);
    expect(tools.fetch).not.toHaveBeenCalled();
  });

  it("adds to an existing product's photos without removing or repeating any, and links exported addresses without downloading", async () => {
    await importFile([["oak-bed", "Oak bed", "499", "OAK", "https://cdn.example.com/front.jpg"]]);
    vi.mocked(tools.fetch).mockClear();
    // An exported file lists the store's own photo addresses; one new address is added beside them.
    const { checked, view } = await importFile([["oak-bed", "", "", "OAK", "/api/public/media/store-a/media-front.jpg; https://cdn.example.com/detail.jpg; https://shop.example.com/api/public/media/store-b/other"]]);
    expect(checked.plans[0]).toMatchObject({ action: "update", columns: ["Photos"] });
    expect(view.counts).toMatchObject({ updated: 1, photoProblems: 1 });
    expect(await photos("oak-bed")).toEqual(["media-front.jpg", "media-detail.jpg"]);
    expect(tools.fetch).toHaveBeenCalledTimes(1);
    expect(stored).toBe(2);
  });

  it("matches photo files to products by SKU or handle, ignoring numbering", async () => {
    await importFile([["oak-bed-frame", "Oak bed frame", "499", "OAK-DBL", ""], ["linen-tote", "Linen tote", "24", "", ""]]);
    await catalog.createProduct("store-b", { handle: "secret", title: "Secret", variants: [{ title: "Standard", priceMinor: 100, sku: "SECRET-1" }] });
    const matches = await bulk.matchPhotos("store-a", ["OAK-DBL.jpg", "oak-dbl_2.JPG", "Linen-Tote (3).png", "linen-tote-front.webp", "C:\\photos\\oak-bed-frame-1.jpg", "secret-1.jpg", "holiday.jpg"]);
    expect(matches.map((match) => [match.name, match.product?.handle ?? null, match.matchedBy])).toEqual([
      ["OAK-DBL.jpg", "oak-bed-frame", "sku"], ["oak-dbl_2.JPG", "oak-bed-frame", "sku"], ["Linen-Tote (3).png", "linen-tote", "handle"], ["linen-tote-front.webp", "linen-tote", "handle"],
      ["C:\\photos\\oak-bed-frame-1.jpg", "oak-bed-frame", "handle"], ["secret-1.jpg", null, null], ["holiday.jpg", null, null],
    ]);
  });

  it("uploads a photo onto a product, once, and only inside its own store", async () => {
    await importFile([["linen-tote", "Linen tote", "24", "", ""]]);
    const [tote] = await catalog.findProducts("store-a", { handles: ["linen-tote"] });
    expect(await bulk.addPhoto("store-a", "user-1", tote.id, "tote.jpg", Buffer.from("tote"))).toEqual({ productId: tote.id, photoCount: 1, added: true });
    expect(await bulk.addPhoto("store-a", "user-1", tote.id, "tote-copy.jpg", Buffer.from("tote"))).toEqual({ productId: tote.id, photoCount: 1, added: false });
    expect(await photos("linen-tote")).toEqual(["media-tote"]);
    await expect(bulk.addPhoto("store-b", "user-2", tote.id, "tote.jpg", Buffer.from("x"))).rejects.toMatchObject({ status: 404 });
    await expect(bulk.addPhoto("store-a", "user-1", tote.id, "notes.txt", Buffer.from("not-an-image"))).rejects.toMatchObject({ status: 415 });
  });
});
