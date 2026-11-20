/**
 * Showroom sections and blocks (docs/components/showroom.md): offer panel, code chip, Shop by size, Steps with real
 * dates, Fabric swatches, the hero's floating card and its promises row. Shared by every theme; the look comes from
 * the theme tokens and the rules at the end of storefront-base.css ("Showroom").
 */
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { isStoreIconName, type BlockNode, type SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { CommerceDataProvider } from "../types";
import { resolveStorefrontHref, type StorefrontRuntimeContext } from "../runtime-context";
import { blockEditorData } from "./block-content";
import { blockStyle } from "../block-style";
import { mediaPhoto } from "../media-photo";
import { choice, imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";
import { formattedSetting, inlineSetting, SettingText } from "./setting-text";
import { countdownTarget, HeroCountdown } from "./hero-countdown";
import { StoreIcon } from "./store-icon";
import { addWorkingDays, londonNow } from "./product-blocks";
import { pickProduct, useStoreProducts } from "./showcase";
import { Stars } from "./product-reviews";
import type { ContentBlockOptions } from "./content-blocks";

const noSubscribe = () => () => undefined;
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;
const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/* ── Code chip ─────────────────────────────────────────────────────────────── */

/** A discount code with a Copy button; the copied state is read out to screen readers. */
export function CodeChip({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* Clipboard refused: the code stays visible to type by hand. */ }
  };
  return <div className="jelly-code-chip">
    {label && <span className="jelly-code-chip-label">{label}</span>}
    <strong className="jelly-code-chip-code">{code}</strong>
    <button type="button" className="jelly-code-chip-copy" onClick={copy} aria-label={`Copy code ${code}`}>{copied ? "Copied" : "Copy"}</button>
    <span className="jelly-visually-hidden" aria-live="polite">{copied ? `Code ${code} copied` : ""}</span>
  </div>;
}

function CodeChipBlock({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const code = stringValue(block.settings, "code");
  if (!code) return null;
  return <div {...blockStyle(block)} {...blockEditorData(block, options.editor, "Discount code", options.selectedBlockId)}><CodeChip code={code} label={stringValue(block.settings, "label")} /></div>;
}

/** Showroom blocks that can sit in any "@content" list (Custom section, groups, pop-ups). */
export function renderShowroomBlock(block: BlockNode, options: ContentBlockOptions): ReactNode | undefined {
  if (block.type === "code-chip") return <CodeChipBlock key={block.id} block={block} options={options} />;
  return undefined;
}

/* ── Offer panel ───────────────────────────────────────────────────────────── */

export function OfferPanelSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const settings = section.settings;
  const image = imageValue(settings);
  const heading = stringValue(settings, "heading");
  const text = stringValue(settings, "text");
  const big = stringValue(settings, "bigText");
  const code = stringValue(settings, "code");
  const label = stringValue(settings, "buttonLabel");
  const href = resolveStorefrontHref(stringValue(settings, "buttonLink", "/shop"), context.storeSlug);
  const countdown = countdownTarget(settings.countdownTo);
  const imageLabel = stringValue(settings, "imageLabel");
  return <section className="jelly-section jelly-offer" {...sectionData(section, { "data-image-position": choice(settings, "imagePosition", ["left", "right"] as const, "right"), "data-has-image": image ? "true" : undefined })}>
    <StorefrontContainer>
      <div className="jelly-offer-panel">
        <div className="jelly-offer-copy">
          {stringValue(settings, "eyebrow") && <p className="jelly-eyebrow">{stringValue(settings, "eyebrow")}</p>}
          {big && <p className="jelly-offer-big jelly-display">{big}</p>}
          {heading && <h2 className="jelly-offer-heading">{inlineSetting(settings, "heading", heading)}</h2>}
          <SettingText className="jelly-offer-text" text={text} document={formattedSetting(settings, "text")} />
          {(code || label) && <div className="jelly-offer-actions">
            {code && <CodeChip code={code} label={stringValue(settings, "codeLabel")} />}
            {label && href && <a className="jelly-button" href={href}>{label}<span className="jelly-button-arrow" aria-hidden="true">→</span></a>}
          </div>}
          {countdown !== null && <HeroCountdown target={countdown} endText={stringValue(settings, "countdownEndText")} />}
        </div>
        {image && <figure className="jelly-offer-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} {...mediaPhoto(image.url, "(min-width: 900px) 50vw, 100vw")} alt={image.alt ?? ""} loading="lazy" />
          {imageLabel && <figcaption className="jelly-floating-label">{imageLabel}</figcaption>}
        </figure>}
      </div>
    </StorefrontContainer>
  </section>;
}

/* ── Shop by size ─────────────────────────────────────────────────────────── */

/** 135 cm as 4'5" (feet and inches). */
export function feetAndInches(cm: number): string {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function SectionHeading({ section, fallback }: { section: SectionNode; fallback?: string }) {
  const settings = section.settings;
  const heading = stringValue(settings, "heading", fallback ?? "");
  const text = stringValue(settings, "text");
  const eyebrow = stringValue(settings, "eyebrow");
  if (!heading && !text && !eyebrow) return null;
  return <div className="jelly-section-intro" data-align={choice(settings, "contentAlignment", ["left", "center"] as const, "left")}>
    {eyebrow && <p className="jelly-eyebrow">{eyebrow}</p>}
    {heading && <h2>{inlineSetting(settings, "heading", heading)}</h2>}
    <SettingText text={text} document={formattedSetting(settings, "text")} />
  </div>;
}

export function SizePickerSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const editor = context.mode === "editor";
  const unit = choice(section.settings, "unit", ["cm", "ft"] as const, "cm");
  const sizes = visibleBlocks(section, "size-option").flatMap((block) => {
    const label = stringValue(block.settings, "label");
    return label ? [{ block, label, width: numberValue(block.settings, "width", 135, 40, 300), length: numberValue(block.settings, "length", 190, 100, 300), note: stringValue(block.settings, "note"), href: resolveStorefrontHref(stringValue(block.settings, "link"), context.storeSlug) }] : [];
  });
  if (!sizes.length) return null;
  // One scale for every drawing, so a single really is half the width of a super king.
  const largest = Math.max(...sizes.map((size) => Math.max(size.width, size.length)));
  const scale = 100 / largest;
  return <section className="jelly-section jelly-size-picker" {...sectionData(section)}>
    <StorefrontContainer>
      <SectionHeading section={section} />
      <ul className="jelly-size-list" role="list">
        {sizes.map((size) => {
          const width = size.width * scale;
          const length = size.length * scale;
          const x = (104 - width) / 2;
          const pillows = size.width >= 110 ? 2 : 1;
          const pillowWidth = (width - 8 - (pillows - 1) * 3) / pillows;
          const dims = unit === "ft" ? `${feetAndInches(size.width)} × ${feetAndInches(size.length)}` : `${size.width} × ${size.length} cm`;
          const content = <>
            <svg className="jelly-size-drawing" viewBox="0 0 104 112" aria-hidden="true" focusable="false">
              <rect className="jelly-size-frame" x={x} y={6} width={width} height={length} rx={4} />
              <rect className="jelly-size-headboard" x={x - 2} y={2} width={width + 4} height={8} rx={3} />
              {Array.from({ length: pillows }, (_, index) => <rect key={index} className="jelly-size-pillow" x={x + 4 + index * (pillowWidth + 3)} y={14} width={pillowWidth} height={Math.min(14, length * 0.14)} rx={3} />)}
              <path className="jelly-size-fold" d={`M ${x} ${6 + length * 0.42} H ${x + width}`} />
            </svg>
            <strong className="jelly-size-name">{size.label}</strong>
            <span className="jelly-size-dims">{dims}</span>
            {size.note && <span className="jelly-size-note">{size.note}</span>}
          </>;
          return <li key={size.block.id} {...blockEditorData(size.block, editor, "Size")}>
            {size.href && !editor ? <a className="jelly-size-option" href={size.href}>{content}</a> : <div className="jelly-size-option">{content}</div>}
          </li>;
        })}
      </ul>
    </StorefrontContainer>
  </section>;
}

/* ── Steps ────────────────────────────────────────────────────────────────── */

/** The date of each step, `days` working days after the order day (today, or the next working day after the cut-off). */
export function stepDates(steps: number[], now: number, options: { cutoffHour: number; weekends: boolean }): string[] {
  const { date, hour } = londonNow(now);
  const working = options.weekends || (date.getUTCDay() !== 0 && date.getUTCDay() !== 6);
  const orderDay = working && hour < options.cutoffHour ? date : addWorkingDays(date, 1, options.weekends);
  return steps.map((days) => days === 0 ? "Today" : dayFormat.format(addWorkingDays(orderDay, days, options.weekends)));
}

export function StepsSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const editor = context.mode === "editor";
  const steps = visibleBlocks(section, "step").flatMap((block) => {
    const title = stringValue(block.settings, "title");
    return title ? [{ block, title, text: stringValue(block.settings, "text"), icon: block.settings.icon, days: numberValue(block.settings, "days", 0, 0, 30) }] : [];
  });
  // Dates depend on the shopper's clock, so they are worked out in the browser only.
  const now = useSyncExternalStore(noSubscribe, minuteNow, () => null);
  if (!steps.length) return null;
  const dates = section.settings.showDates === true && now !== null
    ? stepDates(steps.map((step) => step.days), now, { cutoffHour: numberValue(section.settings, "cutoffHour", 14, 0, 23), weekends: section.settings.weekends === true })
    : [];
  return <section className="jelly-section jelly-steps" {...sectionData(section, { "data-count": String(steps.length) })}>
    <StorefrontContainer>
      <SectionHeading section={section} />
      <ol className="jelly-steps-list">
        {steps.map((step, index) => <li key={step.block.id} className="jelly-step" {...blockEditorData(step.block, editor, "Step")}>
          <span className="jelly-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          {isStoreIconName(step.icon) && <span className="jelly-step-icon"><StoreIcon name={step.icon} size={22} /></span>}
          <h3 className="jelly-step-title">{step.title}</h3>
          {step.text && <p className="jelly-step-text">{step.text}</p>}
          {dates[index] && <p className="jelly-step-date"><StoreIcon name="calendar" size={16} /><span>{dates[index]}</span></p>}
        </li>)}
      </ol>
    </StorefrontContainer>
  </section>;
}

