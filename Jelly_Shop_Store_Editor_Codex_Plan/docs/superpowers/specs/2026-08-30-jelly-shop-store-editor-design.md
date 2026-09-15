# Jelly Shop Store Editor — Approved Design Specification

**Status:** Approved for implementation  
**Product:** Jelly Shop  
**Scope:** MVP editor with scalable foundation  
**Package manager:** npm / npm workspaces  
**Backend:** Node.js + Express + TypeScript  
**Database:** PostgreSQL on Google Cloud SQL via Prisma  
**Authentication:** Firebase Authentication / Firebase Admin  
**Frontend:** Next.js + React + TypeScript  
**Hosting:** Google Cloud Run  
**Assets:** Google Cloud Storage  

## 1. Product Goal

Build a store-design editor for Jelly Shop that gives small-business merchants strong customization without exposing raw HTML, CSS, or JavaScript.

The editor must let a merchant:
- choose from five themes;
- preserve content when changing themes;
- edit Home, Product template, Collection template, Header, and Footer;
- add, remove, duplicate, hide, and reorder sections;
- edit section-specific blocks;
- change global colors, typography, button style, spacing, and product-card presentation;
- use simple presets first and advanced controls second;
- preview Desktop and Mobile;
- autosave to a private draft;
- explicitly publish a complete draft;
- restore the previous published design;
- see the same renderer in the editor preview and the public storefront.

The MVP must be structured so future custom pages, more themes, saved sections, theme history, a theme marketplace, and a developer theme SDK can be added without replacing the core document model or renderer.

## 2. Locked Product Decisions

1. Theme switching preserves content.
2. Document hierarchy: Store → Page → Section → Block.
3. Blocks are section-specific, not freely nestable.
4. Autosave draft + explicit Publish.
5. Basic history: client undo/redo + immutable publications + one-click previous-publication restore in V1 UI.
6. Editable V1 surfaces: Home, Product template, Collection template, global Header, global Footer.
7. Styling: presets + advanced controls; no raw CSS.
8. Editor layout: left sidebar + isolated live preview.
9. Preview: iframe using the shared storefront renderer.
10. Persistence: one versioned JSONB working document plus immutable publication snapshots.
11. Concurrency: optimistic revision checking; no real-time collaborative merge.
12. Responsive behavior: automatic by default with limited Mobile overrides.
13. Section library: commerce-ready library.
14. Architecture: shared section registry + theme variants.
15. Schema-driven editor: settings controls are generated from registry metadata.
16. Theme implementation: five themes — Minimal, Classic, Bold, Elegant, Playful.
17. Theme registry is code-owned. Merchant documents store theme id + overrides, not full theme implementation.
18. Merchant content is untrusted. No raw scripts, HTML, CSS, or arbitrary iframe embeds.

## 3. V1 Section Library

### Global
- Announcement Bar
- Header
- Footer

### Home / content sections
- Hero
- Featured Collection
- Product Grid
- Category Grid
- Image + Text
- Image Banner
- Rich Text
- Testimonials
- FAQ
- Newsletter
- Contact / Store Info
- Logo / Brand List
- Spacer
- Divider

### Commerce templates
- Product Information (mandatory on Product template)
- Product Description
- Related Products
- Collection Header
- Collection Product Grid (mandatory on Collection template)

## 4. Core Document Model

```ts
export type ThemeId =
  | "minimal"
  | "classic"
  | "bold"
  | "elegant"
  | "playful";

export type PageType = "home" | "product" | "collection";

export type StoreDesignDocument = {
  schemaVersion: number;
  theme: {
    id: ThemeId;
    settings: Record<string, unknown>;
  };
  globalSettings: GlobalSettings;
  header: SectionNode;
  pages: {
    home: PageDocument;
    product: PageDocument;
    collection: PageDocument;
  };
  footer: SectionNode;
};

export type PageDocument = {
  id: string;
  type: PageType;
  sections: SectionNode[];
};

export type SectionNode = {
  id: string;
  type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  responsive?: {
    mobile?: Record<string, unknown>;
  };
  blocks: BlockNode[];
};

export type BlockNode = {
  id: string;
  type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  responsive?: {
    mobile?: Record<string, unknown>;
  };
};
```

IDs must be stable across reordering, autosave, theme changes, publish, and restore. Use UUIDv7 where the repo already supports it; otherwise `crypto.randomUUID()` is acceptable for V1.

## 5. Global Settings

