# Jelly Shop project audit — 20 October 2026

Jelly Shop has a substantial MVP implementation, but it is not ready for public production traffic. The immediate priorities are database isolation, checkout correctness, and completing the migration from browser demo state to server-owned merchant data. Further visual polish should follow those repairs.

This report examines the current working tree, including uncommitted changes, both applications, shared storefront packages, SQL migrations, automated checks, and read-only metadata from the connected Supabase project. Findings distinguish directly observed configuration, code-path findings, and work that still needs an isolated runtime acceptance test. It is not a penetration test or certification of live Stripe payments. No application fixes, migrations, payments, publications, or access-rule changes were performed during this audit.

**Current architecture**

The frontend is a Next.js/React application in `jellyshops/`, with a merchant studio and public storefront routes. Shared packages provide schemas, section/block definitions, themes, and the storefront renderer. The Express/TypeScript backend in `backend/` runs locally or through a Firebase HTTP function. Supabase provides authentication, PostgreSQL, and configured image storage. Stripe Connect provides connected merchant accounts and server-owned payment processing.

There are two overlapping frontend state systems: authenticated merchant/store data from the backend, and the older `ShopProvider` repository persisted in browser local storage. Public catalog synchronization fills some of that local state, but merchant pages do not consistently use the same authoritative source. Several of the most important functional defects come from this split.

**Verification performed**

| Check | Current result |
|---|---|
| Frontend production build | Pass, using the configured Next build with an isolated `.next/project-audit` directory |
| Backend build | Pass |
| Frontend TypeScript | Pass |
| Backend TypeScript | Pass |
| Frontend tests | 411 passed, 13 failed; 100 test files, 9 failing files |
| Backend tests | 348 passed, 2 failed; 82 test files, 2 failing files |
| Frontend lint | 41 errors and 49 warnings |
| Connected Supabase project | `ACTIVE_HEALTHY` after the earlier restore |
| Database isolation | 40 public tables without RLS; anonymous SELECT/INSERT/UPDATE/DELETE privileges confirmed |
| Anonymous API reachability | A zero-row request to `StoreMembership` returned HTTP 200 using only the application's public anon key |

The database check returned no membership rows: the request used `limit=0`. Privilege inspection used metadata only. Production build success does not establish that user flows or deployment security are correct.

**What is already implemented**

| Area | Existing capability | Remaining qualification |
|---|---|---|
| Merchant access | Supabase session handling, signup/login, authenticated store discovery, store creation | Network errors and merchant-loading failures need explicit recovery states |
| Catalog | SQL-backed products, variants, inventory, collections, product configuration metadata | Merchant edit/archive/media flows still have local/server inconsistencies |
| Storefront templates | Fresh Market and Artisan Boutique starters, gallery, preview dialog, section/block controls, responsive preview | Advanced workspace operations and production acceptance remain incomplete |
| Editing | Queued draft saves, revisions, retry feedback, theme controls, shared-section editing | Conflict resolution, undo/history, and complete navigation protection need further work |
| Publication | SQL workspace generations, validation, preview compilation, immutable publications, active-publication pointer | Full merchant-to-public acceptance needs isolated browser verification |
| Content | Pages, blogs, articles, and SQL content repository | Editor polish and recovery flows need acceptance coverage |
| Commerce | Server price calculation, inventory reservations, checkout attempts, Stripe PaymentIntents, webhook processing | Currency, configuration transport, numbering, and shipping defects below must be fixed |
| Orders/customers | Merchant order views, fulfilment transitions, full refund support, customer summaries | Tests and real sandbox flows need stabilization |
| Payments | Connect onboarding/readiness, signed webhook routes, event deduplication, refund/dispute handling | Actual destinations, card configuration, scheduler, and deployment need verification |
| Media | Image validation, upload API, Supabase object-storage adapter | Metadata remains local JSON by default |
| Custom data | Metafield/metaobject contracts, services, validation, UI, and tests | Default server composition does not wire the full API |
| Deployment | Firebase HTTP entrypoint and deployment runbook | Fail-closed configuration and release automation are still needed |

**Release-blocking findings**

1. **Critical — public database access bypasses application authorization.** Supabase's Security Advisor reports 40 exposed public tables without RLS. Metadata confirms that `anon` has schema usage and SELECT, INSERT, UPDATE, and DELETE grants on them; `authenticated` also has broad access. A zero-row anonymous REST request to the membership table succeeds. Affected tables include `User`, `StoreMembership`, `Store`, `Order`, `Payment`, `Refund`, inventory, and storefront configuration. This permits direct access around Express membership checks, subject to table constraints and triggers. This audit does not establish that an intrusion occurred.

   First decide which tables are exclusively server-owned. Revoke browser-role access to those tables or remove them from the exposed schema, and enable RLS on exposed tables with narrowly scoped policies where browser access is actually required. Preserve access for the backend's trusted database role. Add anonymous and cross-tenant rejection checks. Simply hiding the public anon key is ineffective because the browser application must expose its public key. See [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and the [RLS-disabled advisor](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

