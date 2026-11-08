# Jelly Shop MVP

A responsive commerce storefront and merchant studio for small merchants. It includes a
merchant studio, two themed storefronts, product and inventory management,
guest cart and checkout, customer records, and an explicit order fulfilment
lifecycle. Authentication, media, and demo catalog state have local development
adapters. Customer payments use the server-side Stripe Connect API in configured environments.

## Run the Store Editor locally

```bash
npm --prefix ../backend install
npm --prefix ../backend run dev
npm install
npm run dev
```

`npm run dev` builds the storefront packages, watches their source for changes,
and starts Next.js. This keeps package exports in sync while editing themes,
schemas, and registry definitions.

The API runs on port 3001 and the frontend on port 3000. Open these routes:

- Merchant studio: [http://localhost:3000/admin](http://localhost:3000/admin)
- Home-page Store Editor: [http://localhost:3000/admin/store-design](http://localhost:3000/admin/store-design)
- Sweet Bakes: [http://localhost:3000/sweet-bakes](http://localhost:3000/sweet-bakes)
- Bloom Home: [http://localhost:3000/bloom-home](http://localhost:3000/bloom-home)

Authentication, persistence and media depend on the configured providers. See
`../backend/README.md` and the backend environment example for setup. Store Editor
changes remain private until **Publish** is selected.

Use **Reset demo data** in the merchant sidebar or Settings page to restore all
seed products, inventory, customers, orders, and storefront settings.

## Verify

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

The browser tests start isolated frontend and API services. They cover the original
First Order path plus private draft isolation, explicit publication, and mobile preview.

If Chromium is not installed for Playwright, run:

```bash
npx playwright install chromium
```

## Development architecture

- Commerce state is seeded in `src/lib/seed.ts` and persisted under a single
  versioned local-storage key.
- `src/lib/repository.ts` owns local catalog, storefront-design, customer, and cart demo state.
- Checkout, payment, order, refund, and fulfilment authority lives in the backend API and Stripe webhooks.
- Money is stored as integer minor units and formatted only at the UI boundary.

The local API supports multiple authentication and persistence configurations.
The frontend uses Supabase Auth in configured environments; customer payments use
the backend's Stripe integration. See `../backend/README.md` for provider setup.

## Code map and contribution guidance

`src/app` contains Next.js routes, layouts and global/theme styles. Business
features live under `src/features`, shared UI under `src/components/ui`, the
admin shell and navigation under `src/components/layout`, the shop
provider under `src/contexts`, and cross-feature domain types and helpers under
`src/lib`. Unit tests normally live beside the code they exercise; browser tests
and fixtures are under `e2e`.

The five npm workspace packages under `packages` contain storefront schemas,
registry definitions, themes, the renderer and shared storefront UI. The editor
preview and published storefront use the same renderer. Some packages are also
consumed by the backend, so preserve package exports, theme IDs and versions
when refactoring. Keep route entry points in `src/app`, feature code with its
feature, and genuinely reusable primitives in `src/components/ui`. Preserve the
server/client boundary and CSS import order when moving code.

CI uses Node.js 22. Copy `.env.example` to `.env.local` and configure values
for your environment. The `dev`, `test` and `build` scripts build the schema,
registry and themes workspaces first. Playwright starts local frontend and backend
services with temporary data; it needs backend dependencies, free ports and a
supported browser. On Windows the Playwright configuration uses Chrome. The
separate onboarding browser gate requires additional test configuration; see
`scripts/run-onboarding-e2e.mjs` and the backend documentation.

For further guidance see `../docs/README.md`, `../docs/development/testing.md`,
and `../docs/theme-architecture.md`. Historical test results are snapshots, not
proof that the current checkout passes.
