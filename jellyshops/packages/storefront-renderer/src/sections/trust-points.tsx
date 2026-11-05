import type { CSSProperties } from "react";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { resolveStorefrontHref, type StorefrontRuntimeContext } from "../runtime-context";
import type { RendererMode } from "../types";
import { blockEditorData } from "./block-content";
import { choice, sectionData, visibleBlocks } from "./shared";
import { StoreIcon } from "./store-icon";

export interface TrustPoint { block?: BlockNode; text: string; icon: unknown; href: string | null }

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

/** Trust points from trust-point blocks; older strips' heading and text blocks count too, with a tick. */
export function trustPoints(blocks: BlockNode[], context?: Pick<StorefrontRuntimeContext, "storeSlug">): TrustPoint[] {
  return blocks.flatMap((block) => {
    if (!block.enabled || !["trust-point", "heading", "text"].includes(block.type)) return [];
    const label = text(block.settings.text);
    if (!label) return [];
    return [{ block, text: label, icon: block.type === "trust-point" ? block.settings.icon : "check", href: block.type === "trust-point" ? resolveStorefrontHref(block.settings.link, context?.storeSlug) : null }];
  });
}

/** The points as list items. `copy` marks the second, hidden copy a scrolling strip needs. */
export function TrustPointItems({ points, icons, editor = false, selectedBlockId, copy = false }: { points: TrustPoint[]; icons: boolean; editor?: boolean; selectedBlockId?: string; copy?: boolean }) {
  return <>{points.map((point, index) => {
    const content = <>{icons && <StoreIcon name={point.icon} />}<span>{point.text}</span></>;
    const data = point.block && !copy ? blockEditorData(point.block, editor, "Trust point", selectedBlockId) : {};
    return <li key={point.block?.id ?? index} {...data}>{point.href ? <a href={point.href} tabIndex={copy ? -1 : undefined}>{content}</a> : content}</li>;
  })}</>;
}

const FALLBACK: TrustPoint[] = ["Secure checkout", "Carefully packed", "Friendly support"].map((label) => ({ text: label, icon: "check", href: null }));
const SECONDS: Record<"slow" | "normal" | "fast", number> = { slow: 6, normal: 4, fast: 2.5 };

/**
 * Trust badges: short promises ("Free delivery") in a row, or a strip that scrolls sideways and
 * pauses while pointed at or focused. Shoppers who ask for less motion get the row without movement.
 */
export function TrustStripSection({ section, context, mode = "published", selectedBlockId }: { section: SectionNode; context?: StorefrontRuntimeContext; mode?: RendererMode; selectedBlockId?: string }) {
  const editor = mode === "editor";
  const own = trustPoints(visibleBlocks(section), context);
  const points = own.length ? own : FALLBACK;
  const icons = section.settings.showIcons !== false;
  const layout = choice(section.settings, "layout", ["row", "scroll"] as const, "row");
  if (layout === "scroll") {
    // Each copy takes the speed's seconds per point, so long and short strips move at the same pace.
    const duration = `${points.length * SECONDS[choice(section.settings, "speed", ["slow", "normal", "fast"] as const, "normal")]}s`;
    return <section className="jelly-trust-strip" {...sectionData(section, { "data-layout": "scroll" })}>
      <div className="jelly-trust-marquee" style={{ "--jelly-marquee-duration": duration } as CSSProperties}>
        <ul className="jelly-trust-track"><TrustPointItems points={points} icons={icons} editor={editor} selectedBlockId={selectedBlockId} /></ul>
        <ul className="jelly-trust-track" aria-hidden="true"><TrustPointItems points={points} icons={icons} copy /></ul>
      </div>
    </section>;
  }
  return <section className="jelly-trust-strip" {...sectionData(section, { "data-layout": "row" })}><StorefrontContainer>
    <ul><TrustPointItems points={points} icons={icons} editor={editor} selectedBlockId={selectedBlockId} /></ul>
  </StorefrontContainer></section>;
}
