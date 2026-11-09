import { formatMoney, type Currency, type Product } from "@/lib/domain";
import { isVariantBuyable } from "@/lib/variant-stock";

/** One product as the compare tray and page show it. */
export type CompareItem = { id: string; name: string; href: string; imageUrl: string; price: string; vendor?: string; available: boolean; specifications?: Record<string, string> };
export type CompareRow = { label: string; values: string[]; differs: boolean };

export function compareItem(product: Product, storeSlug: string, currency: Currency): CompareItem {
  return {
    id: product.id,
    name: product.name,
    href: `/${storeSlug}/products/${product.slug}`,
    imageUrl: product.imageUrl,
    price: formatMoney(product.variants[0]?.priceMinor ?? 0, currency),
    vendor: product.vendor?.trim() || undefined,
    available: product.variants.some(isVariantBuyable),
    specifications: product.specifications,
  };
}

const MISSING = "–";
const same = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The rows of the compare page: price, brand and stock first, then every specification any of the products has, in
 * the order it first appears (names matched without regard to capitals). A product without a specification shows a
 * dash. `differs` marks rows whose values are not all the same, so shoppers can see what sets products apart.
 */
export function compareRows(items: CompareItem[]): CompareRow[] {
  const row = (label: string, values: string[]): CompareRow => ({ label, values, differs: new Set(values.map(same)).size > 1 });
  const rows: CompareRow[] = [row("Price", items.map((item) => item.price))];
  if (items.some((item) => item.vendor)) rows.push(row("Brand", items.map((item) => item.vendor || MISSING)));
  rows.push(row("Availability", items.map((item) => item.available ? "In stock" : "Sold out")));
  const labels = new Map<string, string>();
  for (const item of items) {
    for (const label of Object.keys(item.specifications ?? {})) {
      const name = label.trim();
      if (name && !labels.has(same(name))) labels.set(same(name), name);
    }
  }
  for (const [match, label] of labels) {
    rows.push(row(label, items.map((item) => {
      const entry = Object.entries(item.specifications ?? {}).find(([name]) => same(name) === match);
      return entry?.[1]?.trim() || MISSING;
    })));
  }
  return rows;
}
