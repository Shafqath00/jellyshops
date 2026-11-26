import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import {
  MAX_REDIRECTS_PER_STORE, createsRedirectLoop, normaliseRedirectFrom, normaliseRedirectTo, redirectProblem,
} from "@jelly/storefront-schema";
import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";

export interface UrlRedirect { id: string; from: string; to: string; createdAt: string }
export interface RedirectPage { redirects: UrlRedirect[]; total: number; available: boolean }
export interface ImportRow { line: number; from: string; to: string; problem: string | null; replaces: boolean }
export interface ImportResult { rows: ImportRow[]; added: number; replaced: number; skipped: number; applied: boolean }

export const MAX_REDIRECT_CSV_BYTES = 1_000_000;
const MAX_IMPORT_ROWS = 5000;

async function ready(sql: SqlExecutor): Promise<boolean> {
  const result = await sql.query<{ table: string | null }>(`SELECT to_regclass('public."UrlRedirect"')::text AS "table"`);
  return Boolean(result.rows[0]?.table);
}
const unavailable = () => new ApiError(503, "REDIRECTS_UNAVAILABLE", "Redirects aren't ready yet. Please try again later.");
const invalid = (message: string, path = "from") => new ApiError(422, "REDIRECT_INVALID", message, [{ path, message }]);
const row = (r: { id: unknown; fromPath: unknown; toPath: unknown; createdAt: Date | string }): UrlRedirect => ({ id: String(r.id), from: String(r.fromPath), to: String(r.toPath), createdAt: new Date(r.createdAt).toISOString() });
// LIKE wildcards in a merchant's search are matched literally.
const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Merchant-made redirects (old address -> new address) and the storefront lookup. */
export class UrlRedirectService {
  constructor(private readonly db: CommerceDatabase) {}

  async list(storeId: string, query: { q?: string; offset?: number; limit?: number } = {}): Promise<RedirectPage> {
    return this.db.transaction(async (sql) => {
      if (!await ready(sql)) return { redirects: [], total: 0, available: false };
      const q = query.q?.trim().slice(0, 200) ?? "";
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
      const offset = Math.max(query.offset ?? 0, 0);
      const where = `"storeId" = $1${q ? ` AND ("fromPath" ILIKE $2 OR "toPath" ILIKE $2)` : ""}`;
      const values: unknown[] = q ? [storeId, likeTerm(q)] : [storeId];
      const total = await sql.query<{ count: string }>(`SELECT count(*)::text AS count FROM "UrlRedirect" WHERE ${where}`, values);
      const rows = await sql.query<{ id: string; fromPath: string; toPath: string; createdAt: Date }>(
        `SELECT "id", "fromPath", "toPath", "createdAt" FROM "UrlRedirect" WHERE ${where} ORDER BY "createdAt" DESC, "fromPath" LIMIT ${limit} OFFSET ${offset}`, values,
      );
      return { redirects: rows.rows.map(row), total: Number(total.rows[0]?.count ?? 0), available: true };
    });
  }

  private async map(sql: SqlExecutor, storeId: string, skipId?: string): Promise<Map<string, string>> {
    const rows = await sql.query<{ id: string; fromPath: string; toPath: string }>(`SELECT "id", "fromPath", "toPath" FROM "UrlRedirect" WHERE "storeId" = $1`, [storeId]);
    return new Map(rows.rows.filter((r) => r.id !== skipId).map((r) => [r.fromPath, r.toPath]));
  }

  private checked(fromInput: string, toInput: string, ownHosts: readonly string[]): { from: string; to: string } {
    const problem = redirectProblem(fromInput, toInput, ownHosts);
    if (problem) throw invalid(problem, /destination|go/.test(problem) ? "to" : "from");
    return { from: normaliseRedirectFrom(fromInput, ownHosts)!, to: normaliseRedirectTo(toInput)! };
  }

