import { createContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicProduct, QuickViewProduct, StorefrontCartAccess, StorefrontQuickViewAccess } from "./types";

/** Quick view for product cards; provided per section by RegistrySectionRenderer (live store only). */
export const CardQuickViewContext = createContext<StorefrontQuickViewAccess | undefined>(undefined);

type Choice = NonNullable<PublicProduct["setChoices"]>["values"][number];

/** The size a quick view starts on: the only one, else none (the shopper picks, as on the product page). */
export function initialQuickViewChoice(product: Pick<QuickViewProduct, "setChoices">): string | undefined {
  const values = product.setChoices?.values ?? [];
  return values.length === 1 && values[0].max > 0 ? values[0].variantId : undefined;
}

/**
 * "Quick view" on a product card: opens the product in a modal pop-up (native <dialog>, so focus stays inside and
 * Escape closes it) with its photos, price, sizes and Add to bag. Products the card cannot add straight away (other
 * required choices) still open, with a link to their page instead of the button.
 */
export function QuickViewButton({ product, quickView, cart }: { product: PublicProduct; quickView: StorefrontQuickViewAccess; cart?: StorefrontCartAccess }) {
  const [data, setData] = useState<QuickViewProduct | null>(null);
  const [loading, setLoading] = useState(false);
  // Where the pop-up is drawn: inside the theme root, so it keeps the theme colours and fonts.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const open = async () => {
    setHost(trigger.current?.closest<HTMLElement>("[data-jelly-theme]") ?? document.body);
    setLoading(true);
    try { setData((await quickView.load(product.id)) ?? null); } finally { setLoading(false); }
  };
  const close = () => { setData(null); trigger.current?.focus(); };
  return <>
    <button ref={trigger} type="button" className="jelly-quick-view-button" onClick={() => void open()} aria-haspopup="dialog" data-loading={loading ? "true" : undefined} aria-label={`Quick view: ${product.name}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
      <span>Quick view</span>
    </button>
    {data && host ? createPortal(<QuickViewDialog product={data} cart={cart} onClose={close} />, host) : null}
  </>;
}

export function QuickViewDialog({ product, cart, onClose }: { product: QuickViewProduct; cart?: StorefrontCartAccess; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const images = product.images.length ? product.images : [product.imageUrl];
  const [photo, setPhoto] = useState(0);
  const [choice, setChoice] = useState<string | undefined>(() => initialQuickViewChoice(product));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const choices = product.setChoices?.values ?? [];
  const chosen: Choice | undefined = choices.find((value) => value.variantId === choice);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    const scroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = scroll; };
  }, []);

  const add = async () => {
    if (!cart || !chosen || chosen.max === 0) return;
    setBusy(true);
    setMessage("");
    const result = await cart.setQuantity(chosen.variantId, Math.min(chosen.max, cart.quantity(chosen.variantId) + 1)).catch(() => ({ ok: false, message: undefined }));
    setBusy(false);
    if (!result.ok) { setMessage(result.message ?? "Could not add this to your bag."); return; }
    window.dispatchEvent(new CustomEvent("jelly:cart-changed"));
    onClose();
    // The slide-out bag (when the theme uses one) opens on this event.
    window.dispatchEvent(new CustomEvent("jelly:cart-added"));
  };

  const price = chosen?.price ?? product.price;
  const compare = chosen
    ? (chosen.compareAtPriceMinor && chosen.priceMinor && chosen.compareAtPriceMinor > chosen.priceMinor ? formatLike(chosen.price, chosen.compareAtPriceMinor) : undefined)
    : product.compareAtPrice;
  const from = !chosen && choices.length > 1;
  const canAdd = Boolean(cart && product.setChoices && choices.length);

  return <dialog ref={ref} className="jelly-quick-view" aria-labelledby={titleId} onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="jelly-quick-view-panel">
      <button type="button" className="jelly-quick-view-close" onClick={onClose} aria-label="Close quick view">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div className="jelly-quick-view-media">
        <div className="jelly-quick-view-photo">
          <img src={images[photo]} alt={photo === 0 ? product.name : `${product.name}, photo ${photo + 1}`} />
          {product.badge ? <span className="jelly-quick-view-badge">{product.badge}</span> : null}
        </div>
        {images.length > 1 && <div className="jelly-quick-view-thumbs" role="group" aria-label="Photos">
          {images.slice(0, 6).map((url, index) => <button key={url + index} type="button" aria-label={`Show photo ${index + 1}`} aria-pressed={photo === index} onClick={() => setPhoto(index)}><img src={url} alt="" loading="lazy" /></button>)}
        </div>}
      </div>
      <div className="jelly-quick-view-details">
        {product.vendor ? <p className="jelly-quick-view-vendor">{product.vendor}</p> : null}
        <h2 id={titleId} className="jelly-quick-view-title">{product.name}</h2>
        {product.rating && product.rating.count > 0 ? <p className="jelly-quick-view-rating"><span aria-hidden="true">{"★★★★★".slice(0, Math.round(product.rating.average))}<span className="jelly-quick-view-rating-rest">{"★★★★★".slice(Math.round(product.rating.average))}</span></span> <span>{product.rating.average.toFixed(1)} ({product.rating.count} {product.rating.count === 1 ? "review" : "reviews"})</span></p> : null}
        <p className="jelly-quick-view-price">
          {from ? <span className="jelly-quick-view-from">From </span> : null}<span data-sale={compare ? "true" : undefined}>{price}</span>
          {compare ? <s aria-label={`Was ${compare}`}>{compare}</s> : null}
        </p>
        {product.summary ? <p className="jelly-quick-view-summary">{product.summary}</p> : null}
        {canAdd && choices.length > 1 && <fieldset className="jelly-quick-view-choices">
          <legend>{product.setChoices?.optionName || "Choose"}{chosen ? <span>: {chosen.label}</span> : null}</legend>
          <div>
            {choices.map((value) => <label key={value.variantId} data-sold-out={value.max === 0 ? "true" : undefined}>
              <input type="radio" name={`${titleId}-choice`} value={value.variantId} checked={choice === value.variantId} disabled={value.max === 0} onChange={() => setChoice(value.variantId)} />
              <span className="jelly-quick-view-choice-label">{value.label}</span>
              <span className="jelly-quick-view-choice-price">{value.max === 0 ? "Sold out" : value.price}</span>
            </label>)}
          </div>
        </fieldset>}
        {canAdd
          ? <button type="button" className="jelly-button jelly-quick-view-add" disabled={busy || !chosen || chosen.max === 0} onClick={() => void add()}>
            {busy ? "Adding…" : chosen ? (chosen.max === 0 ? "Sold out" : "Add to bag") : `Choose a ${(product.setChoices?.optionName || "size").toLowerCase()}`}
          </button>
          : null}
        <p className="jelly-quick-view-message" role="status" aria-live="polite">{message}</p>
        <a className="jelly-quick-view-link" href={product.href}>See all details and options</a>
      </div>
    </div>
  </dialog>;
}

/** Formats a minor amount the way an existing price string is written ("£1,197.00" style), for the was-price. */
function formatLike(sample: string, minor: number): string {
  const symbol = sample.match(/^[^\d-]*/)?.[0] ?? "";
  const amount = (minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${amount}`;
}
