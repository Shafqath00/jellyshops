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

    await userEvent.selectOptions(screen.getByLabelText("Template"), "product-featured");

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

    await userEvent.selectOptions(screen.getByLabelText("Preview resource"), "product-2");

    expect(onPreviewResourceChange).toHaveBeenCalledWith("product-2");
    expect(onTemplateChange).not.toHaveBeenCalled();
  });
});
