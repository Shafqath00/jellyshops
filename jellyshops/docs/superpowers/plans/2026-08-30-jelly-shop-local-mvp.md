# Jelly Shop Local MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally runnable, responsive Jelly Shop MVP where a merchant manages a store and a customer completes a mock paid order.

**Architecture:** A single Next.js application separates `/admin` merchant workflows from `/:storeSlug` storefront workflows. A typed client-side mock repository persists seeded commerce state in local storage; React context exposes repository mutations and derived UI state. Auth, payment, and assets are provider interfaces implemented entirely in-browser.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright, Zod, Lucide React.

**Spec:** `docs/superpowers/specs/2026-08-30-jelly-shop-local-mvp-design.md`

## Global Constraints

- Use responsive web only; no native mobile application.
- Never require Firebase, Stripe, cloud storage, database, or external credentials.
- Store money in integer minor units and format it only at the UI boundary.
- Recalculate checkout price and availability from repository products, never from cart totals.
- Orders retain item name, image, SKU, quantity, and price snapshots.
- Merchant products, customers, and orders remain scoped to the active seed business/store.
- Valid order transitions are `PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`, with cancellation only from PENDING, CONFIRMED, or PROCESSING.
- Preserve keyboard navigation, visible labels, inline validation, empty states, and status feedback.

---

## File Structure

- `package.json`, `next.config.ts`, `tsconfig.json`, Tailwind and test config: application toolchain.
- `src/lib/domain.ts`: commerce types and explicit order transition map.
- `src/lib/seed.ts`: fixture business, stores, products, customer, and completed/demo orders.
- `src/lib/repository.ts`: deterministic CRUD, checkout, inventory, and persistence logic.
- `src/lib/providers.ts`: mock auth, payment, and image provider contracts and implementations.
- `src/contexts/shop-context.tsx`: repository state, cart state, and UI-accessible actions.
- `src/components/*`: reusable layout, form, status, product, cart, and order components.
- `src/app/admin/*`: merchant onboarding, dashboard, products, orders, customers, store, and settings screens.
- `src/app/[storeSlug]/*`: public home, collection, product, checkout, and confirmation screens.
- `src/lib/*.test.ts`, `src/components/*.test.tsx`, `e2e/first-order.spec.ts`: unit, component, and end-to-end coverage.

### Task 1: Create the Next.js application foundation

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/test/setup.ts`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Produces: an app that runs with `npm run dev`, validates with `npm run typecheck`, and tests with `npm test`.

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("renders the Jelly Shop entry point", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: /jelly shop/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL because the app and test runner do not exist.

- [ ] **Step 3: Scaffold the application and minimal entry point**

```tsx
export default function HomePage() {
  return <main><h1>Jelly Shop</h1></main>;
}
```

Configure scripts named `dev`, `build`, `lint`, `typecheck`, `test`, and `test:e2e`. Configure Tailwind content paths for `src/**/*.{ts,tsx}` and load global base styles.

- [ ] **Step 4: Run checks**

Run: `npm test -- src/app/page.test.tsx && npm run typecheck && npm run build`

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts vitest.config.ts playwright.config.ts src
git commit -m "feat: scaffold Jelly Shop web application"
```

### Task 2: Implement the commerce domain, fixtures, and mock providers

**Files:**
- Create: `src/lib/domain.ts`, `src/lib/seed.ts`, `src/lib/providers.ts`
- Test: `src/lib/domain.test.ts`, `src/lib/providers.test.ts`

**Interfaces:**
- Produces: `OrderStatus`, `canTransitionOrder(from, to)`, `formatMoney(minor, currency)`, `createSeedState()`, `mockAuth.getSession()`, and `mockPayments.confirm(input)`.

- [ ] **Step 1: Write failing domain tests**

```ts
expect(formatMoney(49999, "INR")).toMatch(/499/);
expect(canTransitionOrder("PENDING", "CONFIRMED")).toBe(true);
expect(canTransitionOrder("DELIVERED", "PENDING")).toBe(false);
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `npm test -- src/lib/domain.test.ts src/lib/providers.test.ts`

Expected: FAIL because exported modules do not exist.

- [ ] **Step 3: Define types, seed data, and mock contracts**

```ts
export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export const canTransitionOrder = (from: OrderStatus, to: OrderStatus) => allowed[from].includes(to);
export interface PaymentProvider { confirm(input: { amount: number; currency: string }): Promise<{ id: string; status: "PAID" }>; }
```

Seed two styled storefronts, at least eight products across categories, one low-stock variant, one customer, and representative orders. Each purchasable product has a default variant, integer `priceMinor`, and non-negative stock.

- [ ] **Step 4: Run checks**

Run: `npm test -- src/lib/domain.test.ts src/lib/providers.test.ts && npm run typecheck`

Expected: all tests and type checking pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain.ts src/lib/domain.test.ts src/lib/seed.ts src/lib/providers.ts src/lib/providers.test.ts
git commit -m "feat: add mocked commerce domain and fixtures"
```

