import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { blockStyleProps } from "./block-style";
import { RegistrySectionRenderer } from "./registry-section-renderer";

it("turns block style settings into inline styles", () => {
  const props = blockStyleProps({ blockWidth: "fill", blockMaxWidth: "narrow", blockTextColor: "#112233", blockBackground: true, blockBackgroundColor: "#fafafa", blockBorder: "solid", blockBorderWidth: 2, blockBorderColor: "#000000", blockRadius: 12, blockPaddingTop: 8, blockPaddingLeft: 0, blockTypePreset: "h3" });
  expect(props["data-type-preset"]).toBe("h3");
  expect(props.style).toMatchObject({ width: "100%", maxWidth: "28rem", color: "#112233", background: "#fafafa", border: "2px solid #000000", borderRadius: "12px", paddingTop: "8px", paddingLeft: "0px" });
});

it("leaves blocks alone when nothing is chosen and ignores unsafe values", () => {
  expect(blockStyleProps({})).toEqual({});
  expect(blockStyleProps({ text: "Hello", blockTextColor: "", blockTypePreset: "" })).toEqual({});
  expect(blockStyleProps({ blockTextColor: "red;}body{display:none", blockTypePreset: "h9", blockRadius: "12px" })).toEqual({});
  // A background with no padding of its own gets a little, so text never touches the edge.
  expect(blockStyleProps({ blockBackground: true }).style).toMatchObject({ background: "var(--theme-surface, #f4f2ee)", padding: "0.5em 0.75em" });
  expect(blockStyleProps({ blockRadius: 500 }).style).toMatchObject({ borderRadius: "100px" });
});

it("styles heading, text and button blocks in the editor and the live store", () => {
  const section: SectionNode = {
    id: "s1", type: "image-text", enabled: true, settings: {},
    blocks: [
      { id: "h", type: "heading", enabled: true, settings: { text: "Made by hand", blockTextColor: "#aa0000", blockTypePreset: "h1" } },
      { id: "t", type: "text", enabled: true, settings: { text: "Small batches.", blockPaddingTop: 20 } },
      { id: "b", type: "button", enabled: true, settings: { label: "Shop", href: "/shop", blockRadius: 0 } },
    ],
  };
  for (const mode of ["editor", "published"] as const) {
    const { unmount } = render(<RegistrySectionRenderer section={section} mode={mode} commerce={{ getProducts: async () => [] }} storeSlug="demo" />);
    const heading = screen.getByRole("heading", { name: "Made by hand" });
    expect(heading).toHaveAttribute("data-type-preset", "h1");
    expect(heading.style.color).toBe("rgb(170, 0, 0)");
    expect(screen.getByText("Small batches.").style.paddingTop).toBe("20px");
    expect(screen.getByRole("link", { name: "Shop" }).style.borderRadius).toBe("0px");
    unmount();
  }
});

it("adds a block's phone padding, phone text style and Show on", () => {
  const props = blockStyleProps({ blockPaddingTop: 32, blockTypePreset: "h2", blockShowOn: "mobile" }, { blockPaddingTop: 8, blockPaddingLeft: 4, blockTypePreset: "h4" });
  expect(props).toMatchObject({ "data-type-preset": "h2", "data-type-preset-mobile": "h4", "data-block-mobile": "pad-top pad-left", "data-show-on": "mobile" });
  expect(props.style).toMatchObject({ paddingTop: "32px", "--block-pad-top-m": "8px", "--block-pad-left-m": "4px" });
  expect(blockStyleProps({}, { blockTypePreset: "huge", blockPaddingTop: -5 })).toEqual({ "data-block-mobile": "pad-top", style: { "--block-pad-top-m": "0px" } });
});

it("renders phone values for custom content, groups and their blocks", () => {
  const section: SectionNode = {
    id: "c", type: "custom-content", enabled: true, settings: { direction: "horizontal", gap: 40 }, responsive: { mobile: { direction: "vertical", gap: 8 } },
    blocks: [
      { id: "g", type: "group", enabled: true, settings: { groupDirection: "horizontal" }, responsive: { mobile: { groupDirection: "vertical", groupGap: 4 } }, blocks: [
        { id: "b", type: "button", enabled: true, settings: { label: "Shop", href: "/shop" }, responsive: { mobile: { blockPaddingLeft: 12 } } },
        { id: "t", type: "heading", enabled: true, settings: { text: "Desktop only", blockShowOn: "desktop" } },
      ] },
    ],
  };
  render(<RegistrySectionRenderer section={section} mode="published" commerce={{ getProducts: async () => [] }} storeSlug="demo" />);
  const wrapper = screen.getByTestId("section-custom-content");
  expect(wrapper.querySelector(".jelly-custom-content")).toHaveAttribute("data-direction-mobile", "vertical");
  expect((wrapper.querySelector(".jelly-custom-content") as HTMLElement).style.getPropertyValue("--custom-gap-m")).toBe("8px");
  const group = wrapper.querySelector(".jelly-block-group") as HTMLElement;
  expect(group).toHaveAttribute("data-direction-mobile", "vertical");
  expect(group.style.getPropertyValue("--group-gap-m")).toBe("4px");
  expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("data-block-mobile", "pad-left");
  expect(screen.getByRole("link", { name: "Shop" }).style.getPropertyValue("--block-pad-left-m")).toBe("12px");
  expect(screen.getByRole("heading", { name: "Desktop only" })).toHaveAttribute("data-show-on", "desktop");
});

it("adds gradient, shadow, opacity, minimum height and margins", () => {
  const props = blockStyleProps({ blockBackground: true, blockBackgroundColor: "#112233", blockGradientColor: "#ffffff", blockGradientAngle: 90, blockShadow: "medium", blockOpacity: 60, blockMinHeight: 240, blockMarginTop: 12, blockMarginBottom: 500 });
  expect(props.style).toMatchObject({ background: "linear-gradient(90deg, #112233, #ffffff)", boxShadow: "0 6px 20px rgba(0, 0, 0, 0.14)", opacity: 0.6, minHeight: "240px", marginTop: "12px", marginBottom: "100px" });
  // Full opacity, no shadow and a bad gradient colour change nothing.
  expect(blockStyleProps({ blockOpacity: 100, blockShadow: "none", blockGradientColor: "red;}" })).toEqual({});
  expect(blockStyleProps({ blockBackground: true, blockBackgroundColor: "#112233", blockGradientColor: "red;}" }).style).toMatchObject({ background: "#112233" });
});
