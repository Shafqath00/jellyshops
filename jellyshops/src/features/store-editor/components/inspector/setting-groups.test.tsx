import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ControlDefinition } from "@jelly/storefront-registry";
import { legacyInUse, SettingGroups } from "./setting-groups";

const controls: ControlDefinition[] = [
  { type: "text", key: "heading", label: "Heading", group: "content", maxLength: 120, dynamicTypes: ["string"] },
  { type: "spacing", key: "padding", label: "Padding", group: "layout", min: 0, max: 120 },
  { type: "color", key: "background", label: "Background", group: "style", allowAlpha: true },
  { type: "link", key: "link", label: "Link", group: "advanced" },
];

describe("setting groups", () => {
  it("renders schema controls beneath their Shopify-style group headings", () => {
    render(<SettingGroups controls={controls} settings={{ heading: "Fresh jelly", padding: 24, background: "#ffffff", link: "/shop" }} catalog={{ products: [], collections: [] }} onChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Content" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Advanced" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Heading" })).toHaveValue("Fresh jelly");
  });

  it("shows a dynamic binding fallback in its static control", () => {
    render(
      <SettingGroups
        controls={controls}
        settings={{
          heading: {
            kind: "dynamic",
            binding: { kind: "resource_field", resource: "product", field: "title" },
            fallback: "Fallback title",
          },
        }}
        catalog={{ products: [], collections: [] }}
        dynamicSources={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Heading" })).toHaveValue("Fallback title");
  });
});

it("keeps advanced controls collapsed until requested", async () => {
  render(<SettingGroups controls={controls} settings={{}} catalog={{ products: [], collections: [] }} onChange={vi.fn()} />);
  expect(screen.getByText("Advanced").closest("details")).not.toHaveAttribute("open");
});

it("splits controls under their sub-headings and hides controls until they apply", () => {
  const styled: ControlDefinition[] = [
    { type: "segmented", key: "blockBorder", label: "Style", group: "style", heading: "Borders", options: [{ label: "None", value: "none" }, { label: "Solid", value: "solid" }] },
    { type: "color", key: "blockBorderColor", label: "Border colour", group: "style", heading: "Borders", allowAlpha: false, showWhen: { key: "blockBorder", equals: "solid" } },
    { type: "range", key: "blockPaddingTop", label: "Top", group: "style", heading: "Padding", min: 0, max: 100, step: 1, unit: "px" },
  ];
  const { rerender } = render(<SettingGroups controls={styled} settings={{}} catalog={{ products: [], collections: [] }} onChange={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "Borders" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Padding" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Appearance" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Border colour")).not.toBeInTheDocument();
  rerender(<SettingGroups controls={styled} settings={{ blockBorder: "solid" }} catalog={{ products: [], collections: [] }} onChange={vi.fn()} />);
  expect(screen.getByLabelText("Border colour")).toBeInTheDocument();
});

it("shows an older setting only on sections that still use it", () => {
  const background: ControlDefinition = { type: "segmented", key: "colorScheme", label: "Background (older choice)", legacy: true, group: "style", options: [{ label: "Page", value: "page" }, { label: "Soft", value: "soft" }] };
  expect(legacyInUse(background, undefined)).toBe(false);
  expect(legacyInUse(background, "page")).toBe(false);
  expect(legacyInUse(background, "soft")).toBe(true);
  const { rerender } = render(<SettingGroups controls={[background]} settings={{}} catalog={{ products: [], collections: [] }} onChange={vi.fn()} />);
  expect(screen.queryByText("Background (older choice)")).not.toBeInTheDocument();
  rerender(<SettingGroups controls={[background]} settings={{ colorScheme: "soft" }} catalog={{ products: [], collections: [] }} onChange={vi.fn()} />);
  expect(screen.getByText("Background (older choice)")).toBeInTheDocument();
});
