import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { ProductCard } from "./product-card";
import { CardCartContext } from "./product-card";
import { CardQuickViewContext, initialQuickViewChoice, QuickViewDialog } from "./quick-view";
import type { QuickViewProduct, StorefrontCartAccess } from "./types";

// jsdom has no <dialog> methods.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };

const bed: QuickViewProduct = {
  id: "bed", name: "Calder Ottoman Bed", href: "/shop/products/calder", imageUrl: "https://example.test/a.jpg", price: "£449.99",
  images: ["https://example.test/a.jpg", "https://example.test/b.jpg"], summary: "A storage bed with a full lift.",
  rating: { average: 4.6, count: 12 },
  setChoices: { optionName: "Size", values: [
    { variantId: "v-single", label: "Single", price: "£449.99", priceMinor: 44999, max: 0 },
    { variantId: "v-king", label: "King", price: "£674.99", priceMinor: 67499, compareAtPriceMinor: 82499, max: 5 },
  ] },
};

function cart(): StorefrontCartAccess & { setQuantity: ReturnType<typeof vi.fn> } {
  return { quantity: () => 0, setQuantity: vi.fn(async () => ({ ok: true })) };
}

describe("quick view", () => {
  it("starts on a size only when there is one to choose", () => {
    expect(initialQuickViewChoice(bed)).toBeUndefined();
    expect(initialQuickViewChoice({ setChoices: { optionName: "Size", values: [{ variantId: "one", label: "One size", price: "£1", max: 3 }] } })).toBe("one");
  });

  it("shows photos, price and sizes, and adds the chosen size to the bag", async () => {
    const access = cart();
    const onClose = vi.fn();
    const added = vi.fn();
    window.addEventListener("jelly:cart-added", added);
    const { container } = render(<QuickViewDialog product={bed} cart={access} onClose={onClose} />);
    expect((await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations).toEqual([]);
    expect(screen.getByRole("heading", { name: "Calder Ottoman Bed" })).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    const add = screen.getByRole("button", { name: "Choose a size" });
    expect(add).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Single/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /King/ }));
    expect(screen.getByText("£674.99", { selector: "[data-sale]" })).toBeInTheDocument();
    expect(screen.getByText("£824.99")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to bag" }));
    await waitFor(() => expect(access.setQuantity).toHaveBeenCalledWith("v-king", 1));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(added).toHaveBeenCalled();
    window.removeEventListener("jelly:cart-added", added);
  });

  it("shows the shop's message when the bag refuses", async () => {
    const access = { quantity: () => 0, setQuantity: vi.fn(async () => ({ ok: false, message: "Only 2 left." })) };
    render(<QuickViewDialog product={bed} cart={access} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /King/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to bag" }));
    expect(await screen.findByText("Only 2 left.")).toBeInTheDocument();
  });

  it("puts a Quick view button on cards only when the store turns it on", async () => {
    const { rerender } = render(<ProductCard product={bed} />);
    expect(screen.queryByRole("button", { name: /Quick view/ })).toBeNull();
    const load = vi.fn(() => bed);
    rerender(<CardCartContext.Provider value={cart()}><CardQuickViewContext.Provider value={{ load }}><div data-jelly-theme="x"><ProductCard product={bed} /></div></CardQuickViewContext.Provider></CardCartContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "Quick view: Calder Ottoman Bed" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith("bed");
    fireEvent.click(screen.getByRole("button", { name: "Close quick view" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
