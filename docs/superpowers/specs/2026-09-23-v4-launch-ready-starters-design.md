# V4 launch-ready starter storefronts — design spec

Date: 2026-09-23
Status: proposed design for review; documentation only, no implementation has started.

## Goal and non-goals

A new merchant chooses Fresh Market or Artisan Boutique and receives a complete, editable V4 storefront workspace. They should be able to edit the obvious content, use their own media and catalog, preview the same draft at desktop and mobile widths, validate it, preview it, and publish through the existing V4 flow. They do not assemble the required pages themselves.

This does not add a marketplace, theme SDK, payment or delivery redesign, multi-installed-theme system, checkout extensions, or V3 migration. It does not replace the immutable publication pipeline, live catalog, content model, registry, renderer, or store-scoped security boundaries.

## Current flow and gaps

The Online Store chooser at `jellyshops/src/app/admin/online-store/page.tsx` currently calls `saveThemeConfiguration` for a selected catalog theme. The route persists theme settings; it does not install templates, globals, or menus. The editor at `jellyshops/src/app/admin/online-store/editor/page.tsx` reports “No theme installed” when its template list is empty and can create a default layout later when a merchant changes page type. The existing starter definitions in `jellyshops/packages/storefront-registry/src/theme-packs.ts` generate V3 `StoreDesignDocument`s, use random IDs, cover only a subset of page types, include external sample image URLs, and refer to example collection IDs. They are not an idempotent V4 installation contract.

Current path:

```text
Choose theme → save ThemeConfiguration → editor may still have no templates
                                      ↘ merchant creates templates/layouts manually
```

V4 already has store-scoped workspace tables and a compiler/reader/publication path. `StorefrontWorkspace`, `StorefrontTemplate`, `GlobalSection`, `NavigationMenu`, `ThemeConfiguration`, and `StorefrontTemplateAssignment` are represented in the current SQL migration and read by the SQL V4 compiler data source. The V4 template type enum and runtime snapshot schema currently omit `not-found`; the shared schema `PageType` and section registry already know that page type and the registry has a `not-found-message` section. This is a model/runtime consistency gap, not a reason to create a separate route or renderer.

## Target flow

```text
Choose Fresh Market / Artisan Boutique
  → authenticated store-scoped install endpoint
  → validate immutable V4 starter definition
  → one atomic installation transaction
  → normalized V4 workspace + starter installation marker
  → navigate into the existing editor for that store
  → edit draft content/media/theme and select live catalog resources
  → same shared desktop/mobile draft renderer
  → Validate → Preview → Publish via the current V4 pipeline
```

The editor does not construct starter layouts. A proposed endpoint is `POST /api/stores/:storeId/storefront/starters/:starterId/install`, added to the existing workspace router and API composition. It accepts an expected starter version (or pins the current version server-side) and returns the existing workspace summary plus installed starter identity/generation. Authorization follows the existing store-scoped workspace routes. The UI replaces the theme-settings-only click with this installation call, then opens the editor after success.

## Normalized starter-pack contract

Add a V4 starter definition alongside the legacy V3 theme-pack exports, for example `V4StarterPack` in `jellyshops/packages/storefront-registry/src/v4-starter-packs.ts`. Keep legacy exports available until their consumers are deliberately retired; the new installer consumes only the normalized V4 contract.

Proposed contract (field names are the contract; IDs in definitions are pack-local keys, never persisted row IDs):

```ts
type V4StarterPack = {
  id: "fresh-market" | "artisan-boutique";
  version: string; // immutable semantic version, initially 1.0.0
  name: string;
  description: string;
  previewAsset: string;
  theme: {
    themeId: string; // resolves through the existing theme registry
    settings: Record<string, unknown>;
  };
  globalSections: Array<{
    key: "announcement" | "header" | "footer";
    name: string;
    section: SectionNode;
  }>;
  menus: Array<{
    key: "main";
    name: string;
    handle: "main";
    items: MenuItem[];
  }>;
  templates: Array<{
    key: string;
    type: "home" | "product" | "collection" | "cart" | "search" | "page" | "blog" | "article" | "not-found";
    handle: "default";
    name: string;
    layout: Record<string, unknown>; // existing compiler layout/SectionNode shape
  }>;
  resourceReferences: Array<{
    key: string;
    resourceType: "product" | "collection" | "page" | "blog" | "article";
    required: false;
    initialResourceId: null;
  }>;
};
```

`validateV4StarterPack` checks exactly one `default` template for each required page type; registered sections and blocks; section/page and region compatibility; required Home/product/collection/cart/search/content layouts; required announcement/header/footer globals; unique pack-local keys; valid menu targets; safe settings/media references; supported theme ID/version; and resource references that are optional and unresolved at installation. Completeness validation runs in tests and again at installation so malformed bundled data cannot create partial workspaces. Starter definitions use deterministic pack-local keys; the installer creates one random `starterInstallationId` and derives globally unique persisted IDs from it (the SQL tables use globally primary-keyed `id` columns). Repeating an installation cannot create duplicate rows.

