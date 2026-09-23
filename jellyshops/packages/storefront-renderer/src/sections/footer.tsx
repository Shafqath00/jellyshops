import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { MenuLinks } from "./header";

export function FooterSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const text = typeof section.settings.text === "string" ? section.settings.text : "Made with Jelly Shop";
  return <footer className="jelly-footer" data-section-id={section.id}><p>{text}</p><MenuLinks section={section} context={context} label="Footer navigation" /></footer>;
}
