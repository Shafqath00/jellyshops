# Template and theme builder audit — 2026-10-29

## Scope and evidence

Read-only source audit of the current working tree, including existing uncommitted implementation. Read root `CLAUDE.md` and `jellyshops/AGENTS.md`. No application code, database, credentials, or existing changes were modified. This report is the only authored artifact. No full test suites, browser journeys, deployment, or staging mutations were run by this audit worker. Findings below are source-verified paths with predicted behavior; race conditions and visual behavior have not been experimentally reproduced. Existing test files were inspected as evidence of intended behavior, not treated as fresh passing results.

## Architecture and capability inventory

| Capability | Current implementation / limit |
| --- | --- |
| Create, rename, duplicate, delete | V4 editor mounts `TemplateActions`; alternate product, collection, page, blog, article templates can start as a server-side clone or basic layout. Backend normalizes names/handles, rejects reserved previous-* handles, clones local node IDs, enforces revision checks, and refuses deletion of defaults or assigned templates. Main layout is selected by handle `default`. |
| Assign layouts | Workspace assignment API checks resource tenancy and matching template type; remove returns resource to default. Product builder and collection form expose the picker. Page/blog/article assignment is supported by API/runtime, but no equivalent wiring was established in this audit. |
| Edit and save | Editor updates local drafts immediately; one revisioned save queue coalesces typing, serializes workspace writes, retains failed draft, and exposes retry/export/discard. Backend mutations increment workspace generation. Client intercepts same-origin link navigation and store changes while unsaved. Browser back/unmount preservation is not comprehensively proven. |
| Sections and DnD | Registry drives page/region section library and controls. Hierarchy uses dnd-kit pointer plus keyboard sensors, with up/down alternatives. DnD is constrained to the visual region. Enabled toggles apply to inline sections. |
| Blocks | Existing blocks are selectable and settings are editable; inline sections can append allowed blocks. Current V4 UI has no block delete, reorder, duplicate or visibility controls. Shared-section block structure cannot be edited without detaching. |
| Reusable content | Global sections are stored once and placed by reference; edits affect every template that references them; detach copies into inline placement. Saved presets are separately listed but their insertion bypasses server instantiation, detailed below. No global-delete route was found in workspace router. |
| Preview | Same `RegistrySectionRenderer` is used for draft and runtime template content, iframe sizes 390/820/full width, resource picker and compiled snapshot preview. Draft commerce provider ignores product query inputs. Preview is not proof of live shell parity. |
| Publish | Compiler checks registry, references, resource context and dynamic bindings, builds dependency graph and V4 snapshot. Immutable publication is saved then Store.currentPublicationId is activated. Live runtime caches by immutable publication ID and checks snapshot.storeId. |
| Draft vs live | Starter replacement and editing affect workspace, not saved publications. Publication activation is the live switch. Resource content/custom-field values are read live, so publication immutability freezes layout/theme/assignments rather than every product or custom-field value. |
| History and rollback | Session history capped at 50 entries, scope is store + active template. Switching scope then editing discards previous scope history. Global/theme edits are recorded under that template scope. No explicit publication list/rollback UI or endpoint is exposed by publication router. Repository can activate known publication IDs internally. |
| Theme compatibility | Theme resolution pins exact current manifest version and falls back to `minimal` when unavailable/mismatched; no version archive. Backend runs packed shared packages, so repack/install discipline is needed. Theme replacement retires default layouts and renames old menus; clears assignments; keeps old globals/templates. |
| Responsive editing | Viewport preview exists. Schema preserves section/block responsive.mobile settings; current V4 renderer does not apply them, detailed below. CSS media queries still provide ordinary responsive layout. |
| SEO | Product and collection routes implement server metadata with canonical links. Template editor is not an SEO editor. Adding/removing arbitrary heading sections can produce zero or multiple H1s; no semantic-heading compiler diagnostic was found. Content metadata is outside the narrow V4 editor. |
| Accessibility | Hierarchy has keyboard sorting, descriptive action labels, selected states, save/error statuses and labeled preview iframe. Template action popover handles Escape/outside pointer; full focus movement and keyboard reachability were not browser tested. No conformance claim is made. |

## Findings

### TB-01 — P1: delayed idempotent publish retry can roll live store back

**Source:** `backend/src/storefront/publication/service.ts:35-41`.

