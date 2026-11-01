import { validateMediaAssignments, type ProductOptionLike } from "@jelly/storefront-schema";
import { ApiError } from "../http/errors.js";
import type { CatalogMediaInput, CreateProductInput, UpdateProductInput } from "./types.js";

export function assertMediaInput(input: CreateProductInput | UpdateProductInput): void {
  if (input.imageUrl !== undefined && input.media !== undefined) throw new ApiError(422, "MEDIA_INPUT_INVALID", "Send either imageUrl or media, not both.");
}

export function assertGalleryAssignments(items: CatalogMediaInput[], options: unknown[]): void {
  if (items.length > 30) throw new ApiError(422, "MEDIA_LIMIT_EXCEEDED", "A product can have at most 30 photos.");
  if (new Set(items.map(item => item.mediaId)).size !== items.length) throw new ApiError(422, "MEDIA_DUPLICATE", "A photo can only appear once in a product gallery.");
  const [issue] = validateMediaAssignments(items.map(item => ({ ...item, altText: item.altText ?? undefined })), options as ProductOptionLike[]);
  if (issue) throw new ApiError(422, "MEDIA_ASSIGNMENT_INVALID", issue.message);
}
