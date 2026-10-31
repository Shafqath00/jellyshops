import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { SettingTextEditor } from "./setting-text-editor";

// ProseMirror measures ranges while moving the selection; jsdom has no layout.
const originalClientRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");
const originalBoundingRect = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
beforeAll(() => {
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [new DOMRect(0, 0, 1, 1)] });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect(0, 0, 1, 1) });
});
afterAll(() => {
  if (originalClientRects) Object.defineProperty(Range.prototype, "getClientRects", originalClientRects); else Reflect.deleteProperty(Range.prototype, "getClientRects");
  if (originalBoundingRect) Object.defineProperty(Range.prototype, "getBoundingClientRect", originalBoundingRect); else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
});

const lastDocument = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)?.[0];

it("gives selected text a colour and a size, and removes them again", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SettingTextEditor id="text" label="Text" value={null} fallbackText="Free delivery" onChange={onChange} />);
  const box = await screen.findByRole("textbox", { name: "Text" });
  await user.click(box);
  await user.keyboard("{Control>}a{/Control}");
  fireEvent.change(screen.getByLabelText("Text size"), { target: { value: "large" } });
  fireEvent.input(screen.getByLabelText("Text colour"), { target: { value: "#c00000" } });
  await waitFor(() => expect(lastDocument(onChange)?.content[0].content[0].marks).toEqual([{ type: "textStyle", attrs: { color: "#c00000", size: "large" } }]));
  expect(onChange.mock.calls.at(-1)?.[1]).toBe("Free delivery");
  await user.click(screen.getByRole("button", { name: "Remove text colour" }));
  await waitFor(() => expect(lastDocument(onChange)?.content[0].content[0].marks).toEqual([{ type: "textStyle", attrs: { size: "large" } }]));
  fireEvent.change(screen.getByLabelText("Text size"), { target: { value: "" } });
  await waitFor(() => expect(lastDocument(onChange)?.content[0].content[0].marks).toBeUndefined());
});

it("keeps a heading to one line with inline formatting only", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SettingTextEditor id="heading" label="Heading" inline value={null} fallbackText="Summer sale" onChange={onChange} />);
  const box = await screen.findByRole("textbox", { name: "Heading" });
  expect(box).toHaveAttribute("aria-multiline", "false");
  expect(screen.queryByLabelText("Paragraph style")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Bullet list" })).not.toBeInTheDocument();
  await user.click(box);
  await user.keyboard("{Control>}a{/Control}");
  await user.click(screen.getByRole("button", { name: "Italic" }));
  await waitFor(() => expect(lastDocument(onChange)).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Summer sale", marks: [{ type: "italic" }] }] }] }));
});
