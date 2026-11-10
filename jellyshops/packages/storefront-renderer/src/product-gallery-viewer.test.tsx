import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { galleryAspectRatio, ProductGalleryViewer, ProductPhotoGrid } from "./product-gallery-viewer";
import { ProductGallerySection } from "./sections/product-sections";
import type { StorefrontRuntimeContext } from "./runtime-context";

const media = [{ id: "a", url: "/api/public/media/store/a", width: 1600, height: 1200, altText: "Front" }, { id: "b", url: "/api/public/media/store/b", width: 1200, height: 800, altText: "Back" }];
describe("ProductGalleryViewer", () => {
  it("switches accessible thumbnails and resets when the gallery changes", () => {
    const { rerender } = render(<ProductGalleryViewer media={media} title="Shirt" />);
    expect(screen.getByTestId("gallery-main")).toHaveAttribute("src", media[0].url);
    expect(screen.getByTestId("gallery-main")).toHaveAttribute("srcset", expect.stringContaining("w=640"));
    fireEvent.click(screen.getByRole("button", { name: "Show photo 2: Back" }));
    expect(screen.getByTestId("gallery-main")).toHaveAttribute("src", media[1].url);
    rerender(<ProductGalleryViewer media={[media[0]]} title="Shirt" />);
    expect(screen.getByTestId("gallery-main")).toHaveAttribute("src", media[0].url);
  });
  it("renders a stable placeholder for an empty gallery", () => {
    render(<ProductGalleryViewer media={[]} title="Shirt" />);
    expect(screen.getByRole("img", { name: "No photo for Shirt" })).toBeVisible();
  });
});

describe("product gallery (Shopify-style)", () => {
  const photos = [
    { id: "a", url: "/api/public/media/s/a", width: 1600, height: 1200, altText: "Front" },
    { id: "b", url: "/api/public/media/s/b", width: 800, height: 1200, altText: "Side" },
    { id: "c", url: "/api/public/media/s/c", width: 1200, height: 1200, altText: "Back" },
  ];

  it("moves with arrows and the keyboard, counts photos, and hides the arrow that has nowhere to go", () => {
    render(<ProductGalleryViewer media={photos} title="Bed" />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-main")).toHaveAttribute("alt", "Side");
    fireEvent.keyDown(screen.getByRole("region", { name: "Bed photos" }), { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show photo 3: Back" })).toHaveAttribute("aria-pressed", "true");
  });

  it("puts every photo in a frame of one shape, whatever the photo sizes", () => {
    const { container, rerender } = render(<ProductGalleryViewer media={photos} title="Bed" ratio="portrait" />);
    expect((container.querySelector(".jelly-gallery") as HTMLElement).style.getPropertyValue("--jelly-gallery-ratio")).toBe("4 / 5");
    rerender(<ProductGalleryViewer media={photos} title="Bed" ratio="original" />);
    expect((container.querySelector(".jelly-gallery") as HTMLElement).style.getPropertyValue("--jelly-gallery-ratio")).toBe("1600 / 1200");
    expect(galleryAspectRatio(undefined, photos)).toBeUndefined();
  });

  it("opens a full-screen viewer at the current photo, zooms on click and closes back to the gallery", () => {
    render(<ProductGalleryViewer media={photos} title="Bed" />);
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    fireEvent.click(screen.getByRole("button", { name: "View photo 2 full screen" }));
    const viewer = screen.getByRole("dialog", { name: "Bed photos" });
    expect(within(viewer).getByText("2 / 3")).toBeInTheDocument();
    fireEvent.click(within(viewer).getByRole("button", { name: "Zoom in" }));
    expect(within(viewer).getByRole("button", { name: "Zoom out" })).toHaveAttribute("data-zoomed", "true");
    fireEvent.click(within(viewer).getByRole("button", { name: "Next photo" }));
    expect(within(viewer).getByText("3 / 3")).toBeInTheDocument();
    fireEvent.click(within(viewer).getByRole("button", { name: "Close full screen view" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("can leave out full-screen viewing", () => {
    render(<ProductGalleryViewer media={photos} title="Bed" zoom={false} />);
    expect(screen.queryByRole("button", { name: /full screen/ })).toBeNull();
  });

  it("grid photos open the full-screen viewer at the clicked photo", () => {
    render(<ProductPhotoGrid media={photos} title="Bed" layout="grid" ratio="square" />);
    fireEvent.click(screen.getByRole("button", { name: "View photo 3 of 3 full screen" }));
    expect(within(screen.getByRole("dialog")).getByText("3 / 3")).toBeInTheDocument();
  });
});

describe("product gallery section", () => {
  const presentation = { product: { id: "p", title: "Bed", description: "", imageUrl: "", media: [{ id: "a", url: "/api/public/media/s/a" }, { id: "b", url: "/api/public/media/s/b" }], options: [] }, addToCart: async () => ({ ok: true }) };
  const context = { mode: "editor", storeSlug: "demo", commerce: { getProducts: async () => [] }, page: { pageType: "product", resource: { id: "p", handle: "bed", data: { productPresentation: presentation } } } } as unknown as StorefrontRuntimeContext;

  it("draws the thumbnail gallery whenever the section asks for it (no store-level switch needed)", () => {
    const { container } = render(<ProductGallerySection context={context} section={{ settings: { layout: "thumbnails", thumbnailPosition: "left", mediaRatio: "square" } }} />);
    expect(container.querySelector(".jelly-gallery")).toHaveAttribute("data-thumbs", "left");
    expect(screen.getAllByRole("button", { name: /Show photo/ })).toHaveLength(2);
  });

  it("draws grid photos in one shape when a shape is chosen", () => {
    const { container } = render(<ProductGallerySection context={context} section={{ settings: { layout: "grid", mediaRatio: "landscape", enableZoom: false } }} />);
    expect((container.querySelector(".jelly-photo-grid") as HTMLElement).style.getPropertyValue("--jelly-gallery-ratio")).toBe("4 / 3");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
