import { ApiError } from "../http/errors.js";
import type { AuthProvider, MerchantPrincipal } from "./types.js";

export const DEMO_TOKEN = "jelly-demo-merchant";

export class DevelopmentAuthProvider implements AuthProvider {
  constructor(private readonly storeId: string) {}

  async verify(token: string): Promise<MerchantPrincipal> {
    if (token !== DEMO_TOKEN) {
      throw new ApiError(401, "AUTH_INVALID", "The merchant token is invalid");
    }

    return {
      merchantId: "merchant-demo",
      storeIds: [this.storeId],
      storeRoles: { [this.storeId]: "OWNER" },
    };
  }
}
