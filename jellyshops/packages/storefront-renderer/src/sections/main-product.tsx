import { createElement, useEffect, useRef, type ComponentType, type RefObject } from "react";
import { blockLabel, partSectionType } from "@jelly/storefront-registry/runtime";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { CommerceDataProvider, RendererMode } from "../types";
import { blockEditorData } from "./block-content";
import { ProductGallerySection } from "./product-sections";
import { renderBlocks } from "./custom-content";

type PartRenderer = ComponentType<{ section: SectionNode; mode: RendererMode; commerce: CommerceDataProvider; context: StorefrontRuntimeContext; selectedBlockId?: string }>;

const choice = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => options.includes(value as T) ? value as T : fallback;

/**
 * The product page's photos and buying column in one section. The two columns are this markup, so
 * the layout holds whatever parts the merchant adds, hides or moves; each part is drawn by the product
 * section of the same name (`part-product-options` by Product options), with the block's settings. Other blocks
 * (product blocks and the shared content blocks) are drawn as they are in a Custom section.
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
  // Blocks set to "Under the photos" fill the column below the gallery; the rest make the buying panel.
  const below = parts.filter((block) => block.settings.column === "below");
  const panel = parts.filter((block) => block.settings.column !== "below");
  const panelRef = useRef<HTMLDivElement>(null);
  const draw = (block: BlockNode) => <ProductPart key={block.id} block={block} mode={mode} commerce={commerce} context={context} selectedBlockId={selectedBlockId} editor={editor} renderPart={renderPart} />;
  useStickyPanel(panelRef, sticky === "details" || below.length > 0);
  return <section className="jelly-section jelly-main-product" data-media-position={position} data-media-width={width} data-sticky={below.length ? "details" : sticky} data-has-below={below.length ? "" : undefined}>
    <StorefrontContainer className="jelly-main-product-grid">
      <div className="jelly-main-product-media"><ProductGallerySection context={context} section={section} /></div>
      <div className="jelly-main-product-details" ref={panelRef}>{panel.map(draw)}</div>
      {below.length > 0 && <div className="jelly-main-product-below">{below.map(draw)}</div>}
    </StorefrontContainer>
  </section>;
}

/**
 * A buying panel taller than the screen would hide its Add to basket while it sticks to the top. In that case it
 * sticks with its bottom edge in view instead (top = screen height - panel height), so every part stays reachable.
 * Measured on scroll and resize, since the editor's preview frame does not run observers of its own.
 */
function useStickyPanel(ref: RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    const panel = ref.current;
    if (!active || !panel || typeof window === "undefined") return;
    const view = panel.ownerDocument.defaultView ?? window;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const room = view.innerHeight - panel.offsetHeight - 24;
        panel.style.setProperty("--mp-panel-top", room < 24 ? `${room}px` : "");
      });
    };
    measure();
    view.addEventListener("resize", measure);
    view.addEventListener("scroll", measure, { passive: true });
    return () => { cancelAnimationFrame(frame); view.removeEventListener("resize", measure); view.removeEventListener("scroll", measure); };
  }, [ref, active]);
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
  // Any other block (breadcrumbs, delivery estimate, accordion, icon list, share links…) is drawn as it is in a
  // Custom section, so the buying column takes the whole shared block library.
  if (!type) {
    const drawn = renderBlocks([block], { context, editor, selectedBlockId }).filter(Boolean);
    return drawn.length ? <div className="jelly-product-part" data-part="block" data-block-type={block.type}>{drawn}</div> : null;
  }
  const Part = renderPart(type);
  if (!Part) return editor ? <div role="status">Unsupported part: {block.type}</div> : null;
  const section: SectionNode = { id: block.id, type, enabled: true, settings: block.settings, blocks: block.blocks ?? [], ...(block.responsive ? { responsive: block.responsive } : {}) };
  // In the editor a click inside a part selects the part (the block), not one of the drawn section's own parts.
  return <div className="jelly-product-part" data-part={type} {...blockEditorData(block, editor, blockLabel(block.type), selectedBlockId)} {...(editor ? { "data-editor-block-elements": "none" } : {})}>
    {createElement(Part, { section, mode, commerce, context, ...(selectedBlockId ? { selectedBlockId } : {}) })}
  </div>;
}
