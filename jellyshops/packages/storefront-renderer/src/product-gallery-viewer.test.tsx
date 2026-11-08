import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductGalleryViewer } from "./product-gallery-viewer";

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
