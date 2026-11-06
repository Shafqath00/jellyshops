import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Grid, MediaFrame, Stack, TextBlock } from "./layout";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import { sectionFrameWidth } from "./section-frame";

it("wraps every section in a section frame with its width", () => {
  const commerce = { getProducts: async () => [] };
  const { rerender } = render(<RegistrySectionRenderer section={{ id: "s1", type: "rich-text", enabled: true, settings: {}, blocks: [] }} mode="published" commerce={commerce} />);
  const wrapper = screen.getByTestId("section-rich-text");
  expect(wrapper).toHaveAttribute("data-section-frame", "");
  expect(wrapper).toHaveAttribute("data-frame-width", "page");
  rerender(<RegistrySectionRenderer section={{ id: "s1", type: "rich-text", enabled: true, settings: { styleWidth: "full" }, blocks: [] }} mode="editor" commerce={commerce} />);
  expect(screen.getByTestId("section-rich-text")).toHaveAttribute("data-frame-width", "full");
});

it("reads the frame width from the Width setting and falls back to page width", () => {
  expect(sectionFrameWidth(undefined)).toBe("page");
  expect(sectionFrameWidth({ styleWidth: "narrow" })).toBe("narrow");
  expect(sectionFrameWidth({ styleWidth: "huge" })).toBe("page");
  expect(sectionFrameWidth({ styleWidth: 3 })).toBe("page");
});

it("lays out with contract spacing and text tokens, keeping the section's own class", () => {
  render(<>
    <Stack data-testid="stack" gap="lg" direction="row" align="center" className="jelly-trust-points"><span>a</span></Stack>
    <Grid data-testid="grid" as="ul" columns={4} gap="sm" rowGap="xl"><li>a</li></Grid>
    <Grid data-testid="wide" columns={9} mobileColumns={0} />
    <MediaFrame data-testid="media" ratio="portrait" fit="contain" focal={{ x: 120, y: 30 }}><img alt="" src="https://example.com/a.jpg" /></MediaFrame>
    <TextBlock data-testid="text" as="h2" preset="h2" align="center" maxWidth="narrow">Hello</TextBlock>
  </>);
  const stack = screen.getByTestId("stack");
  expect(stack).toHaveClass("jelly-layout-stack", "jelly-trust-points");
  expect(stack).toHaveAttribute("data-direction", "row");
  expect(stack.style.getPropertyValue("--jelly-layout-gap")).toBe("var(--j-space-lg)");

  const grid = screen.getByTestId("grid");
  expect(grid.tagName).toBe("UL");
  expect(grid.style.getPropertyValue("--jelly-layout-columns")).toBe("4");
  expect(grid.style.getPropertyValue("--jelly-layout-columns-tablet")).toBe("2");
  expect(grid.style.getPropertyValue("--jelly-layout-columns-mobile")).toBe("1");
  expect(grid.style.getPropertyValue("--jelly-layout-row-gap")).toBe("var(--j-space-xl)");
  const wide = screen.getByTestId("wide");
  expect(wide.style.getPropertyValue("--jelly-layout-columns")).toBe("6");
  expect(wide.style.getPropertyValue("--jelly-layout-columns-mobile")).toBe("1");

  const media = screen.getByTestId("media");
  expect(media.style.aspectRatio).toBe("4 / 5");
  expect(media).toHaveAttribute("data-fit", "contain");
  expect(media.style.getPropertyValue("--jelly-layout-focal")).toBe("100% 30%");

  const text = screen.getByTestId("text");
  expect(text.tagName).toBe("H2");
  expect(text).toHaveAttribute("data-max-width", "narrow");
  expect(text.style.getPropertyValue("--jelly-layout-size")).toBe("var(--j-type-h2-size)");
  expect(text.style.getPropertyValue("--jelly-layout-font")).toBe("var(--j-type-h2-font)");
});
