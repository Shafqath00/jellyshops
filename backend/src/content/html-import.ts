/**
 * Turns HTML (pasted from Word or Google Docs, or typed in the editor's source view) into a rich text document.
 *
 * Two layers, so one mistake can't let a script through:
 * 1. `sanitize-html` keeps only the listed tags, attributes and style values, drops comments, Office markup
 *    (<o:p>, mso- styles), scripts, styles and event handlers, and only http(s)/mailto/tel links.
 * 2. The cleaned tree is mapped onto the document format and passed through `normalizeRichTextDocument`, the same
 *    allowlist every saved document goes through.
 */
import sanitizeHtml from "sanitize-html";
import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";
import {
  normalizeRichTextDocument,
  parseVideoUrl,
  type RichTextBlock,
  type RichTextDocument,
  type RichTextInline,
  type RichTextMark,
} from "@jelly/storefront-schema";

export const MAX_IMPORT_HTML_BYTES = 1024 * 1024;

const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_STYLE = [/^#[0-9a-f]{3,6}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "strike", "del",
    "code", "pre", "mark", "a", "ul", "ol", "li", "blockquote", "hr", "img", "figure", "figcaption", "iframe",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "span", "input", "label", "sub", "sup",
  ],
  allowedAttributes: {
    a: ["href", "target"],
    img: ["src", "alt", "data-width", "width"],
    iframe: ["src", "title"],
    figure: ["data-type", "data-align", "data-provider", "data-id", "style"],
    ul: ["data-type"],
    li: ["data-type", "data-checked"],
    input: ["type", "checked"],
    mark: ["data-color", "style"],
    span: ["style", "data-size"],
    p: ["style", "data-type", "data-style"],
    div: ["style"],
    h1: ["style"], h2: ["style"], h3: ["style"], h4: ["style"], h5: ["style"], h6: ["style"],
    b: ["style"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"], iframe: ["https"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com", "player.vimeo.com"],
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(bold|bolder|normal|[1-9]00)$/],
      "font-style": [/^(italic|normal)$/],
      "text-decoration": [/^[a-z -]+$/],
      "text-decoration-line": [/^[a-z -]+$/],
      color: COLOR_STYLE,
      "background-color": COLOR_STYLE,
      width: [/^\d{1,3}%$/],
    },
  },
  // Office conditional comments and their contents go; text inside unknown tags (e.g. <o:p>) is kept.
  nonTextTags: ["style", "script", "textarea", "option", "noscript", "title", "xml"],
  disallowedTagsMode: "discard",
};

/** Tidies Office and Google Docs HTML before cleaning: conditional comments, the docs wrapper, MS "List Paragraph" bullets. */
function preclean(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Word writes list bullets as text inside a span with mso-list: ignore; drop them, the list itself carries meaning.
    .replace(/<span[^>]*mso-list:\s*Ignore[^>]*>[\s\S]*?<\/span>/gi, "");
}

function styleOf(element: Element): Record<string, string> {
  const style: Record<string, string> = {};
  for (const part of (element.attribs.style ?? "").split(";")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    style[part.slice(0, index).trim().toLowerCase()] = part.slice(index + 1).trim().toLowerCase();
  }
  return style;
}

function hexColour(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (HEX.test(value)) return value.toLowerCase();
  const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgb) return undefined;
  return `#${rgb.slice(1, 4).map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0")).join("")}`;
}

/** Black text and white backgrounds are what Word and Docs write for "no colour"; they are not kept. */
function meaningfulColour(value: string | undefined, plain: string): string | undefined {
  const colour = hexColour(value);
  return colour && colour !== plain ? colour : undefined;
}

function textAlign(element: Element): "center" | "right" | "justify" | undefined {
  const align = styleOf(element)["text-align"];
  return align === "center" || align === "right" || align === "justify" ? align : undefined;
}

function isElement(node: ChildNode): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style";
}

