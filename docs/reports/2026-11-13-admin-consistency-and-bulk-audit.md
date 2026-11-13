# Admin consistency and bulk product management: audit

13 November 2026. Phase 1 of the "modern SaaS admin polish and bulk product management" brief. Read-only: no application code was changed.

## How this was checked

- **Code read:** all 31 admin routes under `jellyshops/src/app/admin/`, the admin kit (`src/components/admin/`), `admin-kit.css`, `admin-shell.css`, `admin.css`, the feature components the pages draw (`features/admin`, `commerce/components`, `content`, `navigation`, `product-builder`, `developer-tokens`, `storefront-access`, `theme-upgrade`), and the backend catalogue, media, audit and worker code.
- **Counted by script:** kit imports, old class names, hard-coded colours, `window.confirm`, list features (search, tabs, filters, bulk, paging) per page.
- **Not checked in a browser.** The local frontend and backend were started, but the admin redirects to the sign-in page and I do not type passwords. Everything about 375px, 768px and dark mode below is therefore **read from the code, not seen**. Section 7 lists the pages I would open first once you are signed in.
- Tests were not run (nothing changed).

Two set-up problems were found and fixed on the way (neither is application code):

1. `jellyshops/node_modules/@jelly/*` were empty folders, so `next dev` failed with "Can't resolve '@jelly/storefront-schema'". `npm install` in `jellyshops/` relinked them (the lock file change it made was reverted).
2. The backend would not start: `backend/.env` points `SUPABASE_DATABASE_CA_FILE` at the old `C:\Users\...\OneDrive\...` folder. The file exists in `backend/.data/`. I did not edit `.env`; `.claude/launch.json` ("jellyshops-backend") now sets the path relative to the backend folder. You may want to correct `.env` too.

## 1. Summary

The admin is in better shape than the brief assumes. 27 of 31 routes already use `AdminPage` and kit parts, and no page file still uses the old `admin-card` / `form-card` / `.field` classes directly. What is left is concentrated in six places:

1. **The product builder's sections** are the largest island of non-kit styling: about 190 lines of hand-written utility classes (`rounded-xl border border-border bg-muted/25 text-[12px]`) across 17 section files. They read shadcn variables (`--border`, `--muted`), which `admin.css` keeps alive only for them.
2. **Four embedded panels** still use old classes: developer tokens, password page settings, stock history drawer, and parts of the menu link form and product organisation card.
3. **Store designs page and the two upgrade panels** use hard-coded palette colours (amber/emerald/red utility classes): the only place in the admin where dark mode is likely to be wrong.
4. **Content list pages** (Pages, Blog posts, Menus, Custom content, Messages) have no search, sort or paging, and several have no way to delete.
5. **Confirmations and save feedback are uneven**: the Store designs page still uses the browser's `window.confirm`; the order page uses its own native dialogs; Order emails and Custom data show messages in a banner instead of a toast.
6. **Bulk product management does not exist** beyond three bulk status changes and "Add to collection" on the current page of the list. There is no import, no export, no bulk price/stock/tag edit, no backend bulk endpoint, no job runner for long work and no spreadsheet library.

## 2. Page-by-page inventory

Legend: **Kit** = built from kit components. **Mixed** = kit frame, older styling inside. **Old** = not on the kit. States: L = loading skeleton, E = empty state with next step, R = error with Retry.

