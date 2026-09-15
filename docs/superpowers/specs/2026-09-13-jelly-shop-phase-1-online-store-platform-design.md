# Jelly Shop Phase 1 Online Store Platform Design

**Date:** 2026-09-13  
**Status:** Design approved in architecture review; written spec awaiting final repository review before implementation planning  
**Scope:** Phase 1 Online Store platform plus the minimum platform, catalog, content, custom-data, and developer foundations required to make it production-capable

## 1. Executive summary

Jelly Shop will evolve from its current local-first storefront editor into a Shopify-like merchant-controlled online-store platform without discarding the architecture that already works.

The approved approach is a **hybrid normalized architecture**:

- merchant-editable resources such as templates, menus, global sections, pages, metafield definitions, and metaobjects are stored as normalized domain records;
- section and block layouts remain validated JSON rather than becoming one database row per UI node;
- a first-class storefront compiler validates the normalized draft workspace and produces an immutable runtime storefront snapshot;
- preview and production use the same compiler contracts and the same renderer;
- catalog and content values remain live data and are resolved at render time rather than copied into storefront publications;
- the current `storefront-schema`, `storefront-registry`, `storefront-renderer`, `storefront-themes`, and editor concepts are evolved rather than replaced;
- normal merchants receive a no-code visual editor, while developers receive a typed React/TypeScript SDK and a controlled custom-code path;
- arbitrary merchant/developer React code never executes inside the privileged admin or backend process.

The central platform flow is:

```text
Catalog + Content + Custom Data
             │
             ▼
      Draft Storefront Workspace
             │
             ▼
       Dynamic Sources
             │
             ▼
      Storefront Compiler
        /           \
       /             \
 Preview        Immutable Publication
                      │
                      ▼
                Runtime Resolver
                      │
                      ▼
                React Renderer
```

The implementation dependency order is deliberately:

1. tenant and capability foundation;
2. production catalog foundation;
3. custom-data and dynamic-source type system;
4. normalized storefront workspace;
5. compiler and V4 runtime snapshot;
6. runtime resolver and renderer changes;
7. editor V2;
8. Theme SDK and developer artifact path;
9. sandboxing, migration, performance, and hardening.

The editor must not be redesigned ahead of the data and compiler contracts because doing so would create avoidable rework.

---

## 2. Goals

Phase 1 must give a merchant enough control to operate a serious online storefront while establishing platform contracts that can later support the larger commerce operating system.

### 2.1 Merchant goals

A merchant must be able to:

- manage multiple stores from one account;
- work with team members using distinct permissions;
- manage a real product and collection catalog rather than demo data;
- create unlimited custom pages;
- create and assign reusable templates for products, collections, pages, blogs, articles, search, and cart;
- visually add, remove, duplicate, hide, reorder, and configure sections and blocks;
- save sections as non-synced presets;
- create synced global sections that update every placement;
- manage multiple nested navigation menus;
- create metafields and structured metaobjects;
- connect section settings to typed dynamic sources;
- control responsive presentation where a section schema permits overrides;
- manage theme-level colors, typography, spacing, buttons, cards, and other semantic settings;
- preview draft changes without affecting the public storefront;
- explicitly publish a validated storefront atomically;
- control resource-level SEO metadata;
- use a media library shared by catalog, content, and storefront editing.

### 2.2 Developer goals

A developer must be able to:

- define sections and blocks in React/TypeScript through a Jelly SDK;
- define editor controls and validation schemas once and have the editor, compiler, and renderer consume the same contract;
- work primarily through a CLI/repository workflow;
- use an advanced browser code editor as a secondary workflow;
- validate and preview custom code before it is publishable;
- use platform capabilities for commerce actions rather than internal/private APIs;
- build immutable artifacts that participate in the same storefront publication flow as no-code edits.

### 2.3 Platform goals

The platform must:

- keep tenant data isolated by `storeId`;
- retain optimistic concurrency and immutable publication principles from the current storefront service;
- prevent half-published storefront states;
- make publication independent of live Shopify/provider API availability;
- keep live catalog values out of storefront publications;
- make dynamic bindings typed, declarative, and migratable;
- give diagnostics enough structure for the editor to navigate directly to errors;
- allow missing live resource values to degrade safely rather than crashing a storefront;
- preserve a migration path for existing V3 storefront documents and current stores.

---

## 3. Non-goals for Phase 1

The following are explicitly deferred:

- custom domains, DNS verification, SSL provisioning, primary-domain management, and domain redirects;
- a multi-theme installed-theme library;
- theme duplication and full theme version-history UI;
- a theme marketplace;
- a general app marketplace;
- unrestricted server-side application execution;
- arbitrary admin UI extensions;
- a complete order-management rebuild;
- a new fulfillment platform;
- a full refunds platform;
- an advanced discount engine;
- a production shipping-rate engine;
- a tax engine;
- a complete payments platform;
- advanced marketing automation;
- advanced analytics;
- abandoned-checkout automation;
- markets, advanced localization, translation workflows, or multi-currency markets;
- real-time collaborative multi-user editing.

The current `StoreDomain` model may remain in the database, but custom-domain product work is not part of Phase 1.

---

## 4. Approved product decisions

The architecture is based on the following decisions from the design review:

