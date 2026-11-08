# Feature coverage

What exists in the code today, where it lives, and what does not exist yet. “Not built” means there is no implementation in the repository, not that it is hidden.

| Feature | Status | Frontend | Backend | Doc |
| --- | --- | --- | --- | --- |
| Merchant sign-in / sign-up | Built (Supabase Auth; Firebase and dev providers on the backend) | `app/login`, `app/signup`, `app/auth/callback`, `features/auth/` | `backend/src/auth/`, `tenants/routes.ts` (`/api/me`) | [authentication](../api/authentication.md) |
| Store creation / onboarding | Built | `app/onboarding`, `app/admin/onboarding` | `tenants/routes.ts` (`POST /api/stores`), `storefront/starter/` | [publishing](publishing.md) |
| Merchant dashboard | Built | `app/admin/page.tsx`, `components/app-shell.tsx`, `admin-nav.tsx` | `admin/` (`GET /api/stores/:storeId/admin-summary`) | [frontend-architecture](../architecture/frontend-architecture.md) |
| Product management | Built (products, variants, inventory, media, digital settings) | `app/admin/products/**`, `features/commerce/components/product-form.tsx` | `catalog/` | [product-management](product-management.md) |
| Collections | Built (list/create/update; no delete endpoint) | `features/commerce/components/product-category-picker.tsx`, editor resource pickers | `catalog/` | [product-management](product-management.md) |
| Categories / brands taxonomy | Not built as persisted data (UI helper only) | `features/commerce/components/product-category-picker.tsx`, `features/commerce/components/category-recommendations.tsx` | none | — |
| Theme selection, customization, editor | Built (Jelly Minimal, Jelly Avenue) | `features/store-editor/`, `app/admin/online-store/editor`, `app/admin/store-design` | `storefront/workspace/` | [theme-system](theme-system.md), [theme-editor](theme-editor.md) |
| Live storefront rendering | Built | `app/[storeSlug]/**`, `features/storefront/`, `packages/storefront-renderer` | `storefront/runtime/`, `storefront/context/`, `catalog/public-store.ts` | [theme-system](theme-system.md) |
| Store publishing | Built (immutable publications, active pointer) | `features/store-editor/components/publish-*.tsx` | `storefront/publication/`, `storefront/compiler/` | [publishing](publishing.md) |
| Cart and checkout | Built (server-priced, reservations) | `features/storefront/components/cart-panel.tsx`, `app/[storeSlug]/cart`, `checkout` | `commerce/` | [checkout](checkout.md) |
| Payments | Built for Stripe Connect (direct charges on connected accounts); no other provider | `features/commerce/components/payment-element-checkout.tsx`, `app/admin/payments` | `stripe/`, `commerce/payment-intents.ts` | [payment-system](payment-system.md) |
| Order management | Built, gated per store (off by default) | `app/admin/orders/**`, `features/commerce/` | `commerce/order-management.ts`, `merchant-order-routes.ts` | [order-management](order-management.md) |
| Email notifications | Built (outbox + SMTP/capture transport), gated per store | `app/admin/settings/notifications` | `commerce/notifications.ts`, `notification-*.ts` | [notifications-and-digital-delivery](notifications-and-digital-delivery.md) |
| Digital product delivery | Built (private files, tokenised downloads) | `features/commerce/components/digital-product-settings.tsx` | `commerce/digital.ts` | [notifications-and-digital-delivery](notifications-and-digital-delivery.md) |
| Customer accounts and management | Built (storefront accounts, wishlist, addresses; merchant customer list) | `app/[storeSlug]/account/**`, `features/customers/`, `app/admin/customers` | `customers/` | [customers](customers.md) |
| Content (pages, blogs, custom data, menus) | Built | `app/admin/content/**`, `app/admin/settings/custom-data`, `features/content`, `features/navigation` | `content/`, `custom-data/`, `storefront/workspace/menu-service.ts` | [theme-editor](theme-editor.md) |
| Domain management | **Not built.** A `StoreDomain` table exists but no backend code reads or writes it | — | — | — |
| Analytics | **Not built.** Only a dashboard summary (`admin-summary`) | `app/admin/page.tsx` | `admin/` | — |
| Transactional email beyond order notifications | Not built | — | — | — |
| Payment providers other than Stripe | Not built | — | — | — |
