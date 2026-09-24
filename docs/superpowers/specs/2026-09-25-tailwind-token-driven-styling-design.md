# Incremental Tailwind Styling with V4 Theme Tokens

**Date:** 2026-09-25
**Status:** Design approved in conversation; awaiting written-spec review

## Goal

Move storefront and editor layout/styling toward Tailwind CSS incrementally, beginning with the editor and shared storefront layout primitives, without replacing the V4 theme-token architecture or changing how Fresh Market and Artisan Boutique share renderers.

## Constraints

- Use Tailwind CSS for layout and styling in components as they are migrated.
- Preserve the existing V4 theme-token definitions and CSS-variable resolution path.
- Never hard-code theme-specific colors, radii, typography, spacing, container widths, shadows, or other theme values in Tailwind classes.
- Express theme-specific values through the existing CSS variables/tokens (for example, utilities referencing `var(--jelly-...)` or the existing shared-shell `var(--store-...)` values).
- Do not perform a repository-wide CSS rewrite.
- Keep `globals.css` limited to genuine global/base behavior as the migration progresses. Do not add new component-specific storefront/editor rules there.
- Fresh Market and Artisan Boutique continue to use shared V4 renderers and receive their distinct presentation from their own token definitions.
- Do not change the V4 compiler, workspace model, renderer contracts, publication pipeline, active-publication behavior, public runtime, or route architecture.
- Preserve all pre-existing dirty work. Only files/hunks explicitly reviewed as part of this styling slice may be staged.

## Current structure

- The V4 renderer is in `jellyshops/packages/storefront-renderer`. Its root exposes `data-jelly-theme`, and its active theme values are available through the existing `--jelly-*` variables.
- Shared V4 section presentation currently uses `.jelly-*` rules in `jellyshops/src/app/globals.css`, including a small `[data-jelly-theme="fresh-market"]` presentation layer. Those rules are not part of the first layout-primitives slice unless a touched component requires moving one.
- The older shared theme shell is implemented in `jellyshops/src/components/storefront-shell.tsx` and `store-header.tsx`. It resolves a theme shell and uses the existing `--store-*` theme values; it currently mixes Tailwind utilities and global component selectors.
- The editor is implemented in `jellyshops/src/features/store-editor`. Its shell and preview already use Tailwind for much of their layout, with some literal neutral values and legacy descendant selectors remaining.
- Fresh Market and Artisan Boutique have independent token definitions. The theme-specific values are not inherited from one another.

## Design

### Styling boundary

Tailwind classes should own component layout, alignment, responsive behavior, spacing structure, and interaction states. Theme appearance must continue to come from the active theme's CSS-variable values. A component may use a Tailwind arbitrary-value utility that references a token, such as `bg-[var(--jelly-color-background)]`; it must not encode Fresh Market or Artisan Boutique values directly in a class string.

Platform editor surfaces may use platform semantic tokens because they are not storefront theme values. Do not couple the editor's panels or controls to either storefront theme.

Keep the V4 `--jelly-*` and shared-shell `--store-*` namespaces distinct during this migration. Do not introduce a new theme model or merge these contracts as incidental cleanup.

### First migration slice

1. **Editor layout:** normalize the editor frame, panel navigation, section panel, preview frame, and settings panel layout to Tailwind utilities. Use platform semantic tokens for editor chrome and preserve the established desktop/tablet/mobile behavior and component interactions.
2. **Shared storefront layout primitives:** migrate the shared layout wrapper, header, footer, and cart presentation from component-specific global selectors to Tailwind utilities. Keep dynamic theme colors, fonts, borders, radii, and surfaces bound to the existing shared-shell CSS variables.
3. **V4 integration boundary:** do not rewrite registered section renderers or their CSS in this first slice. Keep their shared-renderer behavior and theme-token inputs unchanged. As a renderer file is touched in a later slice, move only its relevant component styling out of `globals.css` and into Tailwind/component-local styling.
4. **Global stylesheet:** remove a global component rule only when the corresponding component no longer relies on it. Do not bulk-delete or reformat unrelated global rules. Retain resets, base element behavior, theme token declarations/resolution, and genuinely global accessibility behavior such as reduced-motion support.

### Theme isolation

- Fresh Market continues to use its own colors, typography, spacing, radii, container width, and shadow tokens.
- Artisan Boutique continues to use its own existing values and must not inherit Fresh Market-specific styling.
- Shared header/footer/layout components may consume active theme variables, but must not branch on a theme ID to render a separate theme-specific component.
- No new literal Fresh Market or Artisan Boutique values may be added to Tailwind class lists or global component selectors.

### Compatibility and behavior

- Preserve component props, DOM responsibilities, navigation behavior, cart behavior, editor selection, autosave, preview dimensions, Validate, Preview, and Publish callbacks.
- Preserve semantic landmarks and accessible labels, visible keyboard focus, reduced-motion behavior, and existing responsive controls.
- Keep the shared V4 renderer identical between editor preview and published storefront.
- Maintain commerce readability and usability; styling changes must not obscure price, availability, variants, quantity, totals, or primary actions.

## Verification design

For each migrated component group:

- Add or update focused component tests for retained behavior and semantic controls.
- Verify Fresh Market and Artisan Boutique both resolve their own theme variables while sharing the same renderer/layout primitives.
- Check editor panels and preview at desktop, tablet, and narrow mobile widths.
- Check shared storefront header, footer, and cart presentation at desktop and narrow mobile widths, including keyboard focus and long store names/navigation.
- Search touched components for remaining component-specific global selectors and confirm they are either still required by untouched components or removed safely.
- Run focused tests, TypeScript, the relevant frontend build, and the existing responsive browser gate when the final verification step is authorized.
- Inspect `git diff --check` and stage only explicitly attributed hunks; leave onboarding work, secrets, generated files, and unrelated changes untouched.

## Out of scope

- Repository-wide conversion of all CSS to Tailwind.
- Rewriting all `.jelly-*` V4 section renderers in this first slice.
- New or changed theme tokens, editor document models, theme architecture, renderer contracts, page types, sections, or routes.
- Any compiler, persistence, publication, or public-runtime changes.
- Redesign of Artisan Boutique or expansion of Fresh Market content/commerce capabilities.

## First review checkpoint

The next artifact after this design is reviewed is a bite-sized implementation plan for the editor and shared storefront layout primitives. No implementation begins until that plan is reviewed and an execution approach is selected.