- Build both the storefront platform and the broader merchant operating system in stages, with the Online Store first.
- Phase 1 priority is the Online Store plus only the minimum platform/catalog/content foundations it depends on.
- Storefront customization supports no-code editing plus a controlled developer mode.
- Developer mode supports both CLI/repository development and an advanced browser editor.
- One user account may manage multiple stores.
- Stores may have multiple team members with different roles and permissions.
- Unlimited custom pages are supported.
- Product, collection, page, blog, article, search, and cart layouts use reusable templates.
- Resource content and visual templates are separate.
- Template assignment is reusable: many resources may share one template.
- Saved section presets are copied on insert and do not stay synchronized.
- Global sections stay synchronized across placements.
- Dynamic sources include first-class resource fields, metafields, and metaobjects.
- Checkout and account customization use constrained extension surfaces rather than arbitrary theme code.
- The developer theme language is React/TypeScript through a Jelly SDK.
- Phase 1 has one active theme per store with draft, preview, and publish; a full multi-theme library is deferred.
- Phase 1 includes multi-menu nested navigation.
- Custom domains are deferred.
- Full resource-level SEO controls are included.

---

## 5. Existing repository architecture to preserve

This design intentionally reuses current Jelly Shop patterns.

### 5.1 Frontend/editor

The current editor already has:

- an `EditorShell` with active-page state;
- undo/redo history;
- autosave;
- revision conflict handling;
- explicit save and publish actions;
- desktop/tablet/mobile preview states;
- drag-and-drop section/block hierarchy;
- registry-driven inspector controls;
- a preview canvas;
- page creation and section presets.

These concepts stay. The editor evolves from a page-centric editor into an Online Store workspace.

### 5.2 Storefront packages

Existing internal packages remain central:

- `@jelly/storefront-schema` — persisted and runtime schemas plus migrations;
- `@jelly/storefront-registry` — section/block metadata and validation;
- `@jelly/storefront-renderer` — preview/public rendering runtime;
- `@jelly/storefront-themes` — built-in theme definitions and semantic tokens;
- `@jelly/storefront-ui` — reusable storefront UI primitives.

A new `@jelly/storefront-sdk` package becomes the intentional public developer contract.

### 5.3 Backend

The current backend already contains useful boundaries for:

- authentication/merchant resolution;
- tenants and store memberships;
- catalog;
- media;
- storefront repository/service behavior;
- Prisma/PostgreSQL persistence.

The current Prisma schema already models `Store`, `StoreMembership`, `StorefrontDraft`, immutable `StorefrontPublication`, and `Store.currentPublicationId`. The full-commerce reference also already sketches `Product`, `ProductVariant`, inventory, collections, media, and provider `externalId` support.

The design extends these concepts rather than creating parallel replacements.

---

## 6. Core domain architecture

### 6.1 Store as tenant boundary

Every merchant-owned record is scoped to one store, directly or through a parent that is itself tenant-scoped.

```text
User
  │
  └── StoreMembership
          │
          ▼
        Store
          ├── Catalog
          ├── Content
          ├── Custom data
          ├── Media
          ├── Storefront workspace
          ├── Developer source/artifacts
          └── Publications
```

Object IDs alone never authorize access. Backend queries for merchant-owned resources must include the current `storeId` or enforce the equivalent compound relation.

### 6.2 Content versus presentation

The core separation is:

```text
Resource = content/data
Template = presentation/layout
```

Examples:

- a Product stores commerce data and resolves to a Product template;
- a Page stores title/body/SEO/status and resolves to a Page template;
- an Article stores article content and resolves to an Article template.

Editing a shared template updates the layout used by all resources assigned to it without modifying those resources.

### 6.3 Authoring entities

The normalized authoring model includes at least:

```text
StorefrontWorkspace
ThemeConfiguration
StorefrontTemplate
GlobalSection
SectionPreset
NavigationMenu
StorefrontTemplateAssignment
StorePage
Blog
Article
MetafieldDefinition
MetafieldValue
MetaobjectDefinition
MetaobjectEntry
Media
ThemeDeveloperSource
ThemeArtifact
AuditEvent
```

Template section/block trees remain validated JSON inside template/global-section records. Individual section settings are not normalized into one database row per field.

---

## 7. Storefront templates, sections, and reuse

### 7.1 Template types

Phase 1 supports reusable templates for:

- Home;
- Product;
- Collection;
- Page;
- Blog;
- Article;
- Search;
- Cart.

Each type has a default template, and merchants may create additional named templates such as:

```text
product.default
product.featured
collection.default
collection.sale
page.default
page.about
article.default
article.editorial
```

### 7.2 Template assignment

Presentation assignment stays outside provider-owned commerce data.

Conceptually:

```text
StorefrontTemplateAssignment
  storeId
  resourceType
  resourceId
  templateId
```

A resource without an explicit override falls back to the default template for its resource type.

### 7.3 Local sections

A local section belongs to one template. Changes affect only that template.

### 7.4 Saved section presets

A saved preset is a reusable starting point. Inserting it copies the section into the template. Future edits are not synchronized.

### 7.5 Global sections

A global section is a store-owned synchronized resource. Template placements reference it by stable ID.

Converting a local section to a global section must be explicit. Detaching from a global section creates a local copy before removing the reference.

