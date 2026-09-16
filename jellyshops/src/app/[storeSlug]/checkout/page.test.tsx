import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import { createRepository } from "@/lib/repository";
import { CheckoutView } from "./page";

vi.mock("@/features/commerce/components/payment-element-checkout", () => ({
  PaymentElementCheckout: () => <div>Card payment form</div>,
}));

it("creates a server checkout attempt and prepares card payment", async () => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "attempt-1", orderId: "order-1", publicToken: "a-token" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ clientSecret: "cs_test", connectedAccountId: "acct_123", orderId: "order-1", publicToken: "a-token" }), { status: 200 })));
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
  await user.click(screen.getByRole("button", { name: /continue to card payment/i }));

  expect(await screen.findByText(/card payment form/i)).toBeVisible();
  expect(screen.queryByRole("button", { name: /place order/i })).not.toBeInTheDocument();
});