  async create(storeId: string, input: { from: string; to: string }, ownHosts: readonly string[] = []): Promise<UrlRedirect> {
    const { from, to } = this.checked(input.from, input.to, ownHosts);
    return this.db.transaction(async (sql) => {
      if (!await ready(sql)) throw unavailable();
      await sql.query(`SELECT "id" FROM "Store" WHERE "id" = $1 FOR UPDATE`, [storeId]);
      const existing = await this.map(sql, storeId);
      if (existing.has(from)) throw new ApiError(409, "REDIRECT_EXISTS", "There's already a redirect from this address. Edit that one instead.", [{ path: "from", message: "There's already a redirect from this address." }]);
      if (existing.size >= MAX_REDIRECTS_PER_STORE) throw new ApiError(409, "REDIRECT_LIMIT", `A store can have up to ${MAX_REDIRECTS_PER_STORE.toLocaleString("en-GB")} redirects.`);
      if (createsRedirectLoop(existing, from, to)) throw invalid("This would send shoppers round in a circle between redirects.", "to");
      const result = await sql.query<{ id: string; fromPath: string; toPath: string; createdAt: Date }>(
        `INSERT INTO "UrlRedirect" ("id", "storeId", "fromPath", "toPath") VALUES ($1, $2, $3, $4) RETURNING "id", "fromPath", "toPath", "createdAt"`,
        [randomUUID(), storeId, from, to],
      );
      return row(result.rows[0]!);
    });
  }

  async update(storeId: string, id: string, input: { from: string; to: string }, ownHosts: readonly string[] = []): Promise<UrlRedirect> {
    const { from, to } = this.checked(input.from, input.to, ownHosts);
    return this.db.transaction(async (sql) => {
      if (!await ready(sql)) throw unavailable();
      await sql.query(`SELECT "id" FROM "Store" WHERE "id" = $1 FOR UPDATE`, [storeId]);
      const others = await this.map(sql, storeId, id);
      if (others.has(from)) throw new ApiError(409, "REDIRECT_EXISTS", "There's already a redirect from this address.", [{ path: "from", message: "There's already a redirect from this address." }]);
      if (createsRedirectLoop(others, from, to)) throw invalid("This would send shoppers round in a circle between redirects.", "to");
      const result = await sql.query<{ id: string; fromPath: string; toPath: string; createdAt: Date }>(
        `UPDATE "UrlRedirect" SET "fromPath" = $3, "toPath" = $4, "updatedAt" = NOW() WHERE "storeId" = $1 AND "id" = $2 RETURNING "id", "fromPath", "toPath", "createdAt"`,
        [storeId, id, from, to],
      );
      if (!result.rows[0]) throw new ApiError(404, "REDIRECT_NOT_FOUND", "This redirect doesn't exist any more.");
      return row(result.rows[0]);
    });
  }

  async remove(storeId: string, ids: string[]): Promise<number> {
    const unique = [...new Set(ids.map(String))].slice(0, 500);
    if (!unique.length) return 0;
    return this.db.transaction(async (sql) => {
      if (!await ready(sql)) throw unavailable();
      const result = await sql.query(`DELETE FROM "UrlRedirect" WHERE "storeId" = $1 AND "id" = ANY($2::text[]) RETURNING "id"`, [storeId, unique]);
      return result.rows.length;
    });
  }

