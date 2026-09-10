import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ControlDefinition } from "@jelly/storefront-registry";
import { SettingGroups } from "./setting-groups";

const controls: ControlDefinition[] = [
  { type: "text", key: "heading", label: "Heading", group: "content", maxLength: 120 },
  { type: "spacing", key: "padding", label: "Padding", group: "layout", min: 0, max: 120 },
  { type: "color", key: "background", label: "Background", group: "style", allowAlpha: true },
  { type: "link", key: "link", label: "Link", group: "advanced" },
];

describe("setting groups", () => {
  it("renders schema controls beneath their Shopify-style group headings", () => {
    render(<SettingGroups controls={controls} settings={{ heading: "Fresh jelly", padding: 24, background: "#ffffff", link: "/shop" }} catalog={{ products: [], collections: [] }} onChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Content" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Style" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Advanced" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Heading" })).toHaveValue("Fresh jelly");
  });
});