Global sections declare or derive their required render context from their dynamic bindings. A global section that depends on `product.*` sources cannot be placed in a Home template.

---

## 8. Catalog foundation

### 8.1 Canonical Jelly catalog

The editor and storefront do not talk directly to a commerce provider.

```text
Native commerce ───┐
                   ├── Canonical Jelly Catalog ── Editor/Renderer
Shopify/provider ──┘
```

For native commerce, PostgreSQL is the source of truth.

For `CommerceProvider.SHOPIFY`, Shopify remains the external commerce source of truth, but Jelly maintains a normalized local read model needed by the editor, compiler, and storefront. Public page rendering must not depend on a live Shopify API call.

### 8.2 Stable identifiers

Jelly IDs are the stable identifiers used by:

- template assignments;
- navigation resource links;
- section resource pickers;
- metafield ownership;
- metaobject references;
- dependency tracking.

Provider IDs are stored as `externalId` metadata and are never the primary storefront-reference format.

Handles/slugs are routing properties, not reference identities.

### 8.3 Product contract

The production catalog contract includes at least:

```text
Product
  id
  storeId
  externalId?
  handle
  title
  description
  vendor?
  productType?
  tags
  status
  media
  variants
  price range
  availability
```

Variants include price, compare-at price, SKU, option values, availability/inventory state, optional media, and provider external IDs.

Collections are first-class resources with stable IDs, handles, content, media, and product membership.

### 8.4 Catalog service boundary

The backend exposes a provider-neutral catalog interface for product, variant, and collection lookup/listing. The renderer receives a sanitized render resource context rather than direct repository/provider access.

---

## 9. Custom data: metafields and metaobjects

### 9.1 Metafield definitions

Metafields are governed by definitions rather than arbitrary untyped keys.

Conceptually:

```text
MetafieldDefinition
  id
  storeId
  ownerType
  namespace
  key
  name
  description
  type
  validations
  storefrontVisible
  origin
  archivedAt?
```

Supported owner types include Store, Product, Variant, Collection, Page, Blog, and Article.

`namespace` and `key` become stable API identifiers and are immutable after creation in Phase 1. Display labels may change.

### 9.2 Metafield values

Values are stored separately from definitions and are validated against their definition type.

### 9.3 Metaobject definitions

Metaobjects define reusable structured content types. A definition contains stable field handles, labels, types, validations, and storefront-visibility metadata.

### 9.4 Metaobject entries

Entries store typed values for one metaobject definition. Field values remain validated JSON rather than one row per field.

### 9.5 Shared custom-data type system

A shared package owns the custom-data and dynamic-source vocabulary. Phase 1 types include:

- single-line text;
- multi-line text;
- rich text;
- integer;
- decimal;
- boolean;
- money;
- color;
- URL;
- date;
- datetime;
- image/file references;
- product references;
- collection references;
- page references;
- metaobject references;
- lists of supported scalar/reference types.

The editor, compiler, SDK, API, and runtime resolver all consume the same type definitions.

---

## 10. Dynamic sources

### 10.1 Structured bindings

Dynamic values are stored as structured binding objects, not a Liquid-like string-expression language.

```text
SettingValue
  static(value)
  or
  dynamic(binding, optional fallback)
```

Binding kinds include first-class resource fields, metafields, and metaobject-field traversal.

Phase 1 does not support arbitrary expressions such as math or JavaScript execution in bindings.

### 10.2 Type compatibility

Every SDK/editor control declares which dynamic value types it accepts. The dynamic-source picker only shows compatible sources.

Examples:

- text control → string-compatible sources;
- image control → image sources;
- product picker → product references;
- collection picker → collection references;
- boolean control → boolean sources.

Silent incompatible coercions are not supported.

### 10.3 Context requirements

Bindings carry required render context. Product-only sources are unavailable in Page/Home templates unless the section explicitly has an independent product reference source.

The compiler validates that every binding is legal for every template/global-section placement.

### 10.4 Resolution semantics

Runtime resolution order is deterministic:

1. dynamic value, when present;
2. binding fallback;
3. control/section default;
4. empty/null.

Theme components do not invent their own fallback semantics.

---

## 11. Storefront workspace and concurrency

### 11.1 From giant draft document to workspace

The current single `StorefrontDraft.document` evolves into a normalized `StorefrontWorkspace` with a global `generation` counter.

Each editable resource also carries its own revision.

```text
resource revision = concurrency for one editable object
workspace generation = version of the whole storefront draft state
```

### 11.2 Resource autosave

Autosave uses the resource's expected revision and validates the resource locally. It does not require the entire storefront to compile on every keystroke/save.

This permits temporary broken draft states while a merchant performs a multi-step edit.

### 11.3 Workspace generation

Every successful storefront-workspace mutation increments the workspace generation. Publish captures and verifies this generation to prevent publishing a stale compilation result.

### 11.4 Conflict behavior

A resource-level revision mismatch produces a conflict for that resource, not an unnecessary whole-store conflict.

Publish fails with a workspace-changed conflict if the generation changed after compilation started.

---

## 12. Storefront compiler

### 12.1 Responsibility

The compiler transforms normalized authoring resources into an immutable runtime storefront snapshot.

