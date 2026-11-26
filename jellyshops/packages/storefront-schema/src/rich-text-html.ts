/**
 * HTML for a rich text document, for the editor's source view, feeds and anywhere a page is needed as HTML.
 * It always normalises first and escapes every piece of text and every attribute, so whatever went in, the HTML
 * that comes out holds only the elements listed here and no scripts, event handlers or unsafe addresses.
 */
import { richTextStyleCss } from "./rich-text-style.js";
import {
  normalizeRichTextDocument,
  videoEmbedUrl,
  type RichTextBlock,
  type RichTextInline,
} from "./rich-text.js";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function attr(name: string, value: string | number | undefined): string {
  return value === undefined || value === "" ? "" : ` ${name}="${escapeHtml(String(value))}"`;
}

function cssText(style: Record<string, string | undefined>): string {
  return Object.entries(style)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value}`)
    .join("; ");
}

function inlineHtml(content: RichTextInline[]): string {
  return content.map((node) => {
    if (node.type === "hardBreak") return "<br>";
    let html = escapeHtml(node.text);
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case "bold": html = `<strong>${html}</strong>`; break;
        case "italic": html = `<em>${html}</em>`; break;
        case "underline": html = `<u>${html}</u>`; break;
        case "strike": html = `<s>${html}</s>`; break;
        case "code": html = `<code>${html}</code>`; break;
        case "highlight": html = `<mark${attr("data-color", mark.attrs.color)}${attr("style", `background-color: ${mark.attrs.color}`)}>${html}</mark>`; break;
        case "textStyle": {
          const style = cssText(richTextStyleCss(mark.attrs));
          const size = mark.attrs.size;
          html = `<span${attr("style", style)}${attr("data-size", size)}>${html}</span>`;
          break;
        }
        case "link":
          html = `<a${attr("href", mark.attrs.href)}${mark.attrs.target ? ' target="_blank" rel="noopener noreferrer"' : ""}>${html}</a>`;
          break;
      }
    }
    return html;
  }).join("");
}

function alignStyle(align: string | undefined): string {
  return align ? attr("style", `text-align: ${align}`) : "";
}

function blocksHtml(blocks: RichTextBlock[]): string {
  return blocks.map(blockHtml).join("\n");
}

function blockHtml(block: RichTextBlock): string {
  switch (block.type) {
    case "paragraph": return `<p${alignStyle(block.attrs?.textAlign)}>${inlineHtml(block.content)}</p>`;
    case "heading": return `<h${block.attrs.level}${alignStyle(block.attrs.textAlign)}>${inlineHtml(block.content)}</h${block.attrs.level}>`;
    case "blockquote": return `<blockquote>${blocksHtml(block.content)}</blockquote>`;
    case "codeBlock": return `<pre><code>${escapeHtml(block.content.map((node) => node.text).join(""))}</code></pre>`;
    case "horizontalRule": return "<hr>";
    case "bulletList":
    case "orderedList": {
      const tag = block.type === "bulletList" ? "ul" : "ol";
      return `<${tag}>${block.content.map((item) => `<li>${blocksHtml(item.content)}</li>`).join("")}</${tag}>`;
    }
    case "taskList":
      return `<ul data-type="taskList">${block.content.map((item) => `<li data-type="taskItem" data-checked="${item.attrs.checked}">${blocksHtml(item.content)}</li>`).join("")}</ul>`;
    case "table":
      return `<table><tbody>${block.content.map((row) => `<tr>${row.content.map((cell) => {
        const tag = cell.type === "tableHeader" ? "th" : "td";
        return `<${tag}>${blocksHtml(cell.content)}</${tag}>`;
      }).join("")}</tr>`).join("")}</tbody></table>`;
    case "image": {
      const { src, alt, caption, width, align, href } = block.attrs;
      let image = `<img${attr("src", src)} alt="${escapeHtml(alt)}"${width ? attr("data-width", width) : ""} loading="lazy">`;
      if (href) image = `<a${attr("href", href)}>${image}</a>`;
      return `<figure data-type="image"${attr("data-align", align)}${width ? attr("style", `width: ${width}%`) : ""}>${image}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
    }
    case "video":
      return `<figure data-type="video"${attr("data-provider", block.attrs.provider)}${attr("data-id", block.attrs.id)}><iframe${attr("src", videoEmbedUrl(block.attrs))}${attr("title", block.attrs.title ?? "Video")} loading="lazy" allowfullscreen></iframe></figure>`;
    case "button":
      return `<p data-type="button"${attr("data-style", block.attrs.style)}${alignStyle(block.attrs.align)}><a${attr("href", block.attrs.href)}${block.attrs.target ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(block.attrs.label)}</a></p>`;
  }
}

/** Safe HTML for any input: unknown or unsafe parts are left out. */
export function richTextToHtml(document: unknown): string {
  const normalized = normalizeRichTextDocument(document);
  return normalized ? blocksHtml(normalized.content) : "";
}