The two packs share the contract and renderer but not composition or tokens. Fresh Market is bright, warm, produce-oriented and compact; Artisan Boutique is quiet/editorial with restrained accent colors, considered whitespace and softer product presentation. Both remain restrained and responsive. Neither receives a starter-specific component or route.

## Installed workspace records

For an empty store, one successful transaction creates or initializes:

| Record | Count / content |
|---|---|
| `StorefrontWorkspace` | One row; generation advances once for the installation and stores nullable `starterPackId`, `starterPackVersion`, and `starterInstallationId` provenance columns. |
| `ThemeConfiguration` | One row containing selected theme ID/version and settings; no published artifact. |
| `StorefrontTemplate` | Nine `default` templates: Home, Product, Collection, Cart, Search, Page, Blog, Article, Not Found. Each uses the existing V4 layout JSON shape and registry section IDs. |
| `GlobalSection` | Announcement, header, and footer, represented through the existing shared section contract. |
| `NavigationMenu` | One `main` menu with only targets that are valid before merchant content exists (Home and Search; no fake Product/Collection/Page resource IDs). |
| `StorefrontTemplateAssignment` | None initially. Default templates cover generic resources; a merchant-selected real resource can be assigned later through the existing assignment API. |
| Presets / catalog / content | None. No fake products, collections, memberships, prices, inventory, pages, blogs, or articles are inserted. |

The compiler currently derives `templateDefaults` from templates whose handle is `default`; installing all nine templates therefore establishes all page defaults once Not Found is added to the backend template enum and runtime snapshot schema. Home sections use live catalog queries (not baked sample products). A resource-dependent section with no selected resource renders its useful empty/configuration state; it must not make installation or compilation fail solely because the merchant has not created catalog/content records.

## Install, retry, and overwrite semantics

* **First install:** permitted only when the store has no meaningful V4 workspace state. A generation-zero `StorefrontWorkspace` row created by other initialization code counts as empty. The install marker, theme, templates, globals, menu, and generation update commit atomically; any error rolls back all of them.
* **Same-pack retry:** if the marker matches starter ID and version, return the already-installed workspace and generation without writing rows or incrementing generation. An idempotency key may be accepted for request replay, but marker uniqueness is the durable guarantee.
* **Concurrent first requests:** serialize by store in the transaction (lock/create the workspace row and re-check state after obtaining the lock); exactly one install wins and the other sees the same-pack retry or a conflict.
* **Different starter / existing workspace:** return a typed 409 conflict without deleting, replacing, or merging anything. This includes theme configuration without a marker because the system cannot know whether those settings are customized. Switching packs and explicit destructive replacement are out of scope; no silent overwrite path is added.
* **Partial prior writes:** should be impossible for new installs due to the transaction. If legacy data is present without a marker, fail closed and direct the merchant to the existing editor/recovery support rather than guessing or deleting.

The new chooser must invoke installation directly rather than first saving ThemeConfiguration, so a new store remains empty until the installation transaction. No install code runs in a route-specific branch: the endpoint delegates to a single installer service/repository boundary.

## Media and image editing contract

The repository already has authenticated store-scoped image upload (`POST /api/stores/:storeId/media`), media records containing `id`, `storeId`, `url`, MIME type, dimensions, and alt text, public retrieval, and deletion protection for referenced media. The editor API already exposes `uploadMedia`. Use that path, not embedded binary data and not starter-specific upload logic.

An image setting stores a JSON media reference resolved by the existing V4 media/reference contract, including the media ID, URL, alt text, and optional crop/focal-point data where supported. The implementation must verify and use the exact current V4 field shape rather than silently substituting the V3 `MediaReference`. The reference and owning store are validated on save/compile; uploaded bytes remain in media storage. Publication snapshots preserve the reference only. Public rendering resolves the persisted safe URL and renders an ordinary image; it never runs merchant markup. Preview and publication use the same shared renderer and section data.

Starter defaults may use bundled/static safe media URLs only when they are ordinary image references supported by the current renderer. They do not create fake per-store Media rows. Upload/choose replaces the reference in the draft. If the merchant removes an image, the reference is absent and the existing empty-image presentation is used; no image is invented.

The shared `image-with-text` definition needs a real image setting/control and the shared renderer must render image, heading/text/button blocks with safe links, alt text, responsive image proportions, and a useful no-image state. This fix is reusable wherever registry compatibility permits; it is not special-cased by starter ID.

## Product and content resource contract

