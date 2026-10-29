# Template system analysis (before the Bed Showroom template)

Date: 2026-10-29. Branch `local/task3`. Analysis only: no code was changed.

How this was checked: I read the code paths listed under each finding and ran the related tests (backend `src/storefront`: 35 files, 108 tests passed; frontend editor, online-store admin, registry, renderer and schema: 63 files, 326 tests passed). I did **not** open the editor in a browser or test against staging for this report, so anything about on-screen behaviour is from the code, not from watching it. The Shopify comparison uses Shopify's documented Online Store 2.0 model (JSON templates, sections and blocks, alternate templates, theme library), not a fresh web study.

Status labels used below:

- **Working**: code path exists end to end and has tests.
- **Partial**: some layers exist, but a merchant cannot use it fully from the admin.
- **Missing**: not built.
- **Unverified**: built, but not checked in a running app for this report.

---

## 1. Current system overview

A Jelly Shop storefront is built from five layers. The same renderer draws the editor preview and the live store.

```text
Theme (look)            packages/storefront-themes/src/<theme>/definition.ts + src/app/themes/<theme>.css
  └ Starter pack        packages/storefront-registry/src/v4-starter-packs.ts  (a whole store design: templates, shared header/footer, menus, theme settings)
      └ Page template   one per page type, stored in the "StorefrontTemplate" table (type + handle + layout JSON)
          └ Section     registry definition (settings, editor controls, allowed pages) + renderer component
              └ Block   small repeatable item inside a section (slide, testimonial, FAQ item, tab, link…)
```

**Data and storage (backend, `backend/src/storefront/`)**

| Table | Holds |
| --- | --- |
| `StorefrontWorkspace` | the store's draft, with a `generation` number that goes up on every change |
| `StorefrontTemplate` | page templates: `type` (home, product, collection, page, cart, checkout, account pages…), `handle` (`default` or another name), `name`, `layout` (list of sections, inline or a link to a shared section) |
| `GlobalSection` | shared sections (header, footer, announcement) used by many templates |
| `SectionPreset` | saved sections a merchant can insert again |
| `NavigationMenu` | menus |
| `ThemeConfiguration` | chosen theme id, version and global settings |
| `StorefrontTemplateAssignment` | "this product/collection/page/blog/article uses that template" |
| publications | immutable compiled snapshots plus an "active publication" pointer |

Every row has a `revision`; saves send the revision they started from, and the server refuses a stale save (409). Each write runs in a transaction that locks the workspace and bumps `generation`.

**Flow today**

1. *Online store > Templates* (`src/app/admin/online-store/page.tsx`) lists starter packs. "Use this template" installs one (`starter/installation-service.ts`): it writes every page template, shared header/footer, menus and theme settings, and for complete themes seeds draft information pages.
2. *Customize* opens the editor (`src/app/admin/online-store/editor/page.tsx`). The merchant picks a page in the page picker, adds/removes/hides/drags sections, edits settings in the inspector, edits theme settings, and switches Desktop/Tablet/Mobile preview.
3. Every edit is saved automatically through a revision-checked save queue (`state/revisioned-save-queue.ts`). The live store does not change.
4. *Publish* (`components/publish-controls.tsx`) asks the backend to compile the whole draft (`compiler/compiler.ts`: registry check, references, page context, dynamic bindings). If there are errors, the editor lists them and can jump to the section. If clean, a snapshot is saved and made active.
5. The live store (`features/storefront/resource-loader.ts`) reads the active snapshot: an assigned template for that product/collection/page if one exists and has the right type, otherwise the `default` template for that page type.

**Dynamic data.** Sections that show catalogue content take a product or collection picker, or a *dynamic binding* to a resource field or a custom field (metafield) on product, variant, collection, page, blog, article or store (`storefront-schema/src/dynamic-sources.ts`, validated at publish by `compiler/validate-bindings.ts`). Custom field definitions are managed under *Settings > Custom data*.

---

## 2. Architecture review

**What is well designed (keep it)**

