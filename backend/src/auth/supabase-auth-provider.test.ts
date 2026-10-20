import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantRepository } from "../tenants/repository.js";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth })),
}));

import { SupabaseAuthProvider } from "./supabase-auth-provider.js";

describe("Supabase merchant authentication", () => {
  const tenants = {
    resolveMerchant: vi.fn(),
  } as unknown as TenantRepository;
  const provider = new SupabaseAuthProvider(
    "https://project.supabase.co",
    "publishable-key",
    tenants,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns 401 only when Supabase rejects the access token", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Invalid token") });

    await expect(provider.verify("bad-token")).rejects.toMatchObject({
      status: 401,
      code: "AUTH_INVALID",
    });
    expect(tenants.resolveMerchant).not.toHaveBeenCalled();
  });

  it("reports merchant database failures as service unavailable instead of invalid auth", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "merchant-1", email: "merchant@example.com", user_metadata: {} } },
      error: null,
    });
    tenants.resolveMerchant.mockRejectedValue(Object.assign(new Error("certificate failure"), {
      code: "SELF_SIGNED_CERT_IN_CHAIN",
    }));

    await expect(provider.verify("valid-token")).rejects.toMatchObject({
      status: 503,
      code: "MERCHANT_DATA_UNAVAILABLE",
    });
  });
});