```ts
export type GlobalSettings = {
  colors: {
    primary: string;
    background: string;
    text: string;
    surface: string;
    accent: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingScale: "compact" | "standard" | "large";
  };
  buttons: {
    style: "solid" | "outline";
    radius: "square" | "soft" | "rounded" | "pill";
  };
  layout: {
    containerWidth: "narrow" | "standard" | "wide";
    sectionSpacing: "compact" | "standard" | "spacious";
  };
  productCards: {
    imageRatio: "square" | "portrait" | "landscape";
    showVendor: boolean;
    showQuickAdd: boolean;
  };
};
```

Theme defaults are merged with merchant overrides and resolved into semantic CSS variables.

## 6. Section Registry

Every section is registered through one canonical contract:

```ts
export type ControlDefinition = {
  key: string;
  type:
    | "text"
    | "textarea"
    | "rich-text"
    | "select"
    | "radio"
    | "segmented"
    | "toggle"
    | "number"
    | "range"
    | "color"
    | "image"
    | "url"
    | "product-picker"
    | "collection-picker"
    | "alignment"
    | "spacing";
  label: string;
  responsive?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type SectionDefinition = {
  type: string;
  label: string;
  category: "commerce" | "content" | "social-proof" | "business" | "layout";
  supportedPages: PageType[];
  settingsSchema: unknown;
  settingsControls: ControlDefinition[];
  allowedBlocks: string[];
  minBlocks?: number;
  maxBlocks?: number;
  defaultSettings: Record<string, unknown>;
  defaultBlocks: BlockNode[];
  responsiveFields: string[];
};
```

The registry is the source of truth for valid section types, page placement, allowed blocks, limits, defaults, form controls, and responsive override eligibility.

## 7. Theme Registry

```ts
export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  tokens: ThemeTokens;
  supportedSectionTypes: string[];
  variants: {
    header: string;
    footer: string;
    productCard: string;
    button: string;
    sections: Record<string, string>;
  };
};
```

Theme definitions are code-owned. All five themes must pass a compatibility suite proving they render every canonical V1 section and both commerce templates.

## 8. Renderer Pipeline

```text
StoreDesignDocument
  → migrateDocument()
  → validateDocument()
  → resolveTheme()
  → resolveDesignTokens()
  → PageRenderer
  → SectionRenderer
  → Theme section variant
  → BlockRenderer
  → React storefront
```

Renderer boundaries:
- may depend on React, storefront schema, registry, themes, storefront UI;
- may not depend directly on Express, Firebase, Prisma, Stripe, Cloud SQL, or editor Zustand state.

```ts
export type StorefrontRenderContext = {
  document: StoreDesignDocument;
  store: PublicStore;
  route: StorefrontRoute;
  commerce: CommerceDataProvider;
  assets: AssetResolver;
  mode: "published" | "preview";
};
```

## 9. Preview Architecture

The editor shell owns the working document. The preview iframe does not autosave and does not independently fetch the draft after each change.

```text
Editor action
  → local Zustand state
  → immediate postMessage to iframe
  → debounced autosave to API
```

```ts
export type EditorToPreviewMessage =
  | { type: "DESIGN_DOCUMENT_UPDATE"; document: StoreDesignDocument }
  | { type: "VIEWPORT_UPDATE"; viewport: "desktop" | "mobile" }
  | { type: "SECTION_SELECTED"; sectionId: string | null };

export type PreviewToEditorMessage =
  | { type: "PREVIEW_READY" }
  | { type: "SECTION_CLICKED"; sectionId: string }
  | { type: "BLOCK_CLICKED"; sectionId: string; blockId: string };
```

Both sides validate `event.origin`.

## 10. Editor State

Use Zustand. The store owns the complete draft document, current revision, selection, viewport, save state, and local undo/redo history. Autosave is approximately 800 ms after editing pauses and save requests are serialized.

## 11. Persistence Model

Use three persistent concepts:
- `StoreDesign`: current working draft and pointer to live publication;
- `StoreDesignPublication`: immutable snapshot history;
- `StoreAsset`: metadata for Cloud Storage assets.

Prisma must reuse existing Store and User relations. `StoreDesign.storeId` is unique. Publication revision is unique per design.

## 12. Draft and Publication Rules

- Draft saves are whole-document JSON saves.
- Each autosave sends `expectedRevision`.
- Save succeeds only when the stored revision equals `expectedRevision`.
- Conflict returns HTTP 409 `DESIGN_REVISION_CONFLICT`.
- Publishing publishes the server-side saved draft, not a new client document.
- Publishing creates an immutable `StoreDesignPublication`.
- `StoreDesign.currentPublicationId` points to the live publication.
- Restore creates a new publication from the prior publication document instead of mutating old publication rows.
- Public storefront never reads `draftDocument`.

