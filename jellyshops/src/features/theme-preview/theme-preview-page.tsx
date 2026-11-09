"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { CardCartContext, CardRatingsContext, ProductCard, RegistrySectionRenderer, type CommerceDataProvider, type StorefrontPageContext } from "@jelly/storefront-renderer";
import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import { applyThemeStyle, listThemeStyles, resolveStorefrontThemeTokens, resolveTheme } from "@jelly/storefront-themes";
import { StorefrontProductCard } from "@jelly/storefront-ui";
import { StorefrontPreviewFrame } from "@/features/store-editor/components/storefront-preview-frame";
import type { ThemePreviewConfig } from "./configs";
import { sampleReviews } from "./sample-reviews";
import { TemplatePreview, type PreviewTemplate , previewHasCompare, usePreviewCart, withPreviewQuickAdd } from "./template-preview";

/**
 * A theme's style guide: its tokens, type, controls and the shared
 * header/footer/product-card components, rendered with the same renderer and
 * stylesheet as live storefronts, plus every starter template with sample
 * data. Uses sample content only; no store data. Values come from the shared
 * token layer (--theme-*, --jelly-*) so the page works for every theme.
 */
const widths = { desktop: 1280, tablet: 768, mobile: 390 } as const;
type Device = keyof typeof widths;
const views = [["guide", "Style guide"], ["home", "Home"], ["collection", "Collection"], ["product", "Product"], ["cart", "Cart"], ["search", "Search"], ["page", "Page"], ["not-found", "404"], ["compare", "Compare"]] as const;
type View = (typeof views)[number][0];

