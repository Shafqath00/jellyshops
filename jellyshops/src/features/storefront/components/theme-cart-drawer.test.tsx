import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import { createRepository } from "@/lib/repository";
import { cartDrawerVariant, freeDeliveryThresholdMinor, resolveTheme, usesCartDrawer } from "@jelly/storefront-themes";
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

it("opens as a sheet when the theme asks, and shows progress towards free delivery", async () => {
  localStorage.clear();
  const repository = createRepository(localStorage);
  const cart = repository.createCart("sweet-bakes");
  repository.updateCartItem(cart.id, "vanilla-cake", 1);
  const settings = resolveTheme("jelly-signature", { cart: { type: "sheet", freeDeliveryFrom: 500 } }).settings;
  expect(usesCartDrawer(settings)).toBe(true);
  expect(cartDrawerVariant(settings)).toBe("sheet");
  expect(freeDeliveryThresholdMinor(settings)).toBe(50000);
  expect(freeDeliveryThresholdMinor(resolveTheme("jelly-signature").settings)).toBeNull();
  const { container } = render(<ShopProvider><ThemeCartDrawer storeSlug="sweet-bakes" open onClose={() => undefined} variant="sheet" freeDeliveryFromMinor={99_999_900} /></ShopProvider>);
  await screen.findByRole("dialog", { name: /your bag/i });
  expect(container.querySelector(".jelly-cart-drawer")).toHaveAttribute("data-variant", "sheet");
  expect(container.querySelector(".jelly-cart-drawer-progress")).toHaveTextContent(/Spend .+ more for free delivery/);
  expect(screen.getByRole("progressbar", { name: "Progress towards free delivery" })).toBeInTheDocument();
});
