# Multi-Theme Storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement manifest-backed, per-store, deterministic React storefront themes with safe fallback.

**Architecture:** The themes workspace owns validated, build-time theme definitions. The backend resolves and snapshots the selected `ThemeConfiguration`; the frontend renderer applies theme layouts and section overrides before base and shared rendering. Existing structured workspace templates and generic commerce logic remain unchanged.

**Tech Stack:** Next.js/React, TypeScript, Express, Zod, Vitest, PostgreSQL JSONB migrations, npm workspaces.

**Spec:** `jellyshops/docs/superpowers/specs/2026-09-19-multi-theme-storefront-design.md`

## Global Constraints

- Preserve all existing uncommitted work unrelated to themes.
- Do not introduce Liquid, Handlebars, dynamic theme code loading, or tenant executable code.
- Keep product, cart, API, authorization, and catalog behavior outside themes.
- Use `ThemeConfiguration` as the per-store source of truth and existing workspace revision/concurrency paths.
- Resolve runtime behavior as active theme, then default theme, then shared registry renderer.

## Review Focus

- Unknown public legacy theme IDs must render the base theme rather than crash.
- Disabled or malformed manifests must be rejected before they can be selected.
- A settings write must merge manifest defaults and preserve revision conflict behavior.
- Existing V4 snapshots with `presetId` must remain renderable.
- Theme asset paths must stay within `/themes/<theme-id>/`.

### Task 1: Build the manifest-backed theme registry

**Files:**
- Create: `jellyshops/packages/storefront-themes/src/themes/default/theme.json`
- Create: `jellyshops/packages/storefront-themes/src/themes/example-boutique/theme.json`
- Create: `jellyshops/packages/storefront-themes/src/themes/default/index.ts`
- Create: `jellyshops/packages/storefront-themes/src/themes/example-boutique/index.ts`
- Create: `jellyshops/packages/storefront-themes/src/theme-resolver.ts`
- Modify: `jellyshops/packages/storefront-themes/src/types.ts`, `theme-registry.ts`, `index.ts`
- Test: `jellyshops/packages/storefront-themes/src/theme-resolver.test.ts`

**Interfaces:** Produces `resolveTheme(requestedId, settings, version?)`, `listThemes()`, `DEFAULT_THEME_ID`, `ThemeDefinition`, and manifest validation errors.

- [ ] Write resolver tests for selected, unknown, invalid asset, and defaults-merged results.
- [ ] Run `npm test --workspace @jelly/storefront-themes -- theme-resolver.test.ts` and observe missing-module failure.
- [ ] Create manifest-backed definitions and resolver with Zod validation and a default fallback.
- [ ] Run the targeted test and workspace tests.

### Task 2: Make backend configuration and snapshots resolver-driven

**Files:**
- Create: `backend/src/storefront/theme-resolver.ts`, `theme-resolver.test.ts`
- Modify: `backend/src/storefront/workspace/theme-service.ts`, `routes.ts`, `api-service.ts`
- Modify: `backend/src/storefront/compiler/types.ts`, `snapshot.ts`, compiler input loader in `backend/src/app.ts`
- Modify: `backend/sql/migrations/20260919130000_add_theme_configuration_version.sql`
- Test: `backend/src/storefront/workspace/theme-service.test.ts`, `backend/src/storefront/compiler/snapshot.test.ts`

**Interfaces:** Backend `ThemeResolver.resolve(themeId, settings, version?)` returns pinned `ResolvedTheme`; save accepts `themeVersion`; snapshots include `{ id, version, settings, fallbackReason? }` while accepting legacy `presetId`.

- [ ] Write failing service and snapshot tests for rejection of unavailable choices and deterministic resolved snapshots.
- [ ] Run the backend targeted tests and observe expected failures.
- [ ] Implement resolver injection/validation, version persistence, default seeding behavior, and snapshot serialization.
- [ ] Run targeted backend tests.

### Task 3: Add theme-aware frontend layout and section fallback

**Files:**
- Modify: `jellyshops/packages/storefront-renderer/src/storefront-renderer.tsx`, `registry-section-renderer.tsx`, `types.ts`, `index.ts`
- Modify: `jellyshops/src/features/storefront/storefront-page.tsx`, `public-storefront-api.ts`
- Modify: `jellyshops/src/components/storefront-frame.tsx`, `jellyshops/src/app/[storeSlug]/layout.tsx`
- Add public assets below `jellyshops/public/themes/example-boutique/`
- Test: `jellyshops/packages/storefront-renderer/src/storefront-renderer.test.tsx`, `jellyshops/src/features/storefront/storefront-page.test.tsx`

**Interfaces:** Renderer accepts a resolved runtime theme and asks the active then base definition for `layout`/`sectionOverrides`; it falls back to existing shared section rendering.

- [ ] Write failing renderer tests proving active override wins, base fallback is used, and an unknown legacy preset does not throw.
- [ ] Run targeted frontend tests and observe expected failures.
- [ ] Implement the ThemeLayout and ThemeSectionOverride contracts, base-compatible frame, Boutique alternate layout/hero override, and namespaced asset resolution.
- [ ] Run targeted frontend tests.

### Task 4: Connect existing admin selection and document theme authoring

**Files:**
- Modify: `jellyshops/src/app/admin/online-store/page.tsx`
- Modify: `jellyshops/src/features/store-editor/api/types.ts`, `client.ts`
- Create: `jellyshops/docs/themes.md`
- Test: add/update `jellyshops/src/app/admin/online-store/page.test.tsx` if the existing page behavior permits isolated testing

**Interfaces:** Admin uses `listThemes()` and `saveThemeConfiguration()` rather than a hard-coded pack list, passing the current revision/version/settings.

- [ ] Write a failing test or API-client test showing theme selection sends the selected manifest ID/version through the existing authenticated workspace path.
- [ ] Run its targeted test and observe expected failure.
- [ ] Implement dynamic selection UI and author documentation with manifest, assets, overrides, settings, migration, publish, and fallback procedures.
- [ ] Run targeted frontend tests.

### Task 5: Verify compatibility and production checks

**Files:**
- Modify tests only where fixtures require the new runtime shape.

- [ ] Run package/backend/frontend theme tests, then full frontend and backend test suites.
- [ ] Run frontend and backend type checks.
- [ ] Run frontend lint and production build if the environment has dependencies/tooling available.
- [ ] Inspect `git diff --check` and the changed-file list; verify pre-existing changes remain outside this feature's edits.
