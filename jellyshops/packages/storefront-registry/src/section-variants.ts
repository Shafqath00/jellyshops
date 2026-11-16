import type { BlockNode } from "@jelly/storefront-schema";
import type { SectionPreset } from "./types.js";

/**
 * Designed variants of the built-in sections (docs/design-contract.md §2.6): each is a preset with its own settings
 * and blocks, so "Collection list: Bento" adds a finished composition in one click instead of an empty container.
 * `prepareSection` in registry.ts adds these to the sections' own presets; `createPresetSection` applies them (block
 * ids here are placeholders and are replaced on insert). Photos are the same Unsplash images the starter packs use.
 */
type Variant = Omit<SectionPreset, "sectionType">;

const photo = (id: string, alt: string, width = 1200) => ({ url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`, alt });
const block = (type: string, settings: Record<string, unknown>): BlockNode => ({ id: `variant-${type}`, type, enabled: true, settings });
/** A block that holds blocks (grid, accordion): its children get their own placeholder ids. */
const holder = (type: string, settings: Record<string, unknown>, blocks: BlockNode[]): BlockNode => ({ ...block(type, settings), blocks: blocks.map((child, index) => ({ ...child, id: `${child.id}-${index + 1}` })) });
const heading = (text: string) => block("heading", { text });
const text = (value: string) => block("text", { text: value });
const button = (label: string, href = "/shop") => block("button", { label, href });
const card = (label: string, image: ReturnType<typeof photo>) => block("collection-card", { label, image, link: "/shop" });
const column = (title: string, body: string) => block("column", { heading: title, text: body });

const pictures = {
  rail: photo("photo-1445205170230-053b83016050", "Wool coats in warm neutral tones hanging on a rail", 2400),
  studio: photo("photo-1441984904996-e0b6ba687e04", "A bright studio shop with clothing on wooden rails"),
  flatlay: photo("photo-1556905055-8f358a7a47b2", "Knitwear, denim and a watch laid out on a blanket"),
  outfit: photo("photo-1490481651871-ab68de25d43d", "Folded clothes in soft colours on a wooden table"),
  mug: photo("photo-1514228742587-6b1558fcca3d", "A stoneware mug on a light table"),
  model: photo("photo-1529139574466-a303027c1d8b", "Two people in relaxed autumn outfits"),
  bag: photo("photo-1544816155-12df9643f363", "A leather bag and accessories"),
  home: photo("photo-1616486338812-3dadae4b4ace", "A calm living room with natural textures"),
};

export const SECTION_VARIANTS: Record<string, Variant[]> = {
  hero: [
    {
      id: "hero-overlay", label: "Hero: Text over image", category: "banners", thumbnail: "overlay",
      description: "A large photo with centred text on top.",
      settings: { layout: "overlay", height: "large", contentAlignment: "center", overlay: 35, image: pictures.rail },
      blocks: [heading("The new season is here"), text("Considered pieces, made to last."), button("Shop the collection")],
    },
    {
      id: "hero-text", label: "Hero: Text only", category: "banners", thumbnail: "centered",
      description: "A bold statement without a photo.",
      settings: { layout: "text", contentAlignment: "center" },
      blocks: [heading("Everyday things, made well"), text("Small batches, honest materials and free returns."), button("Browse the shop")],
    },
  ],
  "category-grid": [
    {
      id: "category-grid-bento", label: "Collection list: Bento", category: "products", thumbnail: "bento",
      description: "One large collection beside four smaller ones.",
      settings: { heading: "Shop by collection", layout: "bento", columns: 4 },
      blocks: [card("New arrivals", pictures.model), card("Knitwear", pictures.flatlay), card("Accessories", pictures.bag), card("For the home", pictures.home), card("Gifts", pictures.mug)],
    },
    {
      id: "category-grid-carousel", label: "Collection list: Carousel", category: "products", thumbnail: "carousel",
      description: "Collections in a row that scrolls sideways.",
      settings: { heading: "Shop by collection", layout: "carousel", columns: 4 },
      blocks: [card("New arrivals", pictures.model), card("Knitwear", pictures.flatlay), card("Coats", pictures.rail), card("Accessories", pictures.bag), card("For the home", pictures.home), card("Gifts", pictures.mug)],
    },
  ],
  "product-grid": [
    {
      id: "product-grid-three", label: "Product grid: Large", category: "products", thumbnail: "grid-3",
      description: "Three bigger products per row, heading centred.",
      settings: { heading: "Best sellers", contentAlignment: "center", columns: 3, limit: 6, viewAllLabel: "View all", viewAllLink: "/shop" },
    },
    {
      id: "product-grid-tabs", label: "Product grid: Tabs", category: "products", thumbnail: "tabs",
      description: "Switch between new and best-selling products.",
      settings: { heading: "Shop the edit", contentAlignment: "center", columns: 4, limit: 8 },
      blocks: [block("product-tab", { label: "New in", sort: "newest" }), block("product-tab", { label: "Best sellers", sort: "best-selling" })],
    },
  ],
  "image-with-text": [
    {
      id: "image-with-text-left", label: "Image with text: Image left", category: "content", thumbnail: "split",
      description: "A photo on the left, your story on the right.",
      settings: { eyebrow: "Our story", imagePosition: "left", image: pictures.studio },
      blocks: [heading("Made in small batches"), text("Tell customers what makes your shop different: where things come from, who makes them and why it matters."), button("About us", "/pages/about")],
    },
    {
      id: "image-with-text-soft", label: "Image with text: Image right, soft", category: "content", thumbnail: "split-reverse",
      description: "A photo on the right on a soft background.",
      settings: { eyebrow: "How we work", imagePosition: "right", styleScheme: "scheme2", image: pictures.outfit },
      blocks: [heading("Thoughtful from start to finish"), text("Explain your process, your materials or your promise to customers."), button("Read more", "/pages/about")],
    },
  ],
  multicolumn: [
    {
      id: "multicolumn-promises", label: "Feature columns: Three promises", category: "content", thumbnail: "columns-3",
      description: "Three short reasons to shop with you, centred.",
      settings: { heading: "Why shop with us", columns: 3, contentAlignment: "center" },
      blocks: [column("Free delivery", "On every order over £50."), column("30-day returns", "Changed your mind? Send it back for free."), column("Secure checkout", "Pay safely with card, Apple Pay or Google Pay.")],
    },
    {
      id: "multicolumn-four", label: "Feature columns: Four columns", category: "content", thumbnail: "columns-4",
      description: "Four compact columns with a left-aligned heading.",
      settings: { heading: "Good to know", columns: 4, contentAlignment: "left" },
      blocks: [column("Delivery", "Dispatched within two working days."), column("Returns", "Free returns within 30 days."), column("Care", "Simple care guides with every order."), column("Help", "Real people reply within a day.")],
    },
  ],
  // Custom content built from the shared block library (content-blocks.ts); more designed presets follow in T3.
  "custom-content": [
    {
      id: "custom-icon-boxes", label: "Custom content: Icon boxes", category: "content", thumbnail: "columns-3",
      description: "A heading with three icon boxes in a grid.",
      settings: { contentAlignment: "left", contentWidth: "full", gap: 32 },
      blocks: [
        block("section-header", { eyebrow: "Why shop with us", heading: "Made to be lived with", text: "Small promises we keep on every order.", layout: "horizontal", linkLabel: "Our story", link: "/pages/about" }),
        holder("grid", { columns: 3, gap: 24, alignItems: "stretch" }, [
          block("icon-box", { icon: "truck", heading: "Free delivery", text: "On every order over £50.", boxStyle: "card" }),
          block("icon-box", { icon: "return", heading: "30-day returns", text: "Changed your mind? Send it back for free.", boxStyle: "card" }),
          block("icon-box", { icon: "shield", heading: "Two-year guarantee", text: "We stand behind what we make.", boxStyle: "card" }),
        ]),
      ],
    },
    {
      id: "custom-faq-accordion", label: "Custom content: Questions and answers", category: "content", thumbnail: "centered",
      description: "A heading and an accordion of common questions.",
      settings: { contentAlignment: "left", contentWidth: "narrow", gap: 24 },
      blocks: [
        block("section-header", { eyebrow: "Help", heading: "Questions, answered" }),
        holder("accordion", { openFirst: true, oneAtATime: true }, [
          block("accordion-row", { title: "How long does delivery take?", text: "Most orders arrive in 3 to 5 working days." }),
          block("accordion-row", { title: "Can I return my order?", text: "Yes, within 30 days, as long as it is unused." }),
          block("accordion-row", { title: "Do you deliver abroad?", text: "We deliver across the UK and Europe." }),
        ]),
      ],
    },
    {
      id: "custom-counters", label: "Custom content: Numbers", category: "content", thumbnail: "columns-4",
      description: "A short story with four big numbers.",
      settings: { contentAlignment: "center", contentWidth: "full", gap: 32 },
      blocks: [
        block("subheading", { text: "Our story" }),
        heading("Small studio, big care"),
        holder("grid", { columns: 4, gap: 24, alignItems: "start" }, [
          block("counter", { value: 12000, suffix: "+", label: "Happy customers" }),
          block("counter", { value: 4.9, label: "Average rating" }),
          block("counter", { value: 30, suffix: " days", label: "Free returns" }),
          block("counter", { value: 2016, label: "Making since" }),
        ]),
      ],
    },
  ],
};
