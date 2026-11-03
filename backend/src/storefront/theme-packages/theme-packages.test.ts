import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../../test/integration/pglite.js";
import { errorHandler } from "../../http/errors.js";
import type { MediaStorage } from "../../media/storage.js";
import { compareVersions, parseThemePackage } from "./package-format.js";
import { createPublicThemeVersionRouter, isThemePackageUpload } from "./routes.js";
import { ThemePackageService } from "./service.js";

// The example theme the developer guide builds, packaged the way `jelly-theme package` will.
const exampleDirectory = [resolve(process.cwd(), "../docs/examples/jelly-studio"), resolve(process.cwd(), "docs/examples/jelly-studio")].find((path) => existsSync(path)) ?? "";
const read = (name: string) => readFileSync(resolve(exampleDirectory, name), "utf8");
const asset = (name: string, contentType: string) => ({ path: name, contentType, base64: Buffer.from(read(`assets/${name}`)).toString("base64") });
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString("base64");

function themePackage(overrides: { id?: string; version?: string; css?: string; assets?: unknown[]; mutate?: (manifest: Record<string, any>) => void } = {}) {
  const manifest = JSON.parse(read("theme.json"));
  const id = overrides.id ?? "jelly-studio";
  const text = JSON.stringify(manifest).replaceAll("jelly-studio", id);
  const renamed = JSON.parse(text);
  renamed.version = overrides.version ?? renamed.version;
  overrides.mutate?.(renamed);
  return { format: 1, manifest: renamed, starter: JSON.parse(read("starter.json")), css: overrides.css ?? "& h1 { color: red; }", assets: overrides.assets ?? [asset("preview.svg", "image/svg+xml"), asset("mark.svg", "image/svg+xml")] };
}

class MemoryStorage implements MediaStorage {
  files = new Map<string, Buffer>();
  async put({ storeId, mediaId, extension, contents }: { storeId: string; mediaId: string; extension: string; contents: Buffer }) {
    const key = `${storeId}/${mediaId}.${extension}`;
    this.files.set(key, contents);
    return key;
  }
  async open(key: string) { return this.files.get(key) ?? null; }
  async remove(key: string) { this.files.delete(key); }
}

