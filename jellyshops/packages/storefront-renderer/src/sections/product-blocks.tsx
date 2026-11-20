import { useContext, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import type { BlockNode } from "@jelly/storefront-schema";
import { blockLabel } from "@jelly/storefront-registry/runtime";
import { resolveStorefrontHref } from "../runtime-context";
import { blockStyle } from "../block-style";
import { blockEditorData } from "./block-content";
import { productContext } from "./product-sections";
import { choice, numberValue, stringValue } from "./shared";
import { StoreIcon } from "./store-icon";
import type { ContentBlockOptions } from "./content-blocks";
import { CardCartContext } from "../product-card";
import type { ProductPresentationContext, PublicProduct, StorefrontCartAccess } from "../types";

/**
 * Product page blocks (registry product-blocks.ts): breadcrumbs, delivery estimate and "Pairs well with" read the
 * product being shown; the notice is a general content block. Outside a product page the product blocks draw
 * nothing for shoppers and a short note in the editor.
 */

function editorData(block: BlockNode, options: ContentBlockOptions, field?: string) {
  return blockEditorData(block, options.editor, blockLabel(block.type), options.selectedBlockId, field);
}

function needsProduct(block: BlockNode, options: ContentBlockOptions): ReactNode {
  return options.editor ? <p className="jelly-block-group-empty" {...editorData(block, options)}>{blockLabel(block.type)} shows on product pages</p> : null;
}

function Breadcrumbs({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const product = productContext(options.context);
  if (!product) return needsProduct(block, options);
  const root = options.context.storeSlug ? `/${encodeURIComponent(options.context.storeSlug)}` : "";
  const shop = stringValue(block.settings, "shopLabel", "Shop");
  return <nav className="jelly-product-breadcrumbs" aria-label="Breadcrumb" {...blockStyle(block)} {...editorData(block, options, "shopLabel")}>
    <ol>
      <li><a href={root || "/"}>Home</a></li>
      {shop && <li><a href={`${root}/shop`}>{shop}</a></li>}
      <li><span aria-current="page">{product.product.title}</span></li>
    </ol>
  </nav>;
}

/** The UK date and hour now, from the shopper's clock. */
export function londonNow(now: number): { date: Date; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { date: new Date(Date.UTC(value("year"), value("month") - 1, value("day"))), hour: value("hour"), minute: value("minute") };
}

export function addWorkingDays(from: Date, days: number, weekends: boolean): Date {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (weekends || (day !== 0 && day !== 6)) left -= 1;
  }
  return date;
}

/** The delivery window for an order placed at `now` (exported for tests). */
export function deliveryWindow(settings: Record<string, unknown>, now: number): { from: Date; to: Date; hoursLeft: number; minutesLeft: number } {
  const weekends = settings.weekendDispatch === true;
  const cutoff = numberValue(settings, "cutoffHour", 14, 0, 23);
  const { date, hour, minute } = londonNow(now);
  // An order after the cut-off, or on a day nothing is sent, is dispatched from the next working day.
  let dispatch = new Date(date);
  const sendsToday = weekends || (date.getUTCDay() !== 0 && date.getUTCDay() !== 6);
  if (!sendsToday || hour >= cutoff) dispatch = addWorkingDays(dispatch, 1, weekends);
  dispatch = addWorkingDays(dispatch, numberValue(settings, "dispatchDays", 0, 0, 10), weekends);
  const min = numberValue(settings, "deliveryMin", 2, 0, 30);
  const max = Math.max(min, numberValue(settings, "deliveryMax", 4, 0, 30));
  return { from: addWorkingDays(dispatch, min, weekends), to: addWorkingDays(dispatch, max, weekends), hoursLeft: sendsToday && hour < cutoff ? cutoff - hour : 0, minutesLeft: sendsToday && hour < cutoff ? (cutoff - hour) * 60 - minute : 0 };
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const noSubscribe = () => () => undefined;
/** Re-reads the clock every 30 seconds (the countdown look). */
const everyHalfMinute = (listener: () => void) => { const timer = window.setInterval(listener, 30_000); return () => window.clearInterval(timer); };
// Rounded to the minute, so the value stays the same between renders.
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;

function DeliveryEstimate({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  // Dates depend on the shopper's clock, so they are worked out in the browser only.
  const clock = block.settings.style === "clock";
  const now = useSyncExternalStore(clock ? everyHalfMinute : noSubscribe, minuteNow, () => null);
  if (!productContext(options.context)) return needsProduct(block, options);
  if (now === null) return <p className="jelly-delivery-estimate" aria-hidden="true" {...editorData(block, options)} />;
  const estimate = deliveryWindow(block.settings, now);
  const range = estimate.from.getTime() === estimate.to.getTime() ? dayFormat.format(estimate.from) : `${dayFormat.format(estimate.from)} – ${dayFormat.format(estimate.to)}`;
  if (clock) {
    const left = estimate.minutesLeft;
    const time = left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m` : `${left}m`;
    return <p className="jelly-delivery-estimate" data-style="clock" {...blockStyle(block)} {...editorData(block, options)}>
      <span className="jelly-delivery-pulse" aria-hidden="true" />
      <span>{left > 0 ? <>Order in <strong className="jelly-delivery-time">{time}</strong> for delivery </> : "Order now for delivery "}<strong>{range}</strong></span>
    </p>;
  }
  return <p className="jelly-delivery-estimate" {...blockStyle(block)} {...editorData(block, options)}>
    <StoreIcon name="truck" size={20} />
    <span>{estimate.hoursLeft > 0 ? <>Order in the next <strong>{estimate.hoursLeft} {estimate.hoursLeft === 1 ? "hour" : "hours"}</strong> for delivery </> : "Get it "}<strong>{range}</strong></span>
  </p>;
}

function ComplementaryProducts({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const cart = useContext(CardCartContext);
  const product = productContext(options.context);
  if (!product) return needsProduct(block, options);
  const limit = numberValue(block.settings, "limit", 3, 1, 6);
  const pairs = block.settings.source === "pairs" && product.pairedProducts?.length ? product.pairedProducts : undefined;
  const items = (pairs ?? product.relatedProducts).slice(0, limit);
  if (items.length === 0) return options.editor ? <p className="jelly-block-group-empty" {...editorData(block, options)}>Products show here once your store has more than one</p> : null;
  const heading = stringValue(block.settings, "heading");
  if (block.settings.addToBag === true) {
    // The size chosen for the product on this page, so a King bed starts its mattress on King.
    const chosenLabel = (optionName: string) => block.settings.matchSize === false ? undefined
      : product.product.options.find((option) => option.name.trim().toLowerCase() === optionName.trim().toLowerCase())?.values.find((value) => value.selected)?.label;
    return <div {...blockStyle(block)} {...editorData(block, options, "heading")}>
      <CompleteTheSet heading={heading} items={items} product={product} cart={options.editor ? undefined : cart} editor={Boolean(options.editor)} preferred={chosenLabel} />
    </div>;
  }
  return <div className="jelly-complementary" {...blockStyle(block)} {...editorData(block, options, "heading")}>
    {/* An h2: in the buying column it follows the product title (h1). */}
    {heading && <h2 className="jelly-complementary-heading">{heading}</h2>}
    <ul className="jelly-complementary-list">{items.map((item) => <li key={item.id}><ItemLink item={item} /></li>)}</ul>
  </div>;
}

function ItemLink({ item }: { item: PublicProduct }) {
  return <a className="jelly-complementary-item" href={item.href}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {item.imageUrl ? <img className="jelly-complementary-photo" src={item.imageUrl} alt="" loading="lazy" /> : <span className="jelly-complementary-photo is-empty" aria-hidden="true" />}
    <span className="jelly-complementary-text"><span className="jelly-complementary-name">{item.name}</span><span className="jelly-complementary-price">{item.price}</span></span>
  </a>;
}

type SetChoice = NonNullable<PublicProduct["setChoices"]>["values"][number];
type SetState = { status: "idle" | "adding" | "added" | "error"; message?: string };

/**
 * "Complete the set": a card per suggested product (photo, name, price of the chosen size, a size choice and a tick),
 * then a summary with this product, the ticked items, the total and the saving (from was-prices), and one button that
 * adds them all. This product goes in too once its own required choices are made. Products that need other choices
 * first show "Choose options" instead of a tick. Each item becomes its own bag line, priced again at checkout.
 */
export function CompleteTheSet({ heading, items, product, cart, editor = false, preferred }: {
  heading?: string; items: PublicProduct[]; product: ProductPresentationContext; cart?: StorefrontCartAccess; editor?: boolean;
  preferred: (optionName: string) => string | undefined;
}) {
  const id = useId();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<SetState>({ status: "idle" });
  const format = product.pricing.format ?? ((minor: number) => (minor / 100).toFixed(2));
  // The size each item shows: the shopper's own pick, else the size chosen on this page, else the first one in stock.
  const current = (item: PublicProduct): SetChoice | undefined => {
    const choices = item.setChoices?.values ?? [];
    const buyable = choices.filter((value) => value.max > 0);
    const own = picked[item.id] ? choices.find((value) => value.variantId === picked[item.id]) : undefined;
    const wanted = item.setChoices ? preferred(item.setChoices.optionName)?.toLowerCase() : undefined;
    return own ?? buyable.find((value) => wanted && value.label.toLowerCase() === wanted) ?? buyable[0];
  };
  const chosen = items.flatMap((item) => { const value = current(item); return ticked[item.id] && value ? [{ item, value }] : []; });
  const unit = product.pricing.priceMinor;
  const mainIn = product.canAddToCart && typeof unit === "number";
  const mainMinor = mainIn ? unit * product.quantity : 0;
  const total = mainMinor + chosen.reduce((sum, { value }) => sum + (value.priceMinor ?? 0), 0);
  const mainWas = product.pricing.compareAtPriceMinor;
  const saving = (mainIn && mainWas && mainWas > unit ? (mainWas - unit) * product.quantity : 0)
    + chosen.reduce((sum, { value }) => sum + (value.compareAtPriceMinor && value.priceMinor !== undefined ? Math.max(0, value.compareAtPriceMinor - value.priceMinor) : 0), 0);
  const count = chosen.length + (mainIn ? 1 : 0);
  const mainChoice = product.product.options.filter((option) => !option.multiple).flatMap((option) => option.values.filter((value) => value.selected).map((value) => value.label)).join(", ");
  const itemsWord = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;
  const addAll = async () => {
    if (!cart || count === 0) return;
    setState({ status: "adding" });
    try {
      if (mainIn) {
        const result = await product.addToCart();
        if (!result.ok) throw new Error(result.message ?? "Could not add this to your bag.");
      }
      for (const { item, value } of chosen) {
        const result = await cart.setQuantity(value.variantId, Math.min(value.max, cart.quantity(value.variantId) + 1));
        if (!result.ok) throw new Error(result.message ?? `Could not add ${item.name} to your bag.`);
      }
      setState({ status: "added", message: `Added ${itemsWord(count)} to your bag.` });
      setTicked({});
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("jelly:cart-added"));
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Could not add these to your bag." });
    }
  };
  const headingId = `${id}-heading`;
  return <section className="jelly-set" aria-labelledby={heading ? headingId : undefined}>
    {heading && <h2 className="jelly-set-heading" id={headingId}>{heading}</h2>}
    <ul className="jelly-set-items">
      {items.map((item) => {
        const value = current(item);
        const choices = item.setChoices?.values ?? [];
        const canTick = Boolean(item.setChoices && value);
        const isTicked = Boolean(ticked[item.id] && canTick);
        const wasPrice = value?.compareAtPriceMinor ? format(value.compareAtPriceMinor) : undefined;
        const fieldId = `${id}-${item.id}`;
        return <li key={item.id} className="jelly-set-card" data-ticked={isTicked || undefined}>
          <a className="jelly-set-photo" href={item.href} tabIndex={-1} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="is-empty" />}
          </a>
          <div className="jelly-set-body">
            <a className="jelly-set-name" href={item.href}>{item.name}</a>
            <p className="jelly-set-price"><span>{value?.price ?? item.price}</span>{wasPrice && <s aria-label={`Was ${wasPrice}`}>{wasPrice}</s>}</p>
            {canTick && choices.length > 1 && <>
              <label className="jelly-visually-hidden" htmlFor={`${fieldId}-size`}>{item.setChoices?.optionName || "Choice"} for {item.name}</label>
              <select id={`${fieldId}-size`} className="jelly-set-select" value={value?.variantId} onChange={(event) => { setPicked((now) => ({ ...now, [item.id]: event.target.value })); setState({ status: "idle" }); }}>
                {choices.map((choice) => <option key={choice.variantId} value={choice.variantId} disabled={choice.max === 0}>{choice.label}{choice.max === 0 ? " (sold out)" : ""}</option>)}
              </select>
            </>}
            {canTick
              ? <label className="jelly-set-tick">
                <input type="checkbox" checked={isTicked} aria-label={`Add ${item.name} to my set`} onChange={(event) => { setTicked((now) => ({ ...now, [item.id]: event.target.checked })); setState({ status: "idle" }); }} />
                <span aria-hidden="true">{isTicked ? "In your set" : "Add to my set"}</span>
              </label>
              : <a className="jelly-set-view" href={item.href} aria-label={`${choices.length ? "Sold out" : "Choose options"}: ${item.name}`}>{choices.length ? "Sold out" : "Choose options"}</a>}
          </div>
        </li>;
      })}
    </ul>
    <div className="jelly-set-summary">
      <ul className="jelly-set-lines">
        <li data-main=""><span>{product.product.title}{mainChoice ? `, ${mainChoice}` : ""}</span><span>{mainIn ? format(mainMinor) : "Choose a size above"}</span></li>
        {chosen.map(({ item, value }) => <li key={item.id}><span>{item.name}{value.label ? `, ${value.label}` : ""}</span><span>{value.price}</span></li>)}
      </ul>
      {count > 0 && <p className="jelly-set-total"><span>Total</span><strong>{format(total)}</strong></p>}
      {saving > 0 && <p className="jelly-set-saving">You save {format(saving)}</p>}
      <button type="button" className="jelly-button jelly-set-add" disabled={editor || !cart || count === 0 || state.status === "adding"} onClick={() => void addAll()}>
        {state.status === "adding" ? "Adding…" : count === 0 ? "Tick items to add" : `Add ${itemsWord(count)} to basket`}
      </button>
      <p className="jelly-set-status" role="status" aria-live="polite">{state.status === "added" || state.status === "error" ? state.message : ""}</p>
    </div>
  </section>;
}

function Notice({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const text = stringValue(block.settings, "text");
  if (!text) return null;
  const label = stringValue(block.settings, "linkLabel");
  const href = resolveStorefrontHref(block.settings.link, options.context.storeSlug);
  return <p className="jelly-notice" data-tone={choice(block.settings, "tone", ["info", "success", "warning", "sale"] as const, "info")} {...blockStyle(block)} {...editorData(block, options, "text")}>
    <StoreIcon name={block.settings.icon} size={18} />
    <span>{text}{label && href && <> <a href={href}>{label}</a></>}</span>
  </p>;
}

/** Draws a product page block, or returns undefined when the type is not one of them. */
export function renderProductBlock(block: BlockNode, options: ContentBlockOptions): ReactNode | undefined {
  const props = { block, options };
  switch (block.type) {
    case "product-breadcrumbs": return <Breadcrumbs key={block.id} {...props} />;
    case "delivery-estimate": return <DeliveryEstimate key={block.id} {...props} />;
    case "complementary-products": return <ComplementaryProducts key={block.id} {...props} />;
    case "notice": return <Notice key={block.id} {...props} />;
    default: return undefined;
  }
}
