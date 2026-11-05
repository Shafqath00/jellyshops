import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import type { ProductPresentationContext } from "../types";
import { resolveStorefrontHref } from "../runtime-context";

type Option = ProductPresentationContext["product"]["options"][number];
type OptionValue = Option["values"][number];
type Pricing = ProductPresentationContext["pricing"];

const SAFE_IMAGE = /^(https:\/\/|\/api\/public\/media\/|\/)[^\s"'<>]+$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** The picture for a tile: the value's own swatch image, its preview photo, or its colour. */
function tilePicture(option: Option, value: OptionValue): { kind: "image" | "color"; value: string } | null {
  if (option.display === "image" && value.image && SAFE_IMAGE.test(value.image)) return { kind: "image", value: value.image };
  if (value.previewImageUrl && SAFE_IMAGE.test(value.previewImageUrl)) return { kind: "image", value: value.previewImageUrl };
  if (option.display === "color" && value.color && HEX.test(value.color)) return { kind: "color", value: value.color };
  return null;
}

function TilePicture({ picture }: { picture: { kind: "image" | "color"; value: string } | null }) {
  if (!picture) return null;
  // eslint-disable-next-line @next/next/no-img-element -- merchant media may be served by the API
  if (picture.kind === "image") return <img className="jelly-option-tile-picture" src={picture.value} alt="" loading="lazy" />;
  return <span className="jelly-option-tile-picture" data-kind="color" style={{ "--swatch": picture.value } as CSSProperties} aria-hidden="true" />;
}

/** One option's values as large tiles: picture, name, extra cost, sold out. */
export function OptionTiles({ option, product }: { option: Option; product: ProductPresentationContext }) {
  return <div className="jelly-option-tiles">{option.values.map((value) => <button key={value.id} type="button" className="jelly-option-tile" aria-pressed={value.selected} disabled={!value.available} onClick={() => product.selectOption(option.id, value.id)}>
    <TilePicture picture={tilePicture(option, value)} />
    <span className="jelly-option-tile-label">{value.label}</span>
    {value.priceAdjustment && <span className="jelly-option-tile-price">+{value.priceAdjustment}</span>}
    {!value.available && <span className="jelly-option-tile-note">Sold out</span>}
  </button>)}</div>;
}

function OptionLegend({ option }: { option: Option }) {
  const chosen = option.values.filter((value) => value.selected);
  return <legend>{option.name}{chosen.length > 0 && <span>: {chosen.map((value) => value.label).join(", ")}</span>}{!option.required && chosen.length === 0 && <span> (optional)</span>}{option.missing && <span className="jelly-product-option-required" role="note"> (required)</span>}</legend>;
}

/** Every option as a group of large tiles, one under the other. */
export function OptionTileGroups({ product }: { product: ProductPresentationContext }) {
  return <>{product.product.options.map((option) => <fieldset key={option.id} aria-invalid={option.missing || undefined} data-missing={option.missing || undefined}>
    <OptionLegend option={option} />
    <OptionTiles option={option} product={product} />
  </fieldset>)}</>;
}

/**
 * Options as tabs (Colour, Size, Base…), each showing its values as large tiles. A tab shows the chosen value
 * (with its picture) so shoppers see their choices without opening each one. Arrow keys, Home and End move
 * between tabs; tabs whose choice is still missing are marked.
 */
export function OptionTabs({ product }: { product: ProductPresentationContext }) {
  const options = product.product.options;
  const [active, setActive] = useState(options[0]?.id);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const id = useId();
  const current = options.find((option) => option.id === active) ?? options[0];
  if (!current) return null;
  const move = (event: KeyboardEvent, index: number) => {
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const option = options[(next + options.length) % options.length];
    setActive(option.id);
    tabs.current[option.id]?.focus();
  };
  return <div className="jelly-option-tabs">
    <div role="tablist" aria-label="Product options" className="jelly-option-tablist">{options.map((option, index) => {
      const chosen = option.values.filter((value) => value.selected);
      const picture = chosen.length === 1 ? tilePicture(option, chosen[0]) : null;
      const selected = option.id === current.id;
      return <button key={option.id} ref={(node) => { tabs.current[option.id] = node; }} type="button" role="tab" id={`${id}-tab-${option.id}`} aria-selected={selected} aria-controls={`${id}-panel-${option.id}`} tabIndex={selected ? 0 : -1} data-missing={option.missing || undefined} className="jelly-option-tab" onClick={() => setActive(option.id)} onKeyDown={(event) => move(event, index)}>
        {picture ? <TilePicture picture={picture} /> : <span className="jelly-option-tab-step" aria-hidden="true">{index + 1}</span>}
        <span className="jelly-option-tab-text">
          <span className="jelly-option-tab-name">{option.name}{option.missing && <span className="jelly-product-option-required"> (required)</span>}</span>
          <span className="jelly-option-tab-value">{chosen.length ? chosen.map((value) => value.label).join(", ") : option.required ? "Choose" : "Optional"}</span>
        </span>
      </button>;
    })}</div>
    <div role="tabpanel" id={`${id}-panel-${current.id}`} aria-labelledby={`${id}-tab-${current.id}`} className="jelly-option-tabpanel">
      <fieldset aria-invalid={current.missing || undefined} data-missing={current.missing || undefined}>
        <OptionLegend option={current} />
        <OptionTiles option={current} product={product} />
      </fieldset>
    </div>
  </div>;
}

/** The saving and percentage off, when the product has a higher "was" price and the amounts are known. */
export function priceSaving(pricing: Pricing): { percent: number; saving?: string } | null {
  const { priceMinor, compareAtPriceMinor } = pricing;
  if (typeof priceMinor !== "number" || typeof compareAtPriceMinor !== "number" || priceMinor < 0 || compareAtPriceMinor <= priceMinor) return null;
  return { percent: Math.max(1, Math.round((1 - priceMinor / compareAtPriceMinor) * 100)), ...(pricing.format ? { saving: pricing.format(compareAtPriceMinor - priceMinor) } : {}) };
}

/** The monthly amount for finance over `months`, rounded up to the next minor unit so the payments cover the price. */
export function monthlyPayment(pricing: Pricing, months: number): string | null {
  if (!pricing.format || typeof pricing.priceMinor !== "number" || pricing.priceMinor <= 0 || !Number.isInteger(months) || months < 2) return null;
  return pricing.format(Math.ceil(pricing.priceMinor / months));
}

export function DiscountChip({ pricing, kind }: { pricing: Pricing; kind: unknown }) {
  const saving = priceSaving(pricing);
  if (!saving || (kind !== "percent" && kind !== "amount")) return null;
  const text = kind === "amount" && saving.saving ? `Save ${saving.saving}` : `${saving.percent}% off`;
  return <span className="jelly-price-chip">{text}</span>;
}

export function FinanceLine({ pricing, settings, storeSlug }: { pricing: Pricing; settings: Record<string, unknown>; storeSlug?: string }) {
  const months = typeof settings.financeMonths === "number" ? settings.financeMonths : 0;
  const amount = monthlyPayment(pricing, months);
  if (!amount) return null;
  const template = typeof settings.financeText === "string" && settings.financeText.includes("{amount}") ? settings.financeText : "or {amount} a month for {months} months";
  const [before, after] = template.replaceAll("{months}", String(months)).split("{amount}", 2);
  const href = resolveStorefrontHref(settings.financeLink, storeSlug);
  const label = typeof settings.financeLinkLabel === "string" && settings.financeLinkLabel.trim() ? settings.financeLinkLabel : "Learn more";
  return <p className="jelly-finance-line">{before}<strong>{amount}</strong>{after}{href && <> <a href={href}>{label}</a></>}</p>;
}

/**
 * Shows the bar once the page's own Add to basket button has scrolled up out of view, and hides it again when
 * the button comes back. Uses the frame's own IntersectionObserver so it works inside the editor preview.
 */
export function useStickyBar(enabled: boolean, target: RefObject<HTMLElement | null>): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const node = target.current;
    const Observer = node?.ownerDocument.defaultView?.IntersectionObserver;
    if (!enabled || !node || !Observer) return;
    const observer = new Observer(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(node);
    return () => { observer.disconnect(); setShow(false); };
  }, [enabled, target]);
  return enabled && show;
}

