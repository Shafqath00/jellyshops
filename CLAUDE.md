# Jelly Shops — project memory for Claude

Multi-tenant e-commerce platform ("Shopify-simple" for small merchants): merchant admin, a visual theme editor, public storefronts, Stripe Connect payments. Read this before working in the repo. Deeper docs: start at `docs/README.md` (generated file maps/function/endpoint/schema references via `node scripts/generate-docs.mjs` and `node scripts/generate-db-docs.mjs`), `docs/backend-architecture.md`, `docs/theme-architecture.md`, `docs/jelly-minimal-launch-checklist.md`, `docs/reports/`, `jellyshops/AGENTS.md`.

## Layout

| Path | What it is |
| --- | --- |
| `jellyshops/` | Next.js 16 / React 19 / Tailwind 4 frontend (admin, editor, storefront). Next.js here has breaking changes: read `jellyshops/node_modules/next/dist/docs/` before using Next APIs. |
| `jellyshops/packages/storefront-schema` | Zod schemas and types (documents, sections, runtime snapshot, rich text). |
| `jellyshops/packages/storefront-registry` | Section/block definitions, editor controls, starter packs (`v4-starter-packs.ts`), shared plain-language labels (`labels.ts`). |
| `jellyshops/packages/storefront-renderer` | The one renderer used by the editor preview AND the published store. Sections live in `src/sections/`. |
| `jellyshops/packages/storefront-themes` | Theme definitions, token resolvers, fonts. |
| `jellyshops/packages/storefront-ui` | Tiny shared components (container, product card, button). |
| `backend/` | Express 5 + TypeScript API (`src/app.ts` is the composition root), Supabase Postgres, Stripe Connect. Deployed as a Firebase Function (`src/functions.ts`). |
| `backend/sql/migrations`, `backend/supabase/migrations` | SQL migrations. |
| `docs/` | Architecture, reports, plans, launch checklist. |
| `scripts/prepare-shared-packages.mjs` | Packs the shared packages into tarballs for the backend. |
| root `*.log`, `*.json` | Old test run output; git-ignored clutter. |

Stack summary: Supabase Auth + Postgres (raw `pg`, no ORM), Stripe Connect, Firebase Functions (API), Vercel (frontend, deploy not set up), Vitest, Playwright, GitHub Actions (`.github/workflows/core-mvp.yml`).

## Commands

Frontend (`jellyshops/`): `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`. Packages must be built first (`npm run build:storefront-packages`; `dev`, `build`, `test` do it for you).
Backend (`backend/`): `npm run typecheck`, `npm test`, `npm run build`, `PORT=3001 npx tsx src/server.ts` to run.
Dev frontend: `JELLY_E2E_NEXT_DIST_DIR=.next/qa NEXT_PUBLIC_STORE_EDITOR_API_URL=http://127.0.0.1:3001 npx next dev --turbopack -p 3200` (the separate dist dir avoids clashing with another `next dev` on port 3000). Starting Next rewrites `jellyshops/tsconfig.json` and `next-env.d.ts`; `git checkout` them before committing.
Theme Playwright spec: `JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/jelly-minimal-theme.spec.ts`.

## Critical gotchas (learned the hard way)

- **Backend uses packed copies of the shared packages** (`backend/jelly-storefront-*-0.1.0.tgz`). After changing schema/registry/themes: `node scripts/prepare-shared-packages.mjs`, then `cd backend && rm -rf node_modules/@jelly && npm install`. npm does NOT replace a same-version tarball, so the backend silently runs stale packages otherwise.
- **Never bump a theme's `version`.** Published stores pin it; a mismatch makes them silently fall back to the default theme. Never change a theme `id` either (`jelly-signature` is the internal id of "Jelly Minimal").
- **Line endings:** the repo is LF. Python text-mode `open()`/write on Windows converts to CRLF and creates whole-file diffs. Use binary read/write (`open(f,'rb')`, `.decode('utf8')`, write `.encode('utf8')`).
- **Tailwind 4 cascade:** unlayered global CSS beats utility classes. Keep global element rules inside `@layer base` (the `a { color: inherit }` bug made link-buttons unreadable).
- **Two token layers:** `resolveDesignTokens` (`--jelly-*`) and `resolveStorefrontThemeTokens` (adds `--theme-*`, `--store-*`). The live store and the editor preview now both use the storefront layer. Storefront CSS must read tokens, never hard-coded colours.
- **Full-screen editor** is portalled to `<body>`; the admin shell's fade-in animation creates a stacking context that otherwise traps it under the admin header.
- **Cart/local state:** the storefront still keeps a legacy browser repository (`src/lib/repository.ts`, localStorage key `jelly-shop-state-v1`). `readState` falling back to seed data on any thrown error wipes carts; stores synced from the API have no seed design (fixed, covered by a test).
- Next dev frozen renderer / screenshot timeouts in Claude in Chrome are usually the extension's `claude-pulse` overlay or a minimised window, not the app.
- Hosted-test-credentials: never type real passwords into forms; the user signs in themselves.

