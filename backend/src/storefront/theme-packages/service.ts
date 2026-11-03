import { randomUUID } from "node:crypto";
import { JELLY_THEME_API_VERSION, registerThemeProject, supportsJellyVersion, validateThemeManifest } from "@jelly/storefront-themes";
import { ApiError } from "../../http/errors.js";
import type { MediaStorage } from "../../media/storage.js";
import { compareVersions, parseThemePackage, type ParsedThemePackage } from "./package-format.js";
import { assertThemeVersionTransition } from "./version-policy.js";

export interface PackageSql {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  transaction?<T>(work: (sql: PackageSql) => Promise<T>): Promise<T>;
}
type UploadResult = { package: { id: string; themeId: string; name: string }; version: { id: string; version: string; status: string }; created: boolean };

export interface StoredAsset { path: string; contentType: string; size: number; sha256: string; storageKey: string }

export interface ThemePackageSummary {
  id: string;
  themeId: string;
  name: string;
  visibility: "private" | "listed";
  versions: Array<{ id: string; version: string; status: "active" | "yanked"; createdAt: string }>;
}

/** What a storefront needs to draw an uploaded theme. */
export interface PublicThemeVersion {
  id: string;
  themeId: string;
  version: string;
  status: "active" | "yanked";
  manifest: Record<string, unknown>;
  starter: Record<string, unknown> | null;
  css: string;
  assets: Array<{ path: string; contentType: string; size: number }>;
}

/** What the install route needs from the starter installer: put the theme's starter into the draft and point the draft at the uploaded version. */
export interface StarterInstaller {
  install(storeId: string, starterPackId: string, options?: { replaceDraft: boolean; expectedGeneration: number }, artifactId?: string | null, themeVersion?: string): Promise<{ generation: number; installed: boolean }>;
}

interface VersionRow { id: string; packageId: string; version: string; status: "active" | "yanked"; contentHash: string; createdAt: string }

/**
 * Uploaded theme packages: validated, immutable versions owned by a store. Versions only move
 * forward (a new upload must have a higher version number), an identical re-upload is recognised,
 * and a yanked version stays readable so stores that already pinned it keep working.
 */
export class ThemePackageService {
  constructor(private readonly sql: PackageSql, private readonly storage: MediaStorage, private readonly starters?: StarterInstaller) {}

  private readonly storeThemeCache = new Map<string, number>();

