import type { BlockNode, PageDocument, PageType, SectionNode, StoreDesignDocument } from "@jelly/storefront-schema";
import { createDefaultStoreDesign } from "@jelly/storefront-schema";

export type ThemePackId = "fresh-market" | "artisan-boutique";

export interface ThemePack {
  id: ThemePackId;
  name: string;
  description: string;
  preview: { background: string; accent: string; imageUrl: string };
}

const freshMarket: ThemePack = {
  id: "fresh-market",
  name: "Fresh Market",
  description: "A bright, product-first theme for food, grocery, and everyday essentials.",
  preview: { background: "#f6f4df", accent: "#166534", imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85" },
};

const artisanBoutique: ThemePack = {
  id: "artisan-boutique",
  name: "Artisan Boutique",
  description: "An editorial storefront for fashion, beauty, jewellery, and handcrafted goods.",
  preview: { background: "#f7f3ed", accent: "#4c1d3d", imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85" },
};

function block(type: string, settings: Record<string, unknown> = {}): BlockNode {
  return { id: crypto.randomUUID(), type, enabled: true, settings };
}

function section(type: string, settings: Record<string, unknown> = {}, blocks: BlockNode[] = []): SectionNode {
  return { id: crypto.randomUUID(), type, enabled: true, settings, blocks };
}

function page(type: PageType, sections: SectionNode[]): PageDocument {
  return { id: crypto.randomUUID(), type, sections };
}

function hero(eyebrow: string, heading: string, summary: string, image: string): SectionNode {
  return section("hero", { eyebrow, summary, image: { url: image, alt: heading }, contentAlignment: "left", paddingTop: 72 }, [
    block("heading", { text: heading }),
    block("text", { text: summary }),
    block("button", { label: "Shop the collection", href: "/shop" }),
  ]);
}

function packPages(id: ThemePackId, homeSections: SectionNode[]): StoreDesignDocument["pages"] {
  const cartMessage = id === "fresh-market" ? "Secure checkout and easy returns." : "Secure checkout. Considered delivery.";
  const missingHeading = id === "fresh-market" ? "That shelf is empty." : "This page has moved on.";
  const missingText = id === "fresh-market" ? "Try a fresh search or head back to the market." : "Return to the collection and discover something new.";
  return {
    home: page("home", homeSections),
    product: page("product", [section("product-information"), section("product-description"), section("related-products")]),
    collection: page("collection", [section("collection-header"), section("collection-product-grid")]),
    cart: page("cart", [section("cart-summary"), section("trust-strip", {}, [block("text", { text: cartMessage })])]),
    search: page("search", [section("search-results")]),
    "not-found": page("not-found", [section("not-found-message", {}, [block("heading", { text: missingHeading }), block("text", { text: missingText }), block("button", { label: "Shop all", href: "/shop" })])]),
  };
}

function freshMarketDocument(): StoreDesignDocument {
  const document = createDefaultStoreDesign("fresh-market");
  document.globalSettings = {
    ...document.globalSettings,
    colors: { primary: "#166534", background: "#f6f4df", text: "#15362a", surface: "#ffffff", accent: "#f97316" },
    typography: { ...document.globalSettings.typography, headingFont: "Nunito Sans", bodyFont: "Aptos" },
    buttons: { ...document.globalSettings.buttons, radius: "pill" },
  };
  document.pages = packPages("fresh-market", [
    hero("Seasonal picks", "Good food, gathered well.", "Stock the kitchen with bright flavors and everyday favorites.", freshMarket.preview.imageUrl),
    section("category-grid", { heading: "Shop by aisle" }),
    section("featured-collection", { heading: "Picked for the week", collectionId: "fruit-favorites" }),
    section("image-with-text", { image: { url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=85", alt: "Fresh produce" } }, [block("heading", { text: "From nearby growers to your table." }), block("text", { text: "Simple ingredients, carefully chosen." }), block("button", { label: "Meet our producers", href: "/pages/about" })]),
    section("product-grid", { heading: "Fresh arrivals" }),
    section("trust-strip", { contentAlignment: "center" }, [block("heading", { text: "Packed with care. Delivered with ease." })]),
    section("testimonials", {}, [block("testimonial", { quote: "The easiest way to restock our favorites.", author: "Maya R." }), block("testimonial", { quote: "Everything arrives fresh and beautiful.", author: "Jordan L." })]),
    section("newsletter", {}, [block("heading", { text: "A little good news from the market." }), block("text", { text: "Seasonal recipes and first access to new arrivals." })]),
  ]);
  return document;
}

function artisanBoutiqueDocument(): StoreDesignDocument {
  const document = createDefaultStoreDesign("artisan-boutique");
  document.globalSettings = {
    ...document.globalSettings,
    colors: { primary: "#201a1d", background: "#f7f3ed", text: "#201a1d", surface: "#fffdf9", accent: "#7c2d4f" },
    typography: { ...document.globalSettings.typography, headingFont: "Georgia", bodyFont: "Inter" },
    buttons: { ...document.globalSettings.buttons, radius: "soft" },
  };
  document.pages = packPages("artisan-boutique", [
    hero("The new collection", "Made to become part of your story.", "Thoughtful objects, refined materials, and pieces you will return to.", artisanBoutique.preview.imageUrl),
    section("image-with-text", { image: { url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85", alt: "Artisan details" } }, [block("heading", { text: "The beauty is in the making." }), block("text", { text: "A considered collection for slow, lasting rituals." }), block("button", { label: "Our story", href: "/pages/about" })]),
    section("featured-collection", { heading: "Signature pieces", collectionId: "all-jellies" }),
    section("image-mosaic", { image: { url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85", alt: "Boutique collection" } }, [block("heading", { text: "Designed for the every day." })]),
    section("product-grid", { heading: "Curated for you" }),
    section("testimonials", {}, [block("testimonial", { quote: "The details are even better in person.", author: "Elena M." }), block("testimonial", { quote: "A true forever piece.", author: "Ava K." })]),
    section("journal-teaser", {}, [block("heading", { text: "Notes from the studio" }), block("text", { text: "Stories about craft, materials, and thoughtful living." }), block("button", { label: "Read the journal", href: "/pages/journal" })]),
    section("newsletter", {}, [block("heading", { text: "Keep in touch." }), block("text", { text: "New work, studio notes, and private previews." })]),
  ]);
  return document;
}

export function listThemePacks(): ThemePack[] {
  return [freshMarket, artisanBoutique].map((pack) => structuredClone(pack));
}

export function getThemePack(id: ThemePackId): ThemePack {
  const pack = listThemePacks().find((item) => item.id === id);
  if (!pack) throw new Error(`Unknown theme pack: ${id}`);
  return pack;
}

export function createThemePackDocument(id: ThemePackId): StoreDesignDocument {
  return id === "fresh-market" ? freshMarketDocument() : artisanBoutiqueDocument();
}
