import { render, screen } from "@testing-library/react";
import { createDefaultStorefrontDocument, type SectionNode } from "@jelly/storefront-schema";
import { describe, expect, it, vi } from "vitest";
import { StorefrontRenderer, type CommerceDataProvider } from "./index";

const commerce: CommerceDataProvider = {
  async getProducts() {
    return [{ id: "product-1", name: "Strawberry Jelly", href: "/products/strawberry", imageUrl: "", price: "$12.00" }];
  },
};

function section(type: string): SectionNode {
  return {
    id: `${type}-id`, type, enabled: true, settings: {},
    blocks: type === "hero" ? [{ id: "hero-heading", type: "heading", enabled: true, settings: { text: "Hello" } }] : [],
  };
}

describe("V2 storefront renderer", () => {
  it.each([
    "announcement-bar", "header", "hero", "rich-text", "image-with-text",
    "featured-collection", "product-grid", "multicolumn", "newsletter",
    "spacer-divider", "footer",
  ])("renders registered section %s", async (type) => {
    const document = createDefaultStorefrontDocument("store-demo");
    document.regions = {
      header: type === "header" || type === "announcement-bar" ? [section(type)] : [section("header")],
      template: ["header", "announcement-bar", "footer"].includes(type) ? [] : [section(type)],
      footer: type === "footer" ? [section(type)] : [section("footer")],
    };

    render(<StorefrontRenderer document={document} mode="editor" commerce={commerce} />);
    expect(await screen.findByTestId(`section-${type}`)).toBeVisible();
  });

  it("emits selection metadata only in editor mode", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    const onSelect = vi.fn();
    const { rerender } = render(
      <StorefrontRenderer document={document} mode="editor" commerce={commerce} onSelect={onSelect} />,
    );
    const hero = screen.getByTestId("section-hero");
    expect(hero).toHaveAttribute("data-editor-section-id");

    rerender(<StorefrontRenderer document={document} mode="published" commerce={commerce} />);
    expect(screen.getByTestId("section-hero")).not.toHaveAttribute("data-editor-section-id");
  });
});
