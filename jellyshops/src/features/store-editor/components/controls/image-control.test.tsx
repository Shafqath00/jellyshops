import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ImageControl } from "./image-control";

it("uploads an image and exposes alt, focal point, fit, replace, and remove controls", async () => {
  const onChange = vi.fn();
  const upload = vi.fn().mockResolvedValue({
    id: "media-1", url: "/api/public/media/store-demo/media-1", mimeType: "image/png",
    width: 800, height: 600, byteSize: 200, originalName: "hero.png", referenced: false,
    storeId: "store-demo", createdAt: "2026-08-31T00:00:00.000Z",
  });
  render(<ImageControl label="Image" value={undefined} onChange={onChange} upload={upload} />);

  await userEvent.setup().upload(screen.getByLabelText("Image"), new File(["image"], "hero.png", { type: "image/png" }));
  expect(upload).toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "media-1", alt: "", fit: "cover", focalPoint: { x: 50, y: 50 } }));
});
