import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { ApiError, errorHandler } from "../http/errors.js";
import { createCustomDataRouter } from "./routes.js";

const principal = (role: string) => ({ userId: "account-1", storeIds: ["store-a"], storeRoles: { "store-a": role } }) as MerchantPrincipal;
const auth = (who: MerchantPrincipal): AuthProvider => ({ verify: async () => who });

function setup(role = "ADMIN", withService = true) {
  const ownerValues = {
    list: vi.fn(async () => [{ ownerId: "p1", definitionId: "d1", value: "Cotton" }]),
    save: vi.fn(async () => ({ saved: 1, cleared: 0 })),
  };
  const app = express();
  app.use((req, _res, next) => { req.id = "owner-values-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/custom-data", createCustomDataRouter({ customData: {} as never, metaobjects: {} as never, registry: {} as never, ...(withService ? { ownerValues } : {}) }, auth(principal(role))));
  app.use(errorHandler);
  return { app, ownerValues };
}
const base = "/api/stores/store-a/custom-data/metafield-values";
const get = (app: express.Express, query: string) => request(app).get(`${base}${query}`).set("Authorization", "Bearer token");
const put = (app: express.Express, body: unknown) => request(app).put(base).set("Authorization", "Bearer token").send(body as object);

describe("loading custom field values", () => {
  it("returns the values of one item, or of several, for the signed-in store", async () => {
    const { app, ownerValues } = setup();
    const one = await get(app, "?ownerType=product&ownerId=p1");
    expect(one.status).toBe(200);
    expect(one.body).toEqual({ values: [{ ownerId: "p1", definitionId: "d1", value: "Cotton" }] });
    expect(ownerValues.list).toHaveBeenCalledWith("store-a", "product", ["p1"]);
    await get(app, "?ownerType=variant&ownerIds=v1,%20v2,,v3");
    expect(ownerValues.list).toHaveBeenLastCalledWith("store-a", "variant", ["v1", "v2", "v3"]);
  });

  it("is open to anyone who can view the storefront, and closed to other stores", async () => {
    expect((await get(setup("STAFF").app, "?ownerType=product&ownerId=p1")).status).toBe(200);
    expect((await request(setup().app).get("/api/stores/store-b/custom-data/metafield-values?ownerType=product&ownerId=p1").set("Authorization", "Bearer token")).status).toBe(404);
  });

  it("asks for what it needs", async () => {
    const { app, ownerValues } = setup();
    expect((await get(app, "?ownerType=product")).status).toBe(400);
    expect((await get(app, "?ownerType=nonsense&ownerId=p1")).status).toBe(400);
    expect((await get(app, "?ownerId=p1")).status).toBe(400);
    expect(ownerValues.list).not.toHaveBeenCalled();
  });

  it("says so when custom data is unavailable", async () => {
    expect((await get(setup("ADMIN", false).app, "?ownerType=product&ownerId=p1")).status).toBe(503);
  });
});

describe("saving custom field values", () => {
  it("saves values and clears with null for the signed-in store only", async () => {
    const { app, ownerValues } = setup();
    const response = await put(app, { ownerType: "product", ownerId: "p1", values: { d1: "Linen", d2: null } });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ saved: 1, cleared: 0 });
    expect(ownerValues.save).toHaveBeenCalledWith("store-a", "product", "p1", { d1: "Linen", d2: null });
  });

  it("needs permission to edit custom data", async () => {
    const { app, ownerValues } = setup("STAFF");
    expect((await put(app, { ownerType: "product", ownerId: "p1", values: { d1: "x" } })).status).toBe(403);
    expect(ownerValues.save).not.toHaveBeenCalled();
  });

  it("rejects a malformed request before it reaches the service", async () => {
    const { app, ownerValues } = setup();
    expect((await put(app, { ownerType: "product", values: {} })).status).toBe(400);
    expect((await put(app, { ownerType: "product", ownerId: "p1" })).status).toBe(400);
    expect((await put(app, { ownerType: "product", ownerId: "p1", values: [] })).status).toBe(400);
    expect((await put(app, { ownerType: "gadget", ownerId: "p1", values: {} })).status).toBe(400);
    expect((await put(app, { ownerType: "product", ownerId: "p1", values: {}, storeId: "store-b" })).status).toBe(400);
    expect(ownerValues.save).not.toHaveBeenCalled();
  });

  it("passes the reasons a value was refused back to the editor, per field", async () => {
    const { app, ownerValues } = setup();
    ownerValues.save.mockRejectedValueOnce(new ApiError(422, "METAFIELD_INVALID", "2 custom fields need attention.", [{ path: "d1", message: "Rating: Enter 5 or less." }, { path: "d2", message: "Colour: Use a colour like #1a2b3c." }]));
    const response = await put(app, { ownerType: "product", ownerId: "p1", values: { d1: 9, d2: "red" } });
    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({ code: "METAFIELD_INVALID", message: "2 custom fields need attention." });
    expect(JSON.stringify(response.body)).toContain("Rating: Enter 5 or less.");
  });

  it("says so when custom data is unavailable", async () => {
    expect((await put(setup("ADMIN", false).app, { ownerType: "product", ownerId: "p1", values: {} })).status).toBe(503);
  });
});
