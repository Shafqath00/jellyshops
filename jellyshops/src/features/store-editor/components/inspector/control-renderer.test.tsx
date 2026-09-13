import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ControlDefinition } from "@jelly/storefront-registry";
import { describe, expect, it, vi } from "vitest";
import { ControlRenderer } from "./control-renderer";

const definitions: ControlDefinition[] = [
  { type: "text", key: "text", label: "Text", group: "content", maxLength: 80 },
  { type: "textarea", key: "summary", label: "Summary", group: "content", maxLength: 500 },
  { type: "rich-text", key: "body", label: "Body", group: "content", maxLength: 4000 },
  { type: "number", key: "columns", label: "Columns", group: "layout", min: 1, max: 6, step: 1 },
  { type: "range", key: "overlay", label: "Overlay", group: "style", min: 0, max: 100, step: 5 },
  { type: "select", key: "layout", label: "Layout", group: "layout", options: [{ label: "Full", value: "full" }] },
  { type: "segmented", key: "alignment", label: "Alignment", group: "layout", options: [{ label: "Left", value: "left" }] },
  { type: "checkbox", key: "wide", label: "Full width", group: "layout" },
  { type: "color", key: "color", label: "Color", group: "style", allowAlpha: false },
  { type: "font", key: "font", label: "Font", group: "style", role: "heading" },
  { type: "spacing", key: "spacing", label: "Spacing", group: "layout", min: 0, max: 160 },
  { type: "link", key: "link", label: "Link", group: "content" },
  { type: "image", key: "image", label: "Image", group: "content" },
  { type: "product", key: "product", label: "Product", group: "content" },
  { type: "collection", key: "collection", label: "Collection", group: "content" },
];

describe("ControlRenderer", () => {
  it.each(definitions)("renders the $type control", (definition) => {
    render(<ControlRenderer definition={definition} value={undefined} onChange={vi.fn()} catalog={{ products: [], collections: [] }} />);
    expect(screen.getByLabelText(definition.label)).toBeInTheDocument();
  });

  it("updates a text value", async () => {
    const onChange = vi.fn();
    render(<ControlRenderer definition={definitions[0]} value="Old" onChange={onChange} catalog={{ products: [], collections: [] }} />);
    await userEvent.setup().type(screen.getByLabelText("Text"), "!");
    expect(onChange).toHaveBeenLastCalledWith("Old!");
  });

  it("shows a dynamic binding fallback in the static control", () => {
    render(
      <ControlRenderer
        definition={definitions[0]}
        value={{
          kind: "dynamic",
          binding: { kind: "resource_field", resource: "product", field: "title" },
          fallback: "Fallback title",
        }}
        onChange={vi.fn()}
        catalog={{ products: [], collections: [] }}
      />,
    );

    expect(screen.getByLabelText("Text")).toHaveValue("Fallback title");
  });
});