### Task 3: Build the persistent repository and checkout rules

**Files:**
- Create: `src/lib/repository.ts`, `src/contexts/shop-context.tsx`
- Test: `src/lib/repository.test.ts`

**Interfaces:**
- Consumes: Task 2 domain and seed types.
- Produces: `ShopRepository`, `createRepository(storage)`, `ShopProvider`, `useShop()`.

- [ ] **Step 1: Write failing repository tests**

```ts
const repo = createRepository(memoryStorage());
const cart = repo.createCart("sweet-bakes");
repo.updateCartItem(cart.id, "vanilla-cake", 2);
const order = await repo.checkout({ cartId: cart.id, customer: validCustomer, shippingMinor: 5000 });
expect(order.paymentStatus).toBe("PAID");
expect(order.items[0].unitPriceMinor).toBe( repo.getVariant("vanilla-cake").priceMinor );
expect(() => repo.transitionOrder(order.id, "DELIVERED")).toThrow(/transition/i);
```

- [ ] **Step 2: Run the repository test to verify failure**

Run: `npm test -- src/lib/repository.test.ts`

Expected: FAIL because `createRepository` is missing.

- [ ] **Step 3: Implement repository actions**

```ts
interface ShopRepository {
  listProducts(storeSlug: string): Product[];
  saveProduct(input: ProductInput): Product;
  archiveProduct(id: string): void;
  createCart(storeSlug: string): Cart;
  updateCartItem(cartId: string, variantId: string, quantity: number): Cart;
  checkout(input: CheckoutInput): Promise<Order>;
  transitionOrder(orderId: string, next: OrderStatus): Order;
  reset(): void;
}
```

Load seed state when storage is empty; serialize after every mutation. During checkout resolve variants by ID, reject stock shortages, create order-item snapshots, call the mock payment provider, decrement inventory after a PAID result, and create/update the customer. Cancellation restores quantity only once.

- [ ] **Step 4: Run checks**

Run: `npm test -- src/lib/repository.test.ts && npm run typecheck`

Expected: tests pass, including out-of-stock and invalid transition cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repository.ts src/lib/repository.test.ts src/contexts/shop-context.tsx
git commit -m "feat: add persistent mock commerce repository"
```

### Task 4: Build shared responsive UI primitives

**Files:**
- Create: `src/components/app-shell.tsx`, `src/components/admin-nav.tsx`, `src/components/store-header.tsx`, `src/components/product-card.tsx`, `src/components/cart-panel.tsx`, `src/components/order-status.tsx`, `src/components/empty-state.tsx`
- Test: `src/components/cart-panel.test.tsx`, `src/components/order-status.test.tsx`

**Interfaces:**
- Consumes: Task 2 types and `useShop()` from Task 3.
- Produces: composable accessible navigation, product, cart, empty-state, and order-status components.

- [ ] **Step 1: Write failing component tests**

```tsx
render(<OrderStatus status="SHIPPED" />);
expect(screen.getByText("Shipped")).toBeVisible();

render(<CartPanel storeSlug="sweet-bakes" open onClose={vi.fn()} />);
expect(screen.getByRole("heading", { name: /your cart/i })).toBeVisible();
```

- [ ] **Step 2: Run the component tests to verify failure**

Run: `npm test -- src/components/cart-panel.test.tsx src/components/order-status.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement components**

Create a mobile-first admin sidebar that becomes a compact top bar, a sticky storefront header, cards with image alt text, a keyboard-dismissible cart dialog, semantic status chips, and a reusable empty state. Use the store theme only in storefront components; admin uses a stable Jelly system theme.

- [ ] **Step 4: Run checks**

Run: `npm test -- src/components/cart-panel.test.tsx src/components/order-status.test.tsx && npm run typecheck`

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat: add shared Jelly Shop interface components"
```

### Task 5: Implement merchant onboarding and operations

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/onboarding/page.tsx`
- Create: `src/app/admin/products/page.tsx`, `src/app/admin/products/new/page.tsx`, `src/app/admin/products/[id]/page.tsx`
- Create: `src/app/admin/orders/page.tsx`, `src/app/admin/orders/[id]/page.tsx`, `src/app/admin/customers/page.tsx`, `src/app/admin/store/page.tsx`, `src/app/admin/settings/page.tsx`
- Test: `src/app/admin/products/new/page.test.tsx`, `src/app/admin/orders/[id]/page.test.tsx`

**Interfaces:**
- Consumes: Task 3 repository actions and Task 4 components.
- Produces: a complete merchant workflow for configuring store data, managing products, and fulfilling orders.

