import type { StorefrontDocument } from "@jelly/storefront-schema";

export interface DraftRecord { storeId: string; revision: number; document: StorefrontDocument; updatedAt: string }
export interface PublicationRecord { id: string; storeId: string; sourceRevision: number; document: StorefrontDocument; publishedAt: string }
export interface MediaRecord { id: string; storeId: string; url: string; mimeType: string; byteSize: number; width: number; height: number; originalName: string; referenced: boolean; createdAt: string }
export interface DemoProduct { id: string; slug: string; name: string; imageUrl: string; priceMinor: number; currency: "USD" }
export interface DemoCollection { id: string; slug: string; name: string; imageUrl: string; productIds: string[] }
export interface DemoCatalog { products: DemoProduct[]; collections: DemoCollection[] }
export interface ApiIssue { path: string; message: string }

export class StoreEditorApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: ApiIssue[],
    public readonly currentRevision?: number,
  ) { super(message); }
}
