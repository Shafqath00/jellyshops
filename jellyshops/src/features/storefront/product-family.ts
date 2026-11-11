import type { ProductPresentationContext } from "@jelly/storefront-renderer";
import type { Product } from "@/lib/domain";
import { productCardSwatches } from "./product-card-data";

/** Tags written `family:ascot` link products that are the same design in different colours. */
const FAMILY_TAG = /^family:\s*(.+)$/i;
/** `Colour:Natural` (or `Color:`) names a product's colour within its family. */
const COLOUR_TAG = /^colou?r:\s*(.+)$/i;

export function productFamilyName(product: Pick<Product, "tags">): string | undefined {
  for (const tag of product.tags ?? []) {
    const name = FAMILY_TAG.exec(tag.trim())?.[1]?.trim();
    if (name) return name.toLowerCase();
  }
  return undefined;
}

function colourName(product: Product): string {
  for (const tag of product.tags ?? []) {
    const name = COLOUR_TAG.exec(tag.trim())?.[1]?.trim();
    if (name) return name.slice(0, 40);
  }
  const option = [...(product.options ?? [])].sort((a, b) => a.position - b.position).find((item) => /colou?r/i.test(item.name) || item.display === "color");
  return option?.values[0]?.label ?? product.name;
}

/**
 * The family a product belongs to: every published product with the same `family:` tag, in name order, each with its
 * colour name, a colour dot or swatch photo (or its own photo), and a link. Undefined when the product has no family
 * or is alone in it. At most 24 members.
 */
export function productFamily(product: Product, products: readonly Product[], storeSlug: string): ProductPresentationContext["family"] {
  const name = productFamilyName(product);
  if (!name) return undefined;
  const members = products
    .filter((item) => item.storeId === product.storeId && (item.id === product.id || (item.published && !item.archived)) && productFamilyName(item) === name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 24)
    .map((item) => {
      const swatch = productCardSwatches(item).swatches?.[0];
      return {
        id: item.id,
        label: colourName(item),
        href: `/${storeSlug}/products/${item.slug}`,
        current: item.id === product.id,
        ...(swatch?.color ? { color: swatch.color } : swatch?.image ? { image: swatch.image } : item.imageUrl ? { image: item.imageUrl } : {}),
      };
    });
  return members.length > 1 ? { label: "Colour", members } : undefined;
}