The authoring model is optimized for merchant editing. The runtime snapshot is optimized for deterministic rendering.

### 12.2 Compilation input

Compilation reads a consistent view of:

- store identity and configuration;
- current workspace generation;
- theme configuration;
- templates;
- global sections;
- menus;
- template assignments;
- metafield definitions;
- metaobject definitions;
- active extension/theme artifact manifest.

Compilation does not freeze product titles, prices, inventory quantities, metafield values, or metaobject entry values.

### 12.3 Compilation pipeline

Full publish compilation performs:

1. persisted schema validation;
2. tenant ownership/reference validation;
3. section/block registry validation;
4. reference resolution;
5. global-section validation;
6. dynamic-source type checking;
7. template-context validation;
8. navigation validation;
9. template-assignment validation;
10. required storefront invariant checks;
11. extension/artifact security and compatibility checks;
12. dependency graph generation;
13. runtime snapshot generation;
14. runtime schema validation.

### 12.4 Diagnostics

Compiler diagnostics are structured and contain:

- severity (`error` or `warning`);
- stable code;
- human-readable message;
- template/global-section/menu/resource location;
- optional section/block/field location.

Errors block publication. Warnings do not.

The editor uses diagnostic location data to offer direct navigation to the failing setting/resource.

### 12.5 Dependency graph

The compiler records dependencies such as:

- template → global section;
- template → menu;
- setting → metafield definition;
- setting → metaobject definition/field;
- section → media;
- resource → template assignment;
- workspace → extension artifact.

Dependency information powers deletion safety, usage displays, and migration diagnostics.

---

## 13. Publication model

### 13.1 Immutable whole-store publication

The current immutable-publication principle stays.

A publication freezes presentation structure and contracts, including:

- theme settings;
- template layouts;
- section/block configuration;
- static setting values;
- dynamic binding instructions;
- global section layouts;
- menu structure;
- template defaults and assignments;
- SEO defaults;
- extension manifest/artifact identity;
- compiler/runtime schema version;
- dependency manifest.

### 13.2 Live values stay live

A publication does not freeze:

- product titles/descriptions;
- prices;
- inventory;
- product media;
- collection membership;
- metafield values;
- metaobject entry values;
- page/article live content values;
- search results;
- customer/cart state.

A product title change therefore does not require a storefront republish.

### 13.3 Atomic publish algorithm

Publishing is:

```text
capture generation
      ↓
read consistent compilation input
      ↓
compile outside long transaction
      ↓
start short final DB transaction
      ↓
lock active store
      ↓
verify workspace generation unchanged
      ↓
create immutable StorefrontPublication
      ↓
update Store.currentPublicationId
      ↓
commit
```

Compilation must not run while holding the final store publication lock.

If generation changed, publication is rejected and the live storefront stays unchanged.

### 13.4 Public cache identity

Published runtime snapshots are cached by immutable publication ID. Product/content/custom-data caching remains separate.

---

## 14. Preview architecture

Preview and publication use the same compiler core and runtime schema.

Preview mode may tolerate blocking diagnostics enough to render unaffected sections and show editor-visible error placeholders, while publish mode refuses to create a publication until all blocking errors are resolved.

Preview compilation should become dependency-aware/incremental so a small settings change does not force a full-store compile. A full compile is mandatory immediately before publication.

A preview cache key includes at least:

```text
storeId + workspaceGeneration + templateId + previewResourceId
```

The generation naturally invalidates stale preview output.

---

## 15. Runtime resolver and renderer

### 15.1 Request flow

A public request resolves:

```text
Store identity
  ↓
currentPublicationId
  ↓
route/resource
  ↓
template assignment
  ↓
immutable runtime snapshot
  +
current catalog/content/custom-data values
  ↓
dynamic-source resolver
  ↓
React renderer
```

### 15.2 Render context

Sections receive a sanitized render context containing public store data, the current public resource, resolved theme tokens, allowed navigation access, and controlled storefront actions.

They do not receive Prisma, provider admin clients, Firebase Admin, server secrets, or raw private merchant records.

### 15.3 Missing live data

Ordinary live-data changes must not create public 500 responses.

Examples:

- unavailable navigation target → omit or disable according to platform policy;
- archived featured product → render configured empty state/omit the card;
- missing metafield → use fallback/default/empty semantics;
- archived metaobject entry → fallback/default/omit dependent value.

---

## 16. Editor V2 UX

### 16.1 Online Store workspace

The current Store Design route evolves into an Online Store area, conceptually containing:

- Editor;
- Navigation;
- SEO/preferences where appropriate;
- developer tools for authorized users.

Old routes may redirect for compatibility.

### 16.2 Main editor layout

The editor retains a left work panel plus a large live preview rather than adding a permanently visible right inspector.

The left panel drills down from hierarchy → section settings → block settings using the current inspector pattern.

### 16.3 Template and preview-resource selectors

The UI distinctly separates:

```text
WHAT LAYOUT AM I EDITING?
Product → Featured product

WHAT DATA AM I PREVIEWING?
Chocolate Cake
```

Changing preview data does not imply editing that resource's layout.

### 16.4 Hierarchy

The hierarchy groups Header, Template, and Footer/global regions and supports:

