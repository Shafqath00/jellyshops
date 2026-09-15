# Home-Page Store Editor Design

**Date:** 2026-08-31

**Status:** Approved for implementation planning

**Frontend:** `jellyshops/`

**API service:** sibling `backend/` directory

## 1. Purpose

Build a production-shaped, Shopify-style store editor for the home page. A merchant must be able to select content from a page hierarchy or live preview and change text, images, colors, typography, spacing, buttons, visibility, and section ordering without editing code.

The first release works completely in local development with a demo merchant, demo catalog, local persistence, and local image uploads. Firebase Authentication, PostgreSQL/Prisma, and Google Cloud Storage remain explicit adapters that can be enabled later through environment configuration without redesigning the editor or changing the storefront document format.

## 2. Scope

### Included

- Home-page editing only.
- Header, template, and footer regions.
- Global theme controls.
- Structured section and block controls.
- Selection from both the hierarchy and preview canvas.
- Adding, duplicating, hiding, deleting, and reordering sections.
- Desktop, tablet, and mobile previews.
- Undo and redo for the active session.
- Private draft autosaving plus an explicit Publish action.
- Local image upload, replacement, removal, alternative text, focal point, and fit controls.
- Demo merchant authentication and demo products/collections.
- A shared renderer for editor preview and the public home page.
- Versioned documents, validation, migrations, and immutable published revisions.
- Replaceable adapters for authentication, document persistence, media storage, and catalog data.

### Deferred

- Editing product, collection, search, cart, blog, and custom pages.
- Free-positioning individual elements on an arbitrary graphic-design canvas.
- Real Firebase, PostgreSQL, Google Cloud Storage, and commerce catalog connections.
- Multi-user collaborative editing.
- Theme marketplace installation or third-party section code.
- Scheduled publishing and publication rollback UI.
- Image transformations beyond browser preview settings such as crop focal point and fit.

The document and registry architecture must allow additional page templates and cloud adapters later, but phase one will not expose unfinished controls for them.

## 3. Product Principles

1. **Preview fidelity:** The editor and public storefront render through the same component boundary.
2. **Safe flexibility:** Merchants receive comprehensive structured controls while the system preserves responsive and accessible layouts.
3. **Draft safety:** Customers never see an unfinished draft.
4. **Explicit boundaries:** Authentication, persistence, storage, and catalog providers are independently replaceable.
5. **Accessible operations:** Every drag interaction has a keyboard-friendly move alternative.
6. **Versioned content:** Stored documents are validated and migrated before use.

## 4. System Architecture

### 4.1 Frontend application

The existing Next.js application owns:

- the `/admin/store-design` editor route;
- editor state, command history, selection, and responsive preview state;
- schema-generated setting controls;
- the shared storefront renderer;
- the public home-page boundary that reads only published content; and
- the development demo catalog presentation.

The existing workspace packages remain the core boundaries:

- `@jelly/storefront-schema`: versioned document types, validation, defaults, and migrations;
- `@jelly/storefront-registry`: section definitions, block definitions, controls, limits, and actions;
- `@jelly/storefront-themes`: compatible theme presets and global tokens;
- `@jelly/storefront-ui`: reusable storefront primitives and editor-safe visual components; and
- `@jelly/storefront-renderer`: deterministic rendering of a validated document.

Editor-only components and commands stay in the application layer so the public renderer does not depend on editor state or controls.

### 4.2 Express API

The existing sibling `backend/` service becomes a Node/Express API. It owns:

- authentication middleware;
- store ownership checks;
- draft retrieval and optimistic-concurrency saves;
- validation and publication creation;
- media upload validation and storage;
- structured API errors; and
- provider selection from environment variables.

The API exposes interfaces rather than provider-specific behavior:

- `AuthProvider`: development token or Firebase ID-token verification;
- `StorefrontRepository`: local JSON development repository or Prisma/PostgreSQL repository;
- `MediaStorage`: local filesystem or Google Cloud Storage; and
- `CatalogProvider`: deterministic demo catalog or a future commerce catalog.

