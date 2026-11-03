# Theme SDK and developer platform plan

Goal: a developer creates a custom Jelly Shop theme from scratch, validates and previews it locally, uploads it, and every supported section, block, layout and style option is customisable in the Theme Editor, with a developer experience comparable to Shopify's.

Companion: [Theme developer guide](../guides/theme-developer-guide.md) (how to build a theme with what exists today).

## 1. What exists, verified in the code

Status: **Exists** = works and is tested. **Partial** = part of it works or a placeholder exists. **Missing** = nothing in the repository.

| Capability | Status | Evidence and gap |
| --- | --- | --- |
| Theme manifest with a strict schema | **Exists** | `validateThemeManifest()` (`packages/storefront-themes/src/theme-resolver.ts`): id, semver version, asset prefix, settings schema (13 setting types), asset path rules. Strict: unknown keys rejected |
| Theme-wide settings and defaults the editor renders | **Exists** | `settingsSchema` rendered by the Theme settings panel; values validated by `validateThemeSettings()` |
| Design tokens and a theme CSS contract | **Exists** | `resolveStorefrontThemeTokens`, stylesheets scoped to `[data-jelly-theme]`, `docs/theme-architecture.md` |
| Section and block definitions with editor controls | **Exists** | `SectionDefinition`/`BlockDefinition` (zod schema + 15 control types, nesting to 3 levels, presets, per-device values, translations); 47 sections and 21 block types registered |
| One renderer for editor preview and live store | **Exists** | `RegistrySectionRenderer` used by the editor, storefront and theme preview |
| Editor integration without per-theme code | **Exists** | Inspector is driven by registry controls; draft, publish, snapshot, version history, restore session |
| Starter templates per page type | **Exists** | `v4-starter-packs.ts`, `validateV4StarterPack()` |
| Dynamic data: context, bindings, public APIs | **Exists** | `StorefrontRuntimeContext`, `commerce.getProducts()`, binding resolver, metaobject route, `docs/api/endpoints.md` |
| Publish-time validation with diagnostics | **Exists** | `backend/src/storefront/compiler/validate-*.ts`; diagnostics link back to the editor |
| Theme versioning | **Partial** | `version` is stored and pinned in snapshots; a mismatch falls back to the default theme (`fallbackReason`). No semver rules, no side-by-side versions, no changelog |
| Safe migration of merchant customisations | **Missing** | No migration step between theme versions. Renaming a setting key or section type breaks saved data. Only manual "ship a new theme id" |
| Theme library per store | **Partial** | "Saved looks" store a theme + settings snapshot (`ThemeLibraryEntry`). Pages and sections are shared, so it is not several full themes |
| Local preview without a store | **Partial** | `/theme-preview/<theme>` inside the monorepo app (three widths, every template, sample data). No standalone dev server, no mock data for arbitrary themes, not usable outside the repo |
| Hot reload | **Exists** (2026-11-03) | Renderer, UI and CSS reload as source. `npm run watch:packages` / `dev:watch` rebuild the schema, registry and themes packages on change (`jellyshops/scripts/watch-packages.mjs`) |
| Theme project validator (CLI-ready) | **Exists** (2026-11-03) | `validateThemeProject()` and `node scripts/validate-theme.mjs <folder>`: manifest, settings, starter, assets, and a declarative-only check that rejects anything executable. Same rules the upload API will use |
| JSON Schema and section catalogue | **Exists** (2026-11-03) | `docs/schemas/theme.schema.json` and `sections.json`, generated from the platform's own schemas by `scripts/generate-schemas.mjs`; a test fails if stale |
| Schema-based tests and CI | **Partial** | Vitest, axe, Playwright and CI exist. No theme conformance test suite a third party can run; only the validators above |
| Runtime registration of themes | **Missing** | Themes are a hard-coded array in `theme-registry.ts`; manifests are imported statically. `listThemes()` and the backend theme catalogue read that array |
| Runtime registration of sections and blocks | **Partial** | The renderer's `SectionRenderRegistry` has `register()` and `unregister()`, but the default registry is built in code. The definition registry (`registry.ts`) is a static array with no register function |
| Starter packs owned by the theme | **Missing** | `makePack()` in `v4-starter-packs.ts` branches on four hard-coded ids; every new theme edits shared code |
| Theme-owned locales (`locales/`) | **Missing** | Only per-section merchant translations exist (`settings.translations`). The theme's built-in words ("Add to cart", "Search") cannot be translated |
| Theme SDK (types, `defineTheme`, helpers) as a package | **Missing** | Types are spread across four private packages (`private: true`, workspace-only) |
| Developer CLI | **Missing** | No `bin` in any package; `scripts/` has docs generators and the package packer only |
| Packaging format and the packaging step | **Missing** | Only `prepare-shared-packages.mjs`, which packs the platform's own packages |
| Upload API, storage, review | **Missing** | No endpoint accepts a theme. `artifactId` (snapshot) and `draftArtifactId` (theme configuration) exist as nullable placeholders that nothing sets |
| Developer permissions | **Partial** | `developer:view/edit/build/publish` are defined in `backend/src/auth/types.ts` and `permissions.ts`; no route uses them |
| Sandbox for third-party code | **Missing** | Theme components are React code that runs in the shopper's page and the editor with full access |
| Component registry / design system docs for developers | **Partial** | `packages/storefront-ui` has 3 components (button, container, product card). No catalogue of the renderer's building blocks |
| Developer documentation | **Partial** | `docs/theme-architecture.md`, `docs/features/theme-system.md`, and now the developer guide. No API reference generated from the schemas |

