import type { CSSProperties } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import { blockLabel } from "@jelly/storefront-registry";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { blockStyleProps } from "../block-style";
import { blockEditorData, buttonProps, ImageBlock, VideoBlock } from "./block-content";
import { formattedSetting, SettingText } from "./setting-text";
import { choice, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

const widths: Record<string, string> = { narrow: "36rem", normal: "48rem", wide: "72rem", full: "none" };

/** "Custom content": heading, text, button, image and video blocks shown in the order the merchant set. */
export function CustomContentSection({ section, context, editor = false, selectedBlockId }: { section: SectionNode; context: StorefrontRuntimeContext; editor?: boolean; selectedBlockId?: string }) {
  const direction = choice(section.settings, "direction", ["vertical", "horizontal"] as const, "vertical");
  const alignment = choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "center");
  const width = choice(section.settings, "contentWidth", ["narrow", "normal", "wide", "full"] as const, "normal");
  const style = { "--custom-gap": `${numberValue(section.settings, "gap", 16, 0, 80)}px`, "--custom-width": widths[width] } as CSSProperties;
  let buttonIndex = 0;
  const items = visibleBlocks(section).map((block) => {
    const label = blockLabel(block.type);
    if (block.type === "heading") {
      const text = stringValue(block.settings, "text");
      return text ? <h2 key={block.id} {...blockStyleProps(block.settings)} {...blockEditorData(block, editor, label, selectedBlockId, "text")}>{text}</h2> : null;
    }
    if (block.type === "text") {
      return <SettingText key={block.id} text={stringValue(block.settings, "text")} document={formattedSetting(block.settings, "text")} {...blockStyleProps(block.settings)} {...blockEditorData(block, editor, label, selectedBlockId, "text")} />;
    }
    if (block.type === "button") {
      const text = stringValue(block.settings, "label");
      const href = resolveStorefrontHref(block.settings.href, context.storeSlug);
      if (!text) return null;
      const props = buttonProps(block.settings, buttonIndex++);
      return href ? <a key={block.id} href={href} {...props} {...blockEditorData(block, editor, label, selectedBlockId, "label")}>{text}</a> : <span key={block.id} {...props} {...blockEditorData(block, editor, label, selectedBlockId, "label")}>{text}</span>;
    }
    if (block.type === "image") return <ImageBlock key={block.id} block={block} storeSlug={context.storeSlug} editor={editor} extra={blockEditorData(block, editor, label, selectedBlockId)} />;
    if (block.type === "video") return <VideoBlock key={block.id} block={block} editor={editor} extra={blockEditorData(block, editor, label, selectedBlockId, "url")} />;
    return null;
  });
  return <section className="jelly-section jelly-custom-content" {...sectionData(section, { "data-direction": direction, "data-align": alignment })} style={style}>
    <StorefrontContainer><div className="jelly-custom-content-inner">{items}</div></StorefrontContainer>
  </section>;
}
