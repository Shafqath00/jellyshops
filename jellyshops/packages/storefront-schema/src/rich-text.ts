import type { SectionNode } from "./types.js";
import { normalizeTextStyleMark, type RichTextStyleMark } from "./rich-text-style.js";

/**
 * The one rich text format: product and collection descriptions, section text, pages and blog posts.
 * Stored as JSON shaped like TipTap's, and always passed through `normalizeRichTextDocument` before it is saved or
 * drawn: anything not listed here is dropped, links and photo addresses must be http(s) or store paths, colours are
 * hex, videos are a provider plus an id (never an address). That allowlist is what keeps saved text from carrying
 * scripts, so the HTML built from it (`richTextToHtml`) is safe by construction.
 */

export type RichTextAlign = "center" | "right" | "justify";
export type RichTextHighlightMark = { type: "highlight"; attrs: { color: string } };
export type RichTextLinkMark = { type: "link"; attrs: { href: string; target?: "_blank" } };
export type RichTextMark =
  | { type: "bold" } | { type: "italic" } | { type: "underline" } | { type: "strike" } | { type: "code" }
  | RichTextLinkMark | RichTextStyleMark | RichTextHighlightMark;
export type RichTextInline = { type: "text"; text: string; marks?: RichTextMark[] } | { type: "hardBreak" };
export interface RichTextTableCell { type: "tableCell" | "tableHeader"; content: RichTextBlock[] }
export interface RichTextTableRow { type: "tableRow"; content: RichTextTableCell[] }
export type RichTextHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
/** Where a photo or button sits; "full" photos fill the text column. */
export type RichTextMediaAlign = "left" | "center" | "right" | "full";
export interface RichTextImageAttrs {
  src: string;
  alt: string;
  caption?: string;
  /** Percent of the text column, 25-100 (whole steps of 5); left out = the photo's own size up to the column. */
  width?: number;
  align?: RichTextMediaAlign;
  /** Opens this address when the photo is clicked. */
  href?: string;
}
export type RichTextVideoProvider = "youtube" | "vimeo";
export interface RichTextVideoAttrs { provider: RichTextVideoProvider; id: string; title?: string }
export interface RichTextButtonAttrs { href: string; label: string; style?: "primary" | "secondary"; target?: "_blank"; align?: "left" | "center" | "right" }

/** Left alignment is the default and is stored as no attribute. */
export type RichTextBlock =
  | { type: "paragraph"; attrs?: { textAlign: RichTextAlign }; content: RichTextInline[] }
  | { type: "heading"; attrs: { level: RichTextHeadingLevel; textAlign?: RichTextAlign }; content: RichTextInline[] }
  | { type: "bulletList" | "orderedList"; content: Array<{ type: "listItem"; content: RichTextBlock[] }> }
  | { type: "taskList"; content: Array<{ type: "taskItem"; attrs: { checked: boolean }; content: RichTextBlock[] }> }
  | { type: "blockquote"; content: RichTextBlock[] }
  | { type: "codeBlock"; content: Array<{ type: "text"; text: string }> }
  | { type: "horizontalRule" }
  | { type: "image"; attrs: RichTextImageAttrs }
  | { type: "video"; attrs: RichTextVideoAttrs }
  | { type: "button"; attrs: RichTextButtonAttrs }
  | { type: "table"; content: RichTextTableRow[] };
export interface RichTextDocument { type: "doc"; content: RichTextBlock[] }

const MAX_DEPTH = 16;
const MAX_NODES = 5000;
const MAX_TABLE_ROWS = 50;
const MAX_TABLE_COLUMNS = 10;
const MAX_TEXT = 20_000;
const MAX_ALT = 300;
const MAX_CAPTION = 500;
const MAX_LABEL = 80;
const ALIGNMENTS: readonly string[] = ["center", "right", "justify"];
const MEDIA_ALIGNMENTS: readonly string[] = ["left", "center", "right", "full"];
const BUTTON_ALIGNMENTS: readonly string[] = ["left", "center", "right"];
const HEADING_LEVELS: readonly number[] = [1, 2, 3, 4, 5, 6];
const HEX = /^#[0-9a-fA-F]{6}$/;
const EMPTY_DOCUMENT: RichTextDocument = { type: "doc", content: [] };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return text ? text.slice(0, max) : undefined;
}

