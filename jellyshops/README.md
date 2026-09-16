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

The API runs on port 3001 and the frontend on port 3000. Open these routes:

- Merchant studio: [http://localhost:3000/admin](http://localhost:3000/admin)
- Home-page Store Editor: [http://localhost:3000/admin/store-design](http://localhost:3000/admin/store-design)
- Sweet Bakes: [http://localhost:3000/sweet-bakes](http://localhost:3000/sweet-bakes)
- Bloom Home: [http://localhost:3000/bloom-home](http://localhost:3000/bloom-home)

Development uses the built-in demo merchant automatically. Store Editor changes remain
private until **Publish** is selected. Drafts, publications, and uploaded media are stored
under `../backend/.data` and `../backend/uploads`. Stop the API, remove those two directories,
and restart it to reset only the Store Editor API data.

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

The Store Editor currently uses the local Node/Express API and filesystem adapters.
Firebase Authentication, PostgreSQL/Prisma, and Google Cloud Storage are deliberately
not connected yet; their replacement boundaries and environment keys are documented in
`../backend/README.md`.
