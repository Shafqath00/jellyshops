import type {
  CreateStoreInput,
  MerchantAccount,
  StoreSummary,
  VerifiedMerchantIdentity,
} from "./types.js";

export interface TenantRepository {
  resolveMerchant(identity: VerifiedMerchantIdentity): Promise<MerchantAccount>;
  listStores(userId: number): Promise<StoreSummary[]>;
  createStore(userId: number, input: CreateStoreInput): Promise<StoreSummary>;
}
