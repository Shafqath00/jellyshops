import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProductOptionsSection, swatchFor } from "./sections/product-sections";
import type { ProductPresentationContext } from "./types";

const product = (display: "color" | "image" | undefined, values: Array<Record<string, unknown>>) => ({
  product: { id: "p", title: "Chair", description: "", imageUrl: "", options: [{ id: "colour", name: "Colour", required: true, ...(display ? { display } : {}), values: values.map((value) => ({ selected: false, available: true, ...value })) }] },
  selectOption: vi.fn(),
  addToCart: vi.fn(),
}) as unknown as ProductPresentationContext;
const context = (presentation: ProductPresentationContext) => ({ mode: "published", commerce: { getProducts: async () => [] }, page: { pageType: "product", resource: { data: { productPresentation: presentation } } } }) as never;

it("accepts only a hex colour for colour swatches and an https or media image for image swatches", () => {
  expect(swatchFor("color", { color: "#aabbcc" })).toEqual({ kind: "color", value: "#aabbcc" });
  expect(swatchFor("color", { color: "red; background: url(x)" })).toBeNull();
  expect(swatchFor("color", { image: "https://cdn.test/a.jpg" })).toBeNull();
  expect(swatchFor("image", { image: "https://cdn.test/a.jpg" })).toEqual({ kind: "image", value: "https://cdn.test/a.jpg" });
  expect(swatchFor("image", { image: "/api/public/media/s/m" })).toEqual({ kind: "image", value: "/api/public/media/s/m" });
  expect(swatchFor("image", { image: "javascript:alert(1)" })).toBeNull();
  expect(swatchFor(undefined, { color: "#aabbcc" })).toBeNull();
});

it("draws colour swatches with the value's name as the accessible label, and plain buttons otherwise", () => {
  const swatches = render(<ProductOptionsSection context={context(product("color", [{ id: "a", label: "Oak", color: "#c8a36a" }, { id: "b", label: "Ash", color: "#dddddd", available: false }]))} />);
  expect(screen.getByRole("button", { name: "Oak" }).querySelector(".jelly-swatch")).toHaveStyle({ "--swatch": "#c8a36a" });
  expect(screen.getByRole("button", { name: "Ash, sold out" })).toBeDisabled();
  swatches.unmount();
  render(<ProductOptionsSection context={context(product(undefined, [{ id: "a", label: "Oak", color: "#c8a36a" }]))} />);
  expect(screen.getByRole("button", { name: "Oak" })).not.toHaveAttribute("data-swatch");
});
