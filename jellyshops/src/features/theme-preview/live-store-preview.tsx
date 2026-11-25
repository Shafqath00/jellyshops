"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type FormEvent } from "react";
import { legacyStylesAttribute, resolveStorefrontThemeTokens, resolveTheme, themeRootAttributes, themeStyleId } from "@jelly/storefront-themes";
import type { ThemePreviewConfig } from "./configs";
import { TemplatePreview } from "./template-preview";
import styles from "./live-store-preview.module.css";
import { LIVE_PREVIEW_MESSAGE, isLivePage, pageForLink, type LivePage, type LivePreviewMessage } from "./live-preview-links";

/**
 * A design's whole sample store on one page, for the home page's live previews (shown there in a frame).
 * Store pages are the theme's own starter templates drawn by the live store's renderer (TemplatePreview);
 * clicking a menu link, a product, the bag or Check out opens that sample page here instead of leaving.
 * Checkout is a sample page: nothing is sent and no payment is taken.
 */
export function LiveStorePreview({ config, initialPage = "home" }: { config: ThemePreviewConfig; initialPage?: LivePage }) {
  const [page, setPage] = useState<LivePage>(initialPage);
  const root = useRef<HTMLDivElement>(null);
  const theme = resolveTheme(config.themeId, config.themeSettings);
  const style = resolveStorefrontThemeTokens(theme.id, theme.settings) as CSSProperties;

  // The page around the frame shows which page is open and can open another.
  useEffect(() => {
    const send = (message: LivePreviewMessage) => { if (window.parent !== window) window.parent.postMessage(message, window.location.origin); };
    send({ type: LIVE_PREVIEW_MESSAGE, kind: "at", page });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data as Partial<LivePreviewMessage> | null;
      if (data?.type === LIVE_PREVIEW_MESSAGE && data.kind === "go" && isLivePage(data.page)) setPage(data.page);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as Element).closest("a");
    if (!link || !root.current?.contains(link)) return;
    event.preventDefault();
    const inCard = Boolean(link.closest(".jelly-product-card, [data-card-part]"));
    const next = pageForLink(link.getAttribute("href"), inCard);
    if (next) setPage(next);
  }
  function onSubmit(event: FormEvent<HTMLDivElement>) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    if (form.querySelector('input[type="search"], input[name="q"]')) setPage("search");
  }

  return <div
    ref={root}
    data-live-preview={page}
    data-jelly-theme={themeStyleId(config.themeId)}
    data-jelly-legacy-styles={legacyStylesAttribute(config.themeId)}
    {...themeRootAttributes(style)}
    style={{ ...style, minHeight: "100dvh", background: "var(--theme-background)", color: "var(--theme-text)" }}
    onClickCapture={onClick}
    onSubmitCapture={onSubmit}
  >
    {page === "checkout"
      ? <SampleCheckout config={config} onBack={() => setPage("cart")} />
      : <TemplatePreview key={page} template={page === "collection" ? "collection" : page} config={config} />}
  </div>;
}

