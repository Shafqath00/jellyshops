import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { afterEach, expect, it } from "vitest";
import { LocalJsonMediaRepository } from "./local-json-media-repository.js";
import { LocalMediaStorage } from "./local-media-storage.js";
import { MediaService } from "./service.js";
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
async function setup() {
 const dir = await mkdtemp(path.join(tmpdir(), "processed-media-")); directories.push(dir);
 const repository = new LocalJsonMediaRepository(path.join(dir, "data"));
 const storage = new LocalMediaStorage(path.join(dir, "uploads"));
 return { dir, repository, storage, service: new MediaService(repository, storage) };
}
function file(buffer: Buffer) { return { buffer, size: buffer.length, originalname: "image.jpg" } as Express.Multer.File; }
it("sanitizes orientation and EXIF retaining full resolution without upscaling derivatives", async () => {
 const { service } = await setup();
 const bytes = await sharp({ create: { width: 900, height: 400, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
 const uploaded = await service.upload("store", file(bytes));
 expect(uploaded).toMatchObject({ width: 400, height: 900, contentHash: createHash("sha256").update(bytes).digest("hex") });
 const original = await service.open("store", uploaded.id);
 expect(await sharp(original.contents).metadata()).toMatchObject({ width: 400, height: 900 });
 expect((await sharp(original.contents).metadata()).exif).toBeUndefined();
 for (const [width, expected] of [[320, 320], [640, 400], [1280, 400]]) {
  const image = await service.open("store", uploaded.id, width);
  expect((await sharp(image.contents).metadata()).width).toBe(expected);
  expect(image.mimeType).toBe("image/webp");
 }
});
it("deduplicates concurrent input bytes per store", async () => {
 const { service, repository, dir } = await setup();
 const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
 const [a,b] = await Promise.all([service.upload("store", file(bytes)), service.upload("store", file(bytes))]);
 expect(a.id).toBe(b.id);
 expect(await repository.list("store")).toHaveLength(1);
 expect(await readdir(path.join(dir, "uploads", "store"))).toHaveLength(4);
 expect((await service.upload("other", file(bytes))).id).not.toBe(a.id);
});
it("cleans all representations when persistence fails", async () => {
 const { service, repository, dir } = await setup();
 repository.create = async () => { throw new Error("database unavailable"); };
 const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
 await expect(service.upload("store", file(bytes))).rejects.toThrow("database unavailable");
 expect(await readdir(path.join(dir, "uploads", "store"))).toHaveLength(0);
});
it("rejects unsupported widths and falls back to legacy original", async () => {
 const { service, repository, storage } = await setup();
 const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
 await storage.put({ storeId: "store", mediaId: "legacy", extension: "png", contents: bytes });
 await repository.create({ id: "legacy", storeId: "store", type: "image", storageKey: "store/legacy.png", url: "/legacy", mimeType: "image/png", byteSize: bytes.length, width: 10, height: 10, originalName: "old.png", altText: null, referenced: false });
 expect((await service.open("store", "legacy", 320)).contents).toEqual(bytes);
 await expect(service.open("store", "legacy", 500)).rejects.toMatchObject({ status: 400 });
});
it("preserves animated GIF frames in sanitized original and WebP derivatives", async () => {
 const { service } = await setup();
 const bytes = await sharp(Buffer.from([255,0,0,0,0,255]), { raw: { width: 1, height: 2, channels: 3, pageHeight: 1 } }).gif({ loop: 0, delay: [100, 200] }).toBuffer();
 const uploaded = await service.upload("store", file(bytes));
 for (const width of [undefined, 320]) {
  const result = await service.open("store", uploaded.id, width);
  expect((await sharp(result.contents, { animated: true }).metadata()).pages).toBe(2);
 }
});
it("cleans successful writes when a derivative write fails", async () => {
 const { service, storage, dir } = await setup();
 const put = storage.put.bind(storage); let calls = 0;
 storage.put = async input => { const key = await put(input); if (++calls === 3) throw new Error("storage unavailable"); return key; };
 const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
 await expect(service.upload("store", file(bytes))).rejects.toThrow("storage unavailable");
 expect(await readdir(path.join(dir, "uploads", "store"))).toHaveLength(0);
});
it("lists only unreferenced images older than thirty days for manual cleanup", async () => {
 const { repository, storage } = await setup();
 const service = new MediaService(repository, storage, async (_store, id) => id === "used");
 for (const id of ["unused", "used", "new"]) {
  await repository.create({ id, storeId: "store", type: "image", storageKey: "store/test.png", url: "/test", mimeType: "image/png", byteSize: 1, width: 1, height: 1, originalName: "test.png", altText: null, referenced: false });
 }
 const list = repository.list.bind(repository);
 repository.list = async store => (await list(store)).map(record => ({ ...record, createdAt: record.id === "new" ? new Date().toISOString() : new Date(0).toISOString() }));
 expect((await service.list("store", true)).map(record => record.id)).toEqual(["unused"]);
 expect(await repository.list("store")).toHaveLength(3);
});

