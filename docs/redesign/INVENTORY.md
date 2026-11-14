# Jelly Shop admin: page and component inventory

Branch `redesign/jelly-shop-ui` (from `combined/dashboard-and-templates`, commit cad4104). This list is the checklist for the redesign. Tick a row when it has been restyled and checked at desktop, tablet and phone.

## Stack (follow it, add nothing)

- Next.js 16 app router, React 19, Tailwind 4, lucide-react icons, Radix (via a few shadcn wrappers: sheet, tooltip).
- Admin styling is plain CSS driven by `--jk-*` tokens on `html.admin-ui`:
  - `src/app/admin/admin-kit.css` – tokens + every kit component
  - `src/app/admin/admin-shell.css` – frame (sidebar, header, canvas)
  - `src/app/admin/admin.css` – leftover aliases for product builder sections
  - `src/features/product-builder/product-surface.css` – builder layout only
- Shared components: `src/components/admin/` (the "admin kit"), frame in `src/components/layout/`.
- Because colours, radii, shadows and type come from tokens, a re-skin of the tokens and the kit restyles every page that uses the kit.

## How to run, build, check

| Task | Command (in `jellyshops/`) |
| --- | --- |
| Dev server | `npx next dev --turbopack -p 3210` (launch entry "jellyshops-admin"; needs the backend on 3001 for real data) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` (admin folders: `npx eslint src/app/admin src/components src/features/admin ...`) |
| Unit tests | `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` |
| Build | `npm run build` |

Baseline (2026-11-14, before any change): see "Baseline" at the end of this file.

## Pages (`src/app/admin/...`)

| # | Route | File(s) doing the work | Kit frame | Done |
| --- | --- | --- | --- | --- |
| 1 | `/admin` Home | `page.tsx`, `features/admin/home/*` | AdminPage | ☐ |
| 2 | `/admin/orders` list | `orders/page.tsx` | AdminPage + IndexTable | ☐ |
| 3 | `/admin/orders/[id]` detail | `features/commerce/...order view` (refund, edit items, packing slip, tags, timeline) | AdminPage | ☐ |
| 4 | `/admin/products` list | `products/page.tsx`, bulk edit/export dialogs | AdminPage + IndexTable | ☐ |
| 5 | `/admin/products/new`, `/admin/products/[id]` builder | `features/product-builder/*` | own frame (`jk-builder`) | ☐ |
| 6 | `/admin/products/collections` | `collections/page.tsx` | AdminPage | ☐ |
| 7 | `/admin/products/inventory` | `inventory/page.tsx`, stock history drawer | AdminPage | ☐ |
| 8 | `/admin/products/reviews` | `reviews/page.tsx` | AdminPage | ☐ |
| 9 | `/admin/products/import` | `features/product-bulk/import-wizard.tsx` | wizard | ☐ |
| 10 | `/admin/products/photos` | `features/product-bulk/bulk-photos.tsx` | AdminPage | ☐ |
| 11 | `/admin/customers` list | `customers/page.tsx` | AdminPage + IndexTable | ☐ |
| 12 | `/admin/customers/new`, `/[id]` | customer form/detail | AdminPage | ☐ |
| 13 | `/admin/customers/messages` | messages page | AdminPage + SplitLayout | ☐ |
| 14 | `/admin/content/pages` | pages editor | AdminPage + SplitLayout | ☐ |
| 15 | `/admin/content/blogs` | blog posts | AdminPage + SplitLayout | ☐ |
| 16 | `/admin/content/files` | files | AdminPage | ☐ |
| 17 | `/admin/content/menus` | menu editor, link form | AdminPage | ☐ |
| 18 | `/admin/content/metaobjects` | custom content | AdminPage | ☐ |
| 19 | `/admin/payments` | merchant payments panel | AdminPage | ☐ |
| 20 | `/admin/online-store` Store designs | gallery, upgrade panels | AdminPage | ☐ |
| 21 | `/admin/online-store/preferences` | password page settings | AdminPage | ☐ |
| 22 | `/admin/online-store/editor` | theme editor | full screen, own design | out of scope (see below) |
| 23 | `/admin/settings` index | `settings/page.tsx`, `settings/layout.tsx` | settings frame | ☐ |
| 24 | `/admin/settings/general` | general form | AdminPage | ☐ |
| 25 | `/admin/settings/shipping` | shipping | AdminPage | ☐ |
| 26 | `/admin/settings/notifications` | order emails | AdminPage | ☐ |
| 27 | `/admin/settings/custom-data` | extra fields | AdminPage | ☐ |
| 28 | `/admin/settings/developers` | developer tokens | AdminPage | ☐ |
| 29 | `/admin/design-kit` | kit demo (not in menu) | AdminPage | ☐ |
| 30 | `/admin/onboarding`, `/admin/store-design` | redirects only | – | n/a |

Outside the admin frame (entry pages): `/login`, `/signup`, `/onboarding`. They share the Jelly identity but not the shell; restyled only if time allows.

**Analytics and reports:** there is no separate analytics page; sales figures, the chart and "orders that need you" live on Home. A dedicated Analytics page would be new functionality (not part of a UI-only redesign).

## Shared frame

| Part | File |
| --- | --- |
| App shell (sidebar, header, canvas, drawer) | `components/layout/app-shell.tsx`, `admin-shell.css` |
| Navigation list | `components/layout/admin-nav.tsx` (`ADMIN_NAV`, `ADMIN_SETTINGS`) |
| Page search (Ctrl/Cmd+K) | `components/layout/admin-search.tsx` |
| Account menu | `components/layout/account-menu.tsx` |
| Light/dark toggle | `components/layout/admin-theme-toggle.tsx` |

## Admin kit components (`components/admin/`)

AdminPage, MoreActions, Card, DetailLayout, Button/buttonClass, Tabs, Combobox, IndexTable (tabs, search, filters, sort, bulk bar, paging, skeleton, phone cards), ResourceForm, Field, SaveBar, StatusBadge + status map, Banner, EmptyState, HelpTip, CardSkeleton/TableSkeleton/SkeletonBlock, Toast, ConfirmDialog, Picker, TagInput, SelectList/SplitLayout, useClientList.

Page-level patterns in CSS: KPI tiles (`jk-kpi`), sales chart (`jk-chart`), setup guide, settings tiles, metrics boxes, side sheets (`jk-sheet`), native dialogs (`jk-native-dialog`), save bar, product builder frame (`jk-builder`).

## Out of scope

- The online-store theme editor (`/admin/online-store/editor`): full-screen tool with its own design language and many open hookups; restyling it is a separate project.
- Storefront themes (shopper-facing).
</content>
</invoke>

## Baseline (2026-11-14, before any redesign change)

- Typecheck: no errors in the source. `tsc` reports 2 errors only from stale generated route types in `.next/dev` vs `.next/qa` (left over from two dev servers); not code.
- Lint (admin folders): 7 errors, 27 warnings, all pre-existing (`react-hooks/set-state-in-effect`, `refs`, `preserve-manual-memoization` in `orders/page.tsx`, `orders/[id]/view.tsx`, `products/collections/page.tsx`; `<img>` warnings).
- Unit tests (admin, kit, product builder, bulk, commerce folders): 68 files, 412 tests, all passing.