- drag/reorder;
- add section/block;
- duplicate;
- hide/show;
- delete;
- save as preset;
- convert to global;
- detach from global.

### 16.5 Dynamic-source picker

Compatible controls expose a dynamic-source button. The picker groups available sources by current context and custom data and hides incompatible value types.

### 16.6 Direct preview selection

Editor preview embeds selection metadata. Clicking a rendered section/block selects the corresponding editor node. Editor-only overlays never appear in the public storefront.

### 16.7 Responsive editing

Desktop/tablet/mobile preview remains. Only settings explicitly marked responsive by the section schema expose responsive overrides.

### 16.8 Theme settings

Theme settings remain semantic, including logo, colors, typography, layout, buttons, forms, cards, animations, social settings, and favicon where supported.

Merchants do not receive arbitrary CSS/JavaScript editing through the standard visual editor.

---

## 17. Navigation

Phase 1 supports multiple menus with nested items.

Menu items may target:

- Home;
- Page;
- Product;
- Collection;
- Blog;
- Article;
- Search;
- external URL;
- custom anchor.

Resource targets are stored by stable Jelly resource ID rather than by mutable handle/URL.

Header/footer theme settings select which menu IDs are used. Menu editing occurs in a dedicated navigation manager, not inside Header settings.

Menu changes participate in the storefront draft/preview/publish lifecycle.

---

## 18. Content and SEO

### 18.1 Pages

Pages are first-class content resources with:

- stable ID;
- store ID;
- title;
- handle;
- content;
- featured media;
- template assignment;
- draft/published content status;
- SEO title/description;
- social image;
- indexing visibility;
- optional advanced canonical override.

### 18.2 Blogs and articles

Phase 1 includes enough Blog/Article infrastructure to make approved templates real. It does not attempt to become a full editorial CMS.

### 18.3 Content lifecycle

Resource content publishing is separate from storefront layout publishing.

- layout/theme/menu changes → storefront workspace publication;
- products → catalog lifecycle;
- pages/articles → content lifecycle.

### 18.4 Platform SEO

Jelly, not individual themes, owns foundational output for:

- canonical generation;
- Open Graph/social metadata;
- robots/indexing behavior;
- sitemap generation;
- structured product/article data where applicable.

Themes may style presentation but do not reimplement core SEO infrastructure.

---

## 19. Media and asset library

The current media subsystem becomes a first-class store asset library.

A media record includes stable ID, store ID, type, storage key, public URL, MIME type, byte size, dimensions when applicable, original filename, alt text where appropriate, and timestamps.

Merchant settings store media references by stable media ID, not hard-coded storage URLs.

Media storage sits behind an interface with at least:

- local development storage;
- production object-storage implementation.

The compiler dependency graph replaces the current coarse referenced boolean with precise usage information where possible. Deletion is blocked when live/draft dependencies require the asset.

---

## 20. React/TypeScript Theme SDK

### 20.1 New SDK boundary

Add `@jelly/storefront-sdk` as the deliberate developer API surface.

It exposes:

- `defineSection()`;
- `defineBlock()`;
- typed control builders;
- dynamic-source compatibility metadata;
- template context types;
- extension manifest/capability contracts;
- supported API versions.

Developers do not import editor internals or backend implementation modules.

### 20.2 One definition drives the platform

A section definition supplies:

- identity/label/category;
- supported template contexts;
- control schemas;
- defaults;
- responsive fields;
- blocks and limits;
- presets;
- dynamic-source compatibility;
- render component metadata.

The editor, compiler, registry, and renderer derive behavior from the same definition.

### 20.3 Registry-driven renderer

Replace the current hard-coded `if/else` section renderer dispatch with registry-based lookup.

Built-in section components remain native and efficient. A new section no longer requires editing a central renderer switch.

### 20.4 SDK versioning

Public developer contracts use explicit API versions. Internal TypeScript implementation types are not implicitly treated as permanent public APIs.

---

## 21. Developer source and artifacts

### 21.1 Workflows

Primary workflow:

```text
repository source → Jelly CLI → validate/build → draft artifact → preview → publish
```

Secondary workflow:

```text
browser code editor → same build service → draft artifact → preview → publish
```

A developer push never directly changes production.

### 21.2 Source versus artifact

Store editable source and immutable build output separately.

```text
ThemeDeveloperSource
  editable TS/TSX files

ThemeArtifact
  immutable bundle
  manifest
  artifact hash/signature
  SDK/API version
```

The draft workspace references the current draft artifact. A publication freezes the artifact identity it expects.

This integrity mechanism is not the deferred multi-theme library feature.

### 21.3 Build pipeline

Both CLI and browser source use the same logical build service:

1. typecheck;
2. dependency/import policy validation;
3. manifest generation;
4. bundle generation;
5. artifact hash/signature;
6. artifact persistence;
7. workspace activation for preview.

---

## 22. Custom-code security

### 22.1 Hard execution boundary

Store-uploaded arbitrary TypeScript/React must never execute in:

- the merchant admin origin;
- the Next.js admin/server process;
- the Express backend process.

Authorization to edit code is not a sandbox.

### 22.2 Trust classes

Internally distinguish:

- first-party Jelly code;
- reviewed/trusted packages;
- store-custom untrusted code.

First-party/trusted code may use the native renderer according to platform policy. Arbitrary store-custom code uses the untrusted path.

