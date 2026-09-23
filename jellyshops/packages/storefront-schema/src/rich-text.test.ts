import { expect, it } from "vitest";
import type { SectionNode } from "./types.js";
import { isRichTextDocument, normalizeRichTextDocument, resolveRichTextDocument, safeRichTextHref } from "./rich-text.js";

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
