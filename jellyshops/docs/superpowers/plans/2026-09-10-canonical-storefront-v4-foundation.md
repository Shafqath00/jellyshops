# Canonical Storefront v4 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested canonical StorefrontDocument v4 and deterministic legacy migrations without changing the existing v3 editor or renderer yet.

**Architecture:** Milestone 1 introduces the canonical v4 model beside the current transitional v3 API. Existing application consumers continue using the current root `StorefrontDocument` export until Milestone 2. New v4 types, factories, validation, and migration functions use explicit versioned names so the repository remains buildable while the editor and renderer are migrated later.

**Tech Stack:** TypeScript, Zod, Vitest, Next.js workspace packages

**Spec:** `docs/superpowers/specs/2026-09-07-full-site-template-editor-design.md`

## Global Constraints

- A template's ordered sections exist in exactly one authoritative location in v4.
- Header and footer are shared groups and are never copied into templates.
- v4 contains no writable `regions` content representation.
- Legacy v1, v2, and transitional v3 documents are accepted only by the v4 migration boundary.
- Existing section and block IDs are preserved by migration.
- IDs introduced by migration are deterministic for the same store and source entity.
- Runtime commerce data does not enter the storefront document.
- Milestone 1 must not change editor, renderer, API, or public-storefront runtime behavior.
- The existing root v3 exports remain intact until Milestone 2 so the application continues to compile.
- New production code is written only after a focused test fails for the intended missing behavior.

---

## File structure

- `packages/storefront-schema/src/storefront-v4.ts` — canonical v4 types, schema, factories, accessors, and validation.
- `packages/storefront-schema/src/legacy-storefront.ts` — private parsers/types for historical v1, v2, and transitional v3 input.
- `packages/storefront-schema/src/storefront-v4-migrations.ts` — deterministic migration orchestration from historical inputs to v4.
- `packages/storefront-schema/src/storefront-v4.test.ts` — v4 invariants and factory tests.
- `packages/storefront-schema/src/storefront-v4-migrations.test.ts` — migration preservation and determinism tests.
- `packages/storefront-schema/src/index.ts` — adds versioned v4 exports while preserving all existing v3 exports.

---

### Task 1: Define the canonical v4 document

**Files:**
- Create: `packages/storefront-schema/src/storefront-v4.ts`
- Create: `packages/storefront-schema/src/storefront-v4.test.ts`

**Interfaces:**
- Produces: `STOREFRONT_V4_SCHEMA_VERSION = 4`
- Produces: `StorefrontPageTypeV4`
- Produces: `StorefrontTemplateV4`
- Produces: `StorefrontSharedGroupV4`
- Produces: `StorefrontPageV4`
- Produces: `StorefrontDocumentV4`
- Produces: `createDefaultStorefrontDocumentV4(storeId: string, themeId?: ThemeId): StorefrontDocumentV4`
- Produces: `createStorefrontStarterV4(starterId: "bakes" | "essentials", storeId: string): StorefrontDocumentV4`
- Produces: `getStorefrontTemplateV4(document: StorefrontDocumentV4, templateId: string): StorefrontTemplateV4 | undefined`
- Produces: `getDefaultStorefrontTemplateV4(document: StorefrontDocumentV4, pageType: StorefrontPageTypeV4): StorefrontTemplateV4 | undefined`
- Produces: `validateStorefrontDocumentV4(input: unknown)`

- [ ] **Step 1: Write the failing canonical-shape tests**

Create `packages/storefront-schema/src/storefront-v4.test.ts` with focused tests for the new source-of-truth rules:

