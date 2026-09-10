import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopProvider } from "@/contexts/shop-context";
import { createRepository } from "@/lib/repository";
import { CheckoutView } from "./page";

it("turns a guest cart into a paid mock order", async () => {
  localStorage.clear();
  const repository = createRepository(localStorage);
  const cart = repository.createCart("sweet-bakes");
  repository.updateCartItem(cart.id, "vanilla-cake", 1);
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);

  await user.type(await screen.findByLabelText(/^name$/i), "Riya Menon");
  await user.type(screen.getByLabelText(/email/i), "riya@example.com");
  await user.type(screen.getByLabelText(/phone/i), "+91 98888 11111");
  await user.type(screen.getByLabelText(/address line/i), "22 Palm Avenue");
  await user.type(screen.getByLabelText(/^city$/i), "Bengaluru");
  await user.type(screen.getByLabelText(/state/i), "Karnataka");
  await user.type(screen.getByLabelText(/postal code/i), "560001");
  await user.click(screen.getByRole("button", { name: /place mock order/i }));

  expect(await screen.findByRole("heading", { name: /order confirmed/i })).toBeVisible();
  expect(screen.getByText(/payment accepted/i)).toBeVisible();
});
