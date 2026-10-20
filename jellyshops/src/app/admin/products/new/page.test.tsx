import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopProvider } from "@/contexts/shop-context";
import NewProductPage from "./page";
import { afterEach, vi } from "vitest";
vi.mock("@/features/auth/auth-provider", () => {
  const activeStore = { id: "store-demo", currency: "INR", country: "IN" };
  const session = { access_token: "jelly-demo-merchant" };
  return { useAuth: () => ({ activeStore, session }) };
});
afterEach(() => vi.unstubAllGlobals());

it("creates a sellable product from merchant inputs", async () => {
  const fetchMock = vi.fn(async (_url, init) => {
    const input = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ...input, id: "canonical-product", storeId: "store-demo", media: [], tags: [], variants: input.variants.map((variant: object) => ({ ...variant, id: "canonical-variant", quantity: 6, available: true })), available: true }), { headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ShopProvider><NewProductPage /></ShopProvider>);

  await user.type(screen.getByLabelText(/product name/i), "Mango Jelly Cake");
  await user.clear(screen.getByLabelText(/base price/i));
  await user.type(screen.getByLabelText(/base price/i), "650");
  await user.clear(screen.getByLabelText(/^stock$/i));
  await user.type(screen.getByLabelText(/^stock$/i), "6");
  await user.click(screen.getByRole("button", { name: /save product/i }));

  expect(await screen.findByText(/Product saved successfully/)).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/stores/store-demo/catalog/products"), expect.objectContaining({ method: "POST" }));
});
