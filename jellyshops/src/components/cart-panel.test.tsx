import { render, screen } from "@testing-library/react";
import { ShopProvider } from "@/contexts/shop-context";
import { CartPanel } from "./cart-panel";

it("renders an accessible cart dialog", () => {
  render(<ShopProvider><CartPanel storeSlug="sweet-bakes" open onClose={() => undefined} /></ShopProvider>);
  expect(screen.getByRole("dialog", { name: /your cart/i })).toBeVisible();
  expect(screen.getByRole("heading", { name: /your cart/i })).toBeVisible();
});

it("uses a Tailwind fixed overlay for the cart", () => {
  render(<ShopProvider><CartPanel storeSlug="sweet-bakes" open onClose={() => undefined} /></ShopProvider>);
  expect(screen.getByRole("dialog", { name: /your cart/i })).toHaveClass("fixed", "right-0", "top-0");
});
