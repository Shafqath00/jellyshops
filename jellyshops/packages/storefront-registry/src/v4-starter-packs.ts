import type { PageType, SectionNode } from "@jelly/storefront-schema";

export type V4StarterPackId = "fresh-market" | "artisan-boutique" | "jelly-signature";
export type V4StarterTemplateType = Exclude<PageType, never>;

export interface StarterMenuItem {
  id: string;
  label: string;
  target: { kind: "home" } | { kind: "search" };
  children: StarterMenuItem[];
}

export interface V4StarterPack {
  id: V4StarterPackId;
  version: string;
  name: string;
  description: string;
  previewAsset: string;
  theme: { themeId: string; settings: Record<string, unknown> };
  globalSections: Array<{
    key: "announcement" | "header" | "footer";
    name: string;
    section: SectionNode;
  }>;
  menus: Array<{
    key: "main";
    name: string;
    handle: "main";
    items: StarterMenuItem[];
  }>;
  templates: Array<{
    key: string;
    type: PageType;
    handle: "default";
    name: string;
    layout: { sections: Array<{ kind: "inline"; section: SectionNode } | { kind: "global"; globalSectionId: string }> };
  }>;
  resourceReferences: Array<{
    key: string;
    resourceType: "product" | "collection" | "page" | "blog" | "article";
    required: false;
    initialResourceId: null;
  }>;
}

type SectionContent = Pick<SectionNode, "type" | "settings" | "blocks">;

function section(id: string, content: SectionContent): SectionNode {
  return {
    id,
    ...content,
    enabled: true,
  };
}

function block(id: string, type: string, settings: Record<string, unknown> = {}) {
  return { id, type, enabled: true, settings };
}

function inline(...sections: SectionNode[]) {
  return sections.map((item) => ({ kind: "inline" as const, section: item }));
}

function global(globalSectionId: string) {
  return { kind: "global" as const, globalSectionId };
}

