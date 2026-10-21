import type { PageType, SectionNode } from "@jelly/storefront-schema";

export type V4StarterPackId = "fresh-market" | "artisan-boutique" | "jelly-signature" | "jelly-avenue";
export const V4_STARTER_PACK_IDS: readonly V4StarterPackId[] = ["jelly-avenue", "jelly-signature", "fresh-market", "artisan-boutique"];
/** Starter packs that install every page type plus draft information pages (About, FAQ, policies). */
export const COMPLETE_STARTER_PACK_IDS: readonly V4StarterPackId[] = ["jelly-signature", "jelly-avenue"];
export function isV4StarterPackId(value: unknown): value is V4StarterPackId {
  return typeof value === "string" && (V4_STARTER_PACK_IDS as readonly string[]).includes(value);
}
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
  /** One-sentence pitch and category tags shown on the template card. */
  summary: string;
  tags: string[];
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

const photo = (id: string, width = 1800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

/** Jelly Avenue home page: full-bleed campaign imagery between edge-to-edge product grids. */
function avenueHome(id: V4StarterPackId): SectionNode[] {
  const card = (key: string, label: string, image: string, alt: string) => block(`${id}-collection-${key}`, "collection-card", { label, link: "/shop", image: { url: photo(image, 1400), alt } });
  return [
    section(`${id}-home-hero`, {
      type: "hero",
      settings: {
        eyebrow: "The new season",
        layout: "overlay",
        height: "large",
        colorScheme: "dark",
        contentAlignment: "center",
        overlay: 28,
        image: { url: photo("photo-1485968579580-b6d095142e6e", 2400), alt: "A woman in a tailored check coat on a city street" },
      },
      blocks: [
        block(`${id}-home-hero-heading`, "heading", { text: "Dressed for the city." }),
        block(`${id}-home-hero-copy`, "text", { text: "Considered tailoring and everyday essentials, made to move with you." }),
        block(`${id}-home-hero-button`, "button", { label: "Shop the collection", href: "/shop" }),
      ],
    }),
    section(`${id}-featured`, { type: "product-grid", settings: { heading: "New this season", text: "The latest arrivals: structured cuts and soft layers for the modern everyday.", limit: 8, columns: 4, sort: "newest", contentAlignment: "center", viewAllLabel: "View all", viewAllLink: "/shop" }, blocks: [] }),
    section(`${id}-collections`, {
      type: "category-grid",
      settings: { heading: "", columns: 2, imageRatio: "portrait" },
      blocks: [
        card("him", "For him", "photo-1617137968427-85924c800a22", "A man in a navy suit walking past a glass building"),
        card("her", "For her", "photo-1539109136881-3be0616acf4b", "A woman in a pale blue coat in a city square"),
      ],
    }),
    section(`${id}-bestsellers`, { type: "product-grid", settings: { heading: "Quiet favourites", text: "Our best-loved staples, chosen for the way they wear.", limit: 4, columns: 4, sort: "best-selling", contentAlignment: "center", hideWhenEmpty: true }, blocks: [] }),
    section(`${id}-campaign`, {
      type: "image-banner",
      settings: { height: "large", overlay: 30, contentAlignment: "center", image: { url: photo("photo-1445205170230-053b83016050", 2400), alt: "Wool coats in warm neutral tones hanging on a rail" } },
      blocks: [
        block(`${id}-campaign-heading`, "heading", { text: "The new tailoring" }),
        block(`${id}-campaign-copy`, "text", { text: "Refined materials and considered cuts, made to move between the everyday and the extraordinary." }),
        block(`${id}-campaign-button`, "button", { label: "View the collection", href: "/shop" }),
      ],
    }),
    section(`${id}-home-story`, {
      type: "image-with-text",
      settings: { eyebrow: "Our approach", imagePosition: "right", colorScheme: "page", image: { url: photo("photo-1441984904996-e0b6ba687e04", 1400), alt: "A bright studio shop with clothing on wooden rails" } },
      blocks: [
        block(`${id}-home-story-heading`, "heading", { text: "Designed to outlast the season." }),
        block(`${id}-home-story-copy`, "text", { text: "Tell customers what you make and why it matters: the materials you choose, the people who make it and the care that goes into every piece." }),
        block(`${id}-home-story-button`, "button", { label: "Read our story", href: "/pages/about" }),
      ],
    }),
    section(`${id}-promises`, {
      type: "multicolumn",
      settings: { heading: "", columns: 3, contentAlignment: "center", colorScheme: "soft" },
      blocks: [
        block(`${id}-promise-delivery`, "column", { heading: "Free delivery", text: "Complimentary delivery on every order, tracked to your door." }),
        block(`${id}-promise-returns`, "column", { heading: "30-day returns", text: "Not quite right? Send it back within 30 days." }),
        block(`${id}-promise-checkout`, "column", { heading: "Secure checkout", text: "Pay safely with the methods you already use." }),
      ],
    }),
    section(`${id}-newsletter`, {
      type: "newsletter",
      settings: { buttonLabel: "Subscribe", contentAlignment: "center", colorScheme: "page" },
      blocks: [block(`${id}-newsletter-title`, "heading", { text: "Join the list" }), block(`${id}-newsletter-copy`, "text", { text: "Be the first to hear about new arrivals, restocks and private sales." })],
    }),
  ];
}

function makePack(id: V4StarterPackId): V4StarterPack {
  const fresh = id === "fresh-market";
  const avenue = id === "jelly-avenue";
  // Jelly Avenue shares Jelly Minimal's complete page set; only its home page and copy differ.
  const signature = id === "jelly-signature" || avenue;
  const label = avenue ? "Jelly Avenue" : signature ? "Jelly Minimal" : fresh ? "Fresh Market" : "Artisan Boutique";
  const announcementText = avenue ? "Free delivery and 30-day returns on every order." : signature ? "A little something lovely, delivered with care." : fresh ? "Good things are in season." : "Thoughtful finds, made to last.";
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
      contentAlignment: fresh || signature ? "left" : "center",
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
    const home = templates.find((item) => item.type === "home")!;
    const card = (key: string, label: string, image: string, alt: string) => block(`${id}-collection-${key}`, "collection-card", { label, link: "/shop", image: { url: image, alt } });
    home.layout.sections = avenue ? inline(...avenueHome(id)) : inline(
      section(`${id}-home-hero`, {
        type: "hero",
        settings: {
          eyebrow: "New season",
          layout: "split",
          height: "large",
          colorScheme: "soft",
          contentAlignment: "left",
          image: { url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=80", alt: "A bright living room with neutral textiles and woven wall decor" },
        },
        blocks: [
          block(`${id}-home-hero-heading`, "heading", { text: "Everyday pieces, thoughtfully made." }),
          block(`${id}-home-hero-copy`, "text", { text: "Considered essentials for the home and wardrobe, chosen to be used and loved for years." }),
          block(`${id}-home-hero-button`, "button", { label: "Shop the collection", href: "/shop" }),
          block(`${id}-home-hero-secondary`, "button", { label: "Our story", href: "/pages/about" }),
        ],
      }),
      section(`${id}-collections`, {
        type: "category-grid",
        settings: { heading: "Shop by collection", columns: 4, imageRatio: "portrait" },
        blocks: [
          card("new", "New arrivals", "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80", "Neutral clothing on a rail"),
          card("home", "For the home", "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=900&q=80", "A tan sofa with a wool throw"),
          card("accessories", "Accessories", "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=80", "A canvas tote bag"),
          card("kitchen", "Kitchen & dining", "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80", "A white ceramic mug"),
        ],
      }),
      section(`${id}-featured`, { type: "product-grid", settings: { heading: "New arrivals", text: "The latest additions to the shop.", limit: 8, columns: 4, sort: "newest", viewAllLabel: "View all products", viewAllLink: "/shop" }, blocks: [] }),
      section(`${id}-home-story`, {
        type: "image-with-text",
        settings: { eyebrow: "Our story", imagePosition: "left", colorScheme: "page", image: { url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80", alt: "Knitwear, denim and a watch laid out on a blanket" } },
        blocks: [
          block(`${id}-home-story-heading`, "heading", { text: "Made to be lived with." }),
          block(`${id}-home-story-copy`, "text", { text: "Tell customers who you are, what you make and why it matters. A few honest sentences go a long way." }),
          block(`${id}-home-story-button`, "button", { label: "Read our story", href: "/pages/about" }),
        ],
      }),
      section(`${id}-promises`, {
        type: "multicolumn",
        settings: { heading: "Why shop with us", columns: 3, contentAlignment: "left", colorScheme: "soft" },
        blocks: [
          block(`${id}-promise-packing`, "column", { heading: "Carefully packed", text: "Every order is wrapped by hand and sent with care." }),
          block(`${id}-promise-checkout`, "column", { heading: "Secure checkout", text: "Pay safely with the payment methods you already use." }),
          block(`${id}-promise-help`, "column", { heading: "Here to help", text: "Questions about an order? Get in touch and we will reply quickly." }),
        ],
      }),
      section(`${id}-bestsellers`, { type: "product-grid", settings: { heading: "Customer favourites", limit: 4, columns: 4, sort: "best-selling", hideWhenEmpty: true }, blocks: [] }),
      section(`${id}-newsletter`, {
        type: "newsletter",
        settings: { buttonLabel: "Subscribe", contentAlignment: "center", colorScheme: "page" },
        blocks: [block(`${id}-newsletter-title`, "heading", { text: "A little news, now and then." }), block(`${id}-newsletter-copy`, "text", { text: "New arrivals and occasional notes from the studio. No spam, unsubscribe anytime." })],
      }),
    );
    const product = templates.find((item) => item.type === "product")!;
    for (const placement of product.layout.sections) {
      if (placement.kind !== "inline") continue;
      if (placement.section.type === "product-gallery") placement.section.settings = { imageFit: "cover", layout: avenue ? "grid" : "stacked" };
      if (placement.section.type === "product-options") placement.section.settings = { style: "buttons" };
      if (placement.section.type === "product-description") placement.section.settings = { spacing: "standard", heading: "Description" };
      if (placement.section.type === "related-products") placement.section.settings = { limit: 4, heading: avenue ? "Complete the look" : "You may also like" };
    }
    for (const type of ["checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success"] as const) templates.push({ key: id + "-template-" + type, type, handle: "default", name: type.replaceAll("-", " "), layout: { sections: [] } });
  }
  for (const template of templates) {
    const inlineSections = template.layout.sections.filter((placement) => placement.kind === "inline");
    template.layout.sections = [
      ...(template.type === "home" ? [global(`${id}-global-announcement-section`)] : []),
      global(`${id}-global-header-section`),
      ...inlineSections,
      global(`${id}-global-footer-section`),
    ];
  }

  return {
    id,
    version: "1.0.0",
    name: label,
    description: avenue ? "An editorial, image-led storefront with full-bleed banners and product-first grids." : signature ? "A modern, minimal storefront in warm white and charcoal for independent brands." : fresh
      ? "A bright, produce-first storefront for food, grocery, and everyday essentials."
      : "A quiet, editorial storefront for considered goods and handcrafted pieces.",
    summary: avenue ? "Editorial and image-led, with full-screen banners, edge-to-edge product grids and a complete shopping and customer experience." : signature ? "A modern, minimal storefront in warm white and charcoal, with a complete shopping and customer experience." : fresh ? "Fresh, friendly, and full of life. A natural home for everyday essentials and local favorites." : "Thoughtful details, beautiful products. A considered canvas for independent brands and makers.",
    tags: avenue ? ["Fashion & apparel", "Editorial & bold"] : signature ? ["Fashion & lifestyle", "Clean & minimal"] : fresh ? ["Food & essentials", "Fresh & natural"] : ["Fashion & lifestyle", "Warm & editorial"],
    previewAsset: avenue ? "/themes/jelly-avenue/preview.svg" : signature ? "/themes/jelly-signature/preview.svg" : fresh
      ? "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85"
      : "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85",
    theme: { themeId: id, settings: {} },
    globalSections: [
      { key: "announcement", name: "Announcement", section: section(`${id}-global-announcement-section`, { type: "announcement-bar", settings: {}, blocks: [block(`${id}-global-announcement-copy`, "text", { text: announcementText })] }) },
      { key: "header", name: "Header", section: section(`${id}-global-header-section`, { type: "header", settings: avenue ? { logoPosition: "center", sticky: true } : {}, blocks: [block(`${id}-global-header-menu`, "menu", { handle: "main" })] }) },
      { key: "footer", name: "Footer", section: section(`${id}-global-footer-section`, { type: "footer", settings: avenue ? { text: "Modern wardrobe essentials, made to be worn on repeat. Designed in the studio, delivered to your door." } : signature ? { text: "Thoughtful everyday goods, chosen with care and delivered to your door." } : {}, blocks: [block(`${id}-global-footer-menu`, "menu", { handle: "main" })] }) },
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
  "jelly-avenue": makePack("jelly-avenue"),
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