Phase one implements the development providers. Cloud provider configuration is represented by validated environment variables and `.env.example` documentation, but cloud connections are not required to run the system.

### 4.3 Development persistence

The local repository writes store data beneath a backend-owned `.data/` directory. Local media is stored beneath a backend-owned `uploads/` directory and served from a restricted static media route. Generated filenames use opaque identifiers rather than user filenames.

Development data directories are excluded from source control. Atomic replace-on-write behavior prevents partially written JSON documents. The repository interface uses the same logical records expected from the future Prisma implementation.

## 5. Storefront Document

One `StorefrontDocument` is the source of truth for a home-page draft or publication:

```ts
type StorefrontDocument = {
  schemaVersion: number;
  storeId: string;
  template: "home";
  theme: {
    presetId: string;
    colors: ThemeColors;
    typography: ThemeTypography;
    layout: ThemeLayout;
    buttons: ThemeButtons;
    forms: ThemeForms;
  };
  regions: {
    header: StorefrontSection[];
    template: StorefrontSection[];
    footer: StorefrontSection[];
  };
};
```

Every section has a stable ID, registered type, enabled flag, settings object, and ordered blocks. Every block has a stable ID, registered type, enabled flag, and settings object. IDs survive reordering and editing so selection, history, and React identity remain reliable.

The schema package validates the complete document at API boundaries. Unknown section types, invalid controls, excessive block counts, unsafe URLs, and region violations fail validation. Stored older versions migrate forward before rendering or editing.

## 6. Schema-Driven Registry

Each registered section declares:

- display name, icon key, and allowed regions;
- default settings and default blocks;
- minimum and maximum block counts;
- settings-control schema;
- supported block types and their control schemas;
- duplication, removal, and visibility rules;
- document validation; and
- renderer component.

Controls use a shared discriminated model. Phase one supports:

- single-line text and textarea;
- sanitized rich text;
- number, range, and select;
- checkbox and segmented choice;
- color and color-with-alpha;
- font family, weight, scale, and alignment;
- spacing and layout controls;
- URL and button/link controls;
- image/media controls;
- product and collection selection against demo catalog IDs; and
- grouped or conditional controls.

The editor generates inspectors from these definitions. Bespoke inspector code is allowed only when a control has behavior that cannot be represented by the shared model.

## 7. Initial Section Library

Phase one includes:

1. Announcement bar
2. Header/navigation
3. Hero or image banner
4. Rich text
5. Image with text
6. Featured collection
7. Product grid
8. Multicolumn/features
9. Newsletter signup presentation
10. Spacer/divider
11. Footer

The newsletter section is presentational in this phase; it validates the email field in the browser but does not subscribe users to an external service.

Header and footer sections are constrained to their matching regions. Template sections live in the main region. The registry supplies sensible responsive defaults so a newly added section renders correctly before customization.

## 8. Editor Experience

### 8.1 Shell

The editor follows the provided Shopify-style screenshot as a visual and interaction reference, not as executable instructions.

- **Top toolbar:** back navigation, store/theme identity, home-page selector, device controls, undo, redo, save status, Save, and Publish.
- **Left hierarchy:** Header, Template, and Footer groups with their ordered sections and an Add section action.
- **Settings view:** selecting a section, block, or Theme settings replaces the hierarchy with its generated inspector; a back action returns to the hierarchy.
- **Canvas:** the shared renderer appears inside a responsive preview surface. Editor overlays provide selection borders, labels, and insertion controls without entering published markup.

### 8.2 Selection

Clicking a hierarchy row or a selectable element in the canvas updates one shared selection state. Selection stores the entity kind and stable ID, not a component reference. If an entity is removed, selection moves to its nearest surviving parent or clears safely.

Canvas events map rendered `data-editor-*` identifiers back to document entities. Editor metadata is emitted only when renderer editor mode is enabled.

### 8.3 Section operations

