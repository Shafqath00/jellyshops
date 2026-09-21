# V4 Storefront Runtime Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make V4 snapshots the shared Home and Product public/preview runtime, including named global layout regions and live Product page context, while retaining V3 only as a compatibility fallback.

**Architecture:** Extend the existing `resource-loader` from template expansion to page-context and named-region resolution. Add a V4-only composition renderer that consumes that result, then migrate Home, Product, and V4 preview callers to it. The compiler, workspace persistence, and atomic publication path remain unchanged.

**Tech Stack:** Next.js/React 19, TypeScript, Vitest + Testing Library, Zod V4 snapshot schema, existing `@jelly/storefront-*` workspace packages.

**Spec:** `docs/superpowers/specs/2026-09-21-v4-storefront-runtime-spine-design.md`

## Global Constraints

- Reuse V4 workspace/compiler/publication/registry contracts; create no second theme engine or persistence model.
- Home and Product are the Milestone 1 public proof slice; do not expand editing for other page types.
- Product data remains live commerce data and must not be copied into theme/template JSON.
- Public rendering reads only published snapshots; preview reads only a draft compiled snapshot.
- Keep checkout platform-controlled and outside normal template execution.
- Preserve V3 rendering strictly behind publication classification/normalization.
- Follow `jellyshops/AGENTS.md`; read current Next documentation before modifying Next app code.

## Review Focus

- A Product assignment points to a missing or wrong-type template: resolve safely without rendering an unrelated layout.
- A global placement references a missing/deleted global section: omit only that placement and still render the page.
- A disabled header/footer/template section does not emit markup, including in published mode.
- The preview-selected product is absent or hidden: show a controlled empty/not-found result instead of sample data.
- A V3 publication reaches a migrated route: retain its legacy renderer path without attempting V4 region/context resolution.

---

## File Structure

- `jellyshops/src/features/storefront/resource-loader.ts` — typed route/page context, template selection, and named V4 global-layout region expansion.
- `jellyshops/src/features/storefront/resource-loader.test.ts` — deterministic resolver and malformed-global tests.
- `jellyshops/packages/storefront-renderer/src/runtime-context.ts` — extend section runtime context with serializable `PageContext`.
- `jellyshops/packages/storefront-renderer/src/types.ts` — export shared `PageContext` and V4 composition prop contracts.
- `jellyshops/packages/storefront-renderer/src/runtime-storefront.tsx` — new V4-only composition renderer; layout regions wrap template sections.
- `jellyshops/packages/storefront-renderer/src/registry-section-renderer.tsx` — pass `PageContext` to registry/theme sections.
- `jellyshops/packages/storefront-renderer/src/index.ts` — export the V4 composition renderer and types.
- `jellyshops/src/features/storefront/storefront-page.tsx` — adapt local catalog products into live page context and use the new renderer.
- `jellyshops/src/features/storefront/storefront-page.test.tsx` — Home/Product global-wrapper, section-context, and public-vs-draft integrations.
- `jellyshops/src/app/[storeSlug]/page.tsx` — thin Home route: load publication, invoke shared V4 resolver, render shared V4 output; retain classified V3 fallback.
- `jellyshops/src/app/[storeSlug]/products/[productSlug]/page.tsx` — thin Product route: load product resource, invoke shared V4 resolver/rendering when published V4 exists; retain legacy product presentation fallback.
- `jellyshops/src/app/admin/online-store/editor/page.tsx` — replace local template expansion/V4 preview section loop with the shared V4 resolver/composition renderer and selected real catalog product.
- `jellyshops/packages/storefront-renderer/src/*test.tsx` — composition/context unit coverage where colocated tests fit existing convention.

## Task 1: Resolve V4 page context, templates, and named global layout

**Files:**
- Modify: `jellyshops/src/features/storefront/resource-loader.ts`
- Test: `jellyshops/src/features/storefront/resource-loader.test.ts`

**Interfaces:**
- Consumes: `RuntimeStorefrontSnapshotV4`, `RuntimeTemplateV4`, `RuntimeGlobalSectionV4`, and `PublicResourceReader`.
- Produces: `StorefrontPageContext`, `ResolvedStorefrontLayout`, and `ResolvedStorefrontRoute` with `{ status: "ready"; context; template; layout }`.

