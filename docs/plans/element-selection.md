# Element-level selection in the theme editor

Requested 2026-11-07. Goal: a merchant clicks one heading, paragraph, button, image or product card in the
preview, sees only that element outlined, and gets only that element's settings in the side panel, like
Shopify's theme editor. It must work the same in every theme, so it lives in the shared registry, renderer and
editor, never in theme files.

## What exists already

- Sections and blocks are selectable (`data-editor-section-id`, `data-editor-block-id`), with a floating toolbar,
  outline (`data-editor-current`), tree sync and `?section=&block=` in the address.
- Gap: anything saved as a **section setting** (hero eyebrow and image, product list heading/intro/"View all",
  product cards, collection list heading, banner images, section intros that fall back to section settings) has
  no identity of its own. Clicking it selects the whole section and shows ~25 settings.
- No per-element styling for those parts (only section-wide heading/text styles).

## Model

1. **Element definitions** (registry, `section-elements.ts`): each section type lists its elements:
   `{ id, label, kind, controls }`. `kind` is `heading | text | button | link | image | product-card`.
   `controls` are the section setting keys that belong to the element (e.g. `viewAll` → `viewAllLabel`,
   `viewAllLink`). Merged into the definition in `prepareSection`, like variants.
2. **Element styles**: each element of a styleable kind gets generated settings saved on the section as
   `el_<elementId>_<prop>` (heading/text/link: colour, font, size, weight, alignment; button: background, text
   colour, corners, size; image: corners). Controls carry `element: <id>` so they show only in that element's
   panel, never in the section panel. Validated by a generated zod schema. Empty = follow the theme.
3. **Unique identity**: an element is addressed by `sectionId + elementId` (+ `elementIndex` for repeated
   elements such as product cards). Blocks keep their ids; an element may also sit inside a block later.
4. **Renderer**: `elementProps(section, elementId, editor)` returns the element's inline style plus, in the
   editor only, `data-editor-element`, `data-editor-element-label`. The section's click handler picks the
   innermost target (element inside block inside section). Every theme gets this because every theme uses the
   one renderer.
5. **Selection state**: `EditorSelection` section kind gains `elementId?` / `elementIndex?`; renderer selection,
   preview clicks, toolbar target, address (`&element=`), tree and inspector all read the same object.
6. **Inspector**: an element selection shows that element's content controls + its style controls, with a
   breadcrumb back to the section. A product card shows its section's card options and a button to the
   theme-wide card design (Theme settings › Product cards).
7. **Tree**: each section lists its elements (ones with content) above its blocks; selecting one highlights it
   in the preview and the reverse.
8. **Layout safety**: element styles are inline and limited to colour/type/corners/alignment (no widths,
   positions or display changes), so they cannot break the section grid; the design lint keeps checking.

## Phases

1. **Foundation + first sections** (this phase): model, styles, renderer helper, click/outline, inspector,
   tree, toolbar, address; sections: hero, image with text, image banner, product grid, featured collection,
   collection list, multicolumn/testimonials/FAQ intros. Contract test: every declared element renders a marker.
2. **Coverage** (done 2026-11-07): header (logo, menu), footer (newsletter, about text), announcement, product page parts
   (title, price, buy buttons, description), collection header, store visit, rating, gallery, logo list,
   metaobject list, blog sections; elements inside blocks (column heading/text, card label/image).
   Built: header (logo, extra link, shopping icons), footer (newsletter heading/text, store name, about text,
   email, copyright), announcement message, product title/brand/price, Add to cart button, product description
   and related products headings, related product cards, collection title and image, store visit, rating,
   gallery, logo list, metaobject list, specifications, blog header text; block parts in columns, collection
   cards and testimonials (`BLOCK_ELEMENTS`, selection `{ kind: "block", elementId }`). Parts of shared
   sections open their settings from the preview. Left for later: the header menu links, article lists,
   product options/gallery, the collection description, parts inside FAQ and logo blocks.
3. **Element phone/tablet values, keyboard** (Tab/Shift+Tab between elements, Enter = into, Escape = up),
   hover labels for elements, inline text editing on double click.
4. **QA**: signed-in editor check in all themes, Playwright spec, docs.
