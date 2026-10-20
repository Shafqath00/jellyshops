# Token-Driven Tailwind Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Incrementally migrate the canonical online-store editor and shared storefront layout primitives to Tailwind while keeping Fresh Market and Artisan Boutique appearance driven by their existing theme tokens.

**Architecture:** Tailwind owns component layout, responsive behavior, and interaction presentation. Storefront theme appearance continues to flow through `resolveStorefrontThemeTokens()` and the existing `--jelly-*` / `--store-*` custom properties; the V4 renderer, compiler, workspace, and publication path do not change. Migrate only the editor and shared shell primitives in this plan, then remove only the global component selectors those migrated components no longer need.

**Tech Stack:** React, Next.js, TypeScript, Tailwind CSS v4, Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-tailwind-token-driven-styling-design.md`

## Global Constraints

- Use Tailwind CSS for layout and styling in components as they are migrated.
- Preserve the existing V4 theme-token definitions and CSS-variable resolution path.
- Never hard-code theme-specific colors, radii, typography, spacing, container widths, shadows, or other theme values in Tailwind classes.
- Express theme-specific values through the existing CSS variables/tokens (for example, utilities referencing `var(--jelly-...)` or the existing shared-shell `var(--store-...)` values).
- Do not perform a repository-wide CSS rewrite.
- Keep `globals.css` limited to genuine global/base behavior as the migration progresses. Do not add new component-specific storefront/editor rules there.
- Fresh Market and Artisan Boutique continue to use shared V4 renderers and receive their distinct presentation from their own token definitions.
- Do not change the V4 compiler, workspace model, renderer contracts, publication pipeline, active-publication behavior, public runtime, or route architecture.
- Preserve all pre-existing dirty work. Only files/hunks explicitly reviewed as part of this styling slice may be staged.

## File map

- `jellyshops/src/app/admin/online-store/editor/page.tsx` is the active Online Store editor route and owns the top toolbar, mobile panel switching, three-panel workspace, and preview wrapper.
- `jellyshops/src/features/store-editor/components/editor-panel-navigation.tsx` owns small-screen Sections/Preview/Settings controls.
- `jellyshops/src/features/store-editor/components/template-hierarchy.tsx` and `inspector/theme-settings-panel.tsx` own the editor's left hierarchy and global theme settings panel.
- `jellyshops/src/features/store-editor/components/preview-canvas.tsx` owns the responsive preview viewport frame.
- `jellyshops/src/components/storefront-shell.tsx` owns the shared legacy shell's layout, header, footer, and cart presentation. `storefront-frame.tsx` resolves the active theme and provides CSS variables; do not change that resolver/data flow.
- `jellyshops/src/app/globals.css` and `jellyshops/src/app/shadcn-theme.css` contain shared-shell selectors such as `.storefront`, `.store-header`, `.cart-button`, and `.store-footer`. Remove only rules made obsolete by migrated components.
- Existing tests: `editor-panel-navigation.test.tsx`, `template-hierarchy.test.tsx`, `theme-settings-panel.test.tsx`, `preview-canvas.test.tsx`, and the authenticated `e2e/starter-responsive.spec.ts`.
- Create `jellyshops/src/components/storefront-shell.test.tsx` for the shared shell primitives; keep the test focused on these components rather than routes or publication behavior.

## Review Focus

- **Theme leakage:** rendering either starter must use its own resolved `--store-*`/`--jelly-*` values while using the same renderer. Pin existing token isolation with the focused theme-token tests and the both-starter responsive gate in Task 3.
- **Narrow header:** long store names and navigation must not push the cart control outside the viewport. Pin semantic visibility/structure in the shared shell test and check 390px/320px in Task 3.
- **Editor preview sizing:** Desktop, Tablet, and Mobile controls must retain their 1440px, 820px, and 390px frames. Pin these in `preview-canvas.test.tsx` in Task 1.
- **Editor operations:** selecting Sections/Preview/Settings, selecting hierarchy entries, and changing theme settings must remain operable. Keep and extend the existing panel, hierarchy, and settings tests in Task 1.
- **Cart dismissal and focus:** the cart panel must retain dialog labeling, close-button behavior, backdrop dismissal, and visible focus. Pin these in `storefront-shell.test.tsx` in Task 2.

---

### Task 1: Normalize the canonical editor surfaces to Tailwind and platform tokens

**Files:**
- Modify: `jellyshops/src/app/admin/online-store/editor/page.tsx`
- Modify: `jellyshops/src/features/store-editor/components/editor-panel-navigation.tsx`
- Modify: `jellyshops/src/features/store-editor/components/template-hierarchy.tsx`
- Modify: `jellyshops/src/features/store-editor/components/inspector/theme-settings-panel.tsx`
- Modify: `jellyshops/src/features/store-editor/components/preview-canvas.tsx`
- Test: `jellyshops/src/features/store-editor/components/editor-panel-navigation.test.tsx`
- Test: `jellyshops/src/features/store-editor/components/template-hierarchy.test.tsx`
- Test: `jellyshops/src/features/store-editor/components/inspector/theme-settings-panel.test.tsx`
- Test: `jellyshops/src/features/store-editor/components/preview-canvas.test.tsx`

**Interfaces:**
- Consumes: current V4 editor state, `EditorPanel`, `EditorViewport`, theme settings schema, and the shared `PreviewCanvas` renderer.
- Produces: the same editor behavior and viewport widths with layout expressed in Tailwind and editor chrome using platform-level variables such as `--paper`, `--white`, `--ink`, `--ink-soft`, and `--line` where appropriate. These are platform/editor values, not storefront theme tokens.

- [ ] **Step 1: Add focused class and behavior assertions**

Extend the hierarchy and theme-settings tests to assert that editor panels use platform token-backed utility classes while preserving `aria-pressed`, accessible names, section selection, and settings callbacks. Keep the existing viewport test intact; it already pins `data-viewport` and `max-w-[1440px]`, `max-w-[820px]`, and `max-w-[390px]`.

Example assertion for the hierarchy surface:

```tsx
expect(screen.getByRole("complementary", { name: "Template hierarchy" }))
  .toHaveClass("bg-[var(--white)]");
