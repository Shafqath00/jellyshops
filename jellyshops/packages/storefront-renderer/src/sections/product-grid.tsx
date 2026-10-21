import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { CommerceDataProvider, PublicProduct } from "../types";
import { resolveStorefrontHref } from "../runtime-context";
import { sectionData, stringValue, visibleBlocks } from "./shared";

export function ProductGridSection({ commerce, section, storeSlug }: { commerce: CommerceDataProvider; section: import("@jelly/storefront-schema").SectionNode; storeSlug?: string }) {
  const [result, setResult] = useState<{ source: CommerceDataProvider; limit: number; scope: string; products: PublicProduct[]; error?: boolean }>();
  const [retry, setRetry] = useState(0);
  const [tabId, setTabId] = useState<string>();
  const panelId = useId();
  // Optional "product-tab" blocks switch the grid between lists (for example New in / Best sellers).
  const tabs = visibleBlocks(section, "product-tab").flatMap((block) => {
    const label = stringValue(block.settings, "label");
    return label ? [{ id: block.id, label, sort: stringValue(block.settings, "sort") || undefined, collectionId: typeof block.settings.collectionId === "string" ? block.settings.collectionId : undefined }] : [];
  });
  const activeTab = tabs.find((tab) => tab.id === tabId) ?? tabs[0];
  const sort = activeTab ? activeTab.sort : typeof section.settings.sort === "string" ? section.settings.sort : undefined;
  const collectionId = activeTab ? activeTab.collectionId : typeof section.settings.collectionId === "string" ? section.settings.collectionId : undefined;
  const scope = JSON.stringify([sort, collectionId, retry]);
  const limit = typeof section.settings.limit === "number" && Number.isInteger(section.settings.limit)
    ? Math.max(1, Math.min(24, section.settings.limit))
    : 6;
  const heading = typeof section.settings.heading === "string" ? section.settings.heading : "";
  const emptyMessage = typeof section.settings.emptyMessage === "string"
    ? section.settings.emptyMessage
    : "Products will appear here once you add them to your store.";
  const current = result?.source === commerce && result.limit === limit && result.scope === scope ? result : undefined;
  const initial = sort || collectionId ? undefined : commerce.initialProducts;
  const products = current?.products ?? initial?.slice(0, limit) ?? [];
  const loaded = Boolean(current || initial);
  useEffect(() => {
    let active = true;
    void commerce.getProducts({ featured: true, limit, ...(sort ? { sort } : {}), ...(collectionId ? { collectionId } : {}) }).then((result) => {
      if (active) {
        setResult({ source: commerce, limit, scope, products: result.slice(0, limit) });
      }
    }).catch(() => {
      if (active) {
        setResult({ source: commerce, limit, scope, products: [], error: true });
      }
    });
    return () => { active = false; };
  }, [commerce, limit, scope, sort, collectionId]);
  if (loaded && !products.length && !current?.error && section.settings.hideWhenEmpty === true) return null;
  const intro = typeof section.settings.text === "string" ? section.settings.text : "";
  const viewAllLabel = typeof section.settings.viewAllLabel === "string" ? section.settings.viewAllLabel.trim() : "";
  const viewAllHref = viewAllLabel ? resolveStorefrontHref(section.settings.viewAllLink || "/shop", storeSlug) : null;
  const columns = typeof section.settings.columns === "number" && Number.isInteger(section.settings.columns) ? Math.max(2, Math.min(4, section.settings.columns)) : 4;
  const align = section.settings.contentAlignment === "left" || section.settings.contentAlignment === "center" ? section.settings.contentAlignment : undefined;
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setTabId(next.id);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)?.focus();
  };
  return <section className="jelly-section jelly-product-grid" {...sectionData(section, { "data-align": align })}><StorefrontContainer>
    {(heading || viewAllHref || tabs.length > 1) && <div className="jelly-section-header">
      <div>{heading && <h2>{heading}</h2>}{intro && <p>{intro}</p>}</div>
      {tabs.length > 1 && <div className="jelly-product-tabs" role="tablist" aria-label={heading || "Product lists"}>{tabs.map((tab, index) => <button
        key={tab.id}
        type="button"
        role="tab"
        id={`${panelId}-${tab.id}`}
        data-tab-id={tab.id}
        aria-selected={tab.id === activeTab?.id}
        aria-controls={panelId}
        tabIndex={tab.id === activeTab?.id ? 0 : -1}
        onClick={() => setTabId(tab.id)}
        onKeyDown={(event) => onTabKey(event, index)}
      >{tab.label}</button>)}</div>}
      {viewAllHref && <a className="jelly-button jelly-button--link" href={viewAllHref}>{viewAllLabel}</a>}
    </div>}
    {current?.error ? <p role="alert">Products are temporarily unavailable. <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p> : loaded && products.length === 0 && <p className="jelly-empty-state">{emptyMessage}</p>}
    <div className="jelly-product-grid-items" style={{ "--jelly-columns": columns } as CSSProperties} {...(tabs.length > 1 ? { id: panelId, role: "tabpanel", "aria-labelledby": `${panelId}-${activeTab?.id}` } : {})}>{products.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>
  </StorefrontContainer></section>;
}