**Conclusion.** The *editing and rendering* half of a Shopify-class system is built and strong: a registry-driven editor, one renderer, publish and snapshot pinning. The *distribution* half is missing: themes cannot be developed outside the monorepo, packaged, uploaded, versioned independently or migrated.

## 2. The decision everything depends on: untrusted code

Shopify themes are Liquid templates evaluated by Shopify on the server in a restricted language. Jelly Shop sections are **React components**. If a developer uploads a theme containing React code and the platform runs it, that code runs in shoppers' browsers and inside the merchant's Theme Editor, where a merchant's session token lives. One malicious theme could read orders, customers, tokens and payment pages for every store that installs it.

So "upload a theme" needs an explicit trust model. Options:

| Option | What a theme may contain | Security | Developer power | Effort |
| --- | --- | --- | --- | --- |
| **A. Declarative themes** | manifest, settings, templates, CSS, assets, locales, section **recipes** (below) built from platform primitives | Strong: no developer code runs | Medium: any look and layout the primitives allow; new behaviour needs platform primitives | Medium |
| **B. Sandboxed code** | A plus React/JS sections run in a cross-origin sandboxed iframe or worker with a message API | Good if done well; hard to get right; breaks the "one renderer" and live-editor click mapping | High | High |
| **C. Reviewed code themes** | A plus React sections, reviewed by the platform team and compiled into the platform build | Strong (human review) but slow; each release is a platform deploy | High | Low to medium |
| **D. Private registry** | C delivered as versioned packages from a private registry with signing | Strong | High; fits partner agencies | Medium |

**Recommendation: ship A first for everyone, and offer C or D to vetted partners. Treat B as a later research item.** This gives merchants and developers a real upload path soon, without making every theme a security review.

> **Decision (2026-11-03): declarative first.** Uploaded themes will contain data, CSS and assets only: no developer code runs in shoppers' browsers or the merchant's editor. Reviewed code themes (options C and D) stay a later, partner-only phase (Phase 6). Consequences for the plan: section recipes and the primitive catalogue are on the critical path for Phase 3, and the validators must reject anything executable (scripts, remote CSS, raw HTML, unsafe URLs) from the first upload.
>
> **Progress:** Phase 0 started 2026-11-03. Done: theme project validator and `validate-theme` script, JSON Schema and section catalogue export, package watch mode. Also done 2026-11-03: data-driven starter packs (`starter.json` becomes a pack through `createStarterPack`), theme auto-discovery (`scripts/generate-theme-index.mjs` writes `storefront-themes/src/themes/index.generated.ts`), and `registerSection`. The four built-in packs are locked by a hash test (`v4-starter-packs-locked.test.ts`). Finished 2026-11-03: `docs/schemas/starter.schema.json` (from `starterFileSchema`) and per-theme section visibility (`SectionDefinition.themes`, `listSectionDefinitionsForPage(page, region, themeId)`, `validateSectionAgainstRegistry(section, page, themeId)` with code `SECTION_NOT_AVAILABLE_ON_THEME`; the editor Add section list and the theme project validator pass the theme id; the backend compiler does not yet, that comes with installed themes in Phase 3).

A also matches the product: merchants customise through settings, not code. The core sections already cover most storefront needs (47 sections, 21 block types).

### What "section recipes" are (Option A)

A recipe describes a section's markup as data, using only platform primitives, so the platform renders it and developers write no executable code:

