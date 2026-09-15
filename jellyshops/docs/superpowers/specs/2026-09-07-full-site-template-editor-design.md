# Jellyshop full-site template editor design

**Date:** 2026-09-07
**Status:** Approved design, pending written-spec review

## Goal

Give Jellyshop merchants a Shopify-style storefront editor in which every supported storefront page can be composed from safe, registered Jellyshop sections and blocks. Merchants can control content, layout, styling, responsive behavior, templates, and page assignments without gaining access to arbitrary HTML, JavaScript, or unrestricted CSS.

“Fully customizable” means merchants can compose all supported pages from registered sections and settings while Jellyshop preserves required commerce behavior, accessibility, responsive integrity, tenant isolation, and security.

## Product principles

1. **One canonical document:** `StorefrontDocument` is the persisted source of truth for editor preview and public rendering.
2. **Controlled extensibility:** the registry defines what merchants may create and change.
3. **Renderer parity:** preview and published storefront use the same React renderer and registered components.
4. **Canonical templates:** a template's ordered sections exist in exactly one authoritative location.
5. **Stable identity:** templates, sections, and blocks have durable IDs independent of array position.
6. **Runtime separation:** catalog, product, collection, cart, search, article, customer, and route data never enter the storefront document.
7. **Safe publication:** drafts remain private; public routes read only an immutable active publication.
8. **Accessible control:** drag-and-drop is an enhancement, with keyboard-accessible commands retained for all ordering operations.

## Architecture

The existing schema-driven Jellyshop architecture remains the foundation. The editor dispatches validated commands against a canonical storefront document. Draft persistence uses revision checks. Publishing creates an immutable snapshot. Both draft preview and public storefront render through the same registry-backed renderer.

```text
Editor -> validated commands -> draft document -> shared renderer
                              |
                              +-> publish -> immutable publication
                                               |
                                               +-> public storefront
```

The platform responsibilities are deliberately separated:

- **Document:** what the merchant configured.
- **Registry:** what Jellyshop permits.
- **Render context:** request-specific commerce and route data.
- **Renderer:** how valid configuration plus context becomes React UI.
- **Editor:** a command-based interface for manipulating valid configuration.

## Canonical document model

A store document contains:

```text
StorefrontDocument
├── schemaVersion
├── storeId
├── theme settings and design tokens
├── shared groups
│   ├── header group
│   └── footer group
├── navigation references
├── page templates
│   ├── Home templates
│   ├── Product templates
│   ├── Collection templates
│   ├── Custom-page templates
│   └── Other supported system-page templates
└── page-type defaults
```

Each page template has a stable ID, page type, title, handle, system/custom classification, ordered `sections`, and metadata needed for lifecycle rules. Each section has a stable ID, type, enabled state, settings, approved responsive overrides, and ordered blocks. Each block has the same stable-identity and validated-settings properties.

Product and collection records may store an optional template ID. When no assignment exists, rendering uses that page type's default template. Template assignment is commerce metadata and is not copied into the storefront document's section configuration.

### Shared groups and the composed editor hierarchy

Header and footer content are shared groups. They are not copied into every page template. The left editor hierarchy composes shared content with the active template for editing convenience:

```text
Editor hierarchy
├── Header              <- shared group reference
├── Active template     <- template.sections[]
│   ├── Section
│   │   └── Blocks
│   └── Section
└── Footer              <- shared group reference
```

The composed hierarchy is editor presentation, not the literal persisted tree.

### Placement regions

Regions describe placement constraints such as `header`, `template`, and `footer`. They do not own independent copies of template content. A registered definition may restrict a section to one or more regions, but the section remains stored only in its owning shared group or template.

### Migration invariant

The current schema-v3 work is the migration foundation, but the duplicated writable `regions.template` representation must be removed. At the end of migration, a template's ordered sections exist in exactly one authoritative location. Legacy representations may be read during migration but are never written by the new editor.

Migrations must preserve stable IDs wherever the legacy document supplies them. New IDs are generated only for entities that did not previously exist. A migration is deterministic for a given source document and must be safe to run more than once at the document-loading boundary.

## Registry contract

Every editable section and block is registered. A section definition declares:

- supported page types and placement regions;
- allowed block types, counts, and nesting rules;
- per-template instance limits;
- editor capabilities such as add, remove, hide, move, duplicate, and copy;
- default settings, default content, and presets;
- declarative inspector setting schemas;
- responsive fields and override rules;
- validation rules;
- renderer registration; and
- runtime data requirements.

Block definitions use the same declarative principles for settings, controls, capabilities, defaults, validation, and renderer behavior.

The inspector is a generic engine generated from registry schemas. A normal new section requires a registry definition and storefront renderer, not section-specific editor infrastructure. A dedicated editor component is allowed only for a control type that is broadly reusable, such as rich text, media focal-point selection, product selection, collection selection, menu selection, or link editing.