### 22.3 Initial untrusted rendering boundary

The Phase 1-safe browser boundary for arbitrary store-custom React is a sandboxed iframe without `allow-same-origin`, communicating through a narrow `postMessage` capability bridge.

The sandbox receives serialized public props and semantic theme tokens. It does not receive the parent DOM, admin credentials, payment secrets, or server APIs.

### 22.4 Capability APIs

Custom sections request approved capabilities rather than invoking private APIs directly, for example:

- read public product/collection data;
- navigation actions;
- cart add/update actions;
- search actions.

No Phase 1 capability provides direct database, filesystem, payment-secret, or merchant-admin access.

### 22.5 Import policy

Store-custom code may import React and approved Jelly SDK/UI packages. Node built-ins, Prisma, Firebase Admin, child processes, filesystem access, and arbitrary unrestricted dependency trees are rejected.

### 22.6 Admin controls

Developers may compose Jelly-provided inspector control types. Phase 1 does not allow arbitrary developer React components to execute inside the merchant admin inspector.

---

## 23. Checkout and customer account boundaries

Normal storefront pages support broad visual customization.

Checkout and account surfaces remain platform-owned and expose constrained extension slots only.

Allowed Phase 1 direction includes:

- store logo and approved branding tokens;
- typography/colors within safe tokens;
- informational/trust messaging;
- approved banners;
- approved upsell/content extension blocks.

Disallowed behavior includes:

- replacing payment form internals;
- reading raw payment credentials/tokens;
- modifying authentication state through arbitrary theme code;
- injecting unrestricted JavaScript;
- allowing normal storefront theme bundles to execute inside checkout.

Checkout consumes approved branding configuration and separately sandboxed/constrained extension contracts rather than arbitrary storefront theme code.

---

## 24. Roles, capabilities, and authorization

The existing role model evolves toward explicit capabilities.

Candidate Phase 1 permissions include:

```text
storefront:view
storefront:edit
storefront:publish
content:view
content:edit
catalog:view
catalog:edit
navigation:edit
custom_data:edit
media:upload
media:delete
developer:view
developer:edit
developer:build
developer:publish
team:manage
settings:manage
```

Roles remain useful UX presets that map to capability sets.

Add a Developer role or equivalent permission set. Editing storefront design, publishing storefront design, editing source code, building artifacts, and publishing custom code are intentionally separable capabilities.

The backend validates current membership and capabilities on every protected request. Frontend store selection is never considered authorization.

---

## 25. Audit foundation

Phase 1 introduces `AuditEvent` for important store changes, including storefront publication, template/global-section/menu destructive changes, custom-data schema changes, developer artifact activation/publication, membership/role changes, and other high-risk actions.

The audit log records store, actor, action, subject identity, metadata, and timestamp. It does not log every autosave keystroke.

---

## 26. API boundaries

### 26.1 Admin API

Admin endpoints are authenticated, tenant-scoped, and permission-checked.

Conceptually:

```text
/api/admin/stores/:storeId/catalog/...
/api/admin/stores/:storeId/content/...
/api/admin/stores/:storeId/custom-data/...
/api/admin/stores/:storeId/media/...
/api/admin/stores/:storeId/storefront/...
/api/admin/stores/:storeId/developer/...
```

### 26.2 Storefront workspace API

Replace the current one-document draft API with resource-oriented operations, including:

```text
GET   /storefront/workspace
GET/POST/PATCH /storefront/templates
GET/POST/PATCH /storefront/global-sections
GET/POST/PATCH /storefront/menus
PATCH /storefront/theme-settings
PUT   /storefront/template-assignments
POST  /storefront/preview/compile
POST  /storefront/validate
POST  /storefront/publish
GET   /storefront/publication
```

Every mutable resource operation uses expected revision semantics. Publish uses expected workspace generation and should accept an idempotency key.

### 26.3 Public storefront API

Public endpoints expose sanitized public DTOs only. Internal product/provider synchronization state, supplier data, private metafields, admin fields, or raw Prisma records never cross the public boundary.

### 26.4 Internal services

Compiler, provider synchronization, and build-service APIs are internal boundaries and are not automatically exposed as browser-callable endpoints.

---

## 27. Data model direction

Exact Prisma syntax belongs in the implementation plan, but the target includes records equivalent to:

```text
StorefrontWorkspace(storeId, generation, updatedAt)
StorefrontTemplate(id, storeId, revision, type, handle, name, layoutJson)
GlobalSection(id, storeId, revision, name, sectionJson)
SectionPreset(id, storeId, name, sectionJson)
NavigationMenu(id, storeId, revision, name, handle, itemsJson)
StorefrontTemplateAssignment(storeId, resourceType, resourceId, templateId)
ThemeConfiguration(storeId, revision, themeId, settingsJson, draftArtifactId?)
StorePage(...)
Blog(...)
Article(...)
MetafieldDefinition(...)
MetafieldValue(...)
MetaobjectDefinition(...)
MetaobjectEntry(...)
Media(...)
ThemeDeveloperSource(...)
ThemeArtifact(...)
AuditEvent(...)
StorefrontPublication(id, storeId, sourceGeneration, schemaVersion, compilerVersion, documentJson, dependencyManifestJson, publishedAt)
```

