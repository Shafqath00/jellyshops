# Jelly Shop Store Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Jelly Shop’s five-theme schema-driven Store Editor with autosaved drafts, isolated live preview, publish/rollback, Google Cloud Storage assets, commerce-aware templates, and a shared production storefront renderer.

**Architecture:** Store designs are versioned JSON documents validated by a shared schema and registry. The admin editor edits the draft locally with Zustand, mirrors changes into an isolated iframe using the same renderer package as the public storefront, and autosaves with optimistic revisioning. Express persists drafts in PostgreSQL, publishes immutable snapshots, and authorizes all merchant operations through Firebase identity plus Jelly Shop store ownership.

**Tech Stack:** npm workspaces, TypeScript, Next.js, React, Zustand, Zod, `@dnd-kit`, Vitest, React Testing Library, Playwright, Node.js, Express, Prisma, PostgreSQL/Cloud SQL, Firebase Admin, Google Cloud Storage, Supertest.

**Spec:** `docs/superpowers/specs/2026-08-30-jelly-shop-store-editor-design.md`

## Global Constraints

- Package manager is **npm only**.
- Preserve the existing Jelly Shop Google-first architecture: Next.js admin/storefront, Node.js + Express API, Prisma + PostgreSQL, Firebase Auth, Cloud Run, Cloud Storage.
- Do not add GraphQL, Redis, microservices, Kubernetes, CRDT collaboration, raw merchant CSS, merchant JavaScript, or arbitrary HTML.
- Five V1 themes: `minimal`, `classic`, `bold`, `elegant`, `playful`.
- Theme changes must preserve section/block content.
- Editor model is `Store → Page → Section → Block`; blocks are section-specific.
- Working draft is a whole versioned JSON document; publications are immutable snapshots.
- Public storefront must render only `currentPublicationId`.
- Editor preview and public storefront must use the same renderer package.
- Autosave uses optimistic revisions and must reject stale writes with HTTP 409.
- Merchant UI has Desktop and Mobile only; Mobile overrides exist only for registry fields marked responsive.
- All implementation work follows TDD and ends in an independently reviewable commit.

---

### Task 1: Establish Store Editor workspace packages and test harness

**Files:**
- Modify: `package.json`
- Create: `packages/storefront-schema/package.json`
- Create: `packages/storefront-schema/tsconfig.json`
- Create: `packages/storefront-registry/package.json`
- Create: `packages/storefront-registry/tsconfig.json`
- Create: `packages/storefront-renderer/package.json`
- Create: `packages/storefront-renderer/tsconfig.json`
- Create: `packages/storefront-themes/package.json`
- Create: `packages/storefront-themes/tsconfig.json`
- Create: `packages/storefront-ui/package.json`
- Create: `packages/storefront-ui/tsconfig.json`
- Create: `vitest.workspace.ts`
- Create: `packages/storefront-schema/src/index.ts`
- Test: `packages/storefront-schema/src/index.test.ts`

**Interfaces:**
- Produces npm workspace packages named `@jelly/storefront-schema`, `@jelly/storefront-registry`, `@jelly/storefront-renderer`, `@jelly/storefront-themes`, `@jelly/storefront-ui`.
- Produces root scripts `test`, `test:unit`, `typecheck`, and `lint` that include the new packages.

- [ ] **Step 1: Write the failing workspace smoke test**

```ts
import { describe, expect, it } from "vitest";
import { STORE_DESIGN_SCHEMA_VERSION } from "./index";

describe("storefront-schema package", () => {
  it("exports the current store design schema version", () => {
    expect(STORE_DESIGN_SCHEMA_VERSION).toBe(1);
  });
});
```