Unknown definitions, invalid settings, unsupported placement, excess instances, prohibited operations, and invalid responsive overrides are rejected at command and document-validation boundaries.

## Runtime rendering

Persisted configuration and runtime data remain separate:

```text
StorefrontDocument
        +
RenderContext
(route/product/cart/search/article/etc.)
        +
Registry
        |
        v
validated rendering plan
        |
        v
shared React renderer
```

A section declares required context without persisting that context. The route layer resolves the correct publication, template assignment, and request-specific data, then constructs `RenderContext` for the renderer.

If required runtime data is empty, the section renders its registered safe empty state. If required context is absent because of a programming or routing error, the renderer isolates the affected node, records a diagnostic, and preserves the rest of the page. An unknown or invalid node never crashes the complete storefront.

## Editor experience

The editor has four coordinated areas.

### Top toolbar

- store and theme identity;
- page and template picker;
- desktop, tablet, and mobile preview controls;
- undo and redo;
- draft save status;
- preview action;
- publish action; and
- publication history and restore access.

### Left hierarchy

- shared Header group;
- active template and its nested sections and blocks;
- shared Footer group;
- visibility controls;
- selection and expansion state;
- keyboard and pointer reordering;
- allowed duplication and deletion actions; and
- contextual Add section and Add block actions.

The hierarchy is derived from the current document, registry capabilities, and active template. Expansion, focus, and selection are editor-session state and are not persisted as storefront configuration.

### Center canvas

- the same renderer used by the public storefront;
- selectable section and block outlines;
- insertion points between valid siblings;
- safe empty states;
- active-selection indication;
- desktop, tablet, and mobile widths; and
- preview navigation that stays within the editor session.

### Right inspector

- schema-generated Content, Layout, Style, and Advanced groups;
- text and approved rich-text editing;
- typography, color, spacing, alignment, and sizing controls;
- media, focal point, fit, and alt-text controls;
- link, menu, product, and collection selectors;
- conditional visibility and registered animation controls;
- responsive overrides only for fields that permit them; and
- section/block actions allowed by registry capabilities.

Arbitrary HTML, JavaScript, and unrestricted CSS are outside the initial product scope.

## Template and page management

Merchants can:

- create a template from a registered starter, an existing template, or an allowed blank state;
- rename and duplicate templates;
- select one default template for each supported page type;
- assign product and collection templates to individual resources;
- add, rename, reorder, and remove eligible custom pages;
- compose every template using sections allowed for its page type; and
- manage shared header and footer groups independently of the active template.

System templates and required shared groups cannot be removed when doing so would make a supported route invalid. A template assigned to products or collections cannot be deleted until assignments are moved, or the merchant explicitly replaces those assignments with the page-type default.

Template handles and custom-page slugs are normalized, unique within the store, and protected from collisions with reserved application and system routes.

## Command model and history

All document changes use typed editor commands. Commands cover:

- adding, updating, moving, hiding, duplicating, and deleting sections and blocks;
- editing theme and shared-group settings;
- creating, renaming, duplicating, deleting, and selecting templates;
- changing page-type defaults;
- adding, renaming, and deleting custom pages; and
- changing product and collection template assignments through the appropriate commerce boundary.

Before mutation, a command checks registry capabilities, placement, instance limits, nesting rules, target identity, and setting validity. It returns a new document without changing unrelated identities or order.

```text
User action
    |
    v
Editor command
    |
    v
capability and registry validation
    |
    v
canonical document update
    ├── history entry for undo/redo
    ├── selection reconciliation by stable ID
    └── debounced draft autosave
              |
              v
     revision-checked API write
```

Reordering changes array order, never identity. Duplication creates fresh IDs for the duplicated subtree. Deletion reconciles selection to the nearest valid parent or clears it. Undo and redo operate on document commands; transient UI state is reconciled separately.

## Drafts, publishing, and restoration

- Local editor state updates immediately after a valid command.
- Changes schedule a debounced autosave.
- The backend accepts a draft only when the expected revision matches the current stored revision.
- A revision conflict never silently overwrites newer work. The first release offers explicit reload/retry behavior; later conflict reconciliation may be added without changing the document contract.
- Publish first flushes all pending local edits and obtains the revision returned by the successful draft write. The client then requests publication using that exact persisted revision; it does not send a separate document as the publication source.
- The backend verifies that the requested revision is still the store's current draft revision, loads that exact persisted draft, validates it against the complete storefront schema and registry, creates an immutable publication snapshot from that revision, and atomically activates the snapshot.
- Revision verification, validation, snapshot creation, and activation form one publication transaction. If any step fails, the transaction rolls back and the previously active publication remains unchanged.
- Public routes resolve only the store's active publication.
- Publication history records source revision, timestamp, author, and an optional note.
- Restoring a publication creates a new draft based on the selected snapshot. It never alters or deletes publication history.
- Publish validation reports actionable errors by template, section, block, and setting path.