- [ ] **Step 1: Write failing merchant-flow tests**

```tsx
render(<NewProductPage />);
await user.type(screen.getByLabelText(/product name/i), "Mango Jelly");
await user.click(screen.getByRole("button", { name: /save product/i }));
expect(shop.saveProduct).toHaveBeenCalled();
```

```tsx
render(<OrderDetailPage params={{ id: "order-001" }} />);
await user.click(screen.getByRole("button", { name: /confirm order/i }));
expect(screen.getByText("Confirmed")).toBeVisible();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/app/admin/products/new/page.test.tsx src/app/admin/orders/[id]/page.test.tsx`

Expected: FAIL because admin pages are absent.

- [ ] **Step 3: Implement merchant pages**

Onboarding saves business/store basics. Dashboard displays setup completion, paid order total, low-stock list, and attention-needed orders. Products supports create, edit, archive, category, price, SKU, image URL, stock, and published state. Orders expose only the next valid action. Customers show customer contact details and their order history. Store/settings allow theme token, logo/banner URL, shipping cost, slug, and publish settings updates.

- [ ] **Step 4: Run checks**

Run: `npm test -- src/app/admin/products/new/page.test.tsx src/app/admin/orders/[id]/page.test.tsx && npm run typecheck && npm run build`

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin
git commit -m "feat: add merchant admin MVP workflows"
```

### Task 6: Implement public storefront, cart, and mock checkout

**Files:**
- Create: `src/app/[storeSlug]/page.tsx`, `src/app/[storeSlug]/shop/page.tsx`, `src/app/[storeSlug]/products/[productSlug]/page.tsx`
- Create: `src/app/[storeSlug]/checkout/page.tsx`, `src/app/[storeSlug]/order/[orderId]/page.tsx`
- Test: `src/app/[storeSlug]/checkout/page.test.tsx`

**Interfaces:**
- Consumes: product/cart actions from Task 3 and storefront components from Task 4.
- Produces: guest-storefront browsing and checkout path that creates a PAID mock order.

- [ ] **Step 1: Write the failing checkout test**

```tsx
render(<CheckoutPage params={{ storeSlug: "sweet-bakes" }} />);
await user.type(screen.getByLabelText(/email/i), "buyer@example.com");
await user.click(screen.getByRole("button", { name: /place mock order/i }));
expect(await screen.findByRole("heading", { name: /order confirmed/i })).toBeVisible();
```

- [ ] **Step 2: Run the checkout test to verify failure**

Run: `npm test -- src/app/[storeSlug]/checkout/page.test.tsx`

Expected: FAIL because storefront checkout is absent.

- [ ] **Step 3: Implement customer pages**

Resolve the store slug or render a not-found state. Home highlights categories and featured products; shop filters published products by category; product detail chooses a variant and adds it to the store cart. Cart quantity controls reject quantity above live stock. Checkout validates customer/address fields, displays server-authoritative-style totals from the repository, calls `checkout`, then routes to confirmation with item/order snapshots and status.

- [ ] **Step 4: Run checks**

Run: `npm test -- src/app/[storeSlug]/checkout/page.test.tsx && npm run typecheck && npm run build`

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/[storeSlug]
git commit -m "feat: add storefront cart and mock checkout"
```

### Task 7: Verify the First Order release path and document local use

**Files:**
- Create: `e2e/first-order.spec.ts`, `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: all routes and repository behaviour from Tasks 1-6.
- Produces: reproducible first-order E2E test and local run instructions.

- [ ] **Step 1: Write the failing Playwright journey**

```ts
test("merchant can fulfil a customer mock order", async ({ page }) => {
  await page.goto("/sweet-bakes");
  await page.getByRole("link", { name: /vanilla celebration cake/i }).click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.getByRole("link", { name: /checkout/i }).click();
  await page.getByLabel(/email/i).fill("buyer@example.com");
  await page.getByRole("button", { name: /place mock order/i }).click();
  await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm run test:e2e -- e2e/first-order.spec.ts`

Expected: FAIL until the browser journey and runner configuration are complete.

- [ ] **Step 3: Complete the lifecycle and documentation**

Extend the test to open `/admin/orders`, confirm the created order, move it through Processing, Shipped, and Delivered, and assert every visible status. Document exact `npm install`, `npm run dev`, `npm test`, `npm run test:e2e`, and reset-data instructions. Add a `test:e2e` script that starts or reuses the local server through Playwright `webServer` configuration.

- [ ] **Step 4: Run the release suite**

Run: `npm test && npm run typecheck && npm run build && npm run test:e2e`

Expected: all commands pass; the First Order flow reaches Delivered.

- [ ] **Step 5: Commit**

```bash
git add e2e README.md package.json playwright.config.ts
git commit -m "test: cover the Jelly Shop first-order journey"
```