export function safeRichTextHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || /[\u0000- \u007f\\]/.test(href)) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^#[A-Za-z][A-Za-z0-9_:\-.]*$/.test(href)) return href;
  if (/^mailto:[^\s<>"']+@[^\s<>"']+$/i.test(href)) return href;
  if (/^tel:\+?[0-9() .-]{3,30}$/.test(href)) return href;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

/** A photo address: a store path (uploaded files) or an http(s) address. Never data:, javascript: or anchors. */
export function safeRichTextImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const src = value.trim();
  if (!src || src.length > 2000 || /[\u0000- \u007f\\"'<>]/.test(src)) return null;
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  try {
    const url = new URL(src);
    return url.protocol === "https:" || url.protocol === "http:" ? src : null;
  } catch {
    return null;
  }
}

/** Reads a YouTube or Vimeo address (watch, short, embed and share forms). Null for anything else. */
export function parseVideoUrl(value: string): RichTextVideoAttrs | null {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const youtubeId = (id: string | null | undefined) => id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: "youtube" as const, id } : null;
  if (host === "youtu.be") return youtubeId(url.pathname.slice(1).split("/")[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") return youtubeId(url.searchParams.get("v"));
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
    return youtubeId(match?.[1]);
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/^\/(?:video\/)?(\d{1,12})(?:\/|$)/);
    return match ? { provider: "vimeo", id: match[1]! } : null;
  }
  return null;
}

/** The embed address for a stored video (privacy-friendly YouTube host). */
export function videoEmbedUrl(video: Pick<RichTextVideoAttrs, "provider" | "id">): string {
  return video.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`
    : `https://player.vimeo.com/video/${encodeURIComponent(video.id)}`;
}

function normalizeVideo(attrs: Record<string, unknown> | null): RichTextVideoAttrs | null {
  if (!attrs) return null;
  const title = shortText(attrs.title, MAX_ALT);
  if (attrs.provider === "youtube" && typeof attrs.id === "string" && /^[A-Za-z0-9_-]{11}$/.test(attrs.id)) return { provider: "youtube", id: attrs.id, ...(title ? { title } : {}) };
  if (attrs.provider === "vimeo" && typeof attrs.id === "string" && /^\d{1,12}$/.test(attrs.id)) return { provider: "vimeo", id: attrs.id, ...(title ? { title } : {}) };
  // TipTap's YouTube extension stores an address; accept it once and keep only provider + id.
  if (typeof attrs.src === "string") {
    const parsed = parseVideoUrl(attrs.src);
    return parsed ? { ...parsed, ...(title ? { title } : {}) } : null;
  }
  return null;
}

function normalizeImage(attrs: Record<string, unknown> | null): RichTextImageAttrs | null {
  const src = safeRichTextImageSrc(attrs?.src);
  if (!attrs || !src) return null;
  const caption = shortText(attrs.caption, MAX_CAPTION);
  const width = typeof attrs.width === "number" && Number.isFinite(attrs.width)
    ? Math.min(100, Math.max(25, Math.round(attrs.width / 5) * 5))
    : undefined;
  const align = typeof attrs.align === "string" && MEDIA_ALIGNMENTS.includes(attrs.align) ? attrs.align as RichTextMediaAlign : undefined;
  const href = attrs.href === undefined ? null : safeRichTextHref(attrs.href);
  return {
    src,
    alt: shortText(attrs.alt, MAX_ALT) ?? "",
    ...(caption ? { caption } : {}),
    ...(width !== undefined && width < 100 ? { width } : {}),
    ...(align && align !== "center" ? { align } : {}),
    ...(href ? { href } : {}),
  };
}

function normalizeButton(attrs: Record<string, unknown> | null): RichTextButtonAttrs | null {
  const href = safeRichTextHref(attrs?.href);
  const label = shortText(attrs?.label, MAX_LABEL);
  if (!attrs || !href || !label) return null;
  return {
    href,
    label,
    ...(attrs.style === "secondary" ? { style: "secondary" as const } : {}),
    ...(attrs.target === "_blank" ? { target: "_blank" as const } : {}),
    ...(typeof attrs.align === "string" && BUTTON_ALIGNMENTS.includes(attrs.align) && attrs.align !== "left" ? { align: attrs.align as "center" | "right" } : {}),
  };
}

function normalizeMark(value: unknown): RichTextMark | null {
  const mark = record(value);
  if (!mark) return null;
  if (mark.type === "bold" || mark.type === "italic" || mark.type === "underline" || mark.type === "strike" || mark.type === "code") return { type: mark.type };
  if (mark.type === "textStyle") return normalizeTextStyleMark(mark.attrs);
  if (mark.type === "highlight") {
    const color = record(mark.attrs)?.color;
    // TipTap's highlight without a colour means the default marker colour.
    return { type: "highlight", attrs: { color: typeof color === "string" && HEX.test(color) ? color.toLowerCase() : "#fff3a3" } };
  }
  if (mark.type === "link") {
    const attrs = record(mark.attrs);
    const href = safeRichTextHref(attrs?.href);
    if (!href) return null;
    return { type: "link", attrs: attrs?.target === "_blank" ? { href, target: "_blank" } : { href } };
  }
  return null;
}

function normalizeInline(value: unknown): RichTextInline | null {
  const node = record(value);
  if (!node) return null;
  if (node.type === "hardBreak") return { type: "hardBreak" };
  if (node.type !== "text" || typeof node.text !== "string" || !node.text) return null;
  const marks = Array.isArray(node.marks) ? node.marks.map(normalizeMark).filter((mark): mark is RichTextMark => mark !== null) : [];
  const unique = marks.filter((mark, index) => marks.findIndex((other) => other.type === mark.type) === index);
  const text = node.text.slice(0, MAX_TEXT);
  return unique.length ? { type: "text", text, marks: unique } : { type: "text", text };
}

function normalizeAlign(attrs: Record<string, unknown> | null): RichTextAlign | undefined {
  return typeof attrs?.textAlign === "string" && ALIGNMENTS.includes(attrs.textAlign) ? attrs.textAlign as RichTextAlign : undefined;
}

function normalizeTable(node: Record<string, unknown>, depth: number, budget: { remaining: number }): RichTextBlock | null {
  const rows: RichTextTableRow[] = [];
  for (const rowValue of Array.isArray(node.content) ? node.content.slice(0, MAX_TABLE_ROWS) : []) {
    if (--budget.remaining < 0) break;
    const row = record(rowValue);
    if (row?.type !== "tableRow" || !Array.isArray(row.content)) continue;
    const cells: RichTextTableCell[] = [];
    for (const cellValue of row.content.slice(0, MAX_TABLE_COLUMNS)) {
      if (--budget.remaining < 0) break;
      const cell = record(cellValue);
      if (cell?.type !== "tableCell" && cell?.type !== "tableHeader") continue;
      // A cell holds ordinary text; nested tables and media are not supported.
      const content = normalizeBlocks(cell.content, depth + 1, budget).filter((block) => !["table", "image", "video", "button"].includes(block.type));
      cells.push({ type: cell.type, content: content.length ? content : [{ type: "paragraph", content: [] }] });
    }
    if (cells.length) rows.push({ type: "tableRow", content: cells });
  }
  return rows.length ? { type: "table", content: rows } : null;
}

function inlines(values: unknown, budget: { remaining: number }): RichTextInline[] {
  return Array.isArray(values)
    ? values.flatMap((inline) => {
      if (--budget.remaining < 0) return [];
      const normalized = normalizeInline(inline);
      return normalized ? [normalized] : [];
    })
    : [];
}

function normalizeBlocks(values: unknown, depth: number, budget: { remaining: number }): RichTextBlock[] {
  if (!Array.isArray(values) || depth > MAX_DEPTH) return [];
  const blocks: RichTextBlock[] = [];
  for (const value of values) {
    if (--budget.remaining < 0) break;
    const node = record(value);
    if (!node) continue;
    const attrs = record(node.attrs);
    if (node.type === "paragraph") {
      const textAlign = normalizeAlign(attrs);
      blocks.push({ type: "paragraph", ...(textAlign ? { attrs: { textAlign } } : {}), content: inlines(node.content, budget) });
    } else if (node.type === "heading") {
      if (!HEADING_LEVELS.includes(attrs?.level as number)) continue;
      const textAlign = normalizeAlign(attrs);
      blocks.push({ type: "heading", attrs: { level: attrs!.level as RichTextHeadingLevel, ...(textAlign ? { textAlign } : {}) }, content: inlines(node.content, budget) });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = Array.isArray(node.content) ? node.content.flatMap((item) => {
        if (--budget.remaining < 0) return [];
        const entry = record(item);
        return entry?.type === "listItem" ? [{ type: "listItem" as const, content: normalizeBlocks(entry.content, depth + 1, budget) }] : [];
      }) : [];
      if (items.length) blocks.push({ type: node.type, content: items });
    } else if (node.type === "taskList") {
      const items = Array.isArray(node.content) ? node.content.flatMap((item) => {
        if (--budget.remaining < 0) return [];
        const entry = record(item);
        return entry?.type === "taskItem"
          ? [{ type: "taskItem" as const, attrs: { checked: record(entry.attrs)?.checked === true }, content: normalizeBlocks(entry.content, depth + 1, budget) }]
          : [];
      }) : [];
      if (items.length) blocks.push({ type: "taskList", content: items });
    } else if (node.type === "blockquote") {
      const content = normalizeBlocks(node.content, depth + 1, budget);
      if (content.length) blocks.push({ type: "blockquote", content });
    } else if (node.type === "codeBlock") {
      const text = Array.isArray(node.content)
        ? node.content.map((inline) => record(inline)?.type === "text" && typeof record(inline)?.text === "string" ? String(record(inline)!.text) : "").join("")
        : "";
      blocks.push({ type: "codeBlock", content: text ? [{ type: "text", text: text.slice(0, MAX_TEXT) }] : [] });
    } else if (node.type === "horizontalRule") {
      blocks.push({ type: "horizontalRule" });
    } else if (node.type === "image") {
      const image = normalizeImage(attrs);
      if (image) blocks.push({ type: "image", attrs: image });
    } else if (node.type === "video" || node.type === "youtube") {
      const video = normalizeVideo(attrs);
      if (video) blocks.push({ type: "video", attrs: video });
    } else if (node.type === "button") {
      const button = normalizeButton(attrs);
      if (button) blocks.push({ type: "button", attrs: button });
    } else if (node.type === "table") {
      const table = normalizeTable(node, depth, budget);
      if (table) blocks.push(table);
    }
  }
  return blocks;
}

export function normalizeRichTextDocument(value: unknown): RichTextDocument | null {
  const document = record(value);
  if (document?.type !== "doc" || !Array.isArray(document.content)) return null;
  const budget = { remaining: MAX_NODES };
  const content = normalizeBlocks(document.content, 0, budget);
  return budget.remaining < 0 ? null : { type: "doc", content };
}

function supportedInline(value: unknown): boolean {
  const node = record(value);
  if (!node) return false;
  if (node.type === "hardBreak") return true;
  if (node.type !== "text" || typeof node.text !== "string") return false;
  return node.marks === undefined || Array.isArray(node.marks) && node.marks.every((mark) => normalizeMark(mark) !== null);
}

function supportedBlocks(values: unknown, depth: number, budget: { remaining: number }): boolean {
  if (!Array.isArray(values) || depth > MAX_DEPTH) return false;
  return values.every((value) => {
    if (--budget.remaining < 0) return false;
    const node = record(value);
    if (!node) return false;
    const attrs = record(node.attrs);
    if (node.type === "paragraph" || node.type === "heading") {
      if (node.type === "heading" && !HEADING_LEVELS.includes(attrs?.level as number)) return false;
      return node.content === undefined || Array.isArray(node.content) && node.content.every((inline) => --budget.remaining >= 0 && supportedInline(inline));
    }
    if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
      const itemType = node.type === "taskList" ? "taskItem" : "listItem";
      return Array.isArray(node.content) && node.content.length > 0 && node.content.every((item) => {
        if (--budget.remaining < 0) return false;
        const entry = record(item);
        return entry?.type === itemType && supportedBlocks(entry.content, depth + 1, budget);
      });
    }
    if (node.type === "table") {
      return Array.isArray(node.content) && node.content.length > 0 && node.content.every((rowValue) => {
        if (--budget.remaining < 0) return false;
        const row = record(rowValue);
        return row?.type === "tableRow" && Array.isArray(row.content) && row.content.length > 0 && row.content.every((cellValue) => {
          if (--budget.remaining < 0) return false;
          const cell = record(cellValue);
          return (cell?.type === "tableCell" || cell?.type === "tableHeader") && supportedBlocks(cell.content, depth + 1, budget);
        });
      });
    }
    if (node.type === "horizontalRule") return true;
    if (node.type === "codeBlock") return node.content === undefined || Array.isArray(node.content) && node.content.every((inline) => record(inline)?.type === "text");
    if (node.type === "image") return normalizeImage(attrs)?.src === attrs?.src;
    if (node.type === "video") return normalizeVideo(attrs) !== null && typeof attrs?.id === "string";
    if (node.type === "button") return normalizeButton(attrs) !== null;
    return node.type === "blockquote" && supportedBlocks(node.content, depth + 1, budget);
  });
}

export function isRichTextDocument(value: unknown): value is RichTextDocument {
  const document = record(value);
  return document?.type === "doc" && supportedBlocks(document.content, 0, { remaining: MAX_NODES });
}

function legacyParagraph(text: string): RichTextBlock {
  const lines = text.split("\n");
  return { type: "paragraph", content: lines.flatMap((line, index): RichTextInline[] => index === 0
    ? [{ type: "text", text: line }]
    : [{ type: "hardBreak" }, { type: "text", text: line }]) };
}

/** Turns a plain-text description into paragraphs: a blank line starts a paragraph, a single newline is a line break. */
export function plainTextToRichTextDocument(text: string): RichTextDocument {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean).map(legacyParagraph);
  return { type: "doc", content: paragraphs };
}