const commerce: CommerceDataProvider = { async getProducts() { return []; } };
const reviewsCommerce: CommerceDataProvider = { ...commerce, reviews: sampleReviews };
const reviewsPage = { pageType: "product", resource: { id: "sample", handle: "sample", data: { productPresentation: { product: { id: "sample", title: "Sample" } } } } } as unknown as StorefrontPageContext;
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
const swatches: Array<[string, string]> = [
  ["Page background", "var(--theme-background)"], ["Cards and panels", "var(--theme-surface)"], ["Text", "var(--theme-text)"],
  ["Soft text", "var(--jelly-color-secondary)"], ["Buttons", "var(--jelly-color-primary)"], ["Highlight", "var(--theme-accent)"],
];
const spacing = [8, 16, 24, 32, 48, 64, 96];
/** The hero layouts added for the template programme (the older split, overlay and text layouts show on the Home tab). */
const heroLayouts = [
  ["spotlight", "Product on a colour, with callouts"],
  ["statement", "Large statement"],
  ["countdown", "Countdown to a launch"],
] as const;
/** Five days from now in the "2026-12-01 18:00" form the countdown setting uses. */
function countdownSample(): string {
  const date = new Date(Date.now() + 5 * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} 18:00`;
}
/** Collection layouts (collection product grid > Layout). */
const collectionLayouts = [
  ["theme", "Theme default"],
  ["grid", "Grid"],
  ["sidebar", "Filters in a sidebar"],
  ["chips", "Filter chips"],
  ["editorial", "Editorial, with a story tile"],
] as const;
/** Product page layouts (Product gallery > Product page layout). */
const productLayouts = [
  ["theme", "Theme default"],
  ["gallery-left", "Photos left, details right"],
  ["gallery-right", "Details left, photos right"],
  ["centred", "Centred"],
  ["compact", "Small photo, large buying area"],
  ["details-below", "Then full-width details"],
] as const;
/** Every product card style (theme setting Product cards > Card style). */
const cardLayouts = [
  ["tall", "Tall photo, few words"],
  ["square", "Square photo with details"],
  ["tinted", "Product on a soft colour"],
  ["technical", "Outlined, for specifications"],
  ["landscape", "Wide lifestyle photo"],
  ["quick-add", "Quick add, for everyday shopping"],
] as const;
/** Every header layout, so each theme can be reviewed with all of them. */
const headerLayouts = [
  ["split", "Logo in the middle, menu on both sides"],
  ["minimal", "Minimal: menu button opens a full-screen menu"],
  ["category-bar", "Two rows: search, then a category bar"],
  ["search-first", "Search first, with a delivery note"],
] as const;
const muted = "var(--jelly-color-secondary)";
const border = "1px solid var(--theme-border)";

function subscribeNoop() { return () => {}; }

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="jelly-section" style={{ paddingBlock: 48, borderTop: border }}>
    <div className="jelly-container" style={{ display: "grid", gap: 24 }}>
      <p className="jelly-eyebrow">{title}</p>
      {children}
    </div>
  </section>;
}

function Guide({ config }: { config: ThemePreviewConfig }) {
  const previewCart = usePreviewCart();
  const themeId = config.themeId;
  const announcement = section("guide-announcement", "announcement-bar", { text: config.guide.announcement });
  const header = section("guide-header", "header", { storeName: config.name }, [menuBlock("guide-header-menu")]);
  const altHeader = section("guide-header-alt", "header", { storeName: config.name, logoPosition: themeId === "jelly-avenue" ? "left" : "center" }, [menuBlock("guide-header-alt-menu")]);
  const footer = section("guide-footer", "footer", { storeName: config.name, text: config.guide.footerText, contactEmail: "hello@example.com" }, [
    menuBlock("guide-footer-menu"),
    { id: "guide-footer-instagram", type: "social-link", enabled: true, settings: { label: "Instagram", href: "https://instagram.com" } } as SectionNode["blocks"][number],
    { id: "guide-footer-hours", type: "contact-item", enabled: true, settings: { label: "Hours", value: "Mon–Fri, 9am–5pm" } } as SectionNode["blocks"][number],
  ]);
  const cards = [...config.products.slice(0, 3), { ...config.products[3], name: "Product without an image", imageUrl: "", badge: undefined }];
  return <>
    <RegistrySectionRenderer section={announcement} mode="preview" commerce={commerce} region="header" themeId={themeId} menus={menus} storeSlug="style-guide" />
    <RegistrySectionRenderer section={header} mode="preview" commerce={commerce} region="header" themeId={themeId} menus={menus} storeSlug="style-guide" />
    <div className="jelly-container" style={{ paddingBlock: 64, display: "grid", gap: 16 }}>
      <p className="jelly-eyebrow">Style guide</p>
      <h1>{config.name}</h1>
      <p style={{ maxWidth: "52ch", color: muted, fontSize: 18 }}>The foundations every page of the theme is built from. Merchants change colours, fonts, sizes and corners from the editor&apos;s theme settings.</p>
    </div>
    <Block title="Colours">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
        {swatches.map(([label, value]) => <div key={label} style={{ display: "grid", gap: 8 }}>
          <span style={{ height: 72, background: value, border, borderRadius: "var(--jelly-radius-card)" }} />
          <span style={{ fontSize: 13 }}>{label}</span>
        </div>)}
      </div>
    </Block>
    <Block title="Typography">
      <div style={{ display: "grid", gap: 20 }}>
        <h1>{config.guide.heading}</h1>
        <h2>{config.guide.subheading}</h2>
        <h3>Made to last, chosen with care</h3>
        <p style={{ maxWidth: "62ch" }}>{config.guide.body}</p>
        <p style={{ color: muted, fontSize: 14 }}>Soft text for supporting details, captions and helper messages.</p>
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
      <div className="jelly-product-grid-items">{cards.map((product) => <StorefrontProductCard key={product.name} product={product} />)}</div>
    </Block>
    <Block title="Spacing scale (8px)">
      <div style={{ display: "grid", gap: 8 }}>{spacing.map((size) => <div key={size} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}><span style={{ width: 48 }}>{size}px</span><span style={{ width: size, height: 16, background: "var(--jelly-color-primary)" }} /></div>)}</div>
    </Block>
    <Block title={altHeader.settings.logoPosition === "center" ? "Header with centred logo" : "Header with logo on the left"}>
      <div style={{ border }}><RegistrySectionRenderer section={altHeader} mode="preview" commerce={commerce} region="header" themeId={themeId} menus={menus} storeSlug="style-guide" /></div>
    </Block>
    <Block title="Hero layouts">
      {heroLayouts.map(([layout, label]) => <div key={layout} data-guide-hero-layout={layout} style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, color: muted }}>{label}</p>
        <div style={{ border }}><RegistrySectionRenderer section={section(`guide-hero-${layout}`, "hero", {
          layout, eyebrow: layout === "countdown" ? "Drop 07" : "New",
          image: { url: (layout === "spotlight" ? config.products[0] : config.products[1]).imageUrl, alt: "" },
          callouts: "Made to last\nFree delivery\nTwo-year guarantee", countdownTo: countdownSample(), countdownEndText: "Out now",
        }, [
          { id: `guide-hero-${layout}-heading`, type: "heading", enabled: true, settings: { text: layout === "statement" ? "Made slowly, worn for years" : config.guide.heading } },
          { id: `guide-hero-${layout}-button`, type: "button", enabled: true, settings: { label: "Shop now", href: "/shop" } },
        ] as SectionNode["blocks"])} mode="preview" commerce={commerce} region="template" themeId={themeId} menus={menus} storeSlug="style-guide" /></div>
      </div>)}
    </Block>
    <Block title="Reviews">
      <div style={{ border }}><RegistrySectionRenderer section={section("guide-reviews", "product-reviews", { heading: "Customer reviews", allowWriting: true, perPage: 5 })} mode="preview" commerce={reviewsCommerce} region="template" themeId={themeId} page={reviewsPage} menus={menus} storeSlug="style-guide" /></div>
    </Block>
    <Block title="Card styles">
      <p style={{ margin: 0, fontSize: 13, color: muted }}>Shown with star ratings on (Product cards &gt; Show star ratings).</p>
      <CardRatingsContext.Provider value={Object.fromEntries(cards.map((product, index) => [product.id, { average: [4.8, 4.2, 3.6, 5][index % 4], count: [128, 12, 5, 1][index % 4] }]))}><div style={{ display: "grid", gap: 24, "--jelly-card-rating-display": "flex" } as CSSProperties}><CardCartContext.Provider value={previewCart}>{cardLayouts.map(([layout, label]) => <div key={layout} data-card-layout={layout} style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, color: muted }}>{label}</p>
        <div className="jelly-product-grid-items">{withPreviewQuickAdd(cards.slice(0, 3)).map((product) => <ProductCard key={product.name} product={{ ...product, chip: layout === "technical" ? "USB-C · 40h" : layout === "tinted" ? "For dry skin" : layout === "square" ? "New" : undefined }} />)}</div>
      </div>)}</CardCartContext.Provider></div></CardRatingsContext.Provider>
    </Block>
    <Block title="Header layouts">
      {headerLayouts.map(([layout, label]) => <div key={layout} data-guide-header-layout={layout} style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, color: muted }}>{label}</p>
        <div style={{ border }}><RegistrySectionRenderer section={section(`guide-header-${layout}`, "header", { storeName: config.name, layout, deliveryNote: layout === "search-first" ? "Delivery today from 6pm" : undefined }, [menuBlock(`guide-header-${layout}-menu`)])} mode="preview" commerce={commerce} region="header" themeId={themeId} menus={menus} storeSlug="style-guide" /></div>
      </div>)}
    </Block>
    <RegistrySectionRenderer section={footer} mode="preview" commerce={commerce} region="footer" themeId={themeId} menus={menus} storeSlug="style-guide" />
  </>;
}

export function ThemePreviewPage({ config }: { config: ThemePreviewConfig }) {
  const [device, setDevice] = useState<Device>("desktop");
  const [view, setView] = useState<View>("guide");
  // The preview iframe must mount on the client so its load handler is attached before the frame loads.
  const ready = useSyncExternalStore(subscribeNoop, () => true, () => false);
  // Designer theme styles, so each can be reviewed on every page; the first is the theme's default look.
  const themeStyles = listThemeStyles(config.themeId);
  const [styleId, setStyleId] = useState(themeStyles[0]?.id);
  const [productLayout, setProductLayout] = useState("theme");
  const [collectionLayout, setCollectionLayout] = useState("theme");
  const themeStyle = themeStyles.find((item) => item.id === styleId);
  const base = resolveTheme(config.themeId);
  const theme = themeStyle ? resolveTheme(config.themeId, applyThemeStyle(base.settings, themeStyle)) : base;
  const style = resolveStorefrontThemeTokens(theme.id, theme.settings) as CSSProperties;
  const toggle = (active: boolean): CSSProperties => ({ padding: "6px 12px", borderRadius: 6, fontSize: 13, background: active ? "#1c1b19" : "transparent", color: active ? "white" : "#1c1b19" });
  return <main style={{ minHeight: "100vh", background: config.stageColor, padding: 16, display: "grid", gap: 16, gridTemplateRows: "auto 1fr" }}>
    <header style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <strong style={{ fontSize: 14 }}>{config.name} · theme preview</strong>
      <div role="group" aria-label="Page" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, background: "white", borderRadius: 8 }}>
        {views.filter(([key]) => key !== "compare" || previewHasCompare(config)).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} style={toggle(view === key)}>{label}</button>)}
      </div>
      {themeStyles.length > 0 && <div role="group" aria-label="Theme style" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, background: "white", borderRadius: 8 }}>
        {themeStyles.map((item) => <button key={item.id} type="button" aria-pressed={styleId === item.id} title={item.description} onClick={() => setStyleId(item.id)} style={toggle(styleId === item.id)}>{item.name}</button>)}
      </div>}
      {view === "product" && <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 10px", background: "white", borderRadius: 8, fontSize: 13 }}>Product layout
        <select value={productLayout} onChange={(event) => setProductLayout(event.target.value)} style={{ fontSize: 13 }}>
          {productLayouts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>}
      {view === "collection" && <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 10px", background: "white", borderRadius: 8, fontSize: 13 }}>Collection layout
        <select value={collectionLayout} onChange={(event) => setCollectionLayout(event.target.value)} style={{ fontSize: 13 }}>
          {collectionLayouts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>}
      <div role="group" aria-label="Preview width" style={{ display: "flex", gap: 4, padding: 4, background: "white", borderRadius: 8 }}>
        {(Object.keys(widths) as Device[]).map((key) => <button key={key} type="button" aria-pressed={device === key} onClick={() => setDevice(key)} style={toggle(device === key)}>{key[0].toUpperCase() + key.slice(1)} · {widths[key]}px</button>)}
      </div>
    </header>
    <div style={{ width: widths[device], maxWidth: "100%", margin: "0 auto", minHeight: "80vh", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      {ready && <StorefrontPreviewFrame title={`${config.name} style guide`} themeId={config.themeId} style={style} className="block h-[80vh] w-full border-0">
        {view === "guide" ? <Guide config={config} /> : <TemplatePreview key={view} template={view as PreviewTemplate} config={config} productLayout={productLayout === "theme" ? undefined : productLayout} collectionLayout={collectionLayout === "theme" ? undefined : collectionLayout} onOpenCompare={() => setView("compare")} />}
      </StorefrontPreviewFrame>}
    </div>
  </main>;
}