## 13. API Contract

```http
GET    /v1/stores/:storeId/design
PATCH  /v1/stores/:storeId/design/draft
POST   /v1/stores/:storeId/design/publish
POST   /v1/stores/:storeId/design/rollback
GET    /v1/store-editor/themes
POST   /v1/stores/:storeId/assets/uploads
POST   /v1/stores/:storeId/assets/:assetId/complete
GET    /v1/stores/:storeId/assets
DELETE /v1/stores/:storeId/assets/:assetId
GET    /v1/public/stores/:slug/storefront
```

Merchant endpoints require Firebase token verification and store-level authorization.

## 14. Asset Rules

- Actual image bytes go to Google Cloud Storage.
- API issues signed upload URLs.
- Documents store `assetId`, not raw Cloud Storage URLs.
- Asset states: `PENDING`, `READY`, `FAILED`, `DELETED`.
- Publish rejects PENDING, FAILED, DELETED, or cross-store assets.
- Asset delete is soft delete first; physical cleanup is deferred.

## 15. Commerce References

Design documents may reference products, collections, and navigation by stable ids. They must not embed price, stock, or full product snapshots.

```ts
export interface CommerceDataProvider {
  getProduct(id: string): Promise<PublicProduct | null>;
  getProducts(input: ProductQuery): Promise<PublicProduct[]>;
  getCollection(id: string): Promise<PublicCollection | null>;
  getCollectionProducts(
    collectionId: string,
    options?: ProductQuery
  ): Promise<PublicProduct[]>;
}

export interface AssetResolver {
  resolve(assetId: string): Promise<ResolvedAsset | null>;
}
```

## 16. Product Template Rules

Product template contains a mandatory `product-information` section. The merchant may configure gallery layout, image ratio, SKU visibility, inventory message, quantity control, buy-now visibility, description layout, and related-products settings. The merchant cannot delete purchase controls required for a sellable product.

## 17. Collection Template Rules

Collection template contains `collection-header` and mandatory `collection-product-grid`. It can configure description/image visibility, desktop/mobile columns, sorting, filters, pagination/load-more, and product-card options.

## 18. UX Requirements

- left sidebar + iframe preview;
- top page selector;
- Desktop/Mobile toggle;
- undo/redo;
- save state;
- Preview and Publish;
- structure rows with drag handle, visibility, context menu;
- Add Section library grouped by category;
- schema-driven settings;
- simple settings first, Advanced second;
- theme preview before Apply;
- inline publish validation errors that navigate to the offending section;
- rollback in publishing menu;
- larger-screen-first editor experience.

## 19. Security Requirements

- Verify Firebase ID token on merchant APIs.
- Resolve Jelly Shop user/business/store ownership server-side.
- Never authorize by `storeId` alone.
- Validate all design JSON against shared schemas.
- Validate cross-store product, collection, asset, and navigation references.
- No raw scripts, CSS, arbitrary HTML, or unsafe iframe embeds.
- External URLs allow only `http:` and `https:`.
- Rich text uses a restricted structured format.
- Validate iframe `postMessage` origin.
- Public storefront returns published data only.

## 20. Testing Requirements

Required automated coverage:
- schema migrations and validation;
- section registry contracts;
- block compatibility;
- theme compatibility for all five themes;
- renderer behavior and unknown-section fallback;
- iframe message validation;
- editor state actions and history;
- autosave serialization and 409 conflict handling;
- API auth and tenant isolation;
- publish transaction;
- rollback publication creation;
- asset ownership and ready-state checks;
- Product/Collection mandatory template constraints;
- end-to-end merchant editor journey;
- end-to-end public storefront uses published snapshot only;
- basic accessibility checks.

## 21. Definition of Done

Store Editor V1 is done when a merchant can:
1. open Store Design;
2. see the current draft;
3. add/edit/remove/duplicate/reorder sections;
4. edit allowed blocks;
5. change global style settings;
6. change among all five themes without losing content;
7. preview Desktop and Mobile;
8. upload and select store images;
9. select products and collections;
10. autosave without silent overwrites;
11. preview the draft in a clean preview;
12. publish;
13. see the exact publication on the public storefront;
14. continue editing without changing the live site;
15. restore the previous publication;
16. complete the primary flow with all required automated tests passing.
