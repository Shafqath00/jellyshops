import { describe, expect, it, vi } from "vitest";
import type { DynamicBinding, RuntimeStorefrontSnapshotV4, SectionNode } from "@jelly/storefront-schema";
import { createBindingValueLoader } from "./binding-values-api";
import { applyBindingValues, bindingKey, collectLayoutBindings, displayValue } from "./dynamic-settings";
import { expandRuntimeLayout, resolveStorefrontRoute } from "./resource-loader";

const firmness: DynamicBinding = { kind: "metafield", resource: "product", namespace: "details", key: "firmness" };
const storeName: DynamicBinding = { kind: "resource_field", resource: "store", field: "name" };
const swatch: DynamicBinding = { kind: "metafield", resource: "product", namespace: "details", key: "swatch" };
const dynamic = (binding: DynamicBinding, fallback?: unknown) => ({ kind: "dynamic", binding, ...(fallback !== undefined ? { fallback } : {}) });

const hero: SectionNode = {
  id: "hero", type: "image-banner", enabled: true,
  settings: { heading: dynamic(firmness, "Comfort you can choose"), text: { kind: "static", value: "Hand made" }, image: dynamic(swatch), overlay: 30 },
  blocks: [{ id: "b", type: "button", enabled: true, settings: { label: dynamic(storeName) } }],
};
const layout = { announcement: [], header: [], template: [hero], footer: [] as SectionNode[] };

describe("custom-field settings", () => {
  it("collects each binding once, ignoring property order", () => {
    const reordered = { namespace: "details", key: "firmness", resource: "product", kind: "metafield" } as DynamicBinding;
    const twice = { ...layout, footer: [{ ...hero, id: "copy", settings: { heading: dynamic(reordered) }, blocks: [] }] };
    expect(collectLayoutBindings(twice)).toEqual([firmness, swatch, storeName]);
    expect(bindingKey(reordered)).toBe(bindingKey(firmness));
  });

  it("swaps in looked-up values shaped for each control and keeps other settings", () => {
    const values = new Map<string, unknown>([
      [bindingKey(firmness), "Medium firm"],
      [bindingKey(swatch), { url: "https://api.example/api/public/media/s/oak", alt: "Oak" }],
      [bindingKey(storeName), "Jelly Beds"],
    ]);
    const [section] = applyBindingValues(layout, values).template;

    expect(section.settings).toEqual({ heading: "Medium firm", text: "Hand made", image: { url: "https://api.example/api/public/media/s/oak", alt: "Oak" }, overlay: 30 });
    expect(section.blocks[0].settings).toEqual({ label: "Jelly Beds" });
    expect(hero.settings.heading).toEqual(dynamic(firmness, "Comfort you can choose"));
  });

  it("uses the merchant's fallback, or leaves the setting out, when there is no value", () => {
    const [section] = applyBindingValues(layout, new Map()).template;
    expect(section.settings).toEqual({ heading: "Comfort you can choose", text: "Hand made", overlay: 30 });
    expect(section.blocks[0].settings).toEqual({});
  });

  it("formats numbers, yes/no, money and lists as text, and plain text as rich text", () => {
    expect(displayValue(42, "text")).toBe("42");
    expect(displayValue(false, "textarea")).toBe("No");
    expect(displayValue({ amountMinor: 129900, currency: "GBP" }, "text")).toBe("£1,299.00");
    expect(displayValue(["Oak", "", "Ash"], "text")).toBe("Oak, Ash");
    expect(displayValue("   ", "text")).toBeUndefined();
    expect(displayValue("First line\nsecond\n\nNew paragraph", "rich-text")).toEqual({ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "First line" }, { type: "hardBreak" }, { type: "text", text: "second" }] },
      { type: "paragraph", content: [{ type: "text", text: "New paragraph" }] },
    ] });
    expect(displayValue([{ url: "/a.jpg" }, { url: "/b.jpg" }], "image")).toEqual({ url: "/a.jpg" });
    expect(displayValue({ url: "https://maps.example" }, "link")).toBe("https://maps.example");
    expect(displayValue({ some: "object" }, "text")).toBeUndefined();
  });
});

