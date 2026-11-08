# Fresh Market Theme and Store Editor Design

**Date:** 2026-09-24
**Status:** Approved design

## Goal and constraints

Give Fresh Market one restrained, coherent storefront identity and make the existing editor's path understandable:

Page/template → section → settings/content → preview → Validate / Preview / Publish

Keep the V4 workspace, compiler, shared renderer, publication pipeline, and active-publication behavior unchanged. Do not add page types or introduce a second editor/document model. Artisan Boutique remains unchanged.

The supported page types are exactly Home, Product, Collection, Cart, Search, Page, Blog, Article, and Not Found.

## Fresh Market visual system

Keep the existing Fresh Market identity—forest green, warm produce-inspired neutrals, and a citrus accent—but apply it consistently and with readable contrast.

- **Colors:** forest green for primary actions and selected states; warm off-white page background; white surfaces; dark green-gray text; restrained citrus orange for small accents, not body text.
- **Typography:** use the existing Fresh Market sans-serif direction. Establish a clear hierarchy for page titles, section headings, labels, and body copy; avoid display sizes that dominate the usable layout.
- **Spacing and containers:** use a consistent centered content width, with narrower measures for editorial content. Apply predictable desktop/tablet/mobile gutters and reduce section spacing on small screens.
- **Images:** reserve stable aspect ratios by use: wide hero/editorial images, square or near-square product imagery, and consistent collection/blog cards. Crop with focal-point support where available; preserve image alt text and never invent missing media.
- **Buttons:** retain the friendly rounded Fresh Market character, while keeping primary actions visually distinct and large enough to use.
- **Cards, borders, and radii:** use white or lightly tinted surfaces, subtle borders, modest radii, and minimal shadows. Avoid stacking decorative treatments.
- **Sections:** use consistent vertical rhythm and alignment across the site.
- **Header and footer:** use the existing shared V4 sections. Keep navigation, store identity, and cart access easy to find; allow the global announcement bar to remain optional and consistent wherever it is assigned.

Exact token values and breakpoints will be finalized against the existing token and renderer contracts during implementation—not by adding unrestricted per-section CSS.

## Page compositions

Reuse registered V4 sections and their existing capabilities. No route-specific renderer will be added.

| Page type | Fresh Market composition |
|---|---|
| **Home** | Shared header and optional announcement; concise hero with clear shopping action; featured product grid; image-with-text brand/story section. Keep the initial page focused rather than filling it with every available section. |
| **Product** | Product gallery and information arranged side-by-side on larger screens and stacked on mobile. Keep title, price, availability, variants, quantity, and Add to cart prominent. Follow with description and related products. |
| **Collection** | Collection title and optional description/image, then a consistent product grid. Keep filters or other controls from displacing the products or hiding the collection context. |
| **Cart** | Cart summary with readable line items, quantities, subtotal/total, and a clear checkout action. On mobile, stack rows and actions without clipping totals or controls. |
| **Search** | Search/results context followed by an aligned product-results grid. Make the query and result/empty state clear; keep product price and availability legible. |
| **Page** | Readable content area with a restrained heading/body hierarchy and comfortable text measure. |
| **Blog** | Simple journal heading and article list with consistent image crops, titles, excerpts, and spacing. |
| **Article** | Narrow reading column, clear title/date/byline where available, optional lead media, and readable article typography. |
| **Not Found** | Calm centered message with a clear route back to the shop and, where supported, search. |

Shared Header/Footer remain shared global sections. Product, collection, cart, and search layouts prioritize commerce information and usable actions over decoration.

## Existing sections and bounded extensions

Expected sections reused from the current registry and Fresh Market starter:

- **Global:** announcement-bar, header, footer
- **Home:** hero, product-grid, image-with-text
- **Product:** product-gallery, product-information, product-options, product-purchase, product-description, related-products
- **Collection:** collection-header, collection-product-grid, collection-description
- **Cart:** cart-summary
- **Search:** search-results
- **Page:** page-content
- **Blog:** blog-header, article-list
- **Article:** article-header, article-content
- **Not Found:** not-found-message

Potential implementation work is limited to visual styling and, if required by a concrete gap, small validated registry settings for presentation—for example, responsive grid behavior or media fit/aspect treatment. Any setting extension must stay schema-validated, renderer-compatible, and editable through the existing inspector. No arbitrary CSS, HTML, scripts, or new rendering contracts.

## Editor experience

Improve the current editor rather than replace its architecture.

