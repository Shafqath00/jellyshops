# Backend architecture

Location: `backend/`. Express 5 + TypeScript (ESM, `.js` import suffixes), raw `pg` against Supabase Postgres (no ORM), Stripe Connect, Zod validation, Vitest. The long-form guide is [../backend-architecture.md](../backend-architecture.md); this page is the map.

Full file list: [backend-file-map](../file-structure/backend-file-map.md). Functions: [backend-functions](../functions/backend-functions.md). Endpoints: [endpoints](../api/endpoints.md).

## Entry points

| File | Role |
| --- | --- |
| `src/server.ts` | Local process entry (`PORT`, default 3001). Builds config, DB pools, workers. |
| `src/functions.ts` | Firebase Functions entry (`api` function; see [deployment](../development/deployment.md)). |
| `src/app.ts` | `createApp(deps)`: Express composition root. Wires services, mounts routers, error handler. Dependencies are injectable for tests. |
| `src/config.ts` | Environment parsing into `AppConfig`. |

## Module layout (`backend/src`)

The backend is organised by domain folder, each following `routes → service → repository → SQL` where the domain is big enough to need it.

| Folder | Domain |
| --- | --- |
| `auth/` | `AuthProvider` implementations (Supabase, Firebase, development), `requireMerchant`, `requireStorePermission`, role→permission table. |
| `tenants/` | Stores, memberships, `StoreRequestContext`, store settings, `/api/me`. |
| `catalog/` | Products, variants, collections; public store lookup; demo catalog. |
| `content/` | Information pages, blogs, articles, menus content. |
| `custom-data/` | Merchant-defined data definitions/values. |
| `dynamic-sources/` | Bindings from sections to dynamic data. |
| `media/` | Upload, validation, storage providers (local, Supabase, GCS) and records. |
| `storefront/` | Workspace (draft), compiler, publication, runtime snapshots, starter install, context loaders. |
| `commerce/` | Checkout, payment intents, inventory reservations, orders, fulfilment, refunds, order management, notifications, digital delivery, rate limits, sweeper. |
| `stripe/` | Stripe gateway client, Connect accounts, webhook routes and processor. |
| `customers/` | Storefront customer accounts, addresses, wishlist, engagement. |
| `admin/` | Platform-admin routes. |
| `audit/` | Audit events. |
| `database/` | Pool/transaction helpers. |
| `http/` | `ApiError` and error mapping. |

## Request lifecycle (merchant route)

1. `requireMerchant(authProvider)` reads `Authorization: Bearer …` and sets `request.merchant`.
2. `requireStorePermission("orders:view")` builds `request.storeContext` ({storeId, userId, role}) or throws 404/403.
3. The handler validates input with Zod, calls a service with `storeContext.storeId`.
4. The service applies rules and calls a repository; every SQL statement filters on `"storeId"`.
5. Errors are thrown as `ApiError(status, code, message)` and mapped by the error middleware.

## Background / scheduled work

- `POST /internal/commerce/reservations/sweep` (`commerce/sweeper-routes.ts`) releases expired inventory reservations; intended for a scheduler holding `SCHEDULER_SECRET`.
- `POST /internal/commerce/orders/work` (`commerce/order-runtime.ts`) runs the order operation/notification worker.

## Shared packages

Schema, registry and themes come from `@jelly/storefront-*` tarballs; rebuild them with `node scripts/prepare-shared-packages.mjs` and reinstall (see [shared-modules](../file-structure/shared-modules.md)).

## Known structural issues

`app.ts` is ~1,700 lines because it composes every module; several commerce/stripe files exceed 500 lines. See [dead-code-and-structure](../reports/dead-code-and-structure.md).
