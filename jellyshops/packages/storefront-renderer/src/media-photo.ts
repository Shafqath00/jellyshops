import { cardPhotoSrcSet } from "@jelly/storefront-ui";

/**
 * `srcSet` and `sizes` for a store photo, so the browser downloads the 320, 640 or 1280px copy that fits where the
 * photo is drawn instead of the original. Nothing for photos not served by the media API (sample and outside images).
 */
export function mediaPhoto(url: string | undefined, sizes: string): { srcSet?: string; sizes?: string } {
  const srcSet = url ? cardPhotoSrcSet(url) : undefined;
  return srcSet ? { srcSet, sizes } : {};
}
