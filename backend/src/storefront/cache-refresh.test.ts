import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createStorefrontRefresher, refreshStorefrontAfterChanges, type StorefrontRefresher } from "./cache-refresh.js";

function appWith(refresher: StorefrontRefresher) {
  const app = express();
  app.use(express.json());
  app.use(refreshStorefrontAfterChanges(refresher));
  app.get("/api/stores/:storeId/products", (_request, response) => { response.json([]); });
  app.put("/api/stores/:storeId/products/:id", (_request, response) => { response.json({ ok: true }); });
  app.put("/api/stores/:storeId/broken", (_request, response) => { response.status(400).json({ error: "no" }); });
  app.post("/api/public/stores/:storeId/checkout", (_request, response) => { response.json({ ok: true }); });
  return app;
}

function spyRefresher(): StorefrontRefresher & { calls: string[] } {
  const calls: string[] = [];
  return { enabled: true, calls, storeChanged: async (storeId) => { calls.push(storeId); } };
}

describe("refreshStorefrontAfterChanges", () => {
  it("refreshes the store after a successful merchant change, before the response arrives", async () => {
    const refresher = spyRefresher();
    const response = await request(appWith(refresher)).put("/api/stores/store-a/products/p1").send({});
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(refresher.calls).toEqual(["store-a"]);
  });

  it("leaves reads, failed changes and public routes alone", async () => {
    const refresher = spyRefresher();
    const app = appWith(refresher);
    await request(app).get("/api/stores/store-a/products");
    await request(app).put("/api/stores/store-a/broken").send({});
    await request(app).post("/api/public/stores/store-a/checkout").send({});
    expect(refresher.calls).toEqual([]);
  });

  it("still answers when the storefront is slow or down", async () => {
    const refresher: StorefrontRefresher = { enabled: true, storeChanged: () => new Promise((resolve) => setTimeout(resolve, 30)) };
    const response = await request(appWith(refresher)).put("/api/stores/store-a/products/p1").send({});
    expect(response.status).toBe(200);
  });
});

describe("createStorefrontRefresher", () => {
  it("does nothing without a url and secret", async () => {
    const fetcher = vi.fn();
    const refresher = createStorefrontRefresher({ fetch: fetcher as unknown as typeof fetch });
    expect(refresher.enabled).toBe(false);
    await refresher.storeChanged("store-a");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts the store id with the secret and swallows failures", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const refresher = createStorefrontRefresher({ url: "https://shop.test/api/revalidate", secret: "abc", fetch: fetcher as unknown as typeof fetch });
    await expect(refresher.storeChanged("store-a")).resolves.toBeUndefined();
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://shop.test/api/revalidate");
    expect(init.headers).toMatchObject({ Authorization: "Bearer abc" });
    expect(JSON.parse(String(init.body))).toEqual({ storeId: "store-a" });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
