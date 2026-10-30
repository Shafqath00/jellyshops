import { normalizeRichTextDocument, type RichTextBlock, type RichTextDocument } from "@jelly/storefront-schema";
import type { HTMLAttributes, ReactNode } from "react";
import { renderBlocks } from "./rich-text";

/**
 * Text settings edited with the rich text editor keep two values: the plain text
 * under their own key (used by search, custom-field bindings and inline editing)
 * and the formatted copy under `<key>Doc`. The formatted copy is only shown while
 * it still says the same thing as the plain text, so an edit made elsewhere is
 * never hidden behind an out-of-date copy.
 */
export function formattedSetting(settings: Record<string, unknown> | undefined, key: string): RichTextDocument | null {
  const text = settings?.[key];
  if (typeof text !== "string" || !text.trim()) return null;
  const document = normalizeRichTextDocument(settings?.[`${key}Doc`]);
  if (!document || !document.content.length) return null;
  return squash(blocksText(document.content)) === squash(text) ? document : null;
}

function blocksText(blocks: RichTextBlock[]): string {
  return blocks.map((block) => {
    const content = (block as { content?: unknown[] }).content ?? [];
    return content.map((node) => {
      const item = node as { type?: string; text?: string; content?: unknown[] };
      if (item.type === "text") return item.text ?? "";
      if (item.type === "hardBreak") return "\n";
      return Array.isArray(item.content) ? blocksText(item.content as RichTextBlock[]) : "";
    }).join("\n");
  }).join("\n");
}

/** Compares words only: list markers ("-", "1.") and table bars in the plain copy don't count. */
const squash = (value: string) => value.replace(/^\s*(?:-|\d+\.)\s+/gm, "").replace(/[^\p{L}\p{N}]/gu, "");

/** A text setting as formatted text when it has a matching formatted copy, else as a paragraph. */
export function SettingText({ text, document, ...props }: { text: string; document: RichTextDocument | null } & HTMLAttributes<HTMLElement>): ReactNode {
  if (document) return <div {...props} className={["jelly-rich-text jelly-setting-text", props.className].filter(Boolean).join(" ")}>{renderBlocks(document.content)}</div>;
  return text ? <p {...props}>{text}</p> : null;
}
