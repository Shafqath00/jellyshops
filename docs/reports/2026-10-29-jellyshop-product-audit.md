# Jellyshop product audit and development roadmap

**Audit date:** 29 October 2026 (Asia/Kolkata). **Decision:** do not launch unrestricted paid merchant onboarding yet. A controlled pilot is feasible after the payment, inventory, publication and release gates below are closed.

**Audited baseline:** Git HEAD `283635ef1347993666b061885a905dc774ca276e` **plus the existing modified and untracked working tree**. This distinction matters: much of the current admin/product work is not committed. Findings describe this checkout, not a deployed release or `main`.

## 1. Executive assessment

Jellyshop is a substantial commerce MVP with a real backend, not merely a storefront mockup. It has merchant identity, store provisioning, tenant-scoped catalog APIs, product variants/configuration/add-ons, inventory reservations, Stripe Connect, payment webhooks, order operations, customer accounts, content, media, reusable sections, an editor, and compiled publications. The shared schema/registry/renderer design and explicit draft-to-publication boundary are strong foundations worth retaining.

It is **not yet a complete commercial e-commerce SaaS**. Four reproduced defects undermine transaction or publication integrity: replacing a checkout can cancel a still-pending local order after Stripe succeeded; reservation cleanup can strand stock after a partial failure; replaying an old publish key reactivates an older publication; stale cart lines cannot be removed through the repository. Additional source-verified issues include the first-100-products hydration overwrite, local-only store appearance saves, nonfunctional footer signup, preset ID collisions, and incomplete template/runtime parity.

There are also product gaps that cannot be solved by polishing the dashboard: a tax calculation engine, promotion engine, custom-domain provisioning, merchant subscription billing/entitlements, operational recovery evidence, a functioning staff-membership lifecycle, and production deployment verification. Stripe **customer payments** are implemented; they are not merchant **SaaS subscription billing**.

Recommendation: first become dependable for one deliberately limited merchant segment, country/currency/payment setup and theme pair. Expand only after proving the whole transaction and recovery lifecycle. Attempting broad Shopify parity before transactional correctness will increase both cost and merchant risk.

### Evidence conventions

- **R — reproduced:** a fresh command, assertion or isolated probe exercised the behavior during this audit. Mocked-I/O probes establish application control flow, not a live Stripe/database incident.
- **S — source verified:** a concrete connected implementation path supports the finding; a browser or production reproduction was not performed.
- **V — verification required:** deployment state, external service behavior, operational practice or an inferred concurrency risk needs additional evidence.
- **G — gap:** no complete supported workflow was found in the audited source/routes/schema. This is scoped to this checkout, not a claim about private systems outside it.

“Fully implemented and working” below means a bounded capability supported by source and the stated fresh checks. It never means that every external dependency, device, store configuration or failure mode has been certified.

### Fresh validation results

Logs and reproduction programs are in [audit-2026-10-29](audit-2026-10-29/).

The [source inventory](audit-2026-10-29/source-inventory.json) records paths and SHA-256 hashes for 863 source/test/schema/workflow files at handoff, excluding environment and credential files. It identifies the working-tree evidence baseline; it is not a claim that all 863 files were individually inspected.

| Check | Observed result | Interpretation |
| --- | --- | --- |
| Frontend TypeScript | Exit 0, `tsc --noEmit --incremental false` | Type consistency passes; does not establish correct journeys. |
| Frontend unit/component suite | **163 files, 853 tests passed** | Fresh complete run after redirecting TEMP/TMP into the workspace. |
| Frontend default lint | **146 errors, 230 warnings** | Includes a stale generated build directory outside the configured `.next/**` ignore. |
| Frontend source/config-only lint | **10 errors, 62 warnings** | Real source problems remain after excluding generated noise. |
| Frontend optimized build | **Passed**, 31 static pages generated, dynamic storefront routes built | Successful outside sandbox; isolated output `.next/audit-build-open`. |
| Backend typecheck/build | **Both passed**, fresh build exit 0 (`backend-build-verified.log`) | Source and packaging checks do not validate external configuration. |
| Backend unit suite with local HTTP access | **121 files: 120 passed, 1 failed; 627/628 tests passed** | Digital-download concurrency test fails at `notifications-digital-db.test.ts:53`: zero successful downloads where one is expected. Root cause not established. |
| Backend integration, finally isolated from credentials | **9 files: 7 passed, 2 failed; 37/39 tests passed** | Reset dependency assertion omits `InventoryAdjustment`; media assertion expects original PNG bytes despite deliberate re-encoding. The tested media upload/read succeeds after isolation. See BE-12/14/15 and validation notes. |
| Checkout/inventory probes | **Two assertions reproduced defects** | Real cancellation/sweeper functions; mocked database/Stripe, no real charge or shared DB changes. |
| Publication replay probe | **Reproduced older publication activation** | Real publication service; in-memory persistence. |
| Stale-cart probe | **Reproduced failed removal** | Real repository with memory storage. |
| Browser/device journey | **Not completed** | In-app browser attachment timed out twice; sandbox preview was unreachable; the fallback browser was in active user use. No valid application screenshots accepted. |

Initial Vitest runs failed before collection with temporary-file EPERM errors. Local TEMP/TMP fixed that. Initial backend HTTP test errors were sandbox connection restrictions; they must not be represented as 150 product defects. Build initially stalled inside the sandbox and passed in a normal local process. Do not use historical root `*.log` files as current proof.

No real payment, email send, deployment, migration or push was intentionally performed, and no live credential values are included. **Correction to the initial read-only assumption:** the integration suite lacked the unit environment scrubber and could instantiate a developer-configured database dependency. Its media test returned SQL foreign-key error `23503` for synthetic store `store-a`; the attempted insert failed. That run is not evidence of successful media persistence and no successful shared-data mutation was observed. It is also not sufficient to certify that every preceding test made zero shared queries. The final rerun disabled dotenv loading and scrubbed service credentials before test imports. This safety gap is BE-14. Real merchant login, Stripe sandbox settlement, email delivery, private storage, production RLS, backups and load limits remain unverified.

## 2. Scores and scoring basis

These are **evidence-based engineering maturity scores**, not measured uptime, Core Web Vitals, security certification or competitor benchmarks. Each dimension has five criteria scored **0 absent/unproven or materially blocked; 1 implemented with gaps; 2 coherent implementation with relevant passing verification**. The sum is out of 10. Unknown production evidence receives no production credit rather than being assumed broken.

| Dimension | Five criterion scores | Total | Evidence supporting deductions and credit |
| --- | --- | --- | --- |
| Frontend quality | architecture 2; state correctness 1; commerce UX 1; accessibility/device evidence 0; checks 1 | **5/10** | Feature/workspace organization and 853 passing tests; FE-01–04, lint errors; no completed device audit. |
| Backend quality | layering 2; contracts 2; transaction correctness 1; recovery 0; checks 1 | **6/10** | Express composition/repositories, validation/tenant checks; BE-01–03 and digital failing test. |
| Template builder | authoring 1; reuse 1; draft/publish integrity 1; parity 1; durable history 0 | **4/10** | Working source workflows but TB-01–08; session history only, missing block lifecycle/rollback. |
| Security | identity/route authorization 2; input/media/payment controls 2; production isolation evidence 0; hardening 1; operations assurance 0 | **5/10** | Verified tokens, scoped queries, signatures, restricted images; broad runtime DB role, no production attestation, no restore/incident evidence. |
| Performance | server rendering 1; catalog strategy 0; media 1; caching 1; measured budgets 0 | **3/10** | SSR exists but reads whole catalog and repeats hydration fetch; global image optimization disabled; no load/CWV measurements. |
| Scalability | tenant model 1; durable data 1; job recovery 1; resource bounds 1; scale tests 0 | **4/10** | Store IDs/SQL/queues/pool limits exist; API relies on store predicates, sweeper defect, whole catalog reads, no representative load tests. |
| Feature completeness | catalog 2; transaction lifecycle 1; authoring/content 1; growth/fulfillment 1; SaaS business layer 0 | **5/10** | Catalog depth is substantial; tax/promotions/billing/domains/integration ecosystem incomplete. |
| Overall readiness | buildability 2; money/data safety 0; merchant launch journey 1; operations 0; release validation 0 | **3/10** | Production frontend build passes, onboarding exists; P0 checkout flaw and incomplete external/operational gates block general release. |