Product and Collection data remain owned by Catalog; Page/Blog/Article data remain owned by the content repositories. A starter persists no authoritative sample commerce/content records and no invalid foreign resource IDs. Product-grid/featured-product sections query the existing store-scoped `CommerceDataProvider`; an empty catalog renders a concise empty state. Collection/product references remain optional; when a merchant chooses one, the section stores only the real resource ID. Preview and public runtime resolve it through the same current-store context/provider. Tests must prove Store A records never appear in Store B.

The old sample `collectionId` values in the V3 pack definitions (`fruit-favorites`, `all-jellies`) must not be copied into V4 templates. The initial `main` menu avoids resource targets that cannot yet resolve. Page/blog/article template presentation is installed even when no content resources exist.

## Page, region, and Not Found behavior

Add `not-found` to the backend `StorefrontTemplateType` enum/repository union and `templateTypes`, SQL migration enum change, editor client type, compiler runtime snapshot schema, and any route/resource resolver type that needs the template default. The shared schema `PageType` and registry already include it. A default `not-found` template uses the registered `not-found-message` section; runtime falls back to the compiled `not-found` default for unresolved routes. Do not add a starter-specific 404 route or bypass normal snapshot validation. Verify all page types still resolve their `default` template after compile/publication.

Required starter layouts use current registry contracts:

* Home: editable hero (heading, summary, CTA, image), live product merchandising, one or two useful supporting sections, no fake testimonials presented as real customer claims.
* Product: existing gallery, information/price, options, purchase controls, description, and related-product sections in an intentional order.
* Collection: existing header, live collection product grid/card presentation, description, supported sort/filter settings only.
* Cart: existing cart summary/checkout progression and empty state.
* Search: existing controls/results and empty state.
* Page: page content with readable width and spacing.
* Blog: blog heading and article list.
* Article: article heading and content.
* Not Found: branded message and safe link to Home.
* Globals: announcement (where useful), header/main navigation, footer.

Section order and settings live in the installed templates/global sections and remain editable through the existing workspace/editor path.

## Responsive preview and simple editing

Keep one set of templates and one shared renderer. The editor's existing viewport switching/rendering path should offer desktop and mobile at minimum; do not store separate mobile layouts. Theme and section responsive CSS/settings control presentation. Verify both packs at representative desktop and narrow widths (1440, 820, 390, and 320 px), especially global navigation, hero, product gallery/purchase, grids, cart, blog/article content, and overflow. If editor viewport controls already meet the behavior, retain and test them rather than inventing a second preview system.

The default path should expose the obvious controls first: store identity/logo, main navigation, hero copy/image/CTA, theme colors, Product/Collection sections, and footer content. Advanced templates and registry details remain available but should not obstruct the default route into editing.

## Test and acceptance matrix

| Area | Required evidence |
|---|---|
| Starter definitions | Both packs pass exact completeness, section-registry, region/page compatibility, theme token, resource-reference, and unique-key checks; they have distinct layouts/settings. |
| Installation service/repository | PGlite first install creates all expected store-scoped rows atomically; one generation increment; same-pack retry is a no-op; different pack/existing custom workspace conflicts without mutation; injected failure rolls back; concurrent attempts do not duplicate; Store B remains unchanged. |
| Route and chooser | Auth/store scope enforced; invalid starter rejected; successful selection calls install once and enters editor; no pre-save settings-only path; conflict gives non-destructive recovery message. |
| Compiler and page coverage | Real installed Fresh Market workspace compiles; all nine `templateDefaults` exist; each required global resolves; unknown page selects Not Found; no fake resource IDs; Store B data absent. |
| Media | Upload/reference path preserves media ID/URL/alt through editor draft, compile, publication and public render; same image-with-text works without image; unsafe/mismatched-store reference rejected. |
| Catalog/content | Empty product/collection state is valid; real same-store Product appears through the existing provider; real selected Collection reference works; no fake Product or membership is created; Store isolation holds. |
| Preview/publication | Edit hero copy and image, desktop/mobile preview shows current draft; Validate diagnostics remain compiler diagnostics; Preview and Publish use the same compiled document; publish does not mutate draft records; public routes work for Home, Product, Collection, Cart, Search, Page, Blog, Article and Not Found. |
| Responsive and regression | Both packs tested at 1440/820/390/320px for basic usability and horizontal overflow; V4 compiler, runtime/publication, editor, catalog/content and V3 compatibility tests remain green. |

End-to-end Fresh Market journey: create a fresh store → choose pack → verify complete V4 workspace and editor entry → edit hero → upload/select image → add/select a real Product → verify live product section → desktop and mobile preview → Validate → Preview → Publish → exercise all public page routes. Artisan Boutique is separately installed into another fresh store and passes the same structural completeness and design-distinction checks.

## Open implementation checks (not scope changes)

During implementation, confirm the exact current V4 media-reference property shape, theme-registry IDs/versions for both packs, editor viewport controls, runtime not-found route selection, and transaction API available to the local and hosted workspace repositories. Resolve these against existing contracts before coding; do not introduce a second media, renderer, or transaction architecture.
