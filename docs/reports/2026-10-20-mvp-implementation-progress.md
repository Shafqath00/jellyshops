# Core MVP implementation ledger

Specification: the Core MVP Completion and Launch Plan approved in this conversation on 2026-10-20; baseline: `2026-10-20-project-audit.md`.

## Constraints

- Preserve pre-existing dirty changes on branch `local/task3`; no reset or automatic baseline commit.
- Owners only; server-owned data; IN/INR, GB/GBP, US/USD; domestic flat shipping; final listed prices.
- Dedicated staging before rollout. No production migrations, payments, or publications during local implementation.
- Vercel frontend / Firebase API. Paid resources require explicit approval.

## Progress

- Phase 0: dependency versions pinned to lockfile resolutions, shared-package packing script and CI added. Staging created after explicit organization and quoted $0/month approval: `jellyshop-staging`, `ayvpxqwleurhkfyujzlu`, eu-west-1, jellylabs.uk Org. Clean-checkout verification remains outstanding.
- Phase 1: server-table grant revocation, RLS, restricted runtime group, verified database TLS, production startup guards, transactional store creation, explicit authentication/store-loading states implemented. Migrations applied to staging only. Production containment and dedicated runtime login remain rollout prerequisites.
- Phase 2: direct product lookup beyond the first 100, transactional product writes, canonical IDs, image associations, variant options, settings revisions/flat shipping, authenticated edit/archive UI, and SQL media metadata implemented. Catalog pagination/search UI, taxonomy persistence, collection mutations, legacy media import, and complete inventory editing still require work.
- Phase 3: server currency/shipping policy, domestic address validation, configuration ID transport, total calculation, checkout identity, atomic order counter, payload bounds, shared rate limits and market gates implemented. Stripe sandbox purchase/refund verification, real account payment configuration, and scheduled expiry deployment remain outstanding.
- Phase 4: default SQL workspace repositories and service composition, custom-data persistence, fresh clone/preset IDs, session undo/redo, failed-save recovery, navigation protection and revision conflicts implemented. Public dynamic-binding resolution and remaining service validation need completion and end-to-end verification.
- Phase 5: published storefront server bootstrap, product metadata/structured data, initial server-rendered product grids, explicit loading/error states, and truthful dashboard setup progress implemented. Sitemap/robots, responsive image optimization, complete accessibility/responsive verification and remaining presentation work are outstanding.
- Phase 6: baseline test and lint repairs substantially implemented. Latest complete frontend suite: 428 passed, 0 failed. Latest source lint: 0 errors, 36 warnings; warning cleanup remains. Backend suite and type checks are being rerun after dashboard and tenant-status changes. Production builds, PostgreSQL integration coverage, operational documentation, fresh review and rollout checks remain outstanding.

## Deployment decision

- User explicitly requested **leave deployment pending**. The Vercel CLI token is invalid. Do not initiate `vercel login`, deploy, or publish while this decision stands. Local implementation and verification remain authorized.
- Firebase project discovery succeeded, but no deployment was performed.
- Staging has the consolidated schema, isolation rules, and backend runtime group. Dedicated runtime credentials and Stripe sandbox setup have not been verified; the staging purchase lifecycle is not complete.

## Verification and incident record

- Targeted checks have covered settings revisions, checkout currency/options/shipping and retry budgets, migration-chain application, anonymous grant denial, workspace transactions/cloning, SQL custom data/media, authentication/onboarding, published routes and editor history.
- Unit-test setup now clears remote database, authentication and payment credentials before loading dotenv. Earlier tests unintentionally wrote four synthetic 68-byte image metadata rows to the demo store in the original project. After explicit user approval, all four exact rows were deleted with store, filename, dimensions, size and unreferenced-product guards. No production schema migration was applied.
- Never interpret unit tests or mocked payment tests as evidence of a completed staging payment journey or production readiness.
- Verification after the deployment-pending decision: both applications pass TypeScript checking. Dashboard/startup/authentication checks: 25 passed across 4 files. Affected tenant/API route checks: 38 passed across 8 files. Backend full run reached 369 passed and one stale admin-route `403` expectation; that expectation was corrected to the specified `404` and passed in the subsequent route run. The two additional payment-readiness dashboard tests passed in the targeted run; a new complete-suite run is still required before claiming the entire backend suite is green.

## Rulings and dependencies

- Continue in the existing task checkout because required earlier editor changes are uncommitted here; a new checkout would omit them.
- Security migrations will be locally tested and checked in before any environment change; never reopen grants as a recovery strategy.
- Settings persistence produces the server-owned shipping/currency input consumed by checkout. Both must deploy together after additive migrations.
- Shared package packing must run before backend installation/build to avoid testing stale contracts.
- CLI is not installed globally; use an available local CLI or npx to generate migration filenames, without provisioning remote resources.
