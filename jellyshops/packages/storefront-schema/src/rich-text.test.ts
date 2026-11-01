import { expect, it } from "vitest";
import type { SectionNode } from "./types.js";
import { isRichTextDocument, normalizeRichTextDocument, plainTextToRichTextDocument, resolveRichTextDocument, richTextToPlainText, safeRichTextHref } from "./rich-text.js";

function legacySection(text: string): SectionNode {
  return {
    id: "story",
    type: "rich-text",
    enabled: true,
    settings: {},
    blocks: [{ id: "copy", type: "text", enabled: true, settings: { text } }],
  };
}

it("normalizes legacy plain-text blocks without changing their persisted shape", () => {
  const section = legacySection("A merchant story");
  expect(resolveRichTextDocument(section)).toEqual({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "A merchant story" }] }],
  });
  expect(section.settings).toEqual({});
  expect(section.blocks[0].settings).toEqual({ text: "A merchant story" });
});

it("preserves the supported structured formatting and safe links", () => {
  const input = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Story", marks: [{ type: "bold" }] }] },
      { type: "paragraph", content: [
        { type: "text", text: "Read ", marks: [{ type: "italic" }] },
        { type: "text", text: "more", marks: [{ type: "link", attrs: { href: "/pages/about", target: "_blank" } }] },
        { type: "hardBreak" },
      ] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }] }] },
      { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Two" }] }] }] },
      { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted" }] }] },
    ],
  };

  const normalized = normalizeRichTextDocument(input);
  expect(normalized?.content).toHaveLength(5);
  expect(normalized?.content[0]).toEqual(input.content[0]);
  expect(normalized?.content[1]).toEqual({ type: "paragraph", content: [
    { type: "text", text: "Read ", marks: [{ type: "italic" }] },
    { type: "text", text: "more", marks: [{ type: "link", attrs: { href: "/pages/about" } }] },
    { type: "hardBreak" },
  ] });
  expect(isRichTextDocument(normalized)).toBe(true);
});

it("rejects unsupported nodes and marks while safely ignoring them for read-only display", () => {
  const untrusted = { type: "doc", content: [
    { type: "script", attrs: { src: "https://example.com/evil.js" } },
    { type: "paragraph", content: [
      { type: "text", text: "Safe", marks: [{ type: "code" }, { type: "bold" }] },
    ] },
  ] };
  expect(isRichTextDocument(untrusted)).toBe(false);
  expect(normalizeRichTextDocument(untrusted)).toEqual({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Safe", marks: [{ type: "bold" }] }] }],
  });
});

it("never retains unsafe link protocols or raw HTML as executable markup", () => {
  const untrusted = { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
    { type: "text", text: "<script>alert(1)</script>" },
  ] }] };
  expect(isRichTextDocument(untrusted)).toBe(false);
  expect(normalizeRichTextDocument(untrusted)).toEqual({ type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Click" },
    { type: "text", text: "<script>alert(1)</script>" },
  ] }] });
  expect(safeRichTextHref("https://example.com/story")).toBe("https://example.com/story");
  expect(safeRichTextHref("/pages/about")).toBe("/pages/about");
  expect(safeRichTextHref("javascript:alert(1)")).toBeNull();
  expect(safeRichTextHref("//evil.example/path")).toBeNull();
});

const text = (value: string, marks?: Array<{ type: "bold" | "italic" | "underline" }>) => ({ type: "text" as const, text: value, ...(marks ? { marks } : {}) });

it("keeps underline and non-default alignment, and drops the default left alignment", () => {
  const document = normalizeRichTextDocument({
    type: "doc",
    content: [
      { type: "paragraph", attrs: { textAlign: "left" }, content: [text("Left", [{ type: "underline" }])] },
      { type: "paragraph", attrs: { textAlign: "center" }, content: [text("Centred")] },
      { type: "heading", attrs: { level: 2, textAlign: "right", class: "x" }, content: [text("Right")] },
      { type: "paragraph", attrs: { textAlign: "javascript:alert(1)" }, content: [text("Bad")] },
    ],
  });
  expect(document?.content).toEqual([
    { type: "paragraph", content: [text("Left", [{ type: "underline" }])] },
    { type: "paragraph", attrs: { textAlign: "center" }, content: [text("Centred")] },
    { type: "heading", attrs: { level: 2, textAlign: "right" }, content: [text("Right")] },
    { type: "paragraph", content: [text("Bad")] },
  ]);
});

it("normalizes tables to rows and cells, strips attributes and nested tables, and caps their size", () => {
  const cell = (value: string, type = "tableCell") => ({ type, attrs: { colspan: 2, onclick: "x" }, content: [{ type: "paragraph", content: [text(value)] }] });
  const document = normalizeRichTextDocument({
    type: "doc",
    content: [{
      type: "table",
      content: [
        { type: "tableRow", content: [cell("Size", "tableHeader"), cell("Fit", "tableHeader")] },
        { type: "tableRow", content: [cell("S"), { type: "tableCell", content: [{ type: "table", content: [] }] }] },
        { type: "paragraph" },
        { type: "tableRow", content: Array.from({ length: 14 }, (_, index) => cell(String(index))) },
      ],
    }],
  });
  const table = document?.content[0];
  expect(table?.type).toBe("table");
  if (table?.type !== "table") throw new Error("expected a table");
  expect(table.content).toHaveLength(3);
  expect(table.content[0]).toEqual({ type: "tableRow", content: [
    { type: "tableHeader", content: [{ type: "paragraph", content: [text("Size")] }] },
    { type: "tableHeader", content: [{ type: "paragraph", content: [text("Fit")] }] },
  ] });
  expect(table.content[1].content[1]).toEqual({ type: "tableCell", content: [{ type: "paragraph", content: [] }] });
  expect(table.content[2].content).toHaveLength(10);
  expect(JSON.stringify(document)).not.toContain("onclick");
  expect(isRichTextDocument(document)).toBe(true);
});

it("drops empty tables and unknown block types", () => {
  expect(normalizeRichTextDocument({ type: "doc", content: [{ type: "table", content: [] }, { type: "script", content: [] }, { type: "image", attrs: { src: "x" } }] })?.content).toEqual([]);
});

it("turns a document into plain text for search, meta descriptions and emails", () => {
  const document = normalizeRichTextDocument({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [text("Cotton tee")] },
      { type: "paragraph", content: [text("Soft"), { type: "hardBreak" }, text("and light", [{ type: "bold" }])] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Organic")] }] }, { type: "listItem", content: [{ type: "paragraph", content: [text("Fair trade")] }] }] },
      { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Wash")] }] }] },
      { type: "paragraph" },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [text("Size")] }] }, { type: "tableHeader", content: [{ type: "paragraph", content: [text("Chest")] }] }] }, { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [text("M")] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [text("40 in")] }] }] }] },
    ],
  })!;
  expect(richTextToPlainText(document)).toBe("Cotton tee\n\nSoft\nand light\n\n- Organic\n- Fair trade\n\n1. Wash\n\nSize | Chest\nM | 40 in");
  expect(richTextToPlainText({ type: "doc", content: [] })).toBe("");
});

it("turns an existing plain-text description into paragraphs and line breaks", () => {
  expect(plainTextToRichTextDocument("First line\r\nsecond line\n\nNext paragraph\n\n\n")).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "First line" }, { type: "hardBreak" }, { type: "text", text: "second line" }] },
      { type: "paragraph", content: [{ type: "text", text: "Next paragraph" }] },
    ],
  });
  expect(plainTextToRichTextDocument("  ")).toEqual({ type: "doc", content: [] });
});