  /**
   * Checks (and with `apply`, saves) redirects from a CSV with two columns: old address, new address. A header row
   * ("Redirect from, Redirect to" or similar) is recognised and skipped. Rows with problems are reported and never
   * saved; a later row for the same old address wins over an earlier one; with `replace` existing redirects from the
   * same address are overwritten, otherwise kept.
   */
  async importCsv(storeId: string, csv: string, options: { apply: boolean; replace: boolean }, ownHosts: readonly string[] = []): Promise<ImportResult> {
    if (Buffer.byteLength(csv, "utf8") > MAX_REDIRECT_CSV_BYTES) throw new ApiError(413, "REDIRECT_CSV_TOO_LARGE", "The file is too large. Split it into files of up to 1 MB.");
    const parsed = Papa.parse<string[]>(csv.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
    const records = parsed.data.filter((cells) => cells.some((cell) => String(cell).trim()));
    if (records.length && /redirect|from|old|source/i.test(String(records[0]![0] ?? "")) && !String(records[0]![0] ?? "").trim().startsWith("/")) records.shift();
    if (records.length > MAX_IMPORT_ROWS) throw new ApiError(422, "REDIRECT_CSV_TOO_MANY", `A file can hold up to ${MAX_IMPORT_ROWS.toLocaleString("en-GB")} redirects.`);
    if (!records.length) throw new ApiError(422, "REDIRECT_CSV_EMPTY", "The file has no redirects in it. Use two columns: old address, new address.");

    return this.db.transaction(async (sql) => {
      if (!await ready(sql)) throw unavailable();
      await sql.query(`SELECT "id" FROM "Store" WHERE "id" = $1 FOR UPDATE`, [storeId]);
      const existing = await this.map(sql, storeId);
      const working = new Map(existing);
      const lastLine = new Map<string, number>();
      const rows: ImportRow[] = records.map((cells, index) => {
        const line = index + 1;
        const fromInput = String(cells[0] ?? "").trim();
        const toInput = String(cells[1] ?? "").trim();
        const problem = cells.length < 2 ? "Each row needs two columns: old address, new address." : redirectProblem(fromInput, toInput, ownHosts);
        if (problem) return { line, from: fromInput, to: toInput, problem, replaces: false };
        const from = normaliseRedirectFrom(fromInput, ownHosts)!;
        const to = normaliseRedirectTo(toInput)!;
        return { line, from, to, problem: null, replaces: existing.has(from) };
      });
      for (const item of rows) {
        if (item.problem) continue;
        if (item.replaces && !options.replace) { item.problem = "Already redirected. Tick “Replace existing redirects” to overwrite it."; continue; }
        if (createsRedirectLoop(working, item.from, item.to)) { item.problem = "This would send shoppers round in a circle between redirects."; continue; }
        const earlier = lastLine.get(item.from);
        if (earlier !== undefined) { const before = rows.find((r) => r.line === earlier)!; before.problem = `Replaced by line ${item.line} for the same address.`; }
        lastLine.set(item.from, item.line);
        working.set(item.from, item.to);
      }
      const good = rows.filter((r) => !r.problem);
      const added = good.filter((r) => !r.replaces).length;
      const replaced = good.length - added;
      if (existing.size + added > MAX_REDIRECTS_PER_STORE) throw new ApiError(409, "REDIRECT_LIMIT", `A store can have up to ${MAX_REDIRECTS_PER_STORE.toLocaleString("en-GB")} redirects. This file would go over.`);
      if (options.apply) {
        for (const item of good) {
          await sql.query(`
            INSERT INTO "UrlRedirect" ("id", "storeId", "fromPath", "toPath") VALUES ($1, $2, $3, $4)
            ON CONFLICT ("storeId", "fromPath") DO UPDATE SET "toPath" = EXCLUDED."toPath", "updatedAt" = NOW()
          `, [randomUUID(), storeId, item.from, item.to]);
        }
      }
      return { rows, added, replaced, skipped: rows.length - good.length, applied: options.apply };
    });
  }

  /** Where an old address now goes, for the storefront's "page not found" step. Never fails. */
  async resolve(storeId: string, path: string): Promise<string | null> {
    const from = normaliseRedirectFrom(path);
    if (!from) return null;
    try {
      return await this.db.transaction(async (sql) => {
        if (!await ready(sql)) return null;
        const pathOnly = from.split("?")[0]!;
        const result = await sql.query<{ toPath: string }>(
          `SELECT "toPath" FROM "UrlRedirect" WHERE "storeId" = $1 AND "fromPath" = ANY($2::text[]) ORDER BY char_length("fromPath") DESC LIMIT 1`,
          [storeId, from === pathOnly ? [from] : [from, pathOnly]],
        );
        return result.rows[0]?.toPath ?? null;
      });
    } catch {
      return null;
    }
  }
}
