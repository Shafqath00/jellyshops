import { getSectionDefinition, sectionLabel } from "@jelly/storefront-registry";
import { deriveSectionGroups, MAX_GROUP_SECTIONS, readSectionGroups, SECTION_GROUP_KEYS, type SectionGroupKey, type StorefrontSectionGroups } from "@jelly/storefront-schema";
import type { CommerceDatabase, SqlExecutor } from "../../commerce/repository.js";
import { ApiError } from "../../http/errors.js";

export interface SectionGroupsState {
  /** False until the section groups migration is applied: the editor then keeps the older header and footer. */
  available: boolean;
  /** True when the store has saved groups; false means they were worked out from the templates. */
  saved: boolean;
  groups: StorefrontSectionGroups;
  generation: number;
}

const GROUP_NAMES: Record<SectionGroupKey, string> = { header: "header", footer: "footer", overlay: "overlays" };

/**
 * Whether the database has the section groups column (migration 20261117000000). Until it is applied, stores keep
 * the older header and footer and groups cannot be saved.
 */
export async function hasSectionGroupsColumn(sql: SqlExecutor): Promise<boolean> {
  const result = await sql.query<{ present: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'StorefrontWorkspace' AND column_name = 'sectionGroups') AS "present"`,
  );
  return result.rows[0]?.present === true;
}

/**
 * Section groups (theme plan T6): the store's shared header, footer and overlay sections as ordered lists, kept on
 * the draft workspace. Saving them changes the draft only; the live store follows when the merchant publishes.
 */
export class SectionGroupService {
  constructor(private readonly database: CommerceDatabase) {}

  read(storeId: string): Promise<SectionGroupsState> {
    return this.database.transaction(async (sql) => {
      const available = await hasSectionGroupsColumn(sql);
      const workspace = (await sql.query<{ generation: number; sectionGroups?: unknown }>(`SELECT * FROM "StorefrontWorkspace" WHERE "storeId" = $1`, [storeId])).rows[0];
      const saved = available ? readSectionGroups(workspace?.sectionGroups) : undefined;
      return { available, saved: Boolean(saved), groups: saved ?? await this.derived(sql, storeId), generation: Number(workspace?.generation ?? 0) };
    });
  }

  /** Saves the groups after checking every section exists, sits in one group only and is allowed there. */
  save(storeId: string, input: unknown, expectedGeneration?: number): Promise<SectionGroupsState> {
    return this.database.transaction(async (sql) => {
      if (!(await hasSectionGroupsColumn(sql))) throw new ApiError(409, "SECTION_GROUPS_UNAVAILABLE", "Shared header and footer sections are not switched on for this store yet.");
      const row = (await sql.query<{ generation: number }>(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = $1 FOR UPDATE`, [storeId])).rows[0];
      if (!row) throw new ApiError(404, "STOREFRONT_NOT_FOUND", "This store has no draft design yet.");
      if (expectedGeneration !== undefined && Number(row.generation) !== expectedGeneration) {
        throw new ApiError(409, "STOREFRONT_GENERATION_CONFLICT", "The design was changed somewhere else. Reload the editor and try again.");
      }
      const groups = readSectionGroups(input);
      if (!groups) throw new ApiError(400, "SECTION_GROUPS_INVALID", `Each group must be a list of up to ${MAX_GROUP_SECTIONS} shared sections.`);
      const types = await this.sectionTypes(sql, storeId);
      const seen = new Set<string>();
      for (const group of SECTION_GROUP_KEYS) {
        for (const id of groups[group]) {
          const type = types.get(id);
          if (!type) throw new ApiError(404, "SECTION_GROUP_SECTION_MISSING", "A section in this group no longer exists. Reload the editor and try again.");
          if (seen.has(id)) throw new ApiError(400, "SECTION_GROUPS_INVALID", "A shared section can sit in one group only.");
          seen.add(id);
          if (!(getSectionDefinition(type)?.groups ?? []).includes(group)) {
            throw new ApiError(400, "SECTION_NOT_ALLOWED_IN_GROUP", `"${sectionLabel(type)}" can't go in the ${GROUP_NAMES[group]}.`);
          }
        }
        // One header, one footer, and no more copies than a section's own limit (one slide-out bag).
        for (const type of new Set(groups[group].map((id) => types.get(id)!))) {
          const most = type === "header" || type === "footer" ? 1 : getSectionDefinition(type)?.limit;
          if (most !== undefined && groups[group].filter((id) => types.get(id) === type).length > most) {
            throw new ApiError(400, "SECTION_GROUPS_INVALID", `The ${GROUP_NAMES[group]} can hold only ${most === 1 ? "one" : most} "${sectionLabel(type)}" section${most === 1 ? "" : "s"}.`);
          }
        }
      }
      await sql.query(`UPDATE "StorefrontWorkspace" SET "sectionGroups" = $2::jsonb WHERE "storeId" = $1`, [storeId, JSON.stringify(groups)]);
      const generation = Number((await sql.query<{ generation: number }>(`UPDATE "StorefrontWorkspace" SET "generation" = "generation" + 1, "updatedAt" = NOW() WHERE "storeId" = $1 RETURNING "generation"`, [storeId])).rows[0].generation);
      return { available: true, saved: true, groups, generation };
    });
  }

  private async sectionTypes(sql: SqlExecutor, storeId: string): Promise<Map<string, string>> {
    const rows = (await sql.query<{ id: string; type: string | null }>(`SELECT "id", "section"->>'type' AS "type" FROM "GlobalSection" WHERE "storeId" = $1`, [storeId])).rows;
    return new Map(rows.filter((entry) => entry.type).map((entry) => [entry.id, entry.type!]));
  }

  /** The groups the templates imply, for a store that has not saved any. */
  private async derived(sql: SqlExecutor, storeId: string): Promise<StorefrontSectionGroups> {
    const types = await this.sectionTypes(sql, storeId);
    const templates = (await sql.query<{ type: string; handle: string; layout: { sections?: unknown } }>(`SELECT "type", "handle", "layout" FROM "StorefrontTemplate" WHERE "storeId" = $1 ORDER BY "id"`, [storeId])).rows;
    return deriveSectionGroups(templates.map((template) => ({ ...template, type: template.type.toLowerCase().replaceAll("_", "-") })), (id) => types.get(id));
  }
}