```ts
import { describe, expect, it } from "vitest";
import {
  createDefaultStorefrontDocumentV4,
  getDefaultStorefrontTemplateV4,
  validateStorefrontDocumentV4,
} from "./storefront-v4.js";

describe("StorefrontDocument v4", () => {
  it("stores template sections only on canonical templates", () => {
    const document = createDefaultStorefrontDocumentV4("store-demo");
    const home = getDefaultStorefrontTemplateV4(document, "home");

    expect(document.schemaVersion).toBe(4);
    expect(home?.sections.some((section) => section.type === "hero")).toBe(true);
    expect(document).not.toHaveProperty("regions");
    expect(document.sharedGroups.header.kind).toBe("header");
    expect(document.sharedGroups.footer.kind).toBe("footer");
  });

  it("accepts the default factory", () => {
    expect(validateStorefrontDocumentV4(
      createDefaultStorefrontDocumentV4("store-demo"),
    ).success).toBe(true);
  });

  it("rejects a default template pointing at the wrong page type", () => {
    const document = createDefaultStorefrontDocumentV4("store-demo");
    document.defaultTemplateIds.home = document.defaultTemplateIds.product;

    expect(validateStorefrontDocumentV4(document).success).toBe(false);
  });

  it("rejects duplicate node ids across the document", () => {
    const document = createDefaultStorefrontDocumentV4("store-demo");
    const home = getDefaultStorefrontTemplateV4(document, "home")!;
    home.sections[0].id = document.sharedGroups.header.sections[0].id;

    expect(validateStorefrontDocumentV4(document).success).toBe(false);
  });

  it("rejects legacy regions on canonical input", () => {
    const document = {
      ...createDefaultStorefrontDocumentV4("store-demo"),
      regions: { header: [], template: [], footer: [] },
    };

    expect(validateStorefrontDocumentV4(document).success).toBe(false);
  });

  it("round-trips canonical v4 through JSON serialization", () => {
    const document = createDefaultStorefrontDocumentV4("store-demo");
    const parsed = validateStorefrontDocumentV4(
      JSON.parse(JSON.stringify(document)),
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(document);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the intended failure**

Run from `jellyshops/`:

```bash
npm test -- --run packages/storefront-schema/src/storefront-v4.test.ts
```

Expected: FAIL because `storefront-v4.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal v4 model**

Create `packages/storefront-schema/src/storefront-v4.ts` around this canonical shape:

```ts
export const STOREFRONT_V4_SCHEMA_VERSION = 4 as const;

export type StorefrontPageTypeV4 =
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

export interface StorefrontTemplateV4 {
  id: string;
  pageType: StorefrontPageTypeV4;
  name: string;
  handle: string;
  system: boolean;
  sections: SectionNode[];
}

export interface StorefrontSharedGroupV4 {
  id: string;
  kind: "header" | "footer";
  sections: SectionNode[];
}

export interface StorefrontPageV4 {
  id: string;
  type: "page";
  title: string;
  slug: string;
  templateId: string;
}

export interface StorefrontDocumentV4 {
  schemaVersion: 4;
  storeId: string;
  theme: { presetId: ThemeId; settings: GlobalSettings };
  sharedGroups: Record<"header" | "footer", StorefrontSharedGroupV4>;
  templates: StorefrontTemplateV4[];
  pages: StorefrontPageV4[];
  defaultTemplateIds: Partial<Record<StorefrontPageTypeV4, string>>;
}
```

Use strict Zod root objects. Validation must reject:

- duplicate IDs across templates, shared groups, pages, sections, and blocks;
- duplicate `(pageType, handle)` template pairs;
- missing default-template targets;
- defaults pointing to templates of the wrong page type;
- informational pages whose `templateId` is missing or points to a non-`page` template;
- duplicate or reserved custom-page slugs;
- shared-group record keys whose embedded `kind` disagrees;
- unsafe media URLs using unsupported protocols;
- documents larger than 1.5 MB;
- unknown root keys, including legacy `regions`.

The default factory must create `home`, `product`, and `collection` default templates plus shared header/footer groups. Use stable container IDs such as:

```text
shared-header
shared-footer
template-home-default
template-product-default
template-collection-default
```

Fresh merchant-created section/block IDs may continue using `crypto.randomUUID()`.

- [ ] **Step 4: Run the focused v4 tests**

```bash
npm test -- --run packages/storefront-schema/src/storefront-v4.test.ts
```

