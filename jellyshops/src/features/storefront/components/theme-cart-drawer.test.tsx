import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import { createRepository } from "@/lib/repository";
import { resolveTheme, usesCartDrawer } from "@jelly/storefront-themes";
import { ThemeCartDrawer } from "./theme-cart-drawer";

it("lists the bag, changes quantities, and closes with Escape", async () => {
  localStorage.clear();
  const repository = createRepository(localStorage);
  const cart = repository.createCart("sweet-bakes");
  repository.updateCartItem(cart.id, "vanilla-cake", 2);
  const onClose = vi.fn();
  render(<ShopProvider><ThemeCartDrawer storeSlug="sweet-bakes" open onClose={onClose} /></ShopProvider>);
  const dialog = await screen.findByRole("dialog", { name: /your bag/i });
  expect(dialog).toHaveTextContent("(2)");
  expect(screen.getByRole("link", { name: "Check out" })).toHaveAttribute("href", "/sweet-bakes/checkout");
  fireEvent.click(screen.getAllByRole("button", { name: /^Remove one/ })[0]);
  expect(await screen.findByText("(1)", { exact: false })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(await screen.findByText("Your bag is empty.")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});

it("draws nothing while closed, and is off unless the theme turns it on", () => {
  const { container } = render(<ShopProvider><ThemeCartDrawer storeSlug="sweet-bakes" open={false} onClose={() => undefined} /></ShopProvider>);
  expect(container).toBeEmptyDOMElement();
  for (const id of ["jelly-signature", "jelly-avenue"]) {
    expect(usesCartDrawer(resolveTheme(id).settings)).toBe(false);
    expect(usesCartDrawer(resolveTheme(id, { cart: { type: "drawer" } }).settings)).toBe(true);
  }
});
