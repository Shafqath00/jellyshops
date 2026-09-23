import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SectionNode } from "@jelly/storefront-schema";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { RichTextDocumentEditor } from "./rich-text-document-editor";

const originalClientRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");
const originalBoundingRect = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
const originalScrollBy = Object.getOwnPropertyDescriptor(window, "scrollBy");
beforeAll(() => {
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [new DOMRect(0, 0, 1, 1)] });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect(0, 0, 1, 1) });
  Object.defineProperty(window, "scrollBy", { configurable: true, value: () => undefined });
});
afterAll(() => {
  if (originalClientRects) Object.defineProperty(Range.prototype, "getClientRects", originalClientRects);
  else Reflect.deleteProperty(Range.prototype, "getClientRects");
  if (originalBoundingRect) Object.defineProperty(Range.prototype, "getBoundingClientRect", originalBoundingRect);
  else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
  if (originalScrollBy) Object.defineProperty(window, "scrollBy", originalScrollBy);
  else Reflect.deleteProperty(window, "scrollBy");
});

function legacySection(): SectionNode {
  return { id: "story", type: "rich-text", enabled: true, settings: {}, blocks: [
    { id: "old-copy", type: "text", enabled: true, settings: { text: "Legacy copy" } },
  ] };
}

it("edits legacy text with Tiptap and saves structured JSON", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn(async () => undefined);
  render(<RichTextDocumentEditor section={legacySection()} onSave={onSave} />);

  const editor = await screen.findByRole("textbox", { name: "Rich text document" });
  expect(editor).toHaveTextContent("Legacy copy");
  await user.click(screen.getByRole("button", { name: "Heading 2" }));
  await user.click(screen.getByRole("button", { name: "Save rich text" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Legacy copy" }] }],
  }));
});

it("rejects an unsafe link before it can become editor content", async () => {
  const user = userEvent.setup();
  render(<RichTextDocumentEditor section={legacySection()} onSave={vi.fn(async () => undefined)} />);
  await screen.findByRole("textbox", { name: "Rich text document" });
  await user.type(screen.getByRole("textbox", { name: "Link URL" }), "javascript:alert(1)");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(screen.getByRole("alert")).toHaveTextContent("HTTP or HTTPS URL, store path, or anchor");
});

it("drops unsupported persisted nodes and marks before editing or saving", async () => {
  const user = userEvent.setup();
  const section = legacySection();
  section.settings.document = { type: "doc", content: [
    { type: "script", attrs: { src: "https://example.com/x.js" } },
    { type: "paragraph", content: [{ type: "text", text: "Safe", marks: [{ type: "code" }] }] },
  ] };
  const onSave = vi.fn(async () => undefined);
  render(<RichTextDocumentEditor section={section} onSave={onSave} />);
  const editor = await screen.findByRole("textbox", { name: "Rich text document" });
  expect(editor).toHaveTextContent("Safe");
  expect(editor.querySelector("script")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Save rich text" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Safe" }] }],
  }));
});

it("does not report Saved when workspace persistence fails", async () => {
  const user = userEvent.setup();
  render(<RichTextDocumentEditor section={legacySection()} onSave={vi.fn(async () => { throw new Error("Could not save draft"); })} />);
  await screen.findByRole("textbox", { name: "Rich text document" });
  await user.click(screen.getByRole("button", { name: "Save rich text" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save draft");
  expect(screen.queryByRole("status", { name: "Saved" })).toBeNull();
});
