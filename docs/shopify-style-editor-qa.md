# Shopify-style editor: signed-in check

Everything in the editor plan (`docs/plans/shopify-style-editor.md`, phases 1-8) was built and unit-tested without a signed-in
session. The storefront side (what shoppers see) was also checked on `/theme-preview/*`, but the editor itself, saving, and
the live store have not been tried by a person. Do this once, on staging, with a test store.

Automated version: `JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/editor-tools.spec.ts e2e/store-editor.spec.ts e2e/template-library.spec.ts`
(needs `JELLY_E2E_EMAIL` / `JELLY_E2E_PASSWORD` for the dedicated test merchant). Not yet run.

## Before you start

- Backend on port 3001 pointing at staging, frontend started as in `CLAUDE.md` (port 3200), signed in as the test merchant.
- Open `/admin/online-store/editor`, pick the Home page.

## Checks

1. **Add and style a section.** Add section > Custom content. Open its settings: colour scheme, own colours, heading size, alignment, space above/below, width. Preview updates as you change them.
2. **Block settings.** Select the heading block: text style (Heading 1-4), text colour, background, border, corner radius, padding per side, max width, width. Button block: style, size, hover, colours, new tab. Add an Image and a Video block (YouTube link, `.mp4` link).
3. **Heading text.** In the Heading field: bold, italic, underline, a link, a colour, a size. The preview heading shows them. Type in the preview directly: the plain text wins and the formatting is dropped for that edit only.
4. **Text blocks.** Same toolbar plus paragraph styles, alignment, lists.
5. **Groups.** Add content block > Group. Add block to group. Direction row/column, alignment, gap, background. In the tree the group's blocks sit one step in.
6. **Toolbar and shortcuts.** Click a block in the preview: the toolbar shows move up/down, duplicate, hide, delete, and move into/out of a group. Ctrl+Z / Ctrl+Shift+Z, Ctrl+S, Ctrl+D, Delete, Escape.
7. **Tree follows the preview.** Click a block in the preview: its section opens in the left tree and scrolls into view.
8. **Phone values.** Switch the preview to Mobile. Settings marked "(phone)" show the desktop value underneath. Change top padding, alignment, heading size, group direction. Switch back to Desktop: desktop values are unchanged. Choose "Same as desktop": the phone value disappears.
9. **Show on.** Set a block to "Phones only": it disappears on Desktop (toolbar says "not shown at this width") and shows on Mobile. Same for a section.
10. **Theme settings.** Text styles (Heading 1-4, Body, Small), four colour schemes, button size/case/border/hover. Sizes change site-wide; a section using Colour scheme 2 picks up scheme 2's colours.
11. **Save and restore.** Make an edit and, before "Saved" appears, close the tab (or switch the network off in dev tools and edit). Reopen the editor: a "Restore your last session" banner offers the change. Restore saves it; Discard drops it. After a normal save and reload there is no banner.
12. **Publish and live store.** Publish. Open the live store in another tab: the section, groups, formatting, phone values (resize the window below 768px) and "Show on" all match the preview. Unpublished edits do not appear before Publish.
13. **Clean up.** Delete the test section(s).

## Known gaps

- Collection descriptions are plain text (rich text needs a database column and the collection form).
- The selected section is not in the page address.
- Input field styling in theme settings is not built.
- Phone values exist only for the settings listed in the plan (heading size, alignment, padding, text style, group and custom content direction and gap).
- Blocks move between a section and a group with toolbar buttons, not by dragging.