export function resolveRichTextDocument(section: Pick<SectionNode, "settings" | "blocks">): RichTextDocument {
  if (Object.prototype.hasOwnProperty.call(section.settings, "document")) {
    return normalizeRichTextDocument(section.settings.document) ?? EMPTY_DOCUMENT;
  }
  const blocks = section.blocks
    .filter((block) => block.enabled && typeof block.settings.text === "string")
    .map((block) => legacyParagraph(block.settings.text as string));
  if (blocks.length) return { type: "doc", content: blocks };
  const plainText = typeof section.settings.body === "string" ? section.settings.body : section.settings.text;
  return typeof plainText === "string" ? { type: "doc", content: [legacyParagraph(plainText)] } : EMPTY_DOCUMENT;
}

function inlineText(content: RichTextInline[]): string {
  return content.map((node) => node.type === "hardBreak" ? "\n" : node.text).join("");
}

function blockText(block: RichTextBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return inlineText(block.content);
    case "codeBlock":
      return block.content.map((node) => node.text).join("");
    case "blockquote":
      return plainTextOfBlocks(block.content);
    case "table":
      return block.content.map((row) => row.content.map((cell) => plainTextOfBlocks(cell.content).replace(/\s*\n+\s*/g, " ")).join(" | ")).join("\n");
    case "horizontalRule":
    case "video":
      return "";
    case "image":
      return block.attrs.caption ?? "";
    case "button":
      return block.attrs.label;
    case "taskList":
      return block.content.map((item) => `${item.attrs.checked ? "[x]" : "[ ]"} ${plainTextOfBlocks(item.content).replace(/\n+/g, " ")}`).join("\n");
    default:
      return block.content.map((item, index) => (block.type === "orderedList" ? `${index + 1}.` : "-") + " " + plainTextOfBlocks(item.content).replace(/\n+/g, " ")).join("\n");
  }
}

