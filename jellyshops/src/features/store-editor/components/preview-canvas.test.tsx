import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { PreviewCanvas } from "./preview-canvas";

describe("PreviewCanvas", () => {
  it.each([
    ["desktop", "max-w-[1440px]"],
    ["tablet", "max-w-[820px]"],
    ["mobile", "max-w-[390px]"],
  ] as const)("labels the %s frame at its intended width", (viewport, widthClass) => {
    render(<PreviewCanvas
      document={createDefaultStorefrontDocument("store-demo")}
      viewport={viewport}
      selection={null}
      commerce={{ getProducts: async () => [] }}
      onSelect={vi.fn()}
    />);

    expect(screen.getByTestId("preview-viewport")).toHaveAttribute("data-viewport", viewport);
    expect(screen.getByTestId("preview-viewport")).toHaveClass(widthClass);
  });
});
