# V4 Core Storefront Page Context Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Collection, Custom Page, Search, Cart, Blog, and Article to the shared V4 snapshot/context/resolver/renderer pipeline.

**Architecture:** Put a complete discriminated page-context contract in the renderer package and keep live-data adapters in the storefront feature. Routes load context and call the existing resolver; global layout and section dispatch remain centralized. V3 is never passed into new V4 code.

**Tech Stack:** Next.js/React, TypeScript, Vitest, existing `@jelly/storefront-*` packages.

**Spec:** `docs/superpowers/specs/2026-09-21-v4-core-page-context-expansion-design.md`

## Global Constraints

- Preserve existing V4 template/editor/compiler/publication contracts and the V3 compatibility boundary.
- Theme state never owns catalog membership, prices, inventory, page/article bodies, search results, or cart state.
- Routes orchestrate only; templates/global regions/registry rendering stay shared.
- Cart mutations and calculations remain in the current cart subsystem.
- Keep explicit page type, edited template, and preview resource/context independent.
- Do not add richer Product merchandising, checkout customization, or V3 feature expansion.

## Review Focus

- A resource assignment points to a deleted/wrong-type template and safely falls back/not-founds.
- A reserved public path cannot be swallowed by the custom-page dynamic route.
- A missing preview resource never becomes fabricated content.
- Search empty/none/error states do not persist runtime results into a snapshot.
- Cart presentation actions delegate to core and cannot mutate theme/template state.

---

### Task 1: Complete shared PageContext and adapter contracts

**Files:**
- Modify: `jellyshops/packages/storefront-renderer/src/types.ts`, `runtime-context.ts`, `index.ts`
- Create: `jellyshops/src/features/storefront/page-context-loaders.ts`
- Test: `jellyshops/src/features/storefront/page-context-loaders.test.ts`

**Interfaces:** Produces `StorefrontPageContext` discriminated by `type`, public presentation DTOs, and `loadCollectionPageContext`, `loadPagePageContext`, `loadSearchPageContext`, `loadCartPageContext`, `loadBlogPageContext`, `loadArticlePageContext`.

- [ ] **Step 1: Write failing adapter tests**

```ts
it("returns a live collection and visible products", async () => {
  await expect(loadCollectionPageContext(reader, "summer")).resolves.toMatchObject({ type: "collection", collection: { handle: "summer" }, products: [{ id: "p-1" }] });
});
it("normalizes an empty search query without storing results", async () => {
  await expect(loadSearchPageContext(searcher, "   ")).resolves.toEqual({ type: "search", query: "", results: [], state: "empty" });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run src/features/storefront/page-context-loaders.test.ts`

Expected: FAIL because loaders and complete context union do not exist.

- [ ] **Step 3: Implement public DTO/context types and pure adapters**

```ts
export type StorefrontPageContext =
  | { type: "home" }
  | { type: "product"; product: PublicProductDetail }
  | { type: "collection"; collection: PublicCollection; products: PublicProduct[] }
  | { type: "page"; page: PublicPage }
  | { type: "search"; query: string; results: PublicSearchResult[]; state: "empty" | "results" | "none" | "error" }
  | { type: "cart"; cart: CartPresentationContext; actions: CartPresentationActions }
  | { type: "blog"; blog: PublicBlog; articles: PublicArticleSummary[] }
  | { type: "article"; article: PublicArticle; blog: PublicBlog | null };
```

Adapt existing repository/content/catalog values at loader boundaries. Return `null` for unavailable resource contexts; do not encode live values into template settings.

- [ ] **Step 4: Add hidden-resource and safe-cart-action tests, then run green**

```ts
it("does not expose an unavailable collection", async () => expect(loadCollectionPageContext(hiddenReader, "summer")).resolves.toBeNull());
it("uses the supplied cart action instead of changing template state", () => { const context = loadCartPageContext(cart); context.actions.remove("line-1"); expect(remove).toHaveBeenCalledWith("line-1"); });
```

Run: `npm test -- --run src/features/storefront/page-context-loaders.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-renderer/src jellyshops/src/features/storefront/page-context-loaders*
git commit -m "feat: define v4 storefront page contexts"
```

### Task 2: Migrate Collection through V4

