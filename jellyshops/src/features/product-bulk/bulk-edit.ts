import type { CatalogAdminProduct, CatalogAdminVariant } from "@/features/store-editor/api/types";

/**
 * Bulk edit maths: given the chosen products and one change, works out every value before and after,
 * what cannot change and why, and the request to send for each product. Pure, so it can be shown as a
 * preview and tested without a server.
 */
export type BulkChange =
  | { kind: "price"; how: "set" | "raise" | "lower" | "raisePercent" | "lowerPercent"; amount: string }
  | { kind: "compareAt"; how: "set" | "clear"; amount: string }
  | { kind: "stock"; how: "set" | "add" | "take"; amount: string }
  | { kind: "status"; status: "ACTIVE" | "DRAFT" | "ARCHIVED" }
  | { kind: "collection"; how: "add" | "remove"; collectionId: string; collectionTitle: string }
  | { kind: "tags"; how: "add" | "remove"; tags: string }
  | { kind: "vendor"; value: string }
  | { kind: "productType"; value: string };

export interface BulkEditRow { productId: string; product: string; item: string; before: string; after: string; changed: boolean; note?: string }
export interface BulkEditPatch { productId: string; title: string; body: Record<string, unknown> }
export interface BulkEditPlan { error?: string; label: string; rows: BulkEditRow[]; patches: BulkEditPatch[]; changed: number; unchanged: number }

const STATUS_WORD = { ACTIVE: "Active", DRAFT: "Draft", ARCHIVED: "Archived" } as const;

