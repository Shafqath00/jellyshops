/**
 * Direct addresses of stored photos on the public photo domain (`MEDIA_PUBLIC_BASE`, e.g. https://img.jellycdn.net),
 * so shoppers load photos from the CDN instead of through the API. Keys are the storage keys
 * (`<storeId>/<mediaId>.<ext>`, copies `<key>.w640.webp`).
 */
export const LEGACY_COPY_WIDTHS = [320, 640, 1280] as const;

export function mediaPublicUrl(base: string | undefined, storageKey: string | null | undefined): string | undefined {
  if (!base || !storageKey) return undefined;
  // Local file storage on Windows records keys with backslashes; the public address always uses slashes.
  return `${base.replace(/\/$/, "")}/${storageKey.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

/** Copy widths a photo has: the recorded list, else the three sizes every hashed upload got before widths were recorded. */
export function knownCopyWidths(record: { variantWidths?: number[] | null; contentHash?: string | null }): readonly number[] {
  if (record.variantWidths?.length) return record.variantWidths;
  return record.contentHash ? LEGACY_COPY_WIDTHS : [];
}

/** The copy to serve for a requested width: the next larger one, else the largest smaller one; undefined = the original. */
export function chooseCopyWidth(widths: readonly number[], requested: number | undefined): number | undefined {
  if (!requested || !widths.length) return undefined;
  const sorted = [...widths].sort((a, b) => a - b);
  return sorted.find((width) => width >= requested) ?? sorted[sorted.length - 1];
}