```jsonc
// sections/promo-banner/section.json
{
  "type": "promo-banner",
  "pages": ["home", "collection"],
  "settings": { "heading": { "type": "text", "default": "Limited edition", "max": 120 }, "image": { "type": "image" }, "link": { "type": "link" } },
  "blocks": { "allowed": ["button"], "max": 2 },
  "presets": [{ "id": "promo-banner", "label": "Promo banner" }],
  "render": {
    "element": "section", "class": "promo",
    "children": [
      { "element": "image", "src": "{{settings.image}}", "alt": "" },
      { "element": "heading", "level": 2, "text": "{{settings.heading}}" },
      { "slot": "blocks" }
    ]
  }
}
```

Primitives: `section`, `container`, `grid`, `stack`, `heading`, `text`, `richText`, `image`, `video`, `button`, `link`, `productGrid`, `productCard`, `collectionList`, `menu`, `form` (newsletter), `slot`. Values come only from `{{settings.*}}`, `{{block.*}}`, `{{store.*}}`, `{{product.*}}`. No scripts, no raw HTML, links and URLs sanitised, CSS scoped to the section. The recipe compiles to the same `SectionDefinition` plus a generic renderer, so editor integration is automatic.

## 3. Target design

### 3.1 Theme package format

```text
jelly-studio/
  theme.json                    manifest v2: id, version, engines { jelly: ">=1 <2" }, entry points
  config/settings.schema.json
  config/tokens.json
  layouts/default.json          which global sections wrap each template
  templates/*.json              home, product, collection, cart, search, page, blog, article, 404, …
  sections/<type>/section.json  settings, blocks, presets, render recipe
  blocks/<type>/block.json
  starter/                      starter.json (menus, global sections, templates, sample copy)
  assets/                       theme.css, images, fonts
  locales/en.json, hi.json
  migrations/0001-….json        declarative renames (below)
```

Packaged as `jelly-studio-1.2.0.jellytheme` (a zip with a manifest hash). The format maps 1:1 to the folders in your brief.

### 3.2 Schema system

- Publish the existing zod schemas as **JSON Schema** (zod 4 can generate it) in a versioned package so editors and CI can validate and autocomplete: `theme.schema.json`, `section.schema.json`, `block.schema.json`, `template.schema.json`, `starter.schema.json`.
- One validator, shared by the CLI and the upload API, reusing `validateThemeManifest`, `validateSectionAgainstRegistry` and `validateV4StarterPack` so local and server results are identical.

### 3.3 Component registry

- **Theme registry:** replace the hard-coded array with a registry that loads installed theme packages (`ThemeRegistry.register(package)`), keeping the built-in themes as the first entries.
- **Section registry:** add `registerSection(definition)` with namespacing (`jelly-studio/promo-banner`) so third-party sections cannot collide with core types, and per-theme visibility (a section is offered only on the theme that ships it).
- **Primitive catalogue:** document every primitive and core section with its settings, as generated reference pages (`jelly-theme docs`).

### 3.4 SDK and CLI

`@jelly/theme-sdk` (public npm package): types, `defineTheme`, `defineSection`, `defineBlock`, schema helpers, the validators, test helpers (`renderSection`, `expectEditable`).

`@jelly/theme-cli` (`jelly-theme`):

| Command | Does |
| --- | --- |
| `create <name>` | Scaffolds the folder above with a working example |
| `dev` | Local preview server with hot reload, mock store data (products, collections, pages), desktop/tablet/phone frames, and an embedded Theme Editor against local files |
| `validate` | Runs manifest, schema, starter and recipe validation; prints the same diagnostics as Publish |
| `test` | Conformance suite: every section renders empty and full, every setting reaches the output, no unsafe URLs, accessibility (axe) |
| `package` | Produces the `.jellytheme` archive and a hash |
| `login` / `upload` | Uploads to a developer's account as a draft version |
| `preview` | Installs the uploaded version on a developer test store and returns a link |
| `publish` | Submits the version for release (review for code themes) |

### 3.5 Local preview server

A small app (Vite or Next) packaged with the CLI that renders the theme with the platform's renderer package, mock data, and file watching. It reuses the existing theme preview page logic (`src/features/theme-preview/`), so it is an extraction, not a rewrite. It must show the **editor** too, because the promise is "every option is editable": load the real inspector against the theme's registry.

### 3.6 Platform changes (backend)

