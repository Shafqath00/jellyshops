# Shopify-style theme editor: gap analysis and plan

Started 2026-10-30. Follows the editor simplification phases 1-3 (page picker, section style settings, rich text).

## What Shopify's editor does (studied 2026-10-30)

Seen in the user's Shopify store (theme "Tinker") and the user's screenshots. Chrome screenshots froze part-way, so the theme settings panel and the add-block picker were not opened this time.

- **Sidebar tree** grouped Header / Template / Footer. Sections expand to show blocks, and blocks nest (Product card > Media, Group > Product title, Price, Swatches). Each row shows an icon, a name with the block's own text ("Collection title – Make Your…"), and eye/delete buttons on hover. "Add block" sits inside every container, "Add section" inside every group.
- **Settings panel** opens under the tree for whatever is selected, with a `…` menu and a close button. Settings come in titled groups that are the same everywhere:
  - *Layout*: direction (vertical/horizontal), alignment (left/centre/right), position, gap (px), width (Page/Full for sections, Fit/Fill for blocks), max width, height.
  - *Typography*: a preset (Heading 1-6, Body…) with "Edit presets in theme settings".
  - *Appearance*: background colour (theme palette or custom), text colour with a "Default" swatch, overlay on/off + colour + solid/gradient.
  - *Borders*: style None/Solid, corner radius slider.
  - *Padding*: top, bottom, left, right, each a slider plus a px number box.
  - Media blocks: aspect ratio, "Displays media from parent product".
- **Controls**: segmented buttons for 2-3 choices, slider + number box with unit, colour field that can be empty ("Default"), toggles, selects with help text, rich text field (AI, text style, bold, italic, link, bullet and numbered lists) with a data-source button.
- **Preview**: hover and selection outline with a name tag ("Hero", "Media"); clicking any section or block selects it in the tree and opens its settings. A floating toolbar on the selected item: duplicate, hide, delete (plus Shopify's AI button). Section ID goes into the URL (`?section=…`).
- **Top bar**: exit, Sections / Theme settings / Apps tabs, theme name + status, page picker, AI, inspector toggle, device switch, undo, redo, `…`, Save with dropdown. "Restore last session?" banner when an editing session ended unsaved.

## What Jelly already has

Section and block add/remove/duplicate/hide/move commands (`model/commands.ts`), drag and drop in the tree (`template-hierarchy.tsx`, dnd-kit), click-to-select in the preview for sections and some blocks (`data-editor-section-id` / `data-editor-block-id` in the renderer), undo/redo, desktop/mobile preview, page picker, save + publish, theme settings (preset, fonts, heading scale, button style, corners, container width, section spacing, image ratio, product card options), 10 shared section style settings, rich text on description fields.

## Gaps (most visible first)

1. **Blocks have no style settings.** Only their content fields. Shopify gives every block layout, typography preset, colours, padding, borders.
2. **Coarse controls.** Spacing is none/small/large, sizes are named steps. No slider + px number, no per-side padding, colour fields show `#ffffff` when empty instead of "Default".
3. **No typography presets or colour schemes** in theme settings for blocks and sections to point at.
4. **Buttons and images are thin.** Button block = text + link; no style, size, colours, hover effect or new tab. No image block with ratio, radius, border.
5. **Preview interaction.** No floating toolbar on the selected item, not every block in every section is clickable, the tree does not jump to what was clicked.
6. **No nested blocks** (group, product card made of blocks). Needs a schema change.
7. **No mobile-only values** (padding, alignment, size, hide on mobile).
8. **Rich text gaps**: headings are plain text, the editor has no text size/colour, collection descriptions have no rich text column.
9. **No "restore last session"** for unsaved work.

## Phases

Each phase ends with tests, a commit and a report; the next starts only after the user agrees. Every new setting is optional and empty means "follow the theme", so saved and published stores look the same until a merchant changes something. Theme versions are never bumped.

1. **Precise controls and block styling.** *Done 2026-10-30.* New controls: slider + number with unit, padding box (4 sides), colour with "Default" empty state, segmented choices. Shared block style settings (width fit/fill, max width, typography preset, text colour, background, padding, corner radius, border) on heading, text, button and image-type blocks, turned into CSS variables by the renderer for preview and live store, styled in both themes. Sections get px padding top/bottom, Page/Full width and gap; old none/small/large values keep working.
2. **Theme settings like Shopify.** *Done 2026-10-30 (input field styling left for later).* Typography presets (Heading 1-6, Body, Small) with font, size, weight, line height, letter spacing, case. Named colour schemes (background, text, button, button text, border) that a section or block can pick. Button and input settings (radius, border, padding, hover effect).
3. **Buttons and media.** *Done 2026-10-30, plus a "Custom content" section that shows any blocks in order.* Button block: style (primary, secondary, text link), size, own colours, hover effect, full width, open in a new tab. Image block and video block: ratio, fit, focal point, radius, border, overlay.
4. **Preview interaction.** Hover outline + name tag for every section and block, every block selectable in every section, floating toolbar (move up/down, duplicate, hide, delete), tree expands and scrolls to the clicked item, keyboard shortcuts (Ctrl+Z/Ctrl+Y, Ctrl+S, Delete), selected section in the URL.
5. **Nested blocks.** `blocks` inside a block (group, product card), commands that address a block by path, nested tree with drag between levels, renderer and publish support, backend packages repacked. The largest and riskiest phase.
6. **Mobile values.** Mobile overrides for padding, alignment, text size and gap, "hide on mobile/desktop", shown when the preview is on Mobile.
7. **Rich text everywhere.** Headings with bold/italic/link, text size and colour in the rich text editor, collection descriptions (column + migration, asks before touching staging).
8. **Save, restore and QA.** Restore-last-session banner, save → reload → publish → live store check in the browser (the user signs in), Playwright coverage, docs. Folds in the earlier "editor simplification phase 4" browser QA.

## Constraints

- The editor page, `control-renderer.tsx`, `setting-groups.tsx` and `registry-section-renderer.tsx` hold another developer's uncommitted work. New code goes in new files; hookups in those files stay uncommitted, as in the earlier phases.
- Schema/registry/theme changes need `node scripts/prepare-shared-packages.mjs` and a backend reinstall.
- Out of scope unless asked: Shopify's AI ("Ask for changes"), the Apps tab, theme code editing.
