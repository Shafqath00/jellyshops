import { safeRichTextHref, type MediaReference, type SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { useState } from "react";
import type { RendererMode } from "../types";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";

function text(section: SectionNode, fallback: string): string {
  const setting = section.settings.heading ?? section.settings.text;
  if (typeof setting === "string") return setting;
  const block = section.blocks.find(({ enabled }) => enabled);
  const value = block?.settings.text ?? block?.settings.label;
  return typeof value === "string" ? value : fallback;
}

export function AnnouncementBarSection({ section }: { section: SectionNode }) {
  const message = text(section, "Welcome to our store");
  const href = typeof section.settings.link === "string" && section.settings.link ? safeRichTextHref(section.settings.link) : null;
  return <aside className="jelly-announcement">{href ? <a href={href}>{message}</a> : message}</aside>;
}
export function ImageWithTextSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const candidate = section.settings.image;
  const image = candidate && typeof candidate === "object" && "url" in candidate && typeof candidate.url === "string"
    ? candidate as MediaReference
    : undefined;
  const safeImageUrl = image ? safeRichTextHref(image.url) : null;
  const visibleBlocks = section.blocks.filter((block) => block.enabled);
  const headingBlock = visibleBlocks.find((block) => block.type === "heading");
  const textBlock = visibleBlocks.find((block) => block.type === "text");
  const buttonBlock = visibleBlocks.find((block) => block.type === "button");
  const heading = typeof headingBlock?.settings.text === "string"
    ? headingBlock.settings.text
    : typeof section.settings.heading === "string" ? section.settings.heading : "Image with text";
  const body = typeof textBlock?.settings.text === "string"
    ? textBlock.settings.text
    : typeof section.settings.body === "string" ? section.settings.body : typeof section.settings.text === "string" ? section.settings.text : "";
  const buttonLabel = typeof buttonBlock?.settings.label === "string" ? buttonBlock.settings.label : "";
  const buttonHref = resolveStorefrontHref(buttonBlock?.settings.href, context.storeSlug);
  const alignment = section.settings.contentAlignment === "center" || section.settings.contentAlignment === "right"
    ? section.settings.contentAlignment
    : "left";
  const hasImage = Boolean(image && safeImageUrl && !safeImageUrl.startsWith("#"));
  return <section className={`jelly-section jelly-image-text${hasImage ? " has-image" : ""}`}>
    <StorefrontContainer>
      <div className={`jelly-image-text-layout align-${alignment}`}>
        {hasImage && image && safeImageUrl && <div className="jelly-image-text-media">
          {/* Local uploads are served by the media API and are not Next Image assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={safeImageUrl} alt={typeof image.alt === "string" ? image.alt : ""} style={{ objectPosition: `${image.focalPoint?.x ?? 50}% ${image.focalPoint?.y ?? 50}%`, objectFit: image.fit === "contain" ? "contain" : "cover" }} />
        </div>}
        <div className="jelly-image-text-content">
          <h2>{heading}</h2>
          {body && <p>{body}</p>}
          {buttonLabel && buttonHref && <a className="jelly-button" href={buttonHref}>{buttonLabel}</a>}
        </div>
      </div>
    </StorefrontContainer>
  </section>;
}
export function MulticolumnSection({ section }: { section: SectionNode }) {
  return <section className="jelly-section jelly-multicolumn"><StorefrontContainer><h2>{text(section, "Why shop with us")}</h2></StorefrontContainer></section>;
}
export function NewsletterSection({ section, subscribe, mode = "preview" }: { section: SectionNode; subscribe?: (email: string, source: string) => Promise<void>; mode?: RendererMode }) {
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle"); const [error, setError] = useState<string>();
  return <section className="jelly-section jelly-newsletter"><StorefrontContainer><h2>{text(section, "Join our newsletter")}</h2><form onSubmit={(event) => {
    event.preventDefault(); if (mode !== "published" || !subscribe || status === "pending") return;
    const data = new FormData(event.currentTarget); if (data.get("consent") !== "yes") { setError("Consent is required to subscribe."); return; }
    setStatus("pending"); setError(undefined);
    void subscribe(String(data.get("email")), section.id).then(() => setStatus("success")).catch((caught: unknown) => { setStatus("idle"); setError(caught instanceof Error ? caught.message : "Unable to subscribe. Please retry."); });
  }}><label>Email<input type="email" name="email" autoComplete="email" required maxLength={254} /></label><label><input type="checkbox" name="consent" value="yes" required />I agree to receive updates from this store.</label><button type="submit" disabled={mode !== "published" || !subscribe || status === "pending"}>{status === "pending" ? "Subscribing…" : "Subscribe"}</button>{mode !== "published" && <p>Subscriptions are disabled in preview.</p>}{status === "success" && <p role="status">You’re subscribed.</p>}{error && <p role="alert">{error}</p>}</form></StorefrontContainer></section>;
}
export function SpacerDividerSection() {
  return <div className="jelly-spacer-divider" aria-hidden="true"><hr /></div>;
}
