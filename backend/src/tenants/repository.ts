import type {
  CreateStoreInput,
  MerchantAccount,
  StoreSummary,
  VerifiedMerchantIdentity,
} from "./types.js";

export interface TenantRepository {
  resolveMerchant(identity: VerifiedMerchantIdentity): Promise<MerchantAccount>;
  listStores(userId: string): Promise<StoreSummary[]>;
  createStore(userId: string, input: CreateStoreInput): Promise<StoreSummary>;
}
