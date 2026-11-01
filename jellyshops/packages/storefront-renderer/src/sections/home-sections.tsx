import { safeRichTextHref, type SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { useState, type CSSProperties } from "react";
import type { RendererMode } from "../types";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { choice, headingHidden, imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";
import { formattedSetting, inlineSetting, SettingText } from "./setting-text";
import { blockStyle } from "../block-style";
import { blockEditorData, buttonProps } from "./block-content";
import { SectionGroups } from "./custom-content";

function text(section: SectionNode, fallback: string): string {
  const setting = section.settings.heading ?? section.settings.text;
  if (typeof setting === "string") return setting;
  const block = section.blocks.find(({ enabled }) => enabled);
  const value = block?.settings.text ?? block?.settings.label;
  return typeof value === "string" ? value : fallback;
}

/** Heading, text and button content from a section's heading/text/button blocks, falling back to section settings. */
/** `editor` adds the data the editor preview needs to select a block when it is clicked. */
function blockCopy(section: SectionNode, fallbackHeading: string, editor = false) {
  const blocks = visibleBlocks(section);
  const heading = blocks.find((block) => block.type === "heading");
  const body = blocks.find((block) => block.type === "text");
  const buttons = blocks.filter((block) => block.type === "button");
  return {
    heading: stringValue(heading?.settings, "text", stringValue(section.settings, "heading", fallbackHeading)),
    /** The heading with its formatting (bold, italic, links, colour, size) when the heading block has it. */
    headingContent: inlineSetting(heading?.settings, "text", stringValue(heading?.settings, "text", stringValue(section.settings, "heading", fallbackHeading))),
    body: stringValue(body?.settings, "text", stringValue(section.settings, "body", stringValue(section.settings, "text"))),
    bodyDocument: stringValue(body?.settings, "text") ? formattedSetting(body?.settings, "text") : stringValue(section.settings, "body") ? null : formattedSetting(section.settings, "text"),
    headingProps: { ...blockStyle(heading), ...(heading ? blockEditorData(heading, editor, "Heading", undefined, "text") : {}) },
    bodyProps: { ...blockStyle(body), ...(body ? blockEditorData(body, editor, "Text", undefined, "text") : {}) },
    buttons: buttons.flatMap((block) => {
      const label = stringValue(block.settings, "label");
      return label ? [{ id: block.id, label, href: block.settings.href, settings: block.settings, mobile: block.responsive?.mobile, editorData: blockEditorData(block, editor, "Button", undefined, "label") }] : [];
    }),
  };
}

function Actions({ buttons, storeSlug }: { buttons: ReturnType<typeof blockCopy>["buttons"]; storeSlug?: string }) {
  const links = buttons.flatMap((button) => {
    const href = resolveStorefrontHref(button.href, storeSlug);
    return href ? [{ ...button, href }] : [];
  });
  if (!links.length) return null;
  return <div className="jelly-section-actions">{links.map((button, index) => <a key={button.id} href={button.href} {...buttonProps(button.settings, index, button.mobile)} {...button.editorData}>{button.label}</a>)}</div>;
}

export function AnnouncementBarSection({ section }: { section: SectionNode }) {
  const message = text(section, "Welcome to our store");
  const href = typeof section.settings.link === "string" && section.settings.link ? safeRichTextHref(section.settings.link) : null;
  return <aside className="jelly-announcement">{href ? <a href={href}>{message}</a> : message}</aside>;
}

export function ImageWithTextSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const image = imageValue(section.settings);
  const content = blockCopy(section, "Image with text", context.mode === "editor");
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
          <h2 {...content.headingProps}>{content.headingContent}</h2>
          <SettingText text={content.body} document={content.bodyDocument} {...content.bodyProps} />
          <Actions buttons={content.buttons} storeSlug={context.storeSlug} />
          <SectionGroups section={section} context={context} />
        </div>
      </div>
    </StorefrontContainer>
  </section>;
}

export function ImageBannerSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const image = imageValue(section.settings);
  const content = blockCopy(section, "", context.mode === "editor");
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
      {content.heading && <h2 {...content.headingProps}>{content.headingContent}</h2>}
      <SettingText text={content.body} document={content.bodyDocument} {...content.bodyProps} />
      <Actions buttons={content.buttons} storeSlug={context.storeSlug} />
      <SectionGroups section={section} context={context} />
    </StorefrontContainer>
  </section>;
}