All store-owned uniqueness and foreign-key rules should include `storeId` where practical so cross-tenant references are structurally difficult or impossible.

---

## 28. Migration from current V3 storefronts

Existing V3 stores migrate without taking the currently published storefront offline.

Migration importer behavior:

- current theme settings → `ThemeConfiguration`;
- Home page sections → `home.default` template;
- Product/Collection layouts → default resource templates using current supported defaults/legacy data;
- custom pages → first-class Page resources plus template assignment;
- current header/footer → global layout resources/sections;
- current section presets continue through registry/preset migration where applicable;
- existing media references are converted to stable media references when possible;
- create `StorefrontWorkspace` with initial generation;
- compile a V4 preview and surface diagnostics.

The current V3 publication remains live until the merchant explicitly publishes a successful V4 compilation. Only then does `currentPublicationId` switch to the new runtime schema publication.

Schema migration support in `@jelly/storefront-schema` remains rather than being discarded.

---

## 29. Error handling and failure safety

### 29.1 Draft errors

Local invalid edits may be rejected at the resource boundary when the resource itself is malformed, unauthorized, or revision-conflicted.

Cross-resource draft inconsistencies are allowed temporarily and appear as diagnostics.

### 29.2 Publish errors

Any blocking compiler error prevents publication and leaves the live storefront unchanged.

### 29.3 Transaction errors

Publication insertion and `currentPublicationId` switching occur in one short transaction. Failure rolls back the pointer switch.

### 29.4 Runtime errors

Renderer boundaries isolate section failures. Public rendering must prefer safe omission/fallback behavior for ordinary missing live merchant data.

Custom untrusted code failures are isolated to their sandbox and must not crash the privileged storefront host/runtime.

---

## 30. Testing strategy

Implementation must preserve and expand the current test-first patterns around schema, registry, service, and repository behavior.

### 30.1 Unit tests

Cover at minimum:

- custom-data type validation;
- dynamic binding compatibility;
- section/block SDK schema generation;
- registry validation;
- dependency graph generation;
- compiler diagnostics;
- runtime fallback semantics;
- permission mapping;
- migration functions.

### 30.2 Repository/service tests

Cover:

- tenant-scoped reads/writes;
- compound ownership constraints;
- resource revision conflicts;
- workspace generation increments;
- publish generation mismatch;
- atomic publication pointer switch;
- idempotent publish behavior;
- catalog provider synchronization contracts;
- media dependency deletion safety.

### 30.3 Renderer tests

Cover:

- template/resource resolution;
- live catalog values through frozen bindings;
- global sections;
- missing dynamic values/fallbacks;
- editor selection metadata;
- unsupported extension failure isolation;
- built-in native section rendering;
- sandbox host/capability protocol behavior.

### 30.4 End-to-end tests

Minimum critical flows:

1. create store → create product → create custom page → edit template → preview → publish → public render;
2. assign one shared Product template to multiple products and verify one template edit changes both layouts;
3. create global section → place in multiple templates → edit once → preview all placements;
4. create metafield definition/value → bind section field → publish → change value without storefront republish → public page updates;
5. create nested menu → publish → rename target handle → menu remains valid through stable resource ID;
6. concurrent resource edits do not conflict unnecessarily, but publishing stale generation fails safely;
7. build a store-custom developer artifact → preview in sandbox → publish through normal compiler → no admin/backend execution path;
8. V3 store remains live while V4 migration draft is prepared and only switches on explicit successful publish.

---

## 31. Implementation sequence

The implementation plan must follow dependency order rather than UI visibility.

### Milestone 1 — tenant, capability, and storage foundations

- explicit store context middleware/service;
- capability model and role mapping;
- tenant-scoped repository conventions/tests;
- audit-event foundation;
- media-storage abstraction and production-ready record model.

### Milestone 2 — production catalog foundation

- activate/extend Product, Variant, Collection, Inventory, Media models from the existing commerce reference;
- replace `DemoCatalog` as the production contract with a canonical catalog interface;
- retain demo catalog only as a test/dev adapter;
- add provider-neutral public catalog DTOs;
- establish Shopify/provider normalized-read-model interfaces without requiring full Shopify integration delivery in this milestone.

### Milestone 3 — custom data and dynamic types

- metafield definitions and values;
- metaobject definitions and entries;
- shared type package/contracts;
- storefront visibility rules;
- dynamic-source descriptors and compatibility validation.

### Milestone 4 — normalized storefront workspace

- workspace generation;
- templates;
- global sections;
- section presets;
- menus;
- template assignments;
- theme configuration;
- Page/Blog/Article resources where not already implemented;
- resource-level revisions.

### Milestone 5 — compiler V4 and migration

- compiler pipeline;
- structured diagnostics;
- dependency graph;
- runtime storefront schema V4;
- atomic publication from compiled snapshot;
- V3 importer/migration path;
- publication caching identity.

### Milestone 6 — runtime resolver and renderer

- render resource context;
- typed dynamic-source resolver;
- stable resource reference resolution;
- registry-driven renderer dispatch;
- fallback semantics;
- public DTO boundaries;
- preview/public shared runtime.

### Milestone 7 — editor V2

