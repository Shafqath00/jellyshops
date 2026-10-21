# System overview

## Repository layout

| Path | What it is |
| --- | --- |
| `jellyshops/` | Next.js 16 / React 19 / Tailwind 4 frontend: merchant admin, theme editor, public storefront. |
| `jellyshops/packages/storefront-schema` | Zod schemas and types (documents, sections, runtime snapshot, rich text). |
| `jellyshops/packages/storefront-registry` | Section/block definitions, editor controls, starter packs, plain-language labels. |
| `jellyshops/packages/storefront-renderer` | The single renderer used by the editor preview and the published store. |
| `jellyshops/packages/storefront-themes` | Theme definitions, token resolvers, fonts. |
| `jellyshops/packages/storefront-ui` | Small shared components (container, product card, button). |
| `backend/` | Express 5 + TypeScript API; Supabase Postgres via raw `pg`; Stripe Connect. Deployed as a Firebase Function. |
| `backend/sql/migrations`, `backend/supabase/migrations` | SQL migrations. |
| `scripts/` | Repo tooling (`prepare-shared-packages.mjs`, `generate-docs.mjs`, `generate-db-docs.mjs`, `pin-installed-dependencies.mjs`). |
| `docs/` | This documentation. |
| `.github/workflows/core-mvp.yml` | CI: typecheck, lint, test and build for both apps. |

## Runtime picture

```text
Browser (merchant)                Browser (shopper)
   │ Supabase session (JWT)          │ no login for browsing / checkout
   ▼                                 ▼
Next.js app (jellyshops/)  ──────────────────────────────────────────┐
   admin pages, editor, storefront pages (server + client components) │
   │  fetch(NEXT_PUBLIC_STORE_EDITOR_API_URL / STOREFRONT_API_URL)     │
   ▼                                                                   │
Express API (backend/src/app.ts)                                       │
   ├─ merchant routes   /api/stores/:storeId/...   Bearer JWT + permission check
   ├─ public routes     /api/public/stores/:storeId/...   no merchant auth
   ├─ webhooks          /webhooks/stripe/...              Stripe signature
   └─ internal routes   /internal/...                     scheduler secret
   ▼
Postgres (Supabase)  ◄──── Stripe (Connect, PaymentIntents, webhooks)
   private file/media storage (local disk, GCS or Supabase buckets)
   SMTP transport for order emails
```

## Key ideas

- **Store = tenant.** Every merchant route lives under `/api/stores/:storeId`; the authenticated principal's role for that store is checked, and every repository query takes `storeId`. See [authentication](../api/authentication.md).
- **Draft vs publish.** Editing happens in a SQL workspace; publishing compiles an immutable publication and moves an active-publication pointer. The live store changes only on Publish. See [publishing](../features/publishing.md).
- **One renderer.** `storefront-renderer` renders both the editor preview and the live store, reading design tokens from the theme package.
- **Server-priced checkout.** The browser never sends prices; the server prices the cart, reserves inventory and creates the Stripe PaymentIntent. See [checkout](../features/checkout.md).
- **Backend runs packed copies of the shared packages** (`backend/jelly-storefront-*-0.1.0.tgz`). See [shared-modules](../file-structure/shared-modules.md).

## Where the details live

- Frontend: [frontend-architecture.md](frontend-architecture.md)
- Backend: [backend-architecture.md](backend-architecture.md) and the long-form [../backend-architecture.md](../backend-architecture.md)
- Data: [database-architecture.md](database-architecture.md), [database-schema.md](database-schema.md)
