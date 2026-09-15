import type { SectionNode } from "@jelly/storefront-schema";
export function HeaderSection({ section }: { section: SectionNode }) { return <header className="jelly-header" data-section-id={section.id}>Storefront</header>; }