describe("parseThemePackage", () => {
  it("accepts the example theme and scopes its stylesheet to the theme", () => {
    const parsed = parseThemePackage(themePackage());
    expect(parsed).toMatchObject({ themeId: "jelly-studio", version: "1.0.0" });
    expect(parsed.css).toContain('[data-jelly-theme="jelly-studio"]');
    expect(parsed.assets.map((entry) => entry.path)).toEqual(["preview.svg", "mark.svg"]);
    expect(parsed.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(parseThemePackage(themePackage()).contentHash).toBe(parsed.contentHash);
  });

  it.each([
    ["something that is not a package", { nope: true }, /not a theme package/],
    ["a built-in theme id", themePackage({ id: "jelly-avenue" }), /ships with the platform/],
    ["a script in the starter", (() => { const p = themePackage(); (p.starter as any).templates.home.sections[2].section.blocks[0].settings.text = "<script>x</script>"; return p; })(), /problem/],
    ["CSS that imports another file", themePackage({ css: "@import url(https://evil.test/a.css);" }), /theme\.css/],
    ["CSS that loads a non-https image", themePackage({ css: "& { background: url(http://evil.test/a.png); }" }), /theme\.css/],
    ["an asset type that is not allowed", themePackage({ assets: [{ path: "app.js", contentType: "text/javascript", base64: "YQ==" }] }), /not allowed/],
    ["a png whose content is something else", themePackage({ assets: [{ path: "a.png", contentType: "image/png", base64: Buffer.from("not a png").toString("base64") }] }), /does not match/],
    ["an svg with a script", themePackage({ assets: [{ path: "a.svg", contentType: "image/svg+xml", base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64") }] }), /cannot contain scripts/],
    ["a file path that climbs out", themePackage({ assets: [{ path: "../a.png", contentType: "image/png", base64: PNG }] }), /file names/],
    ["a file the manifest names but the package lacks", themePackage({ assets: [] }), /problem/],
  ])("refuses %s with a plain message", (_label, input, message) => {
    expect(() => parseThemePackage(input)).toThrow(message);
    try { parseThemePackage(input); } catch (error) { expect(error).toMatchObject({ status: 400, code: "INVALID_PACKAGE" }); }
  });

  it("compares versions numerically", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "10.0.0")).toBeLessThan(0);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });
});

describe("ThemePackageService", () => {
  let database: IntegrationDatabase;
  let storage: MemoryStorage;
  let service: ThemePackageService;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    await seedStore(database, "store-b", "b");
    storage = new MemoryStorage();
    service = new ThemePackageService(database as never, storage);
  });
  afterEach(async () => database.close());

  it("stores a new package and version with its files, and lists it for its owner only", async () => {
    const result = await service.upload("store-a", themePackage());
    expect(result).toMatchObject({ created: true, package: { themeId: "jelly-studio" }, version: { version: "1.0.0", status: "active" } });
    expect(storage.files.size).toBe(2);
    const listed = await service.list("store-a");
    expect(listed).toHaveLength(1);
    expect(listed[0].versions.map((version) => version.version)).toEqual(["1.0.0"]);
    expect(await service.list("store-b")).toEqual([]);
  });

  it("recognises an identical re-upload and refuses changed content under the same version", async () => {
    const first = await service.upload("store-a", themePackage());
    const again = await service.upload("store-a", themePackage());
    expect(again).toMatchObject({ created: false, version: { id: first.version.id } });
    expect(storage.files.size).toBe(2);
    await expect(service.upload("store-a", themePackage({ css: "& h1 { color: blue; }" }))).rejects.toMatchObject({ status: 409, code: "VERSION_EXISTS" });
  });

  it("only moves forward: a newer version is added, an older one is refused", async () => {
    await service.upload("store-a", themePackage({ version: "1.2.0" }));
    await expect(service.upload("store-a", themePackage({ version: "1.1.0" }))).rejects.toMatchObject({ status: 409, code: "VERSION_NOT_NEWER" });
    const next = await service.upload("store-a", themePackage({ version: "1.10.0" }));
    expect(next.created).toBe(true);
    expect((await service.list("store-a"))[0].versions.map((version) => version.version).sort(compareVersions)).toEqual(["1.2.0", "1.10.0"]);
  });

  it("keeps a theme id with its first owner", async () => {
    await service.upload("store-a", themePackage());
    await expect(service.upload("store-b", themePackage({ version: "2.0.0" }))).rejects.toMatchObject({ status: 409, code: "THEME_ID_TAKEN" });
  });

  it("yanks a version for its owner only, and a yanked version stays readable", async () => {
    const { version } = await service.upload("store-a", themePackage());
    await expect(service.yank("store-b", version.id)).rejects.toMatchObject({ status: 404 });
    await service.yank("store-a", version.id);
    expect(await service.getVersion(version.id)).toMatchObject({ status: "yanked", themeId: "jelly-studio" });
  });

  it("serves a version and its files by id, and not files it does not have", async () => {
    const { version } = await service.upload("store-a", themePackage());
    const loaded = await service.getVersion(version.id);
    expect(loaded).toMatchObject({ themeId: "jelly-studio", version: "1.0.0" });
    expect(loaded?.css).toContain('[data-jelly-theme="jelly-studio"]');
    expect(loaded?.assets.map((entry) => entry.path)).toEqual(["preview.svg", "mark.svg"]);
    expect((await service.openAsset(version.id, "mark.svg"))?.contentType).toBe("image/svg+xml");
    expect(await service.openAsset(version.id, "other.svg")).toBeNull();
    expect(await service.getVersion("missing")).toBeNull();
  });

  it("removes stored files when the database write fails", async () => {
    const failing = new ThemePackageService({ query: async (text: string, values?: unknown[]) => { if (text.includes('INSERT INTO "ThemePackageVersion"')) throw new Error("boom"); return database.query(text, values as never) as never; } } as never, storage);
    await expect(failing.upload("store-a", themePackage())).rejects.toThrow("boom");
    expect(storage.files.size).toBe(0);
  });

  describe("public routes", () => {
    it("send immutable, locked-down responses and 404 for unknown versions", async () => {
      const { version } = await service.upload("store-a", themePackage());
      const app = express();
      app.use("/api/public", createPublicThemeVersionRouter(service));
      app.use(errorHandler);

      const info = await request(app).get(`/api/public/theme-versions/${version.id}`);
      expect(info.status).toBe(200);
      expect(info.headers["cache-control"]).toContain("immutable");
      expect(info.body.version.themeId).toBe("jelly-studio");

      const file = await request(app).get(`/api/public/theme-versions/${version.id}/assets/mark.svg`);
      expect(file.status).toBe(200);
      expect(file.headers["content-type"]).toContain("image/svg+xml");
      expect(file.headers["content-security-policy"]).toContain("sandbox");
      expect(file.headers["x-content-type-options"]).toBe("nosniff");

      expect((await request(app).get("/api/public/theme-versions/nope")).status).toBe(404);
      expect((await request(app).get(`/api/public/theme-versions/${version.id}/assets/missing.svg`)).status).toBe(404);
    });
  });
});

describe("isThemePackageUpload", () => {
  it("matches only the upload request, so every other route keeps the normal body limit", () => {
    expect(isThemePackageUpload({ method: "POST", path: "/api/stores/s1/theme-packages" })).toBe(true);
    expect(isThemePackageUpload({ method: "GET", path: "/api/stores/s1/theme-packages" })).toBe(false);
    expect(isThemePackageUpload({ method: "POST", path: "/api/stores/s1/products" })).toBe(false);
    expect(isThemePackageUpload({ method: "POST", path: "/api/stores/s1/theme-packages/versions/v/yank" })).toBe(false);
  });
});

describe("a package made by the jelly-theme CLI", () => {
  it("is accepted by the upload service exactly as built", async () => {
    // The CLI and the platform must agree: scaffold a theme, package it, upload it.
    // @ts-expect-error plain JavaScript modules of the CLI package
    const { create } = await import("../../../../jellyshops/packages/theme-cli/src/create.mjs");
    // @ts-expect-error plain JavaScript modules of the CLI package
    const { buildPackage } = await import("../../../../jellyshops/packages/theme-cli/src/package.mjs");
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const directory = mkdtempSync(join(tmpdir(), "jelly-contract-"));
    const original = process.cwd();
    process.chdir(directory);
    try { await create("from-cli"); } finally { process.chdir(original); }
    const built = buildPackage(join(directory, "from-cli"));

    const database = await createPGliteDatabase();
    try {
      await seedStore(database, "store-a", "a");
      const service = new ThemePackageService(database as never, new MemoryStorage());
      const result = await service.upload("store-a", JSON.parse(JSON.stringify(built.content)));
      expect(result).toMatchObject({ created: true, package: { themeId: "from-cli" }, version: { version: "1.0.0" } });
      const stored = await service.getVersion(result.version.id);
      expect(stored?.css).toContain('[data-jelly-theme="from-cli"]');
      expect(stored?.starter).toBeTruthy();
    } finally { await database.close(); }
  });
});
