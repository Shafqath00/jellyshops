# Store template editor: UX audit (2026-11-14)

Editor at `/admin/online-store/editor`, code in `jellyshops/src/features/store-editor/` (layout in `components/workspace/`, logic in `hooks/`). Reviewed signed in on staging store "new" (Resthaven design) plus the owner's screenshots (`screenshots/before-editor-*`).

## How it works today (data and saving, unchanged by the redesign)

- A page template is a list of sections; a section has settings and blocks; blocks can hold blocks (groups, up to 3 levels); some sections also expose "parts" (elements such as a hero's small heading or image) that can be selected on their own. Header, footer and announcement bar are shared ("global") sections.
- Every change is saved to the draft automatically through a save queue (`state/revisioned-save-queue.ts`) and shown in the live preview at once. Publish makes the draft live. Undo/redo keep a history per page.
- The preview is the real storefront renderer; clicking in it selects the innermost part, block or section; a floating toolbar on the selection offers move, duplicate, hide, delete and drag.

## Layout today

```
[Back][Sections][Theme settings]   Resthaven  Home page ▾  Home page   [inspector][desktop][tablet][phone] [undo][redo] ● Saved [⋯] [Save draft][▾]
┌────────── 300px ──────────┐┌──────────────────────── preview ────────────────────────┐
│ outline  OR  settings     ││                                                          │
│ (one replaces the other)  ││                                                          │
└───────────────────────────┘└──────────────────────────────────────────────────────────┘
```

## Tasks and steps today

Counted from the page as it opens, desktop, Resthaven home page. "Screens" = how many times the left column changes what it shows.

| Task | Steps today | Screens | What gets in the way |
| --- | --- | --- | --- |
| Add a section | 3–4 (scroll the outline to the bottom of the list, + Add section, pick) | 2 | The Header group's "+ Add section" sits above the template and reads like the main one; the library has generic icons for most types and starts with Spacer/Divider |
| Edit a heading | 2 (click it in the preview, type) — or 3 from the outline (expand section, click block, type) | 2 | The outline disappears; to edit something else you go back ("Back to section settings", then back again) |
| Change an image | 4 (click the image, Replace, choose in picker, confirm) | 2 | Fine once found; alt text and "Decorative image" sit between other settings |
| Reorder a section | 1 drag (handle only shows on hover) or 2 (select, arrow in the floating toolbar) | 0–1 | Handle invisible until hover |
| Hide a section | 1 hover-click in the outline, or 2 (select, eye in toolbar) | 0–1 | Eye only shows on hover |
| Duplicate a section | 2 (select, Duplicate in the floating toolbar) | 1 | Not in the outline at all |
| Delete a section | 2 (hover, bin) or 2 (select, bin in toolbar) | 0–1 | No ⋯ menu; actions scattered between outline hover and preview toolbar |
| Change a section's colours | 3 (select, open "Section" group, pick colour scheme); own colours 5 (… Advanced, toggle, pick) | 1 | Colour scheme names only; Advanced is long |
| Change theme colours/fonts | 2 (unlabelled sliders icon, pick a group) | 1 | Icon-only button; easy to miss |
| Switch device | 1 | 0 | Fine |
| Undo / redo | 1 | 0 | Fine (Ctrl+Z works too) |
| Save | 0 (autosaves) — but a big "Save draft" button suggests otherwise | 0 | Two save signals ("Saved" dot and "Save draft") confuse |
| Publish | 2 (the small ▾ beside Save draft, Publish) | 0 | The most important action is hidden behind an arrow |
| Get back to the page outline from a block | 2 (Back, Back) or click the layers icon | 2 | You lose your place each time |

## What is confusing (by priority)

1. **One column for two jobs.** Selecting anything swaps the outline for settings, three levels deep (section → block → part). New users lose their place and can't see the page structure while editing.
2. **Publish is hidden; "Save draft" looks like the main action** although changes already save themselves.
3. **Icon-only top bar** (layers, sliders, cursor): no words for "Sections", "Theme settings", "Select in preview".
4. **Outline rows hide their actions** (drag, hide, delete appear on hover; no duplicate, no ⋯ menu). Shared sections show a tiny "Global" tag; the announcement bar sits inside "Template" though it is part of the header area.
5. **Block names are cut off and icons are generic** ("Heading: Sleep …", a "T" icon for an image).
6. **Section picker**: generic icons for most types, rarely used layout helpers first, sketches only for a few presets.
7. **Settings mix content and style**: a heading block opens a text toolbar with colour and size, then Width Fit/Fill and Show on, with little grouping; "Dynamic source" boxes sit directly under fields.
8. **No guidance**: nothing tells a first-time user to click the preview, and an empty section does not suggest adding a block.

## What already works and must stay

Live preview with click-to-select; floating toolbar; drag on the preview; autosave with save queue and conflict handling; undo/redo per page; restore last session; phone/tablet values; element (part) selection; translations; shared sections; publish checks, version history.
</content>
</invoke>

## After the redesign (2026-11-14)

Layout now: outline on the left (always visible), live preview in the middle, settings of the selection on the right (from 1024px; below that the existing Outline / Preview / Settings tabs). Top bar: page picker, labelled "Theme settings", device buttons, undo/redo, "All changes saved", ⋯ (Save now, Check changes, Compiled preview, Version history, Show the editor tour) and **Publish**.

Measured in the signed-in editor on staging store "new" (draft only; the test section was removed again afterwards; nothing was published).

| Task | Before (steps / column changes) | After (steps / column changes) | Checked how |
| --- | --- | --- | --- |
| Add a section | 3–4 / 2 | **2 / 0** (Add section in the empty settings panel or under the list, pick; the new section is selected with its settings open) | Done: "Hero: Text only" added, selected, saved |
| Edit text | 2 from preview, 3 from outline / 2 | **2 / 0** (select, type) — the outline stays in view | Done: typed into the new section, preview updated |
| Change colours | 3 / 1 | **2 / 0** (select, pick colour scheme) | Done: scheme 2 applied, preview `data-scheme="scheme2"` |
| Hide | 1 hover-click / 0 | 1 / 0, and a hidden item keeps its eye visible | Done |
| Reorder | 1 drag or 2 / 0–1 | 1 drag, or 2 (⋯, Move up) / 0 | Done: Move up |
| Duplicate | 2, only from the preview toolbar / 1 | **2 (⋯, Duplicate) / 0**, the copy is selected | Done |
| Delete | 2 / 0–1 | 2 (⋯ Delete, or Remove section at the bottom of the settings) / 0 | Done (Remove section) |
| Change an image | 4 / 2 | 3 (select, Replace, choose) / 0; position, fit and decorative are folded under the image | Not swapped on staging (would change the real draft); counted from the panel |
| Switch device | 1 | 1 | Done: preview 390px on Mobile, back to desktop |
| Undo / redo | 1 | 1 | Done: Undo removed the duplicate |
| Save | 0 (autosave) with a confusing "Save draft" button | 0, with "All changes saved" / "Saving…"; Save now in ⋯ | Watched the status change |
| Publish | 2 (hidden behind ▾) | **1** (Publish button) | Button checked, not pressed (would make the draft live on staging) |
| Back to the outline from a block | 2 / 2 | **0** (the outline never leaves) | — |
| Theme colours and fonts | 2, unlabelled icon | 1 labelled button ("Theme settings") | — |

Also new: breadcrumb at the top of the settings ("Home page › Hero banner › Heading", each part clickable), section and block icons by kind, a ⋯ menu on every outline row, "Shared" instead of "Global", picker groups in order of use with a sketch or icon for every choice, "Use store data" link instead of "Dynamic source" boxes, an empty settings panel that explains what to do, and a 4-step first-time tour.

Widths: desktop 1536px (outline 280, preview ~900, settings 340); 820px and 390px use the tabs, no sideways scroll, Publish visible.

Not done / limits:
- The announcement bar is still listed under Template: moving it into the Header group changes the selection's region, which saving relies on.
- No screenshots of the editor: Chrome times out capturing this page (the same happened during the audit); before pictures are the owner's.
- Publish was not pressed and an image was not replaced on staging, to keep the real draft and live store unchanged.
