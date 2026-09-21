# V4 Core Storefront Page Context Expansion — Milestone 2

**Date:** 2026-09-21  
**Status:** approved design; implementation plan pending review  
**Depends on:** `docs/superpowers/specs/2026-09-21-v4-storefront-runtime-spine-design.md`

## Goal

Extend the proven V4 storefront runtime from Home and Product to Collection, Custom Page, Search, Cart, Blog, and Article. Each page must use live commerce/content/cart/search data, centralized V4 template resolution, V4 global layout, and the same section renderer in public and preview modes. No new theme engine, publication system, V3 capabilities, or route-specific template system is introduced.

## Current support and gaps

| Page type | Existing route/runtime | V4 authoring support | Missing Milestone 2 work |
| --- | --- | --- | --- |
| Collection | no public collection route | template enum/default/assignment; collection registry sections; editor resource list | route, live collection/products adapter, V4 rendering and preview |
| Page | `/:storeSlug/:pageSlug` legacy content route | template enum/default/assignment; content Page records | V4 context/route handoff, preview resource list, content sections |
| Search | `/:storeSlug/search` legacy route | template enum/default; search-results section | request context/results adapter and V4 preview query |
| Cart | `/:storeSlug/cart` legacy route | template enum/default; cart-summary section | cart presentation/action adapter and safe preview cart |
| Blog | no public route | template enum/default; Blog records | canonical route, live listing context, preview resource, section |
| Article | no public route | template enum/default/assignment; Article records | canonical route, content context, preview resource, section |

V4 Home/Product, global regions, publication snapshots, section dispatch, and V3 fallback already exist and remain authoritative.

## Target runtime flow

```text
route/request
  -> page-context adapter (live domain data)
  -> StorefrontPageContext
  -> V4 template/global-layout resolver
  -> resolved template + named regions
  -> shared registry/theme renderer
```

The resolver never fetches catalog, content, search, or cart values. Adapters never select templates, expand globals, or dispatch sections. Public uses a published snapshot; preview uses the draft compiled snapshot with the same adapter contract.

## Shared PageContext contract

`@jelly/storefront-renderer` owns the renderer-facing discriminated union. It uses public presentation DTOs, not backend/private records:

```ts
type StorefrontPageContext =
  | { type: "home" }
  | { type: "product"; product: PublicProductDetail }
  | { type: "collection"; collection: PublicCollection; products: PublicProduct[] }
  | { type: "page"; page: PublicPage }
  | { type: "search"; query: string; results: PublicSearchResult[]; state: "empty" | "results" | "none" | "error" }
  | { type: "cart"; cart: CartPresentationContext; actions: CartPresentationActions }
  | { type: "blog"; blog: PublicBlog; articles: PublicArticleSummary[] }
  | { type: "article"; article: PublicArticle; blog: PublicBlog | null };
```

`CartPresentationActions` delegates to the current cart subsystem; it exposes update quantity, remove line, and checkout navigation callbacks only. Totals, discounts, inventory checks, and mutation rules remain core-owned. Preview supplies safe no-op actions and representative data.

Sections receive this union through the existing runtime context. Their definitions retain explicit `supportedPages`; renderer implementations narrow `context.page.type` before accessing page-specific values. An incompatible or missing context returns no content in published mode and a safe diagnostic in preview/editor mode.

## Per-page adapters and templates

### Current Collection catalog limitation

The current catalog `Collection` model exposes its identity, store ownership, name, and slug only. It has no description, image, SEO metadata, or publication field. The V4 Collection adapter therefore exposes the live model unchanged and derives membership from visible live Products whose `collectionIds` include the Collection ID. When the catalog gains more Collection metadata, the page-context adapter can expose it without changing templates, snapshots, or section renderers.

| Context | Adapter responsibility | Template selection |
| --- | --- | --- |
| Collection | resolve visible collection by handle; load its visible products | explicit collection assignment, then `templateDefaults.collection` |
| Page | resolve visible/published Page by slug; expose title/body/SEO-safe content | explicit page assignment, then `templateDefaults.page` |
| Search | normalize query; execute catalog search; expose empty/results/none/error | `templateDefaults.search` only |
| Cart | read active cart and presentation totals; bind existing cart operations | `templateDefaults.cart` only |
| Blog | resolve visible Blog by handle; list visible article summaries | explicit assignment if supported, otherwise `templateDefaults.blog` |
| Article | resolve visible Article by blog/article handle; load parent blog metadata | explicit article assignment, then `templateDefaults.article` |