The low performance score reflects inefficient source paths and missing measurement, not an invented latency result. The UI score deliberately excludes subjective visual quality that could not be inspected.

## 3. Architecture, organization and frontend quality

### Current structure

`jellyshops/` is Next.js 16.3.3, React 19, TypeScript and Tailwind 4. There are **56 `page.tsx` entry points** spanning marketing/auth/onboarding, merchant admin, storefront/catalog, customer accounts, checkout/order tracking and two public theme previews. `src/app` owns routes/layout/styles; `src/features` holds domain code; `src/components/layout` is the admin shell; `src/components/ui` supplies primitives; `src/contexts` and `src/lib` hold the browser commerce repository and shared domain helpers.

Five packages split schema, registry, themes, renderer and UI. Backend consumption of packed schema/registry/theme copies is a deployment seam, not a single live workspace dependency. Frontend state spans Supabase auth/provider state, API-backed merchant queries, a localStorage commerce repository, and the editor's local draft/save/history queues. This layering supports incremental development, but duplicate authorities now cause observable inconsistency.

Public storefront layout loads server data, initializes the browser repository, then mounts another catalog refresh. The server correctly follows catalog cursors; the client refresh does not. Published templates, frame chrome, route bindings, browser cart and current theme are also resolved in different places. Consolidating these paths is more urgent than moving folders again.

Sources: `jellyshops/src/app/[storeSlug]/layout.tsx:18`; `src/contexts/shop-context.tsx:15-26`; `src/features/storefront/server-storefront.ts:13-62`; `src/features/storefront/components/storefront-frame.tsx:28-70`; `src/features/commerce/components/storefront-catalog-sync.tsx:50-120`.

### Frontend and commerce findings

| ID | Priority / evidence | Affected source | Technical finding and recommended solution |
| --- | --- | --- | --- |
| FE-01 | **P1 / S** | `features/commerce/api/client.ts:172-175`; `components/storefront-catalog-sync.tsx:60,98`; `[storeSlug]/layout.tsx:18` | Client fetch requests only `limit=100`, ignores `nextCursor`, then replaces the entire catalog after server bootstrap. Products beyond the first page disappear from repository-backed behavior after hydration. Paginate or remove the redundant refresh; preserve all valid bootstrap products. Test 101+ products through hydration, direct product URL, cart and search. |
| FE-02 | **P1 / R** | `src/lib/repository.ts:350-359`; storefront cart/checkout render paths | `updateCartItem` requires the variant to exist before allowing quantity zero. Removed/archived/unloaded variants leave stale cart items; cart/checkout filters them from visible lines, while checkout submits `cart.items`. Add unconditional line removal before variant lookup and reconcile unavailable items with an explicit shopper message. Audit probe reproduces the removal exception. |
| FE-03 | **P1 / S** | `src/app/admin/store/page.tsx:10-13`; `src/contexts/shop-context.tsx` | Store appearance chooses legacy `state.activeStoreId` and saves only `repository.saveStore`, including a published flag. It does not persist the authenticated store's workspace or activate a publication, yet says “Storefront updated.” Replace/redirect this route to the canonical editor/settings APIs. This is a false-success/state-authority bug, not demonstrated cross-tenant backend access. |
| FE-04 | **P1 / S** | `[storeSlug]/checkout/view.tsx:22,40,48`; `src/lib/repository.ts` | Prepared payment leaves customer/address inputs editable while hiding the submit action. Edits no longer update the frozen attempt. The visible summary uses local cart snapshots rather than returned authoritative order totals. Freeze/review prepared data or invalidate/requote on edits and display server totals. Test address and price changes between prepare and confirmation. |
| FE-05 | **P2 / S** | `checkout/view.tsx:48`; `src/lib/repository.ts:341-369`; order route | Success callback redirects; no completed-cart clearing/rotation operation was found. Cart persists after purchase. Clear the exact purchased cart/version only after server-confirmed success; retain new items added during payment and support redirect-return recovery. |
| FE-06 | **P2 / R** | `eslint.config.mjs:8`; fresh lint logs | Default lint traverses an older generated output; 146 errors reduce to 10 source errors when scope is restricted. Ignore all chosen output directories, then fix the real ref/effect/purity/memoization violations. Do not blanket-disable rules. |
| FE-07 | **P2 / S** | `server-storefront.ts:17-58`; `next.config.ts:20`; catalog sync | Every storefront bootstrap reads every product/collection with `cache:no-store`; hydration repeats API work and localStorage rewrites. Cost and payload grow with catalog size. Load route-specific data and paginated listing results; cache immutable publication resources separately from mutable stock/price. Measure before setting capacity promises. |
| FE-08 | **P2 / S** | `next.config.ts:20-27`; renderer/UI image components | `images.unoptimized=true` and multiple raw `<img>` paths bypass a consistent responsive image strategy. Media processing exists, so do not label all media unoptimized; audit which variants reach each renderer, add sizes/srcsets/CDN caching and verify image-byte/LCP budgets. |
| FE-09 | **P2 / S** | `admin/service.ts:49-61,95-115` | Dashboard revenue sums order totals for paid payments, while customer aggregates group by email **and name**. Same email with changed names can appear twice; refunds are not a net-revenue ledger. Define gross/net metrics and customer identity; use ledger/refund-aware aggregates and stable identity. Guard integer aggregate overflow as volume grows. |
| FE-10 | **P2 / V** | content/admin pages; storefront renderer/theme CSS | Responsive and accessibility intent is present (labels, status messages, keyboard sorting, breakpoints), but no accepted browser evidence exists for desktop/tablet/mobile, focus, zoom, contrast or touch. A complete visual/a11y verdict would be unsupported. Execute the explicit matrix in section 10. |

The 10 source lint errors include balance-page `Date.now()` during render, refs during order-detail render, effect state updates, memoization dependencies, and repository `this` aliasing. See `frontend-lint-source.log` for exact locations. These are release-check failures; not all imply a customer-visible failure by themselves.

No sweeping folder rewrite is recommended. Refactor around authoritative state, bounded data loading, shared API transport/error conventions, smaller editor/order controllers, and removing reachable legacy behavior. The checkout file contains an unused local confirmation branch (`setOrder` is unused); retire it once the server-confirmed path has coverage.

## 4. Backend, database, security and operations

### Current architecture and business logic

`backend/` uses Express 5, TypeScript, Zod, raw `pg`, Supabase identity/storage and Stripe. `src/app.ts` composes dependencies, middleware and route modules. Merchant routes use `requireMerchant` and `requireStorePermission`; services/repositories receive a store ID. Public routes expose catalog/content/checkout/order/customer operations. Stripe webhooks mount before JSON parsing to preserve signed bytes. Firebase Functions wraps the same Express application and exports a scheduled order worker.

Catalog supports products, variants, configurable options/add-ons, collection/category filtering, inventory adjustments/history, media, SEO and shipping metadata. Checkout re-prices from the catalog, validates option selections, snapshots the purchase and reserves inventory. Order management adds revisions, transactions, operation jobs, shipments, refunds, public tracking, invoices, notification outbox and gated digital delivery. These are real implementations that require completion and reliability work rather than replacement.