**Files:**
- Create: `jellyshops/src/app/[storeSlug]/collections/[collectionSlug]/page.tsx`
- Modify: `jellyshops/src/features/storefront/resource-loader.ts`, `storefront-page.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/render-registry.tsx`
- Test: `jellyshops/src/features/storefront/resource-loader.test.ts`, `storefront-page.test.tsx`

**Interfaces:** Consumes `loadCollectionPageContext`; produces a thin collection route and V4 collection section renderers.

- [ ] **Step 1: Write failing resolution/rendering tests**

```tsx
it("uses an assigned collection template before the default and wraps it in global layout", async () => {
  const route = await resolveStorefrontRoute(snapshot, { type: "collection", handle: "summer" }, reader);
  expect(route).toMatchObject({ status: "ready", template: { id: "summer-template" } });
});
it("renders collection title and live products", () => render(<PublishedRuntimeStorefront {...collectionProps()} />));
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx`

Expected: FAIL because collection page context and route are not rendered.

- [ ] **Step 3: Implement route/context handoff and collection sections**

Use `/:storeSlug/collections/:collectionSlug`; route loads store, invokes `loadCollectionPageContext`, then `resolveStorefrontRoute`. Register `collection-header` and `collection-product-grid` renderers that narrow `context.page.type === "collection"`; render supplied live DTOs only.

- [ ] **Step 4: Add fallback/preview tests and run green**

