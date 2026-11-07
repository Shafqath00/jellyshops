# Jelly Forma — implementation and QA

Built 7 November 2026 from the Jelly CLI scaffold, then refined against captured Hyper desktop, phone and product views. Forma uses a compact header, eight product-cutout category shortcuts, a 480px desktop landscape hero, square product cards and pill controls. Manrope and a white/grey/blue/ink palette keep catalogue details readable. All sections use existing Jelly renderers; no shared renderer or backend behaviour was changed. The source stylesheet is 174 lines (150 before the tablet, polish, phone and structure passes of 7 November); the source is now 200 lines and uses scheme roles, contract tokens and relative lengths (apart from 1px borders).

The refinement excludes Forma from conflicting legacy visual defaults with a zero-specificity selector. Removing that exclusion reproduces the original global stylesheet exactly, preserving existing themes' rules and specificity. The product preview enables the existing thumbnail gallery and uses configurable furniture finishes, while other previews retain their size options and purchase actions. Desktop product details, options and purchase occupy consecutive content-sized grid rows. Original illustrative assets replace the previous mismatched product media; see SOURCES.md.

## Use and maintenance

- Application preview: `/theme-preview/jelly-forma` (home, collection, product, cart, search, information, 404 and style guide).
- From `jellyshops/`: `node packages/theme-cli/bin/jelly-theme.mjs dev packages/storefront-themes/src/themes/jelly-forma`.
- After editing CSS or assets, from repository root: `node scripts/generate-forma-assets.mjs`. This regenerates the scoped application stylesheet and public asset copies. Keep theme.css as the source of truth.
- After changing the manifest or starter: `node scripts/generate-theme-index.mjs`, then `npm run build:storefront-packages` from `jellyshops/`.
- Packaged upload artifact: `dist/jelly-forma-1.0.0.jellytheme.json`; regenerate with the theme CLI package command.

## Verified

- CLI validation: pass, no errors/warnings.
- CLI conformance: 20 tests pass.
- Storefront package build: pass.
- TypeScript: pass.
- ESLint on changed TypeScript/TSX files: pass.
- Focused unit verification: 44 tests passed across five files, covering preview defaults, furniture finishes/gallery, registry, starter packs, stylesheet scoping and design rules.
- Playwright: 13 checks passed in the final refinement run, including design lint and baseline comparison. Covers seven page layouts at 1280, 820 and 390px; WCAG A/AA checks; image loading; menu, product options, quantity controls and cart totals; merchant typography/button/field/card tokens; alternate section layouts. Geometry assertions cover desktop hero top <=360px and height <=520px, phone hero top <=300px and action bottom <=820px, and purchase-column gaps <=24px. Preview mode intentionally disables purchases and subscriptions.
- Design lint: zero findings across seven pages and the platform's three device presets; baseline unchanged.
- Text/button contrasts: White 17.93:1; Soft grey text 16.29:1 and button 17.93:1; Blue 9.77:1; Ink 17.93:1.
- Source CSS: no hex colours or pixel lengths except 1px borders; fixed platform breakpoints expressed in rem.

## Limits and remaining release work

- Full `npm test` was attempted but did not finish; the bounded full-suite retry stopped producing output and was interrupted. Focused theme/design-lint tests and browser tests above provide the completed verification evidence.
- The wider refinement unit/browser attempt exhausted available Node memory. Focused runs were executed sequentially instead. A Resthaven home layout check passed; its broader browser/accessibility suite did not complete. The legacy CSS preservation check confirmed the global stylesheet differs only by the zero-specificity Forma exclusions.
- Full `npm run lint` fails on existing repository issues, including generated `.next-order-management` build files (146 errors and 231 warnings). Those files were not changed for this theme.
- No staging store was created, installed or published. Empty-store and populated-store installation checks, checkout/account end-to-end checks and staging screenshots remain release gates. Backend package repacking/reinstallation is deferred to that release step.
- Checkout, accounts, transaction processing, filtering, cart drawer and sticky purchase behaviour reuse the existing platform. The preview offers sample data and is not a transaction-enabled test store.
- The starter uses editable category tiles linked to store searches; automatically selecting the merchant's first collections is not supported by the current category-grid renderer. Product lists use the store catalogue and hide when empty.
- This is an independently built visual direction, not complete Hyper feature parity. Comparison, wholesale/quantity pricing, advanced mega-menu promotions and app-only upsells are not added by this theme.
- The CSS scoper does not accept `@layer`; Forma therefore targets component classes instead of adding global element resets.
- Source imagery: original AI-generated illustrative furniture assets and supporting Unsplash photography. These sample assets must be replaced with actual merchant product photographs before representing goods for sale. Sources are in SOURCES.md.

Staging writes and publishing require the user's explicit approval.

## Tablet fix (7 November 2026)

From `docs/reports/2026-11-07-forma-full-page-audit.md`, findings 1 and 2. Between 768 and 1023px the header used neither the desktop nor the phone layout, so the search box shrank and the menu wrapped word by word. It now uses the phone header (menu button, logo and icons, full-width search below) up to 1023px. The product page keeps the gallery beside one continuous buying column from 768px up (narrower gap on tablet). On phones, the product parts no longer each take a full section's spacing. Desktop is unchanged (identical page heights at 1280px). New Playwright test "tablet and phone: compact header and continuous purchase column"; the Forma spec (12 tests), the design lint (all themes), CLI conformance (20) and `theme-css.test.ts` pass. The package in `dist/` was rebuilt.

## Polish pass (7 November 2026)

Audit findings 3–6, 8, 9, 12, 14 and 17: calmer page titles, footer with two small-headed link columns and a full-width divider, pill cart stepper with text-link Remove/Continue shopping, card buttons aligned across rows, newsletter on one row with a drawn checkbox, FAQ +/− icons, page-text spacing, three tablet feature columns. The starter footer gains a "Shop" column. Checked by the Forma spec (13 tests), the design lint (all themes), conformance (20) and unit tests.

## Phone pass (7 November 2026)

Designed for 360, 390 and 430px: section spacing scale .55 on phones (pages 8–20% shorter: home 4,267 → 3,926px, product 2,784 → 2,237px at 390), no card buttons on phones (the card is the link), compact feature columns, full-width Subscribe, related products as a swipe row, quantity pill beside Add to cart on every width, the sticky buy bar (already on in the starter) styled for Forma, cart photos on the light surface, tighter phone footer. New Playwright test checks every page at the three widths for sideways scrolling, the buying row, the swipe row, the bar appearing after scroll, hidden card buttons and the Subscribe width.

## Structure pass (7 November 2026)

Collection: breadcrumb, product count, sort (Featured, price both ways, name) and filters (in stock, price range, colour) as a sidebar from 1024px and a Filter button below, four columns. Search uses the same toolbar. Product page: description, specifications, materials & care and delivery & returns as fold-out panels in the buying column; the gallery stays in view while the column scrolls. Built as shared, opt-in section settings (renderer `ProductListBrowser`), so the editor preview and the live store show the same thing; on the live store a collection or search section with sorting or filters replaces the older built-in product browser. Not done: 404 extras, feature-column icons.