  async upload(storeId: string, raw: unknown): Promise<UploadResult> {
    const parsed = parseThemePackage(raw);
    if (!this.sql.transaction) throw new ApiError(503, "UPLOAD_UNAVAILABLE", "Theme uploads need a transactional database.");
    return this.sql.transaction(async (sql) => {
      // Lock even for a new theme id, before reading its owner or latest version. The transaction
      // holds this lock through storage and INSERT, so another process must validate against us.
      await sql.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`jelly-theme:${parsed.themeId}`]);
      return new ThemePackageService(sql, this.storage, this.starters).uploadParsed(storeId, parsed);
    });
  }

  private async uploadParsed(storeId: string, parsed: ParsedThemePackage): Promise<UploadResult> {
    const existing = (await this.sql.query<{ id: string; ownerStoreId: string; name: string }>(`SELECT "id", "ownerStoreId", "name" FROM "ThemePackage" WHERE "themeId" = $1`, [parsed.themeId])).rows[0];
    if (existing && existing.ownerStoreId !== storeId) throw new ApiError(409, "THEME_ID_TAKEN", `The theme id "${parsed.themeId}" belongs to another store. Choose a different id.`);

    let packageId = existing?.id;
    if (existing) {
      const versions = (await this.sql.query<VersionRow & { manifest: Record<string, unknown> }>(`SELECT "id", "packageId", "version", "status", "contentHash", "createdAt", "manifest" FROM "ThemePackageVersion" WHERE "packageId" = $1`, [existing.id])).rows;
      const same = versions.find((row) => row.version === parsed.version);
      if (same) {
        if (same.contentHash === parsed.contentHash) return { package: { id: existing.id, themeId: parsed.themeId, name: existing.name }, version: { id: same.id, version: same.version, status: same.status }, created: false };
        throw new ApiError(409, "VERSION_EXISTS", `Version ${parsed.version} was already uploaded with different content. Raise the version number in theme.json.`);
      }
      const newest = versions.sort((a, b) => compareVersions(a.version, b.version)).at(-1);
      if (newest && compareVersions(parsed.version, newest.version) <= 0) throw new ApiError(409, "VERSION_NOT_NEWER", `Version ${parsed.version} must be newer than ${newest.version}, which is already uploaded. Build metadata does not make a new release. Raise the version number in theme.json.`);
      if (newest) assertThemeVersionTransition(newest.manifest, parsed.manifest);
      await this.sql.query(`UPDATE "ThemePackage" SET "name" = $2, "updatedAt" = NOW() WHERE "id" = $1`, [existing.id, parsed.name]);
    } else {
      packageId = randomUUID();
      await this.sql.query(`INSERT INTO "ThemePackage" ("id", "ownerStoreId", "themeId", "name") VALUES ($1, $2, $3, $4)`, [packageId, storeId, parsed.themeId, parsed.name]);
    }

    const versionId = randomUUID();
    const stored: StoredAsset[] = [];
    try {
      for (const [index, asset] of parsed.assets.entries()) {
        const storageKey = await this.storage.put({ storeId, mediaId: `theme-${versionId}-${index}`, extension: asset.extension, contents: asset.data, mimeType: asset.contentType });
        stored.push({ path: asset.path, contentType: asset.contentType, size: asset.size, sha256: asset.sha256, storageKey });
      }
      await this.sql.query(
        `INSERT INTO "ThemePackageVersion" ("id", "packageId", "version", "manifest", "starter", "css", "assets", "contentHash") VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8)`,
        [versionId, packageId, parsed.version, JSON.stringify(parsed.manifest), parsed.starter ? JSON.stringify(parsed.starter) : null, parsed.css, JSON.stringify(stored), parsed.contentHash],
      );
    } catch (error) {
      // Two uploads of the same version at once: the unique index lets one win.
      await Promise.allSettled(stored.map((asset) => this.storage.remove(asset.storageKey)));
      if ((error as { code?: string }).code === "23505") throw new ApiError(409, "VERSION_EXISTS", `Version ${parsed.version} was just uploaded by another request.`);
      throw error;
    }
    return { package: { id: packageId!, themeId: parsed.themeId, name: parsed.name }, version: { id: versionId, version: parsed.version, status: "active" }, created: true };
  }

  async list(storeId: string): Promise<ThemePackageSummary[]> {
    const packages = (await this.sql.query<{ id: string; themeId: string; name: string; visibility: "private" | "listed" }>(`SELECT "id", "themeId", "name", "visibility" FROM "ThemePackage" WHERE "ownerStoreId" = $1 ORDER BY "createdAt", "id"`, [storeId])).rows;
    if (!packages.length) return [];
    const versions = (await this.sql.query<VersionRow>(`SELECT "id", "packageId", "version", "status", "contentHash", "createdAt" FROM "ThemePackageVersion" WHERE "packageId" = ANY($1::text[]) ORDER BY "createdAt", "id"`, [packages.map((row) => row.id)])).rows;
    return packages.map((row) => ({ ...row, versions: versions.filter((version) => version.packageId === row.id).map(({ id, version, status, createdAt }) => ({ id, version, status, createdAt })) }));
  }

  /**
   * Makes a stored version known to this process, so publishing, theme saves and starter installs
   * can resolve it like a built-in theme. Every pinned version remains available independently.
   */
  private register(row: { themeId: string; version: string; manifest: Record<string, unknown>; starter: Record<string, unknown> | null }): void {
    registerThemeProject({ manifest: row.manifest as never, ...(row.starter ? { starter: row.starter as never } : {}) });
  }

  /** Registers every uploaded theme a store has installed (cached for 30 seconds per store). Cheap to call on each request. */
  async registerStoreThemes(storeId: string): Promise<void> {
    const checkedAt = this.storeThemeCache.get(storeId);
    if (checkedAt && Date.now() - checkedAt < 30_000) return;
    const rows = (await this.sql.query<{ themeId: string; version: string; manifest: Record<string, unknown>; starter: Record<string, unknown> | null }>(
      `SELECT p."themeId", v."version", v."manifest", v."starter" FROM "ThemePackageVersion" v JOIN "ThemePackage" p ON p."id" = v."packageId"
       WHERE v."id" IN (
         SELECT "versionId" FROM "ThemeInstall" WHERE "storeId" = $1
         UNION SELECT "draftArtifactId" FROM "ThemeConfiguration" WHERE "storeId" = $1
         UNION SELECT "themeArtifactId" FROM "StorefrontPublication" WHERE "storeId" = $1
       )`,
      [storeId],
    )).rows;
    for (const row of rows) this.register(row);
    if (this.storeThemeCache.size > 1000) this.storeThemeCache.clear();
    this.storeThemeCache.set(storeId, Date.now());
  }

  /**
   * Installs an uploaded version on a store: records the install, puts the theme's starter into the
   * draft and points the draft at this version. Only the owner's own stores can install a private
   * package, and yanked versions cannot be installed.
   */
  async install(storeId: string, versionId: string, options?: { replaceDraft: boolean; expectedGeneration: number }): Promise<{ themeId: string; version: string; generation: number; installed: boolean }> {
    if (!this.starters) throw new ApiError(503, "INSTALL_UNAVAILABLE", "Installing themes is not available in this setup.");
    const row = (await this.sql.query<{ id: string; packageId: string; themeId: string; ownerStoreId: string; version: string; status: string; manifest: Record<string, unknown>; starter: Record<string, unknown> | null }>(
      `SELECT v."id", v."packageId", p."themeId", p."ownerStoreId", v."version", v."status", v."manifest", v."starter" FROM "ThemePackageVersion" v JOIN "ThemePackage" p ON p."id" = v."packageId" WHERE v."id" = $1`,
      [versionId],
    )).rows[0];
    // A private theme is invisible to other stores, so they get the same answer as for a missing one.
    if (!row || row.ownerStoreId !== storeId) throw new ApiError(404, "NOT_FOUND", "That theme version was not found.");
    if (row.status === "yanked") throw new ApiError(409, "VERSION_YANKED", "That version was withdrawn by its author. Install a newer one.");
    const manifest = validateThemeManifest(row.manifest);
    if (!supportsJellyVersion(manifest.engines?.jelly)) throw new ApiError(422, "ENGINE_INCOMPATIBLE", `This theme needs Jelly ${manifest.engines?.jelly}; this platform supports theme API ${JELLY_THEME_API_VERSION}.`);
    if (!row.starter) throw new ApiError(422, "NO_STARTER", "This theme has no starter.json, so there is nothing to put on the store. Add one and upload a new version.");

    this.register(row);
    const result = await this.starters.install(storeId, row.themeId, options, row.id, row.version);
    await this.sql.query(
      `INSERT INTO "ThemeInstall" ("id", "storeId", "packageId", "versionId") VALUES ($1, $2, $3, $4)
       ON CONFLICT ("storeId", "packageId") DO UPDATE SET "versionId" = EXCLUDED."versionId", "installedAt" = NOW()`,
      [randomUUID(), storeId, row.packageId, row.id],
    );
    this.storeThemeCache.delete(storeId);
    return { themeId: row.themeId, version: row.version, generation: result.generation, installed: result.installed };
  }

  /** Marks a version as yanked (new installs are refused; stores already on it keep working). Owner only. */
  async yank(storeId: string, versionId: string): Promise<void> {
    const rows = (await this.sql.query(
      `UPDATE "ThemePackageVersion" v SET "status" = 'yanked' FROM "ThemePackage" p WHERE v."id" = $2 AND v."packageId" = p."id" AND p."ownerStoreId" = $1 RETURNING v."id"`,
      [storeId, versionId],
    )).rows;
    if (!rows.length) throw new ApiError(404, "NOT_FOUND", "That theme version was not found.");
  }

  /** Public read of one version by id (the id is what a published snapshot pins). */
  async getVersion(versionId: string): Promise<PublicThemeVersion | null> {
    const row = (await this.sql.query<{ id: string; themeId: string; version: string; status: "active" | "yanked"; manifest: Record<string, unknown>; starter: Record<string, unknown> | null; css: string; assets: StoredAsset[] }>(
      `SELECT v."id", p."themeId", v."version", v."status", v."manifest", v."starter", v."css", v."assets" FROM "ThemePackageVersion" v JOIN "ThemePackage" p ON p."id" = v."packageId" WHERE v."id" = $1`,
      [versionId],
    )).rows[0];
    if (!row) return null;
    return { id: row.id, themeId: row.themeId, version: row.version, status: row.status, manifest: row.manifest, starter: row.starter, css: row.css, assets: row.assets.map(({ path, contentType, size }) => ({ path, contentType, size })) };
  }

  /** One asset file of a version, for the public asset route. */
  async openAsset(versionId: string, path: string): Promise<{ data: Buffer; contentType: string } | null> {
    const row = (await this.sql.query<{ assets: StoredAsset[] }>(`SELECT "assets" FROM "ThemePackageVersion" WHERE "id" = $1`, [versionId])).rows[0];
    const asset = row?.assets.find((candidate) => candidate.path === path);
    if (!asset) return null;
    const data = await this.storage.open(asset.storageKey);
    return data ? { data, contentType: asset.contentType } : null;
  }
}