New tables: `ThemePackage` (id, owner, slug), `ThemeVersion` (package, semver, manifest, content hash, status `draft|review|released|yanked`, storage key), `ThemeInstall` (store, package, pinned version). Storage: object storage for the archive and an asset CDN path `/themes/<id>/<version>/…`. Endpoints: `POST /developer/themes`, `POST /developer/themes/:id/versions`, `GET …/versions/:v/validation`, `POST …/versions/:v/release`, plus catalogue endpoints for merchants. Use the existing `developer:*` permissions for them. The snapshot's `theme.artifactId` becomes the pinned `ThemeVersion` id.

### 3.7 Versioning and migration

- **Semver contract:** patch = fixes; minor = additions with defaults; major = may change or remove saved keys and **must** ship a migration.
- **Pinning:** a store stays on its installed version until the merchant upgrades; Publish pins the version in the snapshot (already true).
- **Declarative migrations:** `migrations/0002-….json` with operations `renameSetting`, `renameSectionType`, `renameBlockType`, `setDefault`, `removeSetting`. The platform applies them to the store's **draft** when the merchant upgrades, shows a diff, and keeps a snapshot to roll back. Existing published snapshots never change.
- **Compatibility:** `engines.jelly` states the platform range; the platform refuses to install a theme outside it.

## 4. Phased plan

Each phase ends in something usable. Sizes: S ≤ 1 week, M 2 to 3 weeks, L 4 to 6 weeks (one developer).

### Phase 0: Foundations inside the monorepo (M)

| Task | Acceptance |
| --- | --- |
| Starter packs move into each theme (`starter.json`), `makePack` becomes a loader **(done: built-in packs stay in code, locked by hash; new themes use `starter.json`)** | Adding a theme needs no edit to shared starter code; existing four packs produce identical output (snapshot test) |
| Theme auto-discovery from `themes/*/theme.json` **(done)** | A new folder appears in the catalogue without editing `theme-registry.ts` |
| `registerSection` with namespacing in the definition registry **(done, with per-theme visibility)** | A section added from a theme folder shows in the editor and validates on Publish |
| JSON Schema export for manifest, section, block, starter **(done, including starter)** | `node scripts/generate-schemas.mjs` writes files; a test fails if they drift from the zod schemas |
| `scripts/validate-theme.mjs <folder>` using the existing validators **(done)** | `docs/examples/jelly-studio` passes; a broken manifest prints a plain error |
| Watch mode for schema, registry and themes **(done)** | Editing a registry file updates the dev app without a manual build |

### Phase 1: Theme SDK and conformance tests (M)

> **Progress (2026-11-03): done in the monorepo.** `@jelly/theme-sdk` (`packages/theme-sdk`) re-exports `defineTheme`, `defineSection`, `defineBlock`, `registerSection`, `createStarterPack`, the validators; `@jelly/theme-sdk/testing` has `describeThemeConformance(themeId)` (manifest + settings, starter pack, rendering every template in preview and published mode and every section empty, colour setting reaches the tokens, no script links, axe on every template). Jelly Minimal and Avenue pass it in the normal test run (60 tests), so CI covers it. Every built-in theme is declared through `defineTheme` (in `storefront-themes`, re-exported by the SDK to avoid a circular package). Not done: the example theme folder is not run through the suite (it is not registered); publishing the SDK outside the monorepo is Phase 2.

`@jelly/theme-sdk` package with types, `defineTheme/Section/Block`, validators and test helpers; a conformance suite every theme must pass (renders empty and full, settings reach output, unsafe URL rejection, axe clean). Migrate Jelly Minimal and Avenue to the SDK as proof. **Acceptance:** both built-in themes are defined only through the SDK and pass the suite in CI.

### Phase 2: CLI and local preview (L)

> **Progress (2026-11-03): CLI and lite preview built inside the monorepo (scope agreed: no npm publish, not the full editor).** `@jelly/theme-cli` (`packages/theme-cli`, bin `jelly-theme`): `create <name>` (scaffold from `template/`, which passes the conformance suite in a test), `validate [folder] [--json]`, `test [folder]` (conformance suite through vitest against any folder, `registerThemeProject` registers it at run time), `dev [folder]` (Vite preview server: the platform renderer with sample data, every starter template, desktop/tablet/phone, a settings panel for theme settings, section settings, blocks and add/move/remove sections, click a section in the preview to select it, edits saved to `theme.json`/`starter.json`, disk edits reload the preview, `assets/` served at `/themes/<id>/`). New runtime API `registerThemeProject` in storefront-themes; sample pages shared in `@jelly/theme-sdk/sample-data`. Checked in a browser on a scaffolded theme in a folder outside the repository (render, edit a heading, save to disk, theme colour setting, phone width, hot reload of `theme.css`). **Not done:** publishing the packages to npm (so `npx @jelly/theme-cli create` does not work yet), the real editor embedded in the preview, macOS (only Windows tried), fonts (the preview uses system fonts), `theme.css` in published stores (Phase 3).

