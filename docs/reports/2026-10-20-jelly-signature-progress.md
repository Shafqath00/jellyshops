# Jelly Signature implementation ledger

Specification: the Jelly Signature plan approved in this conversation, 2026-10-20.

## Constraints and decisions

- Preserve the existing uncommitted MVP/editor implementation.
- Cream/navy/pink Signature theme, 1280px default width, shared storefront tokens, protected checkout/account controls.
- Store-scoped customer accounts, addresses, orders and wishlists; consent-based newsletter capture and contact enquiries.
- Existing server-priced domestic checkout and Stripe Connect remain authoritative.
- Staging only. No Vercel login, production deploy, production migrations or live payment activation. Deployment remains pending.

## Implemented in this work

- Registered and versioned the Jelly Signature theme and starter pack; extended shared page schemas and render support to 19 page types. Existing starter themes and publications remain supported.
- Added cream/navy/pink design controls and shared header/footer, announcement, responsive navigation, account/wishlist/cart access, and reusable home/catalog/product/storefront content.
- Added collection pagination and server-side catalog filters/sorts, product category/availability/price/variant filters, product specifications, compare-at prices, currency-aware editing, and persisted collection memberships.
- Added store-scoped customer identity and services, private profile/address/order/wishlist routes, guest wishlist merge, newsletter subscriptions/unsubscribe/export, contact enquiries, and a merchant inbox.
- Added additive customer/media/commerce schema migrations, runtime permission restrictions, foreign-key indexes, and stable connected-account identity. Applied the approved additive migrations to isolated staging project `jellyshop-staging` (`ayvpxqwleurhkfyujzlu`).
- Updated settings, shipping copy, product detail, collection/search experiences, legal/support draft pages, editor page selection, and the contact/newsletter/account route shells.
- Repacked shared storefront dependencies for backend consumption. Added signup callback handling and fixed an initial collection renderer failure state.

## Verification completed

- Frontend type check: passed.
- Backend type check: passed.
- Frontend test suite: 107 files, 434 tests passed.
- Backend test suite: 92 files, 382 tests passed.
- Frontend production build: passed, including all new public customer and engagement routes.
- Backend production build: passed.
- Frontend ESLint: 0 errors, 38 warnings remain.
- Staging Supabase security advisor: no findings. The prior missing foreign-key index and connected-account primary-key findings are cleared. Performance advisor reports 43 unused-index notices on the nearly empty staging database; evaluate after workload.
- Staging migration history contains the core bootstrap, runtime role, Signature customer services and commerce index/account identity migrations.

## Release-blocking work still outstanding

- Persist categories and brands in authenticated server-owned tables/APIs; current catalog persistence does not yet provide durable taxonomy management.
- Finish every editor operation and page-specific preview for Signature checkout/customer pages, dynamic sources, installation/replacement UX, conflict recovery and publish validation. Run complete editor reload/concurrency/publication acceptance scenarios.
- Add end-to-end email verification/recovery and Stripe sandbox purchase, refund, inventory concurrency, failed payment and webhook checks. Staging email and Stripe sandbox prerequisites are still required.
- Complete responsive and keyboard visual review at 360/375/768/1024/1440px; validate Core Web Vitals, approved media origins, image optimization and public metadata/canonical/sitemap behavior.
- Resolve or deliberately accept the remaining 41 lint warnings, then rerun lint.
- Perform isolated staging merchant-to-customer lifecycle, backup/restore and deployment-environment checks. No production access or deployment was attempted.

The local build and automated suites are green, but this ledger does not represent release readiness. Production rollout, live payment activation and production migrations remain pending by explicit instruction.
