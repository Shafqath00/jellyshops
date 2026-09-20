export type StoreRole = "OWNER" | "ADMIN" | "DESIGNER" | "DEVELOPER" | "ORDER_MANAGER" | "STAFF";

export interface VerifiedMerchantIdentity {
  uid: string;
  email: string;
  name: string;
}

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  currency: string;
  country: string;
  role: StoreRole;
}

export interface MerchantAccount {
  id: string;
  stores: StoreSummary[];
}

export interface CreateStoreInput {
  name: string;
  slug: string;
  currency: string;
  country: string;
}
