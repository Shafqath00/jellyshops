import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { EditorPagePicker } from "./editor-page-picker";

it("filters page types and selects a template without changing preview data", async () => {
  const onTemplateChange = vi.fn();
  const onPreviewResourceChange = vi.fn();
  render(<EditorPagePicker templates={[{ id: "home", type: "home", handle: "default", name: "Home" }, { id: "product", type: "product", handle: "default", name: "Default product" }]} activeTemplateId="home" previewResources={[]} onTemplateChange={onTemplateChange} onPreviewResourceChange={onPreviewResourceChange} onPageTypeChange={vi.fn()} onPreviewQueryChange={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /Home page/ }));
  await userEvent.type(screen.getByRole("searchbox", { name: "Search pages" }), "product");
  await userEvent.click(screen.getByRole("button", { name: "Product pages" }));
  expect(onTemplateChange).toHaveBeenCalledWith("product");
  expect(onPreviewResourceChange).not.toHaveBeenCalled();
});
it("closes the page picker when clicking outside it", async () => {
  render(<><button type="button">Outside</button><EditorPagePicker templates={[{ id: "home", type: "home", handle: "default", name: "Home" }]} activeTemplateId="home" previewResources={[]} onTemplateChange={vi.fn()} onPreviewResourceChange={vi.fn()} onPageTypeChange={vi.fn()} onPreviewQueryChange={vi.fn()} /></>);
  await userEvent.click(screen.getByRole("button", { name: /Home page/ }));
  expect(screen.getByRole("dialog", { name: "Choose a page" })).toBeVisible();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("dialog", { name: "Choose a page" })).not.toBeInTheDocument();
});
it("hides earlier versions and built-in pages until asked", async () => {
  const onTemplateChange = vi.fn();
  render(<EditorPagePicker templates={[{ id: "old", type: "home", handle: "previous-aaa", name: "Home" }, { id: "home", type: "home", handle: "default", name: "Home" }, { id: "checkout", type: "checkout", handle: "default", name: "Default Checkout" }]} activeTemplateId="home" previewResources={[]} onTemplateChange={onTemplateChange} onPreviewResourceChange={vi.fn()} onPageTypeChange={vi.fn()} onPreviewQueryChange={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /Home page/ }));
  expect(screen.queryByText(/previous template/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Checkout/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Earlier version/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Show earlier versions (1)" }));
  await userEvent.click(screen.getByRole("button", { name: /Earlier version/ }));
  expect(onTemplateChange).toHaveBeenCalledWith("old");
});
