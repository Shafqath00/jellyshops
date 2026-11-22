import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { AppConfig } from "./config.js";
import type { AuthProvider } from "./auth/types.js";

/**
 * One shop can never reach another's data through the API (docs/plans/2026-11-22-subdomain-tenancy-plan.md §5,
 * step 11). Every route the real app mounts under /api/stores/:storeId is called by a merchant of shop A against shop
 * B: each must refuse with 404 STORE_NOT_FOUND, exactly the reply for a shop that doesn't exist (so nobody can learn
 * which shops exist; 403 STORE_FORBIDDEN is only for members whose role lacks a permission), and never reach a service
 * or the database. Routes are read from the app itself,
 * so a new route is covered as soon as it is added.
 */

// Express 5 doesn't keep the address a router is mounted at: note it as the app is built.
type Layer = { route?: { path: string; methods: Record<string, boolean> }; handle: { stack?: Layer[] }; __mountPaths?: string[] };
function definesUse(start: object): { use: (...args: unknown[]) => unknown } {
  for (let current: object | null = start; current; current = Object.getPrototypeOf(current)) {
    if (Object.prototype.hasOwnProperty.call(current, "use")) return current as { use: (...args: unknown[]) => unknown };
  }
  throw new Error("router has no use()");
}
// Routers made by express.Router() and the app's own router share the prototype that defines use().
const routerPrototype = definesUse(express().router as object);
if (definesUse(express.Router()) !== routerPrototype) throw new Error("routers don't share use()");
const originalUse = routerPrototype.use;
routerPrototype.use = function use(this: { stack: Layer[] }, ...args: unknown[]) {
  const before = this.stack.length;
  const result = originalUse.apply(this, args);
  const first = args[0];
  const paths = typeof first === "string" ? [first] : Array.isArray(first) && first.every((item) => typeof item === "string") ? first as string[] : ["/"];
  for (const layer of this.stack.slice(before)) layer.__mountPaths = paths;
  return result;
};

function join(prefix: string, part: string): string {
  const joined = `${prefix}/${part}`.replace(/\/+/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

function listRoutes(stack: Layer[], prefix = ""): Array<{ method: string; path: string }> {
  return stack.flatMap((layer) => {
    if (layer.route) {
      return Object.keys(layer.route.methods).filter((method) => method !== "_all").map((method) => ({ method, path: join(prefix, layer.route!.path) }));
    }
    if (!layer.handle.stack) return [];
    return (layer.__mountPaths ?? ["/"]).flatMap((mount) => listRoutes(layer.handle.stack!, join(prefix, mount)));
  });
}

/** Any service or database the app was given: touching it means a refused request got past the access check. */
function untouchable(name: string): unknown {
  return new Proxy(function stand() { /* stand-in */ }, {
    get: (_target, property) => (property === "then" ? undefined : untouchable(`${name}.${String(property)}`)),
    apply: () => { throw new Error(`${name} was used`); },
    construct: () => { throw new Error(`${name} was used`); },
  });
}

const merchantOfA: AuthProvider = {
  async verify(token) {
    if (token !== "shop-a-owner") throw Object.assign(new Error("bad token"), { status: 401 });
    return { userId: "user-a", email: "owner@a.example.test", storeIds: ["store-a"], storeRoles: { "store-a": "OWNER" } };
  },
};

async function config(): Promise<AppConfig> {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-isolation-"));
  return {
    port: 3001, nodeEnv: "test", corsOrigins: ["http://localhost:3000"], trustProxy: false, authProvider: "development",
    mediaProvider: "local-files", dataDirectory: directory, uploadDirectory: path.join(directory, "uploads"),
    maxUploadBytes: 1024 * 1024, demoStoreId: "store-demo",
  };
}

const SERVICES = [
  "tenantRepository", "catalogService", "contentService", "customDataService", "ownerMetafieldService", "metaobjectService",
  "mediaRepository", "storefrontRepository", "storefrontWorkspaceApi", "storefrontCompilerApi", "storefrontSql",
  "storefrontPublicationApi", "storefrontStarterApi", "stripeAccountService", "checkoutService", "webhookSql",
  "merchantOrderService", "commerceDatabase", "orderRuntime",
] as const;

/**
 * Routes under /api/stores/:storeId that are public on purpose, with why. Adding one here is a decision: it must only
 * give out what any shopper can already see.
 */
const PUBLIC_ON_PURPOSE: Record<string, string> = {
  "GET /api/stores/:storeId/storefront/public": "the shop's published design, the same data its storefront shows anyone",
};

let app: express.Express;
let routes: Array<{ method: string; path: string }>;

beforeAll(async () => {
  const { createApp } = await import("./app.js");
  const stand = Object.fromEntries(SERVICES.map((name) => [name, untouchable(name)]));
  app = createApp({ ...stand, config: await config(), authProvider: merchantOfA, storefrontRefresher: { enabled: false, storeChanged: async () => undefined } } as never);
  routes = listRoutes((app as unknown as { router: { stack: Layer[] } }).router.stack)
    .filter((route) => route.path.startsWith("/api/stores/:storeId"))
    .filter((route) => !PUBLIC_ON_PURPOSE[`${route.method.toUpperCase()} ${route.path}`]);
});

const concrete = (route: string, storeId: string) => route.replace(":storeId", storeId).replace(/:(\w+)\*?/g, "x").replace(/\*\w*/g, "x");

async function call(method: string, url: string) {
  const req = (request(app) as unknown as Record<string, (url: string) => request.Test>)[method]!(url).set("Authorization", "Bearer shop-a-owner");
  return method === "get" || method === "head" || method === "delete" ? req : req.send({});
}

describe("shop data stays with its shop", () => {
  it("finds the merchant routes", () => {
    // A low number means the route table wasn't read: the test would pass while checking nothing.
    expect(routes.length).toBeGreaterThan(100);
  });

  it("refuses every merchant route for another shop, exactly like a shop that doesn't exist", async () => {
    const leaks: string[] = [];
    for (const route of routes) {
      const other = await call(route.method, concrete(route.path, "store-b"));
      const missing = await call(route.method, concrete(route.path, "store-that-does-not-exist"));
      const label = `${route.method.toUpperCase()} ${route.path}`;
      if (other.status !== 404 || other.body?.error?.code !== "STORE_NOT_FOUND") leaks.push(`${label} → ${other.status} ${other.body?.error?.code ?? ""}`.trim());
      else if (missing.status !== other.status || JSON.stringify(missing.body?.error?.code) !== JSON.stringify(other.body?.error?.code) || missing.body?.error?.message !== other.body?.error?.message) leaks.push(`${label} answers differently for a shop that doesn't exist`);
    }
    expect(leaks).toEqual([]);
  }, 120_000);
});