- [ ] **Step 2: Configure Vitest and run the focused test**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm run test:unit -- --run packages/storefront-schema/src/index.test.ts
```

Expected: FAIL because `STORE_DESIGN_SCHEMA_VERSION` is not exported.

- [ ] **Step 3: Add npm workspace manifests and root scripts**

Root workspaces must include:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Preserve current scripts and add the test/typecheck/lint scripts rather than replacing project-specific build/dev scripts.

- [ ] **Step 4: Implement the schema-version export**

```ts
export const STORE_DESIGN_SCHEMA_VERSION = 1 as const;
```

- [ ] **Step 5: Run focused test and repository typecheck**

```bash
npm run test:unit -- --run packages/storefront-schema/src/index.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.workspace.ts packages/storefront-*
git commit -m "chore: scaffold storefront editor packages"
```

---

### Task 2: Define the versioned StoreDesign schema and migration API

**Files:**
- Create: `packages/storefront-schema/src/types.ts`
- Create: `packages/storefront-schema/src/schema.ts`
- Create: `packages/storefront-schema/src/defaults.ts`
- Create: `packages/storefront-schema/src/migrations.ts`
- Modify: `packages/storefront-schema/src/index.ts`
- Test: `packages/storefront-schema/src/schema.test.ts`
- Test: `packages/storefront-schema/src/migrations.test.ts`

**Interfaces:**
- Produces `ThemeId`, `PageType`, `GlobalSettings`, `BlockNode`, `SectionNode`, `PageDocument`, `StoreDesignDocument`.
- Produces `storeDesignDocumentSchema`.
- Produces `createDefaultStoreDesign(themeId?: ThemeId): StoreDesignDocument`.
- Produces `migrateStoreDesignDocument(input: unknown): StoreDesignDocument`.

- [ ] **Step 1: Write failing schema tests**

Tests must cover a valid default document, invalid theme id, invalid responsive shape, and missing Home/Product/Collection pages.

- [ ] **Step 2: Run focused tests**

```bash
npm run test:unit -- --run packages/storefront-schema/src/schema.test.ts
```

Expected: FAIL because types/schema/default factory do not exist.

- [ ] **Step 3: Install Zod and implement types/schema**

```bash
npm install zod -w @jelly/storefront-schema
```

The theme schema is exactly:

```ts
export const themeIdSchema = z.enum([
  "minimal",
  "classic",
  "bold",
  "elegant",
  "playful"
]);
```

- [ ] **Step 4: Implement `createDefaultStoreDesign()`**

Default document contains Header, Home, Product, Collection, and Footer. Product includes mandatory `product-information`; Collection includes mandatory `collection-product-grid`. Use `crypto.randomUUID()` for node ids unless the repo already has UUIDv7.

- [ ] **Step 5: Write migration tests**

Cover V1 pass-through, unsupported future version error, and malformed-document error.

- [ ] **Step 6: Implement migration dispatcher**

```ts
export function migrateStoreDesignDocument(input: unknown): StoreDesignDocument
```

The dispatcher must already use a version-map/loop architecture even though V1 has no transform.

- [ ] **Step 7: Run schema package tests**

```bash
npm run test:unit -- --run packages/storefront-schema/src
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/storefront-schema package-lock.json
git commit -m "feat: define store design document schema"
```

---

### Task 3: Build the canonical section and block registry

**Files:**
- Create: `packages/storefront-registry/src/types.ts`
- Create: `packages/storefront-registry/src/blocks.ts`
- Create: `packages/storefront-registry/src/sections/*.ts`
- Create: `packages/storefront-registry/src/registry.ts`
- Create: `packages/storefront-registry/src/index.ts`
- Test: `packages/storefront-registry/src/registry.test.ts`

**Interfaces:**
- Consumes `BlockNode`, `PageType` from `@jelly/storefront-schema`.
- Produces `ControlDefinition`, `BlockDefinition`, `SectionDefinition`.
- Produces `getSectionDefinition(type)`, `getBlockDefinition(type)`, `listSectionDefinitions()`.
- Produces `validateSectionAgainstRegistry(section, pageType)`.

- [ ] **Step 1: Write failing registry contract tests**

Expected V1 section types:

```ts
[
  "announcement-bar", "header", "hero", "featured-collection",
  "product-grid", "category-grid", "image-text", "image-banner",
  "rich-text", "testimonials", "faq", "newsletter",
  "contact-store-info", "logo-list", "spacer", "divider",
  "product-information", "product-description", "related-products",
  "collection-header", "collection-product-grid", "footer"
]
```

Tests must prove Hero only accepts heading/text/button, FAQ only accepts faq-item, page restrictions work, and responsive fields are explicit.

- [ ] **Step 2: Run registry tests**

```bash
npm run test:unit -- --run packages/storefront-registry/src/registry.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement block definitions**

Include `heading`, `text`, `button`, `testimonial`, `faq-item`, `logo`, `menu`, `contact-item`, `social-link`. Each has a Zod settings schema, control metadata, and defaults.

- [ ] **Step 4: Implement section definitions**

Each definition includes category, supported pages, settings schema, controls, allowed blocks, limits, defaults, and responsive fields.

- [ ] **Step 5: Implement registry validation**

Return structured issues with codes:

```ts
type RegistryValidationIssueCode =
  | "SECTION_NOT_REGISTERED"
  | "SECTION_NOT_ALLOWED_ON_PAGE"
  | "BLOCK_NOT_ALLOWED"
  | "BLOCK_LIMIT_EXCEEDED"
  | "SETTINGS_INVALID"
  | "RESPONSIVE_FIELD_NOT_ALLOWED";
```

- [ ] **Step 6: Run registry package tests**

```bash
npm run test:unit -- --run packages/storefront-registry/src
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/storefront-registry
git commit -m "feat: add storefront section registry"
```

---

### Task 4: Implement theme tokens, Minimal theme, and compatibility contract

**Files:**
- Create: `packages/storefront-themes/src/types.ts`
- Create: `packages/storefront-themes/src/theme-registry.ts`
- Create: `packages/storefront-themes/src/minimal/index.ts`
- Create: `packages/storefront-themes/src/minimal/tokens.ts`
- Create: `packages/storefront-themes/src/index.ts`
- Test: `packages/storefront-themes/src/theme-registry.test.ts`

**Interfaces:**
- Produces `ThemeTokens`, `ThemeDefinition`, `getThemeDefinition(themeId)`, `listThemes()`, `resolveDesignTokens(theme, globalSettings)`.

- [ ] **Step 1: Write failing Minimal theme tests**

Assert Minimal is registered, supports every canonical section, global overrides win over theme defaults, and resolved semantic CSS variable keys exist.

- [ ] **Step 2: Run tests**

```bash
npm run test:unit -- --run packages/storefront-themes/src/theme-registry.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement semantic ThemeTokens**

Include colors, typography, radii, spacing, and card shadow.

- [ ] **Step 4: Implement Minimal theme**

Minimal must define Header/Footer/ProductCard/Button defaults and a variant for every registered section.

- [ ] **Step 5: Implement token resolution**

Convert resolved tokens into a serializable map suitable for CSS variables.

- [ ] **Step 6: Run tests**

```bash
npm run test:unit -- --run packages/storefront-themes/src
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/storefront-themes
git commit -m "feat: add minimal storefront theme"
```

---

### Task 5: Build shared storefront UI primitives and renderer core

**Files:**
- Create: `packages/storefront-ui/src/button.tsx`
- Create: `packages/storefront-ui/src/container.tsx`
- Create: `packages/storefront-ui/src/product-card.tsx`
- Create: `packages/storefront-ui/src/index.ts`
- Create: `packages/storefront-renderer/src/types.ts`
- Create: `packages/storefront-renderer/src/storefront-renderer.tsx`
- Create: `packages/storefront-renderer/src/page-renderer.tsx`
- Create: `packages/storefront-renderer/src/section-renderer.tsx`
- Create: `packages/storefront-renderer/src/render-error-boundary.tsx`
- Create: `packages/storefront-renderer/src/sections/hero.tsx`
- Create: `packages/storefront-renderer/src/sections/rich-text.tsx`
- Create: `packages/storefront-renderer/src/sections/product-grid.tsx`
- Create: `packages/storefront-renderer/src/index.ts`
- Test: `packages/storefront-renderer/src/storefront-renderer.test.tsx`

**Interfaces:**
- Produces `StorefrontRenderer`, `CommerceDataProvider`, and `AssetResolver`.
- Unknown sections skip safely in `published` mode and show an editor placeholder in `preview` mode.

- [ ] **Step 1: Write failing renderer tests**

Test Hero content, Product Grid provider call, global token CSS variable, unknown-section published fallback, and unknown-section preview placeholder.

- [ ] **Step 2: Run focused renderer tests**

```bash
npm run test:unit -- --run packages/storefront-renderer/src/storefront-renderer.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Define provider interfaces**

```ts
export interface CommerceDataProvider {
  getProduct(id: string): Promise<PublicProduct | null>;
  getProducts(input: ProductQuery): Promise<PublicProduct[]>;
  getCollection(id: string): Promise<PublicCollection | null>;
  getCollectionProducts(collectionId: string, options?: ProductQuery): Promise<PublicProduct[]>;
}

export interface AssetResolver {
  resolve(assetId: string): Promise<ResolvedAsset | null>;
}
```

- [ ] **Step 4: Implement renderer root and semantic variables**

Root includes `data-jelly-theme` and CSS variables from resolved tokens.

- [ ] **Step 5: Implement reference Hero, Rich Text, Product Grid**

This is the architecture proof slice before the full section matrix.

- [ ] **Step 6: Add section-level error boundary**

Preview renders a safe diagnostic placeholder; published mode omits the section and reports via callback.

- [ ] **Step 7: Run tests**

```bash
npm run test:unit -- --run packages/storefront-renderer/src
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/storefront-ui packages/storefront-renderer
git commit -m "feat: add shared storefront renderer"
```

---

### Task 6: Add StoreDesign, publication, and asset persistence to Prisma

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: generated Prisma migration
- Test: `apps/api/src/modules/store-design/store-design.repository.int.test.ts`

**Interfaces:**
- Produces persisted `StoreDesign`, `StoreDesignPublication`, `StoreAsset`.
- `StoreDesign.storeId` is unique.
- `StoreDesignPublication` revision is unique per design.
- Existing `Store` and `User` relations are reused.

- [ ] **Step 1: Write failing repository integration test**

Test: create StoreDesign, create publication revision 1, set `currentPublicationId`, and verify a second StoreDesign for the same store fails.

- [ ] **Step 2: Run focused integration test**

```bash
npm test -- --run apps/api/src/modules/store-design/store-design.repository.int.test.ts
```

Expected: FAIL because the models do not exist.

- [ ] **Step 3: Add Prisma enums and models**

```prisma
enum StoreAssetStatus {
  PENDING
  READY
  FAILED
  DELETED
}

enum StoreDesignPublicationSource {
  MANUAL
  ROLLBACK
  SYSTEM_MIGRATION
}
```

`StoreDesign` stores `draftDocument`, `draftRevision`, `schemaVersion`, `currentPublicationId`, timestamps. `StoreDesignPublication` stores immutable `document`, `revision`, `schemaVersion`, publisher, source, timestamp. `StoreAsset` stores store ownership and Cloud Storage metadata.

- [ ] **Step 4: Generate migration and Prisma client**

```bash
npx prisma migrate dev --name add_store_design_editor
npx prisma generate
```

- [ ] **Step 5: Implement repository methods required by the integration test**

Expose `findByStoreId`, `createDefaultForStore`, `createPublication`, `setCurrentPublication`.

- [ ] **Step 6: Run integration test**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/database apps/api/src/modules/store-design
git commit -m "feat: persist store design revisions"
```

---

### Task 7: Implement Store Design authorization, load, and optimistic draft save API

**Files:**
- Create: `apps/api/src/modules/store-design/store-design.routes.ts`
- Create: `apps/api/src/modules/store-design/store-design.controller.ts`
- Create: `apps/api/src/modules/store-design/store-design.service.ts`
- Create: `apps/api/src/modules/store-design/store-design.repository.ts`
- Create: `apps/api/src/modules/store-design/store-design.validator.ts`
- Create: `apps/api/src/modules/store-design/store-design.errors.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/store-design/store-design.api.test.ts`

**Interfaces:**
- `GET /v1/stores/:storeId/design`
- `PATCH /v1/stores/:storeId/design/draft`
- Draft request: `{ expectedRevision: number; document: StoreDesignDocument }`
- Stale revision -> HTTP 409 `DESIGN_REVISION_CONFLICT`.

- [ ] **Step 1: Write failing Supertest cases**

Cover unauthenticated 401, cross-business 403, owner GET, valid PATCH increments revision, stale PATCH 409, invalid section/block structure 422.

- [ ] **Step 2: Run focused API tests**

```bash
npm test -- --run apps/api/src/modules/store-design/store-design.api.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement authorization boundary**

Reuse the existing Firebase-authenticated Jelly Shop user and membership middleware. Add one focused store permission helper only if it does not already exist:

```ts
authorizeStoreAccess(
  userId: string,
  storeId: string,
  permission: "DESIGN_VIEW" | "DESIGN_EDIT" | "DESIGN_PUBLISH"
): Promise<AuthorizedStoreContext>
```

- [ ] **Step 4: Implement structural validation**

Validate the shared schema plus section registry and return structured issue paths/codes.

- [ ] **Step 5: Implement atomic optimistic save**

Use a conditional update equivalent to:

```sql
UPDATE store_designs
SET draft_document = $1,
    draft_revision = draft_revision + 1,
    schema_version = $2,
    draft_updated_at = NOW()
WHERE store_id = $3
  AND draft_revision = $4;
```

Zero affected rows means stale revision; query current revision and return 409.

- [ ] **Step 6: Run API tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/store-design apps/api/src/app.ts
git commit -m "feat: add store design draft api"
```

---

### Task 8: Implement publish validation, immutable publications, and rollback

**Files:**
- Create: `apps/api/src/modules/store-design/store-design.publisher.ts`
- Create: `apps/api/src/modules/store-design/store-design.reference-validator.ts`
- Modify: Store Design routes/controller/service
- Test: `apps/api/src/modules/store-design/store-design.publish.api.test.ts`

**Interfaces:**
- `POST /v1/stores/:storeId/design/publish`
- Request: `{ expectedDraftRevision: number }`
- `POST /v1/stores/:storeId/design/rollback`
- Publish source: `MANUAL`; restore source: `ROLLBACK`.

- [ ] **Step 1: Write failing publish tests**

Cover stale revision, cross-store asset, PENDING asset, missing collection, missing mandatory Product/Collection sections, successful atomic publication, and no pointer movement on failure.

- [ ] **Step 2: Write failing rollback tests**

Cover no prior publication -> `ROLLBACK_NOT_AVAILABLE`; successful rollback creates a new revision from previous document; prior rows remain unchanged.

- [ ] **Step 3: Run focused tests**

```bash
npm test -- --run apps/api/src/modules/store-design/store-design.publish.api.test.ts
```

- [ ] **Step 4: Implement full reference validator**

Validate assets, products, collections, and navigation using both referenced id and `storeId`.

- [ ] **Step 5: Implement publication transaction**

Inside one transaction: reload draft, verify revision, create immutable publication, update `currentPublicationId`, add audit event if existing audit infrastructure is present. After publish, keep the working draft equal to the published document and increment draft revision safely.

- [ ] **Step 6: Implement rollback as a new publication**

Find the previous publication by revision and clone its document into the next revision. Never move the pointer directly to an old row.

- [ ] **Step 7: Run tests**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/store-design
git commit -m "feat: publish and restore store designs"
```

---

### Task 9: Implement Google Cloud Storage asset workflow

**Files:**
- Create: `apps/api/src/modules/assets/assets.routes.ts`
- Create: `apps/api/src/modules/assets/assets.controller.ts`
- Create: `apps/api/src/modules/assets/assets.service.ts`
- Create: `apps/api/src/modules/assets/assets.repository.ts`
- Create: `apps/api/src/modules/assets/cloud-storage.service.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/assets/assets.api.test.ts`

**Interfaces:**
- `POST /v1/stores/:storeId/assets/uploads`
- `POST /v1/stores/:storeId/assets/:assetId/complete`
- `GET /v1/stores/:storeId/assets`
- `DELETE /v1/stores/:storeId/assets/:assetId`
- Documents store `assetId`, not signed/storage URLs.

- [ ] **Step 1: Write failing API tests with a fake storage adapter**

Cover cross-store rejection, MIME rejection, >15 MB metadata rejection, PENDING creation + signed URL, completion -> READY, soft delete, and default list excluding deleted.

Allowed image MIME types: JPEG, PNG, WebP, AVIF.

- [ ] **Step 2: Run tests**

```bash
npm test -- --run apps/api/src/modules/assets/assets.api.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Install and wrap Google Cloud Storage**

```bash
npm install @google-cloud/storage -w apps/api
```

Use interface:

```ts
export interface ObjectStorage {
  createSignedUploadUrl(input: SignedUploadInput): Promise<string>;
  statObject(bucket: string, object: string): Promise<ObjectMetadata | null>;
}
```

- [ ] **Step 4: Implement object naming**

```text
stores/{storeId}/assets/{assetId}.{extension}
```

Merchant filenames are metadata only.

- [ ] **Step 5: Implement routes and services**

Every route uses store ownership authorization.

- [ ] **Step 6: Run asset tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/assets apps/api/src/app.ts package-lock.json
git commit -m "feat: add store editor asset uploads"
```

---

### Task 10: Build the admin Store Editor shell and Zustand document actions

**Files:**
- Create: `apps/admin/src/features/store-editor/state/editor-store.ts`
- Create: `apps/admin/src/features/store-editor/state/history.ts`
- Create: `apps/admin/src/features/store-editor/components/editor-shell.tsx`
- Create: `apps/admin/src/features/store-editor/components/editor-topbar.tsx`
- Create: `apps/admin/src/features/store-editor/components/editor-sidebar.tsx`
- Create: `apps/admin/src/app/stores/[storeId]/design/page.tsx`
- Test: `apps/admin/src/features/store-editor/state/editor-store.test.ts`
- Test: `apps/admin/src/features/store-editor/components/editor-shell.test.tsx`

**Interfaces:**
- Produces `useStoreEditor()`.
- Route: `/stores/:storeId/design`.
- State includes document, revision, selected section/block, viewport, save status, history.

- [ ] **Step 1: Write failing editor-store tests**

Cover load, global setting update, add section from registry defaults, duplicate with fresh ids, remove, reorder, add allowed block, reject disallowed block, undo/redo.

- [ ] **Step 2: Run state tests**

```bash
npm run test:unit -- --run apps/admin/src/features/store-editor/state/editor-store.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Install Zustand**

```bash
npm install zustand -w apps/admin
```

- [ ] **Step 4: Implement focused editor store**

Keep history separate from transient selection/save UI state. Group text edits into meaningful history transactions.

- [ ] **Step 5: Write failing shell tests**

Assert page selector, Undo, Redo, Desktop, Mobile, save state, Preview, Publish are present.

- [ ] **Step 6: Implement editor shell**

Render the real document structure; settings can remain minimal until Task 12.

- [ ] **Step 7: Run feature tests**

```bash
npm run test:unit -- --run apps/admin/src/features/store-editor
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/features/store-editor apps/admin/src/app/stores
git commit -m "feat: add store editor shell and state"
```

---

### Task 11: Add typed iframe preview protocol and shared renderer preview route

**Files:**
- Create: `apps/admin/src/features/store-editor/messaging/protocol.ts`
- Create: `apps/admin/src/features/store-editor/messaging/preview-client.ts`
- Create: `apps/admin/src/features/store-editor/components/preview-frame.tsx`
- Create: `apps/storefront/src/app/editor-preview/page.tsx`
- Create: `apps/storefront/src/features/editor-preview/editor-preview-client.tsx`
- Test: `apps/admin/src/features/store-editor/messaging/protocol.test.ts`
- Test: `apps/storefront/src/features/editor-preview/editor-preview-client.test.tsx`

**Interfaces:**
- Uses exact typed `EditorToPreviewMessage` / `PreviewToEditorMessage` unions from the spec.
- Preview uses `@jelly/storefront-renderer`.
- Both sides validate configured origins.

- [ ] **Step 1: Write failing message/origin tests**

Cover accepted origin, rejected origin, malformed message ignored, `PREVIEW_READY`, `SECTION_CLICKED`, and `DESIGN_DOCUMENT_UPDATE`.

- [ ] **Step 2: Run tests**

```bash
npm run test:unit -- --run apps/admin/src/features/store-editor/messaging apps/storefront/src/features/editor-preview
```

Expected: FAIL.

- [ ] **Step 3: Implement Zod discriminated message validators**

Do not cast arbitrary `event.data` directly to TypeScript types.

- [ ] **Step 4: Implement `PreviewFrame`**

On preview ready send current document, viewport, and selection. Every document edit sends `DESIGN_DOCUMENT_UPDATE` immediately without waiting for autosave.

- [ ] **Step 5: Implement storefront preview route**

It renders `StorefrontRenderer` in `mode="preview"` and does not refetch the draft on every edit.

- [ ] **Step 6: Implement click-to-select hooks**

Preview section/block wrappers emit selection messages. Published mode must not include editor hooks.

- [ ] **Step 7: Run tests**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/features/store-editor/messaging apps/admin/src/features/store-editor/components/preview-frame.tsx apps/storefront/src
git commit -m "feat: add isolated storefront editor preview"
```

---

### Task 12: Implement schema-driven settings controls

**Files:**
- Create: `apps/admin/src/features/store-editor/controls/control-renderer.tsx`
- Create focused controls for text, textarea, select, toggle, color, range, alignment
- Create: `apps/admin/src/features/store-editor/components/settings-panel.tsx`
- Test: `apps/admin/src/features/store-editor/controls/control-renderer.test.tsx`
- Test: `apps/admin/src/features/store-editor/components/settings-panel.test.tsx`

**Interfaces:**
- Consumes `ControlDefinition` from the registry.
- Produces one `ControlRenderer` mapping registry metadata to merchant controls.
- Responsive controls can edit either base settings or `responsive.mobile`.

- [ ] **Step 1: Write failing control-renderer tests**

Verify text, select, toggle, color, alignment, Mobile override, and unknown control failure in test/development.

- [ ] **Step 2: Run tests**

Expected: FAIL.

- [ ] **Step 3: Implement initial control set**

Implement every control required by Hero, Rich Text, Product Grid, and global theme settings. Image/product/collection pickers are separate tasks.

- [ ] **Step 4: Implement settings-panel hierarchy**

Selected section shows Content, Design, Advanced. Selected block shows block controls and Back to Section.

- [ ] **Step 5: Run tests**

```bash
npm run test:unit -- --run apps/admin/src/features/store-editor/controls apps/admin/src/features/store-editor/components/settings-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/features/store-editor/controls apps/admin/src/features/store-editor/components/settings-panel.tsx
git commit -m "feat: render editor controls from section schema"
```

---

### Task 13: Implement section tree, section library, drag/drop, and reversible structure actions

**Files:**
- Create: `apps/admin/src/features/store-editor/components/section-tree.tsx`
- Create: `apps/admin/src/features/store-editor/components/section-tree-row.tsx`
- Create: `apps/admin/src/features/store-editor/components/add-section-dialog.tsx`
- Create: `apps/admin/src/features/store-editor/components/block-tree.tsx`
- Modify: `apps/admin/src/features/store-editor/components/editor-sidebar.tsx`
- Test: `apps/admin/src/features/store-editor/components/section-tree.test.tsx`
- Test: `apps/admin/src/features/store-editor/components/add-section-dialog.test.tsx`

**Interfaces:**
- Uses `@dnd-kit/core` + `@dnd-kit/sortable`.
- Add Section shows only definitions valid for the current page.
- Row actions: Duplicate, Hide/Show, Move Up, Move Down, Remove.

- [ ] **Step 1: Write failing interaction tests**

Cover document order, add after selected, duplicate fresh ids, hide, remove, Move Up/Down, DnD reorder, and Product template hiding Home-only sections.

- [ ] **Step 2: Install DnD packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities -w apps/admin
```

- [ ] **Step 3: Run focused tests**

Expected: FAIL.

- [ ] **Step 4: Implement accessible section tree**

Drag/drop must not be the only reorder method.

- [ ] **Step 5: Implement Add Section dialog**

Group Commerce, Content, Social proof, Business, Layout. Search by section label/category.

- [ ] **Step 6: Connect preview selection synchronization**

Sidebar select -> preview highlight; preview click -> sidebar select.

- [ ] **Step 7: Run tests**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/features/store-editor package-lock.json
git commit -m "feat: add section builder interactions"
```

---

### Task 14: Implement serialized autosave and revision conflict UX

**Files:**
- Create: `apps/admin/src/features/store-editor/api/store-design-api.ts`
- Create: `apps/admin/src/features/store-editor/state/autosave.ts`
- Create: `apps/admin/src/features/store-editor/components/save-status.tsx`
- Create: `apps/admin/src/features/store-editor/components/revision-conflict-dialog.tsx`
- Test: `apps/admin/src/features/store-editor/state/autosave.test.ts`

**Interfaces:**
- Debounce: 800 ms.
- At most one PATCH in flight.
- Uses `{ expectedRevision, document }`.
- HTTP 409 sets `saveStatus="conflict"` and stops autosave.

- [ ] **Step 1: Write failing fake-timer autosave tests**

Cover no save before 800 ms, one save after quiet period, serialized edit while request in flight, revision update, 409 halt, network error, and successful Retry.

- [ ] **Step 2: Run test**

```bash
npm run test:unit -- --run apps/admin/src/features/store-editor/state/autosave.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement authenticated Store Design API client**

Reuse the existing central Firebase-authenticated fetch helper.

- [ ] **Step 4: Implement serialized autosave coordinator**

Track last persisted document, newest dirty document, current revision, and the in-flight request. Never launch parallel PATCH requests.

- [ ] **Step 5: Implement save-state UI**

Exact states: Saving…, Saved ✓, Not saved + Retry, Conflict.

- [ ] **Step 6: Implement conflict dialog**

Text: “This store was edited somewhere else. Reload the latest version before continuing.” Action reloads server state; no merge in V1.

- [ ] **Step 7: Run tests**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/features/store-editor
git commit -m "feat: autosave store design drafts safely"
```

---

### Task 15: Implement global theme settings and content-preserving theme chooser

**Files:**
- Create: `apps/admin/src/features/store-editor/components/theme-panel.tsx`
- Create: `apps/admin/src/features/store-editor/components/theme-chooser.tsx`
- Create: `apps/admin/src/features/store-editor/components/global-settings-panel.tsx`
- Test: `apps/admin/src/features/store-editor/components/theme-chooser.test.tsx`

**Interfaces:**
- Theme preview is temporary until Apply.
- Apply changes `document.theme.id` and compatible theme settings only.
- Existing section/block content and ids remain unchanged.

- [ ] **Step 1: Write failing theme-switch tests**

Snapshot section/block ids and content. Preview Elegant -> Cancel leaves document unchanged. Apply Elegant -> theme id changes while ids, Hero content, images, product refs, and collection refs are identical. Undo restores prior theme.

- [ ] **Step 2: Run tests**

Expected: FAIL.

- [ ] **Step 3: Implement temporary preview theme state**

Temporary theme lives outside the persisted design document until Apply.

- [ ] **Step 4: Implement global controls**

Expose Primary/Background/Text/Surface/Accent, heading/body fonts, heading scale, button style/radius, container width/section spacing, product card options.

- [ ] **Step 5: Run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/features/store-editor
git commit -m "feat: add content-safe theme customization"
```

---

### Task 16: Implement media library and image control

**Files:**
- Create: `apps/admin/src/features/store-editor/api/assets-api.ts`
- Create: `apps/admin/src/features/store-editor/components/media-library.tsx`
- Create: `apps/admin/src/features/store-editor/controls/image-control.tsx`
- Test: `apps/admin/src/features/store-editor/components/media-library.test.tsx`

**Interfaces:**
- Uses asset API from Task 9.
- Image settings store `{ assetId: string }` rather than storage URLs.
- Browser uploads directly to the signed Cloud Storage URL, then calls the complete endpoint.

- [ ] **Step 1: Write failing media tests**

Cover READY asset list, upload-request payload, PUT to signed URL, complete call, assetId-only selection, non-selectable PENDING/DELETED assets, replace/remove.

- [ ] **Step 2: Run tests**

Expected: FAIL.

- [ ] **Step 3: Implement assets API client**

Keep signed upload flow separate from React components.

- [ ] **Step 4: Implement Media Library**

Actions: Upload, Select, Replace, Remove. Failed uploads remain visibly failed; do not silently discard errors.

- [ ] **Step 5: Implement Image Control**

Support focal position values `center`, `top`, `bottom`, `left`, `right`. Store only asset id + section-specific presentation fields.

- [ ] **Step 6: Run tests**

```bash
npm run test:unit -- --run apps/admin/src/features/store-editor/components/media-library.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/features/store-editor
git commit -m "feat: add store editor media library"
```

---

### Task 17: Implement product/collection pickers and commerce-aware sections

**Files:**
- Create: `apps/admin/src/features/store-editor/controls/product-picker-control.tsx`
- Create: `apps/admin/src/features/store-editor/controls/collection-picker-control.tsx`
- Create: `apps/admin/src/features/store-editor/api/catalog-api.ts`
- Create: `packages/storefront-renderer/src/sections/featured-collection.tsx`
- Create: `packages/storefront-renderer/src/sections/category-grid.tsx`
- Test: `apps/admin/src/features/store-editor/controls/catalog-picker.test.tsx`
- Test: `packages/storefront-renderer/src/sections/featured-collection.test.tsx`

**Interfaces:**
- Picker values store stable ids only.
- Search uses paginated existing Jelly Shop Product/Collection APIs.
- Renderer reads current price/stock/product data through `CommerceDataProvider`.

- [ ] **Step 1: Write failing picker tests**

Cover search, select id, clear, empty-catalog guidance, and not preloading the entire catalog.

- [ ] **Step 2: Write failing Featured Collection renderer test**

Assert the section calls:

```ts
commerce.getCollectionProducts(collectionId, options)
```

and renders current product data returned by the provider.

- [ ] **Step 3: Run focused tests**

Expected: FAIL.

- [ ] **Step 4: Implement picker controls**

Search after a short input debounce and cap each result page to the existing API’s normal limit, with 20 as the default when unspecified.

- [ ] **Step 5: Implement Featured Collection and Category Grid**

Reuse `ProductCard`; do not copy price/product rendering code.

- [ ] **Step 6: Run tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/features/store-editor packages/storefront-renderer
git commit -m "feat: connect store design to catalog data"
```

---

### Task 18: Complete Product and Collection templates

**Files:**
- Create: `packages/storefront-renderer/src/templates/product-template.tsx`
- Create: `packages/storefront-renderer/src/templates/collection-template.tsx`
- Create: `packages/storefront-renderer/src/sections/product-information.tsx`
- Create: `packages/storefront-renderer/src/sections/product-description.tsx`
- Create: `packages/storefront-renderer/src/sections/related-products.tsx`
- Create: `packages/storefront-renderer/src/sections/collection-header.tsx`
- Create: `packages/storefront-renderer/src/sections/collection-product-grid.tsx`
- Test: `packages/storefront-renderer/src/templates/product-template.test.tsx`
- Test: `packages/storefront-renderer/src/templates/collection-template.test.tsx`

**Interfaces:**
- Product template requires `product-information`.
- Collection template requires `collection-product-grid`.
- Route context identifies the current product/collection.

- [ ] **Step 1: Write failing Product template tests**

Cover gallery, title/price, existing variant behavior, quantity, add-to-cart, configurable SKU/inventory message/buy-now visibility, description, and related products.

- [ ] **Step 2: Write failing Collection template tests**

Cover image/description visibility, desktop/mobile columns, sort/filter visibility, and collection products from provider.

- [ ] **Step 3: Run focused tests**

Expected: FAIL.

- [ ] **Step 4: Implement Product template using existing storefront commerce components**

Do not create a second cart, product-option, or checkout state system.

- [ ] **Step 5: Implement Collection template**

Reuse the shared Product Card and existing collection filtering/sorting behavior where present.

- [ ] **Step 6: Run tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/storefront-renderer
git commit -m "feat: add configurable commerce templates"
```

---

### Task 19: Complete remaining V1 section renderers and safe rich text

**Files:**
- Create/Modify: `packages/storefront-renderer/src/sections/*.tsx`
- Create: `packages/storefront-schema/src/rich-text.ts`
- Test: `packages/storefront-renderer/src/sections/v1-sections.test.tsx`
- Test: `packages/storefront-schema/src/rich-text.test.ts`

**Interfaces:**
- All canonical V1 sections render in Minimal.
- Rich text is a restricted structured model.
- Renderer never executes raw merchant HTML.

- [ ] **Step 1: Write failing table-driven section smoke test**

Test registry defaults for Image + Text, Image Banner, Testimonials, FAQ, Newsletter, Contact / Store Info, Logo List, Spacer, Divider, Header, Footer, Announcement Bar.

- [ ] **Step 2: Write failing rich-text security tests**

Reject unsupported `script`, `iframe`, `style`, `rawHtml`. Allow paragraph, heading, text, bold, italic, bullet/ordered lists, and `http:`/`https:` links.

- [ ] **Step 3: Run tests**

Expected: FAIL.

- [ ] **Step 4: Implement restricted rich-text schema/renderer**

Do not use `dangerouslySetInnerHTML` with merchant-provided content.

- [ ] **Step 5: Implement the remaining Minimal sections**

Use focused one-section-per-file components where practical.

- [ ] **Step 6: Run renderer and schema tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/storefront-schema packages/storefront-renderer
git commit -m "feat: complete minimal theme section library"
```

---

### Task 20: Add Classic, Bold, Elegant, and Playful themes

**Files:**
- Create: `packages/storefront-themes/src/classic/**`
- Create: `packages/storefront-themes/src/bold/**`
- Create: `packages/storefront-themes/src/elegant/**`
- Create: `packages/storefront-themes/src/playful/**`
- Modify: `packages/storefront-themes/src/theme-registry.ts`
- Test: `packages/storefront-themes/src/theme-compatibility.test.tsx`

**Interfaces:**
- All five themes expose the same semantic section capabilities.
- Content document does not change across theme ids.
- Differences are tokens and visual variant mapping.

- [ ] **Step 1: Write failing compatibility matrix test**

For every theme and canonical V1 section, render a registry-default section and assert no renderer fallback. Also render Product and Collection templates.

- [ ] **Step 2: Run test**

Expected: FAIL for four missing themes.

- [ ] **Step 3: Implement Classic and run its matrix**

Classic: familiar ecommerce hierarchy, conventional header/product cards, high readability.

- [ ] **Step 4: Implement Bold and run its matrix**

Bold: large typography, stronger contrast, large imagery.

- [ ] **Step 5: Implement Elegant and run its matrix**

Elegant: editorial spacing, refined typography, premium image treatment.

- [ ] **Step 6: Implement Playful and run its matrix**

Playful: rounded treatment, friendly typography, expressive spacing.

- [ ] **Step 7: Run the full compatibility matrix**

```bash
npm run test:unit -- --run packages/storefront-themes/src/theme-compatibility.test.tsx
```

Expected: PASS for Minimal, Classic, Bold, Elegant, Playful.

- [ ] **Step 8: Commit**

```bash
git add packages/storefront-themes
git commit -m "feat: add five compatible jelly shop themes"
```

---

### Task 21: Implement clean draft preview, Publish UI, validation navigation, and rollback UX

**Files:**
- Create: `apps/admin/src/features/store-editor/components/publish-dialog.tsx`
- Create: `apps/admin/src/features/store-editor/components/publish-validation-dialog.tsx`
- Create: `apps/admin/src/features/store-editor/components/publishing-menu.tsx`
- Create: `apps/admin/src/features/store-editor/api/publish-api.ts`
- Create: `apps/storefront/src/app/draft-preview/[storeId]/page.tsx`
- Test: `apps/admin/src/features/store-editor/components/publish-dialog.test.tsx`

**Interfaces:**
- Clean preview shows the saved draft with no editor chrome.
- Publish sends only `{ expectedDraftRevision }`.
- Validation issue click selects the offending section.
- Rollback calls backend and refreshes publication metadata.

- [ ] **Step 1: Write failing Publish UX tests**

Cover Publish disabled while save is in-flight, confirmation, validation issue list, issue navigation, success message, and rollback confirmation explaining draft preservation.

- [ ] **Step 2: Run tests**

Expected: FAIL.

- [ ] **Step 3: Implement publish API and dialogs**

Never include the complete design document in the Publish request.

- [ ] **Step 4: Implement clean saved-draft preview route**

It renders through the shared renderer without editor markers. It may load the saved draft once using authenticated merchant access.

- [ ] **Step 5: Implement validation navigation**

Backend reference errors should carry `sectionId` when applicable. Clicking an issue selects that section and opens the correct settings path.

- [ ] **Step 6: Implement rollback menu**

After restore, reload publication metadata and leave the current working draft intact unless backend publish synchronization intentionally updates it.

- [ ] **Step 7: Run tests**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/features/store-editor apps/storefront/src/app/draft-preview
git commit -m "feat: publish and restore storefront designs"
```

---

### Task 22: Wire the public storefront exclusively to current publication

**Files:**
- Create/Modify: `apps/api/src/modules/storefront/public-storefront.service.ts`
- Create/Modify: `apps/api/src/modules/storefront/public-storefront.routes.ts`
- Modify: relevant `apps/storefront/src/app/**` storefront route resolver
- Test: `apps/api/src/modules/storefront/public-storefront.api.test.ts`
- Test: `apps/storefront/src/app/publication-boundary.test.tsx`

**Interfaces:**
- `GET /v1/public/stores/:slug/storefront`
- Returns current publication only.
- Draft is never returned.

- [ ] **Step 1: Write failing API separation test**

Seed published heading `LIVE` and newer draft heading `DRAFT`. Public API must return only `LIVE`.

- [ ] **Step 2: Write failing storefront render test**

Public route must call `StorefrontRenderer` with the publication document and `mode="published"`.

- [ ] **Step 3: Run tests**

Expected: FAIL.

- [ ] **Step 4: Implement publication query**

Resolve `Store -> StoreDesign.currentPublicationId -> StoreDesignPublication.document`. Never fall back to draft.

- [ ] **Step 5: Connect Next.js storefront to shared renderer**

Reuse existing hostname/slug resolution and existing commerce providers.

- [ ] **Step 6: Run tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/storefront apps/storefront/src
git commit -m "feat: serve published store designs"
```

---

### Task 23: Add responsive preview behavior and Mobile overrides

**Files:**
- Modify: `apps/admin/src/features/store-editor/components/editor-topbar.tsx`
- Modify: `apps/admin/src/features/store-editor/components/preview-frame.tsx`
- Modify: `apps/admin/src/features/store-editor/controls/control-renderer.tsx`
- Modify: relevant `packages/storefront-renderer/src/**`
- Test: `apps/admin/src/features/store-editor/components/responsive-editor.test.tsx`
- Test: `packages/storefront-renderer/src/responsive-overrides.test.tsx`

**Interfaces:**
- Viewports: Desktop and Mobile only.
- Mobile preview width: 390 px.
- Only registry `responsiveFields` may have Mobile overrides.
- Published renderer applies overrides through CSS responsive behavior, not JS viewport checks.

- [ ] **Step 1: Write failing editor responsive tests**

Cover Mobile frame width, hidden override UI for non-responsive fields, “Use desktop setting” default, and mobile alignment not mutating desktop alignment.

- [ ] **Step 2: Write failing renderer override test**

Hero base left/mobile center must produce responsive styling while preserving base value.

- [ ] **Step 3: Run tests**

Expected: FAIL.

- [ ] **Step 4: Implement device controls and override UI**

No Tablet mode in V1.

- [ ] **Step 5: Implement renderer responsive resolution**

Prefer CSS media query variables/classes so SSR/public output is deterministic.

- [ ] **Step 6: Run tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/features/store-editor packages/storefront-renderer
git commit -m "feat: add mobile storefront customization"
```

---

### Task 24: Add security, accessibility, and editor failure-state coverage

**Files:**
- Modify: relevant API/editor/renderer modules from prior tasks
- Create: `apps/api/src/modules/store-design/store-design.security.test.ts`
- Create: `packages/storefront-renderer/src/accessibility.test.tsx`
- Create: `apps/admin/src/features/store-editor/components/editor-failure-states.test.tsx`

**Interfaces:**
- External links allow `http:` and `https:` only.
- Cross-store references fail.
- Public render has no editor-only selection hooks.
- Reorder is keyboard accessible.

- [ ] **Step 1: Write failing security tests**

Cover `javascript:`/`data:` URLs, cross-store asset/product/collection references, malformed rich text, and wrong-origin iframe messages.

- [ ] **Step 2: Write failing accessibility tests**

Use the repository’s accessibility harness or add `axe-core` integration for representative Header, Hero, Product Information, Newsletter, Footer. Test labels and keyboard reorder controls.

- [ ] **Step 3: Write failure-state tests**

Cover initial skeleton, save error + Retry, unsaved-leave warning only when truly unsaved, empty-catalog guidance, and narrow-screen editor notice.

- [ ] **Step 4: Run focused tests**

Expected: FAIL.

- [ ] **Step 5: Implement only proven fixes**

No unrelated UX additions.

- [ ] **Step 6: Run tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps packages
git commit -m "test: harden store editor safety and accessibility"
```

---

### Task 25: Add Playwright end-to-end Store Editor journeys

**Files:**
- Create: `e2e/store-editor/store-editor.spec.ts`
- Create: `e2e/store-editor/store-editor-conflict.spec.ts`
- Create: `e2e/store-editor/store-editor-publish.spec.ts`
- Modify: `playwright.config.ts` if required
- Create/Modify: test fixtures for Firebase auth, store, products, collection, assets

**Interfaces:**
- E2E runs against admin + API + storefront + PostgreSQL.
- Stripe is not required for Store Editor tests.

- [ ] **Step 1: Write E2E customize/publish journey**

Flow: authenticate merchant → open editor → change Hero → add FAQ → reorder → set Mobile override → switch Minimal to Elegant → confirm content preserved → wait Saved → Publish → open public storefront → assert content/theme live.

- [ ] **Step 2: Run journey before fixing integration gaps**

```bash
npx playwright test e2e/store-editor/store-editor.spec.ts
```

Expected: FAIL until all integration wiring is correct.

- [ ] **Step 3: Fix only integration gaps exposed by the journey**

- [ ] **Step 4: Write draft-does-not-leak journey**

Published `LIVE`; edit draft to `UNPUBLISHED`; wait Saved; public remains `LIVE`; Publish; public becomes `UNPUBLISHED`.

- [ ] **Step 5: Write revision-conflict journey**

Two browser contexts edit same store; A saves; B stale save receives conflict; no silent overwrite.

- [ ] **Step 6: Write rollback journey**

Publish A, publish B, restore previous, public renders A, publication count increases.

- [ ] **Step 7: Run all Store Editor E2E**

```bash
npx playwright test e2e/store-editor
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add e2e playwright.config.ts apps packages
git commit -m "test: cover store editor end to end"
```

---

### Task 26: Add CI gates, production build verification, and operational logging

**Files:**
- Modify: existing CI workflow (`.github/workflows/ci.yml` or repository equivalent)
- Modify: Store Design/Asset API modules for structured logs where absent
- Modify: deployment configuration only for required existing environment variables

**Interfaces:**
- CI blocks merge on lint, typecheck, tests, Store Editor E2E, and production build.
- Logs record event metadata but never full design documents, Firebase tokens, signed URLs, or secrets.

- [ ] **Step 1: Add CI gate commands**

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test e2e/store-editor
```

Use the repository’s existing PostgreSQL/service test setup.

- [ ] **Step 2: Run CI sequence locally**

Fix configuration failures only.

- [ ] **Step 3: Add structured operational events**

Events:
- `STORE_DESIGN_PUBLISHED`
- `STORE_DESIGN_ROLLED_BACK`
- `STORE_DESIGN_REVISION_CONFLICT`
- `STORE_ASSET_UPLOAD_FAILED`

Fields include `storeId`, `userId`, revision, asset id, error code as relevant.

- [ ] **Step 4: Verify production builds**

```bash
npm run build
```

Expected: admin, storefront, API, and shared packages build.

- [ ] **Step 5: Run final suite**

```bash
npm run lint
npm run typecheck
npm test
npx playwright test e2e/store-editor
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github apps packages
git commit -m "chore: gate store editor releases in ci"
```

---

### Task 27: Final acceptance verification against the approved specification

**Files:**
- Modify only files needed to fix a proven acceptance failure.
- No new product scope.

**Interfaces:**
- Produces Store Editor V1 Definition of Done.

- [ ] **Step 1: Run automated acceptance**

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test e2e/store-editor
```

All must pass.

- [ ] **Step 2: Run manual merchant acceptance checklist**

```text
[ ] Open Store Design.
[ ] Existing draft loads.
[ ] Hero content can be changed.
[ ] Section can be added.
[ ] Section can be duplicated.
[ ] Section can be hidden.
[ ] Section can be removed and undone.
[ ] Sections can be reordered by drag and Move Up/Down.
[ ] Allowed blocks can be added.
[ ] Invalid blocks cannot be added.
[ ] All five themes are visible.
[ ] Theme change preserves content and ids.
[ ] Global colors/fonts/buttons/layout update preview.
[ ] Desktop preview works.
[ ] Mobile preview works.
[ ] Mobile override does not change Desktop setting.
[ ] Image upload uses signed Cloud Storage URL.
[ ] Product picker works.
[ ] Collection picker works.
[ ] Autosave reaches Saved.
[ ] A stale second editor gets conflict instead of overwrite.
[ ] Clean draft preview works.
[ ] Publish updates the public store.
[ ] Further draft edits do not affect the public store.
[ ] Previous published design can be restored.
[ ] Product template retains purchase controls.
[ ] Collection template retains product grid.
[ ] Public storefront has no editor markers.
```

- [ ] **Step 3: Verify publication records**

Confirm immutable publication rows, rollback creates a new row, public query uses `currentPublicationId`, and draft revision is independent from publication revision.

- [ ] **Step 4: Verify Google Cloud asset behavior in staging**

Signed upload succeeds; object path is `stores/{storeId}/assets/{assetId}`; asset becomes READY; renderer resolves the asset through `AssetResolver`.

- [ ] **Step 5: Commit acceptance fixes only if needed**

```bash
git add <fixed-files>
git commit -m "fix: satisfy store editor acceptance criteria"
```

Do not create an empty commit when no fixes are required.

- [ ] **Step 6: Use verification-before-completion**

Invoke `superpowers:verification-before-completion` before reporting completion, and report the actual successful commands and output summary.