## Page coverage

The full-site editor will support customizable templates for:

- Home and custom information pages;
- Product and collection;
- Collection list;
- Search and search results;
- Cart;
- Blog and blog post;
- Contact;
- Password or coming-soon; and
- Gift card where supported by Jellyshop commerce.

Checkout, login, account, order status, and other security-sensitive pages use controlled customization. Merchants may apply registered branding, typography, color, spacing, logo, shared content, and specifically approved sections, but cannot remove or obscure required legal, payment, authentication, customer, or order information.

## Authorization and safety

- Every draft, publication, assignment, media, menu, and catalog operation is scoped to the authenticated store.
- Server-side authorization is authoritative; hiding an editor control is not an access check.
- Membership roles determine who may edit, publish, restore, or manage templates and assignments.
- Setting schemas constrain URLs, media references, lengths, colors, numeric ranges, and referenced resource IDs.
- Renderers treat merchant content as data and never execute it as script or unsanitized markup.
- Required commerce and legal UI has non-removable capability rules.
- Document-size, node-count, depth, and block-count limits protect persistence and rendering.

## Error handling

- Invalid editor operations are rejected without mutating history.
- Autosave failures preserve the local draft and expose a retryable status.
- Revision conflicts stop automatic writes until the merchant reloads or resolves the conflict.
- Missing referenced products, collections, menus, media, or articles produce registered editor warnings and safe storefront fallbacks.
- One failing renderer is isolated by node-level error handling.
- Publish is atomic: revision verification, validation, snapshot persistence, or activation failure leaves the current publication unchanged.
- Migration failures preserve the source record, block editing/publication for that draft, and emit a diagnostic suitable for support.

## Delivery sequence

### 1. Canonical schema migration

Remove writable `regions.template`; introduce canonical templates, shared groups, stable IDs, page-type defaults, assignment-resolution contracts, and migration tests. Product and collection assignment records remain in the commerce data model rather than the storefront document.

### 2. Registry contract

Add declarative controls, placement constraints, editor capabilities, nesting and instance limits, responsive rules, runtime requirements, and renderer registration.

### 3. Core editor

Build the composed hierarchy, generic inspector, validated commands, keyboard and pointer reordering, selection reconciliation, undo/redo, autosave, and responsive preview on the canonical model.

### 4. Template management

Add template creation, duplication, renaming, deletion protection, default selection, and product/collection assignment.

### 5. Page coverage

Implement and verify the registered sections and render contexts required for each supported route type, one route family at a time.

### 6. Publishing maturity

Complete publish validation, immutable history, restore, conflict recovery, permissions, and audit metadata.

### 7. Editing polish

Add reusable section groups, copy/paste, starter presets, accessibility polish, performance work, and richer reusable media and rich-text controls.

## Verification strategy

### Schema and migration

- migration from every supported historical schema;
- canonical-storage and idempotent-loading invariants;
- preservation of stable IDs;
- rejection of duplicate IDs, handles, slugs, and defaults;
- document size, depth, node, and instance limits; and
- round-trip serialization tests.

### Registry and commands

- settings and responsive-override validation;
- placement, nesting, instance-limit, and capability enforcement;
- stable identity through moves and edits;
- fresh subtree identity on duplication;
- selection reconciliation after deletion and template changes; and
- undo/redo behavior for every command category.

### Renderer

- preview and public-renderer parity;
- route-to-template resolution and default fallback;
- product and collection assignment behavior;
- required and missing render-context behavior;
- safe empty and missing-reference states; and
- node-level renderer failure isolation.

### Persistence and authorization

- private draft isolation;
- optimistic revision conflicts;
- publication from the exact successfully persisted draft revision;
- rejection when that expected revision is no longer current;
- atomic snapshot creation and activation;
- unchanged-live-state behavior when revision verification, validation, snapshot persistence, or activation fails;
- immutable publication history and non-destructive restore;
- membership-role permissions; and
- tenant isolation between stores.

### End-to-end and quality

- create, edit, assign, preview, save, publish, and restore flows;
- editing coverage for every supported page type;
- keyboard-only and screen-reader editor operation;
- desktop, tablet, and mobile visual regression checks;
- storefront accessibility checks; and
- storefront and editor performance budgets.

## Out of scope for the initial implementation

- arbitrary merchant-authored HTML, JavaScript, or unrestricted CSS;
- a free-position canvas or absolute element placement;
- installing Puck, GrapesJS, or another second document model;
- real-time multi-user collaborative editing;
- a public third-party app-block SDK; and
- automatic AI-generated sections that bypass registry validation.

These capabilities can be evaluated later without weakening the canonical document, registry, render-context, and publication boundaries defined here.
