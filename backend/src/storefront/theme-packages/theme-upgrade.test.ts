import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../../test/integration/pglite.js";
import type { CommerceDatabase } from "../../commerce/repository.js";
import type { MediaStorage } from "../../media/storage.js";
import { StorefrontStarterInstallationService } from "../starter/installation-service.js";
import { ThemePackageService } from "./service.js";
import { ThemeUpgradeService } from "./upgrade-service.js";

const exampleDirectory = [resolve(process.cwd(), "../docs/examples/jelly-studio"), resolve(process.cwd(), "docs/examples/jelly-studio")].find((path) => existsSync(path)) ?? "";
const read = (name: string, id: string) => readFileSync(resolve(exampleDirectory, name), "utf8").replaceAll("jelly-studio", id);

/** The guide's example theme under another id, at a version, with optional migrations. */
function themePackage(id: string, version: string, migrations?: unknown[]) {
  const manifest = JSON.parse(read("theme.json", id));
  manifest.version = version;
  if (migrations) manifest.migrations = migrations;
  const asset = (name: string) => ({ path: name, contentType: "image/svg+xml", base64: Buffer.from(read(`assets/${name}`, id)).toString("base64") });
  return { format: 1, manifest, starter: JSON.parse(read("starter.json", id)), css: "", assets: [asset("preview.svg"), asset("mark.svg")] };
}

class MemoryStorage implements MediaStorage {
  private files = new Map<string, Buffer>();
  async put({ storeId, mediaId, extension, contents }: { storeId: string; mediaId: string; extension: string; contents: Buffer }) { const key = `${storeId}/${mediaId}.${extension}`; this.files.set(key, contents); return key; }
  async open(key: string) { return this.files.get(key) ?? null; }
  async remove(key: string) { this.files.delete(key); }
}

const toTwo = (operations: unknown[]) => [{ from: "1.0.0", to: "2.0.0", operations }];

