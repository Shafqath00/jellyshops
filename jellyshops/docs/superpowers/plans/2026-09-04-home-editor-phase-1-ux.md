# Home Editor Phase 1 UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing home-page Store Editor a persistent, accessible Shopify-style three-pane editor while retaining `StorefrontDocument` as the only saved, published, and rendered format.

**Architecture:** The existing reducer, command model, registry, schema, shared renderer, autosave controller, media API, and publish API remain the foundation. Phase 1 adds editor-only presentation metadata and interaction adapters; reorder always dispatches existing immutable commands, and preview clicks map stable `sectionId`/`blockId` attributes back to editor selection. No Puck, GrapesJS, v3 schema, multi-template support, arbitrary HTML/CSS, or renderer rewrite is permitted.

**Tech Stack:** Next.js 16, React, TypeScript, Zod, Vitest, Testing Library, Playwright, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

**Spec:** `docs/superpowers/specs/2026-08-31-home-page-store-editor-design.md` — execute only the Phase 1 subset approved on 2026-09-04.

## Global Constraints

- Persist and publish only `StorefrontDocument` schema version 2; do not add v3 or templates beyond home.
- Reuse `applyCommand`, `editorReducer`, `StorefrontRenderer`, registry validation, existing API revision handling, and local media upload.
- Drag/drop must dispatch existing `move-section` or `move-block` commands and retain visible keyboard move buttons.
- Selection identity is stable IDs only; never calculate identity from DOM order.
- Preset choices must be registry-backed, validated, and renderer-supported; no raw HTML/CSS is accepted.
- Rich text remains existing textarea behavior in Phase 1; do not install Tiptap.
- Keep current public-renderer output behavior intact outside editor mode.

---

## File structure and extraction boundaries

| File | Phase 1 responsibility |
| --- | --- |
| `packages/storefront-registry/src/types.ts` | Control grouping and section-preset metadata types. |
| `packages/storefront-registry/src/presets.ts` (new) | Pure registry-only preset catalog and validated section factory. |
| `src/features/store-editor/components/section-tree.tsx` (new) | Persistent left tree, nested blocks, move buttons, drag handles, and preset dialog trigger. |
| `src/features/store-editor/components/sortable-tree-row.tsx` (new) | One dnd-kit sortable row; prevents drag bindings from leaking into selection buttons. |
| `src/features/store-editor/components/preset-picker.tsx` (new) | Categorized preset dialog; never creates document data itself. |
| `src/features/store-editor/components/inspector/setting-groups.tsx` (new) | Generic Content/Layout/Style/Advanced grouping and collapsible headings. |
| `src/features/store-editor/state/use-storefront-autosave.ts` (new) | React bridge between current document/revision refs and the existing autosave controller. |

`editor-shell.tsx` is already responsible for composition, saves, publication, selection, and preview. Do not add dnd or inspector-group implementation details there. `page-hierarchy.tsx` should be renamed/replaced by `section-tree.tsx` rather than expanded into a large drag/drop/preset component. `control-renderer.tsx` stays focused on one control; add a small focus-ref implementation there instead of adding input-specific code to the inspector.

## Task 1: Make registry controls and presets explicit

**Files:**
- Modify: `packages/storefront-registry/src/types.ts`
- Modify: `packages/storefront-registry/src/sections/content.ts`
- Modify: `packages/storefront-registry/src/sections/commerce.ts`
- Modify: `packages/storefront-registry/src/sections/layout.ts`
- Modify: `packages/storefront-registry/src/blocks.ts`
- Create: `packages/storefront-registry/src/presets.ts`
- Modify: `packages/storefront-registry/src/index.ts`
- Test: `packages/storefront-registry/src/presets.test.ts`
- Test: `packages/storefront-registry/src/controls.test.ts`

**Existing functionality reused:** `SectionDefinition.defaultSettings`, `defaultBlocks`, `settingsSchema`, `allowedBlockTypes`, `validateSectionAgainstRegistry`, and stable ID creation already used by `PageHierarchy`.

**Interfaces:**

```ts
export type ControlGroup = "content" | "layout" | "style" | "advanced";
export type PresetCategory = "banners" | "products" | "content" | "marketing";

export interface SectionPreset {
  id: string;
  label: string;
  category: PresetCategory;
  sectionType: string;
}

export interface SectionDefinition {
  // existing members
  controls: Array<ControlDefinition & { group: ControlGroup }>;
  presets?: SectionPreset[];
}

export function createPresetSection(
  presetId: string,
  createId: () => string,
): SectionNode;
```

