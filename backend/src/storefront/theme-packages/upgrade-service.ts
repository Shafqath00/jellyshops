import { randomUUID } from "node:crypto";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { PageType, SectionNode } from "@jelly/storefront-schema";
import { applyThemeUpgrade, compareThemeVersions, registerThemeProject, validateThemeSettings, type ThemeMigrationChange } from "@jelly/storefront-themes";
import type { CommerceDatabase, SqlExecutor } from "../../commerce/repository.js";
import { ApiError } from "../../http/errors.js";

type Placement = { kind: "inline"; section: SectionNode } | { kind: "global"; globalSectionId: string };
interface VersionRow { id: string; packageId: string; themeId: string; name: string; version: string; status: string; manifest: Record<string, unknown>; starter: Record<string, unknown> | null; createdAt: string }
interface DraftState {
  theme: { themeId: string; themeVersion: string; settings: Record<string, unknown>; draftArtifactId: string | null };
  globals: Array<{ id: string; section: SectionNode }>;
  templates: Array<{ id: string; type: string; layout: { sections: Placement[] } }>;
}
interface Snapshot extends DraftState { install: { packageId: string; versionId: string } | null }

export interface UpgradeOffer {
  packageId: string;
  themeId: string;
  name: string;
  current: { versionId: string; version: string };
  newer: Array<{ versionId: string; version: string; createdAt: string }>;
  /** The draft generation, needed to upgrade or undo without overwriting newer edits. */
  generation: number;
  /** The upgrade that can still be undone, if any. */
  lastUpgrade: { id: string; fromVersion: string; toVersion: string; createdAt: string } | null;
}

/** One line of the preview, in words a merchant can follow. */
export interface UpgradeChange { where: string; what: string }

export interface UpgradePreview {
  from: string;
  to: string;
  generation: number;
  changes: UpgradeChange[];
  /** Things that would be wrong after upgrading; the upgrade is refused while there are any. */
  problems: string[];
}

const pageTypeOf = (databaseType: string) => databaseType.toLowerCase().replaceAll("_", "-") as PageType;

function describe(change: ThemeMigrationChange, places: string[]): UpgradeChange {
  const match = change.path.match(/^sections\[(\d+)\](.*)$/);
  const where = match ? places[Number(match[1])] ?? "A section" : "Theme settings";
  const field = (match ? match[2] : change.path.replace(/^settings/, "")).replace(/^\./, "").replace(/^settings\./, "") || "type";
  const show = (value: unknown) => typeof value === "string" ? `“${value}”` : JSON.stringify(value);
  if (change.kind === "added") return { where, what: `${field} set to ${show(change.after)}` };
  if (change.kind === "removed") return { where, what: `${field} removed (was ${show(change.before)})` };
  return { where, what: `${field} changed from ${show(change.before)} to ${show(change.after)}` };
}

/**
 * Merchant upgrades of an uploaded theme. The draft (theme settings, shared sections and every
 * template's sections) moves to a newer version by running the version's declared migrations;
 * nothing changes for shoppers until the merchant publishes. Each upgrade keeps a rollback point,
 * and the latest upgrade can be undone while the draft has not moved on since.
 */
export class ThemeUpgradeService {
  constructor(private readonly database: CommerceDatabase) {}

