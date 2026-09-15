# Jelly Shop Local MVP Design

## Goal

Deliver a polished responsive web MVP that lets a merchant set up a store,
publish products, receive a mock paid order, and complete fulfilment. The
application is intentionally local-first: all data and provider behaviour are
mocked, but its data model and service boundaries make a future Firebase,
Stripe, storage, and database migration straightforward.

## Architecture

Use one Next.js + TypeScript application with Tailwind CSS. It has two
route areas:

- `/admin/*` - merchant onboarding and management.
- `/[storeSlug]/*` - public storefronts, including cart and checkout.

The app holds a small, typed commerce domain in a client-side mock repository.
The repository exposes CRUD and transition methods instead of pages mutating
records directly. Seed data is hydrated from a static fixture and state is
persisted in local storage; a reset action restores the fixture. This gives the
full experience deterministic demo data without requiring accounts, API keys,
or network services.

## Domain and Mock Boundaries

The mock repository owns `Store`, `Product`, `Variant`, `Customer`, `Cart`,
`Order`, `OrderItem`, and `Payment` records. Prices use integer minor units;
orders snapshot product names and prices at confirmation. Inventory is reduced
when checkout completes and restored if a pending order is cancelled.

Provider-style interfaces isolate behaviours that will later be real services:

- `AuthProvider`: returns a seeded merchant session.
- `PaymentProvider`: confirms a configurable mock payment result.
- `AssetProvider`: supplies safe mock image URLs.

Checkout recalculates product price and stock from the repository. It never
trusts a total stored by a cart. Invalid stock and forbidden order transitions
return explicit, user-visible errors.

## Merchant Experience

The admin opens with a practical action dashboard: setup progress, sales
summary, low-stock products, and orders needing attention. It includes:

- onboarding for business and store name, slug, currency, and theme;
- product list and create/edit/archive form with variants, stock, category,
  price, images, and publish state;
- order list/detail with a constrained fulfilment state machine;
- customer list/detail populated by checkout;
- store design/settings for logo, palette, type preset, shipping cost, and
  publishing state.

## Customer Experience

Each seeded shop has a responsive public home page, product collection,
product-detail page, cart drawer/page, guest checkout, and success page. The
shop theme is derived from the store configuration. A cart is scoped to its
store and supports add, remove, and quantity changes. Checkout collects name,
email, phone, and address, then creates a paid order through the mock payment
provider.

## Visual Direction

The UI should be friendly, editorial, and commerce-first: generous whitespace,
clear order status, warm Jelly colors, legible typography, and touch-friendly
controls. It should avoid generic admin-dashboard density, especially on small
screens. Seed stores demonstrate distinct themes while retaining the same
structured storefront components.

## Error Handling and Accessibility

Every async-looking mutation displays pending, success, and failure feedback.
Forms use visible labels, keyboard-usable controls, inline validation, and
clear empty states. Confirmation of destructive-looking actions (archive or
cancel) is explicit. The state-machine methods reject impossible transitions.

## Testing and Acceptance

Unit tests cover monetary totals, inventory handling, product archiving, cart
updates, checkout snapshots, and valid/invalid order transitions. UI testing
verifies the main mock path:

1. Open the merchant admin and complete onboarding.
2. Add and publish a product.
3. Browse the public store and add it to a guest cart.
4. Finish mock checkout and receive an order confirmation.
5. Return to admin and move the order through delivered.

The MVP is complete when this full path works locally from seeded or newly
created data with no external credentials.

## Explicit Exclusions

There is no real authentication, payment collection, persistent backend,
uploads, email, taxation engine, shipping integration, customer accounts,
multi-store tenant switching, analytics, or cloud deployment in this delivery.
Those remain out of scope until the mocked experience is approved.