function textContent(node: ChildNode): string {
  if (node.type === "text") return node.data;
  if (isElement(node)) return node.children.map(textContent).join("");
  return "";
}

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "pre", "hr", "table", "figure", "iframe"]);

function marksFor(element: Element, inherited: RichTextMark[]): RichTextMark[] {
  const marks = [...inherited];
  const add = (mark: RichTextMark) => { if (!marks.some((existing) => existing.type === mark.type)) marks.push(mark); };
  const remove = (type: RichTextMark["type"]) => { const index = marks.findIndex((mark) => mark.type === type); if (index >= 0) marks.splice(index, 1); };
  const style = styleOf(element);
  const tag = element.name;
  const weight = style["font-weight"];
  if ((tag === "strong" || tag === "b") && weight !== "normal" && weight !== "400") add({ type: "bold" });
  if (weight && (weight === "bold" || weight === "bolder" || Number(weight) >= 600)) add({ type: "bold" });
  if (weight === "normal" || weight === "400") remove("bold");
  if (tag === "em" || tag === "i" || style["font-style"] === "italic") add({ type: "italic" });
  if (style["font-style"] === "normal") remove("italic");
  const decoration = `${style["text-decoration"] ?? ""} ${style["text-decoration-line"] ?? ""}`;
  if (tag === "u" || decoration.includes("underline")) add({ type: "underline" });
  if (tag === "s" || tag === "strike" || tag === "del" || decoration.includes("line-through")) add({ type: "strike" });
  if (tag === "code") add({ type: "code" });
  if (tag === "mark") add({ type: "highlight", attrs: { color: hexColour(element.attribs["data-color"]) ?? meaningfulColour(style["background-color"], "#ffffff") ?? "#fff3a3" } });
  else {
    const background = meaningfulColour(style["background-color"], "#ffffff");
    if (background && tag === "span") add({ type: "highlight", attrs: { color: background } });
  }
  const colour = meaningfulColour(style.color, "#000000");
  if (colour) add({ type: "textStyle", attrs: { color: colour } });
  if (tag === "a" && element.attribs.href) {
    remove("link");
    marks.push({ type: "link", attrs: element.attribs.target === "_blank" ? { href: element.attribs.href, target: "_blank" } : { href: element.attribs.href } });
  }
  return marks;
}

function inlineNodes(nodes: ChildNode[], marks: RichTextMark[], out: RichTextInline[], preserveSpace = false): void {
  for (const node of nodes) {
    if (node.type === "text") {
      const text = preserveSpace ? node.data : node.data.replace(/[\s ]+/g, (space) => space.includes(" ") ? " " : " ");
      if (text) out.push(marks.length ? { type: "text", text, marks } : { type: "text", text });
    } else if (isElement(node)) {
      if (node.name === "br") out.push({ type: "hardBreak" });
      else if (node.name === "input" || node.name === "img") continue;
      else inlineNodes(node.children, marksFor(node, marks), out, preserveSpace);
    }
  }
}

/** Trims the space at the start and end of a paragraph and merges neighbours with the same marks. */
function tidyInline(content: RichTextInline[]): RichTextInline[] {
  const merged: RichTextInline[] = [];
  for (const node of content) {
    const last = merged[merged.length - 1];
    if (node.type === "text" && last?.type === "text" && JSON.stringify(last.marks ?? []) === JSON.stringify(node.marks ?? [])) {
      merged[merged.length - 1] = { ...last, text: last.text + node.text };
    } else merged.push(node);
  }
  while (merged[0]?.type === "hardBreak") merged.shift();
  while (merged[merged.length - 1]?.type === "hardBreak") merged.pop();
  const first = merged[0];
  if (first?.type === "text") merged[0] = { ...first, text: first.text.replace(/^ +/, "") };
  const last = merged[merged.length - 1];
  if (last?.type === "text") merged[merged.length - 1] = { ...last, text: last.text.replace(/ +$/, "") };
  return merged.filter((node) => node.type !== "text" || node.text.length > 0);
}