- [ ] **Step 1: Write failing preset tests.** Verify `createPresetSection("hero", ids)` produces enabled data with fresh section/block IDs and passes `validateSectionAgainstRegistry(section, "home")`. Verify unknown preset IDs throw. Verify each returned preset belongs to one of the four categories.
- [ ] **Step 2: Run `npm test -- packages/storefront-registry/src/presets.test.ts`; confirm it fails because the module does not exist.**
- [ ] **Step 3: Add required `group` metadata to every existing control.** Put copy/media/product links in `content`; alignment, columns, sizing, padding in `layout`; color/font/overlay in `style`; low-level links and future-facing controls in `advanced`. Do not add a custom inspector branch by section type.
- [ ] **Step 4: Add only renderer-supported home presets:** Hero under Banners; Product grid and Featured collection under Products; Rich text, Image with text, and Multicolumn under Content; Newsletter under Marketing. Do not add `image-banner`, `testimonials`, `faq`, `category-grid`, or any other currently unsupported renderer type.
- [ ] **Step 5: Implement `createPresetSection` as a pure factory.** It must clone registry defaults, generate IDs for section and every default block, set `enabled: true`, and call registry validation before returning. It must never take HTML, CSS, or caller-provided free-form settings.
- [ ] **Step 6: Run the focused tests, then `npm test -- packages/storefront-registry`.**
- [ ] **Step 7: Commit.** `feat: add grouped storefront section presets`

**Acceptance criteria:** Every exposed preset creates registry-valid home data; every control has a deterministic inspector group; unsupported section types have no Phase 1 preset.

## Task 2: Enforce renderer/preset parity

**Files:**
- Modify: `packages/storefront-renderer/src/section-renderer.tsx`
- Modify: `packages/storefront-renderer/src/index.ts`
- Create: `packages/storefront-renderer/src/section-support.ts`
- Test: `packages/storefront-renderer/src/section-support.test.ts`
- Test: `packages/storefront-registry/src/presets.test.ts`

**Existing functionality reused:** `SectionRenderer` is already the sole mapping from section type to shared renderer component.

**Interfaces:**

```ts
export const renderableHomeSectionTypes: ReadonlySet<string>;
export function isRenderableHomeSection(type: string): boolean;
```

- [ ] **Step 1: Write a failing parity test.** Get all editor presets from the registry and assert `isRenderableHomeSection(preset.sectionType)` is true for each.
- [ ] **Step 2: Run the test; confirm it fails until support is exported.**
- [ ] **Step 3: Move the supported home type list into `section-support.ts`.** Use it in `SectionRenderer` only as a support declaration; retain the current rendering branches and public behavior.
- [ ] **Step 4: Export the support check for the editor layer.** The later preset picker task will use it as a defensive runtime filter; this task remains limited to the renderer support declaration and the parity test.
- [ ] **Step 5: Run renderer and registry focused tests.**
- [ ] **Step 6: Commit.** `test: enforce store editor preset renderer parity`

**Acceptance criteria:** The editor cannot display a usable preset that the shared renderer cannot render.

## Task 3: Build the persistent three-pane shell and generic grouped inspector

**Files:**
- Create: `src/features/store-editor/components/section-tree.tsx`
- Create: `src/features/store-editor/components/inspector/setting-groups.tsx`
- Modify: `src/features/store-editor/components/editor-shell.tsx`
- Modify: `src/features/store-editor/components/inspector/inspector.tsx`
- Modify: `src/features/store-editor/components/inspector/control-renderer.tsx`
- Modify: `src/features/store-editor/components/editor-toolbar.tsx`
- Modify: `src/app/globals.css`
- Test: `src/features/store-editor/components/editor-shell.test.tsx`
- Test: `src/features/store-editor/components/inspector/setting-groups.test.tsx`

**Existing functionality reused:** `EditorShell` reducer state, `Inspector`, `ThemeInspector`, `ControlRenderer`, hierarchy selection, media uploads, undo/redo, and the existing responsive preview.

**Interfaces:**

```ts
export function SectionTree(props: {
  document: StorefrontDocument;
  selection: EditorSelection;
  onSelect(selection: EditorSelection): void;
  onCommand(command: EditorCommand): void;
}): JSX.Element;

export function SettingGroups(props: {
  controls: ControlDefinition[];
  settings: Record<string, unknown>;
  onChange(key: string, value: unknown): void;
  focusField?: { key: string; requestId: number };
}): JSX.Element;
```

