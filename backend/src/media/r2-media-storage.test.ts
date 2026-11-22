import { describe, expect, it } from "vitest";
import { IMMUTABLE, R2MediaStorage, mediaTypeForKey } from "./r2-media-storage.js";
import type { MediaStorage } from "./storage.js";

/** A pretend R2 bucket: keeps files in memory and records each signed request. */
function fakeR2() {
  const files = new Map<string, { body: Buffer; type: string | null; cache: string | null }>();
  const requests: Array<{ method: string; url: string; authorization: string | null }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({ method: request.method, url: request.url, authorization: request.headers.get("authorization") });
    const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/bucket\//, ""));
    const file = files.get(key);
    if (request.method === "PUT") { files.set(key, { body: Buffer.from(await request.arrayBuffer()), type: request.headers.get("content-type"), cache: request.headers.get("cache-control") }); return new Response(null, { status: 200 }); }
    if (request.method === "DELETE") { files.delete(key); return new Response(null, { status: 204 }); }
    if (!file) return new Response(null, { status: 404 });
    return new Response(request.method === "HEAD" ? null : new Uint8Array(file.body), { status: 200, headers: { "content-length": String(file.body.length) } });
  };
  return { files, requests, fetcher: fetcher as typeof fetch };
}

const options = (fetcher: typeof fetch, fallback?: MediaStorage) => ({ accountId: "acc", accessKeyId: "key", secretAccessKey: "secret", bucket: "bucket", endpoint: "https://r2.test", fetch: fetcher, fallback });

describe("R2 media storage", () => {
  it("writes signed, immutable files under the usual key and reads them back", async () => {
    const r2 = fakeR2();
    const storage = new R2MediaStorage(options(r2.fetcher));
    const key = await storage.put({ storeId: "store-a", mediaId: "m1", extension: "png", contents: Buffer.from("png"), mimeType: "image/png" });
    expect(key).toBe("store-a/m1.png");
    expect(r2.files.get("store-a/m1.png")).toMatchObject({ type: "image/png", cache: IMMUTABLE });
    expect(r2.requests[0]).toMatchObject({ method: "PUT", url: "https://r2.test/bucket/store-a/m1.png" });
    expect(r2.requests[0].authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=key\//);
    expect((await storage.open("store-a/m1.png"))?.toString()).toBe("png");
    expect(await storage.size("store-a/m1.png")).toBe(3);
    await storage.remove("store-a/m1.png");
    expect(await storage.open("store-a/m1.png")).toBeNull();
    expect(await storage.size("store-a/m1.png")).toBeNull();
  });

  it("reads from the old store while a file has not been copied yet, and removes from both", async () => {
    const r2 = fakeR2();
    const removed: string[] = [];
    const old: MediaStorage = { put: async () => "", open: async (key) => key === "store-a/old.png" ? Buffer.from("old") : null, remove: async (key) => { removed.push(key); } };
    const storage = new R2MediaStorage(options(r2.fetcher, old));
    expect((await storage.open("store-a/old.png"))?.toString()).toBe("old");
    expect(await storage.open("store-a/none.png")).toBeNull();
    await storage.remove("store-a/old.png");
    expect(removed).toEqual(["store-a/old.png"]);
  });

  it("only ever stores image types, and refuses keys that try to leave the store's folder", async () => {
    expect(mediaTypeForKey("a/b.png.w640.webp", "image/webp")).toBe("image/webp");
    expect(mediaTypeForKey("a/b.jpg", "text/html")).toBe("image/jpeg");
    expect(mediaTypeForKey("a/b.html", "text/html")).toBe("application/octet-stream");
    const storage = new R2MediaStorage(options(fakeR2().fetcher));
    await expect(storage.open("../secret")).rejects.toThrow("Invalid media key");
    await expect(storage.open("/abs/key")).rejects.toThrow("Invalid media key");
  });
});
