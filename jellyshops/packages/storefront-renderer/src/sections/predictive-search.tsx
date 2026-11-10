import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { PublicProduct } from "../types";

/**
 * Search box with suggestions while the shopper types (Shopify's predictive search): up to five matching products
 * with photo, name and price, then "Search for …" which opens the full search page. A combobox: arrow keys move
 * through the suggestions, Enter opens the one chosen, Escape closes the list; the number of suggestions is read out.
 * Without suggestions (the editor, or no products yet) it is a plain search form.
 */
export const SUGGESTION_LIMIT = 5;

export function PredictiveSearch({ action, suggest, autoFocus = false, icon, onEscape }: {
  /** The store's search page. */
  action: string;
  suggest?: (query: string, limit: number) => Promise<PublicProduct[]> | PublicProduct[];
  autoFocus?: boolean;
  icon: ReactNode;
  /** Escape with an empty list (the search panel closes). */
  onEscape?(): void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; products: PublicProduct[] }>({ query: "", products: [] });
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (!suggest || !trimmed) return;
    let current = true;
    void Promise.resolve(suggest(trimmed, SUGGESTION_LIMIT)).then((products) => { if (current) setFound({ query: trimmed, products: products.slice(0, SUGGESTION_LIMIT) }); }).catch(() => undefined);
    return () => { current = false; };
  }, [suggest, trimmed]);

  // Close when focus or a tap goes elsewhere.
  useEffect(() => {
    const form = formRef.current;
    const doc = form?.ownerDocument;
    if (!open || !form || !doc) return;
    const outside = (event: Event) => { if (!form.contains(event.target as Node)) setOpen(false); };
    doc.addEventListener("pointerdown", outside);
    doc.addEventListener("focusin", outside);
    return () => { doc.removeEventListener("pointerdown", outside); doc.removeEventListener("focusin", outside); };
  }, [open]);

  const products = suggest && trimmed && found.query === trimmed ? found.products : [];
  const searchHref = `${action}?q=${encodeURIComponent(trimmed)}`;
  const options = [...products.map((product) => ({ key: product.id, href: product.href })), ...(trimmed ? [{ key: "search-all", href: searchHref }] : [])];
  const showList = Boolean(suggest) && open && trimmed.length > 0;
  const optionId = (index: number) => `${id}-option-${index}`;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (showList) { event.preventDefault(); setOpen(false); setActive(-1); } else onEscape?.();
      return;
    }
    if (!showList || !options.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % options.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index <= 0 ? options.length - 1 : index - 1)); }
    if (event.key === "Enter" && active >= 0 && options[active]) {
      event.preventDefault();
      formRef.current?.ownerDocument.defaultView?.location.assign(options[active].href);
    }
  };

  return <form ref={formRef} className="jelly-header-search" role="search" aria-label="Search the store" action={action} method="get" data-predictive={suggest ? "true" : undefined}>
    <label className="jelly-visually-hidden" htmlFor={`${id}-input`}>Search products</label>
    <input
      id={`${id}-input`} name="q" type="search" placeholder="Search products" autoComplete="off" autoFocus={autoFocus}
      value={query}
      onChange={(event) => { setQuery(event.currentTarget.value); setOpen(true); setActive(-1); }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      {...(suggest ? { role: "combobox", "aria-autocomplete": "list" as const, "aria-expanded": showList, "aria-controls": listId, "aria-activedescendant": showList && active >= 0 ? optionId(active) : undefined } : {})}
    />
    <button type="submit" aria-label="Search">{icon}</button>
    {suggest && <p className="jelly-visually-hidden" role="status">{showList ? (products.length ? `${products.length} ${products.length === 1 ? "suggestion" : "suggestions"}` : "No suggestions") : ""}</p>}
    {showList && <div className="jelly-predictive">
      <ul id={listId} role="listbox" aria-label="Suggestions">
        {products.map((product, index) => <li key={product.id} id={optionId(index)} role="option" aria-selected={active === index} data-active={active === index ? "true" : undefined}>
          <a href={product.href} tabIndex={-1}>
            {/* eslint-disable-next-line @next/next/no-img-element -- merchant media, not a Next Image asset */}
            {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span className="jelly-predictive-photo" aria-hidden="true" />}
            <span className="jelly-predictive-name">{product.name}</span>
            <span className="jelly-predictive-price">{product.price}</span>
          </a>
        </li>)}
        <li id={optionId(products.length)} role="option" aria-selected={active === products.length} data-active={active === products.length ? "true" : undefined} className="jelly-predictive-all">
          <a href={searchHref} tabIndex={-1}>Search for &ldquo;{trimmed}&rdquo;</a>
        </li>
      </ul>
    </div>}
  </form>;
}