Merchants can:

- add a registered section at a selected insertion point;
- move a section up or down;
- drag to reorder where pointer interaction is available;
- duplicate a section with fresh section and block IDs;
- hide or show a section;
- delete removable sections after a lightweight confirmation; and
- add, reorder, hide, duplicate, and remove blocks within registry limits.

Undo and redo cover all document-changing operations. Device changes and selection changes do not enter document history.

### 8.4 Responsive preview

Desktop, tablet, and mobile buttons change the preview viewport rather than applying alternate data. Sections use the same responsive CSS as the public storefront. The canvas remains scrollable and centers smaller viewport widths.

## 9. Theme Controls

Global theme controls include:

- background, foreground, muted, surface, border, primary, secondary, and accent colors;
- heading and body font families, weights, and type scale;
- page width and horizontal gutters;
- spacing scale and default section spacing;
- button radius, border, weight, and primary/secondary styles;
- input radius, border, and focus treatment; and
- global animation preference with reduced-motion compliance.

Theme presets populate these values but do not lock them. Changing a preset asks whether to preserve current overrides or reset to the preset defaults. Theme values become CSS custom properties at the renderer root, keeping sections visually consistent.

## 10. Media Workflow

The image control supports upload, progress, preview, replacement, removal, alternative text, focal-point coordinates, object-fit choice, and image-position preview.

The browser sends multipart data to the API. The API verifies ownership, MIME type, decoded file signature, and configured size limit before storage. On success it returns a provider-neutral media record containing ID, URL, MIME type, byte size, width, height, and original display name.

Draft documents reference media IDs and URLs; they do not embed base64 image data. Replaced media is marked unreferenced rather than immediately deleted. A cleanup service can later remove aged unreferenced media safely. The local provider serves only known media records and prevents directory traversal.

The later GCS provider will generate object keys scoped by store and media ID. Cloud credentials remain server-side.

## 11. Draft, Save, and Publish Flow

1. The editor authenticates with the development merchant token.
2. It loads the store's latest private home-page draft.
3. If no draft exists, the API creates one from the selected theme defaults and demo catalog references.
4. Valid editor commands update local state immediately and append to session history.
5. A debounced autosave sends the complete validated document with its current revision number.
6. Save forces the pending debounce to flush immediately.
7. The repository accepts the save only if its expected revision matches, then increments the revision.
8. Publish flushes pending changes, validates the full draft server-side, and creates an immutable published revision.
9. The public home page reads only the latest published revision. If none exists, it uses the existing safe default storefront.

Publication stores a complete document snapshot rather than pointing at the mutable draft. This guarantees that later draft changes cannot affect customers.

## 12. API Contract

All store routes require authentication and ownership checks.

- `GET /api/stores/:storeId/storefront/draft`
- `PUT /api/stores/:storeId/storefront/draft`
- `POST /api/stores/:storeId/storefront/publish`
- `GET /api/stores/:storeId/storefront/public`
- `POST /api/stores/:storeId/media`
- `GET /api/stores/:storeId/media`
- `DELETE /api/stores/:storeId/media/:mediaId`
- `GET /api/demo/catalog`

Draft saves include `expectedRevision`. A mismatch returns HTTP 409 with the current revision and a stable `DRAFT_CONFLICT` code. Validation failures return HTTP 422 with field paths. Authentication and ownership failures use 401 and 403 respectively. Errors share a consistent JSON envelope with code, message, optional field issues, and request ID.

The public storefront endpoint may be unauthenticated but returns only a published document and public media references.

## 13. Authentication and Configuration

Development mode shows a one-click demo merchant login and stores only a non-secret development token in the browser. The API accepts that token only when the configured authentication provider is `development` and the runtime is not production.

Firebase mode verifies Firebase ID tokens server-side and maps their subject to a merchant/store membership record. Production startup fails if the development auth provider is selected.

