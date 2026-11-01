/** Search engines show roughly this much before cutting a title or description off. */
export const TITLE_RECOMMENDED_MAX = 60;
export const DESCRIPTION_RECOMMENDED_MIN = 70;
export const DESCRIPTION_RECOMMENDED_MAX = 160;
/** What the server stores. */
export const TITLE_LIMIT = 255;
export const DESCRIPTION_LIMIT = 500;

/** Collapses whitespace and cuts at a word boundary with an ellipsis, so a long description still reads well. */
export function truncateForMeta(text: string, max = DESCRIPTION_RECOMMENDED_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!-]+$/, "")}…`;
}

type TitleSource = { name: string; seoTitle?: string | null };
type DescriptionSource = { description: string; seoDescription?: string | null };

/** The page title: what the seller wrote, or the product name followed by the store name. */
export function productMetaTitle(product: TitleSource, storeName: string): string {
  const custom = product.seoTitle?.trim();
  return custom || (storeName ? `${product.name} · ${storeName}` : product.name);
}

/** The title used on social cards: what the seller wrote, or just the product name. */
export function productSocialTitle(product: TitleSource): string {
  return product.seoTitle?.trim() || product.name;
}

/** The page description: what the seller wrote, or the start of the product description. */
export function productMetaDescription(product: DescriptionSource): string {
  const custom = product.seoDescription?.trim();
  return custom || truncateForMeta(product.description);
}

export type Advice = { level: "good" | "warning"; message: string };

/** Plain-language guidance for a page title as typed. Never blocks saving. */
export function titleAdvice(text: string): Advice | null {
  const length = text.trim().length;
  if (length === 0) return null;
  if (length > TITLE_RECOMMENDED_MAX) return { level: "warning", message: `Search results usually cut titles off after about ${TITLE_RECOMMENDED_MAX} characters.` };
  return { level: "good", message: "A good length." };
}

export function descriptionAdvice(text: string): Advice | null {
  const length = text.trim().length;
  if (length === 0) return null;
  if (length > DESCRIPTION_RECOMMENDED_MAX) return { level: "warning", message: `Search results usually cut descriptions off after about ${DESCRIPTION_RECOMMENDED_MAX} characters.` };
  if (length < DESCRIPTION_RECOMMENDED_MIN) return { level: "warning", message: `Aim for at least ${DESCRIPTION_RECOMMENDED_MIN} characters so search engines have something useful to show.` };
  return { level: "good", message: "A good length." };
}