| Route | Styling | List features | States | Notes |
| --- | --- | --- | --- | --- |
| `/admin` (Home) | Kit | n/a | L E R | Good. |
| `/admin/orders` | Kit | tabs, search, filters, sort, bulk (CSV, packing slips), paging | L E R | Good. 456 lines in one file. |
| `/admin/orders/:id` | Mixed | n/a | L R | 827-line `view.tsx`. Uses `AdminPage`, `Banner`, `StatusBadge`, but its own native `<dialog>`s (`.jk-native-dialog`) for refund/cancel/edit rather than `ConfirmDialog`. No toast after actions. |
| `/admin/products` | Kit | tabs, search, sort, bulk (status x3, add to collection), paging | L E R | No filters (type, brand, collection, tag, stock). No export/import. Bulk works on the visible page only (50). Price column shows the first variant, not the lowest. Bulk Archive runs with no confirm (row Archive has one). |
| `/admin/products/new`, `/:id` | Mixed | n/a | L R | Kit frame, banners, save bar. Sections are hand-styled (see 3.1). |
| `/admin/products/collections` | Kit | search | L E R | No paging, sort, bulk or delete. Edit form is in a side sheet. |
| `/admin/products/inventory` | Kit | tabs (All/Low/Out), search, paging, bulk save | L E R | No sort; no export. Stock history drawer is old-styled. |
| `/admin/products/reviews` | Kit | tabs, bulk, confirm on delete | L E R | No search, no paging. |
| `/admin/customers` | Kit | tabs, search, bulk (CSV), paging | L E R | No sort or filters. |
| `/admin/customers/new`, `/:id` | Kit | n/a | L E R | No delete (by design?). |
| `/admin/customers/messages` | Kit | none | L E R | No search, paging or mark-as-read; fine while volumes are small. |
| `/admin/content/pages` | Kit | none | L E | No search, no delete, no Retry on load failure (banner only). |
| `/admin/content/blogs` | Kit | none | L E | Same as Pages. |
| `/admin/content/files` | Kit | tabs, search, bulk delete with confirm, paging | L E R | Good. Upload is a button, not drag and drop. |
| `/admin/content/menus` | Kit | none | L E R | Menu link form has 8 old-class uses. Remove link has no confirm. |
| `/admin/content/metaobjects` | Kit | none | L E | No Retry. One hand-styled block. |
| `/admin/payments` | Kit | n/a | L E R | Good. |
| `/admin/online-store` (Store designs) | Mixed | filter chips | L R | `window.confirm` when switching design; 17 utility-class blocks; hard-coded colours. File is stored CRLF. |
| `/admin/online-store/preferences` | Mixed | n/a | - | Kit page wrapping `access-settings.tsx`, which is old-styled (7 old-class uses) with no loading skeleton. |
| `/admin/online-store/editor` | Own design | n/a | L R | Full-screen editor. Out of scope (its own design system), but it has 8 `window.confirm` calls. |
| `/admin/settings` | Kit | n/a | - | Tile index. Good. |
| `/admin/settings/general` | Kit | n/a | L R | Good; has HelpTips. |
| `/admin/settings/shipping` | Kit | n/a | L R | Good. |
| `/admin/settings/notifications` (Order emails) | Kit | n/a | L | Saves report in a banner, not a toast; no unsaved-changes bar; "Logo URL" asks for a web address instead of a picker; no Retry. Source is minified-style and hard to maintain. |
| `/admin/settings/custom-data` | Kit | tabs | L E R | Read-only list: fields can only be created from inside the product builder. Shows `namespace.key` and an error like "Custom data request failed (404)". |
| `/admin/settings/developers` | Mixed | n/a | - | Kit page wrapping `developer-tokens-settings.tsx` (old classes, own table). |
| `/admin/design-kit` | Kit | n/a | - | 71 lines. Does not show `SelectList`, `SplitLayout`, `TagInput`, chips, sheet, save bar states or the form field variants. Not in the menu (intended). |
| `/admin/onboarding` | Old | n/a | - | 14-line placeholder page; not linked from the menu. |
| `/admin/store-design` | Redirect stub | n/a | - | 5 lines. |

### Where old styling still lives (by file)