2. **High — order-number generation has only 256 possible values per store.** `backend/src/commerce/service.ts:603` derives the number from `orderId.slice(0, 8)`, while the ID starts with `order-`. That leaves only two hexadecimal UUID characters. For example, both `order-aa111111` and `order-aa222222` become `ORDER-AA`. The database enforces uniqueness on `(storeId, number)` in `backend/sql/migrations/20260915120000_add_stripe_connect_commerce.sql:36`, so a collision can fail checkout. Use a concurrency-safe sequence or sufficiently large unique reference and handle collisions explicitly.

3. **High — checkout trusts the requested currency.** The public route accepts any three-character currency, and the checkout service copies it into orders and payments without comparing it with the store's currency or a server-owned per-currency price. Catalog prices are then reused as minor-unit numbers in that chosen currency. The amount must be bound to a server-owned currency and pricing model. Evidence: `backend/src/commerce/routes.ts:14`, `backend/src/commerce/service.ts:34`, and the order/payment insertion paths starting around line 575. This is a code-path finding; no real charge was made.

4. **High — the HTTP checkout route discards product configuration selections.** `backend/src/commerce/routes.ts:7` allows only `variantId` and `quantity` for each line. The service expects `configurationSelections` at `backend/src/commerce/service.ts:40`, and the frontend contract includes that field. The route's Zod parsing strips the omitted field before calling the service. Required options can therefore fail validation; optional paid selections can lose their pricing and order snapshot. Align the route schema with the service contract and test the complete HTTP path with required options and price adjustments.

5. **High — product management uses conflicting local and server records.** The product list reads backend data, but `jellyshops/src/app/admin/products/[id]/page.tsx:16` finds the product only in the browser repository. A direct edit URL or a fresh browser can show a real server product as missing. Archive at line 39 changes only local state. `jellyshops/src/components/product-form.tsx:71` saves locally before the server call and ignores the returned canonical product/variant IDs, while the backend generates its own IDs. Failed server writes leave local records behind. The image URL is also absent from the API payload. Load, save, and archive through the authenticated catalog API, update local caches from returned records, and implement durable product-media attachment.

6. **High — Settings does not update the authenticated merchant store, and checkout always charges zero shipping.** `jellyshops/src/app/admin/settings/page.tsx:9` selects the old local repository store and its form writes only `repository.saveStore`. Runtime local state still begins with demo store identities (`jellyshops/src/lib/seed.ts:142`). This can edit a demo record rather than the active merchant's persisted store. Independently, `backend/src/commerce/service.ts:385` hardcodes `shippingMinor = 0`. Implement a store-scoped settings API and calculate shipping from persisted rules on the server. Until that is connected, the UI must not imply shipping configuration controls checkout.

7. **High — several default workspace APIs are placeholders.** `backend/src/app.ts` returns an empty menu list at line 707 and echoes menu mutations at lines 715/722. Preset creation and instantiation at lines 696/703, template cloning at line 606, and template assignments at lines 780/784 are also incomplete. `getGlobalSection` at line 645 always returns null, although list/update persistence exists. The default router uses this API at line 1161. Implementations in service modules and unit tests do not make these default handlers durable. Wire them to SQL transactions, tenant checks, revision checks, and generation updates; test that changes survive reload and process restart.

8. **High — image metadata is still filesystem-backed in the default cloud composition.** `backend/src/app.ts:1350` creates `LocalJsonMediaRepository` even when image bytes use Supabase Storage. `backend/src/media/service.ts` must find that metadata to serve a public media URL. A new or different Firebase instance can lose visibility of uploaded images, and concurrent JSON writes can conflict. Persist metadata in the SQL `Media` table and use a coherent product/storefront reference model. Confirm an uploaded image survives an instance restart and reads from multiple instances.

**Other confirmed gaps and improvements**