- **One renderer for preview and live.** Removes the biggest source of "looks different after publishing" bugs.
- **Draft vs published separation.** Workspace generations, immutable snapshots, idempotent publish, and a compile step that catches broken references before customers see them. This is stricter than Shopify, where a broken JSON template can still be saved.
- **Registry-driven sections.** Each section declares its settings schema, editor controls, allowed page types and allowed region. Adding a section type is one registry file + one renderer file. This is the right shape for new business categories.
- **Theme = look, not markup.** Themes style shared markup through tokens and scoped CSS. New themes don't fork sections.
- **Tenant isolation.** Every route is `/api/stores/:storeId/...` with a permission check; every query filters on `storeId`.
- **Optimistic concurrency** on every record, with clear 409 conflicts.

**Structural weaknesses**

1. **Four document formats still exist.** `schema.ts` (v1 store design), `storefront-v2.ts` (v2/v3 document) and `runtime-v4.ts` (current). The v1/v3 types are still referenced by `document-validator.ts`, `public-storefront-api.ts` and `server-storefront.ts`. New work only uses v4; the older formats add reading load and risk of someone editing the wrong one. Recommend marking them legacy and removing once old stores are migrated (needs a staging data check first).
2. **Validation of layouts happens only at publish.** `createTemplate`/`updateTemplate` accept any JSON object as `layout` (`template-service.ts`, `normalizeLayout` only checks "is an object"). A bad layout is saved silently and only reported when the merchant presses Publish. A light shape check on save (section ids, known types, allowed page) would give earlier, clearer errors.
3. **The publish compile covers every template ever created**, including the `previous-…` templates kept after switching starter packs (`validate-registry.ts` loops over `input.templates`). An old, unused template with a now-invalid section would block publishing the current design, and merchants have no way to see or delete it.
4. **Starter pack version is written as the theme version.** `installation-service.ts` stores `pack.version` in `ThemeConfiguration.themeVersion`. Both are `1.0.0` today, so nothing is broken, but bumping a starter pack's version would make stores fall back to the default theme (the "never bump a theme version" rule). These should be separate values.
5. **Per-device settings are declared but not built.** Sections and blocks have a `responsive.mobile` field and some controls are flagged `responsive: true`, but neither the editor nor the renderer reads them. Responsiveness today is CSS only. This is fine and simpler, but the unused fields should either be built or removed so they don't mislead.
6. **Two meanings of "template".** The admin page called *Templates* actually lists starter packs (whole store designs, what Shopify calls themes), while the backend and editor use "template" for a single page layout. This is the main source of confusion for both merchants and developers (see section 6).

---

## 3. Shopify comparison

| Shopify concept | Jelly Shops today | Do we need it? |
| --- | --- | --- |
| Theme library (several themes, one live, duplicate a theme) | One draft workspace per store; switching starter pack replaces the draft (old page templates kept, hidden) | **Simplified version yes**: "Duplicate current design" / restore previous, not a full library |
| JSON templates per page type | Same (`StorefrontTemplate` with type + layout) | Have it |
| Alternate templates (`product.mattress.json`) assigned per product | Backend and live store support it (handle + assignment); **no admin UI to create one or assign it to a product or collection** | **Yes, core for the showroom** (beds vs mattresses vs accessories) |
| Sections everywhere, blocks inside sections | Same; sections restricted per page type | Have it |
| Section groups (header/footer groups) | Shared ("global") sections | Have it, simpler |
| Section presets | `SectionPreset` table + insert from library | Have it |
| Global theme settings (`settings_schema.json`) | `settingsSchema` per theme, Theme settings panel | Have it, curated and shorter (good) |
| Dynamic sources / metafields | Dynamic bindings + custom data | Have it in engine; few section settings accept bindings |
| App blocks / theme app extensions | Not built | No, not needed now |
| Nested blocks, unlimited block types per section | One level of blocks, fixed per section | No, keep it simple |
| Per-device setting overrides | Fields exist, not wired | Optional; CSS-only is acceptable |
| Undo/redo, live preview, desktop/mobile preview | Built (session-only history) | Have it |
| Draft/publish, schedule publishing | Draft/publish built; no scheduling | Scheduling not needed now |
| Product reviews (via apps) | Testimonials section only (static quotes) | Reviews: later, real data needed |
| Theme code editor | None | No, by design |

**What Shopify does better that matters for us:** alternate templates with a one-click "Create template from this one" and a template dropdown on the product/collection form; duplicating a theme before experimenting; plain naming ("Theme", "Template", "Section").

