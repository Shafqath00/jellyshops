# Canonical Storefront Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the transitional duplicated page representation with a schema-v4 storefront document in which shared groups and page templates each own their ordered sections exactly once, while preserving all existing editor, renderer, API, and public-storefront behavior.

**Architecture:** Introduce a canonical `StorefrontDocument` v4 with `sharedGroups`, `templates`, `pages`, and `defaultTemplateIds`. Read legacy v1, v2, and transitional v3 documents through deterministic migrations, but write only v4. Move editor commands and rendering to focused document accessors so no consumer reconstructs or synchronizes a second template section array.

**Tech Stack:** TypeScript, Zod, React, Next.js, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-07-full-site-template-editor-design.md`

## Global Constraints

- A template's ordered sections exist in exactly one authoritative location.
- Header and footer are shared groups and are never copied into templates.
- Regions are placement constraints only; they are not content-storage containers.
- Legacy v1, v2, and transitional v3 documents are accepted as migration inputs but are never written by new code.
- Existing section and block IDs are preserved by migration.
- IDs added by migration are deterministic for a given store and source entity.
- Template, shared-group, page, section, and block IDs are globally unique within one storefront document.
- Runtime commerce data does not enter `StorefrontDocument`.
- Product and collection assignments remain in the commerce model; v4 contains only default template IDs and template definitions.
- `pages` contains only merchant-created informational page records. Products, collections, articles, blogs, cart, search, and other runtime entities are not stored there.
- v4 does not add a `menus` collection: Jellyshop has no existing document-owned menu model to preserve. Menu blocks may keep validated reference settings, and a future menu service can resolve them through render context.
- `storeId` is the document identity; v4 does not add a second redundant document `id`.
- `validateStorefrontDocument` accepts canonical v4 only. Only `migrateStorefrontDocument` accepts historical input.
- Production code is written only after a focused test has failed for the intended missing behavior.

---

## File structure

- `packages/storefront-schema/src/storefront-v4.ts`: canonical v4 types, Zod schema, factories, accessors, and validation entry points.
- `packages/storefront-schema/src/legacy-storefront.ts`: private v1/v2/v3 input schemas and legacy type guards used only by migration; nothing from this module is exported by the package root.
- `packages/storefront-schema/src/storefront-migrations.ts`: deterministic v1/v2/v3-to-v4 migration orchestration.
- `packages/storefront-schema/src/storefront-v4.test.ts`: v4 invariants, factory, accessor, and validation tests.
- `packages/storefront-schema/src/storefront-migrations.test.ts`: migration preservation, determinism, and rejection tests.
- `packages/storefront-schema/src/index.ts`: public v4 exports and compatibility export cleanup.
- `src/features/store-editor/model/document-locations.ts`: resolves a template or shared-group editing location to one section list.
- `src/features/store-editor/model/commands.ts`: updates canonical locations without synchronizing copies.
- `src/features/store-editor/model/types.ts`: replaces storage-oriented region targets with canonical editor locations.
- `src/features/store-editor/state/reducer.ts`: removes legacy home-template synchronization.
- `src/features/store-editor/components/editor-shell.tsx`: derives the active template directly from v4.
- `src/features/store-editor/components/page-hierarchy.tsx`: composes shared groups and the active template in the editor view.
- `src/features/store-editor/components/preview-canvas.tsx`: supplies active template identity to the renderer.
- `packages/storefront-renderer/src/storefront-renderer.tsx`: renders shared groups plus the resolved canonical template.
- Existing tests beside those files: updated to assert canonical storage and unchanged user-facing behavior.

---

### Task 1: Define the canonical schema-v4 document

**Files:**
- Create: `packages/storefront-schema/src/storefront-v4.ts`
- Create: `packages/storefront-schema/src/storefront-v4.test.ts`
- Modify: `packages/storefront-schema/src/index.ts`

**Interfaces:**
- Produces: `STOREFRONT_SCHEMA_VERSION = 4`
- Produces: `StorefrontPageType`, `StorefrontTemplate`, `StorefrontSharedGroup`, `StorefrontPage`, `StorefrontDocument`
- Produces: `createDefaultStorefrontDocument(storeId, themeId?)`
- Produces: `createStorefrontStarter(starterId, storeId)`
- Produces: `getStorefrontTemplate(document, templateId): StorefrontTemplate | undefined`
- Produces: `getDefaultStorefrontTemplate(document, pageType): StorefrontTemplate | undefined`
- Produces: `getSharedGroup(document, kind): StorefrontSharedGroup`
- Produces: `validateStorefrontDocument(input: unknown): z.ZodSafeParseResult<StorefrontDocument>`, accepting v4 only

- [ ] **Step 1: Write failing canonical-shape tests**

Add tests that express the desired public API and the single-storage invariant:

```ts
it("stores template sections only on the canonical template", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  const home = getDefaultStorefrontTemplate(document, "home");

  expect(document.schemaVersion).toBe(4);
  expect(home?.sections.some((section) => section.type === "hero")).toBe(true);
  expect(document).not.toHaveProperty("regions");
  expect(document.sharedGroups.header.sections[0].type).toBe("header");
  expect(document.sharedGroups.footer.sections[0].type).toBe("footer");
});

