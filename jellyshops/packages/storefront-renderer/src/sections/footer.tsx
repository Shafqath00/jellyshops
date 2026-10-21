import { safeRichTextHref, type SectionNode } from "@jelly/storefront-schema";
import type { RendererMode } from "../types";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { MenuList } from "./header";
import { NewsletterForm } from "./home-sections";

function stringSetting(value: unknown): string {
  return typeof value === "string" ? value : "";
}

type FooterColumn = { id: string; heading: string } & ({ kind: "menu"; handle: string } | { kind: "links"; links: Array<{ id: string; label: string; href: string }> });

/**
 * Footer link columns, in block order: each menu block is a column (its
 * label is the heading), a "link-heading" block starts a new column, and
 * "link" blocks fill the column above them.
 */
function footerColumns(section: SectionNode, context: StorefrontRuntimeContext): FooterColumn[] {
  const columns: FooterColumn[] = [];
  for (const block of section.blocks) {
    if (!block.enabled) continue;
    if (block.type === "menu") {
      const handle = stringSetting(block.settings.handle) || "main";
      columns.push({ id: block.id, heading: stringSetting(block.settings.label).trim(), kind: "menu", handle });
    } else if (block.type === "link-heading") {
      columns.push({ id: block.id, heading: stringSetting(block.settings.text).trim(), kind: "links", links: [] });
    } else if (block.type === "link") {
      const label = stringSetting(block.settings.label).trim();
      const href = resolveStorefrontHref(block.settings.link, context.storeSlug);
      if (!label || !href) continue;
      let column = columns.at(-1);
      if (!column || column.kind !== "links") {
        column = { id: block.id, heading: "", kind: "links", links: [] };
        columns.push(column);
      }
      column.links.push({ id: block.id, label, href });
    }
  }
  return columns.filter((column) => column.kind === "menu" ? (context.menus?.[column.handle]?.items.length ?? 0) > 0 : column.links.length > 0);
}

export function FooterSection({ section, context, subscribe, mode = "preview" }: { section: SectionNode; context: StorefrontRuntimeContext; subscribe?: (email: string, source: string) => Promise<void>; mode?: RendererMode }) {
  const text = stringSetting(section.settings.text);
  const storeName = stringSetting(section.settings.storeName);
  const contactEmail = stringSetting(section.settings.contactEmail);
  const copyright = stringSetting(section.settings.copyright).trim() || `© ${new Date().getFullYear()} ${storeName}`.trim();
  const showNewsletter = section.settings.showNewsletter === true;
  const newsletterHeading = stringSetting(section.settings.newsletterHeading).trim() || "Join our newsletter";
  const newsletterText = stringSetting(section.settings.newsletterText).trim();
  const blocks = section.blocks.filter((block) => block.enabled);
  const columns = footerColumns(section, context);
  const socials = blocks.filter((block) => block.type === "social-link").flatMap((block) => {
    const label = stringSetting(block.settings.label);
    const href = safeRichTextHref(stringSetting(block.settings.href));
    return label && href ? [{ id: block.id, label, href }] : [];
  });
  const contacts = blocks.filter((block) => block.type === "contact-item").flatMap((block) => {
    const label = stringSetting(block.settings.label);
    const value = stringSetting(block.settings.value);
    return value ? [{ id: block.id, label, value }] : [];
  });
  return <footer className="jelly-footer" data-section-id={section.id} data-newsletter={showNewsletter ? "true" : undefined}>
    {showNewsletter && <div className="jelly-footer-newsletter jelly-newsletter">
      <h2>{newsletterHeading}</h2>
      {newsletterText && <p className="jelly-newsletter-text">{newsletterText}</p>}
      <NewsletterForm source={`${section.id}:footer`} buttonLabel="Subscribe" subscribe={subscribe} mode={mode} />
    </div>}
    <div className="jelly-footer-inner">
      <div className="jelly-footer-brand">
        {storeName && <strong>{storeName}</strong>}
        {text && <p>{text}</p>}
        {contactEmail && <a href={`mailto:${encodeURIComponent(contactEmail)}`}>{contactEmail}</a>}
      </div>
      {columns.length > 0 && <nav className="jelly-footer-links" aria-label="Footer navigation">{columns.map((column) => <div className="jelly-footer-column" key={column.id}>
        {column.heading && <h2>{column.heading}</h2>}
        {column.kind === "menu" ? <MenuList handle={column.handle} context={context} /> : <ul>{column.links.map((link) => <li key={link.id}><a href={link.href}>{link.label}</a></li>)}</ul>}
      </div>)}</nav>}
      {(contacts.length > 0 || socials.length > 0) && <div className="jelly-footer-contact">
        {contacts.length > 0 && <ul>{contacts.map((item) => <li key={item.id}>{item.label && <span>{item.label}</span>}{item.value}</li>)}</ul>}
        {socials.length > 0 && <ul className="jelly-footer-social" aria-label="Social media">{socials.map((item) => <li key={item.id}><a href={item.href} rel="noopener noreferrer" target="_blank">{item.label}</a></li>)}</ul>}
      </div>}
    </div>
    <p className="jelly-footer-credit">{copyright}</p>
  </footer>;
}
