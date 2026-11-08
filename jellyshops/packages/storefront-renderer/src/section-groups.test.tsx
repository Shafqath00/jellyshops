import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "./runtime-context";
import { ImageBannerSection, ImageWithTextSection } from "./sections/home-sections";
import { CustomContentSection } from "./sections/custom-content";

const context: StorefrontRuntimeContext = { mode: "published", commerce: { getProducts: async () => [] }, storeSlug: "demo" };
const button = (id: string): BlockNode => ({ id, type: "button", enabled: true, settings: { label: id, href: "/shop" } });
const group = (id: string, blocks: BlockNode[], settings: Record<string, unknown> = {}): BlockNode => ({ id, type: "group", enabled: true, settings, blocks });
const section = (type: string, blocks: BlockNode[]): SectionNode => ({ id: type, type, enabled: true, settings: {}, blocks });

it("draws a group inside a group", () => {
  const { container } = render(<CustomContentSection context={context} section={section("custom-content", [group("outer", [button("A"), group("inner", [button("B"), button("C")], { groupDirection: "vertical" })])])} />);
  const outer = container.querySelector(".jelly-custom-content-inner > .jelly-block-group")!;
  const inner = outer.querySelector(":scope > .jelly-block-group")!;
  expect(inner.getAttribute("data-direction")).toBe("vertical");
  expect([...inner.querySelectorAll("a")].map((link) => link.textContent)).toEqual(["B", "C"]);
});

it("shows group blocks under the content of image with text and image banner sections", () => {
  for (const Section of [ImageWithTextSection, ImageBannerSection]) {
    const { container, unmount } = render(<Section context={context} section={section("image-with-text", [{ id: "h", type: "heading", enabled: true, settings: { text: "Hello" } }, group("g", [button("One"), button("Two")])])} />);
    expect([...container.querySelectorAll(".jelly-section-groups a")].map((link) => link.textContent)).toEqual(["One", "Two"]);
    unmount();
  }
});
