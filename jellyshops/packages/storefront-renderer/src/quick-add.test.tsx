import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { useState } from "react";
import { CardCartContext, ProductCard } from "./product-card";
import type { PublicProduct, StorefrontCartAccess } from "./types";

const product: PublicProduct = { id: "milk", name: "Oat milk", href: "/demo/products/milk", imageUrl: "", price: "£1.80", available: true, quickAdd: { variantId: "milk-1l", max: 3 } };
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

function WithCart({ item, failWith }: { item: PublicProduct; failWith?: string }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const cart: StorefrontCartAccess = {
    quantity: (variantId) => quantities[variantId] ?? 0,
    setQuantity: async (variantId, quantity) => {
      if (failWith) return { ok: false, message: failWith };
      setQuantities((current) => ({ ...current, [variantId]: quantity }));
      return { ok: true };
    },
  };
  return <CardCartContext.Provider value={cart}><ProductCard product={item} /></CardCartContext.Provider>;
}

describe("quick add on product cards", () => {
  it("adds, steps up to the stock limit, and goes back to Add at zero", async () => {
    const changed = vi.fn();
    window.addEventListener("jelly:cart-changed", changed);
    const { container } = render(<WithCart item={product} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Oat milk to your bag" }));
    expect(await screen.findByRole("group", { name: "Oat milk in your bag" })).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "One more Oat milk" }));
    fireEvent.click(await screen.findByRole("button", { name: "One more Oat milk" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "One more Oat milk" })).toBeDisabled());
    expect(await noViolations(container)).toEqual([]);
    for (let step = 0; step < 3; step += 1) fireEvent.click(await screen.findByRole("button", { name: /^(One fewer|Remove) Oat milk$/ }));
    expect(await screen.findByRole("button", { name: "Add Oat milk to your bag" })).toBeTruthy();
    expect(changed).toHaveBeenCalled();
    window.removeEventListener("jelly:cart-changed", changed);
  });

  it("keeps the button outside the product link", () => {
    const { container } = render(<WithCart item={product} />);
    expect(container.querySelector("a")?.contains(container.querySelector(".jelly-quick-add"))).toBe(false);
  });

  it("says why the bag could not be changed", async () => {
    render(<WithCart item={product} failWith="Only 2 left." />);
    fireEvent.click(screen.getByRole("button", { name: "Add Oat milk to your bag" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only 2 left.");
  });

  it("shows nothing without a cart, for products with options, or when sold out", () => {
    const { container, rerender } = render(<ProductCard product={product} />);
    expect(container.querySelector(".jelly-quick-add")).toBeNull();
    rerender(<WithCart item={{ ...product, quickAdd: undefined }} />);
    expect(container.querySelector(".jelly-quick-add")).toBeNull();
    rerender(<WithCart item={{ ...product, available: false }} />);
    expect(container.querySelector(".jelly-quick-add")).toBeNull();
  });
});
