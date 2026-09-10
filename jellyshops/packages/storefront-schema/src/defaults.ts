import { STORE_DESIGN_SCHEMA_VERSION } from "./version.js";
import type { BlockNode, PageType, SectionNode, StoreDesignDocument, ThemeId } from "./types.js";

function block(type: string, settings: Record<string, unknown> = {}): BlockNode {
  return { id: crypto.randomUUID(), type, enabled: true, settings };
}

function section(type: string, blocks: BlockNode[] = [], settings: Record<string, unknown> = {}): SectionNode {
  return { id: crypto.randomUUID(), type, enabled: true, settings, blocks };
}

function page(type: PageType, sections: SectionNode[]) {
  return { id: crypto.randomUUID(), type, sections };
}

export function createDefaultStoreDesign(themeId: ThemeId = "minimal"): StoreDesignDocument {
  return {
    schemaVersion: STORE_DESIGN_SCHEMA_VERSION,
    theme: { id: themeId, settings: {} },
    globalSettings: {
      colors: { primary: "#14213d", background: "#fffdf8", text: "#14213d", surface: "#ffffff", accent: "#ff6b8a" },
      typography: { headingFont: "Arial Rounded MT Bold", bodyFont: "Aptos", headingScale: "standard" },
      buttons: { style: "solid", radius: "rounded" },
      layout: { containerWidth: "standard", sectionSpacing: "standard" },
      productCards: { imageRatio: "square", showVendor: false, showQuickAdd: true }
    },
    header: section("header", [block("menu")]),
    pages: {
      home: page("home", [section("hero", [block("heading", { text: "Welcome" }), block("text", { text: "Discover our collection." }), block("button", { label: "Shop now" })]), section("product-grid")]),
      product: page("product", [section("product-information")]),
      collection: page("collection", [section("collection-product-grid")])
    },
    footer: section("footer", [block("menu")])
  };
}
