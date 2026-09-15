import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";

export interface PublicationSnapshotLoader {
  loadPublication(publicationId: string): Promise<RuntimeStorefrontSnapshotV4 | null>;
}

export class ImmutablePublicationCache {
  private readonly entries = new Map<string, Promise<RuntimeStorefrontSnapshotV4 | null>>();

  constructor(private readonly loader: PublicationSnapshotLoader | ((publicationId: string) => Promise<RuntimeStorefrontSnapshotV4 | null>)) {}

  get(publicationId: string): Promise<RuntimeStorefrontSnapshotV4 | null> {
    const current = this.entries.get(publicationId);
    if (current) return current;

    const load = typeof this.loader === "function"
      ? this.loader(publicationId)
      : this.loader.loadPublication(publicationId);
    const guarded = load.catch((error) => {
      this.entries.delete(publicationId);
      throw error;
    });
    this.entries.set(publicationId, guarded);
    return guarded;
  }

  clear(): void {
    this.entries.clear();
  }
}
