import { ApiError } from "../http/errors.js";
import type { TenantRepository } from "../tenants/repository.js";
import type { AuthProvider, MerchantPrincipal } from "./types.js";
import type { FirebaseTokenVerifier } from "./firebase-token-verifier.js";

const invalidCredentialCodes = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/tenant-id-mismatch",
  "auth/user-disabled",
]);

function verificationError(error: unknown): ApiError {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  return invalidCredentialCodes.has(code)
    ? new ApiError(401, "AUTH_INVALID", "The merchant token is invalid")
    : new ApiError(503, "AUTH_UNAVAILABLE", "Merchant authentication is temporarily unavailable");
}

export class FirebaseAuthProvider implements AuthProvider {
  constructor(
    private readonly verifier: FirebaseTokenVerifier,
    private readonly tenants: TenantRepository,
  ) {}

  async verify(token: string): Promise<MerchantPrincipal> {
    let claims;
    try {
      claims = await this.verifier.verify(token);
    } catch (error) {
      throw verificationError(error);
    }

    const email = claims.email?.trim().toLowerCase();
    if (!claims.emailVerified || !email) {
      throw new ApiError(
        403,
        "EMAIL_VERIFICATION_REQUIRED",
        "Verify an email address before accessing a merchant account",
      );
    }

    const account = await this.tenants.resolveMerchant({
      uid: claims.uid,
      email,
      name: claims.name?.trim() ?? "",
    });
    const storeRoles = Object.fromEntries(account.stores.map((store) => [store.id, store.role]));
    return {
      merchantId: String(account.id),
      storeIds: account.stores.map((store) => store.id),
      storeRoles,
    };
  }
}
