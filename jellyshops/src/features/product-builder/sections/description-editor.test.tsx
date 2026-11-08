import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RichTextDocument } from "@jelly/storefront-schema";
import { DescriptionEditor } from "./description-editor";

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

const hello: RichTextDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }] };
const textbox = () => screen.findByRole("textbox", { name: "Description" });

describe("DescriptionEditor", () => {
  it("shows saved rich text with its formatting", async () => {
    const formatted: RichTextDocument = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Details" }] },
      { type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "Soft", marks: [{ type: "underline" }] }] },
    ] };
    render(<DescriptionEditor id="pb-description" value={formatted} fallbackText="" onChange={() => {}} />);
    const editor = await textbox();
    expect(editor.querySelector("h2")).toHaveTextContent("Details");
    expect(editor.querySelector("p u")).toHaveTextContent("Soft");
    expect(editor.querySelector("p")).toHaveStyle({ textAlign: "center" });
  });

  it("shows a plain-text description as paragraphs without changing it until edited", async () => {
    const onChange = vi.fn();
    render(<DescriptionEditor id="pb-description" value={null} fallbackText={"First paragraph\n\nSecond paragraph"} onChange={onChange} />);
    const editor = await textbox();
    expect(editor.querySelectorAll("p")).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the normalized document and its plain text when the seller formats it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DescriptionEditor id="pb-description" value={hello} fallbackText="Hello world" onChange={onChange} />);
    await textbox();
    await user.click(screen.getByRole("button", { name: "Align center" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange).toHaveBeenLastCalledWith({ type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "Hello world" }] }] }, "Hello world");

    await user.selectOptions(screen.getByRole("combobox", { name: "Text style" }), "h3");
    await waitFor(() => expect(onChange.mock.lastCall?.[0].content[0]).toMatchObject({ type: "heading", attrs: { level: 3 } }));
  });

  it("inserts a table with a header row and lets the seller add a row", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DescriptionEditor id="pb-description" value={hello} fallbackText="" onChange={onChange} />);
    await textbox();
    await user.click(screen.getByRole("button", { name: "Insert table" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const table = onChange.mock.lastCall?.[0].content.find((block: { type: string }) => block.type === "table");
    expect(table.content).toHaveLength(3);
    expect(table.content[0].content.map((cell: { type: string }) => cell.type)).toEqual(["tableHeader", "tableHeader", "tableHeader"]);
    expect(table.content[1].content.map((cell: { type: string }) => cell.type)).toEqual(["tableCell", "tableCell", "tableCell"]);

    await user.click(await screen.findByRole("button", { name: "Add row below" }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].content.find((block: { type: string }) => block.type === "table").content).toHaveLength(4));
    await user.click(screen.getByRole("button", { name: "Delete table" }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].content.some((block: { type: string }) => block.type === "table")).toBe(false));
  });

  it("refuses unsafe link addresses and tells the seller why", async () => {
    const user = userEvent.setup();
    render(<DescriptionEditor id="pb-description" value={hello} fallbackText="" onChange={() => {}} />);
    await textbox();
    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.type(screen.getByRole("textbox", { name: "Link address" }), "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Apply link" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/http or https/i);
  });

  it("follows the draft when it is replaced from outside, such as Discard", async () => {
    const { rerender } = render(<DescriptionEditor id="pb-description" value={hello} fallbackText="Hello world" onChange={() => {}} />);
    expect(await textbox()).toHaveTextContent("Hello world");
    rerender(<DescriptionEditor id="pb-description" value={{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Replaced" }] }] }} fallbackText="Replaced" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Description" })).toHaveTextContent("Replaced"));
    rerender(<DescriptionEditor id="pb-description" value={null} fallbackText="" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Description" })).toHaveTextContent(""));
  });
});
