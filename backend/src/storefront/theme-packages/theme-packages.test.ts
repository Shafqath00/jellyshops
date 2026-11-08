import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../../test/integration/pglite.js";
import type { SqlExecutor } from "../../commerce/repository.js";
import { errorHandler } from "../../http/errors.js";
import { StorefrontStarterInstallationService } from "../starter/installation-service.js";
import { createLocalV4CompilationService } from "../local-v4-compilation.js";
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
  return { format: 1, manifest: renamed, starter: JSON.parse(read("starter.json").replaceAll("jelly-studio", id)), css: overrides.css ?? "& h1 { color: red; }", assets: overrides.assets ?? [asset("preview.svg", "image/svg+xml"), asset("mark.svg", "image/svg+xml")] };
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
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.11")).toBeLessThan(0);
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0+one", "1.0.0+two")).toBe(0);
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

  it("requires an actual newer SemVer release, including prerelease ordering and metadata equivalence", async () => {
    await service.upload("store-a", themePackage({ version: "1.0.0-beta.11" }));
    await expect(service.upload("store-a", themePackage({ version: "1.0.0-beta.2" }))).rejects.toMatchObject({ code: "VERSION_NOT_NEWER" });
    await expect(service.upload("store-a", themePackage({ version: "1.0.0" }))).resolves.toMatchObject({ created: true });
    await expect(service.upload("store-a", themePackage({ version: "1.0.0+metadata" }))).rejects.toMatchObject({ code: "VERSION_NOT_NEWER" });
  });

  it("rejects removed settings in a minor release and requires a complete migration for a major release", async () => {
    await service.upload("store-a", themePackage());
    const removeSetting = (manifest: Record<string, any>) => { manifest.settingsSchema = manifest.settingsSchema.slice(1); };
    await expect(service.upload("store-a", themePackage({ version: "1.1.0", mutate: removeSetting }))).rejects.toMatchObject({ code: "BREAKING_THEME_CHANGE" });
    await expect(service.upload("store-a", themePackage({ version: "2.0.0" }))).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" });
    await expect(service.upload("store-a", themePackage({ version: "2.0.0", mutate: (manifest) => { manifest.migrations = [{ from: "1.1.0", to: "2.0.0", operations: [] }]; } }))).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" });
    const next = await service.upload("store-a", themePackage({ version: "2.0.0", mutate: (manifest) => {
      removeSetting(manifest);
      manifest.migrations = [{ from: "1.0.0", to: "2.0.0", operations: [{ op: "removeSetting", target: { scope: "theme" }, key: "colors.primary" }] }];
    } }));
    expect(next.created).toBe(true);
    expect((await service.getVersion(next.version.id))?.manifest.migrations).toHaveLength(1);
  });

  it("rejects removed recipes and recipe settings outside a major release", async () => {
    await service.upload("store-a", themePackage());
    // Remove the starter so this checks version compatibility, not a missing section in that starter.
    const removed = themePackage({ version: "1.1.0", mutate: (manifest) => { manifest.sections = []; } }) as Record<string, unknown>;
    delete removed.starter;
    await expect(service.upload("store-a", removed)).rejects.toMatchObject({ code: "BREAKING_THEME_CHANGE" });
    const changed = themePackage({ version: "1.1.0", mutate: (manifest) => { manifest.sections[0].settings.push({ id: "newSetting", type: "text", label: "New setting", default: "" }); } });
    await expect(service.upload("store-a", changed)).resolves.toMatchObject({ created: true });
  });

  it("serializes distinct uploads so each major migration starts at the actual latest release", async () => {
    await service.upload("store-a", themePackage());
    const next = (version: string) => themePackage({ version, mutate: (manifest) => { manifest.migrations = [{ from: "1.0.0", to: version, operations: [] }]; } });
    const results = await Promise.allSettled([service.upload("store-a", next("2.0.0")), service.upload("store-a", next("3.0.0"))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await service.list("store-a"))[0].versions).toHaveLength(2);
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
    const failing = new ThemePackageService({ transaction: (work: (sql: unknown) => Promise<unknown>) => database.transaction((tx) => work({ query: async (text: string, values?: unknown[]) => { if (text.includes('INSERT INTO "ThemePackageVersion"')) throw new Error("boom"); return tx.query(text, values as never); } })) } as never, storage);
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

describe("installing an uploaded theme on a store", () => {
  let database: IntegrationDatabase;
  let service: ThemePackageService;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    await seedStore(database, "store-b", "b");
    const installer = new StorefrontStarterInstallationService({ transaction: (work: never) => database.transaction(work) } as never);
    service = new ThemePackageService(database as never, new MemoryStorage(), installer);
  });
  afterEach(async () => database.close());

  it("installs an older pin after v2, compiles its removed recipe, and reloads both draft and published artifacts", async () => {
    const id = "pinned-both";
    const old = await service.upload("store-a", themePackage({ id }));
    const newer = themePackage({ id, version: "2.0.0", mutate: (manifest) => { manifest.sections = []; manifest.migrations = [{ from: "1.0.0", to: "2.0.0", operations: [] }]; } });
    newer.starter.templates.home.sections = newer.starter.templates.home.sections.filter((placement: any) => placement.section?.type !== `${id}/promo-banner`);
    const next = await service.upload("store-a", newer);
    const installedNew = await service.install("store-a", next.version.id);
    const installedOld = await service.install("store-a", old.version.id, { replaceDraft: true, expectedGeneration: installedNew.generation });
    expect((await database.query(`SELECT "themeVersion", "draftArtifactId" FROM "ThemeConfiguration" WHERE "storeId" = 'store-a'`)).rows[0]).toMatchObject({ themeVersion: "1.0.0", draftArtifactId: old.version.id });
    const compilation = await createLocalV4CompilationService(database as unknown as SqlExecutor).compile("store-a", installedOld.generation);
    expect(compilation).toMatchObject({ ok: true, snapshot: { theme: { id, version: "1.0.0", artifactId: old.version.id } } });
    if (!compilation.ok) throw new Error("The v1 draft did not compile");
    await database.query(`INSERT INTO "StorefrontPublication" ("id", "storeId", "sourceRevision", "sourceGeneration", "schemaVersion", "compilerVersion", "document", "themeArtifactId", "idempotencyKey", "publishedAt") VALUES ('published-v1', 'store-a', $1, $1, 4, 'local-v4-1', $2::jsonb, $3, 'published-v1', NOW())`, [installedOld.generation, JSON.stringify(compilation.snapshot), old.version.id]);
    await service.install("store-a", next.version.id, { replaceDraft: true, expectedGeneration: installedOld.generation });
    const loadedVersions: string[] = [];
    const cold = new ThemePackageService({ query: async (text: string, values?: unknown[]) => {
      const result = await database.query(text, values as never);
      if (text.includes('"ThemePackageVersion"')) loadedVersions.push(...result.rows.map((row: any) => row.version));
      return result;
    } } as never, new MemoryStorage());
    await cold.registerStoreThemes("store-a");
    expect(loadedVersions.sort()).toEqual(["1.0.0", "2.0.0"]);
    expect((await database.query(`SELECT "themeArtifactId", "document"->'theme'->>'version' AS version FROM "StorefrontPublication" WHERE "id" = 'published-v1'`)).rows[0]).toEqual({ themeArtifactId: old.version.id, version: "1.0.0" });
  });

  it("refuses an incompatible stored version before creating draft content or an install", async () => {
    const { version } = await service.upload("store-a", themePackage({ id: "incompatible" }));
    await database.query(`UPDATE "ThemePackageVersion" SET "manifest" = jsonb_set("manifest", '{engines}', '{"jelly": ">=2 <3"}'::jsonb) WHERE "id" = $1`, [version.id]);
    await expect(service.install("store-a", version.id)).rejects.toMatchObject({ status: 422, code: "ENGINE_INCOMPATIBLE" });
    expect((await database.query(`SELECT "id" FROM "ThemeInstall" WHERE "storeId" = 'store-a'`)).rows).toEqual([]);
    expect((await database.query(`SELECT "themeId" FROM "ThemeConfiguration" WHERE "storeId" = 'store-a'`)).rows).toEqual([]);
  });

  it("installs a prerelease with build metadata and the SQL constraints reject invalid SemVer", async () => {
    const { version } = await service.upload("store-a", themePackage({ id: "semver-install", version: "1.0.0-rc.1+build.7" }));
    await expect(service.install("store-a", version.id)).resolves.toMatchObject({ version: "1.0.0-rc.1+build.7" });
    expect((await database.query(`SELECT "themeVersion" FROM "ThemeConfiguration" WHERE "storeId" = 'store-a'`)).rows).toEqual([{ themeVersion: "1.0.0-rc.1+build.7" }]);
    await expect(database.query(`UPDATE "ThemePackageVersion" SET "version" = '01.0.0' WHERE "id" = $1`, [version.id])).rejects.toThrow(/version_check/);
    await expect(database.query(`UPDATE "ThemeConfiguration" SET "themeVersion" = '1.0.0-01' WHERE "storeId" = 'store-a'`)).rejects.toThrow(/themeVersion_check/);
    for (const invalid of ["9007199254740992.0.0", "1.0.0+" + "a".repeat(130)]) {
      expect((await database.query<{ valid: boolean }>(`SELECT jelly_theme_semver_valid($1) AS valid`, [invalid])).rows[0].valid).toBe(false);
    }
  });

  it("aborts the rollout on legacy invalid versions without rewriting them", async () => {
    const { version } = await service.upload("store-a", themePackage({ id: "legacy-version" }));
    await database.exec(`ALTER TABLE "ThemePackageVersion" DROP CONSTRAINT "ThemePackageVersion_version_check"`);
    await database.query(`UPDATE "ThemePackageVersion" SET "version" = '01.0.0' WHERE "id" = $1`, [version.id]);
    const migration = readFileSync(new URL("../../../sql/migrations/20261103010000_theme_semver.sql", import.meta.url), "utf8");
    await expect(database.exec(migration)).rejects.toThrow(/Legacy theme versions/);
    await database.exec("ROLLBACK");
    expect((await service.getVersion(version.id))?.version).toBe("01.0.0");
  });

  it("puts the starter in the draft, pins the uploaded version, and publishes with the theme resolved", async () => {
    const { version } = await service.upload("store-a", themePackage({ id: "install-me" }));
    const result = await service.install("store-a", version.id);
    expect(result).toMatchObject({ themeId: "install-me", version: "1.0.0", installed: true });

    const config = (await database.query(`SELECT "themeId", "themeVersion", "draftArtifactId" FROM "ThemeConfiguration" WHERE "storeId" = 'store-a'`)).rows[0];
    expect(config).toMatchObject({ themeId: "install-me", themeVersion: "1.0.0", draftArtifactId: version.id });
    expect((await database.query(`SELECT "versionId" FROM "ThemeInstall" WHERE "storeId" = 'store-a'`)).rows).toEqual([{ versionId: version.id }]);
    expect((await database.query(`SELECT COUNT(*)::int AS n FROM "StorefrontTemplate" WHERE "storeId" = 'store-a'`)).rows[0]).toMatchObject({ n: 9 });

    const compilation = await createLocalV4CompilationService(database as unknown as SqlExecutor).compile("store-a", result.generation);
    expect(compilation).toMatchObject({ ok: true, snapshot: { theme: { id: "install-me", version: "1.0.0", artifactId: version.id } } });
    expect((compilation as { snapshot: { theme: { fallbackReason?: string } } }).snapshot.theme.fallbackReason).toBeUndefined();
  });

  it("installs on the owner's stores only, refuses yanked versions and themes without a starter", async () => {
    const { version } = await service.upload("store-a", themePackage({ id: "private-one" }));
    await expect(service.install("store-b", version.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.install("store-a", "missing")).rejects.toMatchObject({ status: 404 });
    await service.yank("store-a", version.id);
    await expect(service.install("store-a", version.id)).rejects.toMatchObject({ status: 409, code: "VERSION_YANKED" });

    const bare = themePackage({ id: "no-starter" }) as Record<string, unknown>;
    delete bare.starter;
    const { version: bareVersion } = await service.upload("store-a", bare);
    await expect(service.install("store-a", bareVersion.id)).rejects.toMatchObject({ status: 422, code: "NO_STARTER" });
  });

  it("will not replace an existing draft unless the merchant confirms the generation they saw", async () => {
    const { version } = await service.upload("store-a", themePackage({ id: "again" }));
    const first = await service.install("store-a", version.id);
    await expect(service.install("store-a", version.id, { replaceDraft: true, expectedGeneration: first.generation + 5 })).rejects.toMatchObject({ code: "STARTER_INSTALL_CONFLICT" });
    await expect(service.install("store-a", version.id, { replaceDraft: true, expectedGeneration: first.generation })).resolves.toMatchObject({ themeId: "again" });
  });

  it("registers a store's installed themes for the process, and tolerates stores with none", async () => {
    await expect(service.registerStoreThemes("store-b")).resolves.toBeUndefined();
    const { version } = await service.upload("store-a", themePackage({ id: "loaded-theme" }));
    await service.install("store-a", version.id);
    await service.registerStoreThemes("store-a");
    const { getThemeDefinition } = await import("@jelly/storefront-themes");
    expect(getThemeDefinition("loaded-theme").id).toBe("loaded-theme");
  });
});

describe("theme packages in the assembled app", () => {
  it("are mounted: upload, read publicly, install, and the installed theme publishes", async () => {
    // The routes depend on the app wiring (database, media storage), which the service tests above bypass.
    const { createApp } = await import("../../app.js");
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const directory = await mkdtemp(path.join(tmpdir(), "jelly-theme-app-"));
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    const commerceDatabase = { transaction: (work: (sql: SqlExecutor) => Promise<unknown>) => database.transaction((tx) => work({ query: (sql: string, values?: unknown[]) => tx.query(sql, values as never) } as never)) };
    const app = createApp({
      config: { port: 3001, nodeEnv: "test", corsOrigins: [], trustProxy: false, authProvider: "development", mediaProvider: "local-files", dataDirectory: directory, uploadDirectory: path.join(directory, "uploads"), maxUploadBytes: 1024 * 1024, demoStoreId: "store-a" },
      storefrontSql: database as never,
      commerceDatabase: commerceDatabase as never,
      storefrontStarterApi: new StorefrontStarterInstallationService(commerceDatabase as never),
    } as never);
    const auth = { Authorization: "Bearer jelly-demo-merchant" };

    const uploaded = await request(app).post("/api/stores/store-a/theme-packages").set(auth).send(themePackage({ id: "app-theme" }));
    expect(uploaded.status).toBe(201);
    const versionId = uploaded.body.version.id as string;
    expect((await request(app).post("/api/stores/store-a/theme-packages").set(auth).send(themePackage({ id: "app-theme" }))).status).toBe(200);
    expect((await request(app).post("/api/stores/store-a/theme-packages").send(themePackage())).status).toBe(401);

    const pub = await request(app).get(`/api/public/theme-versions/${versionId}`);
    expect(pub.status).toBe(200);
    expect(pub.body.version.themeId).toBe("app-theme");
    expect((await request(app).get(`/api/public/theme-versions/${versionId}/assets/mark.svg`)).status).toBe(200);

    expect((await request(app).get("/api/stores/store-a/theme-packages").set(auth)).body.packages[0].versions).toHaveLength(1);
    const installed = await request(app).post(`/api/stores/store-a/theme-packages/versions/${versionId}/install`).set(auth).send({});
    expect(installed.status).toBe(201);
    expect(installed.body).toMatchObject({ themeId: "app-theme", version: "1.0.0" });
    const config = (await database.query(`SELECT "themeId", "draftArtifactId" FROM "ThemeConfiguration" WHERE "storeId" = 'store-a'`)).rows[0];
    expect(config).toMatchObject({ themeId: "app-theme", draftArtifactId: versionId });
    await database.close();
  });
});

describe("a theme's own file paths", () => {
  let database: IntegrationDatabase;
  let service: ThemePackageService;
  let app: express.Express;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    service = new ThemePackageService(database as never, new MemoryStorage());
    app = express();
    app.use("/api/public", createPublicThemeVersionRouter(service));
    app.use(errorHandler);
  });
  afterEach(async () => database.close());

  it("serves the newest available version by default and a pinned version on request", async () => {
    await service.upload("store-a", themePackage({ id: "paths-theme", version: "1.0.0" }));
    const newer = await service.upload("store-a", themePackage({ id: "paths-theme", version: "1.1.0" }));
    expect((await service.openThemeAsset("paths-theme", "mark.svg"))?.version).toBe("1.1.0");
    expect((await service.openThemeAsset("paths-theme", "mark.svg", "1.0.0"))?.version).toBe("1.0.0");

    // A withdrawn version is skipped unless a store asks for it by number (stores pinned to it keep working).
    await service.yank("store-a", newer.version.id);
    expect((await service.openThemeAsset("paths-theme", "mark.svg"))?.version).toBe("1.0.0");
    expect((await service.openThemeAsset("paths-theme", "mark.svg", "1.1.0"))?.version).toBe("1.1.0");
    expect(await service.openThemeAsset("paths-theme", "missing.svg")).toBeNull();
    expect(await service.openThemeAsset("no-such-theme", "mark.svg")).toBeNull();
  });

  it("answers over HTTP with the file, short caching for the newest version and long caching for a pinned one", async () => {
    await service.upload("store-a", themePackage({ id: "paths-theme" }));
    const latest = await request(app).get("/api/public/themes/paths-theme/assets/mark.svg");
    expect(latest.status).toBe(200);
    expect(latest.headers["content-type"]).toContain("image/svg+xml");
    expect(latest.headers["cache-control"]).toBe("public, max-age=300");
    expect(latest.headers["content-security-policy"]).toContain("sandbox");
    const pinned = await request(app).get("/api/public/themes/paths-theme/assets/mark.svg?version=1.0.0");
    expect(pinned.headers["cache-control"]).toContain("immutable");
    expect((await request(app).get("/api/public/themes/paths-theme/assets/other.svg")).status).toBe(404);
    expect((await request(app).get("/api/public/themes/Bad_Id/assets/mark.svg")).status).toBe(404);
  });
});
