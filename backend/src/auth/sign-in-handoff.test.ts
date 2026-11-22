import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { ApiError, errorHandler } from "../http/errors.js";
import { createHandoffLimiter, createSignInHandoffRouter, supabaseHandoffTokenMaker, type HandoffTokenMaker } from "./sign-in-handoff.js";
import type { AuthProvider, MerchantPrincipal } from "./types.js";

const merchant: MerchantPrincipal = { userId: "user-1", email: "owner@example.test", storeIds: ["store-a"], storeRoles: { "store-a": "OWNER" } };
const provider = (principal: MerchantPrincipal = merchant): AuthProvider => ({
  verify: vi.fn(async (token: string) => {
    if (token !== "good") throw new ApiError(401, "AUTH_INVALID", "Merchant authentication is required");
    return principal;
  }),
});

function app(makeToken: HandoffTokenMaker | null, principal?: MerchantPrincipal, allow?: (userId: string) => boolean) {
  const server = express();
  server.use(express.json());
  server.use("/api/auth/handoff", createSignInHandoffRouter(provider(principal), makeToken, allow));
  server.use(errorHandler);
  return server;
}

describe("POST /api/auth/handoff", () => {
  it("gives a signed-in merchant a one-time token for their own email", async () => {
    const makeToken = vi.fn(async () => "hashed-123");
    const response = await request(app(makeToken)).post("/api/auth/handoff").set("Authorization", "Bearer good").send({});
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tokenHash: "hashed-123" });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(makeToken).toHaveBeenCalledWith("owner@example.test");
  });

  it("refuses without a valid sign-in", async () => {
    const makeToken = vi.fn(async () => "hashed-123");
    expect((await request(app(makeToken)).post("/api/auth/handoff").send({})).status).toBe(401);
    expect((await request(app(makeToken)).post("/api/auth/handoff").set("Authorization", "Bearer forged").send({})).status).toBe(401);
    expect(makeToken).not.toHaveBeenCalled();
  });

  it("explains when it isn't set up, the account has no email, or Supabase fails", async () => {
    expect((await request(app(null)).post("/api/auth/handoff").set("Authorization", "Bearer good")).status).toBe(503);
    const noEmail = await request(app(vi.fn(async () => "x"), { ...merchant, email: undefined })).post("/api/auth/handoff").set("Authorization", "Bearer good");
    expect(noEmail.status).toBe(400);
    const failing = await request(app(vi.fn(async () => { throw new Error("down"); }))).post("/api/auth/handoff").set("Authorization", "Bearer good");
    expect(failing.status).toBe(502);
    expect(failing.body.error.code).toBe("HANDOFF_FAILED");
  });

  it("limits how often one merchant can ask", async () => {
    const allow = vi.fn(() => false);
    const response = await request(app(vi.fn(async () => "x"), merchant, allow)).post("/api/auth/handoff").set("Authorization", "Bearer good");
    expect(response.status).toBe(429);
  });
});

describe("createHandoffLimiter", () => {
  it("allows 10 a merchant per 10 minutes", () => {
    let now = 0;
    const allow = createHandoffLimiter(() => now);
    for (let i = 0; i < 10; i += 1) expect(allow("user-1")).toBe(true);
    expect(allow("user-1")).toBe(false);
    expect(allow("user-2")).toBe(true);
    now = 10 * 60_000;
    expect(allow("user-1")).toBe(true);
  });
});

describe("supabaseHandoffTokenMaker", () => {
  it("asks Supabase's admin API for a magic-link token and sends no email", async () => {
    const fetch = vi.fn(async () => Response.json({ hashed_token: "abc", action_link: "https://x" }));
    const make = supabaseHandoffTokenMaker({ url: "https://project.supabase.co/", secretKey: "secret", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await make("owner@example.test")).toBe("abc");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/admin/generate_link");
    expect(JSON.parse(String(init.body))).toEqual({ type: "magiclink", email: "owner@example.test" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it("also reads the token from the properties shape and fails on errors", async () => {
    const nested = supabaseHandoffTokenMaker({ url: "https://p", secretKey: "s", fetch: (async () => Response.json({ properties: { hashed_token: "def" } })) as unknown as typeof fetch });
    expect(await nested("a@b.test")).toBe("def");
    const failing = supabaseHandoffTokenMaker({ url: "https://p", secretKey: "s", fetch: (async () => new Response("no", { status: 422 })) as unknown as typeof fetch });
    await expect(failing("a@b.test")).rejects.toThrow();
  });
});