| File | Old classes | Hand-written utility styling |
| --- | --- | --- |
| `features/product-builder/sections/*` (17 files) | 9 | about 190 lines |
| `features/product-builder/buyer-preview.tsx`, `metafields/*` | 0 | about 40 lines |
| `features/developer-tokens/developer-tokens-settings.tsx` | 5 | - |
| `features/storefront-access/access-settings.tsx` | 7 | - |
| `features/navigation/components/menu-link-form.tsx` | 8 | - |
| `features/admin/components/stock-history.tsx` | 1 | 4 lines |
| `features/content/components/seo-fields.tsx` | 0 | 22 lines, 4 hard-coded colours |
| `features/theme-upgrade/*.tsx` (2 files) | 0 | 18 lines, 21 hard-coded colours |
| `app/admin/online-store/page.tsx` | 0 | 17 lines, 4 hard-coded colours |

The "older class names" block at the end of `admin-kit.css` (lines 463-483) and all of `admin.css` (89 lines) can be deleted once the files above are moved. About half of `admin.css` (`.admin-table`, `.admin-toolbar`, `.admin-savebar`, `.admin-photo-grid`, `.admin-product-layout`, `.admin-settings-nav`, `.admin-status`) already looks unused; that needs a usage check before deleting.

### Raw codes and internal words still shown

- Custom data: `namespace.key` under every field name; the field type goes through `humanizeCode` (acceptable); error text includes the HTTP status.
- Order emails: fine (types are mapped to labels).
- Pages/blog SEO: "Canonical override" (under Advanced), "Handle", "URL handle".
- Product builder: "HS code", "SKU", "Barcode (ISBN, UPC, GTIN, etc.)", "Product organization" (US spelling; the admin is otherwise UK).
- The `no-raw-codes` test covers Orders and Products only. It should cover every list page.

### Responsive and dark mode (from code only, not seen)

Likely fine: every `IndexTable` page (phone card mode), Home, Settings, Customers, Files.

Likely problems to confirm in a browser:

- **Product builder variants table** has `min-width: 680px` inside a scroll box: at 375px merchants scroll sideways to edit prices and stock. It should become cards on phones like `IndexTable`.
- **Order detail** at 375px: many action buttons in the header and native dialogs with fixed inner layouts.
- **Developer tokens** has its own table with no phone layout.
- **Dark mode:** theme upgrade panels and the Store designs page use fixed amber/emerald/red utility colours; builder sections depend on the shadcn variable block in `admin.css` (it has a dark variant, so probably acceptable, but contrast was never measured).
- The automated axe tests run in jsdom, which does not check colour contrast. No admin page has a real-browser contrast check.

## 3. Gap list against the feature checklist

### 4A Consistent design system, light/dark, responsive: **partial**

- Exists: kit components, `--jk-*` tokens (colour roles, spacing, type scale, radius, shadow, focus colour), dark mode, phone cards for tables, shell.
- Partial: builder sections, four embedded panels, Store designs, upgrade panels (section 2).
- Missing tokens: motion (durations/easing are written per rule), a named focus-ring token (each rule repeats `outline: 2px solid var(--jk-focus)`), z-index scale, a "destructive solid" colour pair in dark mode worth checking.
- Missing: `docs/admin-design-guide.md`; a complete `/admin/design-kit`.

### 4B Plain language, tooltips, loading/success/error/confirm states: **partial**

- Exists: `StatusBadge` + `status.ts` (96 lines of labels), `HelpTip`, `Toast`, `ConfirmDialog`, `Banner`, skeletons.
- Partial: `HelpTip`/help text is used in only a handful of places (General, customer form, SEO fields, collections, menus, blogs). Toasts on 8 pages; the rest use banners or nothing. `ConfirmDialog` on 4 pages; others use `window.confirm`, native dialogs or no confirm (menu link removal, bulk archive, collection changes).
- Missing: button loading state as a kit feature (each page writes "Working…" itself); required-field marker on `Field`; quiet/destructive button variants documented; inline field errors wired from API validation codes.

### 4C Product create/edit: **mostly exists, needs polish**

