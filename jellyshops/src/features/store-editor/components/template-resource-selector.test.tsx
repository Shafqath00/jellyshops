import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemplateResourceSelector } from "./template-resource-selector";

const templates = [
  { id: "product-default", type: "product" as const, handle: "default", name: "Default product" },
  { id: "product-featured", type: "product" as const, handle: "featured", name: "Featured product" },
];
const resources = [
  { id: "product-1", label: "Classic Chocolate Cake" },
  { id: "product-2", label: "Vanilla Celebration Cake" },
];

describe("TemplateResourceSelector", () => {
  it("changes the layout template without changing the preview resource", async () => {
    const onTemplateChange = vi.fn();
    const onPreviewResourceChange = vi.fn();
    render(
      <TemplateResourceSelector
        templates={templates}
        activeTemplateId="product-default"
        previewResources={resources}
        previewResourceId="product-1"
        onTemplateChange={onTemplateChange}
        onPreviewResourceChange={onPreviewResourceChange}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Layout"), "product-featured");

    expect(onTemplateChange).toHaveBeenCalledWith("product-featured");
    expect(onPreviewResourceChange).not.toHaveBeenCalled();
  });

  it("changes preview data without mutating the active template", async () => {
    const onTemplateChange = vi.fn();
    const onPreviewResourceChange = vi.fn();
    render(
      <TemplateResourceSelector
        templates={templates}
        activeTemplateId="product-featured"
        previewResources={resources}
        previewResourceId="product-1"
        onTemplateChange={onTemplateChange}
        onPreviewResourceChange={onPreviewResourceChange}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Preview with"), "product-2");

    expect(onPreviewResourceChange).toHaveBeenCalledWith("product-2");
    expect(onTemplateChange).not.toHaveBeenCalled();
  });

  it("shows the page type separately from the template and preview resource", () => {
    render(
      <TemplateResourceSelector
        templates={[{ id: "collection-default", type: "collection", handle: "default", name: "Default Collection" }]}
        activeTemplateId="collection-default"
        previewResources={[{ id: "summer", label: "Summer Collection" }]}
        previewResourceId="summer"
        onTemplateChange={vi.fn()}
        onPreviewResourceChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Page: Collection pages")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Default Collection")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Summer Collection")).toBeInTheDocument();
  });

  it("selects a page type without changing the current preview resource", async () => {
    const onPageTypeChange = vi.fn();
    const onPreviewResourceChange = vi.fn();
    render(<TemplateResourceSelector
      templates={[...templates, { id: "cart-default", type: "cart", handle: "default", name: "Default Cart" }]}
      activeTemplateId="product-default"
      previewResources={resources}
      previewResourceId="product-1"
      onTemplateChange={vi.fn()}
      onPreviewResourceChange={onPreviewResourceChange}
      onPageTypeChange={onPageTypeChange}
    />);

    await userEvent.selectOptions(screen.getByLabelText("Page"), "cart");
    expect(onPageTypeChange).toHaveBeenCalledWith("cart");
    expect(onPreviewResourceChange).not.toHaveBeenCalled();
  });

  it("changes the search preview query without changing the template or resource", async () => {
    const onTemplateChange = vi.fn();
    const onPreviewResourceChange = vi.fn();
    const onPreviewQueryChange = vi.fn();
    function SearchPreviewSelector() {
      const [query, setQuery] = useState("cake");
      return <TemplateResourceSelector
        templates={[{ id: "search-default", type: "search", handle: "default", name: "Default search" }]}
        activeTemplateId="search-default"
        previewResources={[]}
        previewQuery={query}
        onTemplateChange={onTemplateChange}
        onPreviewResourceChange={onPreviewResourceChange}
        onPreviewQueryChange={(next) => { setQuery(next); onPreviewQueryChange(next); }}
      />;
    }
    render(<SearchPreviewSelector />);

    await userEvent.clear(screen.getByLabelText("Preview search for"));
    await userEvent.type(screen.getByLabelText("Preview search for"), "birthday cake");

    expect(onPreviewQueryChange).toHaveBeenLastCalledWith("birthday cake");
    expect(onTemplateChange).not.toHaveBeenCalled();
    expect(onPreviewResourceChange).not.toHaveBeenCalled();
  });

  it("does not ask for a preview resource for the Not Found template", () => {
    render(<TemplateResourceSelector
      templates={[{ id: "not-found-default", type: "not-found", handle: "default", name: "Not Found" }]}
      activeTemplateId="not-found-default"
      previewResources={resources}
      onTemplateChange={vi.fn()}
      onPreviewResourceChange={vi.fn()}
    />);

    expect(screen.getByLabelText("Preview with")).toBeDisabled();
  });
});