function plainTextOfBlocks(blocks: RichTextBlock[]): string {
  return blocks.map(blockText).map((text) => text.trim()).filter(Boolean).join("\n\n");
}

/** Plain-text rendering used for search, meta descriptions, structured data and emails. */
export function richTextToPlainText(document: RichTextDocument): string {
  return plainTextOfBlocks(document.content);
}

/** Words in a document (for the editor's word count and reading time). */
export function richTextWordCount(document: RichTextDocument): number {
  const text = richTextToPlainText(document).trim();
  return text ? text.split(/\s+/).length : 0;
}

function legacyTexts(value: unknown): string[] {
  const node = record(value);
  if (!node) return [];
  const direct = [node.text, node.body].filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
  const blocks = Array.isArray(node.blocks) ? node.blocks.flatMap(legacyTexts) : [];
  return [...direct, ...blocks];
}

/**
 * Saved page or post content as a document: rich text is normalised (unknown parts dropped); content saved by older
 * versions as `{ text }`, `{ body }` or `{ blocks: [{ text }] }` becomes paragraphs.
 */
export function richTextFromStoredContent(value: unknown): RichTextDocument {
  const document = normalizeRichTextDocument(value);
  if (document) return document;
  return { type: "doc", content: legacyTexts(value).flatMap((text) => plainTextToRichTextDocument(text).content) };
}