- [ ] **Step 1: Write failing resolver tests for Home and Product result shape**

```ts
it("resolves home through its default template with named global regions", async () => {
  const result = await resolveStorefrontRoute(snapshotWithLayout(), { type: "home" }, reader(null));
  expect(result).toMatchObject({ status: "ready", context: { pageType: "home", resource: null } });
  if (result.status !== "ready") throw new Error("expected ready route");
  expect(result.layout.header.map((section) => section.id)).toEqual(["announcement", "header"]);
  expect(result.layout.footer.map((section) => section.id)).toEqual(["footer"]);
});

it("resolves an assigned product template with its live resource context", async () => {
  const result = await resolveStorefrontRoute(snapshot(), { type: "product", handle: "classic-cake" }, reader(product()));
  expect(result).toMatchObject({ status: "ready", context: { pageType: "product", resource: { id: "product-1" } } });
  if (result.status !== "ready") throw new Error("expected ready route");
  expect(result.template.id).toBe("product-featured");
});
```

- [ ] **Step 2: Run the focused resolver tests to verify the new expectations fail**

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts`

Expected: FAIL because `context` and `layout` do not exist on the V4 ready result.

- [ ] **Step 3: Define the resolver contracts and centralize expansion**

```ts
export type StorefrontPageContext =
  | { pageType: "home"; resource: null }
  | { pageType: PublicResourceType; resource: PublicStorefrontResource };

export interface ResolvedStorefrontLayout {
  announcement: SectionNode[];
  header: SectionNode[];
  template: SectionNode[];
  footer: SectionNode[];
}

export type ResolvedStorefrontRoute =
  | { status: "ready"; context: StorefrontPageContext; template: RuntimeTemplateV4; layout: ResolvedStorefrontLayout }
  | { status: "not-found"; reason: "resource" | "template" };
```

Implement `expandRuntimeLayout(snapshot, template)` in `resource-loader.ts`. It must read only `template.layout` placements, expand inline/global placements with the existing normalization helpers, classify placement `region` as `announcement | header | footer | template`, default an omitted region to `template`, preserve placement order within each region, and silently omit malformed/missing global references. Preserve `expandRuntimeTemplate` as a compatibility wrapper that returns `expandRuntimeLayout(...).template`.

- [ ] **Step 4: Add fallback and omission tests**

```ts
it("uses the product default when no assignment exists", async () => {
  const current = snapshot();
  current.assignments = [];
  const result = await resolveStorefrontRoute(current, { type: "product", handle: "classic-cake" }, reader(product()));
  expect(result).toMatchObject({ status: "ready", template: { id: "product-default" } });
});

it("omits a missing global placement without dropping remaining regions", async () => {
  const result = await resolveStorefrontRoute(snapshotWithMissingGlobal(), { type: "home" }, reader(null));
  if (result.status !== "ready") throw new Error("expected ready route");
  expect(result.layout.header).toEqual([]);
  expect(result.layout.footer.map(({ id }) => id)).toEqual(["footer"]);
});
```

- [ ] **Step 5: Run resolver tests and TypeScript check**

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the resolver boundary**

```bash
git add jellyshops/src/features/storefront/resource-loader.ts jellyshops/src/features/storefront/resource-loader.test.ts
git commit -m "feat: resolve v4 storefront page context and layout"
```

## Task 2: Build the shared V4 composition renderer and page-context propagation

**Files:**
- Modify: `jellyshops/packages/storefront-renderer/src/types.ts`
- Modify: `jellyshops/packages/storefront-renderer/src/runtime-context.ts`
- Modify: `jellyshops/packages/storefront-renderer/src/registry-section-renderer.tsx`
- Create: `jellyshops/packages/storefront-renderer/src/runtime-storefront.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/index.ts`
- Test: `jellyshops/packages/storefront-renderer/src/runtime-storefront.test.tsx`

**Interfaces:**
- Consumes: Task 1 `StorefrontPageContext` and `ResolvedStorefrontLayout` structurally, theme ID, renderer mode, and `CommerceDataProvider`.
- Produces: `RuntimeStorefrontRenderer({ themeId, style, context, layout, mode, commerce, selected?, onSelect? })` and context available to every `SectionRenderComponent`.

- [ ] **Step 1: Write a failing composition renderer test**

```tsx
it("wraps the ordered template with announcement, header, and footer sections", () => {
  render(<RuntimeStorefrontRenderer {...runtimeProps({
    layout: layoutWith("announcement", "header", "template-copy", "footer"),
  })} />);
  expect(screen.getByTestId("section-announcement-bar")).toPrecede(screen.getByTestId("section-rich-text"));
  expect(screen.getByTestId("section-footer")).toBeInTheDocument();
});