Expected: PASS with no warnings.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/storefront-schema/src/storefront-v4.ts packages/storefront-schema/src/storefront-v4.test.ts
git commit -m "feat: define canonical storefront v4 model"
```

---

### Task 2: Add deterministic migration from v1, v2, and v3

**Files:**
- Create: `packages/storefront-schema/src/legacy-storefront.ts`
- Create: `packages/storefront-schema/src/storefront-v4-migrations.ts`
- Create: `packages/storefront-schema/src/storefront-v4-migrations.test.ts`

**Interfaces:**
- Consumes: `StorefrontDocumentV4`, v4 validation/accessors from Task 1
- Produces: `migrateStorefrontDocumentV4(input: unknown, storeId: string): StorefrontDocumentV4`
- Produces privately: `createMigrationId(input: { storeId: string; entityKind: string; legacyKey: string }): string`

- [ ] **Step 1: Write failing migration tests**

Create tests that use the real historical shapes already represented by the current schema code:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultStoreDesign } from "./defaults.js";
import {
  createDefaultStorefrontDocument,
  type StorefrontDocument,
} from "./storefront-v2.js";
import { getDefaultStorefrontTemplateV4 } from "./storefront-v4.js";
import { migrateStorefrontDocumentV4 } from "./storefront-v4-migrations.js";

describe("v4 storefront migrations", () => {
  it("migrates transitional v3 without retaining regions", () => {
    const legacy = createDefaultStorefrontDocument("store-demo");
    const migrated = migrateStorefrontDocumentV4(legacy, "store-demo");

    expect(migrated).not.toHaveProperty("regions");
    expect(
      getDefaultStorefrontTemplateV4(migrated, "home")?.sections.map(({ id }) => id),
    ).toEqual(legacy.pages[0].sections.map(({ id }) => id));
  });

  it("treats v3 pages as authoritative over duplicated regions.template", () => {
    const legacy: StorefrontDocument = createDefaultStorefrontDocument("store-demo");
    legacy.regions.template = [];

    const migrated = migrateStorefrontDocumentV4(legacy, "store-demo");

    expect(getDefaultStorefrontTemplateV4(migrated, "home")?.sections.length)
      .toBe(legacy.pages[0].sections.length);
  });

  it("preserves existing section and block ids", () => {
    const legacy = createDefaultStoreDesign("minimal");
    const sourceSection = legacy.pages.home.sections[0];
    const migrated = migrateStorefrontDocumentV4(legacy, "store-demo");
    const targetSection = getDefaultStorefrontTemplateV4(migrated, "home")!.sections[0];

    expect(targetSection.id).toBe(sourceSection.id);
    expect(targetSection.blocks.map(({ id }) => id))
      .toEqual(sourceSection.blocks.map(({ id }) => id));
  });

  it("is deterministic for the same legacy input", () => {
    const legacy = createDefaultStorefrontDocument("store-demo");

    const first = migrateStorefrontDocumentV4(legacy, "store-demo");
    const second = migrateStorefrontDocumentV4(legacy, "store-demo");

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("returns equivalent canonical v4 input", () => {
    const first = migrateStorefrontDocumentV4(
      migrateStorefrontDocumentV4(createDefaultStoreDesign("minimal"), "store-demo"),
      "store-demo",
    );
    const second = migrateStorefrontDocumentV4(first, "store-demo");

    expect(second).toEqual(first);
  });
});
```

Add explicit v2 fixtures using the historical `schemaVersion: 2` shape from `storefront-v2.ts` so all three legacy generations are covered, not only v1 and v3.

- [ ] **Step 2: Run the migration test and verify failure**

```bash
npm test -- --run packages/storefront-schema/src/storefront-v4-migrations.test.ts
```

Expected: FAIL because the v4 migration module does not exist yet.

- [ ] **Step 3: Move historical parsing responsibility into `legacy-storefront.ts`**

Define strict private parsers for:

```text
v1 = StoreDesignDocument
v2 = schemaVersion 2 with header/template/footer regions
v3 = schemaVersion 3 with regions plus pages
```

Do not export these historical parser types from the package root. They are implementation details for migration only.

- [ ] **Step 4: Implement deterministic migration IDs**

Use one exact helper:

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

Existing IDs are preserved exactly. New IDs generated only because the historical shape lacks an equivalent identity must use stable keys based on store ID plus a historical stable key such as page slug, page type, or existing entity ID. Do not use timestamps, random UUIDs, or `Math.random()` in migration-generated identity.

- [ ] **Step 5: Implement the migration mapping**

Use these exact ownership rules:

```text
legacy header              -> sharedGroups.header.sections
legacy footer              -> sharedGroups.footer.sections
v1 home page               -> default home template
v1 product page            -> default product template
v1 collection page         -> default collection template
v2 template region         -> default home template
v3 home page sections      -> default home template
v3 product page sections   -> default product template when present
v3 collection page sections-> default collection template when present
v3 custom page             -> one page template plus one informational page record
```

For transitional v3, `pages[].sections` is authoritative. Ignore `regions.template` when both exist.

The public migration pipeline must be:

```text
unknown input
  -> detect canonical v4
  -> otherwise parse one historical version
  -> migrate to v4
  -> validate v4
  -> return StorefrontDocumentV4
```

- [ ] **Step 6: Run focused migration and v4 tests**

```bash
npm test -- --run packages/storefront-schema/src/storefront-v4.test.ts packages/storefront-schema/src/storefront-v4-migrations.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/storefront-schema/src/legacy-storefront.ts packages/storefront-schema/src/storefront-v4-migrations.ts packages/storefront-schema/src/storefront-v4-migrations.test.ts
git commit -m "feat: migrate legacy storefront documents to v4"
```

---

### Task 3: Expose v4 safely without breaking current v3 consumers

**Files:**
- Modify: `packages/storefront-schema/src/index.ts`
- Test: existing schema package tests plus application typecheck/build