- **Page/template navigation:** make the active page type, template, and preview resource easy to distinguish. Keep resource selection contextual to page types that need it.
- **Section list:** keep the active template's section hierarchy visible in a dedicated left panel, including global sections and clear selection, ordering, and add-section affordances.
- **Settings/content:** show settings for the selected section in a distinct inspector panel. Label controls in merchant language and group them around content, layout, and style when the registry supports those groups.
- **Preview:** reserve the center for the shared V4 renderer, with a stable viewport frame and a visible selected section state.
- **Actions:** keep save status and Validate / Preview / Publish visible in the existing toolbar. Preserve their current backend dependency path and publication semantics.
- **Scrolling:** avoid multiple nested regions scrolling against one another. Prefer one scrollable section list, one scrollable inspector, and one scrollable storefront canvas; keep editor chrome fixed.
- **Small screens:** collapse panels into an explicit Sections / Preview / Settings navigation pattern. Do not squeeze the desktop inspector and section tree beside a tiny preview.
- **Viewport controls:** clearly identify Desktop, Tablet, and Mobile and ensure the preview frame reflects the selected dimensions without changing storefront data.

## Responsive and accessibility requirements

Verify all nine page types at desktop, tablet, and narrow mobile; use the existing responsive gate widths 1440px, 820px, 390px, and 320px.

Check header/navigation, hero/media, Product gallery and purchase controls, Collection grids, Search results, Cart totals/actions, Page content, Blog lists, Article typography, Not Found layout, editor panels, horizontal overflow, and clipping.

Maintain semantic headings and controls, visible focus, keyboard-operable editing actions, adequate text/action contrast, and readable text sizes. Responsive presentation must not hide price, availability, quantity, cart totals, or primary actions.

## Artisan Boutique isolation

Do not modify Artisan Boutique's starter content, theme tokens, section styling, or editor behavior as part of this slice. Tests should include a regression check that its current theme definition and starter output remain unchanged.

## Onboarding E2E setup

Use a separate dedicated test-only merchant from the existing E2E merchant that owns Fresh Market and Artisan Boutique stores. Preserve the real sign-in and merchant API flow.

The test should prove:

1. Sign in as the dedicated storeless merchant.
2. Create the first store through the supported onboarding UI/API.
3. Refresh merchant state.
4. Open the starter chooser.
5. Install Fresh Market.
6. Open the editor.
7. Sign in as the existing store-owning merchant and verify /admin remains the destination rather than first-store onboarding.

Use separate JELLY_ONBOARDING_E2E_EMAIL and JELLY_ONBOARDING_E2E_PASSWORD values in the repository's ignored local E2E environment configuration. Do not print or commit credentials.

A test-only reset/provision script should preserve the auth account and return that dedicated merchant to the storeless state. It must:

- run only in an explicitly configured test project;
- resolve and verify the dedicated auth identity before touching data;
- operate only on stores owned by that identity and matching a dedicated onboarding-test identifier/prefix;
- remove store-owned onboarding/test data through a fixed, reviewed table allowlist and dependency order inside a transaction;
- clear the active-publication reference as required by the schema;
- abort on ownership ambiguity, unexpected references, or an unrecognized target;
- preserve the Supabase Auth account and the merchant's internal User row;
- expose no production deletion endpoint and perform no broad deletion.

The repository's current Store relationships use restrictive foreign keys, so the reset implementation must inventory dependent tables and prove the transaction against the test database; it must not assume deleting a Store row cascades safely.

## Test matrix

- **Theme/starter:** Fresh Market's nine templates and shared sections install with the intended composition; Artisan Boutique starter/theme output is unchanged.
- **Rendered pages:** shared-renderer preview and public presentation checked for each page type at 1440, 820, 390, and 320px, using representative real data where required.
- **Commerce readability:** Product, Collection, Search, and Cart controls and key information remain visible and operable at each width.
- **Editor:** page/template selection, section selection, settings editing, draft preview, and toolbar actions remain clear and usable across desktop and mobile editor layouts.
- **Onboarding:** storeless login → create store → refresh → chooser → Fresh Market installation → editor; existing merchant login → /admin.
- **Reset safety:** repeat reset twice; verify only the dedicated test merchant's allowlisted store data is removed and the auth account remains usable.
- **Quality gate:** focused theme/editor tests, responsive E2E, TypeScript, production frontend build, and git diff --check; report pre-existing unrelated failures separately.

## Out of scope

No new page types or sections solely for this slice; no compiler/workspace/publication/runtime redesign; no changes to Artisan Boutique; no Theme Store UI expansion; no Product/Collection/Blog/Article domain expansion; no unrestricted styling or markup; no production reset/deletion endpoint.