- [ ] **Step 1: Write failing component tests.** Assert Home page hierarchy remains visible after selecting Hero; inspector appears separately with `aria-label="Section settings"`; template rows include nested block rows; controls render under the expected Content/Layout/Style/Advanced headings.
- [ ] **Step 2: Run the focused tests; confirm the current shell fails because it conditionally replaces the hierarchy.**
- [ ] **Step 3: Replace the conditional left-panel composition with three named landmarks:** `<aside aria-label="Page section tree">`, `<main aria-label="Storefront preview">`, and `<aside aria-label="Section settings">`. Keep the center `PreviewCanvas` and current toolbar.
- [ ] **Step 4: Move hierarchy logic into `SectionTree`.** Render Header, Template, Footer groups; show template section block children; retain existing select, visibility, duplicate, delete, and move controls. Selecting Theme settings opens the right ThemeInspector without hiding the tree.
- [ ] **Step 5: Add `PresetPicker`.** Group `listSectionPresets()` by its four registry categories; filter through `isRenderableHomeSection`; call `createPresetSection` and dispatch the existing `add-section` command. It owns no document mutation and accepts no HTML/CSS input.
- [ ] **Step 6: Add `SettingGroups`.** Partition controls by `definition.group` in fixed order Content, Layout, Style, Advanced; omit empty groups; pass every control to the existing generic `ControlRenderer`.
- [ ] **Step 7: Add controlled focus support to `ControlRenderer`.** Accept an optional `{ key, requestId }`; use an input ref plus `useEffect` keyed by `requestId` to focus only the requested schema field. Do not use `contenteditable`.
- [ ] **Step 8: Add responsive CSS grid behavior.** Desktop uses left / flexible center / right columns. At narrow admin widths, stack the inspector after the preview while preserving all landmarks and keyboard access; do not change storefront responsive CSS.
- [ ] **Step 9: Run focused component tests, then `npm test -- src/features/store-editor`.**
- [ ] **Step 10: Commit.** `feat: add persistent grouped store editor workspace`

**Acceptance criteria:** Selecting any section, block, or theme leaves the complete hierarchy visible; controls are generic and grouped; existing Save/Publish/device/undo behavior remains available.

## Task 4: Add accessible section and block drag-and-drop

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/store-editor/components/sortable-tree-row.tsx`
- Modify: `src/features/store-editor/components/section-tree.tsx`
- Modify: `src/app/globals.css`
- Test: `src/features/store-editor/components/section-tree.test.tsx`
- Test: `src/features/store-editor/model/commands.test.ts`

**Dependency:** Add `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^8.0.0`, and `@dnd-kit/utilities@^3.2.2`. Use the stable React sortable API, `PointerSensor` with an activation distance, `KeyboardSensor` with `sortableKeyboardCoordinates`, and a dedicated drag handle. dnd-kit documents its sortable keyboard coordinate getter and keyboard sensor behavior. [Sortable documentation](https://dndkit.com/legacy/presets/sortable/overview/)

**Existing functionality reused:** `move-section` and `move-block` already create immutable history entries and retain keyboard move buttons.

**Interfaces:**

```ts
type SortableTarget =
  | { kind: "section"; region: RegionName; sectionId: string }
  | { kind: "block"; region: RegionName; sectionId: string; blockId: string };