Assignments remain explicit merchant actions; selecting a preview resource never changes an assignment. Missing, wrong-type, deleted, or unavailable template references yield the existing safe resolver not-found/fallback result.

## Public routes and collisions

Canonical public routes are:

```text
/:storeSlug/collections/:collectionSlug
/:storeSlug/search
/:storeSlug/cart
/:storeSlug/blogs/:blogHandle
/:storeSlug/blogs/:blogHandle/:articleHandle
/:storeSlug/:pageSlug                (custom pages only)
```

Existing `/products/:productSlug`, `/shop`, `/checkout`, and `/order/:publicToken` remain reserved. `collections`, `products`, `search`, `cart`, `blogs`, `shop`, `checkout`, `order`, `admin`, and `api` are reserved custom-page slugs. Explicit route folders take precedence over `[pageSlug]`; content creation validates the same reserved set so a custom page cannot shadow a system route.

## Shared rendering and global layout

Every V4 route invokes the central resolver and then the existing V4 composition renderer. The renderer receives `{ context, layout, snapshot, commerce }`, renders announcement/header/template/footer regions in order, and delegates only to registry/theme section implementations. Routes contain no section loops, theme parsing, template selection, or global composition.

## Editor and preview

The existing selector has three independent values: page type, template being edited, and preview context.

- Collection/Page/Blog/Article receive real-resource selector lists.
- Search receives an editor-controlled preview query with deterministic empty/default results.
- Cart receives a representative cart fixture derived from current catalog but its actions are no-ops.
- Preview compiles the draft snapshot, creates the selected page context, calls the shared resolver, and renders the same composition component as public routes.

Changing any preview context leaves the selected template and every template assignment unchanged.

## Registry additions

Retain existing `collection-header`, `collection-product-grid`, `cart-summary`, and `search-results` definitions. Add only:

- `page-content` — title/body from `page` context;
- `blog-articles` — blog title and live article summaries from `blog` context;
- `article-content` — title/body/author/date from `article` context.

Each definition declares the exact supported page type and minimal settings. No Product section becomes available to unrelated contexts.

## V3 compatibility and failure behavior

Publication loading remains the only V3/V4 classifier. V4 snapshots use adapters/resolver/renderer; V3 documents use the legacy renderer unchanged. Missing public resources return route not-found. Empty search/cart/blog states render their V4 template with explicit safe context. Missing optional global sections are omitted without dropping remaining content. Preview resource disappearance shows an editor-safe unavailable state rather than invented content.

## Tests

- each adapter: live context, hidden/missing resource, template assignment/default/fallback;
- each page: V4 global regions, section ordering, live context consumption, published versus draft snapshot separation;
- search: empty, results, none, error; cart: action delegation and no theme-state mutation;
- registry: page compatibility and missing-context fallback;
- routes: reserved-slug collision behavior; V3 public document remains on compatibility renderer;
- integration: shared renderer accepts every PageContext discriminator.

## Expected files

- `packages/storefront-renderer/src/{types,runtime-context,render-registry}.tsx` plus page-context section modules/tests;
- `src/features/storefront/{resource-loader,page-context-loaders,storefront-page}` and tests;
- public route folders for collections/blogs plus migrated page/search/cart routes;
- `src/app/admin/online-store/editor/page.tsx` and selector/API types;
- registry section definitions and compiler/validation tests only where new sections require them;
- content/catalog/cart public DTO adapters. No database migration is expected unless Blog assignment support is absent.

## Implementation phases

1. Formalize the complete shared PageContext union and adapter boundaries.
2. Collection adapter, route, section rendering, and preview.
3. Custom Page adapter, route handoff, `page-content`, and preview.
4. Search context/route/preview query.
5. Cart presentation/action context/route/preview state.
6. Blog and Article routes, content contexts, and three minimal content sections.
7. Complete editor selectors and cross-page integration/compatibility tests.

The app remains buildable after each phase. Richer Product merchandising, checkout customization, recommendation systems, navigation redesign, and V3 migration remain out of scope.
