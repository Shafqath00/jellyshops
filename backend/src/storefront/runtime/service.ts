import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { ImmutablePublicationCache } from "./cache.js";

export { ImmutablePublicationCache } from "./cache.js";

export interface CurrentPublicationPointer {
  getCurrentPublicationId(storeId: string): Promise<string | null>;
}

export interface PublishedPublication {
  id: string;
  snapshot: RuntimeStorefrontSnapshotV4;
}

export class StorefrontRuntimeService {
  constructor(
    private readonly pointer: CurrentPublicationPointer,
    private readonly cache: ImmutablePublicationCache,
  ) {}

  async getPublishedPublication(storeId: string): Promise<PublishedPublication | null> {
    const publicationId = await this.pointer.getCurrentPublicationId(storeId);
    if (!publicationId) return null;
    const snapshot = await this.cache.get(publicationId);
    if (!snapshot || snapshot.storeId !== storeId) return null;
    return { id: publicationId, snapshot };
  }

  async getPublishedSnapshot(storeId: string): Promise<RuntimeStorefrontSnapshotV4 | null> {
    return (await this.getPublishedPublication(storeId))?.snapshot ?? null;
  }
}