function imageBlock(element: Element, caption?: string, align?: string, width?: string): RichTextBlock | null {
  const src = element.attribs.src;
  if (!src) return null;
  const percent = Number((width ?? element.attribs["data-width"] ?? "").replace("%", ""));
  return {
    type: "image",
    attrs: {
      src,
      alt: element.attribs.alt ?? "",
      ...(caption ? { caption } : {}),
      ...(Number.isFinite(percent) && percent > 0 ? { width: percent } : {}),
      ...(align === "left" || align === "right" || align === "full" ? { align } : {}),
    },
  } as RichTextBlock;
}

function videoBlock(element: Element): RichTextBlock | null {
  const video = element.attribs.src ? parseVideoUrl(element.attribs.src) : null;
  return video ? { type: "video", attrs: { ...video, ...(element.attribs.title ? { title: element.attribs.title } : {}) } } : null;
}

function findAll(node: ChildNode, name: string): Element[] {
  if (!isElement(node)) return [];
  return [...(node.name === name ? [node] : []), ...node.children.flatMap((child) => findAll(child, name))];
}

function blocks(nodes: ChildNode[], depth = 0): RichTextBlock[] {
  const result: RichTextBlock[] = [];
  let pending: RichTextInline[] = [];
  const flush = () => {
    const content = tidyInline(pending);
    if (content.length) result.push({ type: "paragraph", content });
    pending = [];
  };
  if (depth > 12) return result;
  for (const node of nodes) {
    if (!isElement(node)) {
      inlineNodes([node], [], pending);
      continue;
    }
    const tag = node.name;
    if (tag === "img") { flush(); const image = imageBlock(node); if (image) result.push(image); continue; }
    // An inline element wrapped around paragraphs (Google Docs puts the whole paste in one <b>) is just a container.
    if (!BLOCK_TAGS.has(tag) && tag !== "li" && node.children.some((child) => isElement(child) && BLOCK_TAGS.has(child.name))) {
      flush();
      result.push(...blocks(node.children, depth + 1));
      continue;
    }
    if (!BLOCK_TAGS.has(tag) && tag !== "li") {
      // Inline element: photos inside it become their own blocks after the text before them.
      const images = findAll(node, "img");
      inlineNodes([node], [], pending);
      if (images.length) { flush(); for (const image of images) { const block = imageBlock(image); if (block) result.push(block); } }
      continue;
    }
    flush();
    switch (tag) {
      case "p":
      case "div": {
        if (node.attribs["data-type"] === "button") {
          const link = findAll(node, "a")[0];
          if (link?.attribs.href) {
            result.push({ type: "button", attrs: { href: link.attribs.href, label: textContent(link).trim(), ...(node.attribs["data-style"] === "secondary" ? { style: "secondary" as const } : {}), ...(link.attribs.target === "_blank" ? { target: "_blank" as const } : {}), ...(textAlign(node) === "center" || textAlign(node) === "right" ? { align: textAlign(node) as "center" | "right" } : {}) } });
            continue;
          }
        }
        if (node.children.some((child) => isElement(child) && (BLOCK_TAGS.has(child.name) || child.name === "img"))) {
          result.push(...blocks(node.children, depth + 1));
          continue;
        }
        const content: RichTextInline[] = [];
        inlineNodes(node.children, [], content);
        const align = textAlign(node);
        result.push({ type: "paragraph", ...(align ? { attrs: { textAlign: align } } : {}), content: tidyInline(content) });
        break;
      }
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
        const content: RichTextInline[] = [];
        // A heading is bold already; Docs repeats it as font-weight on every span.
        inlineNodes(node.children, [], content);
        const cleaned = tidyInline(content).map((inline) => inline.type === "text" && inline.marks
          ? (inline.marks.filter((mark) => mark.type !== "bold").length ? { ...inline, marks: inline.marks.filter((mark) => mark.type !== "bold") } : { type: "text" as const, text: inline.text })
          : inline);
        const align = textAlign(node);
        if (cleaned.length) result.push({ type: "heading", attrs: { level: Number(tag.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6, ...(align ? { textAlign: align } : {}) }, content: cleaned });
        break;
      }
      case "ul":
      case "ol": {
        const isTask = node.attribs["data-type"] === "taskList"
          || node.children.some((child) => isElement(child) && child.name === "li" && child.children.some((inner) => isElement(inner) && inner.name === "input" && inner.attribs.type === "checkbox"));
        const items = node.children.filter((child): child is Element => isElement(child) && child.name === "li");
        if (isTask) {
          result.push({ type: "taskList", content: items.map((item) => {
            const box = item.children.find((child): child is Element => isElement(child) && child.name === "input");
            const checked = item.attribs["data-checked"] === "true" || box?.attribs.checked !== undefined;
            return { type: "taskItem" as const, attrs: { checked }, content: listContent(item.children, depth) };
          }) });
        } else {
          result.push({ type: tag === "ul" ? "bulletList" : "orderedList", content: items.map((item) => ({ type: "listItem" as const, content: listContent(item.children, depth) })) });
        }
        break;
      }
      case "blockquote":
        result.push({ type: "blockquote", content: blocks(node.children, depth + 1) });
        break;
      case "pre":
        result.push({ type: "codeBlock", content: [{ type: "text", text: textContent(node).replace(/\n$/, "") }] });
        break;
      case "hr":
        result.push({ type: "horizontalRule" });
        break;
      case "iframe": {
        const video = videoBlock(node);
        if (video) result.push(video);
        break;
      }
      case "figure": {
        const frame = findAll(node, "iframe")[0];
        if (frame) { const video = videoBlock(frame); if (video) result.push(video); break; }
        const image = findAll(node, "img")[0];
        const caption = findAll(node, "figcaption")[0];
        if (image) {
          const block = imageBlock(image, caption ? textContent(caption).trim() : undefined, node.attribs["data-align"], styleOf(node).width);
          if (block) result.push(block);
          // A linked photo keeps its link.
          const link = findAll(node, "a")[0];
          if (block?.type === "image" && link?.attribs.href) block.attrs.href = link.attribs.href;
        } else result.push(...blocks(node.children, depth + 1));
        break;
      }
      case "table": {
        const rows = findAll(node, "tr");
        result.push({ type: "table", content: rows.map((row) => ({
          type: "tableRow" as const,
          content: row.children.filter((cell): cell is Element => isElement(cell) && (cell.name === "td" || cell.name === "th")).map((cell) => ({
            type: cell.name === "th" ? "tableHeader" as const : "tableCell" as const,
            content: blocks(cell.children, depth + 1),
          })),
        })) });
        break;
      }
      case "li":
        result.push(...blocks(node.children, depth + 1));
        break;
    }
  }
  flush();
  return result;
}

function listContent(children: ChildNode[], depth: number): RichTextBlock[] {
  const content = blocks(children.filter((child) => !(isElement(child) && child.name === "input")), depth + 1);
  return content.length ? content : [{ type: "paragraph", content: [] }];
}

/** Clean HTML in, safe document out. Throws a plain error for HTML that is too large. */
export function htmlToRichTextDocument(html: string): RichTextDocument {
  if (Buffer.byteLength(html, "utf8") > MAX_IMPORT_HTML_BYTES) {
    throw Object.assign(new Error("This is too much text to paste at once. Paste it in smaller parts."), { tooLarge: true });
  }
  const clean = sanitizeHtml(preclean(html), SANITIZE_OPTIONS);
  const tree = parseDocument(clean, { decodeEntities: true });
  const document = { type: "doc", content: blocks(tree.children) };
  return normalizeRichTextDocument(document) ?? { type: "doc", content: [] };
}

/** Exposed for tests: the cleaned HTML before it is mapped. */
export function cleanHtml(html: string): string {
  return sanitizeHtml(preclean(html), SANITIZE_OPTIONS);
}
