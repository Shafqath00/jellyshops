import { safeRichTextHref, type SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { useState, type CSSProperties } from "react";
import type { RendererMode } from "../types";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { choice, imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

function text(section: SectionNode, fallback: string): string {
  const setting = section.settings.heading ?? section.settings.text;
  if (typeof setting === "string") return setting;
  const block = section.blocks.find(({ enabled }) => enabled);
  const value = block?.settings.text ?? block?.settings.label;
  return typeof value === "string" ? value : fallback;
}

/** Heading, text and button content from a section's heading/text/button blocks, falling back to section settings. */
function blockCopy(section: SectionNode, fallbackHeading: string) {
  const blocks = visibleBlocks(section);
  const heading = blocks.find((block) => block.type === "heading");
  const body = blocks.find((block) => block.type === "text");
  const buttons = blocks.filter((block) => block.type === "button");
  return {
    heading: stringValue(heading?.settings, "text", stringValue(section.settings, "heading", fallbackHeading)),
    body: stringValue(body?.settings, "text", stringValue(section.settings, "body", stringValue(section.settings, "text"))),
    buttons: buttons.flatMap((block) => {
      const label = stringValue(block.settings, "label");
      return label ? [{ id: block.id, label, href: block.settings.href }] : [];
    }),
  };
}

function Actions({ buttons, storeSlug }: { buttons: ReturnType<typeof blockCopy>["buttons"]; storeSlug?: string }) {
  const links = buttons.flatMap((button) => {
    const href = resolveStorefrontHref(button.href, storeSlug);
    return href ? [{ ...button, href }] : [];
  });
  if (!links.length) return null;
  return <div className="jelly-section-actions">{links.map((button, index) => <a key={button.id} className={index === 0 ? "jelly-button" : "jelly-button jelly-button--secondary"} href={button.href}>{button.label}</a>)}</div>;
}

export function AnnouncementBarSection({ section }: { section: SectionNode }) {
  const message = text(section, "Welcome to our store");
  const href = typeof section.settings.link === "string" && section.settings.link ? safeRichTextHref(section.settings.link) : null;
  return <aside className="jelly-announcement">{href ? <a href={href}>{message}</a> : message}</aside>;
}

export function ImageWithTextSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const image = imageValue(section.settings);
  const content = blockCopy(section, "Image with text");
  const alignment = choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "left");
  const imagePosition = choice(section.settings, "imagePosition", ["left", "right"] as const, "left");
  const eyebrow = stringValue(section.settings, "eyebrow");
  return <section className={`jelly-section jelly-image-text${image ? " has-image" : ""}`} {...sectionData(section, { "data-image-position": imagePosition })}>
    <StorefrontContainer>
      <div className={`jelly-image-text-layout align-${alignment}`}>
        {image && <div className="jelly-image-text-media">
          {/* Local uploads are served by the media API and are not Next Image assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={typeof image.alt === "string" ? image.alt : ""} loading="lazy" style={{ objectPosition: `${image.focalPoint?.x ?? 50}% ${image.focalPoint?.y ?? 50}%`, objectFit: image.fit === "contain" ? "contain" : "cover" }} />
        </div>}
        <div className="jelly-image-text-content">
          {eyebrow && <p className="jelly-eyebrow">{eyebrow}</p>}
          <h2>{content.heading}</h2>
          {content.body && <p>{content.body}</p>}
          <Actions buttons={content.buttons} storeSlug={context.storeSlug} />
        </div>
      </div>
    </StorefrontContainer>
  </section>;
}

export function ImageBannerSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const image = imageValue(section.settings);
  const content = blockCopy(section, "");
  const overlay = numberValue(section.settings, "overlay", 30, 0, 100) / 100;
  return <section className="jelly-image-banner" {...sectionData(section, {
    "data-height": choice(section.settings, "height", ["medium", "large"] as const, "medium"),
    "data-align": choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "center"),
    "data-has-image": image ? "true" : "false",
  })}>
    {image && <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="jelly-image-banner-media" src={image.url} alt={image.alt ?? ""} loading="lazy" style={{ objectPosition: `${image.focalPoint?.x ?? 50}% ${image.focalPoint?.y ?? 50}%` }} />
      {overlay > 0 && <span className="jelly-image-banner-overlay" aria-hidden="true" style={{ background: `rgba(0, 0, 0, ${overlay})` }} />}
    </>}
    <StorefrontContainer className="jelly-image-banner-content">
      {content.heading && <h2>{content.heading}</h2>}
      {content.body && <p>{content.body}</p>}
      <Actions buttons={content.buttons} storeSlug={context.storeSlug} />
    </StorefrontContainer>
  </section>;
}

export function MulticolumnSection({ section, context }: { section: SectionNode; context?: StorefrontRuntimeContext }) {
  const columns = visibleBlocks(section, "column").flatMap((block) => {
    const heading = stringValue(block.settings, "heading");
    return heading ? [{ id: block.id, heading, text: stringValue(block.settings, "text") }] : [];
  });
  const content = blockCopy(section, "Why shop with us");
  const count = numberValue(section.settings, "columns", 3, 2, 4);
  return <section className="jelly-section jelly-multicolumn" {...sectionData(section, { "data-align": choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "left") })}>
    <StorefrontContainer>
      <div className="jelly-section-intro"><h2>{content.heading}</h2>{content.body && <p>{content.body}</p>}</div>
      {columns.length > 0 && <div className="jelly-multicolumn-grid" style={{ "--jelly-columns": count } as CSSProperties}>
        {columns.map((column) => <article key={column.id}><h3>{column.heading}</h3>{column.text && <p>{column.text}</p>}</article>)}
      </div>}
      <Actions buttons={content.buttons} storeSlug={context?.storeSlug} />
    </StorefrontContainer>
  </section>;
}

export function FaqSection({ section }: { section: SectionNode }) {
  const items = visibleBlocks(section, "faq-item").flatMap((block) => {
    const question = stringValue(block.settings, "question");
    return question ? [{ id: block.id, question, answer: stringValue(block.settings, "answer") }] : [];
  });
  const heading = stringValue(section.settings, "heading", "Frequently asked questions");
  const intro = stringValue(section.settings, "text");
  return <section className="jelly-section jelly-faq" {...sectionData(section)}>
    <StorefrontContainer>
      <div className="jelly-faq-layout">
        <div className="jelly-section-intro"><h2>{heading}</h2>{intro && <p>{intro}</p>}</div>
        <div className="jelly-faq-list">
          {items.map((item) => <details key={item.id}><summary>{item.question}</summary>{item.answer && <p>{item.answer}</p>}</details>)}
        </div>
      </div>
    </StorefrontContainer>
  </section>;
}

export function NewsletterSection({ section, subscribe, mode = "preview" }: { section: SectionNode; subscribe?: (email: string, source: string) => Promise<void>; mode?: RendererMode }) {
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle"); const [error, setError] = useState<string>();
  const content = blockCopy(section, "Join our newsletter");
  const buttonLabel = stringValue(section.settings, "buttonLabel", "Subscribe");
  return <section className="jelly-section jelly-newsletter" {...sectionData(section, { "data-align": choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "left") })}><StorefrontContainer>
    <h2>{content.heading}</h2>
    {content.body && <p className="jelly-newsletter-text">{content.body}</p>}
    <form onSubmit={(event) => {
      event.preventDefault(); if (mode !== "published" || !subscribe || status === "pending") return;
      const data = new FormData(event.currentTarget); if (data.get("consent") !== "yes") { setError("Consent is required to subscribe."); return; }
      setStatus("pending"); setError(undefined);
      void subscribe(String(data.get("email")), section.id).then(() => setStatus("success")).catch((caught: unknown) => { setStatus("idle"); setError(caught instanceof Error ? caught.message : "Unable to subscribe. Please retry."); });
    }}><label>Email<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label><label><input type="checkbox" name="consent" value="yes" required />I agree to receive updates from this store.</label><button type="submit" disabled={mode !== "published" || !subscribe || status === "pending"}>{status === "pending" ? "Subscribing…" : buttonLabel}</button>{mode !== "published" && <p className="jelly-newsletter-note">Subscriptions are disabled in preview.</p>}{status === "success" && <p role="status">You’re subscribed.</p>}{error && <p role="alert">{error}</p>}</form>
  </StorefrontContainer></section>;
}

export function SpacerDividerSection() {
  return <div className="jelly-spacer-divider" aria-hidden="true"><hr /></div>;
}
