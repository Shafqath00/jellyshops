import { ApiError } from "../http/errors.js";
import type { AuthProvider, MerchantPrincipal } from "./types.js";

export const DEMO_TOKEN = "jelly-demo-merchant";

export class DevelopmentAuthProvider implements AuthProvider {
  constructor(
    private readonly storeId: string,
    private readonly userId = 0,
  ) {}

  async verify(token: string): Promise<MerchantPrincipal> {
    if (token !== DEMO_TOKEN) {
      throw new ApiError(401, "AUTH_INVALID", "The merchant token is invalid");
    }

    return {
      userId: this.userId,
      storeIds: [this.storeId],
      storeRoles: { [this.storeId]: "OWNER" },
    };
  }
}
