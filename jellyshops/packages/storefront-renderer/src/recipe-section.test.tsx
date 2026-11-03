import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { registerRecipes, type SectionRecipe } from "@jelly/storefront-themes";
import { RegistrySectionRenderer } from "./registry-section-renderer";

const recipe: SectionRecipe = {
  type: "acme-shop/offer", name: "Offer", supportedPages: ["home"],
  settings: [
    { id: "title", type: "text", label: "Title", default: "Spring offer" },
    { id: "showButton", type: "checkbox", label: "Show button", default: true },
    { id: "link", type: "link", label: "Link", default: "/search" },
    { id: "photo", type: "image", label: "Photo" },
  ],
  layout: { direction: "vertical", gap: 12 },
  elements: [{ kind: "image", image: "{photo}" }, { kind: "heading", text: "{title}!" }, { kind: "button", label: "Go", href: "{link}", when: "showButton" }],
};
const commerce = { async getProducts() { return []; } };
const section = (settings: Record<string, unknown> = {}): SectionNode => ({ id: "offer-1", type: "acme-shop/offer", enabled: true, settings, blocks: [] });
const draw = (node: SectionNode, mode: "published" | "editor" = "published") => render(<RegistrySectionRenderer section={node} mode={mode} commerce={commerce} storeSlug="shop" themeId="acme-shop" />);

afterEach(() => { registerRecipes("acme-shop", []); });

describe("a section described as a recipe", () => {
  it("draws the recipe elements with the defaults and the merchant settings", () => {
    registerRecipes("acme-shop", [recipe]);
    const view = draw(section());
    expect(screen.getByRole("heading", { name: "Spring offer!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/shop/search");
    expect(view.getByTestId("section-acme-shop/offer")).toBeInTheDocument();
    view.unmount();

    const edited = draw(section({ title: "Winter sale", showButton: false, photo: { url: "https://example.com/p.jpg", alt: "Coat" } }));
    expect(screen.getByRole("heading", { name: "Winter sale!" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Go" })).toBeNull();
    expect(screen.getByAltText("Coat")).toBeInTheDocument();
    edited.unmount();
  });
  it("never draws an unsafe link from a setting", () => {
    registerRecipes("acme-shop", [recipe]);
    const view = draw(section({ link: "javascript:alert(1)" }));
    expect(view.container.querySelector('[href^="javascript:" i]')).toBeNull();
  });
  it("selects the whole section when it is clicked in the editor (its blocks are generated, not stored)", () => {
    registerRecipes("acme-shop", [recipe]);
    const view = draw(section(), "editor");
    expect(view.container.querySelector("[data-editor-block-id]")).toBeNull();
    expect(view.container.querySelector('[data-editor-section-id="offer-1"]')).not.toBeNull();
  });
  it("shows nothing in a published store when the recipe is not known, and says so in previews", () => {
    expect(draw(section()).container.textContent).toBe("");
    expect(draw(section(), "editor").container.textContent).toContain("Unsupported section");
  });
});
