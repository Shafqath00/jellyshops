import { render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { runtimeStorefrontSnapshotV4Schema } from "@jelly/storefront-schema";
import { getStarterPack } from "@jelly/storefront-themes";
import { draftPreviewLayout } from "@/features/store-editor/editor-page-helpers";
import type { GlobalSectionRecord, StorefrontTemplateRecord } from "@/features/store-editor/api/types";
import { resolveStorefrontRoute, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";
import { RuntimeStorefrontView } from "@/features/storefront/runtime-storefront-view";
import { themePreviewEntries, type ThemePreviewConfig } from "./configs";
import { previewCatalogProduct, snapshotFromStarterPack } from "./preview-fixtures";
import { TemplatePreview } from "./template-preview";

/**
 * One render path (phase 5 of docs/reports/2026-11-09-shopify-template-parity.md): the theme preview, the editor and
 * the live store must put every page together the same way. These tests build each template's published snapshot
 * from its starter pack and compare the three paths on the same sample data.
 */
const pageTypes = ["home", "product", "collection", "cart", "search", "page", "not-found"] as const;
const noValues = async () => new Map();
const reader = (config: ThemePreviewConfig) => ({
  findByHandle: async (type: string, handle: string) => {
    if (type === "product" && handle === "sample-product") return { type: "product" as const, id: config.product.id, handle, visible: true, data: { title: config.product.title } };
    if (type === "collection" && handle === "sample") return { type: "collection" as const, id: "c1", handle, visible: true, data: {} };
    if (type === "page" && handle === "about") return { type: "page" as const, id: "about", handle, visible: true, data: { title: config.page.title } };
    return null;
  },
  findById: async () => null,
});
const request = (type: (typeof pageTypes)[number]) => type === "search"
  ? { type, context: { type: "search" as const, query: "linen", state: "results" as const, resultCount: 0, results: [] } }
  : type === "product" ? { type, handle: "sample-product" } : type === "collection" ? { type, handle: "sample" } : type === "page" ? { type, handle: "about" } : { type };

describe.each(themePreviewEntries().map(({ path, config }) => [path, config] as const))("%s", (_path, config) => {
  const pack = getStarterPack(config.packId);
  const snapshot = snapshotFromStarterPack(pack, config.themeId);

  it("turns its starter pack into a valid published snapshot", () => {
    expect(runtimeStorefrontSnapshotV4Schema.safeParse(snapshot).success).toBe(true);
    expect(Object.keys(snapshot.templateDefaults).sort()).toEqual([...new Set(pack.templates.map((template) => template.type))].sort());
  });

  it("lays out every page the same way in the editor as on the live store", async () => {
    const globals = new Map(Object.values(snapshot.globalSections).map((global) => [global.id, { id: global.id, storeId: "s", revision: 1, name: global.id, section: global.section } as GlobalSectionRecord]));
    for (const type of pageTypes) {
      if (!snapshot.templateDefaults[type]) continue;
      const live = await resolveStorefrontRoute(snapshot, request(type) as never, reader(config) as never, noValues);
      expect(live.status, type).toBe("ready");
      if (live.status !== "ready") continue;
      const template = snapshot.templates[snapshot.templateDefaults[type]!];
      const editorTemplate = { id: template.id, storeId: "s", revision: 1, type: template.type, handle: template.handle, name: template.handle, layout: template.layout } as StorefrontTemplateRecord;
      expect(draftPreviewLayout(editorTemplate, globals), type).toEqual(live.layout);
    }
  });

  it("builds the sample product from a catalog-shaped product the live product logic can sell", () => {
    const product = previewCatalogProduct(config);
    expect(product.variants.length).toBe(product.options?.[0]?.values.length);
    expect(product.inventoryOptionIds).toEqual([product.options?.[0]?.id]);
  });
});

describe("theme preview draws exactly what the live store draws", () => {
  const entry = themePreviewEntries().find(({ path }) => path === "jelly-minimal")!;

  it("renders the home page through the live loader and view, section for section", async () => {
    const { config } = entry;
    const snapshot = snapshotFromStarterPack(getStarterPack(config.packId), config.themeId);
    const route = await resolveStorefrontRoute(snapshot, { type: "home" }, reader(config) as never, noValues) as Extract<ResolvedStorefrontRoute, { status: "ready" }>;
    const commerce = { async getProducts() { return []; } };
    const live = renderToStaticMarkup(<RuntimeStorefrontView route={route} commerce={commerce} themeId={config.themeId} menus={snapshot.menus} storeSlug="preview" mode="preview" identity={{ name: config.name }} />);
    const { container } = render(<TemplatePreview template="home" config={{ ...config, useStarterMenu: true }} />);
    await waitFor(() => expect(container.querySelector("main")).not.toBeNull());
    const sectionTypes = (html: string) => [...html.matchAll(/data-section-type="([^"]+)"/g)].map((match) => match[1]);
    expect(sectionTypes(container.innerHTML)).toEqual(sectionTypes(live));
    expect(sectionTypes(live).length).toBeGreaterThan(3);
  });
});