export function MulticolumnSection({ section, context }: { section: SectionNode; context?: StorefrontRuntimeContext }) {
  const columns = visibleBlocks(section, "column").flatMap((block) => {
    const heading = stringValue(block.settings, "heading");
    return heading ? [{ id: block.id, heading, text: stringValue(block.settings, "text"), document: formattedSetting(block.settings, "text") }] : [];
  });
  const content = blockCopy(section, "Why shop with us", context?.mode === "editor");
  const count = numberValue(section.settings, "columns", 3, 2, 4);
  return <section className="jelly-section jelly-multicolumn" {...sectionData(section, { "data-align": choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "left") })}>
    <StorefrontContainer>
      {!headingHidden(section) && <div className="jelly-section-intro"><h2 {...content.headingProps}>{content.headingContent}</h2><SettingText text={content.body} document={content.bodyDocument} {...content.bodyProps} /></div>}
      {columns.length > 0 && <div className="jelly-multicolumn-grid" style={{ "--jelly-columns": count } as CSSProperties}>
        {columns.map((column) => <article key={column.id}><h3>{column.heading}</h3><SettingText text={column.text} document={column.document} /></article>)}
      </div>}
      <Actions buttons={content.buttons} storeSlug={context?.storeSlug} />
    </StorefrontContainer>
  </section>;
}

export function FaqSection({ section, editor = false }: { section: SectionNode; editor?: boolean }) {
  const items = visibleBlocks(section, "faq-item").flatMap((block) => {
    const question = stringValue(block.settings, "question");
    return question ? [{ id: block.id, block, question, answer: stringValue(block.settings, "answer"), document: formattedSetting(block.settings, "answer") }] : [];
  });
  const heading = stringValue(section.settings, "heading", "Frequently asked questions");
  const intro = stringValue(section.settings, "text");
  return <section className="jelly-section jelly-faq" {...sectionData(section)}>
    <StorefrontContainer>
      <div className="jelly-faq-layout">
        <div className="jelly-section-intro"><h2>{heading}</h2><SettingText text={intro} document={formattedSetting(section.settings, "text")} /></div>
        <div className="jelly-faq-list">
          {items.map((item) => <details key={item.id} {...blockEditorData(item.block, editor, "Question")}><summary>{item.question}</summary><SettingText text={item.answer} document={item.document} /></details>)}
        </div>
      </div>
    </StorefrontContainer>
  </section>;
}

/** Email sign-up with consent, shared by the newsletter section and the footer. `source` records where the customer subscribed. */
export function NewsletterForm({ source, buttonLabel, subscribe, mode = "preview" }: { source: string; buttonLabel: string; subscribe?: (email: string, source: string) => Promise<void>; mode?: RendererMode }) {
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle"); const [error, setError] = useState<string>();
  return <form onSubmit={(event) => {
    event.preventDefault(); if (mode !== "published" || !subscribe || status === "pending") return;
    const data = new FormData(event.currentTarget); if (data.get("consent") !== "yes") { setError("Consent is required to subscribe."); return; }
    setStatus("pending"); setError(undefined);
    void subscribe(String(data.get("email")), source).then(() => setStatus("success")).catch((caught: unknown) => { setStatus("idle"); setError(caught instanceof Error ? caught.message : "Unable to subscribe. Please retry."); });
  }}><label>Email<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label><label><input type="checkbox" name="consent" value="yes" required />I agree to receive updates from this store.</label><button type="submit" disabled={mode !== "published" || !subscribe || status === "pending"}>{status === "pending" ? "Subscribing…" : buttonLabel}</button>{mode !== "published" && <p className="jelly-newsletter-note">Subscriptions are disabled in preview.</p>}{status === "success" && <p role="status">You’re subscribed.</p>}{error && <p role="alert">{error}</p>}</form>;
}

export function NewsletterSection({ section, subscribe, mode = "preview" }: { section: SectionNode; subscribe?: (email: string, source: string) => Promise<void>; mode?: RendererMode }) {
  const content = blockCopy(section, "Join our newsletter", mode === "editor");
  const buttonLabel = stringValue(section.settings, "buttonLabel", "Subscribe");
  return <section className="jelly-section jelly-newsletter" {...sectionData(section, { "data-align": choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "left") })}><StorefrontContainer>
    <h2 {...content.headingProps}>{content.headingContent}</h2>
    <SettingText {...content.bodyProps} className="jelly-newsletter-text" text={content.body} document={content.bodyDocument} />
    <NewsletterForm source={section.id} buttonLabel={buttonLabel} subscribe={subscribe} mode={mode} />
  </StorefrontContainer></section>;
}

export function SpacerDividerSection() {
  return <div className="jelly-spacer-divider" aria-hidden="true"><hr /></div>;
}