```ts
it("falls back to the collection default when no assignment exists", async () => expect(await resolveStorefrontRoute(unassigned, request, reader)).toMatchObject({ template: { id: "collection-default" } }));
```

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/app/[storeSlug]/collections jellyshops/src/features/storefront jellyshops/packages/storefront-renderer/src
git commit -m "feat: render collections through v4 storefront"
```

### Task 3: Migrate Custom Page and reserve system paths

**Files:**
- Modify: `jellyshops/src/app/[storeSlug]/[pageSlug]/page.tsx`, `jellyshops/src/features/storefront/page-context-loaders.ts`
- Modify: `jellyshops/packages/storefront-registry/src/sections/content.ts`, renderer registry
- Test: page-context loader and route tests

**Interfaces:** Produces `page-content` section and Page context sourced from content records.

- [ ] **Step 1: Write failing tests**

```ts
it("uses content body in PageContext and the default page template", async () => expect(await loadPagePageContext(reader, "our-story")).toMatchObject({ type: "page", page: { title: "Our story", body: "..." } }));
it("rejects reserved page slugs", () => expect(isReservedStorefrontSlug("collections")).toBe(true));
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/features/storefront/page-context-loaders.test.ts`

Expected: FAIL because Page context/reserved-slug helper is absent.

- [ ] **Step 3: Implement the V4 handoff and `page-content` section**

Resolve published page content by slug, then call the shared V4 resolver. Keep the existing V3 content route only when publication classification is V3. Register `page-content` for `page` only; render nothing if context is not `page`.

- [ ] **Step 4: Run green**

Run: `npm test -- --run src/features/storefront/page-context-loaders.test.ts src/features/storefront/storefront-page.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/app/[storeSlug]/[pageSlug]/page.tsx jellyshops/src/features/storefront jellyshops/packages/storefront-*
git commit -m "feat: render custom pages through v4 storefront"
```

### Task 4: Migrate Search and Cart runtime contexts

**Files:**
- Modify: `jellyshops/src/app/[storeSlug]/{search,cart}/page.tsx`, page-context loaders, renderer registry
- Test: `jellyshops/src/features/storefront/page-context-loaders.test.ts`, cart/search route tests

**Interfaces:** Produces request-driven Search context and core-delegating Cart presentation context.

- [ ] **Step 1: Write failing tests for search states and cart delegation**

```ts
it.each([["", "empty"], ["missing", "none"], ["cake", "results"]])("sets search state for %s", async (query, state) => expect((await loadSearchPageContext(searcher, query)).state).toBe(state));
it("does not alter a cart when rendering it", () => { render(<CartSection context={cartContext} />); expect(updateQuantity).not.toHaveBeenCalled(); });
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/features/storefront/page-context-loaders.test.ts`

Expected: FAIL because Search/Cart contexts are incomplete.

- [ ] **Step 3: Implement V4 routes and context-narrowing sections**

Search route normalizes URL query, loads live results, and uses `templateDefaults.search`. Cart route reads current cart and action callbacks, uses `templateDefaults.cart`, and passes no-op preview actions only in editor mode. Existing cart panel/business methods remain source of truth.

- [ ] **Step 4: Run green and commit**

Run: `npm test -- --run src/features/storefront/page-context-loaders.test.ts src/features/storefront/storefront-page.test.tsx && npm run typecheck`

Expected: PASS.

```bash
git add jellyshops/src/app/[storeSlug]/search jellyshops/src/app/[storeSlug]/cart jellyshops/src/features/storefront jellyshops/packages/storefront-renderer/src
git commit -m "feat: render search and cart through v4 storefront"
```

### Task 5: Migrate Blog and Article with minimal content sections

**Files:**
- Create: `jellyshops/src/app/[storeSlug]/blogs/[blogHandle]/{page.tsx,[articleHandle]/page.tsx}`
- Modify: page-context loaders, registry content definitions/renderer registry
- Test: page-context loader/renderer tests

**Interfaces:** Produces live Blog/Article contexts and `blog-articles`/`article-content` sections.

- [ ] **Step 1: Write failing tests**

```ts
it("loads published blog article summaries", async () => expect(await loadBlogPageContext(reader, "journal")).toMatchObject({ type: "blog", articles: [{ title: "First entry" }] }));
it("loads article content and parent blog", async () => expect(await loadArticlePageContext(reader, "journal", "first-entry")).toMatchObject({ type: "article", article: { title: "First entry" } }));
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/features/storefront/page-context-loaders.test.ts`

Expected: FAIL because Blog/Article loaders and renderers do not exist.

- [ ] **Step 3: Implement canonical routes and context-specific sections**

Routes use `/blogs/:blogHandle` and `/blogs/:blogHandle/:articleHandle`; each loader returns visible content only. `blog-articles` renders summaries only under `blog`; `article-content` renders title/body/author/date only under `article`.

- [ ] **Step 4: Add assignment/default/global wrapper tests and run green**

```ts
it("uses assigned Article template before the default", async () => expect(await resolveStorefrontRoute(snapshot, articleRequest, reader)).toMatchObject({ template: { id: "article-feature" } }));
```

Run: `npm test -- --run src/features/storefront/page-context-loaders.test.ts src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/app/[storeSlug]/blogs jellyshops/src/features/storefront jellyshops/packages/storefront-*
git commit -m "feat: render blog and article through v4 storefront"
```

### Task 6: Finish editor previews and cross-page verification

**Files:**
- Modify: `jellyshops/src/app/admin/online-store/editor/page.tsx`, selector components/API DTOs
- Test: editor selector, runtime integration, V3 compatibility tests

**Interfaces:** Consumes all Task 1–5 loaders; produces independent template/preview-resource/query/cart controls.

- [ ] **Step 1: Write failing editor-preview contract tests**

```ts
it("changes the preview resource without changing the selected template", () => { selectPreview("collection-2"); expect(activeTemplateId()).toBe("collection-default"); });
it("uses draft snapshot for preview while public uses published snapshot", () => expect(previewSnapshot.sourceGeneration).not.toBe(publicSnapshot.sourceGeneration));
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/features/store-editor src/features/storefront`

Expected: FAIL until all preview context controls use shared loaders.

- [ ] **Step 3: Implement selectors and shared preview adapter calls**

Add real Page/Blog/Article options, collection selection, preview query, and safe cart presentation. Preserve independent `activeTemplateId`; only assignment UI mutates assignment records. Route every preview result through the compiled draft snapshot and shared renderer.

- [ ] **Step 4: Run complete verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck && npm run build`

Expected: PASS.

Run: `npx eslint src/app/[storeSlug] src/features/storefront packages/storefront-renderer/src src/app/admin/online-store/editor/page.tsx`

Expected: no new errors in touched files.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/app/admin/online-store/editor/page.tsx jellyshops/src/features/storefront jellyshops/packages/storefront-* 
git commit -m "feat: preview all core pages through v4 storefront"
```

## Self-review

- **Spec coverage:** Tasks 1–5 cover the full PageContext union and all six requested page types; Task 6 verifies editor separation, snapshot boundaries, V3 fallback, buildability, and lint scope.
- **Type consistency:** every task uses `StorefrontPageContext`, page-context loaders, `resolveStorefrontRoute`, and the shared V4 renderer; no alternate route renderer is introduced.
- **Review Focus coverage:** Task 2/3 test template and reserved-path failure modes; Task 4 tests runtime search/cart behavior; Task 6 tests missing preview context and snapshot isolation.
