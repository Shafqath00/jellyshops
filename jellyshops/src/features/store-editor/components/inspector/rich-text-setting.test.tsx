import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { RichTextSetting } from "./rich-text-setting";

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

it("saves the plain text and the formatted copy together", async () => {
  const user = userEvent.setup();
  const onPatch = vi.fn();
  render(<RichTextSetting id="answer" settingKey="answer" label="Answer" maxLength={1000} settings={{ answer: "Yes, within 30 days." }} onPatch={onPatch} />);
  await screen.findByRole("textbox", { name: "Answer" });
  expect(screen.getByText("20 / 1000")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Align center" }));
  await waitFor(() => expect(onPatch).toHaveBeenCalled());
  expect(onPatch).toHaveBeenLastCalledWith({ answer: "Yes, within 30 days.", answerDoc: { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "Yes, within 30 days." }] }] } });
});

it("does not save text longer than the setting allows", async () => {
  const user = userEvent.setup();
  const onPatch = vi.fn();
  render(<RichTextSetting id="text" settingKey="text" label="Text" maxLength={5} settings={{ text: "Hello there" }} onPatch={onPatch} />);
  await screen.findByRole("textbox", { name: "Text" });
  await user.click(screen.getByRole("button", { name: "Align right" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Too long to save: 11 of 5 characters");
  expect(onPatch).not.toHaveBeenCalled();
});
