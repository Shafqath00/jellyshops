import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommerceDatabase } from "./repository.js";
import { hashDigitalToken } from "./notifications.js";
import { ApiError } from "../http/errors.js";

export interface PrivateDigitalStorage { put(key: string, bytes: Buffer, mimeType: string): Promise<void>; get(key: string): Promise<Buffer> }
export function localPrivateDigitalStorage(directory: string): PrivateDigitalStorage {
  const root = resolve(directory);
  const location = (key: string) => { const path = resolve(root, key); if (!path.startsWith(root + sep)) throw new Error("Invalid storage key"); return path; };
  return { async put(key, bytes) { const path = location(key); await mkdir(resolve(path, ".."), { recursive: true }); await writeFile(path, bytes, { flag: "wx" }); }, get(key) { return readFile(location(key)); } };
}
/** Bucket must be private. No signed or public URL leaves the backend. */
export function supabasePrivateDigitalStorage(client: SupabaseClient, bucket: string): PrivateDigitalStorage {
  let verified: Promise<void> | undefined;
  const ensurePrivate = () => verified ??= (async () => { const { data, error } = await client.storage.getBucket(bucket); if (error || !data) throw error ?? new Error("Digital bucket is unavailable"); if (data.public) throw new Error("Digital delivery requires a private storage bucket"); })();
  return {
    async put(key, bytes, mimeType) { await ensurePrivate(); const { error } = await client.storage.from(bucket).upload(key, bytes, { contentType: mimeType, upsert: false }); if (error) throw error; },
    async get(key) { await ensurePrivate(); const { data, error } = await client.storage.from(bucket).download(key); if (error || !data) throw error ?? new Error("Private file unavailable"); return Buffer.from(await data.arrayBuffer()); },
  };
}
export function createDigitalService(database: CommerceDatabase, storage: PrivateDigitalStorage) {
  return {
    async getProduct(storeId: string, productId: string) {
      return database.transaction(async (sql) => {
        const product = (await sql.query(`SELECT "id","fulfillmentType" FROM "Product" WHERE "storeId"=$1 AND "id"=$2`, [storeId, productId])).rows[0];
        if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found");
        const assets = (await sql.query(`SELECT "id","filename","mimeType","sizeBytes","maxDownloads","expiresAfterDays","createdAt" FROM "DigitalAsset" WHERE "storeId"=$1 AND "productId"=$2 AND "archivedAt" IS NULL ORDER BY "createdAt"`, [storeId, productId])).rows;
        return { ...product, assets };
      });
    },
    async setType(storeId: string, productId: string, fulfillmentType: "PHYSICAL" | "DIGITAL") {
      return database.transaction(async (sql) => {
        const row = (await sql.query(`UPDATE "Product" SET "fulfillmentType"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "storeId"=$1 AND "id"=$2 RETURNING "id","fulfillmentType"`, [storeId, productId, fulfillmentType])).rows[0];
        if (!row) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found");
        return row;
      });
    },
    async upload(storeId: string, productId: string, file: { bytes: Buffer; filename: string; mimeType: string }, limits: { maxDownloads: number | null; expiresAfterDays: number | null }) {
      if (!file.bytes.length || file.bytes.length > 50 * 1024 * 1024) throw new ApiError(422, "FILE_SIZE", "Files must be between 1 byte and 50 MB");
      await database.transaction(async (sql) => { if (!(await sql.query(`SELECT "id" FROM "Product" WHERE "storeId"=$1 AND "id"=$2`, [storeId, productId])).rows[0]) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found"); });
      const id = randomUUID(); const key = `${storeId}/${id}`;
      await storage.put(key, file.bytes, file.mimeType);
      return database.transaction(async (sql) => (await sql.query(`INSERT INTO "DigitalAsset"("id","storeId","productId","storageKey","filename","mimeType","sizeBytes","maxDownloads","expiresAfterDays") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING "id","filename","mimeType","sizeBytes","maxDownloads","expiresAfterDays"`, [id, storeId, productId, key, file.filename.replace(/[\r\n\x00/\\]/g, "_").slice(0, 200), file.mimeType, file.bytes.length, limits.maxDownloads, limits.expiresAfterDays])).rows[0]);
    },
    async archive(storeId: string, productId: string, assetId: string) {
      await database.transaction(async (sql) => { const result = await sql.query(`UPDATE "DigitalAsset" SET "archivedAt"=CURRENT_TIMESTAMP WHERE "storeId"=$1 AND "productId"=$2 AND "id"=$3 RETURNING "id"`, [storeId, productId, assetId]); if (!result.rows.length) throw new ApiError(404, "ASSET_NOT_FOUND", "Digital file not found"); });
    },
    async download(storeId: string, entitlementId: string, token: string) {
      // Load bytes before consuming a download. Final locked recheck handles revocation and concurrent requests.
      const authorize = async (sql: Parameters<Parameters<CommerceDatabase["transaction"]>[0]>[0], lock: boolean) => {
        const row = (await sql.query(`SELECT e.*,a."storageKey",a."filename",a."mimeType",p."status" AS "paymentStatus",o."status" AS "orderStatus" FROM "DigitalEntitlement" e JOIN "DigitalAsset" a ON a."storeId"=e."storeId" AND a."id"=e."assetId" JOIN "Order" o ON o."storeId"=e."storeId" AND o."id"=e."orderId" JOIN "Payment" p ON p."storeId"=e."storeId" AND p."orderId"=e."orderId" WHERE e."storeId"=$1 AND e."id"=$2${lock ? ' FOR UPDATE OF e' : ''}`, [storeId, entitlementId])).rows[0];
        const expected = Buffer.from(String(row?.tokenHash ?? "")); const actual = Buffer.from(hashDigitalToken(token));
        if (!row || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new ApiError(404, "DOWNLOAD_NOT_FOUND", "Download not found");
        if (row.paymentStatus !== "PAID" || ["CANCELLED", "REFUNDED"].includes(String(row.orderStatus)) || row.revokedAt || row.expiresAt && new Date(String(row.expiresAt)).getTime() <= Date.now() || row.maxDownloads !== null && Number(row.downloadCount) >= Number(row.maxDownloads)) throw new ApiError(410, "DOWNLOAD_UNAVAILABLE", "This download is expired, revoked, or has reached its limit");
        return row;
      };
      const asset = await database.transaction((sql) => authorize(sql, false));
      const bytes = await storage.get(String(asset.storageKey));
      await database.transaction(async (sql) => { await authorize(sql, true); await sql.query(`UPDATE "DigitalEntitlement" SET "downloadCount"="downloadCount"+1 WHERE "id"=$1`, [entitlementId]); await sql.query(`INSERT INTO "DigitalDownloadAttempt"("id","entitlementId") VALUES($1,$2)`, [randomUUID(), entitlementId]); });
      return { bytes, filename: String(asset.filename), mimeType: String(asset.mimeType) };
    },
    async revokeItems(storeId: string, orderId: string, variantIds: string[]) {
      await database.transaction(async (sql) => { await sql.query(`UPDATE "DigitalEntitlement" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "storeId"=$1 AND "orderId"=$2 AND "variantId"=ANY($3::text[]) AND "revokedAt" IS NULL`, [storeId, orderId, variantIds]); });
    },
  };
}
export type DigitalService = ReturnType<typeof createDigitalService>;
