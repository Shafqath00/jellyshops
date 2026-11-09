import { runtimeStorefrontSnapshotV4Schema, type RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import type { V4StarterPack } from "@jelly/storefront-registry";
import { resolveTheme } from "@jelly/storefront-themes";
import type { Product } from "@/lib/domain";
import type { ThemePreviewConfig } from "./configs";

/**
 * Sample data for the theme previews, shaped exactly like what the live store gets from the API, so the preview
 * builds its pages through the live loader (`resolveStorefrontRoute`) and the live product logic
 * (`createProductPresentationContext`) instead of a hand-made copy. One render path; only the data source differs.
 */
export const PREVIEW_STORE_ID = "theme-preview";

/**
 * The published snapshot a store would have right after installing this starter pack and publishing it: the same
 * structure the backend compiler writes (backend/src/storefront/compiler/snapshot.ts). Templates are keyed by
 * type, global sections by their section id (which is what the starter's placements point at).
 */
export function snapshotFromStarterPack(pack: V4StarterPack, themeId: string, settings: Record<string, unknown> = pack.theme.settings): RuntimeStorefrontSnapshotV4 {
  const theme = resolveTheme(themeId, settings);
  const templates = Object.fromEntries(pack.templates.map((template) => [`template-${template.type}`, { id: `template-${template.type}`, type: template.type, handle: template.handle, layout: structuredClone(template.layout) }]));
  return runtimeStorefrontSnapshotV4Schema.parse({
    schemaVersion: 4,
    storeId: PREVIEW_STORE_ID,
    sourceGeneration: 0,
    compilerVersion: "theme-preview",
    registryManifestHash: "theme-preview",
    theme: { presetId: theme.id, id: theme.id, version: theme.version, settings: structuredClone(theme.settings), artifactId: null },
    templates,
    globalSections: Object.fromEntries(pack.globalSections.map((global) => [global.section.id, { id: global.section.id, section: structuredClone(global.section) }])),
    menus: Object.fromEntries(pack.menus.map((menu) => [`menu-${menu.key}`, { id: `menu-${menu.key}`, handle: menu.handle, items: structuredClone(menu.items) }])),
    templateDefaults: Object.fromEntries(pack.templates.map((template) => [template.type, `template-${template.type}`])),
    assignments: [],
    dependencies: { edges: [] },
  });
}

/** "£28.00" to 2800 (sample prices only). */
export const toMinor = (price: string) => Math.round(Number(price.replace(/[^0-9.]/g, "")) * 100);

/**
 * The preview's sample product as the catalog sends it: one variant per value of its option (a sold-out value has no
 * stock), so the live product logic decides prices, availability and sold-out values.
 */
export function previewCatalogProduct(config: ThemePreviewConfig): Product {
  const sample = config.product;
  const option = sample.option ?? { id: "size", name: "Size", values: [{ id: "s", label: "Small" }, { id: "m", label: "Medium" }, { id: "l", label: "Large", soldOut: true }] };
  const priceMinor = toMinor(sample.price);
  const compareAtPriceMinor = sample.compareAtPrice ? toMinor(sample.compareAtPrice) : undefined;
  return {
    id: sample.id, storeId: PREVIEW_STORE_ID, name: sample.title, slug: "sample-product", description: sample.description, category: "",
    imageUrl: sample.media[0]?.url ?? "", published: true, archived: false, featured: false, vendor: config.name,
    specifications: sample.specifications,
    media: sample.media.map((item, index) => ({ id: `m${index + 1}`, url: item.url, altText: item.alt })),
    inventoryOptionIds: [option.id],
    options: [{ id: option.id, name: option.name, type: "variant", display: "buttons", required: true, position: 0, values: option.values.map((value, index) => ({ id: value.id, label: value.label, priceAdjustmentMinor: 0, position: index })) }],
    variants: option.values.map((value) => ({ id: `${sample.id}-${value.id}`, name: value.label, sku: `${sample.id}-${value.id}`.toUpperCase(), priceMinor, ...(compareAtPriceMinor ? { compareAtPriceMinor } : {}), stock: value.soldOut ? 0 : 10, available: !value.soldOut, options: { [option.id]: value.id } })),
  } as Product;
}
