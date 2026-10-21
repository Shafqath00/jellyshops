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
  await user.type(screen.getByLabelText(/pin code|postcode|zip code/i), "560001");
  await user.click(screen.getByRole("button", { name: /continue to card payment/i }));

  expect(await screen.findByText(/card payment form/i)).toBeVisible();
  expect(screen.queryByRole("button", { name: /place order/i })).not.toBeInTheDocument();
});

it("does not require a shipping address for digital-only carts", async () => {
  localStorage.clear();
  const repository = createRepository(localStorage);
  const product = repository.listProducts("sweet-bakes").find((p) => p.variants.some((v) => v.id === "vanilla-cake"))!;
  repository.saveProduct({ ...product, fulfillmentType: "DIGITAL" });
  const cart = repository.createCart("sweet-bakes");
  repository.updateCartItem(cart.id, "vanilla-cake", 1);
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "a", orderId: "o", publicToken: "t" }), { status: 201 })).mockResolvedValueOnce(new Response(JSON.stringify({ clientSecret: "cs", connectedAccountId: "acct", publicToken: "t" })));
  vi.stubGlobal("fetch", fetcher);
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  const name = await screen.findByLabelText(/^name$/i);
  expect(screen.queryByLabelText(/address line/i)).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.type(name, "Buyer");
  await user.type(screen.getByLabelText(/email/i), "buyer@example.test");
  await user.click(screen.getByRole("button", { name: /continue to card payment/i }));
  expect(await screen.findByText(/card payment form/i)).toBeVisible();
  expect(JSON.parse(fetcher.mock.calls[0]![1]!.body)).not.toHaveProperty("deliverySnapshot");
});

it("keeps delivery details required when a cart mixes digital and physical items", async () => {
  localStorage.clear();
  const repository = createRepository(localStorage);
  const products = repository.listProducts("sweet-bakes");
  const digital = products.find((p) => p.variants.some((v) => v.id === "vanilla-cake"))!;
  const physical = products.find((p) => p.id !== digital.id && p.variants.length)!;
  repository.saveProduct({ ...digital, fulfillmentType: "DIGITAL" });
  const cart = repository.createCart("sweet-bakes");
  repository.updateCartItem(cart.id, "vanilla-cake", 1);
  repository.updateCartItem(cart.id, physical.variants[0]!.id, 1);
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  expect(await screen.findByLabelText(/address line/i)).toBeRequired();
  expect(screen.getByLabelText(/phone/i)).toBeRequired();
});