When a publication with the idempotency key exists, the service checks the live pointer and activates that old publication whenever the pointer differs. Repro sequence: publish A with key K; publish B successfully; retry A/K after a delayed client/network retry. The service activates A without checking expected generation or current-publication ordering. Idempotency replay should return A's prior result without changing newer live state. The existing activation-failure recovery path explains the intended retry use case, but cannot distinguish recovery from a stale replay.

**Recommendation:** persist activation state/operation result and use an atomic compare-and-set against the expected pointer or publication operation; never reactivate an already superseded successful operation on replay. Add a focused A/K → B → replay K regression test.

### TB-02 — P1: published complete-theme footer newsletter is permanently disabled

**Source:** `jellyshops/src/features/storefront/components/storefront-frame.tsx:67`; `jellyshops/packages/storefront-renderer/src/render-registry.tsx:72`; `jellyshops/packages/storefront-renderer/src/sections/home-sections.tsx:133-140`.

Complete themes render their actual header/footer in StorefrontFrame. It supplies only `commerce={{ getProducts: async () => [] }}`. Footer renderer passes `commerce.subscribeNewsletter`, which is therefore undefined; NewsletterForm disables the submit button when subscribe is absent and its submit handler returns immediately. The page-level commerce provider *does* implement newsletter subscription (`storefront-page.tsx:27`), but page-level footer rendering is suppressed when StorefrontChromeContext is true (`storefront-page.tsx:93-117`). Thus enabling newsletter in the footer creates a visible but unusable live signup form for Jelly Minimal/Avenue.

**Recommendation:** share a complete commerce provider with the frame, including store-scoped newsletter callback. Verify footer signup end-to-end, including consent, error and success.

### TB-03 — P2: live shell ignores custom-field bindings and page/blog/article alternate templates

**Source:** `jellyshops/src/features/storefront/components/storefront-frame.tsx:59-67`; `jellyshops/src/features/storefront/resource-loader.ts:151-180`; `jellyshops/src/features/storefront/storefront-page.tsx:93-117`.

Frame resolves resource assignments only for products and collections from the local repository. Page/blog/article routes therefore select their default shell even when the body route resolves the assigned alternate template. Frame also calls synchronous expandRuntimeLayout (fallbacks only), never expandRuntimeLayoutWithValues. Resolved route layout may contain actual bound header/footer values, but PublishedRuntimeStorefront suppresses those regions for complete themes. An alternate page's header/footer can match in editor yet differ in live storefront; store/resource custom fields bound in shell show fallback instead of value.

**Recommendation:** derive body and shell from one resolved route/layout and binding context, including all assignable resource types, rather than independently resolving shell from browser repository. Add parity tests for assigned information-page shell and bound footer/header values.

### TB-04 — P2: advertised logo-list section has no renderer and silently vanishes live

**Source:** `jellyshops/packages/storefront-registry/src/sections/content.ts:142`; `jellyshops/packages/storefront-renderer/src/render-registry.tsx:68-123`; `jellyshops/packages/storefront-renderer/src/registry-section-renderer.tsx:56-69`.

Registry advertises home-compatible `logo-list` with logo blocks. It has no built-in renderer or theme override (theme registry only overrides boutique hero). Registry/compiler validation checks the section definition rather than renderer availability. Preview shows unsupported-section text; published mode returns null. Merchant can save/publish a valid section that disappears.

**Recommendation:** implement renderer or remove section from available library until supported; require renderer coverage for advertised registry types in focused contract tests.

### TB-05 — P2: repeated saved-preset insertion reuses IDs and blocks autosave

**Source:** `jellyshops/src/features/store-editor/components/section-library.tsx:103-109`; `jellyshops/src/app/admin/online-store/editor/page.tsx:492-494`; `jellyshops/src/features/store-editor/template-layout.ts:29-34`; `backend/src/storefront/workspace/template-service.ts:64-65`.

Saved sections are inserted using structuredClone(preset.section), then appendInlineSection preserves its section/block IDs. Inserting the same saved section again creates duplicate section IDs, rejected by backend layout normalization. It can also collide on the first insertion when preset came from a section already on the page. This error retains a local draft that cannot save until repaired. API already exposes instantiatePreset but editor does not use it.

**Recommendation:** instantiate through existing endpoint or recursively generate fresh section/block IDs before inserting. Test inserting same preset twice and inserting its source section's preset.

### TB-06 — P2: basic alternate template starts without header/footer

**Source:** `jellyshops/src/features/store-editor/components/template-actions.tsx:106-110`; `jellyshops/src/features/store-editor/editor-page-helpers.ts:17-24`; `jellyshops/src/features/storefront/components/storefront-frame.tsx:63-69`.

