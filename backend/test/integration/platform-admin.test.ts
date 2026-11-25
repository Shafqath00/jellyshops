import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthProvider } from "../../src/auth/types.js";
import type { CommerceDatabase, SqlExecutor } from "../../src/commerce/repository.js";
import { errorHandler } from "../../src/http/errors.js";
import { createPlatformRouter, readSessionClaims } from "../../src/platform/platform-admin.js";
import { createPGliteDatabase, seedStore } from "./pglite.js";

type Database = Awaited<ReturnType<typeof createPGliteDatabase>>;
const NOW = Date.UTC(2026, 10, 22, 12, 0, 0);
const seconds = (ms: number) => Math.floor(ms / 1000);

/** A token shaped like Supabase's (not signed: the test auth provider stands in for Supabase's check). */
function token(sub: string, claims: { aal: string; signedInAt: number; totpAt?: number }) {
  const amr = [{ method: "password", timestamp: seconds(claims.signedInAt) }, ...(claims.totpAt ? [{ method: "totp", timestamp: seconds(claims.totpAt) }] : [])];
  const payload = Buffer.from(JSON.stringify({ sub, aal: claims.aal, amr, exp: seconds(NOW) + 3600 })).toString("base64url");
  return `header.${payload}.signature`;
}

const authProvider: AuthProvider = {
  async verify(value) {
    const payload = JSON.parse(Buffer.from(value.split(".")[1]!, "base64url").toString("utf8")) as { sub: string };
    return { userId: payload.sub, email: `${payload.sub}@example.test`, storeIds: [], storeRoles: {} };
  },
};

function transactionDatabase(database: Database): CommerceDatabase {
  return { async transaction(work) { return database.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) } as SqlExecutor)); } };
}

async function setup() {
  const database = await createPGliteDatabase();
  await database.query(`INSERT INTO "User" ("id", "name", "email", "firebaseUid", "updatedAt") VALUES (1, 'Owner', 'owner@example.test', 'auth-owner', NOW()), (2, 'Merchant', 'merchant@example.test', 'auth-merchant', NOW())`);
  await database.query(`INSERT INTO "PlatformAdmin" ("userId", "role", "createdBy") VALUES (1, 'OWNER', 'test')`);
  await seedStore(database, "store-a", "alpha-shop");
  await seedStore(database, "store-b", "beta-shop");
  await database.query(`INSERT INTO "StoreMembership" ("storeId", "userId", "role") VALUES ('store-b', 2, 'OWNER')`);
  const app = express().use("/api/platform", createPlatformRouter(authProvider, transactionDatabase(database), () => NOW)).use(errorHandler);
  return { database, app };
}

describe("platform admin API", () => {
  let context: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => { context = await setup(); });
  const call = (path: string, bearer?: string) => {
    const req = request(context.app).get(path);
    return bearer ? req.set("Authorization", `Bearer ${bearer}`) : req;
  };
  const fresh = { aal: "aal2", signedInAt: NOW - 60_000, totpAt: NOW - 30_000 };

  it("lists shops, newest first, with the owner's email, and logs it", async () => {
    const response = await call("/api/platform/stores?q=beta", token("auth-owner", fresh));
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.stores).toEqual([expect.objectContaining({ id: "store-b", slug: "beta-shop", ownerEmail: "merchant@example.test", archived: false })]);
    const log = await context.database.query<{ action: string; actorUserId: number; metadata: { search?: string } }>(`SELECT "action", "actorUserId", "metadata" FROM "PlatformAuditEvent"`);
    expect(log.rows).toEqual([{ action: "platform.stores.list", actorUserId: 1, metadata: { search: "beta" } }]);
  });

  it("lists shops closed long enough to be warned about deletion, and logs it", async () => {
    const closed = new Date(NOW - 100 * 24 * 60 * 60 * 1000);
    await context.database.query(`INSERT INTO "StoreBilling" ("storeId", "plan", "status", "trialEndsAt") VALUES ('store-b', 'standard', 'expired', $1)`, [closed]);
    const response = await call("/api/platform/retention", token("auth-owner", fresh));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ retentionDays: 90, warningDays: 14 });
    expect(response.body.shops).toEqual([expect.objectContaining({ storeId: "store-b", ownerEmail: "merchant@example.test", closedSince: closed.toISOString(), warnedAt: null, due: false })]);
    const log = await context.database.query<{ action: string }>(`SELECT "action" FROM "PlatformAuditEvent"`);
    expect(log.rows).toEqual([{ action: "platform.retention.list" }]);
    expect((await call("/api/platform/retention", token("auth-merchant", fresh))).status).toBe(403);
  });

  it("tells the admin who they are", async () => {
    expect((await call("/api/platform/me", token("auth-owner", fresh))).body).toEqual({ role: "OWNER", email: "owner@example.test" });
  });

  it("refuses anyone not listed, signed in or not", async () => {
    expect((await call("/api/platform/stores")).status).toBe(401);
    const merchant = await call("/api/platform/stores", token("auth-merchant", fresh));
    expect(merchant.status).toBe(403);
    expect(merchant.body.error.code).toBe("PLATFORM_FORBIDDEN");
  });

  it("needs the authenticator step", async () => {
    const response = await call("/api/platform/stores", token("auth-owner", { aal: "aal1", signedInAt: NOW - 60_000 }));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PLATFORM_MFA_REQUIRED");
  });

  it("needs a sign-in from the last 12 hours", async () => {
    const stale = { aal: "aal2", signedInAt: NOW - 13 * 3600_000, totpAt: NOW - 60_000 };
    const response = await call("/api/platform/stores", token("auth-owner", stale));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PLATFORM_SIGN_IN_AGAIN");
  });
});

describe("readSessionClaims", () => {
  it("ignores the authenticator step when working out the sign-in time", () => {
    expect(readSessionClaims(token("x", { aal: "aal2", signedInAt: NOW - 3600_000, totpAt: NOW }))).toEqual({ aal: "aal2", signedInAt: seconds(NOW - 3600_000) * 1000 });
    expect(readSessionClaims("not-a-token")).toEqual({ aal: null, signedInAt: null });
  });
});
