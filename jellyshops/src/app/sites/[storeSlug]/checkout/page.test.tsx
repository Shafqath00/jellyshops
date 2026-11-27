import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import { createRepository } from "@/lib/repository";
import { CheckoutView } from "./view";
import { bagKey } from "@/features/checkout/checkout-memory";

const mockRouter = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter, useParams: () => ({ storeSlug: "sweet-bakes" }) }));
vi.mock("@/features/checkout/components/payment-step", () => ({
  PaymentStep: ({ amountMinor, onPaid, onBeforePay }: { amountMinor: number; onPaid: () => void; onBeforePay?: () => void }) => <section><p>Card payment form for {amountMinor}</p><button type="button" onClick={() => { onBeforePay?.(); onPaid(); }}>Pretend to pay</button></section>,
}));

const prepared = { clientSecret: "cs_test", connectedAccountId: "acct_123", orderId: "order-1", publicToken: "a-token", totals: { subtotalMinor: 50000, shippingMinor: 5000, totalMinor: 55000, amountMinor: 55000, currency: "INR" } };

/**
 * The checkout also asks the server which discounts the bag gets (automatic ones on load, and again once a code is
 * applied). Those questions are answered here so each test's own answers stay in order: a check without a code gets
 * "no discount route" (no automatic discounts), and asking again about the code just applied repeats the last answer.
 */
function withBagCheck(fetcher: (url: string, init?: RequestInit) => Promise<Response>) {
  let last: { code: string; status: number; body: string } | null = null;
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/checkout/discount")) {
      const code = String(JSON.parse(String(init?.body ?? "{}")).code ?? "").toUpperCase();
      if (!code) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }), { status: 404 });
      if (last && last.code === code) return new Response(last.body, { status: last.status });
      const response: Response = await fetcher(url, init);
      const body = await response.clone().text();
      last = { code, status: response.status, body };
      return response;
    }
    return fetcher(url, init);
  });
}

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
  await user.click(screen.getByRole("button", { name: /continue to delivery/i }));
  await user.type(await screen.findByLabelText(/^address$/i), "22 Palm Avenue");
  await user.type(screen.getByLabelText(/^town or city/i), "Bengaluru");
  await user.type(screen.getByLabelText(/^state/i), "Karnataka");
  await user.type(screen.getByLabelText(/^pin code/i), "560001");
}

it("prices the order on the server, then shows the payment step with the server total", async () => {
  bag();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "attempt-1", orderId: "order-1", publicToken: "a-token" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(prepared), { status: 200 }));
  vi.stubGlobal("fetch", withBagCheck(fetcher));
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
  vi.stubGlobal("fetch", withBagCheck(fetcher));
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  await user.type(await screen.findByLabelText(/^email/i), "not-an-email");
  await user.click(screen.getByRole("button", { name: /continue to delivery/i }));
  const email = screen.getByLabelText(/^email/i);
  expect(email).toHaveAttribute("aria-invalid", "true");
  expect(email).toHaveAccessibleDescription(/name@example\.com/);
  expect(email).toHaveFocus();
  expect(screen.getByLabelText(/^full name/i)).toHaveAccessibleDescription(/enter your full name/i);
  expect(fetcher).not.toHaveBeenCalled();
});

it("shows a plain message when the shop can't take payments", async () => {
  bag();
  vi.stubGlobal("fetch", withBagCheck(vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "MERCHANT_PAYMENTS_UNAVAILABLE", message: "Merchant payments are unavailable." } }), { status: 409 }))));
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
  vi.stubGlobal("fetch", withBagCheck(fetcher));
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
  vi.stubGlobal("fetch", withBagCheck(fetcher));
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

it("opens the cards in turn, folds finished ones into a recap, and lets the shopper change them", async () => {
  bag();
  vi.stubGlobal("fetch", withBagCheck(vi.fn()));
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  expect(await screen.findByRole("heading", { name: /step 2:s*delivery/i })).toBeVisible();
  expect(screen.queryByLabelText(/^address$/i)).toBeNull();
  await user.type(screen.getByLabelText(/^email/i), "riya@example.com");
  await user.type(screen.getByLabelText(/^full name/i), "Riya Menon");
  await user.type(screen.getByLabelText(/^phone/i), "+91 98888 11111");
  await user.click(screen.getByRole("button", { name: /continue to delivery/i }));
  expect(await screen.findByLabelText(/^address$/i)).toBeVisible();
  expect(screen.getByText(/Riya Menon · riya@example.com/)).toBeVisible();
  expect(screen.getByRole("heading", { name: /step 2:s*delivery/i })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: /change your details/i }));
  expect(screen.getByLabelText(/^email/i)).toHaveValue("riya@example.com");
});

it("checks a field when the shopper leaves it, once something is typed", async () => {
  bag();
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  const email = await screen.findByLabelText(/^email/i);
  await user.click(email);
  await user.tab();
  expect(email).not.toHaveAttribute("aria-invalid");
  await user.type(email, "riya@");
  await user.tab();
  expect(email).toHaveAttribute("aria-invalid", "true");
  await user.type(email, "example.com");
  expect(email).not.toHaveAttribute("aria-invalid");
});

