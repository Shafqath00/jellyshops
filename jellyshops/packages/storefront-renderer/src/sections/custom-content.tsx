import type { CSSProperties, ReactNode } from "react";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { childBlocks } from "@jelly/storefront-schema";
import { blockLabel } from "@jelly/storefront-registry";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { blockStyle } from "../block-style";
import { blockEditorData, buttonProps, ImageBlock, VideoBlock } from "./block-content";
import { formattedSetting, inlineSetting, SettingText } from "./setting-text";
import { choice, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

const widths: Record<string, string> = { narrow: "36rem", normal: "48rem", wide: "72rem", full: "none" };

interface BlockContext { context: StorefrontRuntimeContext; editor: boolean; selectedBlockId?: string }

/** Heading, text, button, image, video and group blocks, in order. Each list numbers its own buttons (first filled, others outlined). */
function renderBlocks(blocks: BlockNode[], options: BlockContext): ReactNode[] {
  let buttonIndex = 0;
  return blocks.filter((block) => block.enabled).map((block) => {
    const { context, editor, selectedBlockId } = options;
    const label = blockLabel(block.type);
    if (block.type === "heading") {
      const text = stringValue(block.settings, "text");
      return text ? <h2 key={block.id} {...blockStyle(block)} {...blockEditorData(block, editor, label, selectedBlockId, "text")}>{inlineSetting(block.settings, "text", text)}</h2> : null;
    }
    if (block.type === "text") {
      return <SettingText key={block.id} text={stringValue(block.settings, "text")} document={formattedSetting(block.settings, "text")} {...blockStyle(block)} {...blockEditorData(block, editor, label, selectedBlockId, "text")} />;
    }
    if (block.type === "button") {
      const text = stringValue(block.settings, "label");
      const href = resolveStorefrontHref(block.settings.href, context.storeSlug);
      if (!text) return null;
      const props = buttonProps(block.settings, buttonIndex++, block.responsive?.mobile);
      return href ? <a key={block.id} href={href} {...props} {...blockEditorData(block, editor, label, selectedBlockId, "label")}>{text}</a> : <span key={block.id} {...props} {...blockEditorData(block, editor, label, selectedBlockId, "label")}>{text}</span>;
    }
    if (block.type === "image") return <ImageBlock key={block.id} block={block} storeSlug={context.storeSlug} editor={editor} extra={blockEditorData(block, editor, label, selectedBlockId)} />;
    if (block.type === "video") return <VideoBlock key={block.id} block={block} editor={editor} extra={blockEditorData(block, editor, label, selectedBlockId, "url")} />;
    if (block.type === "group") return <GroupBlock key={block.id} block={block} options={options} />;
    return null;
  });
}

/** A row or column of blocks. Groups hold no groups, so this goes one level deep. */
function GroupBlock({ block, options }: { block: BlockNode; options: BlockContext }) {
  const settings = block.settings;
  const direction = choice(settings, "groupDirection", ["vertical", "horizontal"] as const, "horizontal");
  const align = choice(settings, "groupAlign", ["", "start", "center", "end", "between"] as const, "");
  const verticalAlign = choice(settings, "groupVerticalAlign", ["start", "center", "end"] as const, "center");
  const own = blockStyle(block);
  const mobile = block.responsive?.mobile;
  const mobileDirection = choice(mobile, "groupDirection", ["", "vertical", "horizontal"] as const, "");
  const mobileGap = typeof mobile?.groupGap === "number" ? numberValue(mobile, "groupGap", 12, 0, 80) : undefined;
  const children = renderBlocks(childBlocks(block), options).filter(Boolean);
  if (children.length === 0 && !options.editor) return null;
  return <div
    className="jelly-block-group"
    data-direction={direction}
    {...(align ? { "data-align": align } : {})}
    data-vertical-align={verticalAlign}
    {...(mobileDirection ? { "data-direction-mobile": mobileDirection } : {})}
    {...(settings.groupWrap === false ? {} : { "data-wrap": "" })}
    {...own}
    {...blockEditorData(block, options.editor, blockLabel(block.type), options.selectedBlockId)}
    // Width "Fill" sets display: block on other blocks; a group stays a flex row or column.
    style={{ ...own.style, display: undefined, "--group-gap": `${numberValue(settings, "groupGap", 12, 0, 80)}px`, ...(mobileGap !== undefined ? { "--group-gap-m": `${mobileGap}px` } : {}) } as CSSProperties}
  >
    {children.length > 0 ? children : <span className="jelly-block-group-empty">Add blocks to this group</span>}
  </div>;
}

/** "Custom content": heading, text, button, image, video and group blocks shown in the order the merchant set. */
export function CustomContentSection({ section, context, editor = false, selectedBlockId }: { section: SectionNode; context: StorefrontRuntimeContext; editor?: boolean; selectedBlockId?: string }) {
  const direction = choice(section.settings, "direction", ["vertical", "horizontal"] as const, "vertical");
  const alignment = choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "center");
  const width = choice(section.settings, "contentWidth", ["narrow", "normal", "wide", "full"] as const, "normal");
  const mobile = section.responsive?.mobile;
  const mobileDirection = choice(mobile, "direction", ["", "vertical", "horizontal"] as const, "");
  const style = {
    "--custom-gap": `${numberValue(section.settings, "gap", 16, 0, 80)}px`,
    ...(typeof mobile?.gap === "number" ? { "--custom-gap-m": `${numberValue(mobile, "gap", 16, 0, 80)}px` } : {}),
    "--custom-width": widths[width],
  } as CSSProperties;
  const items = renderBlocks(visibleBlocks(section), { context, editor, selectedBlockId });
  return <section className="jelly-section jelly-custom-content" {...sectionData(section, { "data-direction": direction, "data-align": alignment, ...(mobileDirection ? { "data-direction-mobile": mobileDirection } : {}) })} style={style}>
    <StorefrontContainer><div className="jelly-custom-content-inner">{items}</div></StorefrontContainer>
  </section>;
}
