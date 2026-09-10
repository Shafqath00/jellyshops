import type { SectionNode } from "@jelly/storefront-schema";
import { FooterSection } from "./sections/footer";
import { HeaderSection } from "./sections/header";
import { HeroSection } from "./sections/hero";
import { ProductGridSection } from "./sections/product-grid";
import { RichTextSection } from "./sections/rich-text";
import { AnnouncementBarSection, ImageWithTextSection, MulticolumnSection, NewsletterSection, SpacerDividerSection } from "./sections/home-sections";
import type { CommerceDataProvider, RendererMode, RendererSelection } from "./types";

export function SectionRenderer({ section, mode, commerce, region, selected, onSelect }: { section: SectionNode; mode: RendererMode; commerce: CommerceDataProvider; region?: "header" | "template" | "footer"; selected?: RendererSelection | null; onSelect?: (selection: RendererSelection) => void }) {
  if (!section.enabled) return null;
  let content: React.ReactNode = null;
  if (section.type === "announcement-bar") content = <AnnouncementBarSection section={section} />;
  else if (section.type === "header") content = <HeaderSection section={section} />;
  else if (section.type === "footer") content = <FooterSection section={section} />;
  else if (section.type === "hero") content = <HeroSection section={section} editor={mode === "editor"} />;
  else if (section.type === "rich-text") content = <RichTextSection section={section} editor={mode === "editor"} />;
  else if (section.type === "product-grid" || section.type === "featured-collection") content = <ProductGridSection commerce={commerce} />;
  else if (section.type === "image-with-text" || section.type === "image-text") content = <ImageWithTextSection section={section} />;
  else if (section.type === "multicolumn") content = <MulticolumnSection section={section} />;
  else if (section.type === "newsletter") content = <NewsletterSection section={section} />;
  else if (section.type === "spacer-divider" || section.type === "spacer" || section.type === "divider") content = <SpacerDividerSection />;
  else content = mode !== "published" ? <aside role="status">Unsupported section: {section.type}</aside> : null;
  if (!content) return null;
  const editor = mode === "editor";
  const isSelected = selected?.kind === "section" && selected.sectionId === section.id;
  return <div
    data-testid={`section-${section.type}`}
    {...(editor ? { "data-editor-section-id": section.id, "data-editor-selected": String(isSelected) } : {})}
    onClick={editor ? (event) => {
      event.preventDefault(); event.stopPropagation();
      const target = event.target as HTMLElement;
      const block = target.closest<HTMLElement>("[data-editor-block-id]");
      const blockId = block?.dataset.editorBlockId;
      onSelect?.(blockId
        ? { kind: "block", region, sectionId: section.id, blockId, fieldKey: block?.dataset.editorFieldKey }
        : { kind: "section", region, sectionId: section.id });
    } : undefined}
  >{content}</div>;
}
