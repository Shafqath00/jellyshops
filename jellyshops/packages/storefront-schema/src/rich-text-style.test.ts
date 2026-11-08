import { expect, it } from "vitest";
import { normalizeRichTextDocument } from "./rich-text.js";
import { normalizeTextStyleMark, richTextStyleCss } from "./rich-text-style.js";

it("keeps only hex colours and named sizes", () => {
  expect(normalizeTextStyleMark({ color: "#AA0000", size: "large" })).toEqual({ type: "textStyle", attrs: { color: "#aa0000", size: "large" } });
  expect(normalizeTextStyleMark({ color: "red; background: url(x)", size: "huge" })).toBeNull();
  expect(normalizeTextStyleMark({ color: null, size: "small" })).toEqual({ type: "textStyle", attrs: { size: "small" } });
  expect(richTextStyleCss({ color: "#112233", size: "x-large" })).toEqual({ color: "#112233", fontSize: "1.5em" });
  expect(richTextStyleCss({ color: "javascript:alert(1)" })).toEqual({});
});

it("keeps text colour and size in saved rich text", () => {
  const document = normalizeRichTextDocument({ type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Sale", marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: "#c00000", size: null } }] },
    { type: "text", text: " now", marks: [{ type: "textStyle", attrs: { color: "expression(1)" } }] },
  ] }] });
  expect(document?.content[0]).toEqual({ type: "paragraph", content: [
    { type: "text", text: "Sale", marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: "#c00000" } }] },
    { type: "text", text: " now" },
  ] });
});
