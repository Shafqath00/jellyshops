import type { SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";

function text(section: SectionNode, fallback: string): string {
  const setting = section.settings.heading ?? section.settings.text;
  if (typeof setting === "string") return setting;
  const block = section.blocks.find(({ enabled }) => enabled);
  const value = block?.settings.text ?? block?.settings.label;
  return typeof value === "string" ? value : fallback;
}

export function AnnouncementBarSection({ section }: { section: SectionNode }) {
  return <aside className="jelly-announcement">{text(section, "Welcome to our store")}</aside>;
}
export function ImageWithTextSection({ section }: { section: SectionNode }) {
  return <section className="jelly-section jelly-image-text"><StorefrontContainer><h2>{text(section, "Image with text")}</h2></StorefrontContainer></section>;
}
export function MulticolumnSection({ section }: { section: SectionNode }) {
  return <section className="jelly-section jelly-multicolumn"><StorefrontContainer><h2>{text(section, "Why shop with us")}</h2></StorefrontContainer></section>;
}
export function NewsletterSection({ section }: { section: SectionNode }) {
  return <section className="jelly-section jelly-newsletter"><StorefrontContainer><h2>{text(section, "Join our newsletter")}</h2><form onSubmit={(event) => event.preventDefault()}><label>Email<input type="email" /></label><button type="submit">Subscribe</button></form></StorefrontContainer></section>;
}
export function SpacerDividerSection() {
  return <div className="jelly-spacer-divider" aria-hidden="true"><hr /></div>;
}
