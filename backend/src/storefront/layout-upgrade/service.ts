import { randomUUID } from "node:crypto";
import { pageTypeLabel, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { PageType, SectionNode } from "@jelly/storefront-schema";
import {
  currentLayoutRevision,
  detectLayoutRevision,
  layoutRevisions,
  planLayoutUpgrade,
  starterIdOf,
  type LayoutDraft,
  type LayoutPageChange,
  type LayoutPlacement,
  type LayoutSectionChange,
  type LayoutUpgradePlan,
} from "@jelly/storefront-themes";
import type { CommerceDatabase, SqlExecutor } from "../../commerce/repository.js";
import { ApiError } from "../../http/errors.js";
import { RETIRED_TEMPLATE_HANDLE_PREFIX } from "../workspace/repositories/template-repository.js";
import { hasLayoutRevisionColumn } from "../starter/installation-service.js";

interface DraftRow { id: string; type: string; handle: string; layout: { sections: LayoutPlacement[] } }
interface Snapshot { layoutRevision: number | null; globals: Array<{ id: string; section: SectionNode }>; templates: DraftRow[]; createdGlobals: string[] }

export interface LayoutUpgradeOffer {
  themeId: string;
  /** The layout the draft is on, and whether that was read from the draft (installed before revisions were recorded). */
  draft: { revision: number; label: string; recognised: boolean };
  current: { revision: number; label: string };
  behind: boolean;
  /** The draft generation, needed to upgrade or undo without overwriting newer edits. */
  generation: number;
  /** The layout upgrade that can still be undone, if any. */
  lastUpgrade: { id: string; fromRevision: number; toRevision: number; createdAt: string } | null;
}

/** One page of the preview, in words a merchant can follow. */
export interface LayoutUpgradePageSummary {
  page: string;
  added: string[];
  carried: Array<{ section: string; settings: string[]; blocks: boolean }>;
  kept: string[];
  removed: string[];
  skipped: string[];
}

export interface LayoutUpgradePreview {
  from: { revision: number; label: string };
  to: { revision: number; label: string };
  generation: number;
  shared: Pick<LayoutUpgradePageSummary, "added" | "carried" | "kept">;
  pages: LayoutUpgradePageSummary[];
  /** Things that would be wrong after upgrading; the upgrade is refused while there are any. */
  problems: string[];
}

const pageTypeOf = (databaseType: string) => databaseType.toLowerCase().replaceAll("_", "-") as PageType;
const labels = (changes: LayoutSectionChange[]) => changes.map((change) => change.label);
const carried = (changes: LayoutSectionChange[]) => changes.map((change) => ({ section: change.label, settings: change.keptSettings ?? [], blocks: Boolean(change.keptBlocks) }));

function summarise(page: LayoutPageChange): LayoutUpgradePageSummary {
  return { page: pageTypeLabel(page.pageType), added: labels(page.added), carried: carried(page.carried), kept: labels(page.kept), removed: labels(page.removed), skipped: labels(page.skipped) };
}

/**
 * Layout upgrades for the themes Jelly ships (folder themes with a `layout-history.json`). A theme's
 * starter layout can change while its version stays the same; stores built from an earlier layout can
 * move their draft to the current one. Default templates are rebuilt in the new layout with every
 * merchant change carried over; alternate templates, menus, pages and theme settings stay as they are.
 * Nothing changes for shoppers until the merchant publishes, and the latest upgrade can be undone.
 */
export class LayoutUpgradeService {
  constructor(private readonly database: CommerceDatabase, private readonly id: () => string = randomUUID) {}

  async offer(storeId: string): Promise<LayoutUpgradeOffer | null> {
    return this.database.transaction(async (sql) => {
      const state = await this.state(sql, storeId);
      if (!state) return null;
      const backup = await this.lastBackup(sql, storeId);
      return {
        themeId: state.themeId,
        draft: { revision: state.revision, label: state.label, recognised: state.recognised },
        current: state.current,
        behind: state.revision < state.current.revision,
        generation: state.generation,
        lastUpgrade: backup && backup.toRevision === state.revision ? backup : null,
      };
    });
  }

  async preview(storeId: string): Promise<LayoutUpgradePreview> {
    return this.database.transaction(async (sql) => {
      const { plan, generation, problems } = await this.plan(sql, storeId, false);
      return { from: plan.from, to: plan.to, generation, shared: { added: labels(plan.shared.added), carried: carried(plan.shared.carried), kept: labels(plan.shared.kept) }, pages: plan.pages.map(summarise).filter((page) => page.added.length + page.carried.length + page.kept.length + page.removed.length + page.skipped.length > 0), problems };
    });
  }

  async apply(storeId: string, expectedGeneration: number, userId: string): Promise<{ generation: number; revision: number; backupId: string }> {
    return this.database.transaction(async (sql) => {
      const { plan, generation, problems, before, storedRevision, themeId } = await this.plan(sql, storeId, true);
      if (generation !== expectedGeneration) throw new ApiError(409, "WORKSPACE_GENERATION_CONFLICT", "The draft changed since you looked at this upgrade. Look at the changes again, then upgrade.");
      if (problems.length) throw new ApiError(422, "UPGRADE_PROBLEMS", `This upgrade would leave the draft with problems: ${problems.slice(0, 3).join(" ")}`);
      const backupId = this.id();
      const snapshot: Snapshot = { layoutRevision: storedRevision, globals: before.globals, templates: before.templates, createdGlobals: plan.newGlobals.map((global) => global.id) };
      await sql.query(
        `INSERT INTO "StorefrontLayoutBackup" ("id", "storeId", "themeId", "fromRevision", "toRevision", "snapshot", "createdBy") VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [backupId, storeId, themeId, plan.from.revision, plan.to.revision, JSON.stringify(snapshot), userId],
      );
      for (const global of plan.newGlobals) {
        await sql.query(`INSERT INTO "GlobalSection" ("id", "storeId", "revision", "name", "section", "createdAt", "updatedAt") VALUES ($1, $2, 0, $3, $4::jsonb, NOW(), NOW())`, [global.id, storeId, global.name, JSON.stringify(global.section)]);
      }
      await this.write(sql, storeId, before, { globals: plan.draft.globals, templates: plan.draft.templates.map((template) => ({ id: template.id, type: template.type, handle: template.handle, layout: template.layout })) });
      await sql.query(`UPDATE "StorefrontWorkspace" SET "layoutRevision" = $2 WHERE "storeId" = $1`, [storeId, plan.to.revision]);
      return { generation: await this.bumpGeneration(sql, storeId), revision: plan.to.revision, backupId };
    });
  }

  /** Puts the draft's templates and shared sections back as they were before the latest layout upgrade. */
  async rollback(storeId: string, expectedGeneration: number): Promise<{ generation: number; revision: number }> {
    return this.database.transaction(async (sql) => {
      const generation = await this.lockGeneration(sql, storeId);
      if (generation !== expectedGeneration) throw new ApiError(409, "WORKSPACE_GENERATION_CONFLICT", "The draft changed since you opened this page. Reload, then undo the upgrade.");
      const state = await this.state(sql, storeId);
      const backup = await this.lastBackup(sql, storeId);
      if (!state || !backup || backup.toRevision !== state.revision) throw new ApiError(409, "NOTHING_TO_UNDO", "There is no layout upgrade to undo.");
      const snapshot = (await sql.query<{ snapshot: Snapshot }>(`SELECT "snapshot" FROM "StorefrontLayoutBackup" WHERE "id" = $1`, [backup.id])).rows[0].snapshot;
      const now = await this.readDraft(sql, storeId);
      // Templates or shared sections added after the upgrade are kept; the ones that existed are put back.
      await this.write(sql, storeId, now, snapshot);
      if (snapshot.createdGlobals.length) await sql.query(`DELETE FROM "GlobalSection" WHERE "storeId" = $1 AND "id" = ANY($2::text[])`, [storeId, snapshot.createdGlobals]);
      await sql.query(`UPDATE "StorefrontWorkspace" SET "layoutRevision" = $2 WHERE "storeId" = $1`, [storeId, snapshot.layoutRevision]);
      await sql.query(`UPDATE "StorefrontLayoutBackup" SET "restoredAt" = NOW() WHERE "id" = $1`, [backup.id]);
      return { generation: await this.bumpGeneration(sql, storeId), revision: backup.fromRevision };
    });
  }

  /** The draft's theme and layout revision, or null when the theme has no earlier layouts (nothing to offer). */
  private async state(sql: SqlExecutor, storeId: string) {
    if (!(await hasLayoutRevisionColumn(sql))) return null;
    const theme = (await sql.query<{ themeId: string; draftArtifactId: string | null }>(`SELECT "themeId", "draftArtifactId" FROM "ThemeConfiguration" WHERE "storeId" = $1`, [storeId])).rows[0];
    // Uploaded themes move between versions with the theme upgrade instead.
    if (!theme || theme.draftArtifactId) return null;
    const revisions = layoutRevisions(theme.themeId);
    if (revisions.length < 2) return null;
    const workspace = (await sql.query<{ generation: number; layoutRevision: number | null }>(`SELECT "generation", "layoutRevision" FROM "StorefrontWorkspace" WHERE "storeId" = $1`, [storeId])).rows[0];
    if (!workspace) return null;
    const stored = workspace.layoutRevision === null ? null : Number(workspace.layoutRevision);
    const revision = stored ?? detectLayoutRevision(theme.themeId, toLayoutDraft(await this.readDraft(sql, storeId)));
    const current = revisions[revisions.length - 1];
    return { themeId: theme.themeId, generation: Number(workspace.generation), stored, revision, recognised: stored === null, label: revisions.find((entry) => entry.revision === revision)?.label ?? `Layout ${revision}`, current };
  }

  private async plan(sql: SqlExecutor, storeId: string, lock: boolean) {
    const generation = lock ? await this.lockGeneration(sql, storeId) : undefined;
    const state = await this.state(sql, storeId);
    if (!state) throw new ApiError(409, "NO_LAYOUT_UPGRADE", "This store's design has no newer page layout.");
    if (state.revision >= currentLayoutRevision(state.themeId)) throw new ApiError(409, "LAYOUT_CURRENT", "This store already uses the current page layout.");
    const before = await this.readDraft(sql, storeId);
    const draft = toLayoutDraft(before);
    let plan: LayoutUpgradePlan;
    try {
      plan = planLayoutUpgrade(state.themeId, draft, state.revision, installationPrefix(draft) ?? this.id());
    } catch (error) {
      throw new ApiError(422, "NO_UPGRADE_PATH", error instanceof Error ? error.message : "This layout cannot be upgraded.");
    }
    const problems = [
      ...plan.draft.templates.flatMap((template) => template.layout.sections.flatMap((placement) => placement.kind === "inline"
        ? validateSectionAgainstRegistry(placement.section, template.type, state.themeId).map((issue) => `${pageTypeLabel(template.type)}, ${placement.section.type}: ${issue.message}.`)
        : [])),
      ...[...plan.draft.globals, ...plan.newGlobals].flatMap((global) => validateSectionAgainstRegistry(global.section, "home", state.themeId)
        .filter((issue) => issue.code !== "SECTION_NOT_ALLOWED_ON_PAGE")
        .map((issue) => `Shared ${global.section.type}: ${issue.message}.`)),
    ];
    return { plan, before, problems, generation: generation ?? state.generation, storedRevision: state.stored, themeId: state.themeId };
  }

  private async readDraft(sql: SqlExecutor, storeId: string): Promise<Omit<Snapshot, "layoutRevision" | "createdGlobals">> {
    const globals = (await sql.query<{ id: string; section: SectionNode }>(`SELECT "id", "section" FROM "GlobalSection" WHERE "storeId" = $1 ORDER BY "id"`, [storeId])).rows;
    const templates = (await sql.query<DraftRow>(
      `SELECT "id", "type"::text AS "type", "handle", "layout" FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "handle" NOT LIKE $2 ORDER BY "id"`,
      [storeId, `${RETIRED_TEMPLATE_HANDLE_PREFIX}%`],
    )).rows;
    return { globals, templates };
  }

  private async lastBackup(sql: SqlExecutor, storeId: string) {
    const row = (await sql.query<{ id: string; fromRevision: number; toRevision: number; createdAt: string }>(
      `SELECT "id", "fromRevision", "toRevision", "createdAt"::text FROM "StorefrontLayoutBackup" WHERE "storeId" = $1 AND "restoredAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`,
      [storeId],
    )).rows[0];
    return row ? { ...row, fromRevision: Number(row.fromRevision), toRevision: Number(row.toRevision) } : null;
  }

  private async lockGeneration(sql: SqlExecutor, storeId: string): Promise<number> {
    const row = (await sql.query<{ generation: number }>(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = $1 FOR UPDATE`, [storeId])).rows[0];
    if (!row) throw new ApiError(404, "STOREFRONT_NOT_FOUND", "This store has no draft to upgrade.");
    return Number(row.generation);
  }

  private async bumpGeneration(sql: SqlExecutor, storeId: string): Promise<number> {
    return Number((await sql.query<{ generation: number }>(`UPDATE "StorefrontWorkspace" SET "generation" = "generation" + 1, "updatedAt" = NOW() WHERE "storeId" = $1 RETURNING "generation"`, [storeId])).rows[0].generation);
  }

  /** Writes `to` over the draft where it differs from `from`, bumping each changed row's revision. */
  private async write(sql: SqlExecutor, storeId: string, from: Pick<Snapshot, "globals" | "templates">, to: Pick<Snapshot, "globals" | "templates">): Promise<void> {
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

function toLayoutDraft(draft: Pick<Snapshot, "globals" | "templates">): LayoutDraft {
  return {
    globals: structuredClone(draft.globals),
    templates: draft.templates.map((template) => ({ id: template.id, type: pageTypeOf(template.type), handle: template.handle, layout: structuredClone(template.layout) })),
  };
}

/** The installation id the store's starter sections carry (`<installation>:<starter id>`), so new sections match them. */
function installationPrefix(draft: LayoutDraft): string | undefined {
  for (const template of draft.templates) {
    for (const placement of template.layout.sections) {
      if (placement.kind !== "inline") continue;
      const id = placement.section.id;
      if (id.includes(":") && starterIdOf(id) !== id) return id.slice(0, id.indexOf(":"));
    }
  }
  return undefined;
}
