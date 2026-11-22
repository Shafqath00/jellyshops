import { afterEach, beforeEach, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));

import { POST } from "./route";

const call = (body: unknown, token?: string) => POST(new Request("http://localhost/api/revalidate", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
}));

beforeEach(() => { revalidateTag.mockClear(); process.env.STOREFRONT_REVALIDATE_SECRET = "s3cret-value"; });
afterEach(() => { delete process.env.STOREFRONT_REVALIDATE_SECRET; });

it("refreshes the store's tags with the right secret", async () => {
  const response = await call({ storeId: "store-abc", slug: "sweet-bakes" }, "s3cret-value");
  expect(response.status).toBe(200);
  expect(revalidateTag).toHaveBeenCalledWith("store:store-abc", { expire: 0 });
  expect(revalidateTag).toHaveBeenCalledWith("storefront:sweet-bakes", { expire: 0 });
});

it("refuses a wrong or missing secret", async () => {
  expect((await call({ storeId: "store-abc" }, "wrong")).status).toBe(401);
  expect((await call({ storeId: "store-abc" })).status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

it("is switched off when no secret is configured", async () => {
  delete process.env.STOREFRONT_REVALIDATE_SECRET;
  expect((await call({ storeId: "store-abc" }, "anything")).status).toBe(503);
});

it("refuses bodies without a usable store", async () => {
  expect((await call({ storeId: "../etc" }, "s3cret-value")).status).toBe(400);
  expect((await call({}, "s3cret-value")).status).toBe(400);
  expect(revalidateTag).not.toHaveBeenCalled();
});
