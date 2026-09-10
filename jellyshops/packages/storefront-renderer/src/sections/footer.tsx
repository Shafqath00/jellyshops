import type { SectionNode } from "@jelly/storefront-schema";
export function FooterSection({ section }: { section: SectionNode }) { return <footer className="jelly-footer" data-section-id={section.id}>Made with Jelly Shop</footer>; }
