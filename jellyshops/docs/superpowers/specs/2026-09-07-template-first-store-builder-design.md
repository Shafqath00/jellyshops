# Template-first store builder design

## Goal

Give every merchant a polished starting storefront, then let them build and publish their own pages by adding, ordering, duplicating, hiding, and configuring registered sections and blocks.

## Product behaviour

The first editor session presents two selectable starter templates:

- **Bakes**: a warm editorial landing page with a hero, product grid, story content, and newsletter callout.
- **Essentials**: a restrained catalog storefront with a compact hero, featured collection, product grid, and rich-text content.

A template is a seed document, never a runtime component. Once selected, all sections and settings become part of the merchant's editable document.

The editor has three coordinated areas:

- A left navigation rail lists pages, Theme settings, Header, the active page's sections, Add section, and Footer. It provides Add page, rename page, and delete page actions for custom pages.
- The center canvas renders the selected page at desktop, tablet, or mobile width.
- The right inspector edits the selected theme, section, or block. The existing inspector remains the source of truth for registered controls.

The toolbar retains the existing back navigation, responsive preview, undo/redo, save state, Save, and Publish actions, while showing the active page title.

## Data model

Storefront document schema version 3 replaces the single `template: "home"` field with an ordered `pages` collection. A page has `id`, `type`, `title`, `slug`, `sections`, and `system` fields. System pages are `home`, `product`, and `collection`; only a custom page can be renamed or deleted. The home page uses slug `/` and is the default storefront route.

The document retains shared `header`, `footer`, and theme settings. Existing version 2 documents migrate to a version 3 document containing a Home system page whose sections are copied from the old `template` region. Migration preserves node IDs, theme settings, and shared regions.

## Constraints

- Registered sections and blocks remain the only editable building blocks.
- Custom pages accept sections supported on `home`; product and collection system pages stay available for future route-specific editor work but are protected from deletion.
- A slug must be lowercase, URL-safe, unique within one document, and cannot collide with system routes such as `products`, `shop`, `cart`, `checkout`, `order`, or `admin`.
- Deleting a custom page removes only that page and clears active-page selection if necessary.
- Existing stored version 2 documents must load without user intervention.

## Delivery sequence

1. Version 3 schema, migration, and template factory with tests.
2. Editor state and commands for page selection and page lifecycle, plus a page picker in the left rail.
3. Render selected pages in preview and custom public page routing.
4. Visual polish, accessibility checks, and end-to-end verification.
