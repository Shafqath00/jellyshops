# Local V4 Workspace Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Reconstruct one persisted local V4 storefront workspace as the existing compiler input and prove it compiles without a new compiler or theme format.

**Architecture:** A read-only local data-source port owns store-scoped persistence reads. \`LocalV4WorkspaceReader\` implements the existing \`CompilationInputLoader\`, adapts data into \`StorefrontCompilationInput\`, and checks generation before and after aggregation. The existing V4 compiler continues to own validation.

**Tech Stack:** TypeScript, Vitest, existing V4 compiler, PostgreSQL/Supabase SQL adapter.

**Spec:** \`docs/superpowers/specs/2026-09-21-local-v4-workspace-reader-design.md\`

## Global Constraints

- Workspace identity is exactly \`storeId\`; do not introduce \`themeId\` into the key.
- Reuse \`CompilationInputLoader\` and \`StorefrontCompilationInput\`; do not create a second compiler DTO or compiler.
- Keep persisted global sections separate from template layouts.
- Reader calls are read-only and must never bootstrap or repair data.
- Commerce/content is passed only as resource identifiers; never copy product, inventory, price, or collection-member data into compiler input.
- Missing optional collections normalize to contract defaults; malformed required documents flow through existing compiler validation.
- An expected generation mismatch or generation change during aggregation throws \`WorkspaceGenerationConflictError\` with the current generation.
- The before/after check is not a transactional snapshot guarantee; document that limitation in code comments and tests.

## Review Focus

- A record belonging to another store must never be read or appear in compiler input.
- A generation change between the first and second workspace read must reject rather than compile mixed draft data.
- A malformed persisted layout or section must reach existing compiler diagnostics rather than being removed or replaced.
- Missing optional menus, assignments, definitions, and resource categories must yield deterministic empty compiler collections.
- A real persisted workspace with only resource identifiers must compile without pulling commerce payloads into the snapshot.

---

## File Structure

- Create \`backend/src/storefront/local-v4-workspace-reader.ts\`: read-only persistence port, concrete reader, record-to-compiler adaptation, and generation checks.
- Create \`backend/src/storefront/local-v4-workspace-reader.test.ts\`: isolated reader behavior and compiler-service integration tests using a controllable in-memory read port.
- Modify \`backend/src/app.ts\`: expose a store-scoped SQL read adapter for the local runtime boundary only after reader tests define the port; do not wire publication or public snapshot behavior in this task.
- Modify \`backend/src/app.test.ts\`: prove the default persistence adapter supplies only the requested store to the reader-facing factory.

### Task 1: Define the read-only workspace source and test complete reconstruction

**Files:**
- Create: \`backend/src/storefront/local-v4-workspace-reader.ts\`
- Create: \`backend/src/storefront/local-v4-workspace-reader.test.ts\`

**Interfaces:**
- Consumes: \`CompilationInputLoader\` from \`backend/src/storefront/compiler/service.ts\`; compiler input types from \`backend/src/storefront/compiler/types.ts\`; \`WorkspaceGenerationConflictError\` from \`backend/src/storefront/workspace/errors.ts\`.
- Produces: \`LocalV4WorkspaceReader implements CompilationInputLoader\` and a \`LocalV4WorkspaceDataSource\` containing only store-scoped read methods.

- [ ] **Step 1: Write the failing reconstruction test**

\`\`\`ts
it("reconstructs one store's persisted V4 workspace as compiler input", async () => {
  const source = fixtureSource({
    workspace: { generation: 7, updatedAt: new Date(0) },
    templates: [homeTemplate],
    globalSections: [announcement],
    menus: [mainMenu],
    theme: { storeId: "store-a", themeId: "minimal", themeVersion: "1.0.0", settings: { accent: "pink" }, draftArtifactId: "artifact-a" },
    assignments: [{ resourceType: "product", resourceId: "product-a", templateId: "product-default" }],
    resourceIds: { products: ["product-a"], collections: ["collection-a"], pages: ["page-a"], blogs: [], articles: [] },
  });

  await expect(new LocalV4WorkspaceReader(source).load("store-a", 7, "registry-a"))
    .resolves.toMatchObject({
      storeId: "store-a", generation: 7, registryManifestHash: "registry-a",
      theme: { presetId: "minimal", id: "minimal", version: "1.0.0", settings: { accent: "pink" }, artifactId: "artifact-a" },
      templates: [expect.objectContaining({ id: "home-default" })],
      globalSections: [expect.objectContaining({ id: "announcement" })],
      menus: [expect.objectContaining({ id: "main" })],
      assignments: [{ resourceType: "product", resourceId: "product-a", templateId: "product-default" }],
    });
});
\`\`\`

- [ ] **Step 2: Run the test to verify it fails**

Run: \`npm test -- --run src/storefront/local-v4-workspace-reader.test.ts\`

Expected: FAIL because \`LocalV4WorkspaceReader\` is not defined.

- [ ] **Step 3: Write minimal reader code**

\`\`\`ts
export interface LocalV4WorkspaceDataSource {
  getWorkspace(storeId: string): Promise<{ generation: number; updatedAt: Date } | null>;
  listTemplates(storeId: string): Promise<StorefrontTemplateRecord[]>;
  listGlobalSections(storeId: string): Promise<GlobalSectionRecord[]>;
  listMenus(storeId: string): Promise<NavigationMenuRecord[]>;
  getThemeConfiguration(storeId: string): Promise<ThemeConfigurationRecord | null>;
  listAssignments(storeId: string): Promise<TemplateAssignmentRecord[]>;
  listResourceIds(storeId: string): Promise<CompilerResourceIds>;
  listMetafieldDefinitions(storeId: string): Promise<CompilerMetafieldDefinitionInput[]>;
  listMetaobjectDefinitions(storeId: string): Promise<CompilerMetaobjectDefinitionInput[]>;
}

export class LocalV4WorkspaceReader implements CompilationInputLoader {
  async load(storeId: string, expectedGeneration: number, registryManifestHash: string): Promise<StorefrontCompilationInput> {
    // Read generation, assert expected value, aggregate only with storeId,
    // read it again, and map records without validation or mutation.
  }
}
\`\`\`

Map \`handle === "default"\` unchanged so the existing snapshot assembler derives defaults. Preserve inline/global placements and section/block documents structurally. Return independent \`Set<string>\` instances for resource IDs.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: \`npm test -- --run src/storefront/local-v4-workspace-reader.test.ts\`

Expected: PASS; reconstructed input contains persisted V4 records and mutation spies are never invoked.

- [ ] **Step 5: Commit the completed unit**

\`\`\`bash
git add backend/src/storefront/local-v4-workspace-reader.ts backend/src/storefront/local-v4-workspace-reader.test.ts
git commit -m "feat: read local v4 storefront workspaces"
\`\`\`

### Task 2: Protect isolation, optional state, invalid state, and stable generations

**Files:**
- Modify: \`backend/src/storefront/local-v4-workspace-reader.ts\`
- Modify: \`backend/src/storefront/local-v4-workspace-reader.test.ts\`

**Interfaces:**
- Consumes: \`LocalV4WorkspaceDataSource\` and \`LocalV4WorkspaceReader\` from Task 1.
- Produces: deterministic normalization and \`WorkspaceGenerationConflictError\` behavior for every reader client.

- [ ] **Step 1: Write failing edge-case tests**

\`\`\`ts
it("does not include another store's records", async () => {
  const source = fixtureSource({ templates: [homeTemplate], foreignTemplates: [{ ...homeTemplate, id: "foreign", storeId: "store-b" }] });
  const input = await new LocalV4WorkspaceReader(source).load("store-a", 7, "registry-a");
  expect(input.templates.map(({ id }) => id)).toEqual(["home-default"]);
  expect(source.calls.every((call) => call.storeId === "store-a")).toBe(true);
});

it("normalizes absent optional collections without creating state", async () => {
  const source = fixtureSource({ menus: undefined, assignments: undefined, metafields: undefined, metaobjects: undefined });
  const input = await new LocalV4WorkspaceReader(source).load("store-a", 7, "registry-a");
  expect(input.menus).toEqual([]);
  expect(input.assignments).toEqual([]);
  expect(input.metafieldDefinitions).toEqual([]);
  expect(input.metaobjectDefinitions).toEqual([]);
  expect(source.mutations).toEqual([]);
});

it("preserves malformed stored layout for compiler validation", async () => {
  const source = fixtureSource({ templates: [{ ...homeTemplate, layout: { sections: [{ kind: "global", globalSectionId: "missing" }] } }] });
  const input = await new LocalV4WorkspaceReader(source).load("store-a", 7, "registry-a");
  expect(input.templates[0]?.layout.sections).toEqual([{ kind: "global", globalSectionId: "missing" }]);
});

it("rejects a read when generation changes during aggregation", async () => {
  const source = fixtureSource({ generations: [7, 8] });
  await expect(new LocalV4WorkspaceReader(source).load("store-a", 7, "registry-a"))
    .rejects.toEqual(new WorkspaceGenerationConflictError(8));
});
\`\`\`

- [ ] **Step 2: Run focused tests to verify they fail**

Run: \`npm test -- --run src/storefront/local-v4-workspace-reader.test.ts\`

Expected: FAIL for generation re-check and normalization/isolation behavior.

- [ ] **Step 3: Implement the minimal protections**

\`\`\`ts
const initial = await this.requireWorkspace(storeId);
if (initial.generation !== expectedGeneration) throw new WorkspaceGenerationConflictError(initial.generation);

const [templates, globalSections, menus, theme, assignments, resourceIds, metafields, metaobjects] = await Promise.all([
  this.source.listTemplates(storeId), this.source.listGlobalSections(storeId), this.source.listMenus(storeId),
  this.source.getThemeConfiguration(storeId), this.source.listAssignments(storeId), this.source.listResourceIds(storeId),
  this.source.listMetafieldDefinitions(storeId), this.source.listMetaobjectDefinitions(storeId),
]);

const final = await this.requireWorkspace(storeId);
if (final.generation !== initial.generation) throw new WorkspaceGenerationConflictError(final.generation);
\`\`\`

Convert undefined optional collections to empty arrays at the port boundary. Do not schema-parse, filter malformed documents, write defaults, or silently accept a changed generation. Add a source comment stating that two generation reads detect common races but do not provide a transactional snapshot.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: \`npm test -- --run src/storefront/local-v4-workspace-reader.test.ts\`

Expected: PASS; all calls use \`store-a\` and mutation spies remain empty.

- [ ] **Step 5: Commit the completed unit**

\`\`\`bash
git add backend/src/storefront/local-v4-workspace-reader.ts backend/src/storefront/local-v4-workspace-reader.test.ts
git commit -m "feat: guard local v4 workspace reads"
\`\`\`

### Task 3: Add the real local persistence adapter and compiler integration proof

**Files:**
- Modify: \`backend/src/app.ts:461-822\`
- Modify: \`backend/src/app.test.ts\`
- Modify: \`backend/src/storefront/local-v4-workspace-reader.test.ts\`

**Interfaces:**
- Consumes: reader types from Tasks 1–2, existing \`CatalogAdmin\`, \`ContentService\`, and \`SqlExecutor\` adapters.
- Produces: a real local store-scoped read adapter usable by later local compiler wiring and a compile-through proof via \`StorefrontCompilationService\`.

- [ ] **Step 1: Write failing adapter and compile-through tests**

\`\`\`ts
it("compiles a realistic persisted local workspace through the existing compilation service", async () => {
  const source = persistedFixtureSource({
    workspaceGeneration: 4,
    templates: [registeredHomeTemplate],
    theme: minimalTheme,
    productIds: ["product-a"],
    collectionIds: ["collection-a"],
  });
  const service = new StorefrontCompilationService(
    new LocalV4WorkspaceReader(source), registryWithRegisteredHome, dynamicSources, "local-v4", () => "registry-a",
  );

  await expect(service.compile("store-a", 4))
    .resolves.toMatchObject({ ok: true, snapshot: { storeId: "store-a", sourceGeneration: 4 } });
});

it("the SQL source issues every workspace query with the requested store id", async () => {
  const query = vi.fn(/* return rows for one store */);
  const source = createLocalV4WorkspaceDataSource(query, catalog, content, customData);
  await new LocalV4WorkspaceReader(source).load("store-a", 4, "registry-a");
  expect(query.mock.calls.flatMap(([, params]) => params ?? [])).toContain("store-a");
  expect(query.mock.calls.flatMap(([, params]) => params ?? [])).not.toContain("store-b");
});
\`\`\`

- [ ] **Step 2: Run the tests to verify they fail**

Run: \`npm test -- --run src/storefront/local-v4-workspace-reader.test.ts src/app.test.ts\`

Expected: FAIL because no real data-source factory exists and the compiler integration has not received persisted records.

- [ ] **Step 3: Implement the SQL read adapter and integration seam**

\`\`\`ts
export function createLocalV4WorkspaceDataSource(
  sql: SqlExecutor,
  catalog: Pick<CatalogAdmin, "listProducts" | "listCollections">,
  content: Pick<ContentService, "listPages" | "listBlogs" | "listArticles">,
  customData: LocalV4DefinitionReader,
): LocalV4WorkspaceDataSource { /* SELECT only store-scoped workspace rows and IDs */ }
\`\`\`

Use read-only \`SELECT\` statements for \`StorefrontWorkspace\`, \`StorefrontTemplate\`, \`GlobalSection\`, \`NavigationMenu\`, \`ThemeConfiguration\`, and \`StorefrontTemplateAssignment\`; add no SQL writes or fallback creation. Fetch catalog/content through their existing store-scoped service methods and retain only IDs. Add definition reads only if the existing custom-data service exposes an appropriate read method; otherwise return empty arrays because the compiler contract treats definitions as optional and document that missing local definition-reader contract.

Keep the factory independent of route APIs. Do not make \`createApp()\` activate publication, compiler routes, or public snapshots in this reader-only task.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: \`npm test -- --run src/storefront/local-v4-workspace-reader.test.ts src/app.test.ts\`

Expected: PASS; the real local fixture compiles to a V4 snapshot and each read remains scoped to \`store-a\`.

- [ ] **Step 5: Run type and full backend verification**

Run: \`npm run typecheck && npm test\`

Expected: PASS. If unrelated existing failures occur, record their test names and leave their files unchanged.

- [ ] **Step 6: Commit the completed unit**

\`\`\`bash
git add backend/src/storefront/local-v4-workspace-reader.ts backend/src/storefront/local-v4-workspace-reader.test.ts backend/src/app.ts backend/src/app.test.ts
git commit -m "feat: adapt local v4 workspace persistence for compilation"
\`\`\`

## Final Verification

- [ ] Run \`npm test -- --run src/storefront/local-v4-workspace-reader.test.ts\` and confirm every reader acceptance test passes.
- [ ] Run \`npm run typecheck\` and \`npm test\` from \`backend\` and record exact results.
- [ ] Confirm no publication repository, public-storefront reader, or Search/Blog/Article renderer has been changed.
- [ ] Inspect \`git diff --check\` and \`git status --short\`; ensure unrelated pre-existing changes remain untouched.