**What we should not copy:** the code editor, app blocks, nested blocks, Liquid-level flexibility, and large settings schemas.

---

## 4. Existing functionality

| Feature | Status | Evidence |
| --- | --- | --- |
| Install a starter pack (fresh store) | Working | `installation-service.ts`, `routes.test.ts`, `template-library.test.tsx` |
| Replace current design with another starter pack | Working (with caveats below) | same; confirm dialog in `online-store/page.tsx:74` |
| Change theme (look only) | Working | `selectTheme` in `online-store/page.tsx` |
| Open a page type in the editor; create its default template if missing | Working | `editor/page.tsx:913-950` |
| Add section from library (filtered by page type and region) | Working | `listSectionDefinitionsForPage`, `insertBuiltIn` |
| Remove, hide/show, drag to reorder sections | Working | `template-hierarchy.tsx` (dnd-kit), `toggleSection`, `removeSelectedSection` |
| Add/edit blocks | Working | `addBlock`, inspector |
| Click section in preview to select; selected section scrolls into view | Working (Unverified in browser for this report) | `preview-canvas.tsx`, `editor/page.tsx:175-190` |
| Shared header/footer ("Make global", detach) | Working | `makeGlobal`, `detachGlobal`, `global-section-panel.tsx` |
| Section presets | Working (backend + insert); no UI to name/save a preset found in editor | `presets` routes |
| Theme settings panel | Working | `theme-inspector.tsx` |
| Autosave with conflict detection, retry, download local changes, leave-page protection | Working | `revisioned-save-queue.ts`, `editor/page.tsx:192-225, 980` |
| Undo / redo | Working, session-only, per template | `createSessionHistory`, `playHistory` |
| Desktop / tablet / mobile preview in an iframe | Working | `storefront-preview-frame.tsx` |
| Preview with a real product/collection/page | Working | `editorPreviewResourceOptions`, product/collection detail loaders |
| Validate + publish with diagnostics that jump to the problem | Working | `publish-controls.tsx`, `publish-diagnostics` |
| Assign a template to a page or blog article | Working | `admin/content/pages/page.tsx:104`, `admin/content/blogs/page.tsx:158` |
| Live store honours assignments and defaults | Working | `resource-loader.ts:150-162` |
| Custom fields bound into sections | Working in engine; limited by which controls accept bindings | `dynamic-sources.ts`, `validate-bindings.ts` |

---

## 5. Missing features

| Feature | Status | Notes |
| --- | --- | --- |
| Create an alternate template ("Mattress product page") | **Partial** | `POST /templates/:id/clone` exists and the client has `cloneTemplate`, but no screen calls it |
| Assign a template to a product or collection | **Partial** | Backend + live store support it; product form, product builder and collection form have no template picker |
| Rename a template | **Partial** | API accepts `name`; no UI |
| Delete a template | **Missing** | No route, no service method, no UI. Retired `previous-…` templates pile up forever |
| Remove an assignment (back to default) | **Missing** | Only upsert exists |
| Duplicate whole design / restore previous design | **Missing** | Old templates are kept but hidden; no restore |
| Save a section as a preset from the editor | **Partial** | API exists; not exposed as a clear action |
| Per-device (mobile) settings | **Partial** | Fields declared, never read |
| Product reviews with real ratings | **Missing** | Only static testimonials |
| Product specifications table | **Partial** | Possible via custom fields, but no section shows a list of spec rows, and `info-tab` text does not accept bindings |
| Colour/fabric swatches | **Missing** | Deferred in Avenue phase 3 |
| Slide-out cart | **Missing** | Header bag links to cart page |
| Schedule publish, version history/rollback UI | **Missing** | Publications are kept, so rollback is technically possible later |

---

## 6. UI/UX review

**Good:** plain labels from `labels.ts`; curated theme settings; settings grouped into content/layout/style/advanced; sections filtered per page; drag reorder; autosave with clear "Saved / Saving / Not saved"; friendly recovery when a save fails.

**Problems:**

