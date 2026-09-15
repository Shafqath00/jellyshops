export interface DraftRecord<TDocument = unknown> {
  storeId: string;
  revision: number;
  document: TDocument;
  updatedAt: string;
}

export interface PublicationRecord<TDocument = unknown> {
  id: string;
  storeId: string;
  sourceRevision: number;
  document: TDocument;
  publishedAt: string;
}

export interface StorefrontStoreRecord<TDocument = unknown> {
  storeId: string;
  draft?: DraftRecord<TDocument>;
  publications: PublicationRecord<TDocument>[];
  currentPublicationId?: string;
}
