# Side-by-side theme runtime versions

**Spec:** `docs/plans/theme-sdk-plan.md` Phase 4. **Goal:** a pinned published v1 and draft v2 of the same uploaded theme resolve independently, including defaults, recipes, editor controls, starters, chrome and styles.

**Decisions:** use explicit optional version parameters, never a mutable global active version or request-local swap. Versionless catalogue calls return the newest SemVer; pinned calls never substitute another version. Keep built-in ids/versions and existing publication snapshots unchanged. Same-version replacement remains available to local development hot reload. No staging writes, SQL migration, draft upgrade action or rollback UI in this increment.

## Tasks

- [x] Store theme definitions, recipe/section snapshots, starter packs and completeness metadata per id/version. Add exact-version lookup to settings/token resolvers. Test v1/v2 in either registration order, removed recipes, temporary validation undo, and unavailable-version fallback.
- [x] Carry pinned versions through published rendering, editor preview/controls, dynamic bindings and stylesheet selection. Test simultaneous v1/v2 rendering and cached reloads, with each version's recipe and CSS.
- [x] Backend: load installed, draft and publication artifact versions; select the exact starter on install; validate theme settings and compilation against the pinned section registry. Test v2 registered before v1, v1 compile after v2 install, and old published artifact loading.
- [x] Repack shared packages, run affected suites/typechecks, independent review, docs and local commit.

Implementation note: the initial CSS review found that selector scopes can occur inside compound selectors and `:is()`, and that keyframe identifiers are global. Both are now rewritten per version. Theme configuration saves also validate the installed artifact id against the pinned id/version, including when older clients omit the artifact field.

## Review focus

Loading order and concurrent consumers; removed/renamed recipe types; missing pins; legacy id-only CSS; builtin compatibility; catalogue duplicates; cached versions and startup after a draft moves forward.
