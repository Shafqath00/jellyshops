import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../http/errors.js";
import type { TenantRepository } from "../tenants/repository.js";
import { FirebaseAuthProvider } from "./firebase-auth-provider.js";
import type { FirebaseTokenVerifier } from "./firebase-token-verifier.js";

function setup() {
  const verifier: FirebaseTokenVerifier = { verify: vi.fn() };
  const tenants: TenantRepository = {
    resolveMerchant: vi.fn(),
    listStores: vi.fn(),
    createStore: vi.fn(),
  };
  return { verifier, tenants, provider: new FirebaseAuthProvider(verifier, tenants) };
}

describe("FirebaseAuthProvider", () => {
  it("normalizes verified identity and builds access only from memberships", async () => {
    const { verifier, tenants, provider } = setup();
    vi.mocked(verifier.verify).mockResolvedValue({
      uid: "firebase-123",
      email: "  Merchant@Example.Test ",
      emailVerified: true,
      name: "  Merchant Name  ",
    });
    vi.mocked(tenants.resolveMerchant).mockResolvedValue({
      id: 42,
      stores: [
        { id: "store-a", name: "A", slug: "a-store", currency: "USD", country: "US", role: "ADMIN" },
        { id: "store-b", name: "B", slug: "b-store", currency: "EUR", country: "DE", role: "STAFF" },
      ],
    });

    await expect(provider.verify("client-id-token")).resolves.toEqual({
      merchantId: "42",
      storeIds: ["store-a", "store-b"],
      storeRoles: { "store-a": "ADMIN", "store-b": "STAFF" },
    });
    expect(tenants.resolveMerchant).toHaveBeenCalledWith({
      uid: "firebase-123",
      email: "merchant@example.test",
      name: "Merchant Name",
    });
  });

  it.each([
    { uid: "no-email", emailVerified: true },
    { uid: "not-verified", email: "person@example.test", emailVerified: false },
  ])("requires a verified email before repository access", async (claims) => {
    const { verifier, tenants, provider } = setup();
    vi.mocked(verifier.verify).mockResolvedValue(claims);

    await expect(provider.verify("token")).rejects.toMatchObject<ApiError>({
      status: 403,
      code: "EMAIL_VERIFICATION_REQUIRED",
    });
    expect(tenants.resolveMerchant).not.toHaveBeenCalled();
  });

  it.each([
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/user-disabled",
  ])("maps rejected credentials (%s) to AUTH_INVALID", async (code) => {
    const { verifier, tenants, provider } = setup();
    vi.mocked(verifier.verify).mockRejectedValue(Object.assign(new Error("sdk detail"), { code }));

    await expect(provider.verify("bad-token")).rejects.toMatchObject<ApiError>({
      status: 401,
      code: "AUTH_INVALID",
    });
    expect(tenants.resolveMerchant).not.toHaveBeenCalled();
  });

  it("maps verifier infrastructure failures to AUTH_UNAVAILABLE", async () => {
    const { verifier, tenants, provider } = setup();
    vi.mocked(verifier.verify).mockRejectedValue(Object.assign(new Error("network detail"), {
      code: "app/invalid-credential",
    }));

    await expect(provider.verify("token")).rejects.toMatchObject<ApiError>({
      status: 503,
      code: "AUTH_UNAVAILABLE",
    });
    expect(tenants.resolveMerchant).not.toHaveBeenCalled();
  });

  it("does not turn repository failures into authentication failures", async () => {
    const { verifier, tenants, provider } = setup();
    vi.mocked(verifier.verify).mockResolvedValue({
      uid: "firebase-db",
      email: "db@example.test",
      emailVerified: true,
    });
    vi.mocked(tenants.resolveMerchant).mockRejectedValue(
      new ApiError(409, "ACCOUNT_LINK_REQUIRED", "Link required"),
    );

    await expect(provider.verify("token")).rejects.toMatchObject<ApiError>({
      status: 409,
      code: "ACCOUNT_LINK_REQUIRED",
    });
  });

  it("refreshes membership access on every verified request", async () => {
    const { verifier, tenants, provider } = setup();
    vi.mocked(verifier.verify).mockResolvedValue({
      uid: "firebase-refresh",
      email: "refresh@example.test",
      emailVerified: true,
    });
    vi.mocked(tenants.resolveMerchant)
      .mockResolvedValueOnce({
        id: 9,
        stores: [{
          id: "removed-store",
          name: "Removed",
          slug: "removed-store",
          currency: "USD",
          country: "US",
          role: "OWNER",
        }],
      })
      .mockResolvedValueOnce({ id: 9, stores: [] });

    await expect(provider.verify("token-one")).resolves.toMatchObject({ storeIds: ["removed-store"] });
    await expect(provider.verify("token-two")).resolves.toEqual({
      merchantId: "9",
      storeIds: [],
      storeRoles: {},
    });
    expect(tenants.resolveMerchant).toHaveBeenCalledTimes(2);
  });
});
