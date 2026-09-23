import { resolveRichTextDocument, safeRichTextHref, type RichTextBlock, type RichTextInline, type SectionNode } from "@jelly/storefront-schema";
import type { ReactNode } from "react";
import { StorefrontContainer } from "@jelly/storefront-ui";

function renderInline(content: RichTextInline[]): ReactNode[] {
  return content.map((node, index) => {
    if (node.type === "hardBreak") return <br key={index} />;
    let value: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") value = <strong>{value}</strong>;
      else if (mark.type === "italic") value = <em>{value}</em>;
      else {
        const href = safeRichTextHref(mark.attrs.href);
        if (href) value = <a href={href} rel="noopener noreferrer">{value}</a>;
      }
    }
    return <span key={index}>{value}</span>;
  });
}

function renderBlocks(blocks: RichTextBlock[]): ReactNode[] {
  return blocks.map((block, index) => {
    if (block.type === "paragraph") return <p key={index}>{renderInline(block.content)}</p>;
    if (block.type === "heading") {
      const Heading = (`h${block.attrs.level}` as "h1" | "h2" | "h3");
      return <Heading key={index}>{renderInline(block.content)}</Heading>;
    }
    if (block.type === "blockquote") return <blockquote key={index} style={{ borderLeft: "3px solid currentColor", paddingLeft: "1rem" }}>{renderBlocks(block.content)}</blockquote>;
    const items = block.content.map((item, itemIndex) => <li key={itemIndex}>{renderBlocks(item.content)}</li>);
    return block.type === "bulletList"
      ? <ul key={index} style={{ listStyleType: "disc", paddingLeft: "1.5rem" }}>{items}</ul>
      : <ol key={index} style={{ listStyleType: "decimal", paddingLeft: "1.5rem" }}>{items}</ol>;
  });
}

export function RichTextSection({ section }: { section: SectionNode }) {
  const document = resolveRichTextDocument(section);
  return <section className="jelly-section jelly-rich-text"><StorefrontContainer>{renderBlocks(document.content)}</StorefrontContainer></section>;
}
