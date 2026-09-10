# Local Store Editor Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-first, five-theme Store Editor foundation whose editor preview and public storefront share one schema-driven renderer.

**Architecture:** The existing Next.js application stays at the repository root and remains responsible for local persistence, routing, and commerce integration. New npm workspace packages define the Store Design document, canonical registry, themes, shared UI primitives, and React renderer. `ShopRepository` stores revisioned drafts and immutable publication snapshots inside the existing local-storage state.

**Tech Stack:** npm workspaces, TypeScript, Next.js, React, Zod, Vitest, React Testing Library, Playwright, localStorage mock adapters.

**Spec:** `docs/superpowers/specs/2026-08-30-local-store-editor-foundation-design.md`

## Global Constraints

- Preserve the existing single Next.js application and local-first mock-adapter architecture.
- Use npm only; add `workspaces: ["packages/*"]` without creating empty app workspaces.
- Do not add Express, Prisma, PostgreSQL, Firebase, Cloud Storage, remote API routes, Redis, GraphQL, Kubernetes, CRDTs, arbitrary merchant HTML/CSS/JavaScript, or a second storefront renderer.
- Store Editor V1 themes are `minimal`, `classic`, `bold`, `elegant`, and `playful`.
- Theme changes preserve document content and stable node IDs.
- Public rendering reads only the current immutable publication; it never reads the editable draft.
- Draft saves use expected revisions and return a conflict result rather than silently overwriting newer data.
- All production behavior begins with a failing test and each task has its own commit.

---

### Task 1: Establish workspace packages and shared test harness

**Files:**
- Modify: `package.json`, `next.config.ts`, `vitest.config.ts`, `tsconfig.json`
- Create: `vitest.workspace.ts`
- Create: `packages/storefront-{schema,registry,themes,ui,renderer}/package.json`
- Create: `packages/storefront-{schema,registry,themes,ui,renderer}/tsconfig.json`
- Create: `packages/storefront-schema/src/index.ts`, `packages/storefront-schema/src/index.test.ts`

**Interfaces:** Produces five npm packages named `@jelly/storefront-schema`, `@jelly/storefront-registry`, `@jelly/storefront-themes`, `@jelly/storefront-ui`, and `@jelly/storefront-renderer`; exports `STORE_DESIGN_SCHEMA_VERSION` from the schema package.

- [ ] **Step 1: Write the failing schema-package smoke test**