  async offer(storeId: string): Promise<UpgradeOffer | null> {
    return this.database.transaction(async (sql) => {
      const current = await this.currentVersion(sql, storeId);
      if (!current) return null;
      const newer = (await sql.query<{ id: string; version: string; createdAt: string }>(
        `SELECT "id", "version", "createdAt"::text FROM "ThemePackageVersion" WHERE "packageId" = $1 AND "status" = 'active'`, [current.packageId],
      )).rows.filter((row) => compareThemeVersions(row.version, current.version) > 0).sort((a, b) => compareThemeVersions(a.version, b.version));
      const backup = await this.lastBackup(sql, storeId);
      const generation = Number((await sql.query<{ generation: number }>(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = $1`, [storeId])).rows[0]?.generation ?? 0);
      return {
        generation,
        packageId: current.packageId, themeId: current.themeId, name: current.name,
        current: { versionId: current.id, version: current.version },
        newer: newer.map((row) => ({ versionId: row.id, version: row.version, createdAt: row.createdAt })),
        lastUpgrade: backup && backup.toVersionId === current.id ? { id: backup.id, fromVersion: backup.fromVersion, toVersion: backup.toVersion, createdAt: backup.createdAt } : null,
      };
    });
  }

  async preview(storeId: string, versionId: string): Promise<UpgradePreview> {
    return this.database.transaction(async (sql) => {
      const plan = await this.plan(sql, storeId, versionId, false);
      return { from: plan.current.version, to: plan.target.version, generation: plan.generation, changes: plan.changes, problems: plan.problems };
    });
  }

  async apply(storeId: string, versionId: string, expectedGeneration: number, userId: string): Promise<{ generation: number; version: string; backupId: string }> {
    return this.database.transaction(async (sql) => {
      const plan = await this.plan(sql, storeId, versionId, true);
      if (plan.generation !== expectedGeneration) throw new ApiError(409, "WORKSPACE_GENERATION_CONFLICT", "The draft changed since you looked at this upgrade. Look at the changes again, then upgrade.");
      if (plan.problems.length) throw new ApiError(422, "UPGRADE_PROBLEMS", `This upgrade would leave the draft with problems: ${plan.problems.slice(0, 3).join(" ")}`);
      const backupId = randomUUID();
      const snapshot: Snapshot = { ...plan.before, install: plan.install };
      await sql.query(
        `INSERT INTO "ThemeUpgradeBackup" ("id", "storeId", "packageId", "fromVersionId", "toVersionId", "snapshot", "createdBy") VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [backupId, storeId, plan.current.packageId, plan.current.id, plan.target.id, JSON.stringify(snapshot), userId],
      );
      await this.write(sql, storeId, plan.before, plan.after, { themeVersion: plan.target.version, draftArtifactId: plan.target.id });
      await sql.query(
        `INSERT INTO "ThemeInstall" ("id", "storeId", "packageId", "versionId") VALUES ($1, $2, $3, $4)
         ON CONFLICT ("storeId", "packageId") DO UPDATE SET "versionId" = EXCLUDED."versionId", "installedAt" = NOW()`,
        [randomUUID(), storeId, plan.current.packageId, plan.target.id],
      );
      const generation = await this.bumpGeneration(sql, storeId);
      return { generation, version: plan.target.version, backupId };
    });
  }

  /** Puts the draft back as it was before the latest upgrade. Refused once the draft has moved to another version since. */
  async rollback(storeId: string, expectedGeneration: number): Promise<{ generation: number; version: string }> {
    return this.database.transaction(async (sql) => {
      const generation = await this.lockGeneration(sql, storeId);
      if (generation !== expectedGeneration) throw new ApiError(409, "WORKSPACE_GENERATION_CONFLICT", "The draft changed since you opened this page. Reload, then undo the upgrade.");
      const backup = await this.lastBackup(sql, storeId);
      const current = await this.currentVersion(sql, storeId);
      if (!backup || !current || backup.toVersionId !== current.id) throw new ApiError(409, "NOTHING_TO_UNDO", "There is no upgrade to undo for the theme this draft uses.");
      const snapshot = (await sql.query<{ snapshot: Snapshot }>(`SELECT "snapshot" FROM "ThemeUpgradeBackup" WHERE "id" = $1`, [backup.id])).rows[0].snapshot;
      const now = await this.readDraft(sql, storeId);
      // Templates or shared sections added after the upgrade are kept; the ones that existed are put back.
      await this.write(sql, storeId, now, snapshot, { themeVersion: snapshot.theme.themeVersion, draftArtifactId: snapshot.theme.draftArtifactId });
      if (snapshot.install) await sql.query(`UPDATE "ThemeInstall" SET "versionId" = $3, "installedAt" = NOW() WHERE "storeId" = $1 AND "packageId" = $2`, [storeId, snapshot.install.packageId, snapshot.install.versionId]);
      await sql.query(`UPDATE "ThemeUpgradeBackup" SET "restoredAt" = NOW() WHERE "id" = $1`, [backup.id]);
      return { generation: await this.bumpGeneration(sql, storeId), version: snapshot.theme.themeVersion };
    });
  }

  private async currentVersion(sql: SqlExecutor, storeId: string): Promise<VersionRow | null> {
    return (await sql.query<VersionRow>(
      `SELECT v."id", v."packageId", p."themeId", p."name", v."version", v."status", v."manifest", v."starter", v."createdAt"::text
       FROM "ThemeConfiguration" c JOIN "ThemePackageVersion" v ON v."id" = c."draftArtifactId" JOIN "ThemePackage" p ON p."id" = v."packageId"
       WHERE c."storeId" = $1 AND p."ownerStoreId" = $1 AND p."themeId" = c."themeId"`,
      [storeId],
    )).rows[0] ?? null;
  }

  private async lastBackup(sql: SqlExecutor, storeId: string) {
    return (await sql.query<{ id: string; fromVersionId: string; toVersionId: string; fromVersion: string; toVersion: string; createdAt: string }>(
      `SELECT b."id", b."fromVersionId", b."toVersionId", f."version" AS "fromVersion", t."version" AS "toVersion", b."createdAt"::text
       FROM "ThemeUpgradeBackup" b JOIN "ThemePackageVersion" f ON f."id" = b."fromVersionId" JOIN "ThemePackageVersion" t ON t."id" = b."toVersionId"
       WHERE b."storeId" = $1 AND b."restoredAt" IS NULL ORDER BY b."createdAt" DESC LIMIT 1`,
      [storeId],
    )).rows[0] ?? null;
  }

  private async readDraft(sql: SqlExecutor, storeId: string): Promise<DraftState> {
    const theme = (await sql.query<DraftState["theme"]>(`SELECT "themeId", "themeVersion", "settings", "draftArtifactId" FROM "ThemeConfiguration" WHERE "storeId" = $1`, [storeId])).rows[0];
    const globals = (await sql.query<DraftState["globals"][number]>(`SELECT "id", "section" FROM "GlobalSection" WHERE "storeId" = $1 ORDER BY "id"`, [storeId])).rows;
    const templates = (await sql.query<DraftState["templates"][number]>(`SELECT "id", "type"::text AS "type", "layout" FROM "StorefrontTemplate" WHERE "storeId" = $1 ORDER BY "id"`, [storeId])).rows;
    return { theme, globals, templates };
  }

  private async lockGeneration(sql: SqlExecutor, storeId: string): Promise<number> {
    const row = (await sql.query<{ generation: number }>(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = $1 FOR UPDATE`, [storeId])).rows[0];
    if (!row) throw new ApiError(404, "STOREFRONT_NOT_FOUND", "This store has no draft to upgrade.");
    return Number(row.generation);
  }

  private async bumpGeneration(sql: SqlExecutor, storeId: string): Promise<number> {
    return Number((await sql.query<{ generation: number }>(`UPDATE "StorefrontWorkspace" SET "generation" = "generation" + 1, "updatedAt" = NOW() WHERE "storeId" = $1 RETURNING "generation"`, [storeId])).rows[0].generation);
  }

  /** Reads the draft, runs the target version's migrations on it, and checks the result against that version. */
  private async plan(sql: SqlExecutor, storeId: string, versionId: string, lock: boolean) {
    const generation = lock ? await this.lockGeneration(sql, storeId) : Number((await sql.query<{ generation: number }>(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = $1`, [storeId])).rows[0]?.generation ?? 0);
    const current = await this.currentVersion(sql, storeId);
    if (!current) throw new ApiError(409, "NOT_AN_UPLOADED_THEME", "This draft does not use one of your uploaded themes, so there is nothing to upgrade.");
    const target = (await sql.query<VersionRow>(
      `SELECT v."id", v."packageId", p."themeId", p."name", v."version", v."status", v."manifest", v."starter", v."createdAt"::text
       FROM "ThemePackageVersion" v JOIN "ThemePackage" p ON p."id" = v."packageId" WHERE v."id" = $1 AND p."ownerStoreId" = $2`,
      [versionId, storeId],
    )).rows[0];
    if (!target || target.packageId !== current.packageId) throw new ApiError(404, "NOT_FOUND", "That version of this theme was not found.");
    if (target.status !== "active") throw new ApiError(409, "VERSION_YANKED", "That version was withdrawn by its author. Choose another one.");
    if (compareThemeVersions(target.version, current.version) <= 0) throw new ApiError(409, "NOT_NEWER", `Version ${target.version} is not newer than ${current.version}, which the draft uses now.`);

    registerThemeProject({ manifest: target.manifest as never, ...(target.starter ? { starter: target.starter as never } : {}) });
    const before = await this.readDraft(sql, storeId);
    // Every section of the draft in one list, with where it lives, for the engine and for the preview wording.
    const sections: SectionNode[] = [];
    const places: string[] = [];
    const owners: Array<{ kind: "global"; id: string } | { kind: "template"; id: string; index: number; pageType: PageType }> = [];
    for (const global of before.globals) { sections.push(global.section); places.push(`Shared section “${global.section.type}”`); owners.push({ kind: "global", id: global.id }); }
    for (const template of before.templates) {
      template.layout.sections.forEach((placement, index) => {
        if (placement.kind !== "inline") return;
        sections.push(placement.section);
        places.push(`${pageTypeOf(template.type)} page, section “${placement.section.type}”`);
        owners.push({ kind: "template", id: template.id, index, pageType: pageTypeOf(template.type) });
      });
    }
    let result: ReturnType<typeof applyThemeUpgrade>;
    try {
      result = applyThemeUpgrade({ settings: before.theme.settings, sections }, current.version, target.version, (target.manifest as { migrations?: unknown }).migrations);
    } catch (error) {
      throw new ApiError(422, "NO_UPGRADE_PATH", error instanceof Error ? error.message : "This version cannot be reached from the one the draft uses.");
    }
    const after: DraftState = structuredClone(before);
    after.theme.settings = result.draft.settings;
    result.draft.sections.forEach((section, index) => {
      const owner = owners[index];
      if (owner.kind === "global") after.globals.find((global) => global.id === owner.id)!.section = section;
      else (after.templates.find((template) => template.id === owner.id)!.layout.sections[owner.index] as { section: SectionNode }).section = section;
    });
    const problems = [
      ...validateThemeSettings(current.themeId, after.theme.settings, target.version).map((issue) => `Theme setting ${issue.path}: ${issue.message}.`),
      ...result.draft.sections.flatMap((section, index) => {
        const owner = owners[index];
        return validateSectionAgainstRegistry(section, owner.kind === "template" ? owner.pageType : "home", current.themeId, target.version)
          .filter((issue) => owner.kind === "template" || issue.code !== "SECTION_NOT_ALLOWED_ON_PAGE")
          .map((issue) => `${places[index]}: ${issue.message}.`);
      }),
    ];
    const install = (await sql.query<{ packageId: string; versionId: string }>(`SELECT "packageId", "versionId" FROM "ThemeInstall" WHERE "storeId" = $1 AND "packageId" = $2`, [storeId, current.packageId])).rows[0] ?? null;
    return { generation, current, target, before, after, install, changes: result.changes.map((change) => describe(change, places)), problems };
  }

  /** Writes `to` over the draft where it differs from `from`, bumping each changed row's revision. */
  private async write(sql: SqlExecutor, storeId: string, from: DraftState, to: DraftState, theme: { themeVersion: string; draftArtifactId: string | null }): Promise<void> {
    await sql.query(
      `UPDATE "ThemeConfiguration" SET "settings" = $2::jsonb, "themeVersion" = $3, "draftArtifactId" = $4, "revision" = "revision" + 1, "updatedAt" = NOW() WHERE "storeId" = $1`,
      [storeId, JSON.stringify(to.theme.settings), theme.themeVersion, theme.draftArtifactId],
    );
    for (const global of to.globals) {
      const old = from.globals.find((candidate) => candidate.id === global.id);
      if (!old || JSON.stringify(old.section) === JSON.stringify(global.section)) continue;
      await sql.query(`UPDATE "GlobalSection" SET "section" = $3::jsonb, "revision" = "revision" + 1, "updatedAt" = NOW() WHERE "storeId" = $1 AND "id" = $2`, [storeId, global.id, JSON.stringify(global.section)]);
    }
    for (const template of to.templates) {
      const old = from.templates.find((candidate) => candidate.id === template.id);
      if (!old || JSON.stringify(old.layout) === JSON.stringify(template.layout)) continue;
      await sql.query(`UPDATE "StorefrontTemplate" SET "layout" = $3::jsonb, "revision" = "revision" + 1, "updatedAt" = NOW() WHERE "storeId" = $1 AND "id" = $2`, [storeId, template.id, JSON.stringify(template.layout)]);
    }
  }
}
