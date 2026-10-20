import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { MenuLinks } from "./header";

export function FooterSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const text = typeof section.settings.text === "string" ? section.settings.text : "";
  const storeName = typeof section.settings.storeName === "string" ? section.settings.storeName : "";
  const contactEmail = typeof section.settings.contactEmail === "string" ? section.settings.contactEmail : "";
  return <footer className="jelly-footer" data-section-id={section.id}><div className="jelly-footer-brand">{storeName && <strong>{storeName}</strong>}{text && <p>{text}</p>}{contactEmail && <a href={`mailto:${encodeURIComponent(contactEmail)}`}>{contactEmail}</a>}</div><MenuLinks section={section} context={context} label="Footer navigation" /><p className="jelly-footer-credit">© {new Date().getFullYear()} {storeName}</p></footer>;
}