### Database relationships and isolation

Principal groups: `User`, `Store`, `StoreMembership`, `StoreSettings`, `StoreDomain`; `Product`, `ProductVariant`, `InventoryLevel`, `InventoryReservation`, `InventoryAdjustment`, `Collection`/`CollectionProduct`, `Category`/`CategoryOptionTemplate`, `Media`/`ProductMedia`; `Order`, `OrderItem`, `Payment`, `Refund`, `CheckoutAttempt`, `StripeConnectedAccount`, `StripeWebhookEvent`; order revisions/events/transactions/operations/shipments; customer/profile/address/wishlist/newsletter records; pages/blogs/articles; `StorefrontWorkspace`, templates/assignments/globals/presets/menus/theme config/publications; metafield/metaobject definitions and values; notifications/digital assets/entitlements/download attempts.

Store-scoped queries and composite relationships are a useful isolation foundation. However, the runtime `jelly_backend` role has an RLS policy `USING(true) WITH CHECK(true)` across permitted tables. **It does not enforce a per-request tenant boundary inside Postgres.** Merchant authorization and explicit store predicates are the effective tenant boundary. Browser roles are separately restricted by `backend/sql/security/isolate-server-owned-data.sql` and migrations. Production grants, runtime identity and applied migrations were not inspected against a live database; do not infer safe production deployment from SQL files alone.

`PostgresTenantRepository` deliberately lists stores by `owner_user_id` and emits OWNER roles. `StoreMembership` is compatibility data, not the current authorization source (`tenants/postgres-repository.ts:15-18,115-142`). Six roles/permission sets exist in `auth/permissions.ts`, but that does not make staff invitation, revocation and delegated merchant access a completed feature.

There are two migration directories. The canonical `backend/sql/migrations` contains 41 SQL files at inventory time. Integration helper `test/integration/pglite.ts` loads an explicit **subset**, so passing schema tests alone does not prove a clean full production upgrade. Preserve one authoritative history/checksum path and test both clean installation and upgrade from released snapshots. Recent inventory metadata has already invalidated the reset harness's dependency allowlist.

### Backend issue register

| ID | Priority / evidence | Source | Explanation and solution |
| --- | --- | --- | --- |
| BE-01 | **P0 / R** | `commerce/checkout-attempts.ts:23,101-158,198-214`; `stripe/webhooks/payment-intent-events.ts:53-74` | `cancelStripeIntent` swallows Stripe's already-succeeded/unexpected-state cancellation error; caller then cancels a local pending order/payment and releases stock. A successful charge before webhook delivery can take this path when checkout is replaced. Preserve pending state for reconciliation when cancellation is not confirmed; use explicit cancellation outcomes, fetch verified provider state when necessary, and settle atomically. Existing test mocked an order already transitioned by webhook and missed this ordering. Probe proves local cancellation/release; a live Stripe incident is not claimed. |
| BE-02 | **P1 / R** | `commerce/sweeper.ts:44-57,84-110,152-178` | Sweeper commits order cancellation separately from reservation release. A failure/crash between them strands reservations because later selection requires `PENDING_PAYMENT`. Release/cancel in one transaction or persist retryable cleanup state and sweep held expired reservations independently of order status. Probe simulates interruption and proves later sweeps skip it. |
| BE-03 | **P1 / S+V** | `functions.ts:72-77`; `commerce/order-runtime.ts:66-78`; `app/routes/internal.ts:14-23` | Deployed `orderWorkers` runs operations/email/health, not `ReservationSweeper`. Sweeper is a secret-protected HTTP endpoint; scheduling is documented but not provisioned in repository. Missing external scheduling would hold abandoned stock indefinitely. Add a declared schedule/infra resource and alert on cleanup age. External scheduler presence remains unverified. |
| BE-04 | **P1 / R, root cause open** | `commerce/notifications-digital-db.test.ts:53`; `commerce/digital.ts:49-62` | Fresh normal-environment unit suite has zero successful concurrent downloads where exactly one is expected. Do not infer overselling or token exposure from this assertion. Capture rejection causes, check entitlement/asset limits and real Postgres locking, then repair service or fixture as evidence warrants. Block enabled digital delivery until its acceptance tests pass. |
| BE-05 | **P1 conditional / S** | `app/dependencies.ts:49-77`; `config.ts:175-190,347-362`; `media/local-media-storage.ts` | `MEDIA_PROVIDER=gcs` passes GCS credential validation but actually creates `LocalMediaStorage`. In ephemeral Functions, uploads can disappear or differ between instances. Reject the unsupported provider in production or implement durable GCS; use verified Supabase storage in the meantime. No deployed media-loss incident is asserted. |
| BE-06 | **P0 launch gate / V** | runtime-role migration; isolation SQL; `config.ts:333-336` | Source includes isolation controls; repository docs say production isolation was not applied, but that statement is not live proof. Before public access, verify grants, exposed schema/function access, browser roles, runtime credential privileges and store-bound authorization against production. If browser-readable private data is found, treat the actual exposure as P0; do not label an unverified deployment a confirmed breach. |
| BE-07 | **P2 / S** | `tenants/postgres-repository.ts:115-142`; `auth/permissions.ts` | Owner-only store discovery makes the advertised role matrix incomplete as a merchant team product. Implement membership-based principals, invitations, revocation/session refresh behavior and resource/action authorization tests before exposing staff UI. |
| BE-08 | **P2 / G** | commerce total calculation; tenant settings; no merchant billing routes | No complete merchant subscription, trial, entitlement, proration, invoice, dunning or suspension workflow found. Design these separately from Connect charges. Keep payment/customer data accessible during a merchant billing problem according to an explicit retention policy. |
| BE-09 | **P2 / S+G** | `commerce/checkout-cart.ts:165-178`; `tenants/settings.ts:9-19` | Checkout total is subtotal plus one store shipping amount; all-digital carts waive shipping. Tax fields in order/invoice code are not a tax engine; coupon/automatic-promotion evaluation is absent from checkout. Implement server quotes, allocations, rounding, applicable country rules and provider boundaries. |
| BE-10 | **P2 / S+V** | `functions.ts:37-43`; `database/client.ts:13-29`; `server-storefront.ts` | API maxInstances=5 and DB pool default 5 bound connection exposure, but do not prove capacity. Include scheduled-worker pools, instance concurrency, image processing memory and full-catalog reads in load/cost tests. No merchant-count capacity estimate can be justified yet. |
| BE-11 | **P2 / S+V** | `app/routes/internal.ts:27-33`; order-runtime health counts | `/health` always returns `{ok:true}`; no database/readiness dependency checks. Order worker exposes counts but no demonstrated alert routing, SLOs, replay/reconciliation runbook or tracing. Add liveness/readiness separation, structured logs, metrics and actionable alerts. |
| BE-12 | **P2 / R** | `test/integration/onboarding-e2e-reset.test.ts:59`; reset helper | New `InventoryAdjustment` is absent from reset dependency expectation. The fail-closed safeguard is useful; do not simply relax it. Update dependency handling and disposable-data cleanup tests, keeping strict merchant/email/prefix checks. No shared reset was run. |
| BE-13 | **P1 launch gate / V** | deployment docs and CI; no exercised recovery evidence | Backups, object retention, restore drills, incident ownership, privacy deletion/export and disaster recovery were not proven. Set RPO/RTO, verify database + file backups, restore into isolation and reconcile financial data before accepting unrestricted merchants. |
| BE-14 | **P1 / R+S** | `vitest.integration.config.ts:4-7`; `test/unit-environment.ts`; `app/database.ts:3-6`; `app/dependencies.ts:131-136`; `config.ts:2` | Integration configuration omits the unit credential scrubber. Import-time dotenv/global pool and default repositories can target developer services even when a fixture `storefrontSql` is injected. The initial normal-environment media test failed with SQL `23503`; the scrubbed run instead uploaded/read locally and reached a byte assertion. Make all test dependency graphs explicitly isolated, block external destinations, share the scrubber with integration tests and use disposable DB identity checks. Never run this suite against production credentials. |
| BE-15 | **P2 / R+S** | `test/integration/starter-installation.test.ts:307`; `media/service.ts:36-42` | Isolated media upload/read succeeds, but the assertion compares processed PNG bytes against the original. Sharp intentionally rotates/re-encodes and strips metadata. Assert valid decoded pixels/dimensions/MIME, security metadata behavior and derivative contracts instead of byte identity. The failing assertion prevents later catalog/publication stages of this particular journey from executing. |