function commandForDrop(
  document: StorefrontDocument,
  active: SortableTarget,
  over: SortableTarget,
): EditorCommand | null;
```

- [ ] **Step 1: Write failing pure tests for `commandForDrop`.** Assert a same-region section drop produces `move-section` with the target index; a same-section block drop produces `move-block`; cross-region and cross-section drops return `null`; same-position drops return `null`.
- [ ] **Step 2: Run the focused tests; confirm the helper is missing.**
- [ ] **Step 3: Implement the pure drop helper adjacent to `SectionTree`.** Encode stable IDs as `section:<region>:<sectionId>` and `block:<region>:<sectionId>:<blockId>`; decode them without DOM index data.
- [ ] **Step 4: Add `SortableTreeRow`.** Attach dnd-kit listeners only to an accessible labelled drag-handle button, leave row-selection and action buttons independent, provide a visible focus ring, and render drag state without changing document data.
- [ ] **Step 5: Add separate sortable contexts.** Sections may reorder only within their current Header/Template/Footer region. Blocks may reorder only within their current section. Dispatch the helper’s existing move command on `onDragEnd`; do not mutate lists locally.
- [ ] **Step 6: Verify pointer, touch, and keyboard behavior.** Use an 8px pointer activation distance so normal clicks select; set `touch-action: none` on the handle only; retain existing Move up/Move down buttons; provide screen-reader instructions for pick up, move, drop, and cancel.
- [ ] **Step 7: Add component tests for drag handle labels and retained move buttons; add one Playwright drag-reorder flow that verifies undo restores the original order.**
- [ ] **Step 8: Run focused unit/component/e2e tests.**
- [ ] **Step 9: Commit.** `feat: add accessible store editor reordering`

**Acceptance criteria:** Mouse, touch, and keyboard can initiate a reorder through a handle; reorder uses stable IDs and existing history; move buttons remain visible and functional.

## Task 5: Add block-level preview selection and text-to-field focus

**Files:**
- Modify: `packages/storefront-renderer/src/types.ts`
- Modify: `packages/storefront-renderer/src/section-renderer.tsx`
- Modify: `packages/storefront-renderer/src/sections/hero.tsx`
- Modify: `packages/storefront-renderer/src/sections/rich-text.tsx`
- Modify: `src/features/store-editor/model/types.ts`
- Modify: `src/features/store-editor/state/types.ts`
- Modify: `src/features/store-editor/state/reducer.ts`
- Modify: `src/features/store-editor/components/editor-shell.tsx`
- Modify: `src/features/store-editor/components/inspector/inspector.tsx`
- Test: `packages/storefront-renderer/src/storefront-renderer.test.tsx`
- Test: `src/features/store-editor/components/editor-shell.test.tsx`

**Existing functionality reused:** editor-only `data-editor-section-id`, stable block IDs, shared renderer mode, and inspector block controls.

**Interfaces:**

```ts
export interface RendererSelection {
  kind: "section" | "block" | "theme";
  region?: RegionName;
  sectionId?: string;
  blockId?: string;
  fieldKey?: string;
}

export type FocusRequest = { key: string; requestId: number };
```

- [ ] **Step 1: Write failing renderer tests.** In editor mode, Hero heading/text/button and Rich text block output must include stable `data-editor-block-id`; heading/text carry `data-editor-field-key="text"` and button label carries `data-editor-field-key="label"`. Published mode must not output editor metadata.
- [ ] **Step 2: Write failing shell tests.** Clicking a preview Hero heading selects the matching block, opens its inspector, and focuses the `Heading` input. Repeating the click must focus it again. Clicking a section background selects its section.
- [ ] **Step 3: Add editor-only block data attributes in the two existing renderers.** Do not change their public markup semantics, text content, styling, or add `contenteditable`.
- [ ] **Step 4: Update `SectionRenderer` click delegation.** Find the closest editor block attribute inside the selected section wrapper; emit a block selection with IDs and optional field key. Fall back to section selection. Always use IDs from attributes, never child index.
- [ ] **Step 5: Add a reducer-generated focus request.** A preview selection with `fieldKey` sets a monotonically increasing `requestId`; hierarchy selection has no focus request. Pass it through Inspector → SettingGroups → ControlRenderer.
- [ ] **Step 6: Run focused renderer and shell tests.**
- [ ] **Step 7: Commit.** `feat: select preview blocks and focus schema fields`

**Acceptance criteria:** Preview clicks select stable section/block identity; supported text clicks focus the matching generated inspector field; published output has no editor interaction attributes.

## Task 6: Connect autosave, conflict recovery, and predictable manual actions

**Files:**
- Modify: `src/features/store-editor/state/autosave-controller.ts`
- Modify: `src/features/store-editor/state/autosave-controller.test.ts`
- Create: `src/features/store-editor/state/use-storefront-autosave.ts`
- Create: `src/features/store-editor/state/use-storefront-autosave.test.tsx`
- Modify: `src/features/store-editor/state/types.ts`
- Modify: `src/features/store-editor/state/reducer.ts`
- Modify: `src/features/store-editor/components/editor-shell.tsx`
- Modify: `src/features/store-editor/components/editor-toolbar.tsx`
- Modify: `src/features/store-editor/api/client.ts`
- Modify: `src/features/store-editor/api/types.ts`
- Modify: `src/app/admin/store-design/page.tsx`
- Test: `src/features/store-editor/components/editor-shell.test.tsx`
- Test: `e2e/store-editor.spec.ts`

**Existing functionality reused:** existing 700ms controller, optimistic `expectedRevision`, `DraftConflictError` API representation, Save/Publish ordering, and `loadDraft` client method.

**Interfaces:**

```ts
export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict" | "publishing" | "published";