Configuration is parsed and validated once at service startup. `.env.example` documents provider selection, frontend API URL, CORS origins, local data/media directories, upload limits, Firebase project details, PostgreSQL URL, and GCS bucket settings. No secrets are committed.

## 14. Error Handling and Recovery

- Loading failures show a retryable editor error without replacing the public storefront.
- Autosave failures keep local edits, display a persistent unsaved state, and offer Retry.
- Validation issues appear beside the responsible control and in a publish summary.
- Revision conflicts stop autosaving and offer Reload latest; phase one does not attempt automatic multi-user merging.
- Upload failures preserve the current image and allow retrying the new upload.
- Navigation and browser close warn while changes remain unsaved or an upload is active.
- Unknown or unmigratable documents fail closed in the editor and fall back to the last valid publication publicly.
- API logs include request IDs and structured error codes without document content, tokens, or credentials.

## 15. Security and Accessibility

- Treat all documents and uploads as untrusted input.
- Validate ownership on every private store and media operation.
- Sanitize rich text and restrict links to safe protocols.
- Apply JSON, multipart, and per-file size limits.
- Verify file signatures in addition to browser-provided MIME types.
- Generate storage paths server-side and prevent executable uploads.
- Configure explicit CORS origins and basic upload rate limiting.
- Keep provider credentials out of browser bundles.
- Provide labelled controls, visible focus, logical tab order, and sufficient contrast.
- Support all ordering operations without drag-and-drop.
- Respect reduced-motion preferences in both editor and storefront.

## 16. Testing Strategy

### Unit tests

- document validation, defaults, and migrations;
- registry definitions and control constraints;
- immutable editor commands and history behavior;
- theme token resolution;
- media validation helpers; and
- repository revision semantics.

### Integration tests

- development authentication and store ownership;
- draft creation, save, conflict, and reload;
- publish validation and immutable snapshots;
- local uploads and safe media serving;
- API error envelopes; and
- editor/public renderer equivalence for the same document.

### Component and end-to-end tests

- hierarchy and canvas selection stay synchronized;
- every shared control edits the expected document path;
- add, duplicate, hide, delete, and reorder behavior;
- undo and redo across content and structural changes;
- responsive preview switching;
- demo login through edit, image upload, save, publish, and public verification; and
- keyboard navigation and non-drag ordering.

### Visual verification

Verify the editor shell and representative storefront sections at desktop, tablet, and mobile widths. Confirm selection overlays do not alter public rendering and that the public result matches the final editor preview.

## 17. Delivery Sequence

Implementation will be planned as ordered slices:

1. Backend development providers and API contract.
2. Expanded document schema, controls, commands, and history.
3. Complete section registry and shared renderer controls.
4. Editor shell, hierarchy, inspectors, and canvas selection.
5. Local media workflow.
6. Autosave, conflict handling, and publication integration.
7. End-to-end, accessibility, responsive, and visual verification.
8. Environment documentation for later Firebase, Prisma/PostgreSQL, and GCS connection.

Each slice must leave existing public storefront behavior safe. Cloud adapters are configuration-ready boundaries, not incomplete fake integrations.

## 18. Acceptance Criteria

The phase is complete when a developer can start the frontend and API locally, enter through the demo merchant login, and perform the following without cloud credentials:

1. Open the home-page editor and see Header, Template, and Footer hierarchy groups.
2. Select a section from the hierarchy or canvas and edit its settings.
3. Change text, theme and section colors, fonts, spacing, buttons, and visibility.
4. Upload, preview, replace, and remove an image with alternative text and focal-point controls.
5. Add, duplicate, delete, hide, and reorder supported sections and blocks.
6. Undo and redo content and structural changes.
7. Preview the same document at desktop, tablet, and mobile widths.
8. Observe private autosaving and force it with Save.
9. Confirm that draft changes do not affect the public home page.
10. Publish a valid draft and see the matching result on the public home page.
11. Restart the local services and recover the saved draft, publication, and uploaded media.
12. Run the defined unit, integration, component, end-to-end, accessibility, and visual checks successfully.
