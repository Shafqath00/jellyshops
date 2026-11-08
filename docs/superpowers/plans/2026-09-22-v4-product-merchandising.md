# V4 Product Merchandising Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make V4 Product templates render live catalog data and delegate variant, quantity, and cart actions through existing commerce services.

**Architecture:** Add a narrow Product presentation contract to the shared renderer, populated by the existing Product route and consumed by registry-owned sections. Publications retain layout/settings only; Product and cart state remain live. Editor preview uses the same display contract with preview-only local interaction state.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Zod, existing storefront schema/registry/renderer packages, existing product-configuration/cart domain helpers.

**Spec:** `docs/superpowers/specs/2026-09-22-v4-product-merchandising-design.md`

## Global Constraints

- Do not add routes, a second renderer pipeline, or a new publication model.
- Never put price, stock, variants, availability, or cart state in theme configuration or snapshots.
- Use existing variant resolution, configured price, stock, and cart services.
- Every registry section defines compatibility, schema, controls, defaults, renderer, and tests.
- Preserve draft/public isolation, store isolation, V3 boundaries, and generated-file exclusions.

## Review Focus

- Required option missing: purchase stays disabled with a live selection-required message. Task 2 tests this.
- Variant unavailable or out of stock: quantity clamps to availability and cart mutation is not attempted. Task 2 tests this.
- Optional media, compare-at, vendor/SKU, description, or related Products absent: relevant UI omits safely. Task 3 tests this.
- Product section placed on another page type: registry returns `SECTION_NOT_ALLOWED_ON_PAGE`. Task 1 tests this.
- Draft Product layout changed but unpublished: preview changes while active public publication remains unchanged. Task 5 tests this.

---

### Task 1: Define Product section contracts in the registry

**Files:**
- Modify: `jellyshops/packages/storefront-registry/src/sections/commerce.ts`
- Modify: `jellyshops/packages/storefront-registry/src/registry.test.ts`
- Modify: `jellyshops/packages/storefront-registry/src/theme-packs.ts`

**Interfaces:**
- Consumes: `SectionDefinition`, `ControlDefinition`, `validateSectionAgainstRegistry`.
- Produces: Product-only definitions `product-gallery`, `product-information`, `product-options`, `product-purchase`, `product-description`, `related-products`.

- [ ] **Step 1: Write failing compatibility tests**

```ts
for (const type of ["product-gallery", "product-information", "product-options", "product-purchase", "product-description", "related-products"]) {
  expect(validateSectionAgainstRegistry(section(type), "product")).toEqual([]);
  expect(validateSectionAgainstRegistry(section(type), "collection")).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "SECTION_NOT_ALLOWED_ON_PAGE" }),
  ]));
}
```

- [ ] **Step 2: Verify red**

Run: `npm exec vitest run packages/storefront-registry/src/registry.test.ts`

Expected: FAIL because the Product section types are not registered.

- [ ] **Step 3: Implement minimum visual-only schemas**

```ts
{
  type: "product-gallery",
  category: "commerce",
  supportedPages: ["product"],
  settingsSchema: z.object({ imageFit: z.enum(["cover", "contain"]) }),
  controls: [{ key: "imageFit", label: "Image fit", group: "style", type: "segmented", options: [{ label: "Cover", value: "cover" }, { label: "Contain", value: "contain" }] }],
  allowedBlockTypes: [], defaultSettings: { imageFit: "cover" }, defaultBlocks: [], responsiveFields: ["imageFit"],
}
```

Add visual controls only: gallery fit, metadata visibility, price treatment, option-control style, purchase label, description spacing, and related-product limit. Update the Product theme pack order.

- [ ] **Step 4: Verify green**

Run: `npm exec vitest run packages/storefront-registry/src/registry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-registry/src/sections/commerce.ts jellyshops/packages/storefront-registry/src/registry.test.ts jellyshops/packages/storefront-registry/src/theme-packs.ts
git commit -m "feat: define v4 product merchandising sections"
```

### Task 2: Create live Product presentation and purchase context

**Files:**
- Modify: `jellyshops/packages/storefront-renderer/src/types.ts`
- Create: `jellyshops/src/features/storefront/product-presentation.ts`
- Create: `jellyshops/src/features/storefront/product-presentation.test.ts`

**Interfaces:**
- Consumes: existing `Product`, `ConfiguredOptionSelection`, `resolveProductVariant`, and `getConfiguredPriceMinor` in the frontend composition layer.
- Produces: a frontend `createProductPresentationContext` builder matching the renderer's exported `ProductPresentationContext` interface.