## Jelly Minimal theme (the flagship theme)

- Internal id `jelly-signature`, display name "Jelly Minimal". Warm white / charcoal / sand, Fraunces headings + Inter body (self-hosted via `next/font`, `src/app/fonts.ts`), 8px spacing scale, 1280px container.
- Styles: `jellyshops/src/app/themes/jelly-minimal.css`, scoped to `[data-jelly-theme="jelly-signature"]`, tokens `--jm-*`. Shared utilities in `themes/storefront-base.css`.
- Definition: `packages/storefront-themes/src/jelly-signature/definition.ts` (curated settings schema), fonts in `src/fonts.ts`.
- Pages built: home, collection, product, cart, checkout, order confirmation, account (login/register/recover/overview/orders/addresses), search, information pages, 404.
- Review without a store: `/theme-preview/jelly-minimal` (tabs for Style guide, Home, Collection, Product, Cart, Search, Page, 404; Desktop/Tablet/Mobile).
- Adding a theme: see `docs/theme-architecture.md`.
- Existing stores keep their saved colours/fonts (published snapshots are immutable).

## Architecture notes

- Theme -> templates -> sections -> blocks -> settings. Section definitions + editor controls live in the registry; rendering in the renderer; one renderer for preview and live.
- Draft vs publish: SQL workspace generations, immutable publications, active-publication pointer. Live store never changes until Publish.
- Multi-tenant: every merchant route is `/api/stores/:storeId/...` with `requireStorePermission`; every query takes `storeId`.
- Editor files: `src/app/admin/online-store/editor/page.tsx` (V4 editor, ~1300 lines), `src/features/store-editor/`. Shared plain-language names come from `packages/storefront-registry/src/labels.ts`.
- Header/footer store name + logo: `withStoreIdentity()` in the renderer package, used by both preview and live.
- Starter install: `backend/src/storefront/starter/installation-service.ts` (also seeds draft information pages with editable copy).
- Checkout: server-priced, Stripe PaymentIntents, inventory reservations; frontend `src/app/[storeSlug]/checkout/page.tsx`.

## State of the work (as of 2026-10-21)

Branch `local/task3` (pushed to `origin/local/task3`). Phases of the Jelly Minimal build, all committed:
1. Design system, fonts, editable header/footer/announcement, product cards, style guide.
2. Home, collection and product pages with full section settings, refreshed starter.
3. Cart, checkout, order, account, search, information pages, 404.
4. Editor: plain-language labels, page picker wording, preview identity, toolbar-overlap fix.
5. Accessibility audit, Playwright theme spec, launch checklist.

Test status at last run: frontend 439 passing, backend 385 passing, both builds pass, 9 theme Playwright tests pass.

**Jelly Avenue (second complete theme, id `jelly-avenue`, started 2026-10-21):** editorial, image-led theme inspired by the structure of Shopify's Metropolitan (original design, no copied assets or name). Styles `jellyshops/src/app/themes/jelly-avenue.css` (tokens `--av-*`), definition `packages/storefront-themes/src/jelly-avenue/definition.ts`, home builder `avenueHome()` in `v4-starter-packs.ts`, preview `/theme-preview/jelly-avenue`. Agreed 5-phase plan: (1) foundation [done], (2) home page and new section options [done: slideshow section, product-grid tabs + heading alignment, header over first image, footer newsletter + link columns, empty heading hides intro], (3) collection and product pages [done: collection toolbar with filters/sort/size toggle, banner header, product info tabs + stock counter sections, trust badges; colour swatches deferred until the product-options section is free of other uncommitted edits], (4) cart/checkout/account/search/info/404 [done: pages reviewed in browser, checkout/account fields restyled; slide-out cart not built, header bag links to the cart page], (5) editor polish, QA, tests, docs [done: Avenue Playwright spec (11 tests), section-limit tests, contrast fix for soft text, launch checklist in docs/jelly-avenue-launch-checklist.md; not run: manual staging journey]. Use `isCompleteStorefrontTheme()` / `COMPLETE_STARTER_PACK_IDS`, never a hard-coded theme id.

