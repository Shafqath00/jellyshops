# Frontend architecture

Location: `jellyshops/`. Next.js 16 App Router, React 19, Tailwind 4, Vitest + Testing Library, Playwright (`jellyshops/e2e`). Next.js here has breaking changes; read `jellyshops/node_modules/next/dist/docs/` before using Next APIs.

Full file list with imports/importers: [frontend-file-map](../file-structure/frontend-file-map.md). Function signatures: [frontend-functions](../functions/frontend-functions.md).

## Layers

| Folder (under `jellyshops/src`) | Responsibility |
| --- | --- |
| `app/` | Routes, layouts and pages (thin; most logic sits in `features/` or `components/`). |
| `app/admin/**` | Merchant admin: home, orders, products, customers, payments, online store + editor, content (pages, blogs, metaobjects), settings (incl. custom data, notifications), store, onboarding. |
| `app/[storeSlug]/**` | Public storefront routes: home, shop, collections, products, cart, checkout, order status (`order/[publicToken]`, `.../balance`), account (login, register, recover, orders, addresses), search, wishlist, contact, blogs, information pages, catch-all 404. |
| `app/login`, `signup`, `onboarding`, `auth/callback` | Merchant sign-in, sign-up, store creation, Supabase auth callback. |
| `app/theme-preview/*` | Store-less theme review pages (`jelly-minimal`, `jelly-avenue`). |
| `app/themes/*.css` | Per-theme CSS scoped by `[data-jelly-theme="…"]`. |
| `features/` | Feature code: `auth`, `admin` (admin API + query hook), `commerce` (order/payment API client and panels), `content`, `customers` (storefront customer accounts, wishlist), `navigation` (menu editor), `store-editor` (visual editor), `storefront` (loading published storefront documents and page contexts), `theme-preview`. |
| `components/` | Shared and legacy components: admin shell and nav, product form, cart panel, storefront shell, `ui/` (shadcn-style primitives), `jelly/` (storefront primitives). |
| `contexts/shop-context.tsx` | `ShopProvider`: client state for the legacy shop repository (cart, local seed data). |
| `lib/` | `domain.ts` (types and domain helpers), `repository.ts` (legacy localStorage repository, key `jelly-shop-state-v1`), product variant/configuration helpers, `utils.ts` (`cn`). |
| `jellyshops/packages/*` | Shared workspace packages (see [shared-modules](../file-structure/shared-modules.md)). |

## Providers

`app/layout.tsx` wraps everything in `AuthProvider` (Supabase session, merchant stores, active store) and `ShopProvider` (legacy cart/repository state). It loads theme stylesheets (`storefront-base`, `jelly-minimal`, `jelly-avenue`, `shadcn-theme`) and self-hosted fonts.

## Data flow

- **Merchant screens** call the backend with the Supabase access token as a Bearer header through `features/admin/api.ts`, `features/commerce/api/client.ts`, `features/store-editor/api/client.ts`, `features/content/api.ts`, `features/navigation/api.ts`. The base URL is `NEXT_PUBLIC_STORE_EDITOR_API_URL` (default `http://localhost:3001`).
- **Storefront pages** load the active publication and page context from public endpoints (`features/storefront/public-storefront-api.ts`, `public-page-context-api.ts`, `server-storefront.ts`; base URL `STOREFRONT_API_URL`, falling back to `NEXT_PUBLIC_STORE_EDITOR_API_URL`).
- **Editor** keeps an in-memory document with commands, history and autosave (`features/store-editor/model`, `state`), previews through the same renderer as the live store, and talks to `/api/stores/:storeId/storefront/*`.
- **Cart** is still stored in the browser (legacy repository); checkout sends the cart to the server, which prices it. See [checkout](../features/checkout.md).

## Conventions to keep

- Storefront CSS reads tokens (`--theme-*`, `--store-*`, `--jm-*`, `--av-*`), never hard-coded colours.
- Global element rules go inside `@layer base` (Tailwind 4: unlayered CSS beats utilities).
- The full-screen editor is portalled to `<body>` (the admin shell's animation creates a stacking context).
- Header/footer store name and logo come from `withStoreIdentity()` in the renderer package for both preview and live.
- Use `isCompleteStorefrontTheme()` / `COMPLETE_STARTER_PACK_IDS` instead of hard-coding theme ids.

## Known structural issues

See [dead-code-and-structure](../reports/dead-code-and-structure.md): files over 500 lines (editor `page.tsx`, `product-form.tsx`, inspector controls), one import cycle in `features/auth`, and several components with no importers outside tests.
