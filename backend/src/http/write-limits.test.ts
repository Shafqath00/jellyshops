import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { WriteLimiter } from "./write-limits.js";

describe("write limits", () => {
  const limiter = (now: { t: number }) => new WriteLimiter({ windowMs: 60_000, perUser: 3, perStore: 4, now: () => now.t });

  it("allows changes up to the per-person limit, then says how long to wait", () => {
    const now = { t: 0 };
    const limits = limiter(now);
    expect([limits.take("u1", "s1"), limits.take("u1", "s1"), limits.take("u1", "s2")]).toEqual([null, null, null]);
    now.t = 15_000;
    expect(limits.take("u1", "s3")).toBe(45);
    now.t = 60_000;
    expect(limits.take("u1", "s1")).toBeNull();
  });

  it("limits a shop across all its staff", () => {
    const limits = limiter({ t: 0 });
    for (const user of ["a", "a", "b", "b"]) expect(limits.take(user, "shop")).toBeNull();
    expect(limits.take("c", "shop")).toBe(60);
    expect(limits.take("c", "other")).toBeNull();
  });

  it("does not count a refused change", () => {
    const now = { t: 0 };
    const limits = limiter(now);
    for (let i = 0; i < 3; i += 1) limits.take("u", "s");
    for (let i = 0; i < 5; i += 1) expect(limits.take("u", "s")).not.toBeNull();
    // The shop still has its fourth change for someone else.
    expect(limits.take("v", "s")).toBeNull();
  });
});

describe("requireStorePermission", () => {
  it("refuses changes beyond the limit with 429 and Retry-After, and never limits reads", async () => {
    const { requireStorePermission } = await import("../auth/middleware.js");
    const { errorHandler } = await import("./errors.js");
    const { WRITE_LIMITS } = await import("../billing/limits-config.js");
    const app = express();
    app.use((req, _res, next) => { req.merchant = { userId: "owner-1", storeIds: ["store-1"], storeRoles: { "store-1": "OWNER" } }; next(); });
    app.get("/api/stores/:storeId/things", requireStorePermission("catalog:view"), (_req, res) => { res.json({ ok: true }); });
    app.post("/api/stores/:storeId/things", requireStorePermission("catalog:edit"), (_req, res) => { res.json({ ok: true }); });
    app.use(errorHandler);

    for (let i = 0; i < WRITE_LIMITS.perUser; i += 1) await request(app).post("/api/stores/store-1/things").expect(200);
    const refused = await request(app).post("/api/stores/store-1/things").expect(429);
    expect(refused.body.error?.code ?? refused.body.code).toBe("WRITE_RATE_LIMIT");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    await request(app).get("/api/stores/store-1/things").expect(200);
  });
});