/* ── Fabric swatches ──────────────────────────────────────────────────────── */

export function SwatchShowcaseSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const editor = context.mode === "editor";
  const swatches = visibleBlocks(section, "swatch").flatMap((block) => {
    const name = stringValue(block.settings, "name");
    return name ? [{ block, name, color: stringValue(block.settings, "color"), image: imageValue(block.settings), photo: imageValue(block.settings, "photo"), note: stringValue(block.settings, "note"), href: resolveStorefrontHref(stringValue(block.settings, "link"), context.storeSlug) }] : [];
  });
  const [active, setActive] = useState(0);
  const current = swatches[Math.min(active, swatches.length - 1)];
  const photo = current?.photo ?? imageValue(section.settings);
  const button = stringValue(section.settings, "buttonLabel");
  const buttonHref = resolveStorefrontHref(stringValue(section.settings, "buttonLink"), context.storeSlug);
  if (!swatches.length) return null;
  return <section className="jelly-section jelly-swatch-showcase" {...sectionData(section, { "data-image-position": choice(section.settings, "imagePosition", ["left", "right"] as const, "left"), "data-has-image": photo ? "true" : undefined })}>
    <StorefrontContainer>
      <div className="jelly-swatch-layout">
        {photo && <figure className="jelly-swatch-photo jelly-offer-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={photo.url} src={photo.url} {...mediaPhoto(photo.url, "(min-width: 900px) 50vw, 100vw")} alt={photo.alt ?? ""} loading="lazy" />
          {current && <figcaption className="jelly-floating-label"><span className="jelly-swatch-dot" style={{ background: current.color || undefined, backgroundImage: current.image ? `url("${current.image.url}")` : undefined }} aria-hidden="true" />{current.name}{current.note ? ` · ${current.note}` : ""}</figcaption>}
        </figure>}
        <div className="jelly-swatch-copy">
          <SectionHeading section={section} />
          <div className="jelly-swatch-list" role="group" aria-label="Fabrics">
            {swatches.map((swatch, index) => <button key={swatch.block.id} type="button" className="jelly-swatch" aria-pressed={index === active} onClick={() => setActive(index)} {...blockEditorData(swatch.block, editor, "Swatch")}>
              <span className="jelly-swatch-sample" style={{ background: swatch.color || undefined, backgroundImage: swatch.image ? `url("${swatch.image.url}")` : undefined } as CSSProperties} aria-hidden="true" />
              <span className="jelly-swatch-name">{swatch.name}</span>
              {swatch.note && <span className="jelly-swatch-note">{swatch.note}</span>}
            </button>)}
          </div>
          <div className="jelly-swatch-actions">
            {current?.href && <a className="jelly-button" href={current.href}>Shop {current.name.toLowerCase()}<span className="jelly-button-arrow" aria-hidden="true">→</span></a>}
            {button && buttonHref && <a className="jelly-button jelly-button--secondary" href={buttonHref}>{button}</a>}
          </div>
        </div>
      </div>
    </StorefrontContainer>
  </section>;
}

