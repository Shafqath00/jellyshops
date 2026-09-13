import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { ImmutablePublicationCache } from "./cache.js";

export { ImmutablePublicationCache } from "./cache.js";

export interface CurrentPublicationPointer {
  getCurrentPublicationId(storeId: string): Promise<string | null>;
}

export class StorefrontRuntimeService {
  constructor(
    private readonly pointer: CurrentPublicationPointer,
    private readonly cache: ImmutablePublicationCache,
  ) {}

  async getPublishedSnapshot(storeId: string): Promise<RuntimeStorefrontSnapshotV4 | null> {
    const publicationId = await this.pointer.getCurrentPublicationId(storeId);
    if (!publicationId) return null;
    const snapshot = await this.cache.get(publicationId);
    if (!snapshot) return null;
    if (snapshot.storeId !== storeId) {
      throw new Error("Published storefront snapshot belongs to another store");
    }
    return snapshot;
  }
}
