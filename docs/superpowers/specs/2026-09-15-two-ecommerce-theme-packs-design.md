# Two complete ecommerce theme packs

## Purpose

Add two polished, store-installable ecommerce themes to Jelly Shop. Each theme must produce a complete public storefront and remain fully editable in the existing Shopify-style editor. Supabase PostgreSQL remains the only persistence layer.

## Themes

### Fresh Market

Audience: food, grocery, and everyday essentials merchants.

Visual direction: bright produce-inspired palette, clear merchandising hierarchy, rounded product imagery, and concise promotional copy.

Default home page:

1. Announcement bar and primary navigation
2. Seasonal promotional hero with CTA
3. Category-card grid
4. Featured collection
5. Promotional image-with-text split
6. Product grid
7. Reviews / trust strip
8. Newsletter sign-up
9. Multi-column footer

### Artisan Boutique

Audience: fashion, beauty, jewellery, and handmade-product merchants.

Visual direction: editorial photography, high-contrast type, generous whitespace, and collection storytelling.

Default home page:

1. Minimal navigation
2. Editorial image hero with CTA
3. Brand-story image-with-text section
4. Collection spotlight
5. Curated product rail
6. Lifestyle image mosaic
7. Testimonials / press proof
8. Journal teaser
9. Newsletter sign-up and refined footer

## Theme data model

Each built-in theme is a registry-owned starter pack with a stable identifier, title, description, preview metadata, design token defaults, and page layout defaults. The starter pack is immutable.

When a merchant installs a theme, the backend creates a store-owned theme record and a copy of its layouts. That copy becomes editable independently through workspace revisions. Store data is scoped by `store_id` and uses optimistic revision checks for mutations.

Required page templates:

- Home
- Collection
- Product
- Cart
- Search
- 404

Each layout contains ordered sections. Sections contain settings and optional blocks. Controls use the existing registry types for text, rich text, link, product, collection, image, color, typography, spacing, alignment, and boolean options.

## Editor behavior

The admin theme screen lists installed themes and available starter packs. A merchant can install a starter pack, preview it, activate it, or open it in the editor.

The editor uses a single contextual left rail:

- hierarchy: Header, Template, and Footer
- section library: supported built-in sections grouped by category and searchable
- section settings: section-level controls
- block library and block settings: Heading, Text, Button, and supported section-specific blocks

Changes update the draft layout and preview immediately. Save performs a revision-safe Supabase update. Publish compiles the draft and promotes it to the public storefront. A conflict returns a recoverable revision error rather than overwriting another editor session.

## Backend contract

Keep endpoints resource-oriented and store-scoped:

- `GET /api/stores/:storeId/storefront/themes` — installed and available theme summaries
- `POST /api/stores/:storeId/storefront/themes/:themeId/install` — creates an editable store-owned copy
- `PATCH /api/stores/:storeId/storefront/themes/:themeId` — updates theme metadata or activation state with an expected revision
- existing workspace/template endpoints — save draft page layouts
- existing preview compile and publish endpoints — validate/compile/publish the active draft

The service layer owns install/activation rules. Repository code owns Supabase queries and transactions. Read paths select only required fields and batch referenced products or collections to avoid N+1 fetches. Mutations return consistent validation, conflict, and not-found errors.

## Frontend composition

Use registry-based template and section definitions rather than separate hard-coded storefront pages. Public storefront rendering consumes compiled layouts and shared section components. Theme tokens are applied at the storefront root through CSS custom properties so the same components can render both themes.

Theme gallery cards use the theme preview metadata and representative storefront screenshots. The layout is responsive, keyboard-accessible, and respects reduced motion.

## Testing and quality gates

- Registry tests verify every built-in theme has all required page layouts and valid sections/blocks.
- Install-service and repository tests verify a merchant receives an isolated editable copy.
- API tests verify authorization, validation, optimistic concurrency, activation, preview, and publish behavior.
- Renderer tests verify required pages resolve against each theme.
- Browser QA covers gallery, installation, section editing, block insertion, image/color controls, preview, and published storefronts for both themes at desktop, tablet, and mobile widths.
- Frontend type-check, focused tests, production build, and backend focused tests run before handoff.

## Non-goals

- Theme marketplace payments, third-party theme imports, drag-and-drop assets, and arbitrary custom code injection are not part of this delivery.
- The existing catalog, checkout, orders, and customer systems are reused rather than rebuilt.

## Acceptance criteria

1. A merchant can see Fresh Market and Artisan Boutique in the admin theme gallery.
2. Installing either produces a store-owned editable theme without modifying the starter pack.
3. Each installed theme supplies all required public page templates.
4. The editor can add, remove, and edit sections and blocks, including image and color settings.
5. Preview and publish render the active theme without 404, authorization, or broken-image errors.
6. All new behavior is backed by tests and browser QA.
