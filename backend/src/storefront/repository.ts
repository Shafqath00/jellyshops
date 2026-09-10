import { ApiError } from "../http/errors.js";
import type { DraftRecord, PublicationRecord } from "./types.js";

export class DraftConflictError extends ApiError {
  constructor(public readonly currentRevision: number) {
    super(409, "DRAFT_CONFLICT", "The draft was changed by another editor");
  }
}

export interface StorefrontRepository<TDocument = unknown> {
  getDraft(storeId: string): Promise<DraftRecord<TDocument> | null>;
  saveDraft(storeId: string, expectedRevision: number, document: TDocument): Promise<DraftRecord<TDocument>>;
  publish(storeId: string, expectedRevision: number): Promise<PublicationRecord<TDocument>>;
  getPublic(storeId: string): Promise<PublicationRecord<TDocument> | null>;
}