describe("merchant theme upgrades", () => {
  let database: IntegrationDatabase;
  let packages: ThemePackageService;
  let upgrades: ThemeUpgradeService;
  const generation = async () => Number((await database.query<{ generation: number }>(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).rows[0].generation);
  const config = async () => (await database.query<{ themeVersion: string; draftArtifactId: string; settings: Record<string, any> }>(`SELECT "themeVersion", "draftArtifactId", "settings" FROM "ThemeConfiguration" WHERE "storeId" = 'store-a'`)).rows[0];
  const hero = async () => {
    const home = (await database.query<{ layout: { sections: Array<{ kind: string; section?: { type: string; settings: Record<string, unknown> } }> } }>(`SELECT "layout" FROM "StorefrontTemplate" WHERE "storeId" = 'store-a' AND "type" = 'HOME'`)).rows[0];
    return home.layout.sections.find((placement) => placement.section?.type === "hero")!.section!;
  };

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "aaa");
    await seedStore(database, "store-b", "bbb");
    const commerce = { transaction: (work: never) => database.transaction(work) } as unknown as CommerceDatabase;
    packages = new ThemePackageService(database as never, new MemoryStorage(), new StorefrontStarterInstallationService(commerce));
    upgrades = new ThemeUpgradeService(commerce);
  });
  afterEach(async () => database.close());

  async function installed(id: string) {
    const v1 = await packages.upload("store-a", themePackage(id, "1.0.0"));
    await packages.install("store-a", v1.version.id);
    return v1.version.id;
  }

  it("offers nothing for a draft on a built-in theme, and newer versions for an uploaded one", async () => {
    expect(await upgrades.offer("store-a")).toBeNull();
    const v1 = await installed("offer-theme");
    expect(await upgrades.offer("store-a")).toMatchObject({ themeId: "offer-theme", current: { versionId: v1, version: "1.0.0" }, newer: [], lastUpgrade: null });
    const v11 = await packages.upload("store-a", themePackage("offer-theme", "1.1.0"));
    const v12 = await packages.upload("store-a", themePackage("offer-theme", "1.2.0"));
    await packages.yank("store-a", v12.version.id);
    expect((await upgrades.offer("store-a"))!.newer.map((entry) => entry.versionId)).toEqual([v11.version.id]);
  });

  it("moves the draft to a minor version with nothing to migrate, and undoes it", async () => {
    const v1 = await installed("minor-theme");
    const v11 = (await packages.upload("store-a", themePackage("minor-theme", "1.1.0"))).version.id;
    const before = await generation();
    const preview = await upgrades.preview("store-a", v11);
    expect(preview).toMatchObject({ from: "1.0.0", to: "1.1.0", generation: before, changes: [], problems: [] });

    const applied = await upgrades.apply("store-a", v11, before, "owner");
    expect(applied).toMatchObject({ version: "1.1.0", generation: before + 1 });
    expect(await config()).toMatchObject({ themeVersion: "1.1.0", draftArtifactId: v11 });
    expect((await database.query(`SELECT "versionId" FROM "ThemeInstall" WHERE "storeId" = 'store-a'`)).rows).toEqual([{ versionId: v11 }]);
    expect((await upgrades.offer("store-a"))!.lastUpgrade).toMatchObject({ fromVersion: "1.0.0", toVersion: "1.1.0" });

    const undone = await upgrades.rollback("store-a", applied.generation);
    expect(undone).toMatchObject({ version: "1.0.0", generation: applied.generation + 1 });
    expect(await config()).toMatchObject({ themeVersion: "1.0.0", draftArtifactId: v1 });
    expect((await database.query(`SELECT "versionId" FROM "ThemeInstall" WHERE "storeId" = 'store-a'`)).rows).toEqual([{ versionId: v1 }]);
    expect((await upgrades.offer("store-a"))!.lastUpgrade).toBeNull();
    await expect(upgrades.rollback("store-a", undone.generation)).rejects.toMatchObject({ code: "NOTHING_TO_UNDO" });
  });

  it("runs the major version's migrations on theme settings and on every matching section, and undo puts them back", async () => {
    await installed("major-theme");
    const heroBefore = await hero();
    expect(heroBefore.settings.contentAlignment).toBeDefined();
    const v2 = (await packages.upload("store-a", themePackage("major-theme", "2.0.0", toTwo([
      { op: "setDefault", target: { scope: "theme" }, key: "layout.cardStyle", value: "soft" },
      { op: "renameSetting", target: { scope: "section", type: "hero" }, from: "contentAlignment", to: "legacyAlignment" },
    ])))).version.id;

    const preview = await upgrades.preview("store-a", v2);
    expect(preview.problems).toEqual([]);
    expect(preview.changes).toEqual(expect.arrayContaining([
      { where: "Theme settings", what: "layout.cardStyle set to “soft”" },
      expect.objectContaining({ where: expect.stringContaining("home page, section “hero”"), what: expect.stringContaining("contentAlignment removed") }),
      expect.objectContaining({ where: expect.stringContaining("home page, section “hero”"), what: expect.stringContaining("legacyAlignment set to") }),
    ]));

    const applied = await upgrades.apply("store-a", v2, preview.generation, "owner");
    expect((await config()).settings.layout.cardStyle).toBe("soft");
    const heroAfter = await hero();
    expect(heroAfter.settings.contentAlignment).toBeUndefined();
    expect(heroAfter.settings.legacyAlignment).toBe(heroBefore.settings.contentAlignment);

    await upgrades.rollback("store-a", applied.generation);
    expect((await config()).settings.layout?.cardStyle).toBeUndefined();
    expect((await hero()).settings).toEqual(heroBefore.settings);
  });

  it("refuses an upgrade that would leave the draft broken, and changes nothing", async () => {
    await installed("broken-theme");
    const v2 = (await packages.upload("store-a", themePackage("broken-theme", "2.0.0", toTwo([
      { op: "removeSetting", target: { scope: "section", type: "hero" }, key: "contentAlignment" },
      { op: "setDefault", target: { scope: "section", type: "hero" }, key: "contentAlignment", value: "sideways" },
    ])))).version.id;
    const preview = await upgrades.preview("store-a", v2);
    expect(preview.problems.join(" ")).toMatch(/hero/);
    const before = await config();
    await expect(upgrades.apply("store-a", v2, preview.generation, "owner")).rejects.toMatchObject({ status: 422, code: "UPGRADE_PROBLEMS" });
    expect(await config()).toEqual(before);
    expect((await database.query(`SELECT COUNT(*)::int AS n FROM "ThemeUpgradeBackup"`)).rows[0]).toEqual({ n: 0 });
  });

  it("refuses stale drafts, withdrawn or older versions, and other stores' themes", async () => {
    const v1 = await installed("guard-theme");
    const v11 = (await packages.upload("store-a", themePackage("guard-theme", "1.1.0"))).version.id;
    const current = await generation();
    await expect(upgrades.apply("store-a", v11, current - 1, "owner")).rejects.toMatchObject({ status: 409, code: "WORKSPACE_GENERATION_CONFLICT" });
    await expect(upgrades.preview("store-a", v1)).rejects.toMatchObject({ code: "NOT_NEWER" });
    await packages.yank("store-a", v11);
    await expect(upgrades.preview("store-a", v11)).rejects.toMatchObject({ code: "VERSION_YANKED" });
    const other = await packages.upload("store-b", themePackage("other-theme", "1.0.0"));
    await expect(upgrades.preview("store-a", other.version.id)).rejects.toMatchObject({ status: 404 });
    await expect(upgrades.preview("store-b", v11)).rejects.toMatchObject({ code: "NOT_AN_UPLOADED_THEME" });
  });

  it("will not undo once the draft has moved on to another version", async () => {
    await installed("moved-theme");
    const v11 = (await packages.upload("store-a", themePackage("moved-theme", "1.1.0"))).version.id;
    const v12 = (await packages.upload("store-a", themePackage("moved-theme", "1.2.0"))).version.id;
    const first = await upgrades.apply("store-a", v11, await generation(), "owner");
    const second = await upgrades.apply("store-a", v12, first.generation, "owner");
    // The latest upgrade (1.1.0 to 1.2.0) can be undone; after that the draft is on 1.1.0 and the earlier one too.
    expect((await upgrades.rollback("store-a", second.generation)).version).toBe("1.1.0");
    expect((await upgrades.rollback("store-a", second.generation + 1)).version).toBe("1.0.0");
  });
});
