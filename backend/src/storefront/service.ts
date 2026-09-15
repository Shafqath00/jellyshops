import { ApiError } from "../http/errors.js";
import type { StorefrontRepository } from "./repository.js";
import type { DraftRecord, PublicationRecord } from "./types.js";

export interface DocumentValidator<TDocument> {
  parse(input: unknown, storeId: string): TDocument;
}

export interface StorefrontService<TDocument> {
  getOrCreateDraft(storeId: string): Promise<DraftRecord<TDocument>>;
  saveDraft(storeId: string, expectedRevision: number, document: unknown): Promise<DraftRecord<TDocument>>;
  publish(storeId: string, expectedRevision: number): Promise<PublicationRecord<TDocument>>;
  getPublic(storeId: string): Promise<PublicationRecord<TDocument> | null>;
}

export class DefaultStorefrontService<TDocument> implements StorefrontService<TDocument> {
  constructor(
    private readonly repository: StorefrontRepository<TDocument>,
    private readonly validator: DocumentValidator<TDocument>,
    private readonly createDefault: (storeId: string) => TDocument,
  ) {}

  async getOrCreateDraft(storeId: string): Promise<DraftRecord<TDocument>> {
    return await this.repository.getDraft(storeId) ?? {
      storeId,
      revision: 0,
      document: this.createDefault(storeId),
      updatedAt: new Date(0).toISOString(),
    };
  }

  async saveDraft(storeId: string, expectedRevision: number, document: unknown): Promise<DraftRecord<TDocument>> {
    let parsed: TDocument;
    try {
      parsed = this.validator.parse(document, storeId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, "DOCUMENT_INVALID", "The storefront document is invalid");
    }
    return this.repository.saveDraft(storeId, expectedRevision, parsed);
  }

  publish(storeId: string, expectedRevision: number): Promise<PublicationRecord<TDocument>> {
    return this.repository.publish(storeId, expectedRevision);
  }

  getPublic(storeId: string): Promise<PublicationRecord<TDocument> | null> {
    return this.repository.getPublic(storeId);
  }
}