- Online Store routes/navigation;
- template selector;
- preview-resource selector;
- template hierarchy refactor;
- global section workflows;
- section preset workflows;
- dynamic-source picker;
- menu manager;
- SEO editing;
- compile diagnostics panel/navigation;
- responsive control UX.

### Milestone 8 — Theme SDK and developer artifacts

- `@jelly/storefront-sdk`;
- typed section/block builders;
- SDK API versioning;
- build manifest format;
- artifact persistence;
- CLI contracts;
- browser editor contracts;
- theme artifact identity in compilation/publication.

### Milestone 9 — untrusted sandbox and hardening

- sandboxed iframe custom-section runtime;
- capability bridge;
- import policy enforcement;
- security tests;
- performance/caching tests;
- migration rehearsal;
- publication safety tests;
- operational diagnostics and observability.

---

## 32. Acceptance criteria for Phase 1 architecture

Phase 1 is architecturally complete when all of the following are true:

- production storefront rendering no longer depends on the monolithic editable V3 `StorefrontDocument` as the authoring model;
- existing stores can migrate without disrupting their currently published storefront;
- one account can securely operate multiple stores and no cross-tenant resource access is possible through object IDs;
- a real canonical product/variant/collection catalog replaces the production demo catalog contract;
- metafields and metaobjects are typed, validated, and usable as editor dynamic sources;
- reusable templates can be assigned to multiple resources;
- presets and global sections have distinct, correct synchronization semantics;
- menus are nested, multi-menu, resource-ID based, and publication-scoped;
- full resource SEO controls exist and core SEO output is platform-owned;
- preview and public rendering use the same compiler/runtime contracts;
- publish compiles and atomically activates one immutable storefront snapshot;
- changing live price/inventory/title/metafield values does not require storefront republishing;
- compilation failures never alter the live publication;
- diagnostics point to the affected template/section/block/field;
- the renderer is registry-driven rather than centrally hard-coded per section type;
- the SDK can define a section without requiring editor-specific code changes;
- arbitrary merchant React/TypeScript cannot execute inside admin/backend privileged contexts;
- custom code uses a controlled artifact and sandbox/capability path;
- checkout/account surfaces remain isolated from arbitrary theme execution;
- all critical flows are covered by unit, repository/service, renderer, migration, and end-to-end tests.

---

## 33. Risks and design constraints

### 33.1 Scope risk

This is a large Phase 1 program, not a small editor enhancement. The implementation plan must remain milestone-based and preserve dependency ordering. UI polish must not pull catalog/compiler work out of sequence.

### 33.2 Provider risk

Shopify/provider integration must not leak provider-specific IDs or API shapes into editor/template contracts. The canonical Jelly catalog is the compatibility boundary.

### 33.3 Compiler complexity risk

The compiler can become an oversized god-module. Keep validation, dependency analysis, dynamic binding validation, artifact validation, and snapshot generation behind separate interfaces/modules with focused tests.

### 33.4 Security risk

Static analysis is not a security boundary for merchant-uploaded code. The architecture requires process/origin isolation for untrusted code and a narrow capability bridge.

### 33.5 Schema-contract risk

Metafield keys, metaobject field handles, SDK versions, and published registry manifests become durable contracts. Destructive changes require archive/migration behavior rather than casual mutation.

### 33.6 Publication consistency risk

Compilation occurs outside the final database transaction, so workspace generation must be checked again under lock immediately before publication creation/pointer switching.

---

## 34. Repository cross-check summary

This design aligns with the current repository in the following ways:

- current tenant code already resolves merchants to memberships and supports multiple stores;
- current Prisma schema already has `Store`, memberships, draft/publication concepts, and the live publication pointer;
- the dormant commerce reference already contains Product, Variant, Inventory, Collection, Media, and provider `externalId` concepts that can be activated/extended;
- current storefront service/repository already uses expected revision checks, store locking, immutable publications, and an atomic `currentPublicationId` update;
- current `storefront-schema` already has explicit schema versions and migrations;
- current registry already defines control metadata, settings schemas, page compatibility, block limits, presets, responsive fields, and validation;
- current inspector already generates UI from registry definitions;
- current renderer already has editor/public modes and editor selection metadata, but its hard-coded section dispatch is the specific extensibility point to replace;
- current themes already expose semantic token concepts that fit both no-code theme settings and sandbox token delivery;
- current media service already validates images, scopes by store, and prevents deletion of referenced assets, providing the starting point for a real asset library.

No approved design section requires discarding these foundations. The work is primarily normalization, contract promotion, compiler introduction, and security hardening around the existing architecture.

---

## 35. Final architectural principle

Jelly Shop Phase 1 is not a generic page builder and is not a clone of Shopify's UI.

It is a commerce storefront platform with stable boundaries:

```text
Tenant/Capabilities
       ↓
Canonical Catalog + Content + Custom Data
       ↓
Reusable Templates + Sections + Menus
       ↓
Typed Dynamic Sources
       ↓
Compiler + Dependency Graph
       ↓
Immutable Publication
       ↓
Runtime Resolver
       ↓
Registry-driven Renderer
       ↓
Native + Secure Sandboxed Extensions
```

That boundary structure is what allows Jelly Shop to grow later into the broader merchant operating system without rewriting the Online Store foundation again.
