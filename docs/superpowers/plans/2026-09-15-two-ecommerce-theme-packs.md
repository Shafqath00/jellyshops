# Two Ecommerce Theme Packs Implementation Plan

For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Deliver Fresh Market and Artisan Boutique as full, installable, editable Jelly Shop ecommerce themes backed only by Supabase PostgreSQL.

Architecture: Expand the storefront schema to all public route types, define immutable registry starter packs, then install merchant-owned copies through the revision-aware workspace boundary. The public renderer consumes compiled layouts and shared CSS token variables instead of hard-coded theme pages.

Tech Stack: Next.js 16, React, TypeScript, Vitest, Express, Zod, PostgreSQL/Supabase, Jelly storefront packages.

Spec: docs/superpowers/specs/2026-09-15-two-ecommerce-theme-packs-design.md

## Global Constraints

- Supabase PostgreSQL is the sole persistence layer. Do not add Prisma or Google Cloud SQL.
- Built-in starter packs are immutable; installation creates an isolated store-owned copy.
- All mutations are store-scoped, permission-protected, and revision-safe.
- Preserve existing catalog, checkout, order, and customer features.
- Support desktop, tablet, mobile, keyboard focus, and reduced motion.
- The repository has no initial commit. Do not create an initial commit containing unrelated workspace content.

## File Structure

- jellyshops/packages/storefront-schema/src/types.ts, schema.ts, defaults.ts: six-page document schema.
- jellyshops/packages/storefront-registry/src/theme-packs.ts and sections: starter packs and section definitions.
- jellyshops/packages/storefront-themes/src/fresh-market/tokens.ts and artisan-boutique/tokens.ts: token systems.
- jellyshops/packages/storefront-renderer/src/sections: runtime components for new sections.
- backend/src/storefront/workspace/theme-catalog-service.ts, theme-install-service.ts, repositories/theme-catalog-repository.ts: Supabase installation/activation.
- backend/src/storefront/workspace/routes.ts, api-service.ts, and backend/src/app.ts: store-scoped theme APIs.
- jellyshops/src/features/themes, store-editor, storefront, and app/admin/online-store/page.tsx: gallery, editor, and public route integration.

### Task 1: Expand complete storefront page schema

Files:
- Modify: jellyshops/packages/storefront-schema/src/types.ts
- Modify: jellyshops/packages/storefront-schema/src/schema.ts
- Modify: jellyshops/packages/storefront-schema/src/defaults.ts
- Test: jellyshops/packages/storefront-schema/src/schema.test.ts

Interfaces: Add fresh-market and artisan-boutique ThemeId values. Expand PageType with cart, search, and not-found. Require six entries in StoreDesignDocument.pages.

- [ ] Step 1: Write a failing schema test.

    it("accepts a complete Fresh Market document", () => {
      const document = createDefaultStoreDesign("fresh-market");
      expect(storeDesignDocumentSchema.parse(document).pages).toEqual(expect.objectContaining({
        home: expect.any(Object), product: expect.any(Object), collection: expect.any(Object),
        cart: expect.any(Object), search: expect.any(Object), "not-found": expect.any(Object),
      }));
    });

- [ ] Step 2: Run npm test --workspace @jelly/storefront-schema -- src/schema.test.ts. Expected: FAIL because the page and theme IDs are absent.
- [ ] Step 3: Add the page/theme unions, Zod shape, and valid default cart/search/not-found pages.
- [ ] Step 4: Run npm test --workspace @jelly/storefront-schema -- src/schema.test.ts src/index.test.ts. Expected: PASS.
- [ ] Step 5: After repository initialization, commit with message: feat: support complete storefront page templates.

### Task 2: Register full ecommerce sections

Files:
- Modify: jellyshops/packages/storefront-registry/src/sections/content.ts
- Modify: jellyshops/packages/storefront-registry/src/sections/commerce.ts
- Test: jellyshops/packages/storefront-registry/src/registry.test.ts

Interfaces: Add cart-summary, search-results, not-found-message, journal-teaser, trust-strip, and image-mosaic; each has supported pages, controls, defaults, and block limits.

- [ ] Step 1: Write a failing registry test.

    it.each(["cart-summary", "search-results", "not-found-message", "journal-teaser", "trust-strip", "image-mosaic"])(
      "registers %s", (type) => expect(getSectionDefinition(type)).toBeDefined(),
    );

- [ ] Step 2: Run npm test --workspace @jelly/storefront-registry -- src/registry.test.ts. Expected: FAIL.
- [ ] Step 3: Define controls. Editorial sections expose eyebrow, heading, rich text, image, link, and blocks. Cart/search only expose settings the renderer supports.
- [ ] Step 4: Run npm test --workspace @jelly/storefront-registry -- src/registry.test.ts src/controls.test.ts. Expected: PASS.
- [ ] Step 5: After repository initialization, commit with message: feat: add complete storefront sections.

### Task 3: Define immutable Fresh Market and Artisan Boutique starter packs

