"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { RegistrySectionRenderer, type CommerceDataProvider } from "@jelly/storefront-renderer";
import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import { resolveStorefrontThemeTokens, resolveTheme } from "@jelly/storefront-themes";
import { StorefrontProductCard } from "@jelly/storefront-ui";
import { StorefrontPreviewFrame } from "@/features/store-editor/components/storefront-preview-frame";

/**
 * Jelly Minimal style guide: the theme's tokens, type, controls and shared
 * header/footer/product-card components, rendered with the same renderer and
 * stylesheet as live storefronts. Uses sample content only; no store data.
 */
const THEME_ID = "jelly-signature";
const widths = { desktop: 1280, tablet: 768, mobile: 390 } as const;
type Device = keyof typeof widths;

const commerce: CommerceDataProvider = { async getProducts() { return []; } };
const menus: Record<string, RuntimeMenuV4> = {
  main: {
    id: "style-guide-main",
    handle: "main",
    items: [
      { id: "home", label: "Home", target: { kind: "home" }, children: [] },
      { id: "shop", label: "Shop all", target: { kind: "search" }, children: [] },
      { id: "new", label: "New arrivals", target: { kind: "search" }, children: [] },
      { id: "about", label: "About", target: { kind: "home" }, children: [] },
    ],
  },
};
const section = (id: string, type: string, settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []): SectionNode => ({ id, type, enabled: true, settings, blocks } as SectionNode);
const menuBlock = (id: string) => ({ id, type: "menu", enabled: true, settings: { handle: "main" } }) as SectionNode["blocks"][number];
const announcement = section("guide-announcement", "announcement-bar", { text: "Free delivery on orders over £50" });
const header = section("guide-header", "header", { storeName: "Jelly Minimal" }, [menuBlock("guide-header-menu")]);
const centeredHeader = section("guide-header-centered", "header", { storeName: "Jelly Minimal", logoPosition: "center" }, [menuBlock("guide-header-centered-menu")]);
const footer = section("guide-footer", "footer", {
  storeName: "Jelly Minimal",
  text: "Thoughtful everyday goods, chosen with care and delivered to your door.",
  contactEmail: "hello@example.com",
}, [
  menuBlock("guide-footer-menu"),
  { id: "guide-footer-instagram", type: "social-link", enabled: true, settings: { label: "Instagram", href: "https://instagram.com" } } as SectionNode["blocks"][number],
  { id: "guide-footer-hours", type: "contact-item", enabled: true, settings: { label: "Hours", value: "Mon–Fri, 9am–5pm" } } as SectionNode["blocks"][number],
]);
const products = [
  { name: "Linen tote bag", price: "£28.00", href: "#", imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80" },
  { name: "Stoneware mug", price: "£18.00", compareAtPrice: "£24.00", badge: "Sale", href: "#", imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80" },
  { name: "Organic cotton tee", price: "£32.00", href: "#", imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80" },
  { name: "Product without an image", price: "£12.00", href: "#", imageUrl: "" },
];
const swatches: Array<[string, string]> = [
  ["Page background", "var(--jm-bg)"], ["Cards and panels", "var(--jm-surface)"], ["Text", "var(--jm-text)"],
  ["Soft text", "var(--jm-muted)"], ["Buttons", "var(--jm-ink)"], ["Highlight", "var(--jm-accent)"],
];
const spacing = [8, 16, 24, 32, 48, 64, 96];

function subscribeNoop() { return () => {}; }

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="jelly-section" style={{ paddingBlock: 48, borderTop: "1px solid var(--jm-border)" }}>
    <div className="jelly-container" style={{ display: "grid", gap: 24 }}>
      <p className="jelly-eyebrow">{title}</p>
      {children}
    </div>
  </section>;
}

function Guide() {
  return <>
    <RegistrySectionRenderer section={announcement} mode="preview" commerce={commerce} region="header" themeId={THEME_ID} menus={menus} storeSlug="style-guide" />
    <RegistrySectionRenderer section={header} mode="preview" commerce={commerce} region="header" themeId={THEME_ID} menus={menus} storeSlug="style-guide" />
    <div className="jelly-container" style={{ paddingBlock: 64, display: "grid", gap: 16 }}>
      <p className="jelly-eyebrow">Style guide</p>
      <h1>Jelly Minimal</h1>
      <p style={{ maxWidth: "52ch", color: "var(--jm-muted)", fontSize: "var(--jm-text-lg)" }}>The foundations every page of the theme is built from. Merchants change colours, fonts, sizes and corners from the editor&apos;s theme settings.</p>
    </div>
    <Block title="Colours">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
        {swatches.map(([label, value]) => <div key={label} style={{ display: "grid", gap: 8 }}>
          <span style={{ height: 72, background: value, border: "1px solid var(--jm-border)", borderRadius: "var(--jm-radius-card)" }} />
          <span style={{ fontSize: 13 }}>{label}</span>
        </div>)}
      </div>
    </Block>
    <Block title="Typography">
      <div style={{ display: "grid", gap: 20 }}>
        <h1>Find your everyday favourites</h1>
        <h2>The new collection</h2>
        <h3>Made to last, chosen with care</h3>
        <p style={{ maxWidth: "62ch" }}>Body text is set in a clean sans-serif at a comfortable reading size, with generous line height so product details and policies stay easy to read on any screen.</p>
        <p style={{ color: "var(--jm-muted)", fontSize: "var(--jm-text-sm)" }}>Soft text for supporting details, captions and helper messages.</p>
      </div>
    </Block>
    <Block title="Buttons">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <a className="jelly-button" href="#">Shop the collection</a>
        <a className="jelly-button jelly-button--secondary" href="#">Learn more</a>
        <a className="jelly-button jelly-button--link" href="#">View all products</a>
        <button className="jelly-button" type="button" disabled>Sold out</button>
      </div>
    </Block>
    <Block title="Form fields">
      <form style={{ display: "grid", gap: 16, maxWidth: 480 }} onSubmit={(event) => event.preventDefault()}>
        <label style={{ display: "grid", gap: 8 }}>Email<input type="email" placeholder="you@example.com" /></label>
        <label style={{ display: "grid", gap: 8 }}>Size<select defaultValue="m"><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option></select></label>
        <label style={{ display: "grid", gap: 8 }}>Message<textarea placeholder="How can we help?" /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" defaultChecked />Email me about new arrivals</label>
        <button className="jelly-button" type="submit" style={{ justifySelf: "start" }}>Send message</button>
      </form>
    </Block>
    <Block title="Product cards">
      <div className="jelly-product-grid-items">{products.map((product) => <StorefrontProductCard key={product.name} product={product} />)}</div>
    </Block>
    <Block title="Spacing scale (8px)">
      <div style={{ display: "grid", gap: 8 }}>{spacing.map((size) => <div key={size} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}><span style={{ width: 48 }}>{size}px</span><span style={{ width: size, height: 16, background: "var(--jm-ink)" }} /></div>)}</div>
    </Block>
    <Block title="Header with centred logo">
      <div style={{ border: "1px solid var(--jm-border)" }}><RegistrySectionRenderer section={centeredHeader} mode="preview" commerce={commerce} region="header" themeId={THEME_ID} menus={menus} storeSlug="style-guide" /></div>
    </Block>
    <RegistrySectionRenderer section={footer} mode="preview" commerce={commerce} region="footer" themeId={THEME_ID} menus={menus} storeSlug="style-guide" />
  </>;
}

export default function JellyMinimalStyleGuidePage() {
  const [device, setDevice] = useState<Device>("desktop");
  // The preview iframe must mount on the client so its load handler is attached before the frame loads.
  const ready = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const theme = resolveTheme(THEME_ID);
  const style = resolveStorefrontThemeTokens(theme.id, theme.settings) as CSSProperties;
  return <main style={{ minHeight: "100vh", background: "#eeece8", padding: 16, display: "grid", gap: 16, gridTemplateRows: "auto 1fr" }}>
    <header style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <strong style={{ fontSize: 14 }}>Jelly Minimal · style guide</strong>
      <div role="group" aria-label="Preview width" style={{ display: "flex", gap: 4, padding: 4, background: "white", borderRadius: 8 }}>
        {(Object.keys(widths) as Device[]).map((key) => <button key={key} type="button" aria-pressed={device === key} onClick={() => setDevice(key)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, background: device === key ? "#1c1b19" : "transparent", color: device === key ? "white" : "#1c1b19" }}>{key[0].toUpperCase() + key.slice(1)} · {widths[key]}px</button>)}
      </div>
    </header>
    <div style={{ width: widths[device], maxWidth: "100%", margin: "0 auto", minHeight: "80vh", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      {ready && <StorefrontPreviewFrame title="Jelly Minimal style guide" themeId={THEME_ID} style={style} className="block h-[80vh] w-full border-0">
        <Guide />
      </StorefrontPreviewFrame>}
    </div>
  </main>;
}