`create`, `dev`, `validate`, `test` with the preview server and embedded editor, outside the monorepo, against the published SDK. **Acceptance:** from an empty folder, `npx @jelly/theme-cli create studio && cd studio && npm run dev` shows a themed storefront with mock data and an editable home page within five minutes, on Windows and macOS.

### Phase 3: Packaging, upload and declarative themes (L)

Package format, `package` and `upload`, the three new tables, storage, validation pipeline, section recipes and primitives, install on a store, version pinning in snapshots, developer test stores. **Acceptance:** a theme with a custom recipe section is created, packaged, uploaded, installed on a staging store, customised in the editor, published, and the live store matches the preview at three widths. A package with a script tag, remote CSS import or unsafe URL is rejected with a plain message.

### Phase 4: Versioning and migrations (M)

> **Progress (2026-11-03): compatibility and migration foundations implemented locally.** Shared SemVer ordering and `engines.jelly` (theme API 1.0.0), optional inline manifest migrations, a cloned-draft migration dry run with path-based diffs, nested blocks and responsive overrides. Upload rejects removed/changed setting types and removed recipes without a major bump, requires a complete migration path for a major bump, and serializes validation/insertion per theme. Install rechecks engine compatibility. The SDK exports the helpers; generated JSON Schema and CLI validation use the same contract. A forward SQL migration aligns version constraints, with a legacy-data preflight; **not applied to staging**. The follow-up side-by-side runtime increment is now implemented locally: exact-version sections, recipes, starters, settings, bindings, CSS and chrome metadata can coexist, and saves validate their installed artifact pin. **Remaining:** transactional draft upgrades, persisted rollback snapshots and the Store designs upgrade/diff UI. The existing starter install does not apply migrations.

Semver rules, `engines`, declarative migrations with diff and rollback, upgrade flow in Store designs, yanked versions. **Acceptance:** upgrading a test store across a version that renames a setting preserves the merchant's value; rollback restores the draft; published snapshots are untouched.

### Phase 5: Locales and developer docs (M)

`locales/` with a theme string table and the shopper language picker using it; generated API reference for primitives, controls and settings; a documentation site built from `docs/`. **Acceptance:** the theme's built-in words translate; every control and primitive has a reference page generated from code.

### Phase 6: Trusted code themes for partners (M to L, optional)

Reviewed code sections via a private registry with signing and a review workflow, or an iframe sandbox if a hard requirement appears. **Acceptance:** a partner theme with a custom React section is reviewed, released and installed without a platform deploy per release.

**Suggested order:** 0, 1, 2, 3 (a usable upload path), then 4, 5; 6 only on demand. Phases 0 and 1 also fix the current maintenance cost (every theme edits shared files) and are worth doing even if upload is deferred.

## 5. Risks and open decisions

1. **Trust model (section 2).** Decide A-first with C/D for partners, or something else, before Phase 3. This is the single largest decision.
2. **Primitive coverage.** Recipes can only express what primitives allow. Plan a quarterly review of what developers ask for; start by building the primitives from the 47 existing sections.
3. **Custom page kinds.** Routes and page types are fixed by the platform (19 types). New page kinds need platform work, not theme work.
4. **Complete-theme pages** (checkout, account, order, wishlist) are styled through CSS only. Decide whether uploaded themes may restyle them (CSS) or also restructure them (needs recipes for those pages).
5. **Performance and cost** of object storage, CDN and validation jobs; set size limits (for example 10 MB per package, 2 MB CSS).
6. **Commercial model:** free, paid, marketplace. Not a technical blocker, but it shapes review and payouts.
7. **Compatibility promise.** Publishing `engines` ranges commits the platform to backwards compatibility of the registry and primitives; agree on a deprecation policy before opening upload.

## 6. What to do this month if only a little can be done

1. Phase 0, task 1 (starter packs owned by the theme) and task 2 (auto-discovery): removes the biggest friction for adding any theme today.
2. Phase 0, task 5 (`validate-theme.mjs`): immediate value for in-repo developers and the seed of the CLI.
3. Decide the trust model.