/* ── Hero extras: floating card and promises ──────────────────────────────── */

/** A small card pinned over the hero photo: a product (photo, name, price, stars) or the merchant's own note. */
export function FloatingCard({ block, commerce, context, editor, selectedBlockId }: { block: BlockNode; commerce: CommerceDataProvider; context: StorefrontRuntimeContext; editor: boolean; selectedBlockId?: string }) {
  const settings = block.settings;
  const title = stringValue(settings, "title");
  const wantsProduct = typeof settings.productId === "string" && settings.productId !== "" || !title;
  const products = useStoreProducts(commerce, wantsProduct);
  const product = wantsProduct ? pickProduct(products, settings.productId, 0) : undefined;
  const image = imageValue(settings);
  const name = product?.name ?? title;
  if (!name) return null;
  const photo = image?.url ?? product?.imageUrl;
  const href = product?.href ?? resolveStorefrontHref(stringValue(settings, "link"), context.storeSlug);
  const rating = product ? commerce.ratings?.[product.id] ?? product.rating : undefined;
  const body = <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {photo && <img src={photo} {...mediaPhoto(photo, "96px")} alt="" loading="lazy" />}
    <span className="jelly-floating-card-body">
      {stringValue(settings, "eyebrow") && <span className="jelly-floating-card-eyebrow">{stringValue(settings, "eyebrow")}</span>}
      <strong className="jelly-floating-card-title">{name}</strong>
      {product ? <span className="jelly-floating-card-price">{product.compareAtPrice ? "From " : ""}{product.price}</span> : stringValue(settings, "text") && <span className="jelly-floating-card-text">{stringValue(settings, "text")}</span>}
      {rating && rating.count > 0 && <Stars value={rating.average} label={`${rating.average} out of 5 stars`} />}
    </span>
    <span className="jelly-floating-card-arrow" aria-hidden="true">→</span>
  </>;
  const props = { className: "jelly-floating-card", "data-position": choice(settings, "position", ["bottom-right", "bottom-left", "top-right"] as const, "bottom-right"), ...blockEditorData(block, editor, "Floating card", selectedBlockId) };
  return href && !editor ? <a href={href} {...props}>{body}</a> : <div {...props}>{body}</div>;
}

/** "truck: Two-person delivery" lines as promise cards along the bottom of the hero. */
export function heroPromises(value: unknown): Array<{ icon?: string; text: string }> {
  if (typeof value !== "string") return [];
  return value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 4).map((line) => {
    const match = /^([a-z]+)\s*:\s*(.+)$/.exec(line);
    return match && isStoreIconName(match[1]) ? { icon: match[1], text: match[2] } : { text: line };
  });
}

export function HeroPromises({ value }: { value: unknown }) {
  const promises = heroPromises(value);
  if (!promises.length) return null;
  return <ul className="jelly-hero-promises" role="list" data-count={promises.length}>
    {promises.map((promise) => <li key={promise.text}><StoreIcon name={promise.icon ?? "check"} size={20} /><span>{promise.text}</span></li>)}
  </ul>;
}