/** "499", "499.50" or "£1,299.50" in minor units; undefined when it is not an amount. */
export function parseAmount(text: string): number | undefined {
  const cleaned = text.trim().replace(/^[£$€₹]\s*/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const minor = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(minor) && minor <= 2_000_000_000 ? minor : undefined;
}

/** A percentage from 0 to 1000 with up to two decimals: "10", "12.5", "10%". */
export function parsePercent(text: string): number | undefined {
  const cleaned = text.trim().replace(/%$/, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return value <= 1000 ? value : undefined;
}

export function parseCount(text: string): number | undefined {
  return /^\d{1,9}$/.test(text.trim()) ? Number(text.trim()) : undefined;
}

/** The new price, rounded to the nearest penny and never below zero. */
export function changePrice(priceMinor: number, how: Extract<BulkChange, { kind: "price" }>["how"], amount: number): number {
  const next = how === "set" ? amount : how === "raise" ? priceMinor + amount : how === "lower" ? priceMinor - amount
    : how === "raisePercent" ? priceMinor * (1 + amount / 100) : priceMinor * (1 - amount / 100);
  return Math.max(0, Math.round(next));
}

/** "oak, Sale, sale" is two tags: the first spelling of each is kept. */
const listTags = (text: string) => { const seen = new Set<string>(); return text.split(",").map((tag) => tag.trim()).filter((tag) => { const key = tag.toLowerCase(); if (!tag || seen.has(key)) return false; seen.add(key); return true; }); };
const itemName = (product: CatalogAdminProduct, variant: CatalogAdminVariant) => product.variants.length > 1 ? variant.title : "";
/** Everything the product update needs for a variant it should otherwise leave alone. */
const keep = (variant: CatalogAdminVariant) => ({ id: variant.id, title: variant.title, sku: variant.sku, priceMinor: variant.priceMinor, compareAtPriceMinor: variant.compareAtPriceMinor ?? null, trackInventory: variant.trackInventory !== false, options: variant.options ?? {} });

export function planBulkEdit(products: CatalogAdminProduct[], change: BulkChange, money: (minor: number) => string): BulkEditPlan {
  const rows: BulkEditRow[] = [];
  const patches: BulkEditPatch[] = [];
  const fail = (error: string, label = ""): BulkEditPlan => ({ error, label, rows: [], patches: [], changed: 0, unchanged: 0 });
  const done = (label: string): BulkEditPlan => ({ label, rows, patches, changed: rows.filter((row) => row.changed).length, unchanged: rows.filter((row) => !row.changed).length });
  const perVariant = (label: string, next: (variant: CatalogAdminVariant) => { before: string; after: string; update?: Record<string, unknown>; note?: string }) => {
    for (const product of products) {
      const variants: Array<Record<string, unknown>> = [];
      for (const variant of product.variants) {
        const result = next(variant);
        const changed = Boolean(result.update) && result.before !== result.after;
        rows.push({ productId: product.id, product: product.title, item: itemName(product, variant), before: result.before, after: changed ? result.after : result.before, changed, note: result.note ?? (changed ? undefined : "No change") });
        if (changed) variants.push({ ...keep(variant), ...result.update });
      }
      if (variants.length) patches.push({ productId: product.id, title: product.title, body: { variants } });
    }
    return done(label);
  };
  const perProduct = (label: string, next: (product: CatalogAdminProduct) => { before: string; after: string; body: Record<string, unknown>; note?: string }) => {
    for (const product of products) {
      const result = next(product);
      const changed = result.before !== result.after;
      rows.push({ productId: product.id, product: product.title, item: "", before: result.before, after: result.after, changed, note: result.note ?? (changed ? undefined : "No change") });
      if (changed) patches.push({ productId: product.id, title: product.title, body: result.body });
    }
    return done(label);
  };

  switch (change.kind) {
    case "price": {
      const percent = change.how === "raisePercent" || change.how === "lowerPercent";
      const amount = percent ? parsePercent(change.amount) : parseAmount(change.amount);
      if (amount === undefined) return fail(percent ? "Enter a percentage, like 10 or 12.5." : "Enter an amount, like 499 or 499.50.");
      return perVariant("Price", (variant) => {
        const after = changePrice(variant.priceMinor, change.how, amount);
        return { before: money(variant.priceMinor), after: money(after), update: { priceMinor: after }, note: change.how !== "set" && after === 0 && variant.priceMinor > 0 ? "Would drop to 0" : undefined };
      });
    }
    case "compareAt": {
      const amount = change.how === "clear" ? null : parseAmount(change.amount);
      if (amount === undefined) return fail("Enter an amount, like 599 or 599.50.");
      return perVariant("Compare-at price", (variant) => ({ before: variant.compareAtPriceMinor ? money(variant.compareAtPriceMinor) : "None", after: amount ? money(amount) : "None", update: { compareAtPriceMinor: amount || null } }));
    }
    case "stock": {
      const amount = parseCount(change.amount);
      if (amount === undefined) return fail("Enter a whole number, 0 or more.");
      return perVariant("Stock", (variant) => {
        if (variant.trackInventory === false) return { before: "Not tracked", after: "Not tracked", note: "Stock is not tracked for this item" };
        const before = variant.quantity ?? 0;
        const after = Math.max(0, change.how === "set" ? amount : change.how === "add" ? before + amount : before - amount);
        return { before: String(before), after: String(after), update: { quantity: after, trackInventory: true }, note: change.how === "take" && before - amount < 0 ? "Cannot go below 0" : undefined };
      });
    }
    case "status":
      return perProduct("Status", (product) => ({ before: STATUS_WORD[product.status], after: STATUS_WORD[change.status], body: { status: change.status } }));
    case "collection": {
      if (!change.collectionId) return fail("Choose a collection.");
      return perProduct(`Collection: ${change.collectionTitle}`, (product) => {
        const current = product.collectionIds ?? [];
        const inside = current.includes(change.collectionId);
        const next = change.how === "add" ? (inside ? current : [...current, change.collectionId]) : current.filter((id) => id !== change.collectionId);
        return { before: inside ? "In collection" : "Not in collection", after: change.how === "add" ? "In collection" : "Not in collection", body: { collectionIds: next } };
      });
    }
    case "tags": {
      const tags = listTags(change.tags);
      if (!tags.length) return fail("Type at least one tag. Separate several with commas.");
      return perProduct("Tags", (product) => {
        const current = product.tags ?? [];
        const lower = new Set(tags.map((tag) => tag.toLowerCase()));
        const next = change.how === "add" ? [...current, ...tags.filter((tag) => !current.some((existing) => existing.toLowerCase() === tag.toLowerCase()))] : current.filter((tag) => !lower.has(tag.toLowerCase()));
        if (next.length > 50) return { before: current.join(", ") || "None", after: current.join(", ") || "None", body: {}, note: "Would have more than 50 tags" };
        return { before: current.join(", ") || "None", after: next.join(", ") || "None", body: { tags: next } };
      });
    }
    case "vendor":
      return perProduct("Brand", (product) => ({ before: product.vendor || "None", after: change.value.trim() || "None", body: { vendor: change.value.trim() || null } }));
    case "productType":
      return perProduct("Type", (product) => ({ before: product.productType || "None", after: change.value.trim() || "None", body: { productType: change.value.trim() || null } }));
  }
}
