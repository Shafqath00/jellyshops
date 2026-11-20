import { useId, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { BlockNode } from "@jelly/storefront-schema";
import { blockLabel } from "@jelly/storefront-registry/runtime";
import { resolveStorefrontHref } from "../runtime-context";
import { blockStyle } from "../block-style";
import { mediaPhoto } from "../media-photo";
import { ProductCard } from "../product-card";
import { blockEditorData, VideoBlock } from "./block-content";
import { countdownTarget, HeroCountdown } from "./hero-countdown";
import { NewsletterForm } from "./home-sections";
import { pickProduct, useStoreProducts } from "./showcase";
import { choice, imageValue, numberValue, stringValue } from "./shared";
import type { ContentBlockOptions } from "./content-blocks";
import { renderProductBlock } from "./product-blocks";
import { renderShowroomBlock } from "./showroom";

/**
 * The shared content blocks, wave 2 (registry media-blocks.ts): image card, images stack, image comparison, video
 * card, product card, product over photo, press quote, email sign-up, contact form, share links, countdown and
 * shop address. Forms send only on the live store; links go through the safe-link check.
 */

const ratios: Record<string, string> = { square: "1 / 1", portrait: "4 / 5", landscape: "4 / 3", wide: "16 / 9" };
const ratioOf = (block: BlockNode, fallback = "landscape") => ratios[choice(block.settings, "imageRatio", ["square", "portrait", "landscape", "wide"] as const, fallback as "landscape")];

function editorData(block: BlockNode, options: ContentBlockOptions, field?: string) {
  return blockEditorData(block, options.editor, blockLabel(block.type), options.selectedBlockId, field);
}

/** A merchant photo (served by the store API, not as a Next Image asset). */
function Photo({ settings, imageKey, className, ratio, sizes = "(min-width: 768px) 50vw, 100vw" }: { settings: Record<string, unknown>; imageKey: string; className: string; ratio?: string; sizes?: string }) {
  const image = imageValue(settings, imageKey);
  if (!image) return <span className={`${className} is-empty`} aria-hidden="true" style={ratio ? { aspectRatio: ratio } : undefined} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={image.url} alt={typeof image.alt === "string" ? image.alt : ""} loading="lazy" style={{ ...(ratio ? { aspectRatio: ratio } : {}), objectPosition: `${image.focalPoint?.x ?? 50}% ${image.focalPoint?.y ?? 50}%` }} {...mediaPhoto(image.url, sizes)} />;
}

function ImageCard({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const settings = block.settings;
  const heading = stringValue(settings, "heading");
  const text = stringValue(settings, "text");
  const label = stringValue(settings, "buttonLabel");
  const href = resolveStorefrontHref(settings.link, options.context.storeSlug) ?? undefined;
  const position = choice(settings, "textPosition", ["over", "below"] as const, "over");
  const overlay = numberValue(settings, "overlay", 35, 0, 80);
  const body = (heading || text || (label && href)) ? <div className="jelly-image-card-body">
    {heading && <h3 className="jelly-image-card-heading">{heading}</h3>}
    {text && <p className="jelly-image-card-text">{text}</p>}
    {label && href && <a className="jelly-button" href={href}>{label}</a>}
  </div> : null;
  return <article className="jelly-image-card" data-text-position={position} {...blockStyle(block)} {...editorData(block, options, "heading")}>
    <div className="jelly-image-card-media" style={{ aspectRatio: ratioOf(block, "portrait") }}>
      <Photo settings={settings} imageKey="image" className="jelly-image-card-photo" />
      {position === "over" && overlay > 0 && <span className="jelly-image-card-overlay" aria-hidden="true" style={{ background: `rgb(0 0 0 / ${overlay / 100})` }} />}
      {position === "over" && body}
    </div>
    {position === "below" && body}
  </article>;
}

function ImagesStack({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const keys = ["image1", "image2", "image3"].filter((key) => imageValue(block.settings, key));
  if (keys.length === 0 && !options.editor) return null;
  const shown = keys.length ? keys : ["image1", "image2", "image3"];
  return <div className="jelly-images-stack" data-layout={choice(block.settings, "stackLayout", ["cascade", "fan"] as const, "cascade")} data-count={shown.length} {...blockStyle(block)} {...editorData(block, options)}>
    {shown.map((key) => <Photo key={key} settings={block.settings} imageKey={key} className="jelly-images-stack-photo" sizes="(min-width: 768px) 30vw, 60vw" />)}
  </div>;
}

/** Before and after photos with a divider the shopper drags (a range input, so keyboards and screen readers can move it). */
function ImageComparison({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const id = useId();
  const [position, setPosition] = useState(numberValue(block.settings, "start", 50, 5, 95));
  const before = stringValue(block.settings, "beforeLabel", "Before");
  const after = stringValue(block.settings, "afterLabel", "After");
  return <figure className="jelly-image-comparison" {...blockStyle(block)} {...editorData(block, options)} style={{ ...blockStyle(block).style, "--comparison-position": `${position}%`, aspectRatio: ratioOf(block) } as CSSProperties}>
    <Photo settings={block.settings} imageKey="after" className="jelly-image-comparison-photo" />
    <div className="jelly-image-comparison-before" aria-hidden="true"><Photo settings={block.settings} imageKey="before" className="jelly-image-comparison-photo" /></div>
    <span className="jelly-image-comparison-handle" aria-hidden="true" />
    {before && <span className="jelly-image-comparison-label" data-side="before" aria-hidden="true">{before}</span>}
    {after && <span className="jelly-image-comparison-label" data-side="after" aria-hidden="true">{after}</span>}
    <label className="jelly-visually-hidden" htmlFor={id}>{`Compare ${before} and ${after}`}</label>
    <input id={id} className="jelly-image-comparison-range" type="range" min={0} max={100} value={position} onChange={(event) => setPosition(Number(event.target.value))} />
  </figure>;
}

function VideoCard({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const heading = stringValue(block.settings, "heading");
  const text = stringValue(block.settings, "text");
  const video: BlockNode = { ...block, settings: { url: block.settings.url, poster: block.settings.poster, controls: true } };
  return <article className="jelly-video-card" {...blockStyle(block)} {...editorData(block, options, "url")}>
    <VideoBlock block={video} editor={options.editor} />
    {(heading || text) && <div className="jelly-video-card-body">
      {heading && <h3 className="jelly-video-card-heading">{heading}</h3>}
      {text && <p className="jelly-video-card-text">{text}</p>}
    </div>}
  </article>;
}

function ProductCardBlock({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const products = useStoreProducts(options.context.commerce, true);
  const product = pickProduct(products, block.settings.productId, 0);
  if (!product) return options.editor ? <div className="jelly-content-card-media is-empty" {...editorData(block, options)}>Add products to your store to show one here</div> : null;
  return <div className="jelly-product-card-block" {...blockStyle(block)} {...editorData(block, options)}><ProductCard product={product} /></div>;
}

function ProductOverlayCard({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const products = useStoreProducts(options.context.commerce, true);
  const product = pickProduct(products, block.settings.productId, 0);
  const own = imageValue(block.settings);
  const photoUrl = own?.url ?? product?.imageUrl;
  if (!product && !options.editor) return null;
  return <figure className="jelly-product-overlay" data-card-position={choice(block.settings, "cardPosition", ["bottom-left", "bottom-right", "top-left", "top-right"] as const, "bottom-left")} {...blockStyle(block)} {...editorData(block, options)} style={{ ...blockStyle(block).style, aspectRatio: ratioOf(block, "portrait") }}>
    {photoUrl
      // eslint-disable-next-line @next/next/no-img-element
      ? <img className="jelly-product-overlay-photo" src={photoUrl} alt={own ? (typeof own.alt === "string" ? own.alt : "") : ""} loading="lazy" {...mediaPhoto(photoUrl, "(min-width: 768px) 40vw, 100vw")} />
      : <span className="jelly-product-overlay-photo is-empty" aria-hidden="true" />}
    {product && <a className="jelly-product-overlay-card" href={product.href}>
      {product.imageUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="jelly-product-overlay-thumb" src={product.imageUrl} alt="" loading="lazy" />
        : null}
      <span className="jelly-product-overlay-text"><span className="jelly-product-overlay-name">{product.name}</span><span className="jelly-product-overlay-price">{product.price}</span></span>
      <span className="jelly-product-overlay-shop" aria-hidden="true">Shop</span>
    </a>}
  </figure>;
}

function Press({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const quote = stringValue(block.settings, "quote");
  if (!quote) return null;
  const source = stringValue(block.settings, "source");
  const logo = imageValue(block.settings, "logo");
  return <figure className="jelly-press" {...blockStyle(block)} {...editorData(block, options, "quote")}>
    <blockquote className="jelly-press-quote">{quote}</blockquote>
    {(logo || source) && <figcaption className="jelly-press-source">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo ? <img className="jelly-press-logo" src={logo.url} alt={source || (typeof logo.alt === "string" ? logo.alt : "")} loading="lazy" /> : source}
    </figcaption>}
  </figure>;
}

function NewsletterBlock({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  return <div className="jelly-newsletter-block" {...blockStyle(block)} {...editorData(block, options)}>
    <NewsletterForm source={`block:${block.id}`} buttonLabel={stringValue(block.settings, "buttonLabel", "Subscribe")} subscribe={options.context.commerce.subscribeNewsletter} mode={options.context.mode} />
  </div>;
}

function ContactFormBlock({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const id = useId();
  const [status, setStatus] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string>();
  const send = options.context.commerce.sendContactMessage;
  const live = options.context.mode === "published" && Boolean(send);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!live || !send || status === "pending") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("pending"); setError(undefined);
    try {
      await send({ name: String(data.get("name") ?? ""), email: String(data.get("email") ?? ""), message: String(data.get("message") ?? "") });
      form.reset(); setStatus("sent");
    } catch (caught) {
      setStatus("idle");
      setError(caught instanceof Error ? caught.message : "We couldn’t send your message. Please try again.");
    }
  };
  return <form className="jelly-contact-form" onSubmit={(event) => void submit(event)} {...blockStyle(block)} {...editorData(block, options)}>
    <label htmlFor={`${id}-name`}>Your name</label>
    <input id={`${id}-name`} name="name" required maxLength={120} autoComplete="name" />
    <label htmlFor={`${id}-email`}>Email</label>
    <input id={`${id}-email`} name="email" type="email" required maxLength={254} autoComplete="email" />
    <label htmlFor={`${id}-message`}>Message</label>
    <textarea id={`${id}-message`} name="message" required maxLength={5000} rows={5} />
    <button type="submit" className="jelly-button" disabled={!live || status === "pending"}>{status === "pending" ? "Sending…" : stringValue(block.settings, "buttonLabel", "Send message")}</button>
    {!live && <p className="jelly-newsletter-note">Messages can be sent on your live store.</p>}
    {status === "sent" && <p role="status">{stringValue(block.settings, "successText", "Thanks, we will reply soon.")}</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}

const networks = [
  { key: "showWhatsapp", label: "WhatsApp", url: (page: string) => `https://wa.me/?text=${encodeURIComponent(page)}` },
  { key: "showFacebook", label: "Facebook", url: (page: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(page)}` },
  { key: "showX", label: "X", url: (page: string) => `https://x.com/intent/post?url=${encodeURIComponent(page)}` },
  { key: "showPinterest", label: "Pinterest", url: (page: string) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(page)}` },
] as const;

const noSubscribe = () => () => undefined;

/** Share links for the page the shopper is on (its address is read in the browser). */
function Share({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  // The address is read in the browser only (the server draws the links without it).
  const page = useSyncExternalStore(noSubscribe, () => window.location.href, () => undefined);
  const [copied, setCopied] = useState(false);
  const label = stringValue(block.settings, "label");
  const on = (key: string) => block.settings[key] !== false;
  const copy = async () => {
    if (!page) return;
    try { await navigator.clipboard.writeText(page); setCopied(true); } catch { setCopied(false); }
  };
  return <div className="jelly-share" {...blockStyle(block)} {...editorData(block, options)}>
    {label && <span className="jelly-share-label">{label}</span>}
    <ul className="jelly-share-list">
      {on("showCopy") && <li><button type="button" className="jelly-share-link" onClick={() => void copy()}>{copied ? "Link copied" : "Copy link"}</button></li>}
      {networks.filter((network) => on(network.key)).map((network) => <li key={network.key}>
        <a className="jelly-share-link" href={page && !options.editor ? network.url(page) : undefined} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${network.label} (opens in a new tab)`}>{network.label}</a>
      </li>)}
    </ul>
    {copied && <span className="jelly-visually-hidden" role="status">Link copied</span>}
  </div>;
}

function Countdown({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const target = countdownTarget(block.settings.countdownTo);
  const label = stringValue(block.settings, "label");
  if (target === null) return options.editor ? <div className="jelly-countdown is-empty" {...editorData(block, options)}>Set a date to count down to</div> : null;
  return <div className="jelly-countdown" {...blockStyle(block)} {...editorData(block, options)}>
    {label && <p className="jelly-countdown-label">{label}</p>}
    <HeroCountdown target={target} endText={stringValue(block.settings, "endText")} />
  </div>;
}

function lines(value: string): ReactNode {
  return value.split("\n").map((line, index) => <span key={index} className="jelly-store-locator-line">{line}</span>);
}

function StoreLocator({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const settings = block.settings;
  const name = stringValue(settings, "name");
  const address = stringValue(settings, "address");
  const hours = stringValue(settings, "hours");
  const phone = stringValue(settings, "phone");
  if (!name && !address && !options.editor) return null;
  const custom = stringValue(settings, "mapLink");
  const mapHref = /^https:\/\//.test(custom) ? custom : address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\n/g, ", "))}` : undefined;
  const tel = phone.replace(/[^\d+]/g, "");
  return <div className="jelly-store-locator" {...blockStyle(block)} {...editorData(block, options, "name")}>
    {name && <h3 className="jelly-store-locator-name">{name}</h3>}
    {address && <address className="jelly-store-locator-address">{lines(address)}</address>}
    {hours && <p className="jelly-store-locator-hours">{lines(hours)}</p>}
    <div className="jelly-store-locator-links">
      {mapHref && <a href={mapHref} target="_blank" rel="noopener noreferrer">Get directions<span className="jelly-visually-hidden"> (opens in a new tab)</span></a>}
      {tel && <a href={`tel:${tel}`}>{phone}</a>}
    </div>
  </div>;
}

/** Draws a wave-2 block, or returns undefined when the type is not one of them. */
export function renderMediaBlock(block: BlockNode, options: ContentBlockOptions): ReactNode | undefined {
  const props = { block, options };
  switch (block.type) {
    case "image-card": return <ImageCard key={block.id} {...props} />;
    case "images-stack": return <ImagesStack key={block.id} {...props} />;
    case "image-comparison": return <ImageComparison key={block.id} {...props} />;
    case "video-card": return <VideoCard key={block.id} {...props} />;
    case "product-card": return <ProductCardBlock key={block.id} {...props} />;
    case "product-overlay-card": return <ProductOverlayCard key={block.id} {...props} />;
    case "press": return <Press key={block.id} {...props} />;
    case "newsletter-form": return <NewsletterBlock key={block.id} {...props} />;
    case "contact-form": return <ContactFormBlock key={block.id} {...props} />;
    case "share": return <Share key={block.id} {...props} />;
    case "countdown": return <Countdown key={block.id} {...props} />;
    case "store-locator": return <StoreLocator key={block.id} {...props} />;
    // Product page blocks (product-blocks.tsx).
    default: return renderProductBlock(block, options) ?? renderShowroomBlock(block, options);
  }
}
