/* eslint-disable @next/next/no-img-element -- theme package assets are intentionally namespaced static files. */
import type { ComponentType } from "react";
import type { SectionNode } from "@jelly/storefront-schema";

export interface ThemeSectionProps {
  section: SectionNode;
  mode: "preview" | "editor" | "published";
  commerce: { getProducts(input?: { featured?: boolean; limit?: number }): Promise<unknown[]> };
}

/** Presentation-only override; commerce is supplied by the core renderer. */
export const BoutiqueHero: ComponentType<ThemeSectionProps> = ({ section }) => {
  const heading = section.blocks.find((block) => block.type === "heading")?.settings.text;
  return <section className="jelly-boutique-hero"><p>THE JELLYSHOP EDIT</p><h1>{typeof heading === "string" ? heading : "Objects with a story."}</h1><img src="/themes/example-boutique/monogram.svg" alt="" /></section>;
};
