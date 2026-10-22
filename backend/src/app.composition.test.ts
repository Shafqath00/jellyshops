import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { AppConfig } from "./config.js";
import type { OrderRuntime } from "./commerce/order-runtime.js";
import type { SqlExecutor } from "./commerce/repository.js";
import type { StripeAccountService } from "./stripe/accounts/service.js";
import type { StripeGateway } from "./stripe/client.js";

async function config(): Promise<AppConfig> {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-composition-"));
  return {
    port: 3001,
    nodeEnv: "test",
    corsOrigins: ["http://localhost:3000"],
    trustProxy: false,
    authProvider: "development",
    mediaProvider: "local-files",
    dataDirectory: directory,
    uploadDirectory: path.join(directory, "uploads"),
    maxUploadBytes: 1024 * 1024,
    demoStoreId: "store-demo",
  };
}

describe("application composition contracts", () => {
  it.each(["accounts-v2", "connect-payments"] as const)(
    "preserves raw webhook bytes through createApp for %s",
    async (destination) => {
      const constructEvent = vi.fn((_destination: string, _payload: Buffer, _signature: string) => {
        throw new Error("invalid signature");
      });
      const query = vi.fn();
      const app = createApp({
        config: await config(),
        stripeGateway: { constructEvent } as unknown as StripeGateway,
        stripeAccountService: {} as StripeAccountService,
        webhookSql: { query } as SqlExecutor,
      });
      const payload = '{ "id": "evt_probe" }';
      const response = await request(app)
        .post(`/webhooks/stripe/${destination}`)
        .set("content-type", "application/json")
        .set("stripe-signature", "probe-signature")
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: "STRIPE_WEBHOOK_INVALID" } });
      expect(constructEvent).toHaveBeenCalledExactlyOnceWith(
        destination, Buffer.from(payload), "probe-signature",
      );
      expect(Buffer.isBuffer(constructEvent.mock.calls[0][1])).toBe(true);
      expect(query).not.toHaveBeenCalled();
    },
  );

  it("shares the configured pool across app instances", async () => {
    const original = process.env.SUPABASE_DATABASE_URL;
    process.env.SUPABASE_DATABASE_URL = "postgresql://composition-test";
    const createSupabasePool = vi.fn(() => ({ query: vi.fn() }));
    vi.resetModules();
    vi.doMock("./database/client.js", () => ({ createSupabasePool }));
    try {
      const { createApp: configuredApp } = await import("./app.js");
      const options = { config: await config(), storefrontSql: null };
      const first = configuredApp(options);
      const second = configuredApp(options);
      expect((await request(first).get("/health")).body).toEqual({ ok: true });
      expect((await request(second).get("/health")).body).toEqual({ ok: true });
      expect(createSupabasePool).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock("./database/client.js");
      vi.resetModules();
      if (original === undefined) delete process.env.SUPABASE_DATABASE_URL;
      else process.env.SUPABASE_DATABASE_URL = original;
    }
  });

  it("exposes injected order workers on app.locals", async () => {
    const runWorkers = vi.fn();
    const app = createApp({
      config: await config(),
      orderRuntime: { runWorkers } as unknown as OrderRuntime,
    });
    expect(app.locals.runOrderWorkers).toBe(runWorkers);
  });
});
