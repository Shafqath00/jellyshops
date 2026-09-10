export type StoreRole = "OWNER" | "ADMIN" | "DESIGNER" | "ORDER_MANAGER" | "STAFF";

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
  id: number;
  stores: StoreSummary[];
}

export interface CreateStoreInput {
  name: string;
  slug: string;
  currency: string;
  country: string;
}
