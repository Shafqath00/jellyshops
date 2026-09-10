import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { createDefaultStoreDesign, createDefaultStorefrontDocument, type StoreDesignDocument } from "@jelly/storefront-schema";
import { StorefrontRenderer, type CommerceDataProvider } from "./index";

const commerce: CommerceDataProvider = {
  async getProducts() {
    return [{ id: "product-1", name: "Vanilla Celebration Cake", href: "/products/vanilla", imageUrl: "", price: "₹1,499.00" }];
  }
};

function renderHome(document: StoreDesignDocument, mode: "preview" | "published" = "preview") {
  return render(<StorefrontRenderer document={document} page="home" mode={mode} commerce={commerce} assetResolver={{ resolve: async () => null }} />);
}

it("renders Hero content from the document", () => {
  const document = createDefaultStoreDesign();
  document.pages.home.sections[0].blocks[0].settings.text = "Small celebrations, made by hand.";

  renderHome(document);

  expect(screen.getByRole("heading", { name: "Small celebrations, made by hand." })).toBeVisible();
});

it("renders products supplied by the commerce provider", async () => {
  renderHome(createDefaultStoreDesign());

  expect(await screen.findByText("Vanilla Celebration Cake")).toBeVisible();
});

it("applies global theme tokens as CSS variables", () => {
  const { container } = renderHome(createDefaultStoreDesign("elegant"));
  const root = container.querySelector("[data-jelly-theme]") as HTMLElement;

  expect(root.dataset.jellyTheme).toBe("elegant");
  expect(root.style.getPropertyValue("--jelly-color-background")).not.toBe("");
});

it("omits unknown sections on a published storefront", () => {
  const document = createDefaultStoreDesign();
  document.pages.home.sections.push({ id: "unknown", type: "made-up", enabled: true, settings: {}, blocks: [] });

  renderHome(document, "published");

  expect(screen.queryByText("Unsupported section: made-up")).not.toBeInTheDocument();
});

it("shows an unknown-section diagnostic in preview", () => {
  const document = createDefaultStoreDesign();
  document.pages.home.sections.push({ id: "unknown", type: "made-up", enabled: true, settings: {}, blocks: [] });

  renderHome(document);

  expect(screen.getByText("Unsupported section: made-up")).toBeVisible();
});

it("applies hero content, color, spacing, alignment, and uploaded image settings", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  document.regions.template[0].settings = {
    eyebrow: "Just landed",
    summary: "A bright new collection.",
    background: "#123456",
    paddingTop: 96,
    contentAlignment: "center",
    image: { id: "media-1", url: "/media/hero.webp", alt: "New collection", focalPoint: { x: 20, y: 70 }, fit: "cover" },
  };

  const { container } = render(<StorefrontRenderer document={document} mode="editor" commerce={commerce} />);
  const hero = container.querySelector(".jelly-hero") as HTMLElement;
  const image = screen.getByRole("img", { name: "New collection" });

  expect(screen.getByText("Just landed")).toBeVisible();
  expect(screen.getByText("A bright new collection.")).toBeVisible();
  expect(hero).toHaveStyle({ backgroundColor: "#123456", paddingTop: "96px", textAlign: "center" });
  expect(image).toHaveStyle({ objectPosition: "20% 70%", objectFit: "cover" });
});