it("requires every default template id to resolve to its page type", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  document.defaultTemplateIds.home = document.defaultTemplateIds.product;

  expect(validateStorefrontDocument(document).success).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and confirm the intended failure**

Run: `npm test -- --run packages/storefront-schema/src/storefront-v4.test.ts`

Expected: FAIL because `storefront-v4.ts` and its exported canonical interfaces do not exist.

- [ ] **Step 3: Implement the minimal v4 types and schema**

Use this canonical shape:

```ts
export type StorefrontPageType =
  | "home"
  | "product"
  | "collection"
  | "collection-list"
  | "search"
  | "cart"
  | "blog"
  | "blog-post"
  | "page"
  | "contact"
  | "password"
  | "gift-card";

export interface StorefrontTemplate {
  id: string;
  pageType: StorefrontPageType;
  name: string;
  handle: string;
  system: boolean;
  sections: SectionNode[];
}

export interface StorefrontSharedGroup {
  id: string;
  kind: "header" | "footer";
  sections: SectionNode[];
}

export interface StorefrontPage {
  id: string;
  type: "page";
  title: string;
  slug: string;
  templateId: string;
}

export interface StorefrontDocument {
  schemaVersion: 4;
  storeId: string;
  theme: { presetId: ThemeId; settings: GlobalSettings };
  sharedGroups: Record<"header" | "footer", StorefrontSharedGroup>;
  templates: StorefrontTemplate[];
  pages: StorefrontPage[];
  defaultTemplateIds: Partial<Record<StorefrontPageType, string>>;
}
```

`pages` represents merchant-created informational pages only. Every page has an explicit `templateId` pointing to a template whose `pageType` is `"page"`; there is no implicit page-template fallback. Home, product, collection, article, blog, cart, search, and other runtime entities are resolved outside this collection.

The existing theme location is preserved as `theme: { presetId, settings }`. No `menus` field is added in this migration because the current schema owns no menu collection. Navigation blocks preserve their settings, including any future menu reference, without inventing data during migration.

The Zod refinement must reject duplicate IDs across all template/shared-group/page/section/block namespaces, duplicate `(pageType, handle)` pairs, unresolved defaults, defaults pointing at the wrong page type, unresolved page template IDs, informational pages pointing to a non-`page` template, reserved/duplicate slugs, shared groups whose embedded `kind` disagrees with their record key, unsafe media URLs, and documents over 1.5 MB. Because the root Zod object is strict, canonical validation also rejects legacy `regions`.

The initial invariant suite must include these named behaviors:

```ts
it("rejects a default template pointing at the wrong page type");
it("rejects a missing default template target");
it("rejects duplicate template ids");
it("rejects duplicate section ids across the document");
it("rejects duplicate block ids across the document");
it("rejects a shared group with the wrong kind");
it("rejects legacy regions on canonical input");
it("accepts the default factory");
it("round-trips canonical v4 through JSON serialization");
```

- [ ] **Step 4: Implement minimal default and starter factories**

Create deterministic container IDs such as `shared-header`, `shared-footer`, `template-home-default`, `template-product-default`, and `template-collection-default`. Continue generating fresh section/block IDs for newly created merchant content. Preserve the existing `bakes` and `essentials` starter content under the renamed `createStorefrontStarter` API.

- [ ] **Step 5: Run the focused schema tests**

Run: `npm test -- --run packages/storefront-schema/src/storefront-v4.test.ts`

Expected: PASS with no warnings.

- [ ] **Step 6: Run the broader schema package regression suite**

Run: `npm test -- --run packages/storefront-schema/src`

Expected: PASS with no warnings.

- [ ] **Step 7: Commit the canonical schema**

```powershell
git add packages/storefront-schema/src/storefront-v4.ts packages/storefront-schema/src/storefront-v4.test.ts packages/storefront-schema/src/index.ts
git commit -m "feat: define canonical storefront document"
```

---

### Task 2: Migrate historical documents deterministically

**Files:**
- Create: `packages/storefront-schema/src/legacy-storefront.ts`
- Create: `packages/storefront-schema/src/storefront-migrations.ts`
- Create: `packages/storefront-schema/src/storefront-migrations.test.ts`
- Modify: `packages/storefront-schema/src/index.ts`
- Retire after consumers move: `packages/storefront-schema/src/storefront-v2.ts`

**Interfaces:**
- Consumes: v4 types and `validateStorefrontDocument` from Task 1
- Produces: `migrateStorefrontDocument(input: unknown, storeId: string): StorefrontDocument`
- Produces privately: `migrateV1`, `migrateV2`, and `migrateV3`
- Produces privately: `createMigrationId({ storeId, entityKind, legacyKey }): string`

- [ ] **Step 1: Write failing migration tests**

Cover v1, legacy v2, and transitional v3 explicitly:

```ts
it("migrates v3 pages into canonical templates without retaining regions", () => {
  const migrated = migrateStorefrontDocument(transitionalV3, "store-demo");

  expect(migrated).not.toHaveProperty("regions");
  expect(getDefaultStorefrontTemplate(migrated, "home")?.sections.map(({ id }) => id))
    .toEqual(transitionalV3.pages[0].sections.map(({ id }) => id));
});

it("returns the same migration-added ids for the same legacy input", () => {
  const first = migrateStorefrontDocument(legacyV2, "store-demo");
  const second = migrateStorefrontDocument(legacyV2, "store-demo");

  expect(second).toEqual(first);
});
```

Also verify that v3 migration treats `pages[].sections` as authoritative and ignores the duplicated `regions.template` copy, preserving the approved migration direction.

Add a v1 fixture from `createDefaultStoreDesign` and assert that its home, product, and collection sections become the matching default templates, while header and footer become shared groups. Legacy schemas and guards must be imported directly from the private module only by migration tests; application code must never import them.

- [ ] **Step 2: Run migration tests and confirm they fail for missing migration entry points**

Run: `npm test -- --run packages/storefront-schema/src/storefront-migrations.test.ts`

Expected: FAIL because v4 migration is not implemented.

- [ ] **Step 3: Implement private legacy schemas**

Move the v1, v2, and transitional v3 parsing shapes into `legacy-storefront.ts`. The v1 parser may reuse the existing private schema implementation, but v1 types and guards must not be exported from the package root. Keep parsing strict enough to identify the source version while allowing the exact historical fields the application wrote.

- [ ] **Step 4: Implement deterministic migrations**

Use preserved IDs for existing sections, blocks, and pages. Transitional v3 pages do not have a separate template identity: preserve a custom page's existing ID on the v4 page record and derive its new template ID deterministically from that page ID. For an entity lacking an ID, call one exact helper:

```ts
function encodeMigrationPart(value: string): string {
  let encoded = "";
  for (let index = 0; index < value.length; index += 1) {
    encoded += value.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return encoded || "0000";
}

function createMigrationId(input: {
  storeId: string;
  entityKind: string;
  legacyKey: string;
}): string {
  return ["migrated", input.storeId, input.entityKind, input.legacyKey]
    .map(encodeMigrationPart)
    .join("-");
}
```

`legacyKey` must use an existing stable legacy ID, slug, type key, or object key when present. If the source format supplies none, it uses a structural key composed from named ancestors and the entity's index within that historical parent; an array position alone is never sufficient. Existing legacy IDs are preserved exactly rather than passed through this helper. Timestamps, random UUIDs, `Math.random()`, and current array positions after transformation are prohibited in migration-generated identity.

Tests must prove:

```text
same store + same legacy entity -> same ID
different entity kind or legacy key -> different ID
existing legacy ID -> preserved exactly
running migration twice -> byte-equivalent JSON serialization
```

Map:

```text
legacy header        -> sharedGroups.header.sections
legacy footer        -> sharedGroups.footer.sections
v2 template region   -> template-home-default.sections
v3 home page         -> template-home-default.sections
v3 custom page       -> one page template plus one page record
legacy product page  -> template-product-default.sections
legacy collection    -> template-collection-default.sections
```

The public pipeline is explicit and contains no hidden migration inside validation:

```text
unknown persisted input
        -> detect schema version
        -> parse private legacy shape when needed
        -> migrate to canonical v4
        -> validate canonical v4
        -> return StorefrontDocument
```

`validateStorefrontDocument(input)` parses v4 only. `migrateStorefrontDocument(input, storeId)` accepts v1/v2/v3/v4 and returns validated v4. A valid v4 input returns an equivalent parsed v4 value without mutation.

- [ ] **Step 5: Run migration and schema suites**

Run: `npm test -- --run packages/storefront-schema/src/storefront-migrations.test.ts packages/storefront-schema/src/storefront-v4.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the complete storefront-schema regression suite**

Run: `npm test -- --run packages/storefront-schema/src`

Expected: PASS.

- [ ] **Step 7: Commit migrations**

```powershell
git add packages/storefront-schema/src/legacy-storefront.ts packages/storefront-schema/src/storefront-migrations.ts packages/storefront-schema/src/storefront-migrations.test.ts packages/storefront-schema/src/index.ts
git commit -m "feat: migrate storefront documents to canonical v4"
```

---

### Task 3: Move editor commands to canonical locations

**Files:**
- Create: `src/features/store-editor/model/document-locations.ts`
- Create: `src/features/store-editor/model/document-locations.test.ts`
- Modify: `src/features/store-editor/model/types.ts`
- Modify: `src/features/store-editor/model/commands.ts`
- Modify: `src/features/store-editor/model/commands.test.ts`
- Modify: `src/features/store-editor/model/page-commands.test.ts`
- Modify: `src/features/store-editor/state/reducer.ts`
- Modify: `src/features/store-editor/state/reducer.test.ts`
- Modify: `src/features/store-editor/model/selection.ts`

**Interfaces:**
- Produces: `EditorLocation = { kind: "shared-group"; group: "header" | "footer" } | { kind: "template"; templateId: string }`
- Produces: `getSectionsAtLocation(document, location): SectionNode[] | undefined`
- Produces: `updateSectionsAtLocation(document, location, update): StorefrontDocument`
- Changes editor commands to carry `location` instead of storage-oriented `region` plus optional `pageId`

- [ ] **Step 1: Write failing location tests**

```ts
it("updates a template without changing either shared group", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  const templateId = document.defaultTemplateIds.home!;
  const next = updateSectionsAtLocation(
    document,
    { kind: "template", templateId },
    (sections) => sections.slice(1),
  );

  expect(next.templates.find(({ id }) => id === templateId)?.sections).toHaveLength(1);
  expect(next.sharedGroups).toBe(document.sharedGroups);
});
```

- [ ] **Step 2: Run the location test and verify the missing-module failure**

Run: `npm test -- --run src/features/store-editor/model/document-locations.test.ts`

Expected: FAIL because the canonical location helper does not exist.

- [ ] **Step 3: Implement canonical location helpers**

Return the original document when a location is missing or the updater reports no change. Clone only the owning template/shared group and its ancestor collections.

- [ ] **Step 4: Update command tests before command production code**

Change test setup to fetch the home template and dispatch locations such as:

```ts
{
  type: "update-section-setting",
  location: { kind: "template", templateId },
  sectionId: hero.id,
  key: "background",
  value: "#112233",
}
```

Add assertions that template edits do not mutate shared groups, shared-group edits do not mutate templates, moves preserve IDs, and duplication creates fresh IDs for every duplicated node.

Add the dedicated dual-storage regression gate:

```ts
it("moves a section in its canonical template without creating a second section collection", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  const templateId = document.defaultTemplateIds.home!;
  const template = getStorefrontTemplate(document, templateId)!;
  const sectionId = template.sections[0].id;

  const moved = applyCommand(document, {
    type: "move-section",
    location: { kind: "template", templateId },
    sectionId,
    toIndex: 1,
  });

  expect(getStorefrontTemplate(moved, templateId)?.sections[1].id).toBe(sectionId);
  expect(moved).not.toHaveProperty("regions");
});
```

- [ ] **Step 5: Run command tests and confirm type/runtime failures**

Run: `npm test -- --run src/features/store-editor/model/document-locations.test.ts src/features/store-editor/model/commands.test.ts src/features/store-editor/model/page-commands.test.ts`

Expected: FAIL because commands still consume `region` and `pageId`.

- [ ] **Step 6: Implement location-based commands and remove synchronization**

Replace `updateRegion` with `updateSectionsAtLocation`. Remove `synchronizeHomeTemplate` completely from `state/reducer.ts`; canonical documents have nothing to synchronize. Keep active template identity in state and reconcile it to the page-type default when a loaded/edited document removes the previous template.

- [ ] **Step 7: Run editor model and state suites**

Run: `npm test -- --run src/features/store-editor/model src/features/store-editor/state`

Expected: PASS.

- [ ] **Step 8: Run schema plus editor regression suites**

Run: `npm test -- --run packages/storefront-schema/src src/features/store-editor/model src/features/store-editor/state`

Expected: PASS.

- [ ] **Step 9: Commit canonical editor commands**

```powershell
git add src/features/store-editor/model src/features/store-editor/state
git commit -m "refactor: target canonical editor locations"
```

---

### Task 4: Render canonical templates in preview and public routes

**Files:**
- Modify: `packages/storefront-renderer/src/types.ts`
- Modify: `packages/storefront-renderer/src/storefront-renderer.tsx`
- Modify: `packages/storefront-renderer/src/storefront-renderer-v3.test.tsx`
- Create: `packages/storefront-renderer/src/storefront-renderer-v4.test.tsx`
- Modify: `src/features/store-editor/components/editor-shell.tsx`
- Modify: `src/features/store-editor/components/page-hierarchy.tsx`
- Modify: `src/features/store-editor/components/preview-canvas.tsx`
- Modify: `src/features/store-editor/components/editor-shell.test.tsx`
- Modify: `src/features/storefront/storefront-page.tsx`
- Modify: `src/features/storefront/storefront-page.test.tsx`
- Modify: `src/features/storefront/public-storefront-api.test.ts`
- Modify: `src/app/[storeSlug]/page.tsx`
- Modify: `src/app/[storeSlug]/[pageSlug]/page.tsx`

**Interfaces:**
- Consumes: v4 accessors from Task 1 and migrations from Task 2
- Renderer accepts: `templateId?: string` and falls back through `getDefaultStorefrontTemplate(document, page)`
- Editor stores: `activeTemplateId: string`

- [ ] **Step 1: Write a failing renderer test for canonical template selection**

```tsx
it("renders the requested canonical template between shared groups", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  const alternate = makeProductTemplate("template-product-premium", "Premium product");
  document.templates.push(alternate);

  render(<StorefrontRenderer document={document} page="product" templateId={alternate.id} {...providers} />);

  expect(screen.getByText("Premium product")).toBeInTheDocument();
  expect(screen.getByRole("banner")).toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the renderer test and confirm the expected failure**

Run: `npm test -- --run packages/storefront-renderer/src/storefront-renderer-v4.test.tsx`

Expected: FAIL because the renderer still reads legacy regions/pages and has no `templateId` contract.

- [ ] **Step 3: Implement canonical renderer resolution**

Resolve the requested template only when its page type matches `page`; otherwise use the page-type default. Render `sharedGroups.header.sections`, the resolved template's sections, and `sharedGroups.footer.sections` through the existing section renderer. Keep the legacy `StoreDesignDocument` rendering branch only while its public compatibility tests require it.

- [ ] **Step 4: Write failing editor-shell tests for composed hierarchy behavior**

Assert that the hierarchy displays Header, the active template sections, and Footer, while the saved document contains no `regions`. Switch templates and verify the center canvas changes without duplicating either shared group.

- [ ] **Step 5: Run editor component tests and confirm failures against legacy props**

Run: `npm test -- --run src/features/store-editor/components/editor-shell.test.tsx`

Expected: FAIL until the shell, hierarchy, and preview use `activeTemplateId` and canonical locations.

- [ ] **Step 6: Implement the composed editor view**

Remove `editorDocument` reconstruction from `editor-shell.tsx`. Pass the unmodified canonical document plus the active template ID to the hierarchy, inspector, and preview. Build locations for commands at the component boundary without creating storage copies.

- [ ] **Step 7: Update public storefront consumers**

Replace all test and production reads of `regions.template` or `pages[].sections` with v4 accessors. Custom-page routing resolves `page.templateId`; home/product/collection rendering uses explicit assignment when available and otherwise the page-type default.

- [ ] **Step 8: Run renderer, editor component, storefront, and route tests**

Run: `npm test -- --run packages/storefront-renderer src/features/store-editor/components src/features/storefront src/app/page.test.tsx`

Expected: PASS.

- [ ] **Step 9: Run the broader schema, editor, renderer, and storefront regression suites**

Run: `npm test -- --run packages/storefront-schema/src packages/storefront-renderer/src src/features/store-editor src/features/storefront`

Expected: PASS.

- [ ] **Step 10: Commit canonical rendering and editor composition**

```powershell
git add packages/storefront-renderer src/features/store-editor/components src/features/storefront src/app
git commit -m "refactor: render canonical storefront templates"
```

---

### Task 5: Verify persistence compatibility and retire transitional writes

**Files:**
- Modify: `src/features/store-editor/api/client.test.ts`
- Modify: `src/features/store-editor/api/demo-session.ts`
- Modify: `e2e/store-editor.spec.ts`
- Modify: `packages/storefront-schema/src/index.test.ts`
- Remove after import scan is empty: `packages/storefront-schema/src/storefront-v2.ts`
- Update only if behavior changed: `docs/superpowers/specs/2026-09-07-full-site-template-editor-design.md`

**Interfaces:**
- Consumes: v4 document, migration, editor, and renderer contracts from Tasks 1–4
- Produces: new drafts that serialize only schema v4

- [ ] **Step 1: Write failing API serialization assertions**

Assert that save payloads have `schemaVersion: 4`, contain `sharedGroups` and `templates`, and do not contain `regions`. Assert that loaded v2/v3 API fixtures migrate before reaching editor state.

- [ ] **Step 2: Run the API tests and confirm legacy payload failures**

Run: `npm test -- --run src/features/store-editor/api/client.test.ts packages/storefront-schema/src/index.test.ts`

Expected: FAIL at any remaining transitional serialization path.

- [ ] **Step 3: Remove transitional exports and writes**

Update demo/session fixtures to v4, export only v4 `StorefrontDocument` types publicly, and remove `storefront-v2.ts` only after this command returns no production or test imports:

```powershell
rg -n "storefront-v2|regions\.template|pages\[[^]]+\]\.sections" packages src e2e
```

Expected before removal: no result that reads or writes current storefront content through those legacy paths; legacy fixture fields remain only in migration tests and private legacy parsers.

- [ ] **Step 4: Run all unit tests and type checking**

Run: `npm test`

Expected: all tests pass.

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 5: Run the production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 6: Run Store Editor end-to-end coverage**

Run: `npm run test:e2e -- e2e/store-editor.spec.ts`

Expected: the editor loads a legacy fixture, edits the canonical home template, autosaves schema v4, publishes, and shows the same content on the public storefront.

- [ ] **Step 7: Commit the completed canonical migration slice**

```powershell
git add packages/storefront-schema src/features/store-editor src/features/storefront packages/storefront-renderer src/app e2e/store-editor.spec.ts
git commit -m "feat: adopt canonical storefront documents"
```

## Completion gate

This plan is complete only when all of the following are demonstrated with fresh command output:

- all persisted storefront writes emit `schemaVersion: 4`;
- no production editor or renderer code reads `regions.template`;
- no production code synchronizes two template-section collections;
- v1, v2, and transitional v3 fixtures migrate deterministically to valid v4;
- all existing section, block, page, and template IDs survive migration where supplied by the source;
- repeated migration of the same input produces byte-equivalent JSON serialization;
- the existing storefront and editor behavior passes its regression suites;
- public package exports do not expose legacy storage types; and
- this search returns no production call sites and only intentional private legacy parser or migration-test fixtures:

```powershell
rg -n "regions\.template|synchronizeHomeTemplate|from ['\"]\./legacy-storefront" packages src e2e
```

Before the final commit, run the focused test for the last change, the complete related regression suites, `npm test`, `npm run typecheck`, `npm run build`, and the Store Editor end-to-end test. A failed command blocks completion rather than being documented as expected follow-up work.

## Follow-on plans

After this plan passes its complete verification gate, create and execute separate plans in this order:

1. Registry capabilities and fully declarative inspector contracts.
2. Multiple templates per page type and product/collection assignment APIs.
3. Full page-route render contexts and registered section coverage.
4. Atomic revision-bound publication, history, restore, roles, and audit metadata.
5. Reusable groups, copy/paste, rich text, media polish, accessibility, and performance.

Each follow-on plan must leave the product in a working, testable state and must use the canonical v4 interfaces defined here.
