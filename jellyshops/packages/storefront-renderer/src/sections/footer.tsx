import { safeRichTextHref, type SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { MenuLinks } from "./header";

function stringSetting(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function FooterSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const text = stringSetting(section.settings.text);
  const storeName = stringSetting(section.settings.storeName);
  const contactEmail = stringSetting(section.settings.contactEmail);
  const copyright = stringSetting(section.settings.copyright).trim() || `© ${new Date().getFullYear()} ${storeName}`.trim();
  const blocks = section.blocks.filter((block) => block.enabled);
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
  return <footer className="jelly-footer" data-section-id={section.id}>
    <div className="jelly-footer-inner">
      <div className="jelly-footer-brand">
        {storeName && <strong>{storeName}</strong>}
        {text && <p>{text}</p>}
        {contactEmail && <a href={`mailto:${encodeURIComponent(contactEmail)}`}>{contactEmail}</a>}
      </div>
      <div className="jelly-footer-links"><MenuLinks section={section} context={context} label="Footer navigation" /></div>
      {(contacts.length > 0 || socials.length > 0) && <div className="jelly-footer-contact">
        {contacts.length > 0 && <ul>{contacts.map((item) => <li key={item.id}>{item.label && <span>{item.label}</span>}{item.value}</li>)}</ul>}
        {socials.length > 0 && <ul className="jelly-footer-social" aria-label="Social media">{socials.map((item) => <li key={item.id}><a href={item.href} rel="noopener noreferrer" target="_blank">{item.label}</a></li>)}</ul>}
      </div>}
    </div>
    <p className="jelly-footer-credit">{copyright}</p>
  </footer>;
}
