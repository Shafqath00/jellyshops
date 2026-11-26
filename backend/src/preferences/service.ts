import { randomUUID } from "node:crypto";
import {
  changedPreferenceSections, readStorePreferences, validateStorePreferences,
  type PreferenceImage, type StorePreferences,
} from "@jelly/storefront-schema";
import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";

/** What a photo looks like to the preferences service: just enough to check it is this store's image. */
export interface PreferenceMediaRecord { id: string; url: string; mimeType: string; width: number | null; height: number | null }
export type PreferenceMediaLookup = (storeId: string, mediaId: string) => Promise<PreferenceMediaRecord | null>;

export interface PreferencesActor { userId: string; name: string | null }

export interface StoredPreferences {
  /** False until the migration has run; the admin then explains preferences aren't ready yet. */
  available: boolean;
  preferences: StorePreferences;
  revision: number;
  updatedAt: string | null;
}

export interface PreferenceChange {
  id: string;
  at: string;
  actorName: string | null;
  sections: string[];
}

const HISTORY_LIMIT = 50;
const FAVICON_TYPES = ["image/png", "image/webp", "image/gif"];
const FAVICON_MIN = 32;
const SOCIAL_MIN = 200;

async function tableReady(sql: SqlExecutor, table: string): Promise<boolean> {
  const result = await sql.query<{ table: string | null }>(`SELECT to_regclass($1)::text AS "table"`, [`public."${table}"`]);
  return Boolean(result.rows[0]?.table);
}

/**
 * Store preferences: read, save (strictly checked, revision-guarded, photos confirmed to be this store's), and the
 * change history. Permissions are checked by the routes (settings:manage = owner or admin).
 */
export class StorePreferencesService {
  constructor(private readonly db: CommerceDatabase, private readonly media: PreferenceMediaLookup) {}

  async get(storeId: string): Promise<StoredPreferences> {
    return this.db.transaction((sql) => this.read(sql, storeId));
  }

  /** The preferences storefront pages use. Never fails: a missing table or row gives the defaults. */
  async getPublic(storeId: string): Promise<StorePreferences> {
    try {
      return (await this.get(storeId)).preferences;
    } catch {
      return readStorePreferences(null);
    }
  }

  private async read(sql: SqlExecutor, storeId: string, lock = false): Promise<StoredPreferences> {
    if (!await tableReady(sql, "StorePreferences")) return { available: false, preferences: readStorePreferences(null), revision: 0, updatedAt: null };
    const result = await sql.query<{ document: unknown; revision: number; updatedAt: Date | string }>(
      `SELECT "document", "revision", "updatedAt" FROM "StorePreferences" WHERE "storeId" = $1${lock ? " FOR UPDATE" : ""}`, [storeId],
    );
    const row = result.rows[0];
    return {
      available: true,
      preferences: readStorePreferences(row?.document),
      revision: row ? Number(row.revision) : 0,
      updatedAt: row ? new Date(row.updatedAt).toISOString() : null,
    };
  }

