# Jelly Shop Store Editor Architecture Recommendation

**Date:** 2026-09-04  
**Audience:** Jelly Shop product and engineering team  
**Decision:** Keep and extend Jelly Shop's schema-driven React editor. Do not replace it with Puck or GrapesJS now.

## Scope and assumptions

This assessment compares a controlled, Shopify-style commerce editor with generic visual builders for Jelly Shop's existing Next.js/React application. It covers the present home-page editor and the likely expansion to additional commerce pages. It does not evaluate pricing of paid SaaS products or commit the project to a cloud editor vendor.

## Direct answer

Jelly Shop already has the right core architecture: a versioned `StorefrontDocument`, a typed section/block registry, a shared React renderer, global theme tokens, validation, and separate draft/publish lifecycle. That is the difficult, commerce-specific part of a safe editor. Replacing it with Puck would duplicate the document and renderer boundaries and introduce an adapter or migration before delivering a meaningful customer benefit. GrapesJS would move the product toward arbitrary HTML/CSS authoring, which conflicts with the safety, responsive fidelity, catalog semantics, and validation requirements of a merchant storefront.

The recommended path is therefore:

1. Keep the current `StorefrontDocument` as the sole persisted page format.
2. Continue using the section registry as the allow-list of merchant-editable commerce components.
3. Add optional drag-and-drop only as an interaction enhancement over the existing move commands; preserve keyboard move controls.
4. Add rich text with Tiptap only inside registry-defined rich-text fields, storing its JSON in a validated field rather than accepting raw page HTML.
5. Reconsider Puck only if adding and maintaining custom editor interaction chrome becomes the bottleneck after the current editor supports several page types.

## Evidence from the current codebase

The current application already provides the bounded model that Puck would help establish:

- `@jelly/storefront-schema` persists a versioned home document with `header`, `template`, and `footer` regions and validates size, IDs, and media URLs.
- `@jelly/storefront-registry` declares allowed sections, blocks, settings schemas, controls, region restrictions, responsive fields, and block limits.
- `@jelly/storefront-renderer` renders the same document for both the editor preview and public storefront.
- The Store Editor has a hierarchy, generated controls, selection, visibility, duplication, move commands, undo/redo, responsive preview, local media, draft revision handling, and explicit publication.

These boundaries match the stated product requirement: merchants can change controlled properties without changing the React application or breaking mobile layouts.

## Options

| Option | Fit for Jelly Shop now | Key benefit | Material drawback |
| --- | --- | --- | --- |
| **Keep current architecture (recommended)** | Excellent | Preserves validation, commerce-aware controls, shared rendering, draft safety, and existing work | Editor interaction features continue to be owned by Jelly Shop |
| **Adopt Puck now** | Moderate | Provides a mature React drag/drop editor shell and config-driven fields | Requires a Puck-data-to-`StorefrontDocument` adapter or full migration; overlaps existing registry/renderer/editor work |
| **Adopt GrapesJS** | Poor | Broad free-form builder capabilities | HTML/CSS-oriented model is less compatible with safe structured commerce sections and React storefront fidelity |
| **Use Tiptap in selected fields** | Good complement | Professional rich-text editing and JSON persistence | Solves text fields only; it is not a page editor |

## Why Puck is a future option, not the present foundation

Puck's documented model is close to Jelly Shop's intended product: developers register React components, fields, defaults, permissions, and rendering; the editor produces data that the renderer consumes. It is MIT licensed and supports Next.js. That makes it a credible future accelerator for editor chrome.

But Puck's data payload is not Jelly Shop's document contract. Jelly Shop has protected regions, section/block constraints, theme presets/tokens, immutable publication snapshots, optimistic draft revisions, media records, and provider-neutral APIs. Using Puck today means either persisting two representations or writing a bidirectional adapter. Both add migration, test, and conflict-handling risk without solving the important commerce rules that are already built.

If Puck is evaluated later, the safe integration is an adapter layer:

`Puck UI data -> adapter -> validated StorefrontDocument -> existing draft/publish API -> existing public renderer`

The public renderer and persistence contract should remain owned by Jelly Shop. Puck should never become the public page format.

## Why GrapesJS is not recommended

GrapesJS offers blocks, asset handling, pages, and a CSS style manager. Those strengths are useful for a Wix-like website builder where users can freely compose and style arbitrary web content. Jelly Shop instead needs product-aware sections, safe links and media, stable responsive behavior, accessibility defaults, and a React storefront driven by a validated document.

Introducing GrapesJS would require restricting many of its primary capabilities, translating its component/style output into the existing React renderer, or accepting user-authored HTML/CSS as a new source of truth. Each route undermines the current controlled-editor design. It is a better fit only if the product strategy explicitly changes to unrestricted landing-page creation.

## Recommended next product slices

1. **Interaction polish:** drag reorder with keyboard fallback, insertion positions, section presets, and better conflict/retry UX.
2. **Content depth:** Tiptap for approved rich-text controls; reusable image focal-point/crop UI; product/collection pickers backed by the real catalog when connected.
3. **Page coverage:** extend the same schema and registry to product, collection, and informational pages—one template at a time.
4. **Operational maturity:** real Firebase auth, PostgreSQL/Prisma repository, GCS media provider, publication history, rollback, and roles.
5. **Puck spike only if warranted:** prototype Puck against two existing registry sections and measure adapter complexity, keyboard accessibility, preview fidelity, and draft/publish compatibility before committing.

## Decision gates

Stay custom while the following are true:

- the editor remains limited to curated commerce sections;
- `StorefrontDocument` remains the public rendering and publishing contract; and
- the team can add editor interaction improvements without slowing section work.

Run a Puck integration spike when either condition changes:

- custom editor chrome is consistently the main delivery bottleneck; or
- several page templates need nested drag-and-drop layouts that the current commands cannot support cleanly.

Choose GrapesJS only after an explicit product decision to allow free-form layout/HTML/CSS authoring, accompanied by a new security, sanitization, rendering, and support model.

## Sources and access notes

- [Puck documentation](https://puckeditor.com/docs) — official documentation, accessed 2026-09-04. Confirms React/Next.js fit, component configuration, data ownership, and MIT license.
- [Puck component configuration](https://puckeditor.com/docs/integrating-puck/component-configuration) — official documentation, accessed 2026-09-04. Confirms the config/fields/render/data-payload model.
- [GrapesJS Block Manager](https://grapesjs.com/docs/modules/Blocks) — official documentation, accessed 2026-09-04. Confirms block-based drag-and-drop composition.
- [GrapesJS Style Manager](https://grapesjs.com/docs/api/style_manager.html) — official documentation, accessed 2026-09-04. Confirms CSS-property style editing model.
- [Tiptap React documentation](https://tiptap.dev/docs/editor/getting-started/install/react) and [JSON output guide](https://tiptap.dev/docs/guides/output-json-html) — official documentation, accessed 2026-09-04. Confirms React integration and JSON content persistence.

## Limitations

This is an architecture recommendation, not a hands-on Puck or GrapesJS prototype. Paid GrapesJS Studio licensing and operational support terms were not evaluated because they are not needed for the recommended path.
