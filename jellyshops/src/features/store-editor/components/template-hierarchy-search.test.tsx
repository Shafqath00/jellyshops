import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TemplateHierarchy } from "./template-hierarchy";

const template = {
  id: "home",
  name: "Home",
  layout: {
    sections: [
      { kind: "inline", section: { id: "story", type: "custom-content", enabled: true, settings: {}, blocks: [
        { id: "h", type: "heading", enabled: true, settings: { text: "Our story" } },
        { id: "g", type: "group", enabled: true, settings: {}, blocks: [{ id: "b", type: "button", enabled: false, settings: { label: "Visit the studio" } }] },
      ] } },
      { kind: "inline", section: { id: "faq", type: "faq", enabled: false, settings: {}, blocks: [{ id: "q", type: "faq-item", enabled: true, settings: { question: "How long is delivery?" } }] } },
    ],
  },
};

const show = (extra = {}) => {
  const fns = { onSelect: vi.fn(), onBlockAction: vi.fn(), onRemove: vi.fn() };
  render(<TemplateHierarchy template={template} globalSections={{}} selection={null} {...fns} {...extra} />);
  return fns;
};

it("filters sections and blocks as you type, opens matches, and says when nothing matches", async () => {
  show();
  await userEvent.type(screen.getByLabelText("Search sections and blocks"), "studio");
  expect(screen.getByRole("button", { name: /^Button: Visit the studio/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Heading: Our story/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "FAQ" })).toBeNull();
  await userEvent.clear(screen.getByLabelText("Search sections and blocks"));
  await userEvent.type(screen.getByLabelText("Search sections and blocks"), "zzz");
  // (The drag-and-drop library adds its own status regions, so look the message up by its text.)
  expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(screen.getByLabelText("Search sections and blocks")).toHaveValue("");
});

it("shows every block of a section whose own name matches", async () => {
  show();
  await userEvent.type(screen.getByLabelText("Search sections and blocks"), "custom");
  expect(screen.getByRole("button", { name: /^Heading: Our story/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Button: Visit the studio/ })).toBeInTheDocument();
});

it("marks hidden sections and blocks, and hides, shows or deletes them from the row", async () => {
  const fns = show();
  expect(screen.getAllByText("Hidden")).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Expand Custom content" }));
  expect(screen.getAllByText("Hidden")).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: /^Hide Heading: Our story/ }));
  expect(fns.onBlockAction).toHaveBeenCalledWith("story", "h", "toggle");
  await userEvent.click(screen.getByRole("button", { name: /^Show Button: Visit the studio/ }));
  expect(fns.onBlockAction).toHaveBeenCalledWith("story", "b", "toggle");
  await userEvent.click(screen.getByRole("button", { name: /^Delete Heading: Our story/ }));
  expect(fns.onBlockAction).toHaveBeenCalledWith("story", "h", "remove");
});

it("deletes a section from its row when the page allows it", async () => {
  const fns = show({ onMove: vi.fn() });
  const row = screen.getByRole("button", { name: "Custom content" }).parentElement as HTMLElement;
  await userEvent.click(within(row).getByRole("button", { name: "Delete Custom content" }));
  expect(fns.onRemove).toHaveBeenCalledWith("story");
});
