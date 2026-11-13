import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createStorefrontRuntimeContext } from "./runtime-context";
import { PageContentSection } from "./sections/content-pages";
import type { StorefrontPageContext } from "./types";

const pageContext = (content: unknown) => createStorefrontRuntimeContext({
  mode: "published",
  region: "template",
  commerce: { async getProducts() { return []; } },
  page: { pageType: "page", resource: { id: "about", handle: "about", data: { title: "About us", content } } } as unknown as StorefrontPageContext,
});

describe("information page content", () => {
  it("renders a saved page whose empty lines have no content list", () => {
    const { container } = render(<PageContentSection context={pageContext({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Our story" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "Family run since 1998." }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 } },
      ],
    })} />);

    expect(screen.getByRole("heading", { name: "About us", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Our story" })).toBeInTheDocument();
    expect(screen.getByText("Family run since 1998.")).toBeInTheDocument();
    expect(container.querySelectorAll("article p")).toHaveLength(1);
  });
});

describe("information page from the live store", () => {
  it("draws a page handed over as { page: { title, content } }, the shape of the public page context", () => {
    const context = createStorefrontRuntimeContext({
      mode: "published",
      region: "template",
      commerce: { async getProducts() { return []; } },
      page: { pageType: "page", resource: { id: "p1", handle: "delivery", data: { type: "page", storeSlug: "shop", page: { id: "p1", handle: "delivery", title: "Delivery", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Free to most UK addresses." }] }] } } } } } as unknown as StorefrontPageContext,
    });
    render(<PageContentSection context={context} />);
    expect(screen.getByRole("heading", { name: "Delivery", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Free to most UK addresses.")).toBeInTheDocument();
  });
});