| Priority | Finding | Required next step |
|---|---|---|
| High | `CatalogPostgresRepository.getProduct` searches only the first 100 listed products (`backend/src/catalog/postgres-repository.ts:33`). A valid ID after that boundary becomes missing. | Query directly by `(storeId, id)`; test a catalog larger than 100 items. |
| High | Firebase configuration defaults `NODE_ENV` to development (`backend/src/functions.ts:22`); config also defaults auth to development when omitted. The existing production rejection only applies if production mode is explicitly set. | Make deployed startup fail closed when production auth/configuration is missing; keep emulator behavior explicit. This is a deployment risk, not evidence that a live function currently uses demo auth. |
| Medium | PostgreSQL connections disable certificate verification (`backend/src/database/client.ts:7`). Local backend CORS also allows all origins. | Configure trusted certificates and production origin allowlists; validate deployed values. |
| Medium | Merchant API errors become an empty store list (`jellyshops/src/features/auth/auth-provider.tsx:83`), and the auth gate treats no stores as onboarding. | Distinguish loading, failure, and confirmed empty results; provide retry and preserve existing store state appropriately. |
| Medium | Full custom-data routes mount only when three injected services exist (`backend/src/app.ts:1080`), but the default app does not compose them. | Supply SQL repositories/resolvers and wire the UI-to-API-to-compiler path. Currently only a built-in fallback dynamic source is provided. |
| Medium | Production card-only payment configuration is documented as required but remains optional in config. A fresh backend test fails on this requirement. | Resolve the product contract, enforce the chosen configuration, and verify actual sandbox payment methods. |
| Medium | Dashboard date, greeting, setup completion, and readiness copy are hardcoded; the metrics label still says “Total mock sales” (`jellyshops/src/app/admin/page.tsx:47`, `:88`, `:133`). | Derive identity/date and setup completion from real store, publication, shipping, product, and payment state. |
| Medium | Admin/editor product clients request only the first 100 products and do not expose cursor pagination. | Implement pagination and server search so larger catalogs remain manageable. |
| Medium | Public checkout creation/payment-preparation routes have no endpoint rate limiter in `backend/src/commerce/routes.ts`, while order lookup and media upload do. | Add appropriate per-store/IP/cart limits and line-count bounds; test reservation abuse and recovery without blocking normal checkout retries. |
| Medium | Packages use numerous `latest` declarations, and the backend consumes packed `.tgz` copies of shared packages while build scripts rebuild source packages separately. | Pin deliberate versions and make package publication/consumption reproducible so frontend/backend contracts cannot silently drift. |
| Medium | No checked-in CI workflow was found. Frontend environment configuration is tracked and points to a specific local Firebase emulator URL. README descriptions still describe older demo auth and filesystem behavior. | Add release gates and environment-specific configuration; rewrite local/staging/production setup documentation to match the actual auth/API/storage architecture. |
| Improvement | Public product/content pages render primarily through client effects, with only global site metadata found. Images are globally unoptimized. | Add product/store metadata, social cards, structured data, sitemap/robots, server-rendered storefront content where appropriate, and a measured image delivery strategy. |

The Supabase security advisor additionally reports two functions with mutable search paths, disabled leaked-password protection, and one legacy table with RLS enabled but no policy. Review the [function search-path advice](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). These do not replace fixing public table access.

The performance advisor reports six unindexed foreign keys, one table without a primary key (`StripeConnectedAccount`), and 27 unused indexes. Assess foreign-key indexes and stable account identity first. Do not delete indexes merely because they are unused on a low-traffic/restored project. See the [foreign-key index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) and [primary-key advisor](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key).

**Tests that remain red**

Frontend failures are in nine files: `src/app/page.test.tsx`, `src/lib/repository.test.ts`, `packages/storefront-schema/src/schema.test.ts`, admin orders list/detail, admin payments, new-product creation, `merchant-payments-panel.test.tsx`, and `order-payment-panel.test.tsx`. Several are missing auth-provider fixtures or outdated UI assertions; the unsupported-theme schema failure is a contract issue that needs a deliberate decision. They should not all be dismissed as harmless test drift.

Backend failures are `src/config.test.ts` (missing production card-method-configuration enforcement) and `src/stripe/accounts/service.test.ts` (a readiness test reaches account synchronization without a matching local account fixture). The fresh run passes the SQL shared-section test and the previously environment-sensitive HTTP tests.

Lint includes a real conditional-hook violation in the legacy inspector, render-time ref writes, effect-state errors, navigation rules, unsafe types, and generated files included in lint scope. Repair source issues and exclude generated output appropriately rather than disabling the rules globally.

Raw JSON results, lint output, and build/typecheck logs are saved in the task's `project-audit-2026-10-20` artifact directory. Browser end-to-end tests that create merchants, publish, refund, or change Stripe state were not run against the live project during this read-only audit.

**Recommended repair order**

1. Contain direct database access. Define and test server-only tables versus intentionally public data; verify anonymous and cross-store rejection.
2. Repair checkout currency, option transport, order numbering, and shipping. Add focused HTTP/database integration checks around those exact failures.
3. Make merchant products, media, settings, and taxonomy consistently server-owned. Verify create → reload → edit → archive from a second browser.
4. Finish durable menus, presets, cloning, assignments, and custom-data composition. Verify revisions, generation changes, and process-restart persistence.
5. Clear the full test/lint failures, pin dependencies, align package builds, and add CI. Harden production startup, database TLS, CORS, secrets configuration, readiness checks, and deployment documentation.
6. In an isolated staging/Sandbox environment, exercise signup → store creation → template selection → product with paid options → publication → purchase → signed webhook → inventory update → fulfilment → refund. Verify reservation expiry with an actual scheduler and concurrent checkout against PostgreSQL. Confirm two-store isolation throughout.
7. Improve usability and growth features: honest setup checklist, loading/error recovery, editor undo/history/conflict recovery, accessible keyboard workflows, storefront SEO, images, and performance measurements. Decide separately whether transactional email, tax calculation, shipping integrations, discounts, team invitations, and custom domains belong in the next release; they are not complete capabilities established by this audit.

The next implementation task should be database isolation. The next product flow to repair should be merchant catalog management and the checkout contract. The recent template redesign is useful progress, but the remaining release risk is mainly data ownership, security, and integration correctness.
