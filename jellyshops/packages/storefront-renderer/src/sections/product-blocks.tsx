import { useSyncExternalStore, type ReactNode } from "react";
import type { BlockNode } from "@jelly/storefront-schema";
import { blockLabel } from "@jelly/storefront-registry/runtime";
import { resolveStorefrontHref } from "../runtime-context";
import { blockStyle } from "../block-style";
import { blockEditorData } from "./block-content";
import { productContext } from "./product-sections";
import { choice, numberValue, stringValue } from "./shared";
import { StoreIcon } from "./store-icon";
import type { ContentBlockOptions } from "./content-blocks";

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
function londonNow(now: number): { date: Date; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { date: new Date(Date.UTC(value("year"), value("month") - 1, value("day"))), hour: value("hour") };
}

function addWorkingDays(from: Date, days: number, weekends: boolean): Date {
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
export function deliveryWindow(settings: Record<string, unknown>, now: number): { from: Date; to: Date; hoursLeft: number } {
  const weekends = settings.weekendDispatch === true;
  const cutoff = numberValue(settings, "cutoffHour", 14, 0, 23);
  const { date, hour } = londonNow(now);
  // An order after the cut-off, or on a day nothing is sent, is dispatched from the next working day.
  let dispatch = new Date(date);
  const sendsToday = weekends || (date.getUTCDay() !== 0 && date.getUTCDay() !== 6);
  if (!sendsToday || hour >= cutoff) dispatch = addWorkingDays(dispatch, 1, weekends);
  dispatch = addWorkingDays(dispatch, numberValue(settings, "dispatchDays", 0, 0, 10), weekends);
  const min = numberValue(settings, "deliveryMin", 2, 0, 30);
  const max = Math.max(min, numberValue(settings, "deliveryMax", 4, 0, 30));
  return { from: addWorkingDays(dispatch, min, weekends), to: addWorkingDays(dispatch, max, weekends), hoursLeft: sendsToday && hour < cutoff ? cutoff - hour : 0 };
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const noSubscribe = () => () => undefined;
// Rounded to the minute, so the value stays the same between renders.
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;

function DeliveryEstimate({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  // Dates depend on the shopper's clock, so they are worked out in the browser only.
  const now = useSyncExternalStore(noSubscribe, minuteNow, () => null);
  if (!productContext(options.context)) return needsProduct(block, options);
  if (now === null) return <p className="jelly-delivery-estimate" aria-hidden="true" {...editorData(block, options)} />;
  const estimate = deliveryWindow(block.settings, now);
  const range = estimate.from.getTime() === estimate.to.getTime() ? dayFormat.format(estimate.from) : `${dayFormat.format(estimate.from)} – ${dayFormat.format(estimate.to)}`;
  return <p className="jelly-delivery-estimate" {...blockStyle(block)} {...editorData(block, options)}>
    <StoreIcon name="truck" size={20} />
    <span>{estimate.hoursLeft > 0 ? <>Order in the next <strong>{estimate.hoursLeft} {estimate.hoursLeft === 1 ? "hour" : "hours"}</strong> for delivery </> : "Get it "}<strong>{range}</strong></span>
  </p>;
}

function ComplementaryProducts({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const product = productContext(options.context);
  if (!product) return needsProduct(block, options);
  const items = product.relatedProducts.slice(0, numberValue(block.settings, "limit", 3, 1, 6));
  if (items.length === 0) return options.editor ? <p className="jelly-block-group-empty" {...editorData(block, options)}>Products show here once your store has more than one</p> : null;
  const heading = stringValue(block.settings, "heading");
  return <div className="jelly-complementary" {...blockStyle(block)} {...editorData(block, options, "heading")}>
    {/* An h2: in the buying column it follows the product title (h1). */}
    {heading && <h2 className="jelly-complementary-heading">{heading}</h2>}
    <ul className="jelly-complementary-list">
      {items.map((item) => <li key={item.id}>
        <a className="jelly-complementary-item" href={item.href}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.imageUrl ? <img className="jelly-complementary-photo" src={item.imageUrl} alt="" loading="lazy" /> : <span className="jelly-complementary-photo is-empty" aria-hidden="true" />}
          <span className="jelly-complementary-text"><span className="jelly-complementary-name">{item.name}</span><span className="jelly-complementary-price">{item.price}</span></span>
        </a>
      </li>)}
    </ul>
  </div>;
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
