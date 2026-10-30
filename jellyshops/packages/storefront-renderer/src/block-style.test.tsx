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
