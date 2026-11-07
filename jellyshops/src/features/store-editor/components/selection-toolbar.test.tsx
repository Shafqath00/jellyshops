import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SelectionToolbar } from "./selection-toolbar";

// Unmount first: the toolbar lives inside the frame being removed.
afterEach(() => { cleanup(); document.querySelectorAll("iframe").forEach((frame) => frame.remove()); });

function previewFrame() {
  const frame = document.createElement("iframe");
  frame.title = "Storefront preview";
  document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<div class="theme-preview-viewport"><div data-editor-section-id="s1"><h2 data-editor-block-id="b1">Hello</h2></div></div>';
  return doc;
}

const actions = { "move-up": false, "move-down": true, duplicate: true, toggle: true, remove: true, "group-in": false, "group-out": false };

it("shows the actions next to the selected block inside the preview and outlines it", async () => {
  const doc = previewFrame();
  const onAction = vi.fn();
  render(<SelectionToolbar target={{ sectionId: "s1", blockId: "b1" }} label="Heading" hidden={false} actions={actions} onAction={onAction} />);
  const toolbar = await waitFor(() => within(doc.body).getByRole("toolbar", { name: "Heading actions" }));
  expect(within(toolbar).getByRole("button", { name: "Move up" })).toBeDisabled();
  // Group buttons only show when the block can go into or out of a group.
  expect(within(toolbar).queryByRole("button", { name: "Move out of group" })).not.toBeInTheDocument();
  await userEvent.setup({ document: doc }).click(within(toolbar).getByRole("button", { name: "Duplicate" }));
  expect(onAction).toHaveBeenCalledWith("duplicate");
  await waitFor(() => expect(doc.querySelector("h2")).toHaveAttribute("data-editor-current"));
  expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
});

it("offers Show for a hidden item that is not on the page", async () => {
  const doc = previewFrame();
  render(<SelectionToolbar target={{ sectionId: "gone" }} label="Text" hidden actions={actions} onAction={vi.fn()} />);
  const toolbar = await waitFor(() => within(doc.body).getByRole("toolbar", { name: "Text actions" }));
  expect(within(toolbar).getByText("Text (hidden)")).toBeInTheDocument();
  expect(within(toolbar).getByRole("button", { name: "Show" })).toBeInTheDocument();
});

it("offers moving a block out of its group when it can", async () => {
  const doc = previewFrame();
  const onAction = vi.fn();
  render(<SelectionToolbar target={{ sectionId: "s1", blockId: "b1" }} label="Button" hidden={false} actions={{ ...actions, "group-out": true }} onAction={onAction} />);
  const toolbar = await waitFor(() => within(doc.body).getByRole("toolbar", { name: "Button actions" }));
  await userEvent.setup({ document: doc }).click(within(toolbar).getByRole("button", { name: "Move out of group" }));
  expect(onAction).toHaveBeenCalledWith("group-out");
  expect(within(toolbar).queryByRole("button", { name: "Move into group above" })).not.toBeInTheDocument();
});

it("outlines one part: the nth copy in the section, or the part inside the chosen block, and goes up a level", async () => {
  const doc = previewFrame();
  doc.body.innerHTML = '<div class="theme-preview-viewport"><div data-editor-section-id="s1"><h2 data-editor-element="heading">Section heading</h2>'
    + '<article data-editor-block-id="c1"><h3 data-editor-element="heading">Column one</h3></article><article data-editor-block-id="c2"><h3 data-editor-element="heading">Column two</h3></article>'
    + '<article data-editor-element="productCard">A</article><article data-editor-element="productCard">B</article></div></div>';
  const onSelectParent = vi.fn();
  const view = render(<SelectionToolbar target={{ sectionId: "s1", blockId: "c2" }} label="Heading" hidden={false} actions={actions} onAction={vi.fn()} element={{ id: "heading" }} onSelectParent={onSelectParent} parentLabel="Select block" />);
  const toolbar = await waitFor(() => within(doc.body).getByRole("toolbar", { name: "Heading actions" }));
  await waitFor(() => expect(within(doc.body).getByText("Column two")).toHaveAttribute("data-editor-current"));
  expect(within(doc.body).getByText("Section heading")).not.toHaveAttribute("data-editor-current");
  // A part shows no section or block actions, only the way back up.
  expect(within(toolbar).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  await userEvent.setup({ document: doc }).click(within(toolbar).getByRole("button", { name: "Select block" }));
  expect(onSelectParent).toHaveBeenCalled();
  view.rerender(<SelectionToolbar target={{ sectionId: "s1" }} label="Product card" hidden={false} actions={actions} onAction={vi.fn()} element={{ id: "productCard", index: 1 }} onSelectParent={vi.fn()} />);
  await waitFor(() => expect(within(doc.body).getByText("B")).toHaveAttribute("data-editor-current"));
  expect(within(doc.body).getByText("Column two")).not.toHaveAttribute("data-editor-current");
  view.rerender(<SelectionToolbar target={{ sectionId: "s1" }} label="Heading" hidden={false} actions={actions} onAction={vi.fn()} element={{ id: "heading" }} onSelectParent={vi.fn()} />);
  // The section's own heading, not a column's.
  await waitFor(() => expect(within(doc.body).getByText("Section heading")).toHaveAttribute("data-editor-current"));
});
