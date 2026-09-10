import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { StorefrontRenderer } from "./storefront-renderer";

const commerce = {
  async getProducts() {
    return [];
  },
};

it("renders the requested custom page instead of the home page", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  document.pages.push({
    id: "our-story",
    type: "custom",
    title: "Our story",
    slug: "our-story",
    system: false,
    sections: [{
      id: "story-copy",
      type: "rich-text",
      enabled: true,
      settings: {},
      blocks: [{
        id: "story-heading",
        type: "heading",
        enabled: true,
        settings: { text: "Our story" },
      }],
    }],
  });

  render(
    <StorefrontRenderer
      document={document}
      pageId="our-story"
      mode="preview"
      commerce={commerce}
    />,
  );

  expect(screen.getByText("Our story")).toBeInTheDocument();
  expect(screen.queryByText("Everyday favorites, beautifully made")).not.toBeInTheDocument();
});
