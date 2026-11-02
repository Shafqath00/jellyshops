import { randomUUID } from "node:crypto";
import { resolveTheme, validateThemeSettings } from "@jelly/storefront-themes";
import { ApiError } from "../../http/errors.js";

export interface LibrarySql { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> }

export interface ThemeLook {
  id: string;
  name: string;
  themeId: string;
  themeVersion: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const MAX_THEME_LOOKS = 20;
const MAX_SETTINGS_BYTES = 200_000;

const columns = `"id", "name", "themeId", "themeVersion", "settings", "createdAt", "updatedAt"`;

function cleanName(name: unknown): string {
  const value = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!value || value.length > 80) throw new ApiError(400, "INVALID_NAME", "Give the look a name of 1 to 80 characters.");
  return value;
}

/**
 * A store's theme library: saved looks (theme, version and settings under a name).
 * Looks are separate from the store's draft and published theme; switching to one
 * is an ordinary theme save done by the editor.
 */
export class ThemeLibraryService {
  constructor(private readonly sql: LibrarySql) {}

  async list(storeId: string): Promise<ThemeLook[]> {
    return (await this.sql.query<ThemeLook>(`SELECT ${columns} FROM "ThemeLibraryEntry" WHERE "storeId" = $1 ORDER BY "createdAt", "id"`, [storeId])).rows;
  }

  async save(storeId: string, input: { name: unknown; themeId: string; themeVersion?: string; settings: Record<string, unknown> }): Promise<ThemeLook> {
    const name = cleanName(input.name);
    // Settings are checked against the theme's own schema; the version recorded is the one the theme has now unless the editor sends the one in use.
    const theme = resolveTheme(input.themeId, input.settings, input.themeVersion);
    if (theme.id !== input.themeId) throw new ApiError(400, "UNKNOWN_THEME", "That theme isn't available.");
    const issues = validateThemeSettings(input.themeId, input.settings);
    if (issues.length) throw new ApiError(400, "INVALID_THEME_SETTINGS", issues[0].message);
    if (JSON.stringify(input.settings).length > MAX_SETTINGS_BYTES) throw new ApiError(400, "SETTINGS_TOO_LARGE", "These theme settings are too large to save.");
    const existing = Number((await this.sql.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "ThemeLibraryEntry" WHERE "storeId" = $1`, [storeId])).rows[0]?.count ?? 0);
    if (existing >= MAX_THEME_LOOKS) throw new ApiError(409, "LIBRARY_FULL", `You can keep up to ${MAX_THEME_LOOKS} saved looks. Delete one first.`);
    const rows = (await this.sql.query<ThemeLook>(
      `INSERT INTO "ThemeLibraryEntry" ("id", "storeId", "name", "themeId", "themeVersion", "settings") VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING ${columns}`,
      [randomUUID(), storeId, name, theme.id, theme.version, JSON.stringify(input.settings)],
    )).rows;
    return rows[0];
  }

  async rename(storeId: string, id: string, name: unknown): Promise<ThemeLook> {
    const row = (await this.sql.query<ThemeLook>(`UPDATE "ThemeLibraryEntry" SET "name" = $3, "updatedAt" = NOW() WHERE "storeId" = $1 AND "id" = $2 RETURNING ${columns}`, [storeId, id, cleanName(name)])).rows[0];
    if (!row) throw new ApiError(404, "NOT_FOUND", "That saved look was not found.");
    return row;
  }

  async remove(storeId: string, id: string): Promise<void> {
    const rows = (await this.sql.query(`DELETE FROM "ThemeLibraryEntry" WHERE "storeId" = $1 AND "id" = $2 RETURNING "id"`, [storeId, id])).rows;
    if (!rows.length) throw new ApiError(404, "NOT_FOUND", "That saved look was not found.");
  }
}