### Security strengths and remaining risks

Observed strengths: server-side Supabase `getUser(token)` verification; DB-derived merchant stores rather than trusting user metadata for permission; typed permission gates; Zod request validation; parameterized SQL in reviewed repositories; authoritative checkout pricing; store ownership checks; raw-byte signed webhooks and event receipts; production rejection of development auth/wildcard CORS; separate runtime DB URL; TLS certificate verification; server-only Stripe secrets; content-type sniffing and image decode/pixel limits; hashed digital tokens and private-bucket checks; restricted public order projections and database-backed rate limiting.

Remaining verification: production DB grants and browser API exposure, proxy/IP semantics behind Firebase, sensitive-action audit coverage, customer account/store binding, XSS/unsafe URL rendering across all rich/custom content types, payload/rate limits on every public mutation, per-tenant abuse/resource quotas, secrets rotation, security headers/CSP and session storage threat model. This was not an exhaustive penetration test. No credential leak or arbitrary cross-store data read was demonstrated in this audit.

## 5. Feature-by-feature status

**W** fully implemented and working in the bounded verified scope; **I** implemented but needs improvement; **P** partially implemented; **B** broken path identified; **N** not yet developed/found. External production journeys remain untested even for W.

| Module/capability | Status | What exists / remaining limitation |
| --- | --- | --- |
| Shared schema/registry/compiler contracts | W | Strong implementation and passing backend tests outside the identified failures; runtime/renderer coverage gaps remain separate. |
| Frontend type/build pipeline | W | Typecheck and optimized build pass for current tree. |
| Merchant login/token verification | I | Supabase/Firebase backend adapters and frontend auth exist; live login/refresh/recovery not exercised. |
| Store creation/onboarding | I | Transactional store/settings/workspace provisioning and onboarding UI; no domains/subscription lifecycle. |
| Tenant-scoped merchant APIs | I | Permissions/scoped queries, broad backend DB role; production isolation unverified. |
| Staff roles/invitations | P | Permission definitions, owner-only discovery; no complete delegated-access lifecycle. |
| Product CRUD/status/archive | I | API + classic/new builder; current uncommitted product/admin refactors need integrated QA. |
| Variants/configuration/add-ons/conditions | I | Shared selection rules, server pricing and snapshots; inspect all display and editing roundtrips. |
| Categories/collections/taxonomy | I | SQL taxonomy service/routes exist; do not repeat older documentation claiming taxonomy is wholly absent. |
| Inventory tracking/adjustment/history | I | Stock/reservations/history/thresholds; sweeper recovery flaw. No full warehouse allocation product. |
| Product photos/media/SEO/shipping metadata | I | Upload/processing/selection/SEO fields and variant shipping data; GCS branch broken, deployment and responsive-image delivery unverified. |
| Storefront/catalog/search/filtering | I / B at >100 hydration | Published runtime and filters exist; catalog overwrite bug and all-catalog bootstrap. |
| Cart | I / B for stale lines | Browser-persisted configured lines; stale deletion fails and purchased cart persists. |
| Checkout | P / B in replacement race | Server-priced flow/reservations/Stripe; editable frozen inputs, display quote mismatch risk, missing tax/promotions. |
| Stripe Connect onboarding/payment setup | I | Real account service/routes/status gates; sandbox KYC/payment journey untested. |
| Payment events/idempotency/refunds/disputes | I | Receipt processing and settlement paths; cancellation race and reconciliation evidence incomplete. |
| Orders/revisions/adjustments/balance payments | I | Extensive merchant APIs/UI and jobs; needs provider-backed regression/recovery journeys. |
| Fulfillment/tracking/shipment exceptions | I | Manual shipment events/tracking links/packed/out-for-delivery/delay status; no verified carrier sync or label purchase. |
| Customers/accounts/addresses/wishlists | I | Services/UI exist; customer aggregate identity issue and live isolation QA outstanding. |
| Notification outbox/templates/SMTP | I | Store templates, queue, uncertain-delivery handling and worker; actual delivery not tested, deployment scheduler/docs must align. |
| Digital products/download entitlements | P | Private storage/token/limit/revocation flow; fresh critical-path test fails. |
| Pages/blogs/articles/navigation | I | Real content/menu APIs and rendering; shell assignment mismatch. |
| Metafields/metaobjects/bindings | P | Definitions/values/resolution exist; frame bindings show fallbacks. |
| Theme installation/library/editor | I | Two complete named themes plus other starter definitions; template details in section 7. |
| Alternate templates/reusable sections | P | CRUD/assignment/global references; preset IDs, basic layouts, missing structural controls. |
| Draft/publication boundary | I / B on stale replay | Immutable snapshots and pointer exist; activation ordering flawed. |
| Session undo/redo | I | 50-entry scoped history; volatile and not every action invertible. |
| Durable theme history/intentional rollback | N | No complete merchant history/list/restore workflow. |
| Local store appearance route | B | Browser-only save and misleading success message. |
| Newsletter | P / B in published footer | Backend subscription/unsubscribe exists; footer provider lacks callback. |
| SEO | P | Product/collection metadata/canonical helpers; no located sitemap/robots route or full indexing/redirect/structured-data strategy. |
| Discounts/coupons/gift cards | N for checkout engine | Order adjustment fields are not a promotion/gift-card subsystem. |
| Tax | N for calculation engine | Fields/guards exist, no complete quote/rate/allocation workflow. |
| Shipping zones/rates/labels/pickup | P | Single flat rate + item metadata + manual tracking; carrier quotes/labels/region rules missing. |
| Analytics/reporting | P | Operational summary/customer totals; no behavior funnel/cohorts/attribution/report builder. |
| Marketing automation/abandoned checkout | N | Newsletter capture does not supply campaigns or recovery automation. |
| Custom domains/subdomains/SSL lifecycle | N | `StoreDomain` table alone does not provision/routinely verify domains. |
| Merchant plans/subscription billing/entitlements | N | Separate SaaS business layer absent. |
| Third-party developer apps/webhook marketplace | N | No public app/OAuth/scopes/versioned partner API lifecycle found. |
| Multi-market/localization/currency conversion | P / N | Store country/currency present; per-market catalogs/prices/translation/duties not complete. |
| Support/admin/billing operations | P | Merchant UI exists; no complete platform operator console/tickets/safe impersonation/incident tooling. |
| Deployment/CI | P | Firebase config and core checks; no complete frontend deployment/infra provisioning, CI omits browser/integration gates. |
| Backups/DR/load/cost assurance | V | Not proven, not assumed absent at provider level. |

## 6. Competitor comparison

