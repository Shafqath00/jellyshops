import type { SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";

export function RichTextSection({ section, editor = false }: { section: SectionNode; editor?: boolean }) {
  return <section className="jelly-section jelly-rich-text"><StorefrontContainer>{section.blocks.filter((block) => block.enabled).map((block) => <p key={block.id} {...(editor ? { "data-editor-block-id": block.id, "data-editor-field-key": "text" } : {})}>{typeof block.settings.text === "string" ? block.settings.text : ""}</p>)}</StorefrontContainer></section>;
}