**Order tracking (design in `docs/plans/order-tracking-design.md`):** phase 1 done: shoppers see shipments (carrier, tracking number, courier link), progress steps and order history on the order page, built from an allowlist in `backend/src/commerce/public-order-progress.ts`. Phase 2 done on the backend and in shopper pages: merchant actions to mark packed, send out for delivery and report a delay or failed delivery (migration `20261027000000_shipment_exceptions.sql`, routes in `merchant-order-routes.ts`, emails queued through `jelly_queue_notification`); component `features/commerce/components/shipment-actions.tsx` is mounted in the admin order page (committed in `admin/orders/[id]/page.tsx`; the same two lines are also in the other developer's uncommitted `view.tsx` split, so keep them when that lands). Estimated delivery date skipped (open question in the design). Provider integration and shopper cancellation requests not started.

**Product builder (started 2026-10-25, plan in `docs/plans/product-builder.md`):** single-page builder at `/admin/products/builder` (+ `/[id]`), features in `jellyshops/src/features/product-builder/`, shared option rules in `packages/storefront-schema/src/product-options.ts` (backend uses the packed copy), taxonomy API in `backend/src/taxonomy/`. The classic form at `/admin/products/new` is untouched. Phases 1-6 done except text inputs, variant photos and the condition editor.

**Template system (analysis 2026-10-29, `docs/reports/2026-10-29-template-system-analysis.md`):** agreed roadmap A reliability fixes, B template management UI (create/rename/delete alternate templates, template picker on product/collection forms, rename "Templates" page to "Store designs"), C showroom sections (specifications, showroom visit, swatches), D Bed Showroom theme. Phase A done (backend): template/assignment mistakes return 400/404/409 with plain messages (`ApiError` thrown from the services; `http/errors.ts` has the other developer's edit, so it was left alone), `DELETE /templates/:id` (refuses `default` and assigned templates) and `DELETE /assignments/:type/:id`, layout shape checked on save, Publish skips `previous-*` templates nobody uses (`isRetiredTemplateHandle`), starter install pins the theme's own version. Phase B built 2026-10-29: committed parts are `features/store-editor/template-names.ts`, `components/template-actions.tsx` (editor: create/rename/delete templates), `components/template-picker.tsx` ("Page layout" on products and collections) and shared-section wording in `global-section-panel.tsx`. **The wiring is left uncommitted inside the other developer's files** (user's choice, because those files hold their unfinished work): `api/client.ts` (`deleteTemplate`, `removeAssignment`), `admin/online-store/editor/page.tsx` (mounts `TemplateActions`, "Shared …" names), `product-builder/ProductBuilder.tsx` + `sections/OrganizationSection.tsx` (`extra` slot), `admin/products/collections/page.tsx`, "Store designs" wording in `admin/online-store/page.tsx` and `template-preview.tsx`, and the matching test names in `online-store/page.test.tsx` and `template-library.test.tsx`. Keep these edits when their work lands. Browser-checked on staging 2026-10-29 (create, rename, assign, refuse delete while used, unassign, delete), test data removed. Phase C done 2026-10-29: `product-specifications` section (product's own specs + `spec-row` blocks) in `product-extras.ts/.tsx`, and a real renderer for `contact-store-info` ("Store visit and contact": address, hours, directions/call/WhatsApp/email, photo) in `sections/store-visit.tsx`, styles in `storefront-base.css` + both theme files. Uncommitted hookups in the other developer's files: `render-registry.tsx` (registers both), `registry sections/commerce.ts` + `renderer sections/product-sections.tsx` (`showSpecifications` toggle on "Product title and price"); backend tarballs were repacked. **Found in phase C:** custom-field bindings are never resolved for shoppers (resolver unused) — next phase C2; swatches need an API field + migration (builder choice is lost on save); `logo-list` has no renderer.

**Not done / open:**
- **A PR into `main` is impossible**: `local/task3` and `origin/main` have unrelated histories (different root commits). The user chose to leave the branch pushed without a PR.
- Manual staging + Stripe sandbox journey (`docs/jelly-minimal-launch-checklist.md`) not run; the user must provide a working staging login.
- Production database isolation (RLS) was applied to staging only (Supabase project `ayvpxqwleurhkfyujzlu`); production is not contained.
- Not built yet: custom domains/SSL, subdomain generation (a `StoreDomain` table exists, unused by code), Indian payment gateways (Stripe is wired directly; a provider interface is still needed), persisted taxonomy (categories/brands), analytics, Vercel deploy (token invalid).
- Built 2026-10-22 (commit 018fb66, migrations applied to staging, gated per store, off by default): order management, order emails (outbox + SMTP), digital product delivery. Docs: `docs/features/`.
- Known small issues: product form stays "Unsaved product" after saving (can duplicate), variant price-adjustment fields show ₹ on a £ store, variant products show "No SKU", one slow product-list request after a variant save (cleared by restarting the backend).
- Another developer has uncommitted admin-UI edits in the working tree (admin pages, `app-shell.tsx`, `admin-theme-toggle.tsx`, `shadcn-theme.css`, parts of `globals.css`). Do not commit or revert them; commit only your own files with explicit `git add` paths. Their `admin-theme-toggle.tsx` currently has one lint error.

## Working agreements with this user

- Phase-by-phase: finish a phase, commit, report, ask before the next.
- Ask before writing to the staging database or pushing/merging; staging is Supabase project `ayvpxqwleurhkfyujzlu` (backend `.env` points at it; `.env` files are git-ignored).
- The user's real Chrome has their signed-in session; use Claude in Chrome for signed-in checks, the built-in browser for local pages. Do not enter passwords on their behalf; they sign in.
- Commit style: `feat:` / `fix:` / `test:` / `chore:` with a short body, ending with the Co-Authored-By trailer from the session's attribution reminder.
- Keep replies plain-language and concise; state honestly what was and was not verified.

## Keeping this file useful

Update the "State of the work" section when phases change; do not paste secrets (Supabase keys, passwords, Stripe keys) here. Credentials live only in git-ignored `.env` files.