```

- [ ] **Step 2: Run the focused editor tests and confirm the new style assertion fails first**

Run from `jellyshops`:

```text
npm run test:unit -- src/features/store-editor/components/editor-panel-navigation.test.tsx src/features/store-editor/components/template-hierarchy.test.tsx src/features/store-editor/components/inspector/theme-settings-panel.test.tsx src/features/store-editor/components/preview-canvas.test.tsx
```

Expected: existing behavior tests pass, and only the new token-backed class assertion fails before implementation.

- [ ] **Step 3: Migrate editor classes without changing editor behavior**

Replace editor-only literal neutral hex classes in the listed active-route/panel files with utilities referencing committed platform CSS variables, for example `bg-[var(--paper)]`, `text-[var(--ink)]`, `text-[var(--ink-soft)]`, `border-[var(--line)]`, and `bg-[var(--white)]`. Use existing Tailwind responsive/layout utilities for the editor grid and mobile panel behavior. Keep device widths and all editor callbacks unchanged. Do not use `--store-*` or `--jelly-*` for editor chrome.

- [ ] **Step 4: Rerun the focused editor tests**

Run the same `npm run test:unit -- ...` command from Step 2. Expected: selected panel state, hierarchy/settings operations, semantic labels, and all three preview dimensions pass.

- [ ] **Step 5: Review and commit only Task 1 hunks**

Inspect `git diff` for every listed file first because some are already dirty. Preserve all pre-existing hunks, stage only the editor styling/test changes with `git add -p` where a file contains unrelated edits, review `git diff --cached`, run `git diff --cached --check`, and commit:

```text
style: use platform tokens in online store editor
```

### Task 2: Migrate shared storefront layout primitives and remove their obsolete selectors

**Files:**
- Modify: `jellyshops/src/components/storefront-shell.tsx`
- Modify: `jellyshops/src/app/globals.css`
- Modify: `jellyshops/src/app/shadcn-theme.css`
- Create: `jellyshops/src/components/storefront-shell.test.tsx`
- Test: `jellyshops/packages/storefront-themes/src/storefront-theme-tokens.test.ts`
- Test: `jellyshops/packages/storefront-themes/src/theme-registry.test.ts`

**Interfaces:**
- Consumes: `SharedStorefrontLayout`, `SharedStorefrontHeader`, `SharedStorefrontFooter`, `SharedCartPresentation`, their existing prop types, and `resolveStorefrontThemeTokens()` called by `StorefrontFrame`.
- Produces: shared layout primitives styled with Tailwind, preserving existing shell variant behavior and consuming `--store-bg`, `--store-surface`, `--store-text`, `--store-accent`, `--store-display`, `--theme-border`, and `--theme-font-heading` as currently resolved. No theme-ID conditional rendering or theme-token changes are introduced.

- [ ] **Step 1: Create shared shell behavior tests before changing component classes**

Create a test file that renders the current exported shell primitives with typed fixture props. Cover: layout landmark order; header store identity, navigation, cart count, and `logo-centered`/`compact` variants; footer tagline and `simple`/`newsletter` variants; cart dialog name, close button, backdrop dismissal, and focus-visible class. Assert theme appearance is expressed through existing variable references, not Fresh Market/Artisan literal colors. Example fixture shape:

```tsx
const store = { name: "Fresh Market", slug: "fresh-market", tagline: "Good food, gathered well." };
const settings = { header: { variant: "logo-centered" }, footer: { variant: "simple" } };
```

- [ ] **Step 2: Run the focused shell and theme-token tests to capture the current behavior**

Run from `jellyshops`:

```text
npm run test:unit -- src/components/storefront-shell.test.tsx packages/storefront-themes/src/storefront-theme-tokens.test.ts packages/storefront-themes/src/theme-registry.test.ts
```

Expected: existing component semantics and token-definition assertions pass; the new shared-shell token-reference assertion fails against the current selector-based styling.

- [ ] **Step 3: Replace shared shell selector classes with token-backed Tailwind utilities**

In `storefront-shell.tsx`, express the root surface, header variants, navigation visibility, cart button, footer variants, and cart dialog as Tailwind classes. Use `var(--store-...)` or the existing theme semantic variables for dynamic storefront appearance; use utilities for structure and responsive behavior. Preserve the existing 720px mobile breakpoint with an arbitrary Tailwind breakpoint such as `max-[720px]:hidden` where needed. Leave `StoreHeader` untouched; repository usage inspection shows it is not used by the canonical shell.

- [ ] **Step 4: Remove only obsolete shared-shell CSS rules**

After the component classes no longer depend on them, remove only `.storefront`, `.store-header*`, `.cart-button*`, and `.store-footer*` declarations made obsolete by Task 2 from `globals.css` and `shadcn-theme.css`, including their directly related responsive declarations. Preserve all other selectors, including V4 `.jelly-*` section styling, Artisan-specific `.jelly-boutique-*` styling, global tokens/base rules, motion behavior, and unrelated dirty hunks. Before editing either dirty CSS file, inspect its complete current diff and make narrow context patches.

- [ ] **Step 5: Run the focused shell and theme-token tests**

Run the command from Step 2. Expected: the same shell behavior passes, both themes resolve distinct token sets, and the component assertions show the shared shell consumes variables.

- [ ] **Step 6: Confirm obsolete selectors are no longer needed by migrated components**

Run:

```text
rg -n 'store-header|store-footer|cart-button|className="storefront"' src/components/storefront-shell.tsx src/app/globals.css src/app/shadcn-theme.css
```

Expected: no migrated component retains the removed selector dependency; any remaining selector match is documented as belonging to an untouched component before continuing.

- [ ] **Step 7: Review and commit only Task 2 hunks**

Inspect all three diffs, stage only the shell migration and matching obsolete-rule removals (use `git add -p` for dirty files), review `git diff --cached`, run `git diff --cached --check`, and commit:

```text
style: migrate shared storefront shell to token-backed Tailwind
```

### Task 3: Verify the incremental styling slice across both starters

**Files:**
- Modify: `jellyshops/e2e/starter-responsive.spec.ts` only if required assertions are missing
- Test: `jellyshops/e2e/starter-responsive.spec.ts`
- Test: focused editor and shared-shell suites from Tasks 1 and 2
- No compiler, route, persistence, publication, or V4 renderer implementation changes

**Interfaces:**
- Consumes: the existing authenticated responsive fixture, Fresh Market and Artisan Boutique stores, current V4 theme token resolver, editor preview controls, and public storefront renderer.
- Produces: evidence that the Tailwind component migration preserves both theme identities, editor dimensions, shared shell behavior, and responsive usability.

- [ ] **Step 1: Extend responsive assertions only where needed**

In the existing starter responsive suite, assert that both starters retain a visible store identity and cart access, do not overflow horizontally, and keep their shared header/footer present at 1440px, 820px, 390px, and 320px. Preserve theme-specific assertions so Fresh Market continues to use its own resolved values and Artisan Boutique remains on its own tokens.

- [ ] **Step 2: Run focused unit tests**

Run the combined editor, shared-shell, and theme-token suites listed in Tasks 1 and 2. Expected: all interaction, accessibility, token-isolation, and viewport assertions pass.

- [ ] **Step 3: Run the authenticated responsive gate for both starters**

Run from `jellyshops`:

```text
npm run test:e2e -- e2e/starter-responsive.spec.ts
```

Expected: Fresh Market and Artisan Boutique pass at 1440px, 820px, 390px, and 320px without horizontal overflow or clipped header/cart controls.

- [ ] **Step 4: Run TypeScript and the frontend production build**

Run from `jellyshops`:

```text
npm run typecheck
npm run build
```

Expected: both commands complete successfully without changing unrelated generated files; leave `next-env.d.ts` and all unrelated user changes unstaged.

- [ ] **Step 5: Complete the scoped final review**

Run `git diff --check`, inspect `git status --short`, confirm no theme-specific literal values were added to Tailwind classes, confirm removed global selectors are used by no migrated component, and confirm the compiler/publication/runtime files were not changed. Report any pre-existing failures separately.

## Scope boundary

This plan does not migrate V4 section renderers (`hero`, Product, Collection, Cart, Search, Page, Blog, Article, Not Found) from their existing `.jelly-*` styling. Those will be migrated only in later, individually scoped component slices. It does not touch the unused `StoreHeader`, the legacy `EditorShell`, or unrelated global/admin UI.