1. **"Templates" means two different things.** The admin page "Online store / Templates" shows whole store designs; inside the editor "template" means one page layout. Merchants will not know whether "Use this template" replaces one page or the whole store (it replaces the whole draft). Recommend: call starter packs **Store designs** (or "Themes"), and keep **Template** for page layouts.
2. **The ideal flow from the brief (Create template → Select type → Configure → Customize → Preview → Save → Publish/Assign) stops at step 1 for alternate templates.** Today a merchant can only edit the one default template per page type.
3. **Technical names leak:** shared sections are auto-named `Global product-grid` (`editor/page.tsx:542`); "Make global" is developer wording ("Use on every page" / "Shared section" is clearer). Starter install's confirm text mentions "page assignments".
4. **Replacing a design silently removes all page/article template assignments** (`installation-service.ts`, `DELETE FROM "StorefrontTemplateAssignment"`). The dialog mentions it, but does not say how many or which.
5. **No "unsaved vs published" indicator per page.** The merchant sees "Saved" but not "Saved, not yet live". Shopify shows this clearly.
6. **Undo history is lost on reload** and is per page; theme-setting changes are undone only from the page where they were made. Acceptable, but should be stated in the UI tooltip.

---

## 7. Theme editor integration

| Check | Result |
| --- | --- |
| All registered sections editable visually | Working: inspector renders controls from the registry for any section/block |
| Changes appear in preview | Working: preview re-renders from the draft; on Preview/Publish it uses the compiled snapshot |
| Section selection and highlighting | Working in code; Unverified in browser for this report |
| Add, remove, hide, reorder | Working |
| Settings saved correctly | Working (revisioned save queue, tests pass) |
| Draft vs published | Working |
| Desktop/mobile preview | Working (iframe at chosen width); per-device settings not available |
| Undo/redo | Working within a session |
| Switching templates without losing unsaved changes | Working: the save queue keeps per-template pending saves; leaving the page flushes first |
| Switching to an alternate template of the same type | Possible if one exists (page picker lists all templates), but none can be created from the UI |

---

## 8. Issues and risks

Ordered by impact.

| # | Issue | Where | Effect |
| --- | --- | --- | --- |
| 1 | **Expected errors return HTTP 500 "An unexpected error occurred".** Services throw plain `Error` for bad handle, wrong template type on assignment, resource not in store, template not found. Duplicate handle hits the unique index `(storeId, type, handle)` and is also unmapped. | `workspace/template-service.ts`, `assignment-service.ts`, `http/errors.ts:32-48` | Merchant sees a generic error instead of "That name is already used"; logs fill with false 500s. Blocks a good "Create template" UI. |
| 2 | **Old templates are compiled at every publish** and can't be deleted | `compiler/validate-registry.ts`, `installation-service.ts` | One stale template can block publishing; library clutter grows each time a design is switched |
| 3 | **No template delete / unassign** | workspace routes | Can't clean up; can't return a product to the default template |
| 4 | **Starter pack version reused as theme version** | `installation-service.ts:156-158` | Future starter-pack bump would silently fall back the theme |
| 5 | **Layout only validated at publish** | `template-service.ts` `normalizeLayout` | Late, confusing errors |
| 6 | **Header/footer for assigned product/collection templates uses the legacy browser repository** to find the product (`state.products`) | `storefront-frame.tsx:59-64` | If the product is not in local state, the frame falls back to the default template's header/footer while the page body uses the assigned template. Low impact today (header/footer are shared), Unverified |
| 7 | `saveThemeConfiguration` defaults `themeVersion` to `"1.0.0"` when the client omits it | `sql-repositories.ts:81` | Same pinning risk as #4 for any future theme with another version |
| 8 | Legacy v1/v3 document formats still in code | schema package | Maintenance cost, not a bug |
| 9 | Not run: manual staging journey (editor → publish → live) | launch checklists | End-to-end on real data is unverified |

---

## 9. Bed Showroom readiness

Registered sections today (`packages/storefront-registry/src/sections/`): announcement-bar, header, footer, spacer/divider, hero, slideshow, image-banner, image-with-text, image-text, image-mosaic, category-grid, multicolumn, rich-text, testimonials, faq, newsletter, contact-store-info, logo-list, trust-strip, journal-teaser, featured-collection, product-grid (with tabs), product-gallery, product-information, product-options, product-purchase, product-description, product-tabs, product-stock-counter, related-products, collection-header, collection-product-grid, collection-description, cart, search, page, blog, article, 404.