- Exists: single builder; sections Basics, Photos, Pricing, Inventory, Choices, Variants, Shipping, "More details" (collapsed: personalisation, quantity rules, custom fields), Search listing, Organisation; photo upload with progress, reorder (drag between photos, and Move up/down buttons), alt text, replace, library, per-option photo tagging (behind a per-store switch); validation summary on save; Duplicate; Archive with confirm; quick status change from the list.
- Partial: drag-and-drop works for **reordering** photos but there is no drop zone for **uploading** files from the desktop (upload is a file button). Validation appears on save, not inline as you type. Restore from archive exists only as "Set as active" in the list menu, not in the builder.
- Missing: progress/checklist indicator for first-time use, "ready to publish" summary, SKU-duplicate warning, SEO length hints as you type, price-format suggestions, per-file size/type error wording check.
- Decision already made in the backend: there is **no product delete route** at all. Archive is the only removal. The brief's "nothing is hard-deleted without a confirm" is satisfied by absence; say if you want real delete.
- Known bug from project notes still listed: variant price fields show ₹ on a £ store (not re-verified).

### 4D Bulk import / export / edit: **missing**

| Requirement | Today |
| --- | --- |
| CSV/xlsx import, templates, README sheet | Nothing. No parsing library in either `package.json` (frontend or backend). |
| Column mapping, validation, preview, confirm, progress, results, error report | Nothing. |
| Match by SKU or handle; Create only / Update only / Create or update | Nothing built, but the database already supports it: a variant's SKU is unique per store (index `ProductVariant_storeId_sku_key`; variants without a SKU are allowed), and a product's handle is unique per store (`Product_storeId_slug_key`). |
| Background job with progress | No general job runner. The only background work is the order worker: a scheduled Firebase Function every minute that claims rows with `FOR UPDATE SKIP LOCKED` (`commerce/order-runtime.ts`). The API function has a 60-second timeout, 1 GiB memory, and a 2 MB JSON body limit (theme uploads have their own larger limit). An import must therefore upload a file to media storage and be processed in chunks by a worker. |
| Auditable; undo | An `AuditEvent` module exists (`backend/src/audit/`). Undo is feasible for **created** products (archive them) and, with a stored before-snapshot per changed row, for updates; needs a table. |
| Rate limits | Pattern exists (in-memory, per store + address) in reviews, back-in-stock, password page. |
| Formula injection on export | The two existing CSV exporters (`orders-csv.ts`, `customers-csv.ts`) quote cells but do **not** prefix `= + - @`. This is a small existing security gap to fix with the shared exporter. |
| Images from https URLs with SSRF guard | Nothing. Media upload goes browser to API only; `sharp` and `multer` are installed, so processing and multipart upload are available. |
| Bulk image upload matched by file name | Nothing. |
| Export all / selected / filtered | Nothing for products. Orders and customers export the selected rows on the visible page, built in the browser. |
| Bulk edit price/stock/status/collections/tags/vendor/type with before/after preview | Only status and "add to collection", sent as one request per product from the browser (`Promise.allSettled`), no preview. `features/product-builder/bulk.ts` has tested maths for setting price/stock/cost/weight across a product's own variants; it can be reused but has no add/subtract/percent. |
| Stock per location | Not supported (single stock pool). Columns would be one "Stock" column. |
| Cost, weight, compare-at, tags, vendor, type, SEO | All exist in the product model (`backend/src/catalog/types.ts`). |

### 4E Standard components, searchable dropdowns, list features, empty states, onboarding: **partial**

- Exists: `IndexTable` (tabs, search, filters slot, bulk bar, paging, skeleton, error + Retry, phone cards), `Picker` (searchable modal), `EmptyState` on 15 pages, setup guide on Home.
- Partial: sorting is a separate `<select>` per page, not sortable column headers; bulk selection covers only the current page (no "select all 240 matching"); `Picker` is a modal, there is no inline searchable dropdown (combobox) for short lists such as type, brand, country, time zone; tabs use `role="tablist"` without arrow-key movement.
- Missing: list features on Content pages (table in section 2); onboarding hints beyond Home.