const pounds = (value: number) => `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const field: CSSProperties = { display: "grid", gap: 6, fontSize: 14 };
const input: CSSProperties = { boxSizing: "border-box", width: "100%", minWidth: 0, minHeight: 44, padding: "0 12px", border: "1px solid var(--theme-border)", borderRadius: "var(--jelly-radius-input, 8px)", background: "var(--theme-surface, #fff)", color: "inherit", font: "inherit" };
const card: CSSProperties = { display: "grid", gap: 16, padding: 24, border: "1px solid var(--theme-border)", borderRadius: "var(--jelly-radius-card, 12px)", background: "var(--theme-surface, transparent)" };

/** A sample checkout in the design's colours and fonts. Fields are filled with sample details and nothing is sent. */
function SampleCheckout({ config, onBack }: { config: ThemePreviewConfig; onBack: () => void }) {
  const lines = useMemo(() => config.products.filter((product) => config.cart[product.id]).map((product) => {
    const unit = Number(product.price.replace(/[^0-9.]/g, ""));
    return { id: product.id, name: product.name, imageUrl: product.imageUrl, quantity: config.cart[product.id], total: unit * config.cart[product.id] };
  }), [config]);
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  return <div style={{ minHeight: "100dvh", fontFamily: "var(--theme-font-body, inherit)" }}>
    <header style={{ borderBottom: "1px solid var(--theme-border)" }}>
      <div className="jelly-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 72 }}>
        <strong style={{ fontFamily: "var(--theme-font-heading, inherit)", fontSize: 22 }}>{config.name}</strong>
        <button type="button" className="jelly-button jelly-button--link" onClick={onBack}>Back to bag</button>
      </div>
    </header>
    <div className={`jelly-container ${styles.checkoutGrid}`} style={{ paddingBlock: 40 }}>
      <form style={{ display: "grid", gap: 24 }} onSubmit={(event) => event.preventDefault()} aria-label="Sample checkout">
        <h1 style={{ margin: 0, fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}>Checkout</h1>
        <p role="note" style={{ margin: 0, padding: "12px 16px", borderRadius: 8, background: "color-mix(in srgb, var(--jelly-color-primary) 10%, transparent)", fontSize: 14 }}>
          Sample checkout: shoppers pay by card through Stripe on your live store. Nothing here is sent or charged.
        </p>
        <section style={card} aria-labelledby="live-checkout-contact">
          <h2 id="live-checkout-contact" style={{ margin: 0, fontSize: 20 }}>1. Your details</h2>
          <label style={field}>Email<input style={input} type="email" defaultValue="sam@example.com" autoComplete="off" /></label>
          <label style={field}>Full name<input style={input} defaultValue="Sam Taylor" autoComplete="off" /></label>
        </section>
        <section style={card} aria-labelledby="live-checkout-delivery">
          <h2 id="live-checkout-delivery" style={{ margin: 0, fontSize: 20 }}>2. Delivery</h2>
          <label style={field}>Address<input style={input} defaultValue="12 Harbour Street" autoComplete="off" /></label>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <label style={field}>Town or city<input style={input} defaultValue="Bristol" autoComplete="off" /></label>
            <label style={field}>Postcode<input style={input} defaultValue="BS1 4DJ" autoComplete="off" /></label>
          </div>
          <p style={{ margin: 0, fontSize: 14 }}>Standard delivery · 3 to 5 working days · Free</p>
        </section>
        <section style={card} aria-labelledby="live-checkout-payment">
          <h2 id="live-checkout-payment" style={{ margin: 0, fontSize: 20 }}>3. Payment</h2>
          <div aria-hidden="true" style={{ ...input, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: .8 }}><span>•••• •••• •••• 4242</span><span>12 / 30</span></div>
          <button type="submit" className="jelly-button" style={{ width: "100%" }} aria-disabled="true">Pay {pounds(subtotal)}</button>
        </section>
      </form>
      <aside style={{ ...card, alignSelf: "start" }} aria-label="Order summary">
        <h2 style={{ margin: 0, fontSize: 20 }}>Order summary</h2>
        <ul style={{ display: "grid", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>
          {lines.map((line) => <li key={line.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 12, alignItems: "center", fontSize: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- sample photos from the theme's preview data */}
            <img src={line.imageUrl} alt="" width={56} height={56} loading="lazy" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
            <span>{line.name}<br /><span style={{ color: "var(--jelly-color-secondary)" }}>Qty {line.quantity}</span></span>
            <span>{pounds(line.total)}</span>
          </li>)}
        </ul>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, margin: 0, paddingTop: 16, borderTop: "1px solid var(--theme-border)", fontSize: 14 }}>
          <dt>Subtotal</dt><dd style={{ margin: 0 }}>{pounds(subtotal)}</dd>
          <dt>Delivery</dt><dd style={{ margin: 0 }}>Free</dd>
          <dt style={{ fontWeight: 600, fontSize: 16 }}>Total</dt><dd style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>{pounds(subtotal)}</dd>
        </dl>
      </aside>
    </div>
  </div>;
}
