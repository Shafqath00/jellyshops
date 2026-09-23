import type { SectionNode } from "./types.js";

export type RichTextMark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };
export type RichTextInline = { type: "text"; text: string; marks?: RichTextMark[] } | { type: "hardBreak" };
export type RichTextBlock =
  | { type: "paragraph"; content: RichTextInline[] }
  | { type: "heading"; attrs: { level: 1 | 2 | 3 }; content: RichTextInline[] }
  | { type: "bulletList" | "orderedList"; content: Array<{ type: "listItem"; content: RichTextBlock[] }> }
  | { type: "blockquote"; content: RichTextBlock[] };
export interface RichTextDocument { type: "doc"; content: RichTextBlock[] }

const MAX_DEPTH = 16;
const MAX_NODES = 2000;
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
  if (mark.type === "bold" || mark.type === "italic") return { type: mark.type };
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
      blocks.push(node.type === "heading"
        ? { type: "heading", attrs: { level: record(node.attrs)!.level as 1 | 2 | 3 }, content }
        : { type: "paragraph", content });
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