### 4F JellyShop identity: **exists, slightly split**

- The kit has its own look: dark top bar, violet brand `#6447e8`, Inter, 12px cards.
- Two accent ideas are in use: primary buttons are charcoal (`--jk-accent: #303030`), while brand violet marks navigation and highlights. Charcoal primary buttons are also what Shopify uses, so this is the one place where the admin looks borrowed. Decision D3 below.

## 4. Confusing settings and proposed wording

| Where | Today | Proposed label | Helper text | Default |
| --- | --- | --- | --- | --- |
| Builder > Pricing | "Original price" | "Price before discount" | "Shown crossed out next to the price. Leave empty if the product is not on sale." | empty |
| Builder > Pricing | "Unit pricing", "Total amount unit", "Unit to show the price per" | "Show price per unit (for example per 100 g)" | "Needed for food, drink and cosmetics in the UK and EU." | off, collapsed |
| Builder > Pricing | "Margin", "Profit", cost | "What it costs you" | "Only you see this. Used to show your profit." | empty |
| Builder > Inventory | "SKU — your stock code" | "Stock code (SKU)" | "Your own code for this item. Used to match products when you import a spreadsheet." | empty |
| Builder > Inventory | "Barcode (ISBN, UPC, GTIN, etc.)" | "Barcode" | "The number under the barcode on the packaging, if it has one." | empty |
| Builder > Inventory | "Low stock warning at" | "Warn me when stock falls to" | "The product shows as running low on Home and Inventory." | store default |
| Builder > Shipping | "HS code" | "Customs code (HS code)" | "Only needed if you ship abroad." | collapsed |
| Builder > Shipping | "Country or region of origin" | "Where it was made" | "Shown on customs forms." | store country |
| Builder > Search listing | "URL handle" / "Handle" | "Web address ending" | "The last part of the product's link. Changing it breaks old links." | from the name |
| Builder > Search listing | "SEO title", "SEO description" | "Title in search results", "Description in search results" | Length hint with a live counter. | from name/description |
| Pages/Blog SEO | "Canonical override" | "Original page address (advanced)" | "Only fill this in if the same content lives on another address." | empty, collapsed |
| Builder | "Product organization" | "Organisation" | - | - |
| Builder | "Personalisation", "Quantity rules" | keep | Add one-line examples: "Let shoppers add a name or message", "Sell only in packs of 6". | collapsed |
| Custom data | `namespace.key` under each name | hide by default; "Show technical name" toggle | "Store designs use the technical name to show this field." | hidden |
| Order emails | "Logo URL" | "Logo" with a picker from Files | "Shown at the top of each email." | store logo |
| Order emails | "Reply-to email" | "Replies go to" | "Customers who reply to an order email reach this address." | store contact email |
| Settings > Developers | "Developer tokens" | "Access keys for developers" | "Lets a developer upload a store design without your password. You can switch a key off at any time." | - |
| Preferences | password page | "Private store (password)" | "Only people with the password can see your store. Use this before you launch." | off |
| Payments | "Payment readiness" | "Can you take payments?" | Plain yes/no line first, details under it. | - |
| Products list | "Brand or supplier" column, "Type" | keep; empty shows "None" | - | - |
| Inventory | "Reserved" | "In open orders" | "Paid for or in a checkout, not yet sent." | - |

## 5. Proposed phase order

Sizes: S = up to a day of work, M = two to three days, L = about a week.

