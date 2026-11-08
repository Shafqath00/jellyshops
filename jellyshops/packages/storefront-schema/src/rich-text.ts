import type { SectionNode } from "./types.js";
import { normalizeTextStyleMark, type RichTextStyleMark } from "./rich-text-style.js";

export type RichTextAlign = "center" | "right" | "justify";
export type RichTextMark = { type: "bold" } | { type: "italic" } | { type: "underline" } | { type: "link"; attrs: { href: string } } | RichTextStyleMark;
export type RichTextInline = { type: "text"; text: string; marks?: RichTextMark[] } | { type: "hardBreak" };
export interface RichTextTableCell { type: "tableCell" | "tableHeader"; content: RichTextBlock[] }
export interface RichTextTableRow { type: "tableRow"; content: RichTextTableCell[] }
/** Left alignment is the default and is stored as no attribute. */
export type RichTextBlock =
  | { type: "paragraph"; attrs?: { textAlign: RichTextAlign }; content: RichTextInline[] }
  | { type: "heading"; attrs: { level: 1 | 2 | 3; textAlign?: RichTextAlign }; content: RichTextInline[] }
  | { type: "bulletList" | "orderedList"; content: Array<{ type: "listItem"; content: RichTextBlock[] }> }
  | { type: "blockquote"; content: RichTextBlock[] }
  | { type: "table"; content: RichTextTableRow[] };
export interface RichTextDocument { type: "doc"; content: RichTextBlock[] }

const MAX_DEPTH = 16;
const MAX_NODES = 2000;
const MAX_TABLE_ROWS = 50;
const MAX_TABLE_COLUMNS = 10;
const ALIGNMENTS: readonly string[] = ["center", "right", "justify"];
const EMPTY_DOCUMENT: RichTextDocument = { type: "doc", content: [] };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function safeRichTextHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || /[\u0000-\u0020\u007f\\]/.test(href)) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^#[A-Za-z][A-Za-z0-9_:\-.]*$/.test(href)) return href;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

function normalizeMark(value: unknown): RichTextMark | null {
  const mark = record(value);
  if (!mark) return null;
  if (mark.type === "bold" || mark.type === "italic" || mark.type === "underline") return { type: mark.type };
  if (mark.type === "textStyle") return normalizeTextStyleMark(mark.attrs);
  if (mark.type === "link") {
    const href = safeRichTextHref(record(mark.attrs)?.href);
    return href ? { type: "link", attrs: { href } } : null;
  }
  return null;
}

function normalizeInline(value: unknown): RichTextInline | null {
  const node = record(value);
  if (!node) return null;
  if (node.type === "hardBreak") return { type: "hardBreak" };
  if (node.type !== "text" || typeof node.text !== "string") return null;
  const marks = Array.isArray(node.marks) ? node.marks.map(normalizeMark).filter((mark): mark is RichTextMark => mark !== null) : [];
  return marks.length ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
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
      // A cell holds ordinary blocks; nested tables are not supported.
      const content = normalizeBlocks(cell.content, depth + 1, budget).filter((block) => block.type !== "table");
      cells.push({ type: cell.type, content: content.length ? content : [{ type: "paragraph", content: [] }] });
    }
    if (cells.length) rows.push({ type: "tableRow", content: cells });
  }
  return rows.length ? { type: "table", content: rows } : null;
}

function normalizeBlocks(values: unknown, depth: number, budget: { remaining: number }): RichTextBlock[] {
  if (!Array.isArray(values) || depth > MAX_DEPTH) return [];
  const blocks: RichTextBlock[] = [];
  for (const value of values) {
    if (--budget.remaining < 0) break;
    const node = record(value);
    if (!node) continue;
    if (node.type === "paragraph" || node.type === "heading") {
      if (node.type === "heading" && ![1, 2, 3].includes(record(node.attrs)?.level as number)) continue;
      const content = Array.isArray(node.content)
        ? node.content.flatMap((inline) => {
          if (--budget.remaining < 0) return [];
          const normalized = normalizeInline(inline);
          return normalized ? [normalized] : [];
        })
        : [];
      const textAlign = normalizeAlign(record(node.attrs));
      blocks.push(node.type === "heading"
        ? { type: "heading", attrs: { level: record(node.attrs)!.level as 1 | 2 | 3, ...(textAlign ? { textAlign } : {}) }, content }
        : { type: "paragraph", ...(textAlign ? { attrs: { textAlign } } : {}), content });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = Array.isArray(node.content) ? node.content.flatMap((item) => {
        if (--budget.remaining < 0) return [];
        const entry = record(item);
        return entry?.type === "listItem" ? [{ type: "listItem" as const, content: normalizeBlocks(entry.content, depth + 1, budget) }] : [];
      }) : [];
      if (items.length) blocks.push({ type: node.type, content: items });
    } else if (node.type === "blockquote") {
      const content = normalizeBlocks(node.content, depth + 1, budget);
      if (content.length) blocks.push({ type: "blockquote", content });
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
    if (node.type === "paragraph" || node.type === "heading") {
      if (node.type === "heading" && ![1, 2, 3].includes(record(node.attrs)?.level as number)) return false;
      return node.content === undefined || Array.isArray(node.content) && node.content.every((inline) => --budget.remaining >= 0 && supportedInline(inline));
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      return Array.isArray(node.content) && node.content.length > 0 && node.content.every((item) => {
        if (--budget.remaining < 0) return false;
        const entry = record(item);
        return entry?.type === "listItem" && supportedBlocks(entry.content, depth + 1, budget);
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
  if (block.type === "paragraph" || block.type === "heading") return inlineText(block.content);
  if (block.type === "blockquote") return plainTextOfBlocks(block.content);
  if (block.type === "table") return block.content.map((row) => row.content.map((cell) => plainTextOfBlocks(cell.content).replace(/\s*\n+\s*/g, " ")).join(" | ")).join("\n");
  return block.content.map((item, index) => (block.type === "orderedList" ? `${index + 1}.` : "-") + " " + plainTextOfBlocks(item.content).replace(/\n+/g, " ")).join("\n");
}

function plainTextOfBlocks(blocks: RichTextBlock[]): string {
  return blocks.map(blockText).map((text) => text.trim()).filter(Boolean).join("\n\n");
}

/** Plain-text rendering used for search, meta descriptions, structured data and emails. */
export function richTextToPlainText(document: RichTextDocument): string {
  return plainTextOfBlocks(document.content);
}