```ts
import { expect, it } from "vitest";
import { STORE_DESIGN_SCHEMA_VERSION } from "./index";

it("exposes the first Store Design schema version", () => {
  expect(STORE_DESIGN_SCHEMA_VERSION).toBe(1);
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `npm run test:unit -- --run packages/storefront-schema/src/index.test.ts`

Expected: FAIL because the package entry point does not exist.

- [ ] **Step 3: Configure the workspace and test discovery**

Add `workspaces: ["packages/*"]`, retain the existing root app scripts, add `test:unit`, configure Vitest to include `src/**/*.test.{ts,tsx}` and `packages/**/*.test.{ts,tsx}`, and add all five workspace manifests with TypeScript source exports. Add `transpilePackages` for all `@jelly/*` packages in `next.config.ts`.

- [ ] **Step 4: Export the schema version**

```ts
export const STORE_DESIGN_SCHEMA_VERSION = 1 as const;
```

- [ ] **Step 5: Run focused and repository checks**

Run: `npm run test:unit -- --run packages/storefront-schema/src/index.test.ts`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts vitest.config.ts vitest.workspace.ts tsconfig.json packages
git commit -m "chore: scaffold local store editor packages"
```

### Task 2: Define the versioned Store Design document

**Files:**
- Create: `packages/storefront-schema/src/types.ts`, `schema.ts`, `defaults.ts`, `migrations.ts`
- Modify: `packages/storefront-schema/src/index.ts`
- Create: `packages/storefront-schema/src/schema.test.ts`, `migrations.test.ts`

**Interfaces:** Produces `ThemeId`, `PageType`, `BlockNode`, `SectionNode`, `PageDocument`, `StoreDesignDocument`, `storeDesignDocumentSchema`, `createDefaultStoreDesign(themeId?)`, and `migrateStoreDesignDocument(input)`.

- [ ] **Step 1: Write failing schema tests**

Cover a valid default document; invalid theme; malformed responsive value; missing `home`, `product`, or `collection` documents; and mandatory `product-information`/`collection-product-grid` sections.

- [ ] **Step 2: Verify the schema tests fail**

Run: `npm run test:unit -- --run packages/storefront-schema/src/schema.test.ts`

Expected: FAIL because the schema and default factory are absent.

- [ ] **Step 3: Implement types, Zod schema, and deterministic defaults**

```ts
export const themeIdSchema = z.enum(["minimal", "classic", "bold", "elegant", "playful"]);
export function createDefaultStoreDesign(themeId: ThemeId = "minimal"): StoreDesignDocument;
```

Use `crypto.randomUUID()` for node IDs. Define Header, Home, Product, Collection, and Footer pages; include the mandatory commerce sections in their respective documents.

- [ ] **Step 4: Write failing migration tests and implement the dispatcher**

Test V1 pass-through, a rejected future version, and malformed input. Implement a version-map loop that validates the final `StoreDesignDocument`.

- [ ] **Step 5: Run package checks**

Run: `npm run test:unit -- --run packages/storefront-schema/src`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/storefront-schema package-lock.json
git commit -m "feat: define local store design schema"
```

### Task 3: Implement the canonical section and block registry

**Files:**
- Create: `packages/storefront-registry/src/types.ts`, `blocks.ts`, `registry.ts`, `index.ts`
- Create: `packages/storefront-registry/src/sections/{layout,content,commerce}.ts`
- Create: `packages/storefront-registry/src/registry.test.ts`

**Interfaces:** Produces `getSectionDefinition(type)`, `getBlockDefinition(type)`, `listSectionDefinitions()`, and `validateSectionAgainstRegistry(section, pageType)`.

- [ ] **Step 1: Write failing registry contract tests**

Assert the registered V1 types include `header`, `hero`, `featured-collection`, `product-grid`, `rich-text`, `faq`, `product-information`, `collection-product-grid`, and `footer`. Assert Hero allows only heading/text/button blocks, FAQ allows only faq-item blocks, page restrictions reject an invalid placement, and only declared responsive fields accept mobile overrides.

- [ ] **Step 2: Verify the test fails**

Run: `npm run test:unit -- --run packages/storefront-registry/src/registry.test.ts`

Expected: FAIL because the registry entry point is absent.

- [ ] **Step 3: Implement definitions and validation**

Define settings schemas and defaults for blocks `heading`, `text`, `button`, `faq-item`, `testimonial`, `logo`, `menu`, `contact-item`, and `social-link`. Return structured issue codes: `SECTION_NOT_REGISTERED`, `SECTION_NOT_ALLOWED_ON_PAGE`, `BLOCK_NOT_ALLOWED`, `BLOCK_LIMIT_EXCEEDED`, `SETTINGS_INVALID`, and `RESPONSIVE_FIELD_NOT_ALLOWED`.

- [ ] **Step 4: Run package checks**

Run: `npm run test:unit -- --run packages/storefront-registry/src`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storefront-registry
git commit -m "feat: add local storefront registry"
```

### Task 4: Add the five compatible semantic themes

**Files:**
- Create: `packages/storefront-themes/src/types.ts`, `theme-registry.ts`, `index.ts`
- Create: `packages/storefront-themes/src/{minimal,classic,bold,elegant,playful}/tokens.ts`
- Create: `packages/storefront-themes/src/theme-registry.test.ts`

**Interfaces:** Produces `ThemeTokens`, `ThemeDefinition`, `getThemeDefinition(themeId)`, `listThemes()`, and `resolveDesignTokens(themeId, globalSettings)`.

- [ ] **Step 1: Write failing compatibility tests**

Assert all five theme IDs are registered, have a variant for every registry section, preserve the same document reference content when `themeId` changes, and resolve semantic CSS variable keys such as `--jelly-color-background` and `--jelly-font-display`.

- [ ] **Step 2: Verify the test fails**

Run: `npm run test:unit -- --run packages/storefront-themes/src/theme-registry.test.ts`

Expected: FAIL because theme definitions are absent.

- [ ] **Step 3: Implement tokens and registry**

Give each theme distinct color, typography, radius, spacing, and shadow tokens. Implement global overrides as an explicit merge that wins over theme defaults. Keep section capabilities identical across themes.

- [ ] **Step 4: Run package checks**

Run: `npm run test:unit -- --run packages/storefront-themes/src`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storefront-themes
git commit -m "feat: add five compatible storefront themes"
```

### Task 5: Build shared UI primitives and StorefrontRenderer

**Files:**
- Create: `packages/storefront-ui/src/{button,container,product-card,index}.tsx`
- Create: `packages/storefront-renderer/src/{types,storefront-renderer,page-renderer,section-renderer,render-error-boundary,index}.tsx`
- Create: `packages/storefront-renderer/src/sections/{hero,rich-text,product-grid,header,footer}.tsx`
- Create: `packages/storefront-renderer/src/storefront-renderer.test.tsx`

**Interfaces:** Produces `StorefrontRenderer`, `CommerceDataProvider`, and `AssetResolver`; supports `mode: "preview" | "published"`.

- [ ] **Step 1: Write failing renderer tests**

Test Hero text rendering; Product Grid calling `commerce.getProducts`; root semantic CSS variables; a visible preview placeholder for an unknown section; and silent published omission of that same section.

- [ ] **Step 2: Verify the test fails**

Run: `npm run test:unit -- --run packages/storefront-renderer/src/storefront-renderer.test.tsx`

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement minimal renderer contracts and reference sections**

```ts
export interface CommerceDataProvider {
  getProducts(input?: { featured?: boolean; limit?: number }): Promise<PublicProduct[]>;
}
export interface AssetResolver { resolve(assetId: string): Promise<string | null>; }
```

Render `data-jelly-theme`, resolved CSS variables, Header, Hero, Rich Text, Product Grid, and Footer. Use an error boundary to convert section errors into a preview diagnostic or published omission. Do not use `dangerouslySetInnerHTML` for merchant content.

- [ ] **Step 4: Run package checks**

Run: `npm run test:unit -- --run packages/storefront-renderer/src`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storefront-ui packages/storefront-renderer
git commit -m "feat: add shared local storefront renderer"
```

### Task 6: Persist drafts and immutable publications locally

**Files:**
- Modify: `src/lib/domain.ts`, `src/lib/seed.ts`, `src/lib/repository.ts`
- Create: `src/lib/store-design.test.ts`
- Modify: `src/lib/repository.test.ts`

**Interfaces:** Adds `storeDesigns` to `ShopState`, `StoreDesignRecord`, `StoreDesignPublication`, `saveStoreDesignDraft(input)`, `publishStoreDesign(storeId, expectedRevision)`, and `getPublishedStoreDesign(storeId)` to `ShopRepository`.

- [ ] **Step 1: Write failing local-persistence tests**

Assert new seed state supplies a default design for each store; a correct expected revision saves a draft and increments its revision; a stale save returns `{ ok: false, code: "DRAFT_REVISION_CONFLICT" }`; publishing adds an immutable snapshot; later draft changes do not alter it; and public lookup returns only the current snapshot.

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:unit -- --run src/lib/store-design.test.ts`

Expected: FAIL because Store Design persistence does not exist.

- [ ] **Step 3: Implement repository operations**

Store copies with `structuredClone`. Validate drafts with `migrateStoreDesignDocument` and registry validation before committing. Give each publication a new ID and retain every prior snapshot. Preserve the existing `ShopState.version` migration path by accepting V1 state and adding missing design records from defaults.

- [ ] **Step 4: Run focused and repository checks**

Run: `npm run test:unit -- --run src/lib/store-design.test.ts src/lib/repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain.ts src/lib/seed.ts src/lib/repository.ts src/lib/store-design.test.ts src/lib/repository.test.ts
git commit -m "feat: persist local store design drafts"
```

### Task 7: Add the editor foundation route and local preview controls

**Files:**
- Modify: `src/components/admin-nav.tsx`, `src/app/globals.css`
- Create: `src/app/admin/store-design/page.tsx`, `page.test.tsx`
- Create: `src/features/store-editor/{editor-store,editor-store.test,commerce-provider,asset-resolver}.ts`
- Create: `src/features/store-editor/components/{editor-shell,section-outline,theme-picker,preview-panel,publish-button}.tsx`

**Interfaces:** Produces a `/admin/store-design` route backed by an editor store with `selectSection`, `addSection`, `removeSection`, `moveSection`, `setTheme`, `save`, and `publish` actions.

- [ ] **Step 1: Write failing editor tests**

Verify the merchant navigation links to Store Design; the route loads the active store design; selecting a theme does not remove a Hero heading; moving a section changes outline order; the preview contains `data-jelly-theme`; and Publish is disabled while a save is unresolved.

- [ ] **Step 2: Verify the test fails**

Run: `npm run test:unit -- --run src/app/admin/store-design/page.test.tsx src/features/store-editor/editor-store.test.ts`

Expected: FAIL because the editor route and state do not exist.

- [ ] **Step 3: Implement editor state and components**

Use a reducer or small external store local to `src/features/store-editor`; do not introduce a second global commerce state container. Adapt existing repository products into `CommerceDataProvider` and `mockAssets` into `AssetResolver`. Render the shared `StorefrontRenderer` directly in the preview panel. Autosave through the repository after a short debounce, report conflict state without overwriting, and publish only after the current revision is saved.

- [ ] **Step 4: Run editor checks**

Run: `npm run test:unit -- --run src/app/admin/store-design/page.test.tsx src/features/store-editor/editor-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin-nav.tsx src/app/admin/store-design src/features/store-editor src/app/globals.css
git commit -m "feat: add local store editor foundation"
```

### Task 8: Render published documents on public store home pages

**Files:**
- Modify: `src/app/[storeSlug]/page.tsx`, `src/app/[storeSlug]/page.test.tsx`, `src/app/globals.css`
- Create: `src/features/storefront/storefront-page.test.tsx`

**Interfaces:** Public store home pages use `repository.getPublishedStoreDesign(store.id)` and `StorefrontRenderer` with `mode="published"`; the legacy hard-coded home is used only when no publication exists during migration.

- [ ] **Step 1: Write failing publication-boundary tests**

Seed one publication whose Hero says `LIVE` and a newer draft whose Hero says `DRAFT`. Assert public rendering contains `LIVE`, does not contain `DRAFT`, and supplies the existing product catalog through `CommerceDataProvider`.

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:unit -- --run src/features/storefront/storefront-page.test.tsx`

Expected: FAIL because public pages still use the hard-coded layout.

- [ ] **Step 3: Implement the shared public rendering path**

Resolve the store by route slug, request only its current publication, adapt existing products and assets, and render the shared renderer in published mode. Retain the current hard-coded storefront only as the pre-publication migration fallback.

- [ ] **Step 4: Run public storefront checks**

Run: `npm run test:unit -- --run src/features/storefront/storefront-page.test.tsx src/app/[storeSlug]/page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/[storeSlug]/page.tsx src/app/[storeSlug]/page.test.tsx src/features/storefront src/app/globals.css
git commit -m "feat: render published local store designs"
```

### Task 9: Run the foundation quality gate

**Files:** Modify only files required to correct a proven verification failure.

**Interfaces:** The workspace packages, existing MVP flows, local Store Editor foundation, and production build all pass their project checks.

- [ ] **Step 1: Run unit, type, lint, and production-build checks**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 2: Run the existing browser journey**

```bash
npm run test:e2e
```

- [ ] **Step 3: Correct only demonstrated failures and re-run the failed command**

For each failure, add a regression test before the smallest fix when the failure exposes a production behavior gap.

- [ ] **Step 4: Commit verification fixes only when needed**

```bash
git add package.json package-lock.json next.config.ts vitest.config.ts tsconfig.json src packages
git commit -m "fix: verify local store editor foundation"
```

Do not create an empty commit when all checks already pass.

## Plan Self-Review

- Spec coverage: Tasks 1-5 implement shared workspace boundaries, schema, registry, themes, and one renderer; Tasks 6-8 implement local draft/publication state, the editor foundation, and strict public snapshot rendering; Task 9 verifies old and new behavior.
- Placeholder scan: no deferred implementation placeholders are present; later product pickers, media management, rollback UI, and Store Editor E2E coverage are explicitly outside this approved foundation scope.
- Type consistency: renderer contracts are produced in Task 5 before local adapters consume them in Tasks 7-8; document types are produced in Task 2 before repository integration in Task 6.