**Interfaces:**
- Consumes: v4 model and migration APIs from Tasks 1 and 2
- Produces package-root exports:
  - `STOREFRONT_V4_SCHEMA_VERSION`
  - `StorefrontDocumentV4`
  - `StorefrontTemplateV4`
  - `StorefrontSharedGroupV4`
  - `StorefrontPageV4`
  - `StorefrontPageTypeV4`
  - `createDefaultStorefrontDocumentV4`
  - `createStorefrontStarterV4`
  - `getStorefrontTemplateV4`
  - `getDefaultStorefrontTemplateV4`
  - `validateStorefrontDocumentV4`
  - `migrateStorefrontDocumentV4`

- [ ] **Step 1: Add a failing package-root export test**

Extend `packages/storefront-schema/src/index.test.ts`:

```ts
import { expect, it } from "vitest";
import {
  STOREFRONT_V4_SCHEMA_VERSION,
  createDefaultStorefrontDocumentV4,
  migrateStorefrontDocumentV4,
} from "./index.js";

it("exports the staged v4 storefront API", () => {
  expect(STOREFRONT_V4_SCHEMA_VERSION).toBe(4);
  expect(createDefaultStorefrontDocumentV4("store-demo").schemaVersion).toBe(4);
  expect(
    migrateStorefrontDocumentV4(
      createDefaultStorefrontDocumentV4("store-demo"),
      "store-demo",
    ).schemaVersion,
  ).toBe(4);
});
```

- [ ] **Step 2: Run the export test and verify failure**

```bash
npm test -- --run packages/storefront-schema/src/index.test.ts
```

Expected: FAIL because the versioned v4 API is not exported from `index.ts` yet.

- [ ] **Step 3: Add versioned exports without removing existing exports**

Update `packages/storefront-schema/src/index.ts` so current exports from `storefront-v2.ts` remain unchanged, then add the v4 exports from `storefront-v4.ts` and `storefront-v4-migrations.ts`.

Do not rename or remove these current root symbols in Milestone 1:

```text
STOREFRONT_SCHEMA_VERSION
StorefrontDocument
createDefaultStorefrontDocument
createStorefrontTemplate
getStorefrontPage
migrateStorefrontDocument
validateStorefrontDocument
```

Those symbols are switched to v4 only during Milestone 2, when editor and renderer consumers are migrated in the same change series.

- [ ] **Step 4: Run the complete schema regression suite**

```bash
npm test -- --run packages/storefront-schema/src
```

Expected: PASS.

- [ ] **Step 5: Run application typecheck**

```bash
npm run typecheck
```

Expected: PASS. This is the key proof that introducing v4 did not break the current editor/renderer contract.

- [ ] **Step 6: Run the production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add packages/storefront-schema/src/index.ts packages/storefront-schema/src/index.test.ts
git commit -m "feat: expose staged storefront v4 API"
```

---

### Task 4: Verify Milestone 1 as an independently stable foundation

**Files:**
- No production file changes expected.
- Fix only failures caused by Tasks 1-3 before declaring the milestone complete.

**Interfaces:**
- Consumes: all staged v4 APIs
- Produces: a green, backward-compatible data-model foundation for Milestone 2

- [ ] **Step 1: Run all frontend unit tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run the existing Store Editor end-to-end suite**

```bash
npm run test:e2e
```

Expected: PASS. The runtime should behave exactly as before because no editor/renderer consumer has been switched to v4 yet.

- [ ] **Step 5: Record the Milestone 1 completion criteria**

Milestone 1 is complete only when all of these are true:

```text
[ ] v4 has no regions field.
[ ] Templates own their section arrays exactly once.
[ ] Header/footer are shared groups.
[ ] Default home/product/collection templates validate.
[ ] v1, v2, and v3 inputs migrate to valid v4.
[ ] v3 pages[].sections wins over duplicated regions.template.
[ ] Existing section/block IDs survive migration.
[ ] Migration-generated IDs are deterministic.
[ ] Canonical v4 JSON round-trips through validation.
[ ] Existing v3 root API still compiles and behaves unchanged.
[ ] Full unit tests pass.
[ ] Typecheck passes.
[ ] Production build passes.
[ ] Existing Store Editor e2e tests pass.
```

Do not begin editor-command migration until this entire gate is green.

---

## What Milestone 1 deliberately does not do

This plan does not modify:

- `src/features/store-editor/model/commands.ts`;
- `src/features/store-editor/state/reducer.ts`;
- `src/features/store-editor/components/editor-shell.tsx`;
- `packages/storefront-renderer/src/storefront-renderer.tsx`;
- Store Editor UI;
- public storefront routing;
- backend persistence contracts;
- Firebase, Supabase, or cloud runtime configuration.

Those changes belong to Milestone 2: migrate editor commands and rendering from the staged v3 API to the canonical v4 API, then retire the duplicated v3 representation.