"The basic layout" uses defaultTemplateLayout, which contains only body sections. Complete-theme chrome is derived solely from placements in selected template. Assigning a new basic product/collection template consequently drops header/footer and storefront navigation on that resource; the basic product layout also contains only product-information, without product-gallery/options/purchase sections. This is a substantially incomplete starting point despite being labeled a basic layout.

**Recommendation:** build the basic layout from the selected theme's valid starter template and preserve common shell references plus required product-purchase sections, or clearly present a genuinely empty layout and guide merchant to completion. Test assigned alternate template through cart-add and navigation.

### TB-07 — P2: current V4 path preserves responsive overrides but never applies them

**Source:** `jellyshops/packages/storefront-schema/src/schema.ts:7-22`; `jellyshops/src/features/store-editor/editor-page-helpers.ts:61-89`; `jellyshops/src/features/storefront/resource-loader.ts:82-105`; `jellyshops/packages/storefront-renderer/src/registry-section-renderer.tsx:50-97`.

V4 adapters retain responsive.mobile on sections and blocks, but RegistrySectionRenderer passes original settings directly to section components; the shared renderer source contains no responsive override resolution for this path. Viewport switching resizes iframe only. Stored mobile-specific values from compatible/imported documents therefore do not take effect. Current V4 inspector also has no override editing control.

**Recommendation:** either implement explicit responsive setting resolution/CSS variables consistently for editor and runtime, or narrow schema/compatibility promises and migrate old overrides. Add a mobile-vs-desktop settings regression test.

### TB-08 — P2: publish activation is not serialized against a newer concurrent publish

**Source:** `backend/src/storefront/local-v4-workspace-reader.ts:122-142`; `backend/src/storefront/publication/service.ts:44-57`; `backend/src/storefront/publication/sql-repository.ts:96-133,176-193`.

Workspace reader compares generation before/after reads. After that check, compilation, insert and activation occur separately. SQL save ignores input.expectedGeneration, and activation only checks publication ownership. A slow publish of generation N can activate after a faster publish of N+1, replacing the newer live layout; editing after compile is also not checked at activation. This is a source-derived race, not reproduced under load.

**Recommendation:** serialize/CAS publication activation per store with generation/pointer comparison and transactionally preserve publication operation ordering. Explicitly decide whether publishing an older saved generation is supported; if so, require an intentional rollback operation. Test concurrent controlled completion order.

## Other material limitations / follow-up verification

- V4 block structural actions are absent: add exists, but deleting an accidental block requires undo before history is lost or recreating the whole section. Shared block settings edit works, while structure requires detaching. Treat as a workflow gap rather than a hidden API guarantee.
- Session history is volatile and single-scope (`state/session-history.ts:2-15`). No durable version history or explicit rollback UI was found. Template clone/rename/delete and global conversion are not recorded as invertible history actions.
- Editor preview commerce.getProducts ignores collectionId/sort/featured/limit (`editor/page.tsx:395-406`); published provider honors sort/collection via API. Product-grid preview is therefore not a reliable preview of catalog selection.
- Starter replacement retains all non-default alternate templates and old globals. `liveTemplates` filters only previous-* templates. Old custom layouts that are not retired can continue blocking publish after theme switch; verify expected retention/visibility with real workspace fixtures. Previously retired globals are still included in snapshot input, though registry validation traverses actual placements.
- Basic save validation checks section placement shape and duplicate inline section IDs, while detailed settings/block/registry rules wait until Publish. Make sure inline diagnostics are usable when invalid saved drafts accumulate.
- Exact-version theme fallback is intentional current behavior, but publication snapshots do not contain frozen renderer/CSS executable code. Deployment of changed section code can alter old publications; never describe immutable snapshots as fully reproducible visual archives.
- Browser QA still needed for DnD keyboard/touch, focus after popover actions, iframe interaction/selection, narrow mobile editor toolbar, rich-text save failures, failed queue recovery, multi-tab revision conflicts and browser back/refresh data retention.

## Recommended order

1. Fix publication replay/activation ordering and live footer signup.
2. Unify live shell/body route resolution and dynamic bindings.
3. Close registry-renderer mismatch, preset ID reuse and incomplete basic templates.
4. Add focused parity checks for alternate templates, mobile settings, and required purchase/navigation sections.
5. Decide block lifecycle/history/rollback product scope, then complete browser accessibility QA.