const snapshot = {
  schemaVersion: 4, storeId: "store-a", sourceGeneration: 1, compilerVersion: "t", registryManifestHash: "h",
  theme: { presetId: "jelly-avenue", settings: {}, artifactId: null },
  templates: {
    home: { id: "home", type: "home", handle: "default", layout: { sections: [{ kind: "inline", section: hero }] } },
    product: { id: "product", type: "product", handle: "default", layout: { sections: [{ kind: "inline", section: hero }] } },
  },
  globalSections: {}, menus: {}, templateDefaults: { home: "home", product: "product" }, assignments: [], dependencies: { edges: [] },
} as unknown as RuntimeStorefrontSnapshotV4;
const reader = { findByHandle: async () => ({ type: "product" as const, id: "bed-1", handle: "oak-bed", visible: true, data: {} }), findById: async () => null };

describe("route resolution with custom-field values", () => {
  it("looks up values for the product being shown and renders them", async () => {
    const loadValues = vi.fn(async () => new Map([[bindingKey(firmness), "Medium firm"]]));
    const route = await resolveStorefrontRoute(snapshot, { type: "product", handle: "oak-bed" }, reader, loadValues);

    expect(loadValues).toHaveBeenCalledWith({ storeId: "store-a", resource: { type: "product", id: "bed-1" }, bindings: [firmness, swatch, storeName] });
    expect(route.status === "ready" && route.sections[0].settings.heading).toBe("Medium firm");
  });

  it("shows fallbacks when the lookup fails, and the synchronous layout never shows raw bindings", async () => {
    const route = await resolveStorefrontRoute(snapshot, { type: "home" }, reader, async () => { throw new Error("offline"); });
    expect(route.status === "ready" && route.sections[0].settings.heading).toBe("Comfort you can choose");
    expect(expandRuntimeLayout(snapshot, snapshot.templates.home).template[0].settings.heading).toBe("Comfort you can choose");
  });

  it("makes no request when a page has no connected settings", async () => {
    const plain = { ...snapshot, templates: { home: { ...snapshot.templates.home, layout: { sections: [{ kind: "inline", section: { ...hero, settings: { heading: "Hello" }, blocks: [] } }] } } } } as RuntimeStorefrontSnapshotV4;
    const loadValues = vi.fn(async () => new Map());
    await resolveStorefrontRoute(plain, { type: "home" }, reader, loadValues);
    expect(loadValues).not.toHaveBeenCalled();
  });
});

describe("binding value loader", () => {
  it("posts the bindings and makes API media URLs absolute", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ values: [{ binding: swatch, value: { url: "/api/public/media/store-a/oak", alt: "Oak" } }] }), { status: 200 }));
    const load = createBindingValueLoader({ origin: "https://api.example/", path: (storeId) => `/api/public/stores/${storeId}/storefront/binding-values`, fetch: fetcher as unknown as typeof fetch });
    const values = await load({ storeId: "store-a", resource: { type: "product", id: "bed-1" }, bindings: [swatch] });

    expect(fetcher).toHaveBeenCalledWith("https://api.example/api/public/stores/store-a/storefront/binding-values", expect.objectContaining({ method: "POST", body: JSON.stringify({ resource: { type: "product", id: "bed-1" }, bindings: [swatch] }) }));
    expect(values.get(bindingKey(swatch))).toEqual({ url: "https://api.example/api/public/media/store-a/oak", alt: "Oak" });
  });

  it("reports a failed request so callers can fall back", async () => {
    const load = createBindingValueLoader({ origin: "https://api.example", path: () => "/x", fetch: (async () => new Response("", { status: 500 })) as unknown as typeof fetch });
    await expect(load({ storeId: "s", bindings: [swatch] })).rejects.toThrow("500");
  });
});