Researched from official documentation on 29 October 2026. **This compares documented capabilities, not hands-on competitor usability or verified service levels.** Availability varies by plan, country, provider, theme and extensions. WooCommerce is a self-hosted WordPress product: hosting, upgrades, security and extension quality are the operator's responsibility, unlike the hosted SaaS baseline. Subscription billing here means a merchant paying the platform; customer recurring-product subscriptions are a separate capability.

| Area | Jellyshop current | Shopify | WooCommerce | BigCommerce |
| --- | --- | --- | --- | --- |
| Store creation | Basic owner/store/workspace flow; domains/billing absent | Hosted onboarding and store setup [S1] | WordPress/plugin setup and host operations [W1] | Hosted platform/storefront offering [B1] |
| Visual customization | Registry sections/blocks, globals and shared renderer; lifecycle/parity defects | Theme/templates/sections/blocks with template assignment [S2] | Block themes, Site Editor, patterns/templates [W1,W2] | Themes/Page Builder; composable visual tooling also offered [B1,B2] |
| Catalog/variants/inventory | Substantial small-merchant core; >100 hydration defect | Mature catalog/inventory workflows [S1,S3] | Core catalog with extensible product types [W1,W3] | Catalog, filtering, inventory and multiple storefronts [B1,B2] |
| Checkout/payments | Stripe Connect card path, no provider abstraction; no proven live journey | Integrated checkout/payment ecosystem; eligibility constraints [S1] | Payment extensions and customizable checkout blocks [W2,W3] | Checkout customization and payment-provider ecosystem [B1] |
| Orders/customers | Rich order revisions/manual fulfillment; reporting/identity limitations | Order lifecycle, routing, status and merchant workflows [S3] | Order editing/status/refund workflows [W4] | Central order management, returns/B2B options [B1] |
| Shipping | One flat rate, item metadata, manual shipment tracking | Profiles/rates/packages/routing/pickup/labels subject to eligibility [S3] | Shipping configuration/zones and extensions [W3] | Rates and fulfillment integrations [B1] |
| Tax | No complete engine | Region-dependent tax services/manual overrides [S4] | Core manual tax settings plus services/extensions [W3,W5] | Tax-provider integrations [B1] |
| Promotions | No checkout promotion engine | Codes/automatic discounts/multiple discount types [S5] | Coupons and extensions [W6] | Promotions and abandoned-cart capabilities [B1] |
| Content/SEO | Pages/blogs and selected metadata; sitemap/redirect strategy incomplete | Integrated store/content setup and extensible ecosystem [S1,S2] | WordPress content/site editing and extensions [W1] | Metadata, URLs, redirects, rich snippets [B1] |
| Analytics | Operational totals only | Native reports plus third-party analytics; plan-dependent [S6] | Sales/products/taxes/customers/stock reports [W7] | Built-in reporting and analytics integrations [B1] |
| Integrations | Internal service integrations; no app platform | Third-party apps documented across themes/tax/promotions [S2,S4,S5] | WordPress/Woo extension model [W2,W3] | APIs and integration ecosystem [B1,B2] |
| Security/scaling | Source controls and limits; no tested production envelope/DR | Hosted operational model; no comparative benchmark run | Host/operator/extension dependent | Hosted infrastructure and developer APIs [B1] |
| Dashboard/ease of use | Broad UI, dual authorities and lint debt; no completed visual audit | Guided setup documented [S1]; usability not independently scored | Powerful, host/theme/plugin dependent [W1] | Broad merchant/B2B surface [B1]; usability not independently scored |
| Commercial SaaS layer | Plans/billing/domains/entitlements absent | Merchant subscription and billing setup [S1] | Managed by merchant's hosting/service arrangements, not equivalent platform tenancy | Hosted commercial platform [B1] |

Wix is an additional relevant design-led benchmark: its documented checkout includes calculated prices, tax, shipping and buyer data, and its extension points cover shipping rates/tax/validation/discounts [X1,X2]. Jellyshop's first competitive target should be dependable simple commerce plus a clear niche, not matching the entire enterprise surface of every vendor.

### Official sources