it("follows the merchant's checkout settings: phone hidden, no second address line, a note for the shop", async () => {
  bag();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "attempt-1", orderId: "order-1", publicToken: "a-token" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(prepared), { status: 200 }));
  vi.stubGlobal("fetch", withBagCheck(fetcher));
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" settings={{ checkout: { accent: "#b5452b", phone: "hidden", addressLine2: "hide", note: "show", deliveryNote: "Delivered in 3 days", returnsNote: "30-day returns" } }} /></ShopProvider>);
  expect(await screen.findByText("Delivered in 3 days")).toBeVisible();
  expect(document.querySelector("main.jelly-checkout")?.getAttribute("style")).toContain("--checkout-primary: #b5452b");
  expect(screen.getByRole("link", { name: "30-day returns" })).toHaveAttribute("href", "/sweet-bakes/pages/returns");
  await user.type(screen.getByLabelText(/^email/i), "riya@example.com");
  await user.type(screen.getByLabelText(/^full name/i), "Riya Menon");
  expect(screen.queryByLabelText(/^phone/i)).toBeNull();
  await user.click(screen.getByRole("button", { name: /continue to delivery/i }));
  expect(screen.queryByLabelText(/flat, suite/i)).toBeNull();
  await user.type(await screen.findByLabelText(/^address$/i), "22 Palm Avenue");
  await user.type(screen.getByLabelText(/^town or city/i), "Bengaluru");
  await user.type(screen.getByLabelText(/^state/i), "Karnataka");
  await user.type(screen.getByLabelText(/^pin code/i), "560001");
  await user.type(screen.getByLabelText(/^note for the shop/i), "Leave with the neighbour");
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));
  expect(await screen.findByText("Card payment form for 55000")).toBeVisible();
  const body = JSON.parse(fetcher.mock.calls[0]![1]!.body);
  expect(body.customerSnapshot).toMatchObject({ note: "Leave with the neighbour" });
  expect(body.customerSnapshot).not.toHaveProperty("phone");
});

it("remembers details on this device only when asked, and fills them in next time", async () => {
  bag();
  vi.stubGlobal("fetch", withBagCheck(vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "attempt-1", orderId: "order-1", publicToken: "a-token" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(prepared), { status: 200 }))));
  const user = userEvent.setup();
  const { unmount } = render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  await user.click(await screen.findByRole("checkbox", { name: /remember my details/i }));
  await fillDelivery(user);
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));
  await screen.findByText("Card payment form for 55000");
  expect(JSON.parse(localStorage.getItem("jelly-checkout-details:sweet-bakes")!)).toMatchObject({ email: "riya@example.com", city: "Bengaluru" });
  unmount();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  expect(await screen.findByDisplayValue("riya@example.com")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /forget them/i }));
  expect(localStorage.getItem("jelly-checkout-details:sweet-bakes")).toBeNull();
  expect(screen.getByLabelText(/^email/i)).toHaveValue("");
});

it("leaves checkout with replace after paying, so Back cannot return to the payment form", async () => {
  bag();
  sessionStorage.clear();
  vi.stubGlobal("fetch", withBagCheck(vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ attemptId: "attempt-1", orderId: "order-1", publicToken: "a-token" }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(prepared), { status: 200 }))));
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  await fillDelivery(user);
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));
  await user.click(await screen.findByRole("button", { name: "Pretend to pay" }));
  expect(mockRouter.replace).toHaveBeenCalledWith("/sweet-bakes/order/a-token?paid=1");
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(JSON.parse(sessionStorage.getItem("jelly-checkout-paid:sweet-bakes")!)).toMatchObject({ publicToken: "a-token", email: "riya@example.com", paid: true });
});

it("does not offer a second payment for a bag this tab has just paid for", async () => {
  const repository = bag();
  const cart = repository.getCartForStore("sweet-bakes")!;
  sessionStorage.setItem("jelly-checkout-paid:sweet-bakes", JSON.stringify({ publicToken: "a-token", email: "riya@example.com", bagKey: bagKey(cart.items), at: Date.now(), paid: true }));
  const user = userEvent.setup();
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" /></ShopProvider>);
  expect(await screen.findByRole("heading", { name: "You've already paid for this order" })).toBeVisible();
  expect(screen.getByRole("link", { name: "View your order" })).toHaveAttribute("href", "/sweet-bakes/order/a-token");
  expect(screen.queryByLabelText(/^email/i)).toBeNull();
  await user.click(screen.getByRole("button", { name: "Buy these items again" }));
  expect(await screen.findByLabelText(/^email/i)).toBeVisible();
  expect(sessionStorage.getItem("jelly-checkout-paid:sweet-bakes")).toBeNull();
  sessionStorage.clear();
});

it("shows the expected delivery date from the shop's delivery time", async () => {
  bag();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
  render(<ShopProvider><CheckoutView storeSlug="sweet-bakes" settings={{ checkout: { deliveryDays: "3-5" } }} /></ShopProvider>);
  expect((await screen.findAllByText("Arrives Wed 25 – Fri 27 Nov")).length).toBeGreaterThan(0);
  vi.useRealTimers();
});
