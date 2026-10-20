import { afterEach, describe, expect, it, vi } from "vitest";

const { createApp } = vi.hoisted(() => ({ createApp: vi.fn(() => () => {}) }));
vi.mock("./app.js", () => ({ createApp }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("Firebase Functions startup", () => {
  it("rejects development auth in a deployed runtime even when NODE_ENV is unset", async () => {
    vi.stubEnv("NODE_ENV", undefined);
    vi.stubEnv("FUNCTIONS_EMULATOR", undefined);
    vi.stubEnv("AUTH_PROVIDER", "development");
    vi.stubEnv("CORS_ORIGINS", "https://jellyshop.example");
    await expect(import("./functions.js")).rejects.toThrow("AUTH_PROVIDER=development");
    expect(createApp).not.toHaveBeenCalled();
  });

  it("loads with Firebase's Windows named pipe without changing the runtime PORT", async () => {
    const pipe = String.raw`\\.\pipe\firebase-functions-test`;
    vi.stubEnv("PORT", pipe);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FUNCTIONS_EMULATOR", "true");
    vi.stubEnv("AUTH_PROVIDER", "development");
    vi.stubEnv("MEDIA_PROVIDER", "local-files");
    for (const name of [
      "STRIPE_SECRET_KEY", "STRIPE_ACCOUNTS_V2_VERSION",
      "STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET", "STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET",
      "SCHEDULER_SECRET",
    ]) vi.stubEnv(name, "");

    const { api } = await import("./functions.js");

    expect(api).toBeTypeOf("function");
    expect(createApp).toHaveBeenCalledWith({ config: expect.objectContaining({ port: 3001 }) });
    expect(process.env.PORT).toBe(pipe);
  });
});
