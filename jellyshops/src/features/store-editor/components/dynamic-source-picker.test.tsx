import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { DynamicSourcePicker } from "./dynamic-source-picker";

const sources = [
  {
    id: "resource:product:title",
    label: "Product title",
    valueType: "string" as const,
    binding: { kind: "resource_field" as const, resource: "product" as const, field: "title" },
  },
  {
    id: "resource:product:featuredImage",
    label: "Product featured image",
    valueType: "image" as const,
    binding: { kind: "resource_field" as const, resource: "product" as const, field: "featuredImage" },
  },
];

it("shows only sources compatible with the control's declared dynamic types", async () => {
  const onSelect = vi.fn();
  render(
    <DynamicSourcePicker
      acceptedTypes={["string"]}
      sources={sources}
      onSelect={onSelect}
    />,
  );

  expect(screen.getByRole("button", { name: "Product title" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Product featured image" })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Product title" }));
  expect(onSelect).toHaveBeenCalledWith(sources[0].binding);
});

it("renders no picker when a control does not support dynamic sources", () => {
  const { container } = render(
    <DynamicSourcePicker acceptedTypes={[]} sources={sources} onSelect={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});
