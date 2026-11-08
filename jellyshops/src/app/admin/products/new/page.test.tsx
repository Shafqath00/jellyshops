import { render, screen } from "@testing-library/react";
import { ShopProvider } from "@/contexts/shop-context";
import NewProductPage from "./page";
import { afterEach, vi } from "vitest";
vi.mock("@/features/auth/providers/auth-provider", () => {
  const activeStore = { id: "store-demo", currency: "INR", country: "IN" };
  const session = { access_token: "jelly-demo-merchant" };
  return { authApiOrigin: () => "http://localhost:3001", useAuth: () => ({ activeStore, session }) };
});
afterEach(() => vi.unstubAllGlobals());

it("shows the redesigned builder at the established new-product URL", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ categories: [], templates: [] }))));
  render(<ShopProvider><NewProductPage /></ShopProvider>);

  expect(screen.getByRole("heading", { name: "Product details" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Photos" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Product options" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Preview" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Save product" })).toBeVisible();
});