Files:
- Create: jellyshops/packages/storefront-registry/src/theme-packs.ts
- Create: jellyshops/packages/storefront-registry/src/theme-packs.test.ts
- Modify: jellyshops/packages/storefront-registry/src/index.ts

Interfaces: ThemePack with id, name, description, preview, and immutable StoreDesignDocument. Expose listThemePacks, getThemePack, and createThemePackDocument.

- [ ] Step 1: Write a failing isolation test.

    it.each(["fresh-market", "artisan-boutique"] as const)("creates isolated %s copies", (id) => {
      const first = createThemePackDocument(id);
      const second = createThemePackDocument(id);
      first.pages.home.sections[0].settings.changed = true;
      expect(second.pages.home.sections[0].settings.changed).toBeUndefined();
      expect(Object.keys(first.pages)).toHaveLength(6);
    });

- [ ] Step 2: Run npm test --workspace @jelly/storefront-registry -- src/theme-packs.test.ts. Expected: FAIL.
- [ ] Step 3: Build complete layouts. Fresh Market includes announcement/navigation, seasonal hero, category grid, collection, promotion, product grid, trust strip, newsletter, and footer. Artisan Boutique includes minimal nav, editorial hero, brand story, collection spotlight, curated rail, mosaic, testimonials, journal teaser, newsletter, and footer. Both get product, collection, cart, search, and not-found pages with generated unique IDs.
- [ ] Step 4: Run npm test --workspace @jelly/storefront-registry -- src/theme-packs.test.ts src/registry.test.ts. Expected: PASS.
- [ ] Step 5: After repository initialization, commit with message: feat: add fresh market and artisan boutique packs.

### Task 4: Add visual tokens and renderer components

Files:
- Create: jellyshops/packages/storefront-themes/src/fresh-market/tokens.ts
- Create: jellyshops/packages/storefront-themes/src/artisan-boutique/tokens.ts
- Modify: jellyshops/packages/storefront-themes/src/theme-registry.ts
- Modify: jellyshops/packages/storefront-renderer/src/section-support.ts
- Create: relevant components under jellyshops/packages/storefront-renderer/src/sections
- Test: jellyshops/packages/storefront-themes/src/theme-registry.test.ts
- Test: jellyshops/packages/storefront-renderer/src/section-support.test.ts

Interfaces: resolveDesignTokens accepts both new theme IDs. All Task 2 section types resolve through the section renderer.

- [ ] Step 1: Write a failing token test.

    it.each(["fresh-market", "artisan-boutique"] as const)("resolves %s tokens", (id) => {
      expect(resolveDesignTokens(id, createDefaultStoreDesign(id).globalSettings)).toMatchObject({
        "--jelly-color-primary": expect.any(String), "--jelly-font-display": expect.any(String),
      });
    });

- [ ] Step 2: Run npm test --workspace @jelly/storefront-themes -- src/theme-registry.test.ts. Expected: FAIL.
- [ ] Step 3: Implement Fresh Market (produce green, citrus, cream, rounded cards) and Artisan Boutique (ink, ivory, plum, editorial serif). Components use current CSS variables, good alt text, and safe empty states.
- [ ] Step 4: Run npm test --workspace @jelly/storefront-themes -- src/theme-registry.test.ts and npm test --workspace @jelly/storefront-renderer -- src/section-support.test.ts src/registry-renderer.test.tsx. Expected: PASS.
- [ ] Step 5: After repository initialization, commit with message: feat: render two complete ecommerce themes.

### Task 5: Persist installations through Supabase

Files:
- Create: backend/src/storefront/workspace/repositories/theme-catalog-repository.ts
- Create: backend/src/storefront/workspace/theme-catalog-service.ts
- Create: backend/src/storefront/workspace/theme-install-service.ts
- Test: backend/src/storefront/workspace/theme-install-service.test.ts
- Test: backend/src/storefront/workspace/repositories/theme-catalog-repository.test.ts

Interfaces: InstalledThemeRecord has id, storeId, packId, active/draft status, revision, settings, createdAt, updatedAt. install(storeId, packId, expectedRevision) returns theme plus generation.

- [ ] Step 1: Write a failing transactional install test.

    it("installs an editable Fresh Market copy", async () => {
      const result = await service.install("store-a", "fresh-market", null);
      expect(repository.createInstalledTheme).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        storeId: "store-a", packId: "fresh-market", status: "active",
      }));
      expect(repository.createTemplate).toHaveBeenCalledTimes(6);
      expect(result.generation).toBeGreaterThan(0);
    });

- [ ] Step 2: Run npm test -- src/storefront/workspace/theme-install-service.test.ts. Expected: FAIL.
- [ ] Step 3: Within one transaction, deactivate previous active theme, insert installed theme, create six templates from a fresh pack clone, save active theme configuration, and increment workspace generation. Stale revisions must use the existing resource revision conflict error.
- [ ] Step 4: Run npm test -- src/storefront/workspace/theme-install-service.test.ts src/storefront/workspace/repositories/theme-catalog-repository.test.ts src/storefront/workspace/theme-service.test.ts. Expected: PASS.
- [ ] Step 5: After repository initialization, commit with message: feat: install theme packs in supabase.