export function StickyPurchaseBar({ product, visible, label, busy, disabled, onAdd, anchor }: { product: ProductPresentationContext; visible: boolean; label: string; busy: boolean; disabled: boolean; onAdd(): void; anchor: RefObject<HTMLElement | null> }) {
  const needsChoice = product.availability.state === "selection-required";
  const chooseOptions = () => {
    const options = anchor.current?.ownerDocument.querySelector<HTMLElement>(".jelly-product-options");
    options?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Open the first tab still waiting for a choice; otherwise focus the first control of the missing (or first) option.
    const missingTab = options?.querySelector<HTMLElement>("[role=tab][data-missing]");
    if (missingTab) { missingTab.click(); missingTab.focus({ preventScroll: true }); return; }
    options?.querySelector<HTMLElement>("[data-missing] button:not(:disabled), [data-missing] select, [role=tab][aria-selected=true], button:not(:disabled), select")?.focus({ preventScroll: true });
  };
  const image = product.product.imageUrl;
  return <div className="jelly-sticky-purchase" role="region" aria-label="Quick add to basket" hidden={!visible} data-visible={visible || undefined}>
    {/* eslint-disable-next-line @next/next/no-img-element -- merchant media may be served by the API */}
    {image && <img src={image} alt="" className="jelly-sticky-purchase-image" />}
    <div className="jelly-sticky-purchase-text">
      <span className="jelly-sticky-purchase-title">{product.product.title}</span>
      <span className="jelly-sticky-purchase-price">{product.pricing.price}{product.pricing.compareAtPrice && <s aria-label={`Was ${product.pricing.compareAtPrice}`}>{product.pricing.compareAtPrice}</s>}</span>
    </div>
    {needsChoice
      ? <button type="button" className="jelly-button" onClick={chooseOptions}>Choose options</button>
      : <button type="button" className="jelly-button" disabled={disabled} onClick={onAdd}>{busy ? "Please wait…" : label}</button>}
  </div>;
}
