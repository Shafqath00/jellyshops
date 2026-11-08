# Jelly Shop theme editor vs Shopify: gap analysis

Date: 2026-11-01. Branch `local/task3` at `497687d`. Analysis only: no code was changed.

## How to read this report

Every finding is tagged with how it was established:

- **[code]** checked in the source during this audit (file named).
- **[test]** covered by a unit test that passed in this audit's run.
- **[prior QA]** seen working in a browser in an earlier session (recorded in `CLAUDE.md`), not repeated today.
- **[not tested]** could not be checked (needs the test merchant's sign-in or a running staging stack).
- **[Shopify]** Shopify behaviour, from the earlier study of the user's Shopify store (`docs/plans/shopify-style-editor.md`) and published Shopify documentation known at the time of writing. Shopify was not re-opened today.

### Test evidence from this audit

| Run | Result |
| --- | --- |
| Frontend unit tests, editor + admin online store + all `packages/` (`npx vitest run src/features/store-editor src/app/admin/online-store packages`) | 99 files, 481 tests, all pass |
| Frontend `npm run typecheck` | clean |
| Backend storefront tests (`npx vitest run src/storefront`) | 35 files, 128 tests, all pass |
| Playwright e2e (`editor-tools`, `store-editor`, `template-library`) | **not run**: needs `JELLY_E2E_EMAIL` / `JELLY_E2E_PASSWORD` |
| Signed-in end-to-end journey (section 6 below) | **not run today**; a signed-in check was done 2026-10-31 and a live-vs-preview match on 2026-11-01 [prior QA] |

---

## 1. Executive summary

The Jelly editor now covers most of what a merchant does day to day in Shopify's editor: pick a page, add/move/hide/duplicate/delete sections and blocks, style them precisely, group blocks, set phone and tablet values, use theme-wide text styles and colour schemes, preview at real device widths, undo, autosave, publish, and roll back to an earlier published version. In three areas it is **ahead** of Shopify's built-in editor: per-device values (phone/tablet) on any section, automatic saving with "restore your last session", and a one-click publish history.

It is **not production-ready yet**, mainly for reasons outside the feature list:

1. **Most editor features are wired up through uncommitted edits in another developer's files** (editor `page.tsx`, `registry-section-renderer.tsx`, `control-renderer.tsx`, `setting-groups.tsx`, `template-hierarchy.tsx`, `api/client.ts`, `render-registry.tsx` and more; 343 changed/untracked paths in the working tree). A clean checkout of the branch does **not** have the selection toolbar, phone/tablet editing, rich text headings, groups in the tree, drag on the preview, restore-session or version history. This is the single biggest risk.
2. **The backend's packed shared packages (`backend/jelly-storefront-*.tgz`) are repacked but uncommitted.** A backend deployed from git would validate templates with old schemas and reject new settings (groups, phone/tablet values, block styles).
3. **The e2e specs have never run**, and the full signed-in journey has been run once by hand.
4. A handful of real functional gaps: no dropdown menus in the header, one section (`logo-list`) with no renderer, blocks in roughly half the section types cannot be clicked in the preview, only 4 fonts, no cart drawer, no custom CSS, no app/extension system, no translations, one theme per store.

Rough position: **about 75-80% of Shopify's merchant-facing editor features** are present and working; the missing 20-25% is mostly the "platform" layer (multiple themes, apps, code editing, languages) plus some storefront features (mega menus, cart drawer, font library).

---

## 2. Shopify's theme editor (reference model)

[Shopify] Summary of how it works from the merchant's side and underneath.

**Structure.** A theme is files: layout, JSON templates (one per page type, plus alternate templates such as `product.gift`), sections (Liquid + schema), blocks (section blocks, and since 2024 reusable *theme blocks* in a `blocks/` folder that can nest up to 8 levels), snippets, assets, locales, `settings_schema.json` + `settings_data.json`. Header and footer are *section groups* (also an overlay/aside group) that merchants can add sections to. Limits: 25 sections per template, 50 blocks per section.

**Theme library.** Up to 20 themes per store: install from the Theme Store or upload, duplicate, rename, preview an unpublished theme, publish, download, edit code. Duplicating is Shopify's backup/version mechanism; there is no built-in publish history.

**Editor layout.** Top bar: exit, theme name/status, page picker (all templates incl. alternates and specific products/collections), inspector toggle, device switch (desktop/mobile, full width), undo, redo, `…` menu, Save. Left: Sections tab (tree grouped Header / Template / Footer, nested blocks, eye/delete on hover, "Add section"/"Add block" in every container, drag to reorder in the tree), Theme settings tab, Apps tab. Settings panel for the selected item with grouped settings and conditional (`visible_if`) settings.

**Preview.** Click any section or block to select it; hover outline and name tag; floating toolbar (move, duplicate, hide, delete, AI); selected section id in the URL.

**Settings.** Typed inputs: text, rich text (bold, italic, link, lists), inline rich text, image picker (library, upload, free images, focal point, alt), video/URL, colour (with schemes), colour scheme picker, font picker (large Shopify font library), range, select, radio, checkbox, product/collection/blog/page/link/menu pickers, metaobject pickers. **Dynamic sources** on most inputs connect to metafields and metaobjects. **Custom CSS** per section and theme-wide in the editor. **Custom Liquid** section/block.

**Theme settings.** Colour schemes (named, reusable), typography (fonts, scale), layout (page width, spacing), buttons, inputs, cards, badges, cart type (drawer/page/notification), social media, favicon, search behaviour, checkout branding (separate).

**Saving.** Manual Save (no autosave), with "restore unsaved changes" recovery. Publishing a theme is a separate action in the theme library. No version history apart from duplicates and the GitHub integration.

**Pages.** Home, product, collection, collection list, page, blog, article, search, cart, 404, password, gift card, customer accounts (now Shopify-hosted), metaobject entry pages.

**Apps.** Theme app extensions add app blocks (inside sections) and app embeds (global, e.g. chat widgets) that merchants place and configure in the editor.

**Other.** Translations via locale files and the Translate & Adapt app, Markets (per-country content), Sidekick AI, Theme Check / Shopify CLI for developers, responsive images and performance reports.

**Per-device values.** Shopify's editor has **no** built-in mobile/tablet value system; themes add separate "mobile" settings by hand.

---

## 3. Jelly theme editor: what exists (audit)

### Architecture [code]

- Theme -> templates -> sections -> blocks (blocks can hold one more level of blocks, `MAX_BLOCK_DEPTH` = 2, `storefront-schema/src/block-tree.ts`). Section and block definitions + editor controls in `storefront-registry`; one renderer (`storefront-renderer`) for the editor preview and the live store.
- Editor: `jellyshops/src/app/admin/online-store/editor/page.tsx` (1,289 lines) plus `features/store-editor/` (model commands, reducer, revisioned save queue, autosave, session history, unsaved-work store, page picker rules, mobile/tablet settings, block editing, selection actions, drag position).
- Backend: SQL workspace generations, immutable publications, active-publication pointer. Routes under `/api/stores/:storeId/storefront/...`: workspace, templates (CRUD + clone), assignments, global sections, menus, presets, theme settings, validate, preview compile, publish, publications + restore, theme catalog, starter install [code: `backend/src/storefront`].
- Section types: 44 rendered types across home, product, collection, content, blog/article, search, cart, 404 [code: `render-registry.tsx`].
- Two complete themes (Jelly Minimal `jelly-signature`, Jelly Avenue `jelly-avenue`).

### Fully working (verified)

| Feature | Evidence |
| --- | --- |
| Page picker (only section-built pages, alternates, "Default", earlier versions hidden) | [code] `page-picker-groups.ts` [test] |
| Add / move / duplicate / hide / delete sections and blocks, min/max blocks respected | [code] `model/commands.ts`, `selection-actions.ts` [test] [prior QA] |
| Drag to reorder in the tree (dnd-kit) and on the preview (grip on the toolbar) | [test] `drag-reorder`, `drag-position` [prior QA 2026-11-01, mouse only] |
| Floating selection toolbar in the preview | [test] `selection-toolbar.test.tsx` [prior QA] |
| Keyboard shortcuts (undo, redo, save, delete, duplicate, escape) | [test] `use-editor-shortcuts.test.ts` |
| Section style settings (colour scheme, own colours, gradient, heading/text font and size, alignment, padding px, width, shadow, opacity, min height, "Show on") | [code] `storefront-registry/src/section-style.ts` [test] [prior QA] |
| Block style settings (width, max width, text style preset, colours, gradient, border, radius, padding per side, shadow, opacity, min height, spacing) | [code] `block-style.ts` [test] [prior QA] |
| Buttons (filled/outlined/link, size, hover, colours, new tab), image block, video block (YouTube/Vimeo/mp4) | [code] `blocks.ts` [test] |
| Group block (direction, alignment, gap, wrap), one level of nesting, move in/out of group | [code] [test] `nested-blocks.test.ts`, `block-editing.test.ts` [prior QA] |
| Phone and tablet values for marked settings, "(phone)/(tablet)" labels, "Same as desktop" | [code] `mobile-settings.ts` [test] [prior QA] |
| Theme settings: text styles H1-H4/Body/Small, 4 colour schemes, buttons, fonts, layout | [code] `theme-style-settings.ts` [test] |
| Rich text on descriptions and inline-formatted headings (bold, italic, underline, link, colour, size) | [code] `setting-text-editor.tsx` [test] |
| Autosave with revisioned queue; "Restore your last session" | [code] `revisioned-save-queue.ts`, `unsaved-work.ts` [test] [prior QA] |
| Undo / redo (template, shared section and theme changes) | [code] `page.tsx:170-178`, `session-history.ts` [test] |
| Alternate templates: create (clone), rename, delete (refused while assigned), assign to products/collections | [code] `template-actions.tsx`, `template-picker.tsx` [test] [prior QA 2026-10-29] |
| Validate, compiled preview, publish; live store unchanged until publish | [code] `publish-controls.tsx` [test] [prior QA] |
| Version history: list publications, restore an earlier one | [code] [test] listing [prior QA]; **restore not tried on staging** |
| Device preview at real width (Desktop >=1280, Tablet 820, Phone 390) scaled to fit | [code] `scaled-preview.tsx` [test] [prior QA] |
| Live store matches preview for padding, text style and "Show on" at 1440/820/390 | [prior QA 2026-11-01] |
| Custom-field (metafield) bindings in sections, preview + live | [code] `dynamic-sources/binding-values.ts` [test] |
| Metafield and metaobject definitions (admin `content/metaobjects`) | [code] `backend/src/custom-data/routes.ts` |
| Menus editor (admin `online-store/navigation`) | [code] |
| Image control with upload and focal point | [code] `controls/image-control.tsx` |
| Conditional settings (`showWhen`) and sub-headings in the settings panel | [code] [test] |
| Beforeunload protection while saving | [code] `page.tsx:229` |

### Partially implemented

| Feature | What works | What is missing | Evidence |
| --- | --- | --- | --- |
| Click-to-select blocks in the preview | Hero, slideshow, home sections, theme-pack sections, custom content, rich text | Header, footer, product sections, product extras (tabs, specs, stock), product grid, collection sections, content pages, store visit: their blocks have no `editorBlockData` attributes, so clicking selects only the section | [code] count of `editorBlockData` per file in `storefront-renderer/src/sections` |
| Nested blocks | One level, Group block, in Custom content only | Deeper nesting, groups in other sections, product card made of blocks, drag between levels | [code] `MAX_BLOCK_DEPTH`, `blocks.ts` |
| Navigation | Menus can be edited; menu items support `children` in the schema | Header and footer render only top-level links: **no dropdowns or mega menu** | [code] `runtime-v4.ts:34`, `header.tsx:27` ("top-level links … plain list"), no `children` use in header/footer |
| Dynamic sources | Section settings resolve metafield bindings | Header/footer bindings show fallbacks only (`storefront-frame.tsx`); no metaobject entry pages | [code] / `CLAUDE.md` |
| Undo / redo | Works within one page | History is **cleared when you switch page** (scope = store + template; a push with a new scope resets the list); limit 50 | [code] `session-history.ts:4-6`, `page.tsx:172` |
| Reusable sections | Shared header/footer/global sections; backend section presets (`POST /presets`, instantiate) | No "Save as reusable section" in the editor: `createPreset` is in the API client but nothing calls it | [code] grep of `createPreset` |
| Fonts | Font picker per role and per section | Only 4 fonts (Fraunces, Inter, Georgia, Arial) | [code] `storefront-themes/src/fonts.ts` |
| Theme settings | Text styles, schemes, buttons | Input/field styling, cards, badges, cart type, favicon/social in theme settings | [code] / plan doc |
| Responsive | Phone + tablet values for marked settings | Only marked settings (padding, alignment, heading size, text style, gap, direction); "Show on" has no tablet-only option; hero/home/theme-pack buttons ignore tablet padding | [code] / `CLAUDE.md` |
| Blog / article templates | Sections exist and render | Blog/article sections have **no settings** (empty `controls`) | [code] `sections/content.ts:102-105` |
| Collection descriptions | Rich text, checked on staging | Hookups uncommitted in the other developer's catalog files | `CLAUDE.md` |
| Product options / swatches | Product options section | Swatch choice from the builder is lost on save (needs API field + migration) | `CLAUDE.md` |

### Broken or not functional

| Issue | Impact | Evidence |
| --- | --- | --- |
| `logo-list` section is in the registry (and can be added) but has **no renderer**; its `logo` block has only a label field, no image | Merchant adds "Logo list" and sees nothing / a fallback | [code] `sections/content.ts:161`, absent from `render-registry.tsx`, `blocks.ts:82` |
| Committed branch is missing the editor wiring (see section 1) | A deploy from git would ship a much weaker editor than the one tested | [code] `git status`: editor `page.tsx`, `registry-section-renderer.tsx`, `control-renderer.tsx` and others modified, uncommitted |
| Backend tarballs not committed | Deployed backend rejects new settings or drops them on validation | [code] `git status`: `backend/jelly-storefront-*.tgz` modified |
| Colour pickers show `#ffffff` when empty on controls that don't use the new colour control | Merchant thinks white is set | `CLAUDE.md` (control-renderer note; most colours moved to the new control, but worth re-checking) [not tested] |

### Missing entirely

- Theme library: more than one installed theme per store, duplicate theme, preview an unpublished theme, rename, download. Today a store has one workspace; changing theme = installing a starter [code: routes list].
- Custom CSS (per section and theme-wide).
- Custom code / "Custom Liquid"-style HTML section (would need sanitising).
- App blocks / app embeds / any extension system.
- Translations and multi-language content; per-market content.
- Header/footer as open section groups where merchants add any section (today header, footer and announcement are fixed shared sections) [not fully verified].
- Dropdown / mega menus (see partial).
- Cart drawer (header bag links to the cart page).
- Password page, gift card page, collection-list page templates (page types today: home, product, collection, page, blog, article, search, cart, 404, plus built-in account/checkout pages) [code].
- Large font library / custom font upload.
- Image picker extras: free stock images, alt text editing inside the control [not verified for alt].
- AI assistance (Shopify Sidekick) — low priority.
- Theme inspector toggle (selection is always on; fine).
- Developer tooling: code editor, theme upload/download, CLI, theme check equivalent.

---

## 4. Feature-by-feature comparison

| Feature | Shopify | Jelly | Status | Gap | Required improvement | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Theme install | Theme Store / upload | Starter install of 2 built-in themes | Partial | No upload, few themes | More themes; later a theme package format | Medium |
| Multiple themes, duplicate, preview unpublished | Up to 20 themes | One workspace per store | Missing | Can't try a new theme safely | Theme library: draft themes as separate workspaces | High |
| Publish | Publish theme | Publish draft, immutable publications | Complete | — | — | — |
| Version history | Duplicates only | Publication list + restore | Complete (ahead) | Restore untested on staging | Staging test | Medium |
| Page picker | All templates | Section-built pages + alternates | Complete | Built-in pages (checkout, account) not editable by design | Document; optional account page sections | Low |
| Alternate templates + assignment | Yes | Create/rename/delete/assign | Complete | — | — | — |
| Add/remove/duplicate/hide/reorder sections | Yes | Yes | Complete | — | — | — |
| Same for blocks | Yes | Yes | Complete | — | — | — |
| Nested blocks | Theme blocks, 8 levels | Group, 1 level, Custom content only | Partial | Depth, coverage | Allow groups in more sections; depth 3; product card blocks | Medium |
| Drag in tree | Yes, across levels | Yes, same level | Partial | No cross-level drag | Cross-level drop in tree | Low |
| Drag on preview | No | Yes | Complete (ahead) | Not touch-tested | Touch test | Low |
| Click-select sections | Yes | Yes | Complete | — | — | — |
| Click-select blocks | Every block | ~half of section types | Partial | Many blocks unclickable | Add `editorBlockData` to remaining renderers | High |
| Floating toolbar | Yes | Yes (+move, drag, group) | Complete | — | — | — |
| Selected item in URL | Yes | Yes | Complete | — | — | — |
| Reusable sections | Section groups, theme blocks | Shared sections, presets backend only | Partial | No "save as reusable" UI | Wire `createPreset` into section menu + library | Medium |
| Custom sections | Developer-built | Custom content section + groups | Partial | No code | Optional sanitized HTML block | Low |
| Global theme settings | Extensive | Text styles, schemes, buttons, layout | Partial | Inputs, cards, badges, cart type, favicon | Add those groups | Medium |
| Colour schemes | Named, unlimited | 4 fixed schemes | Partial | Can't add/rename | Editable scheme list | Low |
| Typography | Font library | 4 fonts | Partial | Choice | Add 20-40 Google fonts self-hosted, or upload | High |
| Header customisation | Section group | Fixed header + settings | Partial | Can't add sections to header group | Header/footer groups | Medium |
| Menus | Nested, mega menu | Nested data, flat render | Broken-ish | Dropdowns not shown | Render children: dropdown + mobile drawer | **Critical** for real stores with categories |
| Footer | Section group, blocks | Link columns, newsletter, about | Complete | Footer blocks not clickable | Selection attrs | Medium |
| Product template | Blocks for every element | Sections + blocks, specs, tabs, stock | Partial | Product blocks not clickable; swatches lost | Selection attrs; swatch field | High |
| Collection template | Filters, sort, banner | Toolbar, filters, sort, banner | Complete | — | — | — |
| Blog / article | Settings for layout | No settings | Partial | Can't style | Add layout/settings | Medium |
| Cart | Page or drawer | Page only | Partial | No drawer | Cart drawer option | Medium |
| Password / gift card / collection list pages | Yes | No | Missing | — | Add when needed (password page before launch) | Medium |
| Metafields in settings | Dynamic sources | Bindings in sections | Partial | Header/footer fallbacks | Resolve in `storefront-frame.tsx` | Medium |
| Metaobjects | Definitions + entry pages | Definitions only | Partial | No pages/pickers | Metaobject picker + templates | Low |
| Responsive values | None built in | Phone + tablet | Complete (ahead) | Limited key set; tablet "Show on" | Extend keys, add tablet option | Low |
| Real-time preview | Yes | Yes | Complete | — | — | — |
| Device preview | Desktop/mobile | Desktop/tablet/phone at real width | Complete | — | — | — |
| Undo/redo | Session | Per page, 50 steps | Partial | Lost on page switch | Keep a history per page (map by scope) | Medium |
| Autosave | Manual save | Autosave + restore session | Complete (ahead) | — | — | — |
| Save conflicts (two tabs/users) | Last write | Revisioned saves | Complete [code]; UI behaviour on conflict [not tested] | — | Test two tabs | Medium |
| App blocks / embeds | Yes | No | Missing | No integrations | Extension model (later) | Low (until an app ecosystem exists) |
| Custom CSS | Per section + theme | No | Missing | Power users stuck | Scoped CSS field, sanitized | Medium |
| Code editing / Liquid | Yes | No | Missing | By design | Not planned | Low |
| Translations | Yes | No | Missing | Single language | Locale layer for theme text | Medium (India market: Hindi etc.) |
| Accessibility of editor | Good | Labels, aria on buttons seen | Partial [not audited] | No audit | Axe + keyboard pass | High |
| Performance | Good | Not measured | Unknown [not tested] | 1,289-line page component | Split, measure | Medium |
| Error handling | Inline errors | Plain-language 400/404/409; save error state | Complete [code] | — | — | — |
| AI help | Sidekick | No | Missing | — | Optional | Low |

---

## 5. Issues list with impact and fix

| # | Issue | Impact | Recommended solution | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Editor wiring lives in uncommitted edits to another developer's files | Features disappear or conflict when their work lands; nothing deployable from git | Agree with the other developer to land their work, then commit the hookups (list in `CLAUDE.md`) in one reviewed change | [code] git status |
| 2 | Backend `.tgz` packages uncommitted | Backend validation runs old schemas when deployed | Commit repacked tarballs in the same change as #1; add a CI check that the tarballs match the package sources | [code] |
| 3 | e2e specs never run | Regressions invisible | Create a CI secret for the test merchant; run the 3 editor specs in CI | `docs/shopify-style-editor-qa.md` |
| 4 | Header/footer ignore submenus | Stores with categories can't navigate | Render nested items (dropdown on desktop, accordion in mobile menu), keyboard accessible | [code] |
| 5 | Blocks unclickable in ~8 renderer files | Merchants must hunt in the tree; feels broken next to clickable sections | Add `editorBlockData` (and `blockStyle` where styling applies) to header, footer, product, product extras, product grid, collection, content pages, store visit | [code] |
| 6 | `logo-list` has no renderer and no logo image control | Visible broken section | Build the renderer + image control, or hide it from the library until built | [code] |
| 7 | Only 4 fonts | Weak branding | Curated self-hosted font set via `next/font`, list in `fonts.ts` | [code] |
| 8 | Undo history wiped on page switch | Lost undo after navigating | Keep a `Map<scope, history>` | [code] |
| 9 | "Save as reusable section" missing though backend supports presets | Merchants rebuild the same section | Section `…` menu "Save as reusable", list in the section library | [code] |
| 10 | Blog/article sections have no settings | Blog looks the same for everyone | Layout, columns, image ratio, show date/author | [code] |
| 11 | Header/footer custom-field bindings fall back | Dynamic content missing in frame | Resolve bindings in `storefront-frame.tsx` | `CLAUDE.md` |
| 12 | Swatch choice lost on save | Product options look wrong | API field + migration (ask before staging) | `CLAUDE.md` |
| 13 | Publication restore not tried on staging | Rollback may fail when needed | Staging test, then e2e | `CLAUDE.md` |
| 14 | No cart drawer | Common Shopify expectation | Theme setting "Cart type: page / drawer" | `CLAUDE.md` |
| 15 | Editor page is one 1,289-line component | Hard to change safely, slow re-renders likely | Split into hooks (`useEditorData`, `useSaveQueue`, `useSelection`) after #1 lands | [code] |
| 16 | No custom CSS | Power users can't fine-tune | Section + theme CSS field, scoped to `[data-section-id]`, sanitized | — |
| 17 | Hero/home/theme-pack buttons ignore tablet padding | Small responsive mismatch | Pass tablet props once those files are committed | `CLAUDE.md` |
| 18 | Production database isolation (RLS) only on staging | Data-isolation risk at launch | Apply to production before launch | `CLAUDE.md` |
| 19 | No password page | Can't launch a store "coming soon" | Password template + setting | [code] page types |
| 20 | Theme settings lack input/field styling | Forms don't match brand | Inputs group in `theme-style-settings.ts` | plan doc |

---

## 6. UI/UX and component review

What is good [code]: dnd-kit for drag, a real slider + px box + reset control, colour control with an empty "Default" state, segmented choices, sub-headings and conditional settings, plain-language labels from one file (`labels.ts`), scaled device preview, restore banner, version history menu.

Recommendations:

1. **One control library.** Some controls are new (`style-controls.tsx`), others older inside `control-renderer.tsx`. Move every control onto the same primitives (shadcn/Radix: Popover, Select, Slider, ToggleGroup, Tooltip) for consistent focus rings, keyboard use and sizes.
2. **Colour picker.** Add theme-scheme swatches and recent colours above the custom picker; a hex box; alpha where allowed. Radix Popover + `react-colorful` (tiny, accessible) fits.
3. **Spacing.** A linked/unlinked 4-side padding box (one value for all, or each side), as in Shopify and Figma.
4. **Tree.** Hover eye/delete buttons, block text in row names ("Heading – Welcome"), collapse all, search in long trees, cross-level drag.
5. **Hover outline + name tag** on every block once #5 is fixed.
6. **Settings panel.** Collapsible groups that remember open state; "Reset section to default"; copy/paste styles between blocks.
7. **Dialogs.** Confirm before deleting a section with blocks (undo exists, but a toast "Section deleted · Undo" is friendlier).
8. **Accessibility.** Run axe on the editor; check keyboard-only path for: add section, select block, change a setting, publish. Live region for "Saving… / Saved".
9. **Performance.** Memoise the preview per section; debounce slider-driven saves; measure with React Profiler on a 20-section page.

---

## 7. Production-readiness testing

| Step | Status | Notes |
| --- | --- | --- |
| 1. Select a page template | [prior QA] / [test] | |
| 2. Add a section | [prior QA] | |
| 3. Insert text, image, button, custom blocks | [prior QA] text/button/group; image/video blocks [test] only | |
| 4. Change layout and styling | [prior QA] | |
| 5. Rearrange / group | [prior QA] incl. drag | Touch not tested |
| 6. Preview on screen sizes | [prior QA] | |
| 7. Save and publish | [prior QA] | |
| 8. Live store matches | [prior QA 2026-11-01] | Only a test section; header dropdowns not possible |
| 9. Reload, changes kept | [prior QA] | |
| 10. Undo/redo, errors, recovery | [test]; restore-session [prior QA] | Two-tab conflict [not tested]; publication restore on staging [not tested] |
| Same across page types | **[not tested]**: product, collection, cart, search, blog, 404 templates not run through the full journey in the editor | |
| e2e specs | **[not run]** | needs credentials |

**Assessment:** feature-complete enough for a closed beta **once issues 1-3 are fixed**; not ready for general launch until 4-7, 13, 18 and 19 are done and the e2e specs pass in CI.

---

## 8. Roadmap

Complexity: S (< 1 day), M (1-3 days), L (3-7 days), XL (> 1 week).

### Phase 1 – Critical fixes

| Task | Outcome | Priority | Depends on | Size | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Land the uncommitted hookups | Branch contains the editor as tested | Critical | Other developer's work | M | Clean checkout builds; all editor features present; 481+ unit tests pass |
| Commit backend tarballs + CI tarball check | Backend matches packages | Critical | above | S | CI fails if tarball differs from `packages/` build |
| Run e2e in CI | Regressions caught | Critical | test merchant secret | M | 3 editor specs green in CI |
| Fix or hide `logo-list` | No broken sections | Critical | — | S/M | Section renders logos with images, or absent from library |
| Dropdown menus in header/footer | Nested navigation works | Critical | — | M | 2-level menu works with mouse, keyboard, mobile menu; preview = live |
| Test publication restore on staging | Rollback proven | High | user approval | S | Restore makes old version live; draft untouched |
| Production RLS | Tenant isolation | Critical | user approval | M | Same policies as staging; isolation tests pass against prod |

### Phase 2 – Missing core features

| Task | Outcome | Priority | Depends on | Size | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Clickable blocks everywhere | Every block selectable in preview | High | Phase 1 | M | Each section type's blocks select on click (unit test per renderer) |
| Font library | 20-40 fonts | High | — | M | Picker lists them; preview and live load the same font; no layout shift |
| Theme library (draft themes, duplicate, preview, publish) | Safe theme switching | High | — | XL | Two themes per store; edit unpublished one; publish swaps; old publications kept |
| Undo history per page | Undo survives page switch | Medium | — | S | Switch page and back, Ctrl+Z still works |
| Save as reusable section | Reuse across pages | Medium | — | M | Save, appears in library, insert on another page |
| Cart drawer | Shopify-like cart | Medium | — | M | Theme setting page/drawer; drawer accessible (focus trap, Esc) |
| Password page | Pre-launch mode | Medium | — | M | Store setting on → shoppers see password page |
| Blog/article settings | Styled blogs | Medium | — | S/M | Settings change layout in preview and live |
| Header/footer bindings | Dynamic data in frame | Medium | — | S | Bound value shows in header on live store |
| Swatches saved | Options look right | Medium | migration approval | M | Builder swatch survives save and shows on product page |

### Phase 3 – Advanced customisation

| Task | Outcome | Priority | Depends on | Size | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Groups in more sections, depth 3, cross-level drag | Shopify-like layout freedom | Medium | Phase 2 clickable blocks | L | Group inside group; drag between levels; publish matches |
| Product card made of blocks | Custom cards | Medium | above | L | Card blocks reorder; grid and related products follow |
| Custom CSS (section + theme) | Power styling | Medium | sanitizer | M | CSS scoped to the section; unsafe input rejected |
| Theme settings: inputs, cards, badges, favicon, social | Complete design system | Medium | — | M | Each setting visible in preview + live |
| Editable colour scheme list | Brand flexibility | Low | — | M | Add/rename/delete schemes; sections keep working |
| More phone/tablet keys, tablet "Show on" | Finer responsive control | Low | — | M | New keys validated and rendered per device |
| Metaobject pickers + entry pages | Structured content | Low | — | L | Section can list metaobject entries; entry has a page |
| Translations | Multi-language stores | Medium | — | XL | Theme text per locale; language switcher |
| Extension / app block model | Integrations | Low | product decision | XL | Third-party block registered, placed, rendered |

### Phase 4 – UI/UX refinement

| Task | Outcome | Priority | Depends on | Size | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Unify controls on Radix/shadcn primitives | Consistent panel | Medium | Phase 1 | M | All controls share focus/size styles |
| Better colour picker and linked padding box | Faster styling | Medium | above | M | Scheme swatches, hex, recent colours; linked padding |
| Tree polish (names, hover actions, search) | Easier navigation | Medium | — | M | Row shows block text; hover eye/delete |
| Split editor `page.tsx` | Maintainable, faster | Medium | Phase 1 | L | No file > 400 lines; no behaviour change (e2e green) |
| Accessibility audit + fixes | WCAG AA editor | High | — | M | axe clean; keyboard-only journey passes |
| Performance pass | Smooth editing | Medium | split | M | Setting change re-renders only the affected section; <100 ms input latency on 20 sections |

### Phase 5 – Final validation

| Task | Outcome | Priority | Size | Acceptance criteria |
| --- | --- | --- | --- | --- |
| Full journey on every page type (home, product, collection, page, blog, article, search, cart, 404) in both themes | Confidence per template | Critical | M | Checklist signed off; screenshots at 3 widths |
| Two-tab / two-user conflict test | No lost work | High | S | Second save gets a clear message; nothing silently overwritten |
| Stripe sandbox + staging launch checklist | End-to-end commerce | Critical | M | `docs/jelly-minimal-launch-checklist.md` complete |
| Regression suite in CI (unit + e2e + build) | Safe releases | Critical | S | Required checks on the branch |
| Touch drag test | Tablet editing | Low | S | Drag works on a touch device or is disabled cleanly |

---

## 9. Final checklist to reach Shopify-level

- [ ] Editor hookups committed; clean checkout = tested editor
- [ ] Backend tarballs committed and checked in CI
- [ ] Editor e2e specs green in CI
- [ ] `logo-list` renders (or hidden)
- [ ] Dropdown / nested menus in header, footer, mobile menu
- [ ] Every block clickable in the preview
- [ ] Font library
- [ ] Theme library: multiple themes, duplicate, preview unpublished, publish
- [ ] Undo kept per page
- [ ] Save as reusable section
- [ ] Cart drawer option
- [ ] Password page
- [ ] Blog/article settings
- [ ] Header/footer dynamic bindings
- [ ] Swatches persist
- [ ] Nested groups beyond one level, cross-level drag
- [ ] Custom CSS
- [ ] Theme settings for inputs, cards, badges, favicon
- [ ] Translations
- [ ] Accessibility audit passed
- [ ] Performance pass
- [ ] Publication restore proven on staging
- [ ] Production RLS applied
- [ ] Full journey on every page type, both themes, 3 widths
- [ ] Two-tab conflict behaviour verified
- [ ] (Later) app/extension model, metaobject pages, AI help

Already at or beyond Shopify: section/block editing, precise styling, phone/tablet values, autosave + restore session, version history, drag on the preview, alternate templates and assignment, real-width device preview.