- **S1:** [Shopify setup](https://help.shopify.com/en/manual/intro-to-shopify/initial-setup).
- **S2:** [Shopify theme structure](https://help.shopify.com/en/manual/online-store/themes/theme-structure).
- **S3:** [Shopify shipping and fulfillment](https://help.shopify.com/en/manual/fulfillment/setup).
- **S4:** [Shopify taxes](https://help.shopify.com/en/manual/taxes).
- **S5:** [Shopify discounts](https://help.shopify.com/en/manual/discounts).
- **S6:** [Shopify analytics](https://help.shopify.com/en/manual/reports-and-analytics).
- **W1:** [WooCommerce store editing](https://woocommerce.com/document/woocommerce-store-editing/).
- **W2:** [WooCommerce blocks](https://woocommerce.com/document/woocommerce-store-editing/blocks/).
- **W3:** [WooCommerce general settings](https://woocommerce.com/document/configuring-woocommerce-settings/general/).
- **W4:** [WooCommerce order management](https://woocommerce.com/document/managing-orders/view-edit-or-add-an-order/).
- **W5:** [WooCommerce taxes](https://woocommerce.com/document/setting-up-taxes-in-woocommerce/).
- **W6:** [WooCommerce coupons](https://woocommerce.com/document/coupon-management/).
- **W7:** [WooCommerce analytics](https://woocommerce.com/document/woocommerce-analytics/).
- **B1:** [BigCommerce platform](https://www.bigcommerce.com/product/).
- **B2:** [BigCommerce multi-storefront](https://support.bigcommerce.com/s/article/Multi-Storefront?language=en_US).
- **X1:** [Wix checkout](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/checkout/checkout/create-checkout?apiView=SDK).
- **X2:** [Wix business logic extensions](https://dev.wix.com/docs/overview/backend-services/custom-business-logic).

No price comparison or promise of features on every plan is made. Vendor documentation establishes feature presence, not comparative reliability. The Stripe Directory CLI could not initialize because it attempted to change a protected config file; competitor research therefore used the vendors' public documentation without provisioning or selecting any paid service.

## 7. Template builder deep analysis

The detailed companion [template-builder audit](audit-2026-10-29/template-builder.md) records the full flow and file/line evidence. The following summarizes current capability and the work needed to compete with Shopify-style customization.

| Workflow | Current behavior | Gap/required work |
| --- | --- | --- |
| Create/duplicate/rename/delete | V4 `TemplateActions`; server clones IDs, validates handles/revisions; protects defaults and assigned templates | “Basic layout” does not preserve a complete sellable theme shell; assignment UI strongest on products/collections. |
| Drag/drop sections | dnd-kit hierarchy, pointer + keyboard controls, region constraints and up/down actions | Touch/focus/mobile toolbar interactions not browser verified. |
| Blocks | Edit existing settings and append allowed inline blocks | No complete delete/reorder/duplicate/hide lifecycle in V4; shared structure requires detach. |
| Reusable sections/presets | Global references, detach, preset library and instantiate API | Client copies raw preset IDs instead of instantiating; duplicate insertion cannot save. |
| Theme settings | Schema-defined colors/fonts/layout controls; theme tokens; two complete themes | Exact-version fallback has no historic executable archive/migration flow. |
| Product/collection data | Resource picker/context, API commerce provider | Editor product provider ignores query sorting/collection/limit, so preview can mislead. |
| Custom fields | Schema/compiler/resolver and route bindings | Header/footer use fallback-only expansion; live and preview differ. |
| Header/footer/menu | Template placements, global sections, navigation API | Independently resolved frame ignores page/blog/article assignments; newsletter callback omitted. |
| Responsive | Desktop/tablet/mobile iframe sizes and CSS breakpoints | V4 does not apply stored mobile overrides; no per-device settings editor. |
| Save/recover | Coalesced revisioned save queue, retained failed drafts/retry/export | Browser refresh/back, offline recovery and multi-tab conflicts require integrated tests. |
| Draft/published | Workspace generation, compile checks, immutable saved snapshots/live pointer | Stale-key replay and concurrent activation can roll live state backward. |
| History/rollback | Session undo/redo up to 50 entries, template-scoped | No durable version timeline/intentional publication rollback workflow. |
| Cross-store compatibility | Store-bound snapshots/assignments; theme/registry constraints | No portable theme/package import/export/version migration contract. |
| SEO/accessibility/performance | Shared renderer helps consistency; metadata outside editor | No complete semantic/renderer coverage gate; no accepted browser/a11y or performance audit. |

### Concrete builder defects

| ID | Priority/evidence | Source | Required repair |
| --- | --- | --- | --- |
| TB-01 | **P1 / R** | `backend/src/storefront/publication/service.ts:35-41` | Idempotency replay must return the earlier operation's result without undoing newer successful publications. Persist activation outcome and compare expected pointer/generation. A→B→replay A probe reproduces rollback. |
| TB-02 | **P1 / S** | `storefront-frame.tsx:67`; renderer `sections/home-sections.tsx:133-140` | Frame passes only `getProducts`; newsletter control disables when `subscribeNewsletter` is missing. Share a complete store-scoped provider and test live footer success/error/consent. |
| TB-03 | **P2 / S** | `storefront-frame.tsx:59-67`; `resource-loader.ts:151-180` | Resolve shell/body from the same route, assignment and dynamic values. Include page/blog/article context. |
| TB-04 | **P2 / S** | registry `sections/content.ts:142`; renderer `render-registry.tsx:68-123` | `logo-list` is advertised without renderer; published output silently omits it. Implement it or hide it until supported; contract-test every advertised section. |
| TB-05 | **P2 / S** | `section-library.tsx:103-109`; editor page `492-494`; `template-layout.ts:29-34` | Use preset instantiate API/fresh recursive section and block IDs; test same preset twice and preset of an existing source section. |
| TB-06 | **P2 / S** | `template-actions.tsx:106-110`; `editor-page-helpers.ts:17-24` | Basic alternate product layout lacks purchase/gallery/options and shell regions. Start from the theme's valid default or provide explicit completion diagnostics. |
| TB-07 | **P2 / S** | schema `schema.ts:7-22`; `registry-section-renderer.tsx:50-97` | Saved mobile overrides are carried through adapters but unused in V4 rendering. Implement consistent override resolution or formally migrate/remove the unsupported promise. |
| TB-08 | **P1 / V** | publication `service.ts:44-57`; `sql-repository.ts:96-133,176-193` | Save/activate is not serialized against a newer publish. Add store-level transaction/CAS ordering and controlled concurrent-completion tests. Source-derived concurrency risk; not a reproduced production rollback. |

Shopify-like competitiveness requires reliable add/edit/reorder/delete for every offered section/block, accurate preview/live parity, valid complete templates, explicit draft state, recoverable saves, deliberate history/rollback, documented compatibility and tested keyboard/mobile behavior. Adding more themes before these gates pass multiplies the same defects.

## 8. Today's prioritized execution plan

“Today” means the next focused development day after this audit, not a promise that all work fits in the remaining hours of 29 October. Estimates are **engineer-hours**, assume familiarity with the code and include focused regression tests; external setup, review, deployment and manual QA add time. P0 = money/data/security/outage; P1 = broken essential flow; P2 = important capability/quality gap; P3 = refinement.

| Order | Task / dependency | Effort | Acceptance criteria |
| --- | --- | --- | --- |
| 0 | Preserve this checkout, identify release commit/config and disable uncontrolled onboarding; no dependency | 0.5–1 h | Reproducible release baseline; audited uncommitted work is accounted for; no broad checkout/reset. |
| 1 | **BE-01 P0: payment cancellation outcome**; payment engineer | 3–5 h | Confirmed-success, cancellation-success, timeout, processing and duplicate-event orderings tested. Succeeded/ambiguous cancellation never frees inventory; verified payment eventually produces consistent order/payment/stock exactly once. |
| 2 | **BE-02 P1: atomic reservation cleanup**, then **BE-03 scheduling**; depends on cancellation semantics | 2–4 h + 1–2 h | Inject failure between state changes; retry frees held expired stock once; paid inventory remains consumed. Scheduled job/alert visibly runs in disposable environment. |
| 3 | **TB-01/TB-08 P1: publication ordering**; editor/backend engineer | 3–5 h | A→B→retry A leaves B live; delayed older compile cannot replace newer publish; legitimate failed activation retry still recovers; draft stays isolated. |
| 4 | **FE-01/02 P1: catalog/cart consistency**; frontend engineer | 2–4 h | 101+ products remain available after hydration; stale items can always be removed, never hidden-and-submitted; checkout reconciles all lines with server. |
| 5 | **FE-03/04 P1: honest merchant/checkout saves** | 2–4 h | Appearance route persists canonical active store or redirects; prepared customer data cannot silently diverge; displayed payment amount is server quoted. |
| 6 | **BE-06 production isolation verification**; infrastructure owner, in parallel | 1–3 h inspection; remediation unknown | Actual browser-role denial tests, runtime identity/grants, cross-store authorization and applied migrations documented. Do not assume staging evidence applies to production. |
| 7 | **BE-04 digital failing test investigation**; backend engineer | 1–3 h initial investigation | Rejection reasons captured; fixture/service cause established; test passes for the right reason; digital feature remains gated until real storage journey passes. |
| 8 | Footer signup + preset IDs **TB-02/05** | 1–3 h each | Published footer submits store-bound consent; same preset inserts twice with unique IDs and saves/publishes. |

This is **more than one person's eight-hour day**. For one engineer, prioritize 0→1→2, reproduce/contain publication replay, then continue the next day. With three engineers, split payment/inventory, publication/editor, and catalog/cart; infrastructure verification is separate. Do not declare a launch because this list has been scheduled.

End-of-day gate: focused regressions pass; record unchanged and failed checks; run complete unit/integration/build gates after repairs; exercise a real Stripe sandbox payment with delayed/replayed events and a private draft/publish journey. Review concrete changes before requesting any deployment/shared-database approval required by the repository agreement.

## 9. Remaining development backlog

Complexity: **S** ≤2 engineer-days; **M** 3–5 days; **L** 1–3 engineer-weeks; **XL** multi-week initiative needing breakdown. These are planning ranges, not delivery commitments. Dependencies refer to IDs or phase gates. Every known issue above is assigned below; capabilities requiring discovery are identified as such.

| ID | Horizon/module | Priority | Work item | Dependencies | Complexity / completion evidence |
| --- | --- | --- | --- | --- | --- |
| A01 | Immediate/payments | P0 | Cancellation/provider-state reconciliation (BE-01) | baseline | M; all event orderings consistent |
| A02 | Immediate/inventory | P1 | Atomic/retryable sweeper (BE-02) | A01 | S; fault injection/retry invariant |
| A03 | Immediate/infra | P1 | Declare sweeper/order-worker schedules and stale-work alerts | A02 | S; observed executions |
| A04 | Immediate/publication | P1 | Replay-safe CAS/serialized activation (TB-01/08) | baseline | M; stale/concurrent publish tests |
| A05 | Immediate/catalog | P1 | Preserve paginated catalog on hydration (FE-01) | baseline | S; 101+ product journey |
| A06 | Immediate/cart | P1 | Stale line removal/reconciliation (FE-02) | A05 | S; removed variants recover |
| A07 | Immediate/admin | P1 | Remove local-only appearance authority (FE-03) | canonical APIs | S; save changes live only on publish |
| A08 | Immediate/checkout | P1 | Server quote + prepared-input integrity (FE-04) | A01,A06 | M; visible data matches charge snapshot |
| A09 | Immediate/security | P0 gate | Production grants/RLS/runtime identity attestation | environment access | S investigation; denial tests |
| A10 | Immediate/digital | P1 | Diagnose and close failing download test | fixtures | S/M; valid first download, one concurrent success |
| A11 | Immediate/release | P1 | Source lint, generated ignores, schema/reset harness | baseline | S; all required checks pass |
| A12 | Immediate/media | P1 conditional | Reject/implement GCS local fallback | chosen durable provider | S/M; multi-instance durable read |
| A13 | Immediate/editor | P1 | Published footer commerce provider (TB-02) | customer API | S; consented live signup |
| A14 | Immediate/editor | P2 | Preset ID instantiation (TB-05) | existing instantiate API | S; repeated inserts save |
| A15 | Immediate/test safety | P1 | Isolate all integration credentials/dependencies (BE-14) | before any further integration run | S; external service attempts forbidden; fixture identity asserted |
| B01 | Short/editor | P2 | Single shell/body route/binding resolver (TB-03) | A04 | M; all resource assignment parity |
| B02 | Short/editor | P2 | `logo-list` renderer and coverage contract | registry | S; no offered silent no-op |
| B03 | Short/editor | P2 | Theme-valid basic alternate templates | B01 | M; navigation + purchase work |
| B04 | Short/editor | P2 | Block delete/reorder/duplicate/hide + shared detach rules | schema/editor | M; keyboard and saved roundtrip |
| B05 | Short/editor | P2 | Query-faithful preview commerce provider | A05 | S; sort/collection/limit parity |
| B06 | Short/editor | P2 | Responsive override contract/editing (TB-07) | renderer/schema choice | M; distinct mobile/desktop values |
| B07 | Short/editor | P2 | Reload/back/offline/multi-tab draft recovery | A04 | M; no silent unsaved loss |
| B08 | Short/themes | P2 | Durable version timeline/intentional rollback | A04 | L; audited restore operation |
| B09 | Short/themes | P2 | Theme/package compatibility/version migration | B08 | L; old stores stable after release |
| B10 | Short/cart | P2 | Clear purchased cart/version and rotate checkout key | A01,A08 | S; redirect and concurrent-add cases |
| B11 | Short/catalog | P2 | Complete product builder/classic-form roundtrip parity | A05 | M; photos/options/SEO/shipping persist |
| B12 | Short/inventory | P2 | Bulk adjustments/threshold views and audit integrity | A02 | M; tracked/untracked/reserved cases |
| B13 | Short/customers | P2 | Stable identity and refund-aware reporting (FE-09) | order ledger | M; same-email/name change cases |
| B14 | Short/orders | P1 | Real sandbox lifecycle/refund/balance/worker recovery QA | A01-A03 | M; replay/fault matrix passes |
| B15 | Short/notifications | P2 | Deliverability, retry/uncertain handling, queue visibility | A03 | M; SMTP/store branding verified |
| B16 | Short/digital | P1 | Real private storage, revocation/expiry/download QA | A10,B14 | M; end-to-end download gate |
| B17 | Short/content | P2 | Content/menu/custom-data lifecycle QA and shell bindings | B01 | M; all resources scoped/published correctly |
| B18 | Short/SEO | P2 | Sitemap/robots/structured data/canonicals/redirects | domain URL policy | M; crawl fixtures and indexing rules |
| B19 | Short/UX | P2 | Desktop/tablet/mobile/zoom/keyboard audit and repairs | stable journeys | M; screenshots + accessibility checks |
| B20 | Short/performance | P2 | Route-specific pagination, remove duplicate bootstrap work | A05,B01 | L; measured payload/latency budgets |
| B21 | Short/media | P2 | Responsive delivery/CDN/cache/image budgets | A12 | M; correct sizes/byte budgets |
| B22 | Short/testing | P1 | CI integration + browser critical journeys; fix stale PNG assertion (BE-15) | A11,A15,B14 | M; required clean-release gates |
| C01 | SaaS/shipping | P2 | Zones, profiles, weight rules, delivery/pickup quotes | A08,B11 | L; server quote allocation |
| C02 | SaaS/tax | P1 for markets needing it | Define launch-country tax model/provider interface | A08,scope decision | L; rounding/refund/invoice cases |
| C03 | SaaS/promotions | P2 | Codes/automatic discounts/usage limits/allocations | C02 | L; concurrent redemption/refund tests |
| C04 | SaaS/team | P2 | Membership principals, invite/revoke/role management | A09 | L; least-privilege action matrix |
| C05 | SaaS/billing | P1 commercial gate | Plans/trials/subscriptions/invoices/dunning | platform identity | XL; billing events/entitlements proven |
| C06 | SaaS/entitlements | P1 commercial gate | Quotas, feature/usage limits, grace/suspension policy | C05 | L; API-enforced limits |
| C07 | SaaS/domains | P1 commercial gate | Ownership verification, host routing, TLS lifecycle | deployment | L; cross-tenant host attack tests |
| C08 | SaaS/onboarding | P2 | Idempotent resumable provision/setup/readiness | C05,C07 | M; interruption/retry journey |
| C09 | SaaS/infra | P1 | Reproducible frontend/backend environments and migrations | A09,A11 | L; preview/staging/prod promotion |
| C10 | SaaS/observability | P1 | Readiness, SLOs, structured logs/traces/alerts | A03,C09 | M; induced failure pages owner |
| C11 | SaaS/recovery | P1 | Backups/files restore, RPO/RTO, financial reconciliation | C09 | L; timed isolated restore drill |
| C12 | SaaS/privacy | P1 gate | Data map, export/delete/retention/support procedures | C04,C05 | L; verified store/customer workflows |
| C13 | SaaS/admin/support | P2 | Safe operator tooling, audit log, tickets and diagnostics | C04,C10 | L; access/audit/rollback tests |
| C14 | SaaS/scale | P2 | Load/stress/soak and cost envelope per merchant | B20,C09,C10 | L; measured limits and cost model |
| C15 | SaaS/docs | P2 | One migration authority, correct URLs/deploy/worker runbooks | C09 | M; clean-machine onboarding |
| D01 | Long/fulfillment | P2 | Carrier quotes/labels/tracking provider adapters | C01 | XL; provider contract/recovery |
| D02 | Long/payments | P2 | Regional gateways/wallet/provider abstraction | A01,C02,market choice | XL; provider-independent invariants |
| D03 | Long/analytics | P2 | Event model, sales/funnel/cohort/attribution reports | B13,C10,privacy | XL; metric reconciliation |
| D04 | Long/marketing | P2 | Campaigns/segments/abandoned checkout automation | D03,B15,consent policy | L/XL; unsubscribe/idempotency |
| D05 | Long/apps | P2 | Versioned API/webhooks/OAuth/scopes/app lifecycle | C04,C10,C12 | XL; revocation/rate limits |
| D06 | Long/international | P2 | Translations/markets/prices/currency/duties | C02,D02 | XL; localized checkout/accounting |
| D07 | Long/commerce | P3 | Gift cards/loyalty/reviews/bundles/subscription products | C03,D05 | XL; ledger/redemption/moderation |
| D08 | Long/enterprise | P3 | Multi-location inventory/B2B/POS/ERP | core reliability + validated demand | XL; separate product discovery |
| D09 | Long/themes | P3 | More themes, portable packages and ecosystem | B02-B09 | XL; compatibility certification |
| D10 | Long/polish | P3 | Microcopy, animation and visual refinements | B19 | S/M; regression screenshots |

## 10. Production readiness gates and missing verification

### Before a controlled pilot

- [ ] A01–A08 close money/stock/publication/catalog/checkout integrity defects with regression tests.
- [ ] All relevant digital-download assertions pass, or digital selling is explicitly disabled.
- [ ] Runtime DB credentials/grants, browser-role denial and store authorization verified in the actual target environment.
- [ ] Durable media configured; unsupported local/GCS production path cannot silently start.
- [ ] Clean source lint, typecheck, unit, integration, production build and critical browser gates pass.
- [ ] Real Stripe sandbox onboarding → checkout → delayed webhook → order → shipment → refund/replay journey recorded.
- [ ] Install/edit/save/reload/preview/publish/alternate assignment/rollback safety journey recorded with real API persistence.
- [ ] Scheduled reservation cleanup/order jobs observed; failed/retry work is visible to an operator.
- [ ] Backups and private-file restore tested in isolation; incident and financial reconciliation ownership assigned.
- [ ] Launch-country tax/shipping/payment limitations are implemented and made clear to merchants; no unsupported tax promise.

### Before unrestricted paying merchants

- [ ] Reproducible separate production/staging deployment, controlled migration/promote/rollback and accurate runbooks.
- [ ] Merchant billing/trial/entitlement/grace/suspension workflows; authorization and support operations.
- [ ] Merchant-owned domains/routing/TLS and store lifecycle/export/archive procedures.
- [ ] Privacy retention/export/delete, customer support and access/audit controls exercised.
- [ ] Load/cost envelope measured using large catalogs, concurrent checkout, webhook bursts, publishing and uploads.
- [ ] Availability/latency/queue-age alerting, recovery drills and security review completed.

### Required device and accessibility matrix

Current audit status for every visual step below is **blocked/unverified**; there are no accepted screenshots. Source breakpoints alone do not establish responsiveness.

| Step | Flow | Devices/states required | Evidence/acceptance |
| --- | --- | --- | --- |
| 1 | Signup/login/recovery/onboarding | 390 mobile, 820 tablet, 1440 desktop; errors/session expiry | Screenshots per step, keyboard flow, correct active store |
| 2 | Products/variants/media/inventory | same widths; loading/empty/error/unsaved | No clipped actions; labels/errors; persisted roundtrip |
| 3 | Theme install/editor/template lifecycle | desktop + tablet; mobile limitations explicit | DnD pointer/touch/keyboard, focus, error recovery, live parity |
| 4 | Storefront home/search/collection/product | both complete themes, long text, 101+ products | No overflow; usable filters/swatches; correct purchase selections |
| 5 | Cart/checkout/payment | stale items, changed prices, expired attempt, rejected card | Visible server quote, removable lines, announced errors |
| 6 | Order/account/refund/download | delayed webhook, retry/reload, signed-in/out | Correct state, protected data, no false success |
| 7 | Cross-cutting accessibility | 200%/400% zoom, keyboard, screen reader, reduced motion | Focus order/trap/restore, contrast, names, target sizes, status announcements |

Use accepted screenshots from the actual current application and automated accessibility checks; do not substitute theme marketing images or old audit captures. The public theme preview is useful for visual inspection but cannot validate authenticated merchant persistence or payments.

### Capacity and cost assessment

No representative throughput, latency, database EXPLAIN, Core Web Vitals, bandwidth, storage or billing measurements were obtained. Current configured API cap is five instances with 1GiB memory and 60s timeout; pool defaults to five connections per process, while scheduled workers are separate processes. These are configuration facts, not a guarantee of 25 total connections or any merchant capacity. Autoscaling, concurrency and worker pools must be included.

Build a cost model from function execution time/memory/requests, Postgres compute/connections/storage/IO, image processing/storage/egress, SMTP volume, frontend bandwidth/builds and observability. Payment processing costs belong in transaction economics and must be obtained for the selected provider/country. Do not invent a monthly infrastructure price before measuring a pilot workload.

## 11. Phased roadmap

Ranges assume roughly **three experienced engineers plus shared QA/infra/design support** working on the current stack. They are overlapping planning envelopes, not additive guarantees or a fixed-price estimate. Long-range work must be re-estimated after stabilization.

| Phase | Scope / backlog | Planning envelope | Exit gate |
| --- | --- | --- | --- |
| **1 — Stabilization** | A01–A15: money/stock/publication correctness, stale catalog/cart, digital test, test isolation, release checks, production isolation | 1–2 weeks | No known P0; P1 integrity invariants proven; clean checks and sandbox transaction journey |
| **2 — Core product completion** | B01–B18 plus launch-critical C01–C03: editor parity/block lifecycle, checkout, order/payment/refund/digital completion, shipping/tax/promotion scope | 4–8 weeks | A merchant can provision/design/publish/sell/fulfill/refund with accurate totals and recovery |
| **3 — Product quality** | B19–B22, performance/media, customer metrics, documentation/UX/a11y and browser gates | 3–5 weeks, overlapping phase 2 | Device/accessibility evidence, bounded payloads and performance budgets, regression gates |
| **4 — SaaS readiness** | C04–C15: teams/billing/entitlements/domains/infra/monitoring/recovery/privacy/support/scale | 6–10 weeks, foundations start earlier | Restricted paid rollout with operational ownership, restore evidence, billing and tenant isolation |
| **5 — Competitive features** | D01–D10 prioritized by pilot demand: integrations, gateways, analytics, automation, markets, advanced commerce/themes | 3–6+ months incremental | Each initiative has validated merchant demand, integration contracts, usage/cost and reliability gates |

Start monitoring, backups and migration discipline in phase 1; the phase names do not justify postponing launch blockers until phase 4. Shopify-level breadth is a continuing multi-release product program, not a final checkbox at the end of this schedule.

## 12. Recommended next steps

1. Establish a reproducible release baseline from the dirty checkout and keep the existing unrelated changes intact.
2. Execute the P0 cancellation regression and atomic inventory cleanup first. Fix publication replay/order and catalog/cart immediately after or in parallel with distinct owners.
3. Close the real failing digital/reset checks, then repair honest save/preview/runtime behavior rather than adding new sections/themes.
4. Complete the real staging Stripe and template lifecycle journeys and obtain production isolation/recovery evidence before public merchant onboarding.
5. Select a narrow launch market and merchant use case; finish its tax/shipping/payment/support obligations, then build SaaS billing/domains and grow from measured pilot demand.

**Audit limitation:** this is a broad, connected technical/product audit with fresh automated checks and four focused reproductions. It is not a claim that every line, route, device, provider and production setting has been exhaustively tested. The missing browser and operational evidence is explicitly part of the backlog and readiness gates, not silently counted as working.

### Validation and handoff notes

The final integration result uses `isolated-integration.config.mts` in the evidence folder, with the repository's `test/unit-environment.ts` setup and `DOTENV_CONFIG_PATH` set to a deliberately missing audit file. `backend-integration-unsandboxed.log` is the earlier unsafe-environment diagnostic; **use `backend-integration-isolated.log` for the final result**. Unit final result is `backend-unit-unsandboxed.log`; frontend final test result is `frontend-unit-local-temp.log`; final build results are `frontend-build-unsandboxed.log` and `backend-build-verified.log`. The evidence programs are demonstrations of defects, not fixes or a replacement regression suite.

Preview/build tooling temporarily added audit output directories to `jellyshops/tsconfig.json` and changed `next-env.d.ts`. Those audit-generated changes were removed, and both files were checked to have no diff against their original tracked state. Existing application changes were preserved. Audit preview processes were stopped. No application fix or deployment is included in this deliverable.