| Showroom need | Status | Covered by / gap |
| --- | --- | --- |
| Hero banners, promotions | Ready | hero, slideshow, image-banner, announcement-bar |
| Featured beds and mattresses | Ready | product-grid (tabs: "Beds / Mattresses / Bestsellers"), featured-collection |
| Categories and collections | Ready | category-grid, collection pages with filters and sort |
| Bedroom furniture collections | Ready | same, using collections |
| Product highlights | Ready | multicolumn, image-with-text, product-tabs |
| Product specifications (dimensions, firmness, materials) | **Partial** | Custom fields exist; need a "Specifications" section/block that lists label/value rows from custom fields or typed rows |
| Size and variant selection (Single / Double / King) | Ready | product-options (buttons or select), shared option rules |
| Fabric/colour swatches | **Missing** | Deferred swatches |
| Testimonials | Ready | testimonials (static quotes) |
| Product reviews with stars | **Missing** | Needs a reviews data model; out of scope for the first template |
| Offers and promo banners | Ready | image-banner, announcement-bar, compare-at price on product |
| Delivery and warranty info | Ready | trust-strip, product-tabs ("Delivery", "Warranty", "Trial"), faq |
| Store information, showroom address, opening hours, contact | Ready, basic | contact-store-info; no map embed, no "book a showroom visit" form |
| Responsive product displays | Ready | theme CSS at 390/768/1280 (Minimal and Avenue specs pass) |
| Different layouts for beds vs mattresses vs accessories | **Partial** | Engine supports it; needs create-alternate-template and product/collection assignment UI |
| Fully editable without code | Ready for everything above except the gaps | |

**Verdict:** the engine is ready. The showroom can be built today as a third complete theme with a starter pack, using existing sections for most of the page content (every row above marked Ready). Three things should come first so the template is genuinely usable by a merchant: the error-handling fix (#1), alternate templates with product/collection assignment, and a specifications section.

---

## 10. Recommended roadmap

Each phase is small, testable on its own, and ends with a commit, in line with how we work.

**Phase A: Reliability fixes (small, backend first)** — done 2026-10-29 except item 4's `themeVersion` SQL default, which turned out harmless (`ThemeService` always passes the resolved theme version). The frontend client does not call the new delete routes yet; that is Phase B.
1. Map template/assignment validation errors to 400/404/409 with plain messages (new `StorefrontValidationError`, map pg `23505` on the template handle index to "A template with this name already exists").
2. Only compile templates that can be reached (`default` handles + assigned templates); or mark retired templates and skip them.
3. Add `DELETE /templates/:id` (refuse `default` and assigned templates) and `DELETE /assignments/:type/:id`.
4. Store starter pack version separately from theme version; stop defaulting `themeVersion` to `1.0.0` (use the theme definition's version).
5. Light layout shape check on save.

**Phase B: Template management UI (the missing Shopify feature that matters)**
1. In the editor page picker: "Create template" (choose: copy of current / blank), rename, delete. Uses `cloneTemplate`.
2. Template picker on the product form, product builder and collection form ("Page layout: Default / Mattress"), plus "Use default".
3. Rename "Online store / Templates" to "Store designs"; plain names for shared sections ("Shared header", "Use on every page"); show "Saved, not live yet" next to Publish.
4. Optional: "Keep a copy of my current design" before switching store designs, with restore.

**Phase C: Showroom-ready sections**
1. Specifications section (label/value rows; each row can be typed or bound to a custom field), allowed on product pages.
2. Let `info-tab` text accept custom-field bindings (per-product delivery/warranty text).
3. Showroom visit block in contact-store-info (address, hours, map link, call/WhatsApp button).
4. Colour/fabric swatches in product-options (the deferred work).

**Phase D: Bed Showroom theme**
Follow `docs/theme-architecture.md` "Adding a new theme": new theme id, CSS, starter pack with home, collection, product (default + "mattress" alternate), information pages, style guide entry, Playwright spec and launch checklist.

**Later (not needed for the first showroom):** product reviews, per-device settings (or remove the unused fields), removing legacy v1/v3 formats, publish history with rollback.
