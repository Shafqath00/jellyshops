import { createElement, type ComponentType } from "react";
import { blockLabel, partSectionType } from "@jelly/storefront-registry";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { CommerceDataProvider, RendererMode } from "../types";
import { blockEditorData } from "./block-content";
import { ProductGallerySection } from "./product-sections";

type PartRenderer = ComponentType<{ section: SectionNode; mode: RendererMode; commerce: CommerceDataProvider; context: StorefrontRuntimeContext; selectedBlockId?: string }>;

const choice = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => options.includes(value as T) ? value as T : fallback;

/**
 * The product page's photos and buying column in one section. The two columns are this markup, so
 * the layout holds whatever parts the merchant adds, hides or moves; each part is drawn by the product
 * section of the same name (`part-product-options` by Product options), with the block's settings.
 */
export function MainProductSection({ section, mode, commerce, context, selectedBlockId, renderPart }: {
  section: SectionNode;
  mode: RendererMode;
  commerce: CommerceDataProvider;
  context: StorefrontRuntimeContext;
  selectedBlockId?: string;
  renderPart: (sectionType: string) => PartRenderer | undefined;
}) {
  const editor = mode === "editor";
  const position = choice(section.settings.mediaPosition, ["left", "right"] as const, "left");
  const width = choice(section.settings.mediaWidth, ["narrow", "medium", "wide"] as const, "medium");
  const sticky = choice(section.settings.stickyColumn, ["media", "details", "none"] as const, "media");
  const parts = section.blocks.filter((block) => block.enabled);
  return <section className="jelly-section jelly-main-product" data-media-position={position} data-media-width={width} data-sticky={sticky}>
    <StorefrontContainer className="jelly-main-product-grid">
      <div className="jelly-main-product-media"><ProductGallerySection context={context} section={section} /></div>
      <div className="jelly-main-product-details">
        {parts.map((block) => <ProductPart key={block.id} block={block} mode={mode} commerce={commerce} context={context} selectedBlockId={selectedBlockId} editor={editor} renderPart={renderPart} />)}
      </div>
    </StorefrontContainer>
  </section>;
}

function ProductPart({ block, mode, commerce, context, selectedBlockId, editor, renderPart }: {
  block: BlockNode;
  mode: RendererMode;
  commerce: CommerceDataProvider;
  context: StorefrontRuntimeContext;
  selectedBlockId?: string;
  editor: boolean;
  renderPart: (sectionType: string) => PartRenderer | undefined;
}) {
  const type = partSectionType(block.type);
  const Part = type ? renderPart(type) : undefined;
  if (!type || !Part) return editor ? <div role="status">Unsupported part: {block.type}</div> : null;
  const section: SectionNode = { id: block.id, type, enabled: true, settings: block.settings, blocks: block.blocks ?? [], ...(block.responsive ? { responsive: block.responsive } : {}) };
  // In the editor a click inside a part selects the part (the block), not one of the drawn section's own parts.
  return <div className="jelly-product-part" data-part={type} {...blockEditorData(block, editor, blockLabel(block.type), selectedBlockId)} {...(editor ? { "data-editor-block-elements": "none" } : {})}>
    {createElement(Part, { section, mode, commerce, context, ...(selectedBlockId ? { selectedBlockId } : {}) })}
  </div>;
}