it("does not render a disabled global section", () => {
  render(<RuntimeStorefrontRenderer {...runtimeProps({ layout: layoutWithDisabledHeader() })} />);
  expect(screen.queryByTestId("section-header")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the renderer test to verify it fails**

Run: `npm test -- --run packages/storefront-renderer/src/runtime-storefront.test.tsx`

Expected: FAIL because `RuntimeStorefrontRenderer` does not exist.

- [ ] **Step 3: Extend renderer runtime context and implement the composition component**

```ts
export interface StorefrontRuntimeContext {
  mode: RendererMode;
  region?: RuntimeRegion;
  commerce: CommerceDataProvider;
  page: StorefrontPageContext;
}
```

```tsx
export function RuntimeStorefrontRenderer({ layout, page, ...props }: RuntimeStorefrontRendererProps) {
  const render = (region: RuntimeRegion, sections: SectionNode[]) =>
    sections.map((section) => <RegistrySectionRenderer key={section.id} section={section} region={region} page={page} {...props} />);
  return <div className="jelly-storefront" data-jelly-theme={props.themeId} style={props.style}>
    {render("announcement", layout.announcement)}
    {render("header", layout.header)}
    <main>{render("template", layout.template)}</main>
    {render("footer", layout.footer)}
  </div>;
}
```

Expand `RuntimeRegion` to include `announcement`; pass `page` through `RegistrySectionRenderer` to `createStorefrontRuntimeContext`. Keep `StorefrontRenderer` unchanged for V3 compatibility.

- [ ] **Step 4: Add a page-context consumer test through the registry**

```tsx
it("supplies live product page context to a product section", () => {
  const renderer = new Map(defaultSectionRenderRegistry);
  const seen: StorefrontPageContext[] = [];
  renderer.set("product-information", ({ context }) => { seen.push(context.page); return <p>Product details</p>; });
  render(<RegistrySectionRenderer section={productInformationSection()} mode="published" commerce={commerce} page={productPageContext()} registry={renderer} />);
  expect(seen).toEqual([productPageContext()]);
});
```

- [ ] **Step 5: Run renderer tests and typecheck**

Run: `npm test -- --run packages/storefront-renderer/src/runtime-storefront.test.tsx packages/storefront-renderer/src/registry-renderer.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the renderer boundary**

```bash
git add jellyshops/packages/storefront-renderer/src
git commit -m "feat: compose v4 storefront runtime layout"
```

## Task 3: Adapt local commerce to V4 page resources and migrate shared V4 storefront output

**Files:**
- Modify: `jellyshops/src/features/storefront/storefront-page.tsx`
- Modify: `jellyshops/src/features/storefront/storefront-page.test.tsx`

**Interfaces:**
- Consumes: Task 1 route/context/layout result and Task 2 `RuntimeStorefrontRenderer`.
- Produces: `createLocalPublicResourceReader(storeSlug, products)` and `PublishedRuntimeStorefront` rendering a ready V4 route with named regions and live Product context.

- [ ] **Step 1: Write failing V4 runtime integration tests**

```tsx
it("wraps Home template content with published V4 header and footer", () => {
  render(<PublishedRuntimeStorefront snapshot={snapshotWithGlobalShell()} route={readyHomeRoute()} storeSlug="sweet-bakes" currency="INR" products={[]} />);
  expect(screen.getByTestId("section-header")).toBeInTheDocument();
  expect(screen.getByText("Home content")).toBeVisible();
  expect(screen.getByTestId("section-footer")).toBeInTheDocument();
});

it("renders Product template data from the current live resource context", () => {
  render(<PublishedRuntimeStorefront snapshot={snapshotWithProductShell()} route={readyProductRoute("Fresh price")} storeSlug="sweet-bakes" currency="INR" products={[]} />);
  expect(screen.getByText("Fresh price")).toBeVisible();
});
```

- [ ] **Step 2: Run the storefront feature test to verify it fails**

Run: `npm test -- --run src/features/storefront/storefront-page.test.tsx`

Expected: FAIL because `PublishedRuntimeStorefront` currently reads `route.sections` and ignores global layout/context.

- [ ] **Step 3: Implement resource adaptation and V4 rendering**

```ts
export function createLocalPublicResourceReader(storeSlug: string, products: Product[]): PublicResourceReader {
  const productResource = (product: Product): PublicStorefrontResource => ({
    type: "product", id: product.id, handle: product.slug,
    visible: product.published && !product.archived,
    data: { product },
  });
  return { findByHandle: async (type, handle) => type === "product" ? productResource(products.find((p) => p.slug === handle)!) : null,
    findById: async (type, id) => type === "product" ? productResource(products.find((p) => p.id === id)!) : null };
}
```

Use defensive `undefined` checks rather than non-null assertions in the real implementation. Make `PublishedRuntimeStorefront` call `RuntimeStorefrontRenderer` with `route.layout` and `route.context`, retaining its theme-token calculation and existing `CommerceDataProvider`. Do not change `PublishedStorefront`, which remains V3 compatibility.

- [ ] **Step 4: Add draft/public isolation coverage**

```tsx
it("renders only the supplied V4 snapshot", () => {
  render(<PublishedRuntimeStorefront snapshot={publishedSnapshot("PUBLISHED")} route={readyHomeRoute("PUBLISHED")} storeSlug="sweet-bakes" currency="INR" products={[]} />);
  expect(screen.getByText("PUBLISHED")).toBeVisible();
  expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run feature tests and typecheck**

Run: `npm test -- --run src/features/storefront/storefront-page.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the shared V4 runtime adapter**

```bash
git add jellyshops/src/features/storefront/storefront-page.tsx jellyshops/src/features/storefront/storefront-page.test.tsx
git commit -m "feat: render published v4 storefront composition"
```

## Task 4: Migrate Home and Product routes to thin V4 route handoffs

**Files:**
- Modify: `jellyshops/src/app/[storeSlug]/page.tsx`
- Modify: `jellyshops/src/app/[storeSlug]/products/[productSlug]/page.tsx`
- Test: `jellyshops/src/features/storefront/resource-loader.test.ts`
- Test: `jellyshops/src/features/storefront/storefront-page.test.tsx`

**Interfaces:**
- Consumes: `loadPublicStorefrontPublication`, Task 1 `resolveStorefrontRoute`, Task 3 `createLocalPublicResourceReader`, and `PublishedRuntimeStorefront`.
- Produces: routes that only fetch store/resource state, classify publication kind once, resolve V4 route, and hand the ready result to the shared renderer.

- [ ] **Step 1: Write a failing route-level helper test for V4 Home/Product handoff**

```ts
it("chooses the V4 resolver for both Home and Product instead of route-local template selection", async () => {
  expect(await resolvePublishedRoute(v4Snapshot, { type: "home" }, reader)).toMatchObject({ status: "ready", context: { pageType: "home" } });
  expect(await resolvePublishedRoute(v4Snapshot, { type: "product", handle: "classic-cake" }, reader)).toMatchObject({ status: "ready", context: { pageType: "product" } });
});
```

- [ ] **Step 2: Run the existing focused tests to verify the old route-local code does not satisfy the helper contract**

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx`

Expected: FAIL until the helper is factored at the storefront feature boundary and callers use it.

- [ ] **Step 3: Replace Home’s local `homeRoute` with shared resolution**

```tsx
const route = remotePublication?.kind === "v4"
  ? awaitOrResolvedHome(remotePublication.snapshot, createLocalPublicResourceReader(store.slug, products))
  : null;
return route?.status === "ready"
  ? <PublishedRuntimeStorefront snapshot={remotePublication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={products} />
  : legacyFallback;
```

Because this client route cannot await during render, resolve its V4 route in an effect/memoized async state alongside publication loading, or expose a synchronous Home resolver that uses no resource reader. Do not retain a duplicate local expansion function.

- [ ] **Step 4: Add Product V4 publication loading and shared resolver handoff**

```tsx
const route = await resolveStorefrontRoute(snapshot, { type: "product", handle: decodedProductSlug }, createLocalPublicResourceReader(store.slug, [product]));
if (route.status === "ready") {
  return <PublishedRuntimeStorefront snapshot={snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={visibleProducts} />;
}
return <LegacyProductPage />;
```

Keep current option-selection/cart mutation mechanics in core. Pass them through a core product section/controller only if the existing V4 `product-information` renderer can support them; otherwise render a V4-safe presentation section in this task and record interactive-cart wiring as a concrete post-milestone issue. Do not bypass V4 template resolution to retain the legacy `ProductPage` theme component.

- [ ] **Step 5: Add V3 compatibility assertions**

```tsx
it("keeps a V3 publication on the compatibility renderer path", () => {
  render(<PublishedStorefront document={legacyDocument} storeSlug="sweet-bakes" currency="INR" products={[]} />);
  expect(screen.getByText("Legacy home")).toBeVisible();
});
```

- [ ] **Step 6: Run public storefront tests, lint, typecheck, and build**

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit the route migration**

```bash
git add jellyshops/src/app/[storeSlug]/page.tsx jellyshops/src/app/[storeSlug]/products/[productSlug]/page.tsx jellyshops/src/features/storefront
git commit -m "feat: route home and product through v4 storefront runtime"
```

## Task 5: Converge V4 draft preview onto the shared composition path

**Files:**
- Modify: `jellyshops/src/app/admin/online-store/editor/page.tsx`
- Test: `jellyshops/src/features/storefront/storefront-page.test.tsx`
- Test: `jellyshops/src/features/storefront/resource-loader.test.ts`

**Interfaces:**
- Consumes: Task 1 resolver/layout contracts, Task 2 V4 renderer, editor `previewResourceId`, `DemoCatalog`, and existing `/preview/compile` snapshot.
- Produces: a preview that chooses a valid real product resource and invokes the same V4 composition renderer used by public Home/Product.

- [ ] **Step 1: Write a failing preview-resolution test**

```ts
it("resolves editor preview against the selected real product rather than fixture content", async () => {
  const result = await resolveStorefrontRoute(previewSnapshot, { type: "product", handle: "selected-product" }, previewReader(selectedProduct));
  expect(result).toMatchObject({ status: "ready", context: { resource: { id: selectedProduct.id } } });
});

it("returns controlled not-found when the selected preview product is unavailable", async () => {
  await expect(resolveStorefrontRoute(previewSnapshot, { type: "product", handle: "missing" }, previewReader(null))).resolves.toMatchObject({ status: "not-found", reason: "resource" });
});
```

- [ ] **Step 2: Run focused preview/resolver coverage to verify gaps**

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx`

Expected: FAIL until the preview resource adapter and shared renderer path are wired.

- [ ] **Step 3: Replace editor-local V4 section expansion with shared resolution/rendering**

```tsx
const previewRoute = await resolveStorefrontRoute(
  previewSnapshot,
  activeTemplate.type === "home" ? { type: "home" } : { type: "product", handle: selectedProduct.slug },
  createPreviewResourceReader(catalog, activeTemplate.type),
);

return previewRoute.status === "ready"
  ? <RuntimeStorefrontRenderer page={previewRoute.context} layout={previewRoute.layout} mode="editor" commerce={commerce} themeId={resolvedTheme.id} />
  : <PreviewUnavailable resourceType={activeTemplate.type} />;
```

Create `createPreviewResourceReader` near the editor feature only if the public resource adapter cannot be shared without leaking client-only catalog types. It must convert the selected `DemoCatalog` item into `PublicStorefrontResource`, never fixture data. For this milestone support Home/Product; leave other templates on their explicit existing preview state rather than fabricating resource context.

- [ ] **Step 4: Verify V4 preview/public parity via renderer integration**

```tsx
it("uses the same V4 composition output for a draft preview and published route when supplied equivalent snapshots", () => {
  const { container: draft } = render(<RuntimeStorefrontRenderer {...editorProps(snapshot)} />);
  const { container: live } = render(<PublishedRuntimeStorefront {...publishedProps(snapshot)} />);
  expect(draft.querySelector(".jelly-storefront")?.textContent).toContain(live.querySelector(".jelly-storefront")?.textContent ?? "");
});
```

- [ ] **Step 5: Run focused tests, typecheck, lint, and build**

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit preview convergence**

```bash
git add jellyshops/src/app/admin/online-store/editor/page.tsx jellyshops/src/features/storefront jellyshops/packages/storefront-renderer/src
git commit -m "feat: preview v4 storefront through shared runtime"
```

## Task 6: Verify the complete milestone and document compatibility boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-09-21-v4-storefront-runtime-spine-design.md` only if the actual interface differs from the approved specification.
- Test: `jellyshops/src/features/storefront/resource-loader.test.ts`
- Test: `jellyshops/src/features/storefront/storefront-page.test.tsx`
- Test: `jellyshops/packages/storefront-renderer/src/runtime-storefront.test.tsx`

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: documented final V3 boundary and a verified buildable milestone.

- [ ] **Step 1: Add the final atomic publication behavioral test at the feature boundary**

```tsx
it("changes public output only when given the new published snapshot", () => {
  const { rerender } = render(<PublishedRuntimeStorefront {...publishedProps(snapshot("LIVE 1"))} />);
  expect(screen.getByText("LIVE 1")).toBeVisible();
  rerender(<PublishedRuntimeStorefront {...publishedProps(snapshot("LIVE 2"))} />);
  expect(screen.getByText("LIVE 2")).toBeVisible();
  expect(screen.queryByText("LIVE 1")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run all focused runtime tests**

Run: `npm test -- --run src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx packages/storefront-renderer/src/runtime-storefront.test.tsx packages/storefront-renderer/src/storefront-renderer-v3.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run complete project verification**

Run: `npm test`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Review the V3/V4 boundary and update the spec only if implementation forced a documented adjustment**

Confirm that `loadPublicStorefrontPublication` is the one publication-kind classifier, V3 calls only `PublishedStorefront`/`StorefrontRenderer`, and V4 calls only `resolveStorefrontRoute`/`RuntimeStorefrontRenderer`. If an interface changed, amend the relevant spec section with its final name and rationale.

- [ ] **Step 5: Commit verification/documentation adjustments**

```bash
git add docs/superpowers/specs/2026-09-21-v4-storefront-runtime-spine-design.md jellyshops/src/features/storefront jellyshops/packages/storefront-renderer/src
git commit -m "test: verify v4 storefront runtime spine"
```

## Self-review

- **Spec coverage:** Tasks 1–2 establish PageContext, deterministic resolution, named global regions, and renderer isolation. Tasks 3–4 migrate the Home/Product proof slice while keeping product data live and V3 classified. Task 5 converges draft preview. Task 6 validates publication behavior, compatibility, and the full verification suite. Checkout and persistence are deliberately untouched.
- **Placeholder scan:** No `TBD`, `TODO`, deferred implementation instruction, or unspecified test step appears in tasks; the single post-milestone cart-interaction note is explicitly scoped as a risk to resolve during Task 4 rather than an implementation placeholder.
- **Type consistency:** `StorefrontPageContext`, `ResolvedStorefrontLayout`, `ResolvedStorefrontRoute`, `RuntimeStorefrontRenderer`, `RuntimeRegion`, `createLocalPublicResourceReader`, and `createPreviewResourceReader` retain the same names across tasks.
- **Review Focus coverage:** wrong/missing templates and unavailable preview resources are Task 1/5 tests; missing globals and disabled regions are Tasks 1/2 tests; V3 compatibility is Task 4/6 coverage.