export function useStorefrontAutosave(input: {
  document: StorefrontDocument;
  revision: number;
  save(document: StorefrontDocument, revision: number): Promise<number>;
  onSaved(revision: number): void;
  onConflict(): void;
  onError(): void;
}): { flush(): Promise<void>; retry(): Promise<void>; dispose(): void };
```

- [ ] **Step 1: Write failing controller/hook tests.** Edit once and advance 700ms: save receives the latest document and revision. Edit during a save: a second save uses the later snapshot. Network error exposes Retry. `DRAFT_CONFLICT` exposes Conflict and makes no retry/overwrite request. Flush waits before Publish.
- [ ] **Step 2: Run focused tests; confirm the controller cannot represent `conflict` or bind current React values.**
- [ ] **Step 3: Extend the controller with typed error classification.** Preserve dirty local state on error; classify a draft conflict separately; prevent automatic retry after a conflict. Do not alter backend revision behavior.
- [ ] **Step 4: Implement the hook using refs for latest document and revision.** Instantiate once, call `changed()` only after a document-changing reducer action, update revision after save, and dispose on unmount. Never save selection/device changes.
- [ ] **Step 5: Wire EditorShell.** Manual Save calls `flush()`. Publish first flushes, then invokes existing `onPublish` with the returned revision. Add `onReloadDraft` prop and use `api.loadDraft` from the page to replace local history only after the merchant chooses Reload.
- [ ] **Step 6: Extend the toolbar recovery UI.** Show `Saving…`, `Saved`, `Unsaved`, `Could not save — Retry`, and `Draft changed elsewhere — Reload latest`. Keep Save and Publish disabled only during active save/publish, not merely while dirty.
- [ ] **Step 7: Add Playwright coverage:** edit text, wait for autosave, confirm public storefront is unchanged, publish, confirm public storefront changes; separately simulate a 409 and confirm no automatic overwrite occurs.
- [ ] **Step 8: Run focused tests and full `npm test`, `npm run typecheck`, and `npm run test:e2e`.**
- [ ] **Step 9: Commit.** `feat: autosave store editor drafts safely`

**Acceptance criteria:** Debounced edits save the current immutable document; Save and Publish flush pending work; conflicts require an explicit reload; drafts remain private until Publish.

## Task 7: Regression, accessibility, and visual verification

**Files:**
- Modify: `e2e/store-editor.spec.ts`
- Modify: `src/features/store-editor/components/editor-shell.test.tsx`
- Modify: `packages/storefront-registry/src/presets.test.ts`
- Modify: `design-qa.md`
- Create: `store-editor-phase-1-qa.png`

**Existing functionality reused:** Vitest workspace, Playwright runner, screenshot QA workflow, prior Store Editor end-to-end coverage, and desktop/tablet/mobile preview controls.

- [ ] **Step 1: Add an end-to-end merchant journey.** Select a preset category, add a supported preset, select a preview heading, edit the focused field, drag-reorder, undo, autosave, then publish; assert the public page changes only after publication.
- [ ] **Step 2: Add accessibility assertions.** Verify tree/preview/inspector landmarks, labelled drag handles, visible keyboard move controls, status live region, and no keyboard trap in the preset dialog.
- [ ] **Step 3: Capture desktop and mobile editor states.** Compare the desktop three-pane shell to the approved Shopify-style reference and inspect mobile stacking without clipped controls or overlapping panels.
- [ ] **Step 4: Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`.** Record test counts and non-error warnings in `design-qa.md`.
- [ ] **Step 5: Commit.** `test: verify phase one store editor workflow`

**Acceptance criteria:** All automated checks pass; the editor is usable by pointer, touch, and keyboard; preview/public fidelity and private-draft behavior remain intact.

## Plan self-review

- Scope coverage: Tasks 1–2 cover presets/parity; Task 3 covers persistent panes and grouped generic controls; Task 4 covers drag plus keyboard reordering/history/touch; Task 5 covers stable preview selection and focused text fields; Task 6 covers debounced save/conflicts/predictable publish; Task 7 covers end-to-end, accessibility, and visual QA.
- Exclusions: The plan deliberately excludes v3 documents, multi-template selection, Tiptap, arbitrary HTML/CSS, Puck/GrapesJS, and renderer rewrites.
- Maintainability: `SectionTree`, `SortableTreeRow`, `PresetPicker`, `SettingGroups`, and `useStorefrontAutosave` prevent `EditorShell`, `PageHierarchy`, and `Inspector` from becoming multi-responsibility files.
