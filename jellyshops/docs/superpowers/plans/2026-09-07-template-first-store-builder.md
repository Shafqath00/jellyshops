# Template-first store builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Jellyshops merchants select a starter template, manage custom storefront pages, edit each page with the existing section editor, and render the selected page.

**Architecture:** Evolve `StorefrontDocument` from version 2's single template region to version 3's ordered page collection. Keep shared header, footer, theme settings, registry controls, autosave, revision control, and rendering components. Add a dedicated template catalog as deterministic seed data, then make active page selection an editor state concern.

**Tech Stack:** TypeScript, Zod, React, Next.js, Vitest, Tailwind CSS, dnd-kit.

**Spec:** `docs/superpowers/specs/2026-09-07-template-first-store-builder-design.md`

## Global Constraints

- Migrate all schema version 2 documents automatically before editor or renderer use.
- Preserve IDs and shared regions during migration.
- Only custom pages can be renamed or deleted.
- Custom-page slugs are lowercase, URL-safe, unique, and cannot use reserved route segments.
- Reuse the existing section and block registry; do not introduce arbitrary HTML blocks.

---

### Task 1: Version 3 storefront document and template catalog

**Files:**
- Modify: `packages/storefront-schema/src/storefront-v2.ts`
- Modify: `packages/storefront-schema/src/index.ts`
- Create: `packages/storefront-schema/src/storefront-v3.test.ts`
- Create: `packages/storefront-schema/src/templates.ts`
- Test: `packages/storefront-schema/src/storefront-v3.test.ts`

**Interfaces:**
- Produces `StorefrontPage`, `StorefrontPageType`, `StorefrontTemplateId`, `createStorefrontTemplate`, and `getStorefrontPage`.
- Produces `migrateStorefrontDocument(input, storeId): StorefrontDocument` for version 2 and version 3 inputs.

- [ ] **Step 1: Write the failing schema and migration tests**

```ts
it("migrates a version 2 home template into a version 3 home page", () => {
  const legacy = createDefaultStorefrontDocument("shop-1");
  const migrated = migrateStorefrontDocument(legacy, "shop-1");
  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.pages[0]).toMatchObject({ type: "home", slug: "/", system: true });
  expect(migrated.pages[0].sections).toEqual(legacy.regions.template);
});
```

- [ ] **Step 2: Run the schema test and verify it fails because version 3 has not been implemented**

Run: `npm test -- --run packages/storefront-schema/src/storefront-v3.test.ts`

- [ ] **Step 3: Implement the version 3 Zod schema, version 2 migration, and template factory**

```ts
export interface StorefrontPage {
  id: string;
  type: "home" | "product" | "collection" | "custom";
  title: string;
  slug: string;
  system: boolean;
  sections: SectionNode[];
}
```

- [ ] **Step 4: Run the focused schema tests and package typecheck**

Run: `npm test -- --run packages/storefront-schema/src/storefront-v3.test.ts && npm run typecheck`

### Task 2: Page lifecycle editor commands and active-page state

**Files:**
- Modify: `src/features/store-editor/model/types.ts`
- Modify: `src/features/store-editor/model/commands.ts`
- Modify: `src/features/store-editor/state/types.ts`
- Modify: `src/features/store-editor/state/reducer.ts`
- Create: `src/features/store-editor/model/page-commands.test.ts`

**Interfaces:**
- Consumes `StorefrontPage` and `getStorefrontPage` from Task 1.
- Produces `add-page`, `rename-page`, `remove-page`, and `set-active-page` command behaviour.

- [ ] **Step 1: Write failing command tests for adding a custom page and rejecting removal of Home**

```ts
expect(applyCommand(document, { type: "add-page", page })).toHaveProperty("pages", expect.arrayContaining([expect.objectContaining({ slug: "our-story" })]));
expect(() => applyCommand(document, { type: "remove-page", pageId: home.id })).toThrow("System pages cannot be removed");
```

- [ ] **Step 2: Run focused editor-model tests and verify expected failures**

Run: `npm test -- --run src/features/store-editor/model/page-commands.test.ts`

- [ ] **Step 3: Implement page commands and reconcile active page selection after delete or reload**

- [ ] **Step 4: Run focused model tests**

Run: `npm test -- --run src/features/store-editor/model/page-commands.test.ts`

### Task 3: Page manager UI and active-page preview

**Files:**
- Modify: `src/features/store-editor/components/editor-shell.tsx`
- Modify: `src/features/store-editor/components/page-hierarchy.tsx`
- Modify: `src/features/store-editor/components/preview-canvas.tsx`
- Modify: `src/features/store-editor/components/editor-toolbar.tsx`
- Create: `src/features/store-editor/components/page-hierarchy.test.tsx`

**Interfaces:**
- Consumes Task 2's active page state and page commands.
- Produces an accessible Pages list, Add page dialog, page-specific section hierarchy, and selected-page title in the toolbar.

- [ ] **Step 1: Write a failing component test that adds and selects “Our story”**

```tsx
await user.click(screen.getByRole("button", { name: "Add page" }));
await user.type(screen.getByLabelText("Page title"), "Our story");
await user.click(screen.getByRole("button", { name: "Create page" }));
expect(screen.getByRole("button", { name: "Our story" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the component test and verify expected failure**

Run: `npm test -- --run src/features/store-editor/components/page-hierarchy.test.tsx`

- [ ] **Step 3: Implement page navigation and ensure Add section targets the active page**

- [ ] **Step 4: Run focused component tests**

Run: `npm test -- --run src/features/store-editor/components/page-hierarchy.test.tsx`

### Task 4: Selected-page renderer and public custom page route

**Files:**
- Modify: `packages/storefront-renderer/src/types.ts`
- Modify: `packages/storefront-renderer/src/storefront-renderer.tsx`
- Modify: `src/features/storefront/storefront-page.tsx`
- Create: `src/app/[storeSlug]/[pageSlug]/page.tsx`
- Create: `packages/storefront-renderer/src/storefront-renderer-v3.test.tsx`

**Interfaces:**
- Consumes `getStorefrontPage(document, slug)` from Task 1.
- Produces renderer support for a requested page ID or slug and published custom page routes.

- [ ] **Step 1: Write a failing renderer test for rendering only “Our story” sections**

```tsx
render(<StorefrontRenderer document={document} pageId="story" mode="preview" commerce={commerce} />);
expect(screen.getByText("Our story")).toBeInTheDocument();
expect(screen.queryByText("Home hero")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the renderer test and verify expected failure**

Run: `npm test -- --run packages/storefront-renderer/src/storefront-renderer-v3.test.tsx`

- [ ] **Step 3: Render the selected page and implement the Next.js custom page route**

- [ ] **Step 4: Run renderer tests, TypeScript, and production build**

Run: `npm test -- --run packages/storefront-renderer/src/storefront-renderer-v3.test.tsx && npm run typecheck && npm run build`

### Task 5: Final integration verification

**Files:**
- Modify: `docs/superpowers/specs/2026-09-07-template-first-store-builder-design.md` only if delivered behavior changes from the approved design.

- [ ] **Step 1: Run affected unit suites**

Run: `npm test -- --run packages/storefront-schema src/features/store-editor/model src/features/store-editor/components/page-hierarchy.test.tsx packages/storefront-renderer`

- [ ] **Step 2: Run project verification**

Run: `npm run typecheck && npm run build`

- [ ] **Step 3: Verify a merchant can select Bakes or Essentials, create a custom page, add a section, save, and publish**

Run: `npm run dev`
