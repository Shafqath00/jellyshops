import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import { createRepository } from "@/lib/repository";
import { CheckoutView } from "./view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ storeSlug: "sweet-bakes" }) }));
vi.mock("@/features/checkout/components/payment-step", () => ({
  PaymentStep: ({ amountMinor }: { amountMinor: number }) => <section><h2 tabIndex={-1}>Payment</h2><p>Card payment form for {amountMinor}</p></section>,
}));

const prepared = { clientSecret: "cs_test", connectedAccountId: "acct_123", orderId: "order-1", publicToken: "a-token", totals: { subtotalMinor: 50000, shippingMinor: 5000, totalMinor: 55000, amountMinor: 55000, currency: "INR" } };

function bag(digital = false) {
  localStorage.clear();
  const repository = createRepository(localStorage);
  if (digital) {
    const product = repository.listProducts("sweet-bakes").find((p) => p.variants.some((v) => v.id === "vanilla-cake"))!;
    repository.saveProduct({ ...product, fulfillmentType: "DIGITAL" });
  }
  const cart = repository.createCart("sweet-bakes");
  repository.updateCartItem(cart.id, "vanilla-cake", 1);
  return repository;
}

async function fillDelivery(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/^email/i), "riya@example.com");
  await user.type(screen.getByLabelText(/^full name/i), "Riya Menon");
  await user.type(screen.getByLabelText(/^phone/i), "+91 98888 11111");
  await user.type(screen.getByLabelText(/^address$/i), "22 Palm Avenue");
  await user.type(screen.getByLabelText(/^town or city/i), "Bengaluru");
  await user.type(screen.getByLabelText(/^state/i), "Karnataka");
  await user.type(screen.getByLabelText(/^pin code/i), "560001");
}

it("prices the order on the server, then shows the payment step with the server total", async () => {
  bag();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "attempt-1", orderId: "order-1", publicToken: "a-token" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(prepared), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  await fillDelivery(user);
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));

  expect(await screen.findByText("Card payment form for 55000")).toBeVisible();
  expect(screen.getByRole("button", { name: /change your details/i })).toBeVisible();
  const body = JSON.parse(fetcher.mock.calls[0]![1]!.body);
  expect(body.items[0]).not.toHaveProperty("unitPriceMinor");
  expect(body.deliverySnapshot).toMatchObject({ city: "Bengaluru", country: "IN" });
  expect(screen.getAllByText(/550\.00/).length).toBeGreaterThan(0);
});

it("shows field problems next to the fields and sends nothing", async () => {
  bag();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  await user.type(await screen.findByLabelText(/^email/i), "not-an-email");
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));
  const email = screen.getByLabelText(/^email/i);
  expect(email).toHaveAttribute("aria-invalid", "true");
  expect(email).toHaveAccessibleDescription(/name@example\.com/);
  expect(email).toHaveFocus();
  expect(screen.getByLabelText(/^full name/i)).toHaveAccessibleDescription(/enter your full name/i);
  expect(fetcher).not.toHaveBeenCalled();
});

it("shows a plain message when the shop can't take payments", async () => {
  bag();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "MERCHANT_PAYMENTS_UNAVAILABLE", message: "Merchant payments are unavailable." } }), { status: 409 })));
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  await fillDelivery(user);
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("This shop isn't taking payments yet");
});

it("does not ask for an address for digital-only bags", async () => {
  bag(true);
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "a", orderId: "o", publicToken: "t" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(prepared)));
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  await user.type(await screen.findByLabelText(/^email/i), "buyer@example.test");
  expect(screen.queryByLabelText(/^address$/i)).not.toBeInTheDocument();
  await user.type(screen.getByLabelText(/^full name/i), "Buyer");
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));
  expect(await screen.findByText(/card payment form/i)).toBeVisible();
  expect(JSON.parse(fetcher.mock.calls[0]![1]!.body)).not.toHaveProperty("deliverySnapshot");
});

it("shows the empty bag state", async () => {
  localStorage.clear();
  createRepository(localStorage);
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  expect(await screen.findByRole("heading", { name: /your bag is empty/i })).toBeVisible();
  expect(screen.getByRole("link", { name: /browse the shop/i })).toHaveAttribute("href", "/sweet-bakes/shop");
});

it("has no automatic accessibility problems on the details step", async () => {
  bag();
  const { container } = render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  await screen.findByLabelText(/^email/i);
  const results = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
});

it("checks a discount code on the server, shows it in the summary and sends it with the order", async () => {
  bag();
  const preview = { code: "SAVE10", label: "10% off", subtotalMinor: 50000, discountMinor: 5000, shippingMinor: 5000, totalMinor: 50000, currency: "INR" };
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "DISCOUNT_NOT_APPLICABLE", message: "This code has expired." } }), { status: 422 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(preview), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "attempt-1", orderId: "order-1", publicToken: "a-token" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...prepared, totals: { ...prepared.totals, discountMinor: 5000, discountCode: "SAVE10", totalMinor: 50000, amountMinor: 50000 } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);

  const field = (await screen.findAllByRole("textbox", { name: "Discount code" }))[0]!;
  await user.type(field, "old");
  await user.click(screen.getAllByRole("button", { name: "Apply" })[0]!);
  expect(await screen.findByText("This code has expired.")).toBeVisible();
  expect(field).toHaveAttribute("aria-invalid", "true");

  await user.clear(field);
  await user.type(field, "save10");
  await user.click(screen.getAllByRole("button", { name: "Apply" })[0]!);
  expect(await screen.findByRole("button", { name: "Remove discount code SAVE10" })).toBeVisible();
  expect(screen.getAllByText("−₹50.00").length).toBeGreaterThan(0);
  expect(JSON.parse(fetcher.mock.calls[1]![1]!.body)).toMatchObject({ code: "save10", currency: "INR", items: [{ variantId: "vanilla-cake", quantity: 1 }] });

  await fillDelivery(user);
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));
  expect(await screen.findByText("Card payment form for 50000")).toBeVisible();
  expect(JSON.parse(fetcher.mock.calls[2]![1]!.body)).toMatchObject({ discountCode: "SAVE10" });
  // Once the payment is being taken the code can't be changed here.
  expect(screen.queryByRole("textbox", { name: "Discount code" })).toBeNull();
});