- [ ] **Step 1: Write failing state tests**

```ts
expect(createProductPresentationContext(product, { selections: [], quantity: 1 }))
  .toMatchObject({ availability: { state: "selection-required" }, canAddToCart: false });
expect(createProductPresentationContext(product, { selections: selected, quantity: 99 }).quantity)
  .toBe(availableStock);
```

- [ ] **Step 2: Verify red**

Run: `npm exec vitest run src/features/storefront/product-presentation.test.ts`

Expected: FAIL because `createProductPresentationContext` does not exist.

- [ ] **Step 3: Implement the discriminated context**

```ts
export interface ProductPresentationContext {
  product: { id: string; title: string; description: string; media: ProductMedia[]; vendor?: string; options: ProductOptionView[] };
  selection: { options: ConfiguredOptionSelection[]; quantity: number };
  pricing: { price: string; compareAtPrice?: string };
  availability: { state: "available" | "out-of-stock" | "selection-required" | "unavailable"; message: string; maxQuantity: number };
  canAddToCart: boolean;
  selectOption(optionId: string, valueId: string): void;
  setQuantity(quantity: number): void;
  addToCart(): Promise<{ ok: boolean; message?: string }>;
}
```

The renderer package exports the structural interface only. Route composition owns React state and passes callbacks. The renderer package must not import repositories or mutate carts.

- [ ] **Step 4: Verify green**

Run: `npm exec vitest run src/features/storefront/product-presentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-renderer/src/types.ts jellyshops/src/features/storefront/product-presentation.ts jellyshops/src/features/storefront/product-presentation.test.ts
git commit -m "feat: add live product presentation contract"
```

### Task 3: Add shared Product section renderers

**Files:**
- Create: `jellyshops/packages/storefront-renderer/src/sections/product-sections.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/render-registry.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx`

**Interfaces:**
- Consumes: `ProductPresentationContext` from Task 2 through the shared runtime context.
- Produces: shared renderers for all six registry Product section types.

- [ ] **Step 1: Write failing renderer and interaction tests**

```tsx
render(<RegistrySectionRenderer section={section("product-gallery")} mode="published" commerce={commerce} page={productPage} />);
expect(screen.getByRole("img", { name: "Cake front" })).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Add to cart" }));
expect(productPage.resource.data.productPresentation.addToCart).toHaveBeenCalledOnce();
```

Include compare-at omission, unavailable disablement, option delegation, quantity bounds, description, and bounded related-product assertions.

- [ ] **Step 2: Verify red**

Run: `npm exec vitest run packages/storefront-renderer/src/registry-renderer.test.tsx`

Expected: FAIL because Product renderer registrations are absent.

- [ ] **Step 3: Implement narrowed renderers**

```tsx
function productContext(context: StorefrontRuntimeContext): ProductPresentationContext | null {
  return context.page?.pageType === "product" && isProductPresentation(context.page.resource.data.productPresentation)
    ? context.page.resource.data.productPresentation : null;
}
```

Use this helper in gallery, information, option, purchase, description, and related-product components. Section settings alter only presentation; button handlers call the supplied adapter.

- [ ] **Step 4: Verify green**

Run: `npm exec vitest run packages/storefront-renderer/src/registry-renderer.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-renderer/src/sections/product-sections.tsx jellyshops/packages/storefront-renderer/src/render-registry.tsx jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx
git commit -m "feat: render v4 product merchandising sections"
```

### Task 4: Compose Product/cart interactions in the current V4 Product route

**Files:**
- Modify: `jellyshops/src/app/[storeSlug]/products/[productSlug]/page.tsx`
- Modify: `jellyshops/src/features/storefront/storefront-page.tsx`
- Create: `jellyshops/src/app/[storeSlug]/products/[productSlug]/page.test.tsx`

**Interfaces:**
- Consumes: Task 2 presentation context and Task 3 renderer registrations.
- Produces: V4 Product resource data containing the live presentation adapter and existing cart-service callbacks.

- [ ] **Step 1: Write a failing V4 route interaction test**

```tsx
await user.click(screen.getByRole("radio", { name: "Medium" }));
await user.clear(screen.getByLabelText("Quantity"));
await user.type(screen.getByLabelText("Quantity"), "2");
await user.click(screen.getByRole("button", { name: "Add to cart" }));
expect(repository.updateCartItem).toHaveBeenCalledWith(expect.any(String), "medium-variant", 2, expect.any(Array), expect.any(Number));
```