| Phase | Content | Size |
| --- | --- | --- |
| 2a | Kit gaps: button loading state and variants, `Field` required marker and inline errors, inline searchable dropdown (combobox), sortable column headers, tab arrow keys, motion/focus/z-index tokens. Complete `/admin/design-kit`. Write `docs/admin-design-guide.md`. Extend `no-raw-codes` test to all list pages. | M |
| 2b | Move embedded panels and pages onto the kit: developer tokens, password settings, stock history, menu link form, SEO fields, upgrade panels, Store designs, order emails (with toast + save bar), custom data wording. Replace `window.confirm` in the admin (not the editor) with `ConfirmDialog`. Delete unused `admin.css` rules. | M |
| 2c | List pages: search/paging on Pages, Blog posts, Reviews, Collections; filters on Products (type, brand, collection, tag, stock) and Customers; confirm on bulk archive; Retry where missing. | M |
| 2d | Product builder sections onto kit classes (17 files, largest single piece) and variants table as phone cards. Then delete the legacy block in `admin-kit.css` and the shadcn variable block. Browser pass at 1440/768/375, light and dark. | L |
| 3 | Builder polish: drop zone upload, inline validation, checklist, ready-to-publish summary, wording from section 4, restore in the builder. | M |
| 4-design | `docs/plans/bulk-products.md` (data model, format, limits, job runner, security). Stop for approval. | S |
| 4a | Export (CSV first) + shared CSV writer with formula-injection guard, also applied to orders and customers. No migration needed. | S |
| 4b | Import: upload, mapping, validation, preview, job table + worker, results and error report. Needs a migration and a parsing library. | L |
| 4c | Bulk edit from the list with before/after preview; backend bulk endpoint; "select all matching". | M |
| 4d | Images: import from https URLs with SSRF guard; bulk upload matched by file name. | M |
| 5 | Navigation and guidance, five-task walkthrough. | M |
| 6 | QA, docs, signed-in checklist. | M |

I recommend splitting Phase 2 into 2a-2d with a commit and report after each, because 2d alone touches 17 builder files.

## 6. Decisions needed from you

- **D1. Excel (.xlsx) library.** None is installed. Options: (a) `exceljs` on the backend (reads and writes, maintained, about 1 MB); (b) CSV only for now, xlsx later; (c) SheetJS community build (not published on npm any more; installing from their CDN is awkward for CI). I recommend (a), read and written on the backend only. A CSV parser can be written in-house (small, well tested) or use `papaparse`; I recommend `papaparse` for tolerance of odd files. Both need your approval as new dependencies.
- **D2. Where imports run.** The API function stops at 60 seconds. I recommend a job table processed by the existing one-minute scheduled worker in chunks (safe to re-run), rather than a new queue service. Needs one migration (job + per-row results + before-snapshots for undo).
- **D3. Primary button colour.** Keep charcoal, or make the primary button the jelly violet (`--jk-brand`) so the admin looks less like Shopify? I recommend violet for the one primary action per page, charcoal nowhere.
- **D4. Product delete.** Keep archive-only (current), or add a real delete with a confirm for products that have never been ordered?
- **D5. Matching rule for imports.** SKU is already unique per store in the database, and many variants have none ("No SKU"). Proposal: match a variant by SKU when the row has one; otherwise match the product by handle and the variant by its option values; a SKU that appears twice in the file is an error. Alternative: require a SKU on every row (simpler rule, but merchants without SKUs cannot update by file).
- **D6. Scope of "every page on the kit".** Is the full-screen theme editor excluded (my assumption)? It has its own design and 8 `window.confirm` calls.
- **D7. Import limits.** Proposal: 5,000 rows and 10 MB per file, 30 images per product, image files up to 10 MB, https only.
- **D8. Browser check.** To check 375/768/dark I need you to sign in once in the browser pane on `localhost:3210` (local frontend and backend, staging data, read-only).
- **D9. `/admin/onboarding`** is a 14-line unused placeholder. Delete it, or build onboarding there in Phase 5?

## 7. Pages to open first in the browser check

Product builder (variants table, photos) at 375px; order detail at 375px; Store designs and the upgrade panels in dark mode; Developer tokens at 375px; Order emails; Custom data; then every list page at 768px.