  async save(storeId: string, input: { revision: unknown; preferences: unknown }, actor: PreferencesActor): Promise<StoredPreferences> {
    if (typeof input.revision !== "number" || !Number.isInteger(input.revision) || input.revision < 0) {
      throw new ApiError(422, "PREFERENCES_INVALID", "Reload the page and try again.");
    }
    const checked = validateStorePreferences(input.preferences);
    if (!checked.ok) throw new ApiError(422, "PREFERENCES_INVALID", "Some preferences need fixing before they can be saved.", checked.problems);
    const preferences = checked.value;
    preferences.seo.socialImage = await this.checkImage(storeId, preferences.seo.socialImage, "seo.socialImage");
    preferences.seo.favicon = await this.checkImage(storeId, preferences.seo.favicon, "seo.favicon");

    return this.db.transaction(async (sql) => {
      // Lock the store row first so two first-time saves can't both insert.
      const store = await sql.query(`SELECT "id" FROM "Store" WHERE "id" = $1 AND "archivedAt" IS NULL FOR UPDATE`, [storeId]);
      if (!store.rows[0]) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
      const current = await this.read(sql, storeId, true);
      if (!current.available) throw new ApiError(503, "PREFERENCES_UNAVAILABLE", "Store preferences aren't ready yet. Please try again later.");
      if (current.revision !== input.revision) {
        throw Object.assign(new ApiError(409, "PREFERENCES_REVISION_CONFLICT", "These preferences were changed in another window. Reload to see the latest before saving."), { currentRevision: current.revision });
      }
      const sections = changedPreferenceSections(current.preferences, preferences);
      if (!sections.length) return current;
      await sql.query(`
        INSERT INTO "StorePreferences" ("storeId", "document", "revision", "updatedAt", "updatedBy", "history")
        VALUES ($1, $2::jsonb, $3, NOW(), $4, jsonb_build_array($5::jsonb))
        ON CONFLICT ("storeId") DO UPDATE SET "document" = EXCLUDED."document", "revision" = EXCLUDED."revision",
          "updatedAt" = EXCLUDED."updatedAt", "updatedBy" = EXCLUDED."updatedBy",
          -- Newest first, the last ${HISTORY_LIMIT} changes only.
          "history" = (SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array($5::jsonb) || "StorePreferences"."history") WITH ORDINALITY AS h(item, ord) WHERE ord <= ${HISTORY_LIMIT})
      `, [storeId, JSON.stringify(preferences), current.revision + 1, actor.userId, JSON.stringify({ id: randomUUID(), at: new Date().toISOString(), actorUserId: actor.userId, actorName: actor.name, sections })]);
      return this.read(sql, storeId);
    });
  }

  /** A chosen photo must exist in this store's files and suit its use; its address and size come from the file. */
  private async checkImage(storeId: string, image: PreferenceImage | null, path: "seo.socialImage" | "seo.favicon"): Promise<PreferenceImage | null> {
    if (!image) return null;
    const record = await this.media(storeId, image.mediaId);
    const fail = (message: string): never => { throw new ApiError(422, "PREFERENCES_INVALID", "Some preferences need fixing before they can be saved.", [{ path, message }]); };
    if (!record) return fail("That photo is no longer in your files. Choose another.");
    const width = record.width ?? null;
    const height = record.height ?? null;
    if (path === "seo.favicon") {
      if (!FAVICON_TYPES.includes(record.mimeType)) fail("Use a PNG, WebP or GIF for the browser tab icon.");
      if (width !== null && height !== null) {
        if (width < FAVICON_MIN || height < FAVICON_MIN) fail(`The icon must be at least ${FAVICON_MIN} × ${FAVICON_MIN} pixels.`);
        if (Math.abs(width - height) > Math.max(width, height) * 0.1) fail("The icon should be square.");
      }
    } else if (width !== null && height !== null && (width < SOCIAL_MIN || height < SOCIAL_MIN)) {
      fail(`The sharing image must be at least ${SOCIAL_MIN} × ${SOCIAL_MIN} pixels. 1200 × 630 works best.`);
    }
    return { mediaId: record.id, url: record.url, width, height, alt: image.alt };
  }

  /** The latest preference changes, newest first (up to 50). */
  async history(storeId: string): Promise<PreferenceChange[]> {
    return this.db.transaction(async (sql) => {
      if (!await tableReady(sql, "StorePreferences")) return [];
      const result = await sql.query<{ history: unknown }>(`SELECT "history" FROM "StorePreferences" WHERE "storeId" = $1`, [storeId]);
      const items = Array.isArray(result.rows[0]?.history) ? result.rows[0]!.history as unknown[] : [];
      return items.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const entry = item as { id?: unknown; at?: unknown; actorName?: unknown; sections?: unknown };
        return [{
          id: String(entry.id ?? ""),
          at: typeof entry.at === "string" ? entry.at : "",
          actorName: typeof entry.actorName === "string" ? entry.actorName : null,
          sections: Array.isArray(entry.sections) ? entry.sections.map(String) : [],
        }];
      });
    });
  }
}