### Task 6: Expose protected gallery API

Files:
- Modify: backend/src/storefront/workspace/routes.ts
- Modify: backend/src/storefront/workspace/api-service.ts
- Modify: backend/src/app.ts
- Test: backend/src/storefront/workspace/routes.test.ts

Interfaces:
- GET /api/stores/:storeId/storefront/themes returns available and installed theme lists.
- POST /api/stores/:storeId/storefront/themes/:themeId/install returns HTTP 201 and theme plus generation.
- PATCH /api/stores/:storeId/storefront/themes/:themeId accepts expectedRevision, status, and settings.

- [ ] Step 1: Write a failing authorized install route test.

    const response = await request(app)
      .post("/api/stores/store-a/storefront/themes/fresh-market/install")
      .set("authorization", "Bearer merchant-token");
    expect(response.status).toBe(201);
    expect(response.body.theme).toMatchObject({ packId: "fresh-market", status: "active" });

- [ ] Step 2: Run npm test -- src/storefront/workspace/routes.test.ts. Expected: FAIL with 404.
- [ ] Step 3: Implement strict Zod schemas, require storefront:view for reads, storefront:edit for writes, and use Supabase services when SUPABASE_DATABASE_URL is present.
- [ ] Step 4: Run npm test -- src/storefront/workspace/routes.test.ts src/app.test.ts. Expected: PASS.
- [ ] Step 5: After repository initialization, commit with message: feat: expose ecommerce theme gallery api.

### Task 7: Build admin gallery and public active-theme routes

Files:
- Modify: jellyshops/src/features/store-editor/api/types.ts and client.ts
- Create: jellyshops/src/features/themes/theme-gallery.tsx
- Test: jellyshops/src/features/themes/theme-gallery.test.tsx
- Modify: jellyshops/src/app/admin/online-store/page.tsx
- Modify: jellyshops/src/features/storefront/public-storefront-api.ts, resource-loader.ts, storefront-page.tsx
- Modify: jellyshops/src/app/[storeSlug] route pages
- Test: jellyshops/src/features/storefront/storefront-page.test.tsx

Interfaces: StoreEditorApi.listThemes, StoreEditorApi.installTheme, and resolveThemeRoute(snapshot, pageType).

- [ ] Step 1: Write failing gallery and route tests.

    render(<ThemeGallery available={[freshMarket]} installed={[]} onInstall={onInstall} onActivate={vi.fn()} onEdit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add Fresh Market" }));
    expect(onInstall).toHaveBeenCalledWith("fresh-market");

    it.each(["home", "product", "collection", "cart", "search", "not-found"] as const)(
      "resolves %s for the active theme", (pageType) =>
        expect(resolveThemeRoute(snapshot, pageType)).toMatchObject({ status: "ok", template: { type: pageType } }),
    );

- [ ] Step 2: Run npm test -- src/features/themes/theme-gallery.test.tsx src/features/storefront/storefront-page.test.tsx. Expected: FAIL.
- [ ] Step 3: Replace static cards with API data, active state, Add theme, Activate, Edit theme, loading, and retry states. Resolve active tokens and expanded layouts across all six public routes using batched catalog data.
- [ ] Step 4: Run npm test -- src/features/themes/theme-gallery.test.tsx src/features/storefront/storefront-page.test.tsx src/features/store-editor/api/client.test.ts. Expected: PASS.
- [ ] Step 5: After repository initialization, commit with message: feat: install and render ecommerce theme packs.

### Task 8: Verify end to end

Files:
- Create: jellyshops/design-qa-two-theme-packs.md
- Modify: regression tests from earlier tasks.

- [ ] Step 1: Add stale-revision coverage.

    await expect(service.update("store-a", "theme-a", 2, { status: "active" }))
      .rejects.toMatchObject({ code: "RESOURCE_REVISION_CONFLICT" });

- [ ] Step 2: Run all package suites.

    npm test --workspace @jelly/storefront-schema
    npm test --workspace @jelly/storefront-registry
    npm test --workspace @jelly/storefront-themes
    npm test --workspace @jelly/storefront-renderer

Expected: PASS.

- [ ] Step 3: Run type checks and builds.

    cd jellyshops
    .\node_modules\.bin\tsc.cmd --noEmit
    npm run build
    cd ..\backend
    npm run build

Expected: exit code 0, or separately record exact pre-existing failures.

- [ ] Step 4: Browser and Supabase QA. At desktop, tablet, and mobile: install each pack, activate it, edit text/color/image, add section/block, preview, publish, and load every public route. Check console errors. Run a safe rolled-back Supabase probe and record results without credentials.

## Plan Self-Review

- Spec coverage: schema/pages (Task 1), sections (Task 2), packs (Task 3), visual systems (Task 4), Supabase installation (Task 5), protected APIs (Task 6), gallery/public routes (Task 7), verification (Task 8).
- Placeholder scan: no TBD, TODO, unnamed interface, or deferred implementation step.
- Type consistency: six page types, theme pack identifiers, installed themes, and route resolver are introduced before consuming tasks.