- [ ] **Step 2: Verify red**

Run: `npm exec vitest run 'src/app/[storeSlug]/products/[productSlug]/page.test.tsx'`

Expected: FAIL because active V4 Product routes do not yet expose purchase interactions.

- [ ] **Step 3: Compose the adapter at the route boundary**

```ts
const productPresentation = createProductPresentationContext({ product, currency: store.currency, selections, quantity, relatedProducts, onSelectOption: setSelections, onQuantityChange: setQuantity, onAddToCart });
const resource = { type: "product", id: product.id, handle: product.slug, visible: true, data: { title: product.name, description: product.description, product, productPresentation } };
```

`onAddToCart` must call the existing cart repository methods after existing availability checks. Do not add a Product-only branch to `PublishedRuntimeStorefront`.

- [ ] **Step 4: Verify green**

Run: `npm exec vitest run 'src/app/[storeSlug]/products/[productSlug]/page.test.tsx'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'jellyshops/src/app/[storeSlug]/products/[productSlug]/page.tsx' 'jellyshops/src/app/[storeSlug]/products/[productSlug]/page.test.tsx' jellyshops/src/features/storefront/storefront-page.tsx
git commit -m "feat: compose live v4 product interactions"
```

### Task 5: Add editor preview parity and draft/public isolation coverage

**Files:**
- Modify: `jellyshops/src/features/store-editor/preview-context.ts`
- Modify: `jellyshops/src/features/store-editor/preview-context.test.ts`
- Modify: `jellyshops/src/app/admin/online-store/editor/page.tsx`
- Create: `jellyshops/src/app/admin/online-store/editor/page.test.tsx`
- Modify: `backend/src/app.local-v4.test.ts`

**Interfaces:**
- Consumes: Task 2 context and existing compile-preview/publication endpoints.
- Produces: real-Product editor preview with local-only interactions and explicit draft/public isolation proof.

- [ ] **Step 1: Write failing parity tests**

```ts
expect(createEditorPreviewPageContext({ type: "product", resourceId: "product-1", ...input }))
  .toMatchObject({ pageType: "product", resource: { data: { productPresentation: expect.any(Object) } } });
expect(previewAfterDraft.snapshot.templates["product-default"].layout).toEqual(draftLayoutB);
expect(publicBeforePublish.document.templates["product-default"].layout).toEqual(publishedLayoutA);
```

- [ ] **Step 2: Verify red**

Run: `npm exec vitest run src/features/store-editor/preview-context.test.ts 'src/app/admin/online-store/editor/page.test.tsx'`

Run: `npm exec vitest run src/app.local-v4.test.ts`

Expected: FAIL because preview context lacks Product interaction state and the new isolation case is absent.

- [ ] **Step 3: Implement preview-safe behavior**

Keep editor option/quantity state in React only. Build the same display values used publicly but use no persistence callback; editor purchase changes preview state only. Continue using `PublishControls` for compiler-backed preview.

- [ ] **Step 4: Verify green**

Run: `npm exec vitest run src/features/store-editor/preview-context.test.ts 'src/app/admin/online-store/editor/page.test.tsx'`

Run: `npm exec vitest run src/app.local-v4.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/features/store-editor/preview-context.ts jellyshops/src/features/store-editor/preview-context.test.ts jellyshops/src/app/admin/online-store/editor/page.tsx 'jellyshops/src/app/admin/online-store/editor/page.test.tsx' backend/src/app.local-v4.test.ts
git commit -m "feat: preview v4 product merchandising drafts"
```

### Task 6: Run the Product slice gate

**Files:**
- Modify only explicitly identified files if a verification failure proves a Product-slice defect.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: evidence for the Product-specific acceptance criteria.

- [ ] **Step 1: Run focused gates**

```bash
npm exec vitest run packages/storefront-registry/src/registry.test.ts src/features/storefront/product-presentation.test.ts packages/storefront-renderer/src/registry-renderer.test.tsx 'src/app/[storeSlug]/products/[productSlug]/page.test.tsx' src/features/store-editor/preview-context.test.ts
npm exec vitest run src/app.local-v4.test.ts src/storefront/publication/sql-repository.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run canonical build gates**

```bash
# jellyshops
npm run typecheck
npm run build
# backend, only when Task 5 modifies backend code
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 3: Inspect final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and no staged generated output such as `next-env.d.ts`.
