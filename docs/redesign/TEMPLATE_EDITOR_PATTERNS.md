# Shopify theme editor: patterns to adopt (structure only)

Source: Shopify's public help pages for the theme editor (Online Store › Themes › Customize) and the earlier study in `docs/reports/2026-11-01-theme-editor-shopify-gap-analysis.md`. Structure and workflow only; the Jelly look stays.

| Pattern | Shopify | Jelly decision |
| --- | --- | --- |
| Three areas | Outline on the left, preview in the middle, settings of the selection on the right | **Adopt.** The outline never disappears; settings get their own column |
| Top bar | Theme name, page selector, device buttons, undo/redo, one Save button | **Adopt, simpler**: Jelly autosaves, so the bar shows the save state ("All changes saved") and one primary **Publish** button. "Save now" stays in ⋯ for people who want it |
| Page groups | Header, Template, Footer as separate groups; header/footer sections are shared ("section groups") | **Adopt**: Header group (announcement bar, header), Template, Footer group, each with its own "Add section" |
| Outline rows | Icon, name, eye on hover, drag handle; blocks nested and collapsible; "Add block" at the end of each section | **Adopt, more visible**: eye always shown for hidden items, a ⋯ menu with Duplicate / Hide / Move / Delete, full block names on hover |
| Add section | Popover with search, grouped by purpose, a preview image on hover | **Adopt**: search, purpose groups (Banners, Products, Text, Images and video, Trust and reviews, Store info, Layout last), a sketch for every item, one click adds and selects |
| Selection | Hover in preview outlines a section with its name; click selects and opens its settings; outline follows | **Keep** (already built) and make the outline scroll to and highlight the selection |
| Settings panel | Title with the section/block name, settings in headed groups, "Remove section" at the bottom | **Adopt**: breadcrumb (Hero banner › Heading) with back, groups Content → Layout → Style, Advanced closed, Remove at the bottom |
| Theme settings | Separate gear in the left rail | **Adopt with a label**: "Theme settings" button in the top bar |
| Images | Thumbnail with Change / Remove, alt text under it | **Keep** (already close); alt text and "decorative" fold under the image |
| Colours | Colour schemes, custom colours per scheme | **Keep** schemes; swatches from the theme palette plus custom (already built) |
| Empty states | "Add block" prompt; blank page message | **Adopt** with short next steps |
| Onboarding | None by default | **Add** a 4-step dismissible tour (select in preview, outline, settings, publish) |

Left out on purpose: Shopify's app blocks panel and app embeds (Jelly has its own Apps section), the theme code editor, and the separate "Theme actions" menu (Jelly's ⋯ already holds Check changes, Compiled preview, Version history).
</content>
</invoke>
