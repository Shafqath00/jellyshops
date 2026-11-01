import { resolveRichTextDocument, richTextStyleCss, safeRichTextHref, type RichTextBlock, type RichTextInline, type SectionNode } from "@jelly/storefront-schema";
import { cloneElement, isValidElement, type CSSProperties, type ReactNode } from "react";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { blockStyle } from "../block-style";

export function renderInline(content: RichTextInline[]): ReactNode[] {
  return content.map((node, index) => {
    if (node.type === "hardBreak") return <br key={index} />;
    let value: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") value = <strong>{value}</strong>;
      else if (mark.type === "italic") value = <em>{value}</em>;
      else if (mark.type === "underline") value = <u>{value}</u>;
      else if (mark.type === "textStyle") value = <span style={richTextStyleCss(mark.attrs)}>{value}</span>;
      else {
        const href = safeRichTextHref(mark.attrs.href);
        if (href) value = <a href={href} rel="noopener noreferrer">{value}</a>;
      }
    }
    return <span key={index}>{value}</span>;
  });
}

const tableCellStyle: CSSProperties = { border: "1px solid color-mix(in srgb, currentColor 25%, transparent)", padding: "0.5rem 0.75rem", textAlign: "left", verticalAlign: "top" };

export function renderBlocks(blocks: RichTextBlock[]): ReactNode[] {
  return blocks.map((block, index) => {
    if (block.type === "paragraph") return <p key={index} style={block.attrs ? { textAlign: block.attrs.textAlign } : undefined}>{renderInline(block.content)}</p>;
    if (block.type === "heading") {
      const Heading = (`h${block.attrs.level}` as "h1" | "h2" | "h3");
      return <Heading key={index} style={block.attrs.textAlign ? { textAlign: block.attrs.textAlign } : undefined}>{renderInline(block.content)}</Heading>;
    }
    if (block.type === "blockquote") return <blockquote key={index} style={{ borderLeft: "3px solid currentColor", paddingLeft: "1rem" }}>{renderBlocks(block.content)}</blockquote>;
    if (block.type === "table") {
      return <div key={index} style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>{block.content.map((row, rowIndex) => <tr key={rowIndex}>{row.content.map((cell, cellIndex) => cell.type === "tableHeader"
        ? <th key={cellIndex} scope={rowIndex === 0 ? "col" : "row"} style={{ ...tableCellStyle, fontWeight: 600 }}>{renderBlocks(cell.content)}</th>
        : <td key={cellIndex} style={tableCellStyle}>{renderBlocks(cell.content)}</td>)}</tr>)}</tbody></table></div>;
    }
    const items = block.content.map((item, itemIndex) => <li key={itemIndex}>{renderBlocks(item.content)}</li>);
    return block.type === "bulletList"
      ? <ul key={index} style={{ listStyleType: "disc", paddingLeft: "1.5rem" }}>{items}</ul>
      : <ol key={index} style={{ listStyleType: "decimal", paddingLeft: "1.5rem" }}>{items}</ol>;
  });
}

export function RichTextSection({ section }: { section: SectionNode }) {
  const document = resolveRichTextDocument(section);
  // Without a saved document, each paragraph comes from one text block (in order), so it takes that block's style settings.
  const sourceBlocks = Object.prototype.hasOwnProperty.call(section.settings, "document")
    ? []
    : section.blocks.filter((block) => block.enabled && typeof block.settings.text === "string");
  const rendered = renderBlocks(document.content).map((node, index) => {
    const props = sourceBlocks.length === document.content.length ? blockStyle(sourceBlocks[index]) : {};
    return Object.keys(props).length && isValidElement(node) ? cloneElement(node, props) : node;
  });
  return <section className="jelly-section jelly-rich-text"><StorefrontContainer>{rendered}</StorefrontContainer></section>;
}