function makePack(id: V4StarterPackId): V4StarterPack {
  const fresh = id === "fresh-market";
  const signature = id === "jelly-signature";
  const label = signature ? "Jelly Minimal" : fresh ? "Fresh Market" : "Artisan Boutique";
  const announcementText = signature ? "A little something lovely, delivered with care." : fresh ? "Good things are in season." : "Thoughtful finds, made to last.";
  const heroHeading = signature ? "Find your everyday favourites." : fresh ? "Good food, gathered well." : "Made to become part of your story.";
  const heroSummary = signature ? "Explore the latest from our store." : fresh
    ? "Bright flavors and everyday favorites, chosen with care."
    : "Considered pieces, refined materials, and a little more meaning in every day.";
  const heroImage = signature ? "/themes/jelly-signature/hero.svg" : fresh
    ? "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=85"
    : "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=85";
  const hero = section(`${id}-home-hero`, {
    type: "hero",
    settings: {
      eyebrow: signature ? "A collection picked for you" : fresh ? "Seasonal picks" : "The new collection",
      summary: heroSummary,
      contentAlignment: fresh ? "left" : "center",
      image: { url: heroImage, alt: signature ? "An illustrated arrangement of everyday products" : fresh ? "Fresh produce at a market" : "Artisan boutique collection" },
      overlay: fresh ? 8 : 12,
    },
    blocks: [
      block(`${id}-home-hero-heading`, "heading", { text: heroHeading }),
      block(`${id}-home-hero-copy`, "text", { text: heroSummary }),
      block(`${id}-home-hero-button`, "button", { label: fresh ? "Shop fresh finds" : "Explore the collection", href: "/" }),
    ],
  });
  const imageWithText = section(`${id}-home-story`, {
    type: "image-with-text",
    settings: {
      image: {
        url: fresh
          ? "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=85"
          : "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85",
        alt: fresh ? "A selection of fresh produce" : "Details from the studio collection",
      },
      contentAlignment: fresh ? "left" : "right",
    },
    blocks: [
      block(`${id}-home-story-heading`, "heading", { text: fresh ? "From nearby growers to your table." : "The beauty is in the making." }),
      block(`${id}-home-story-copy`, "text", { text: signature ? "Thoughtful pieces for everyday moments." : fresh ? "Simple ingredients, carefully chosen." : "A considered collection for slow, lasting rituals." }),
      block(`${id}-home-story-button`, "button", { label: fresh ? "Our approach" : "Our story", href: "/" }),
    ],
  });
  const homeSections = fresh
    ? [hero, section(`${id}-home-products`, { type: "product-grid", settings: {}, blocks: [] }), imageWithText]
    : [hero, imageWithText, section(`${id}-home-products`, { type: "product-grid", settings: {}, blocks: [] })];

  const templates: V4StarterPack["templates"] = [
    { key: `${id}-template-home`, type: "home", handle: "default", name: "Home", layout: { sections: [...inline(...homeSections), global(`${id}-global-footer`)] } },
    { key: `${id}-template-product`, type: "product", handle: "default", name: "Product", layout: { sections: [...inline(
      section(`${id}-product-gallery`, { type: "product-gallery", settings: { imageFit: fresh ? "cover" : "contain" }, blocks: [] }),
      section(`${id}-product-information`, { type: "product-information", settings: { showVendor: !fresh, showSku: false, showCompareAtPrice: true, showAvailability: true }, blocks: [] }),
      section(`${id}-product-options`, { type: "product-options", settings: { style: fresh ? "buttons" : "select" }, blocks: [] }),
      section(`${id}-product-purchase`, { type: "product-purchase", settings: { showQuantity: true, label: "Add to cart" }, blocks: [] }),
      section(`${id}-product-description`, { type: "product-description", settings: { spacing: "standard" }, blocks: [] }),
      section(`${id}-product-related`, { type: "related-products", settings: { limit: 4 }, blocks: [] }),
    ), global(`${id}-global-footer`)] } },
    { key: `${id}-template-collection`, type: "collection", handle: "default", name: "Collection", layout: { sections: [...inline(
      section(`${id}-collection-header`, { type: "collection-header", settings: { showTitle: true, showDescription: true, showImage: true }, blocks: [] }),
      section(`${id}-collection-grid`, { type: "collection-product-grid", settings: { columns: fresh ? 4 : 3, limit: 12, emptyMessage: "No products are available in this collection yet." }, blocks: [] }),
      section(`${id}-collection-description`, { type: "collection-description", settings: { spacing: "standard" }, blocks: [] }),
    ), global(`${id}-global-footer`)] } },
    { key: `${id}-template-cart`, type: "cart", handle: "default", name: "Cart", layout: { sections: [...inline(section(`${id}-cart-summary`, { type: "cart-summary", settings: {}, blocks: [] })), global(`${id}-global-footer`)] } },
    { key: `${id}-template-search`, type: "search", handle: "default", name: "Search", layout: { sections: [...inline(section(`${id}-search-results`, { type: "search-results", settings: {}, blocks: [] })), global(`${id}-global-footer`)] } },
    { key: `${id}-template-page`, type: "page", handle: "default", name: "Page", layout: { sections: [...inline(section(`${id}-page-content`, { type: "page-content", settings: {}, blocks: [] })), global(`${id}-global-footer`)] } },
    { key: `${id}-template-blog`, type: "blog", handle: "default", name: "Blog", layout: { sections: [...inline(
      section(`${id}-blog-header`, { type: "blog-header", settings: {}, blocks: [] }),
      section(`${id}-article-list`, { type: "article-list", settings: {}, blocks: [] }),
    ), global(`${id}-global-footer`)] } },
    { key: `${id}-template-article`, type: "article", handle: "default", name: "Article", layout: { sections: [...inline(
      section(`${id}-article-header`, { type: "article-header", settings: {}, blocks: [] }),
      section(`${id}-article-content`, { type: "article-content", settings: {}, blocks: [] }),
    ), global(`${id}-global-footer`)] } },
    { key: `${id}-template-not-found`, type: "not-found", handle: "default", name: "Not Found", layout: { sections: [...inline(section(`${id}-not-found-message`, {
      type: "not-found-message",
      settings: { contentAlignment: "center" },
      blocks: [
        block(`${id}-not-found-heading`, "heading", { text: fresh ? "That page is out of season." : "This page has moved on." }),
        block(`${id}-not-found-copy`, "text", { text: fresh ? "Try a search or head back to the market." : "Return to the shop and discover something new." }),
        block(`${id}-not-found-button`, "button", { label: "Back to the shop", href: "/" }),
      ],
    })), global(`${id}-global-footer`)] } },
  ];
  if (signature) {
    imageWithText.enabled = false;
    const home = templates.find((item) => item.type === "home")!;
    home.layout.sections = inline(hero,
      section(id + "-categories", { type: "category-grid", settings: {}, blocks: [] }),
      section(id + "-featured", { type: "product-grid", settings: { limit: 8, heading: "The collection" }, blocks: [] }),
      imageWithText,
      section(id + "-arrivals", { type: "product-grid", settings: { limit: 4, heading: "Just arrived", sort: "newest" }, blocks: [] }),
      section(id + "-bestsellers", { type: "product-grid", settings: { limit: 4, heading: "Customer favourites", sort: "best-selling", hideWhenEmpty: true }, blocks: [] }),
      section(id + "-newsletter", { type: "newsletter", settings: {}, blocks: [block(id + "-newsletter-title", "heading", { text: "A little news, now and then." }), block(id + "-newsletter-copy", "text", { text: "Sign up for updates from our store." })] })
    );
    for (const type of ["checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success"] as const) templates.push({ key: id + "-template-" + type, type, handle: "default", name: type.replaceAll("-", " "), layout: { sections: [] } });
  }
  for (const template of templates) {
    const inlineSections = template.layout.sections.filter((placement) => placement.kind === "inline");
    template.layout.sections = [
      global(`${id}-global-header-section`),
      ...(template.type === "home" ? [global(`${id}-global-announcement-section`)] : []),
      ...inlineSections,
      global(`${id}-global-footer-section`),
    ];
  }

  return {
    id,
    version: "1.0.0",
    name: label,
    description: signature ? "A complete cream, navy, and pink storefront for independent brands." : fresh
      ? "A bright, produce-first storefront for food, grocery, and everyday essentials."
      : "A quiet, editorial storefront for considered goods and handcrafted pieces.",
    previewAsset: signature ? "/themes/jelly-signature/preview.svg" : fresh
      ? "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85"
      : "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85",
    theme: { themeId: id, settings: {} },
    globalSections: [
      { key: "announcement", name: "Announcement", section: section(`${id}-global-announcement-section`, { type: "announcement-bar", settings: {}, blocks: [block(`${id}-global-announcement-copy`, "text", { text: announcementText })] }) },
      { key: "header", name: "Header", section: section(`${id}-global-header-section`, { type: "header", settings: {}, blocks: [block(`${id}-global-header-menu`, "menu", { handle: "main" })] }) },
      { key: "footer", name: "Footer", section: section(`${id}-global-footer-section`, { type: "footer", settings: {}, blocks: [block(`${id}-global-footer-menu`, "menu", { handle: "main" })] }) },
    ],
    menus: [{
      key: "main",
      name: "Main menu",
      handle: "main",
      items: [
        { id: `${id}-menu-home`, label: "Home", target: { kind: "home" }, children: [] },
        { id: `${id}-menu-search`, label: "Search", target: { kind: "search" }, children: [] },
      ],
    }],
    templates,
    resourceReferences: [],
  };
}

const starterPacks: Record<V4StarterPackId, V4StarterPack> = {
  "jelly-signature": makePack("jelly-signature"),
  "fresh-market": makePack("fresh-market"),
  "artisan-boutique": makePack("artisan-boutique"),
};

export function listV4StarterPacks(): V4StarterPack[] {
  return structuredClone(Object.values(starterPacks));
}

export function getV4StarterPack(id: V4StarterPackId): V4StarterPack {
  const pack = starterPacks[id];
  if (!pack) throw new Error(`Unknown V4 starter pack: ${id}`);
  return structuredClone(pack);
}
