# V4 Major Storefront Page Coverage Design

**Status:** Approved design

**Date:** 2026-09-22

## Purpose

Complete Milestone 2 by rendering Search, Custom Page, Blog, and Article through the same V4 publication, template-resolution, global-layout, and section-rendering architecture already proven for Home, Product, Collection, and Cart.

This milestone expands page coverage. It does not redesign compilation, immutable publication storage, activation, public snapshot loading, or draft/preview separation.

## Success Criteria

A published V4 storefront renders all of these page types through one runtime architecture:

- Home
- Product
- Collection
- Search
- Cart
- Page
- Blog
- Article

Every public V4 route follows:

```text
request
→ live store-scoped page context
→ centralized template resolution
→ active immutable V4 publication
→ global announcement/header/footer
→ shared registry section renderer
```

Editor preview follows:

```text
draft V4 workspace
→ existing compiler
→ same runtime context and template contracts
→ shared registry section renderer
```

## Existing Foundation

The implementation must reuse these existing contracts:

- `RuntimeStorefrontSnapshotV4` already recognizes `search`, `page`, `blog`, and `article` template types.
- `resolveStorefrontRoute` already implements assignment-to-default resolution for assignable resources.
- `PublishedRuntimeStorefront` already separates announcement, header, template, and footer regions and renders all regions through `RegistrySectionRenderer`.
- The publication API returns only the active immutable V4 snapshot.
- The preview compiler returns a V4 snapshot from the draft workspace.
- The editor already keeps page type, template, and preview resource as separate concepts.
- `StorePage`, `Blog`, and `Article` SQL tables and assignment resource types already exist.

The existing Search context loader is retained conceptually but expanded from ID-only results to complete renderer-ready product summaries.

## Architectural Boundaries

### Immutable presentation versus live content

The active publication owns presentation:

- theme identity and settings;
- template layouts;
- template defaults;
- resource-to-template assignments;
- global sections;
- navigation menus.

Live content storage owns page context:

- Search query and current visible product results;
- Page title, content, metadata, and publication status;
- Blog title and current published Article listing;
- Article title, excerpt, content, author/date fields when present, media metadata, and publication status.

Search query/results and live content records are never copied into the theme workspace or publication snapshot.

### One public page-context boundary

Add a SQL-backed, read-only public storefront context service in the backend. It is responsible for tenant scoping, visibility filtering, handle resolution, and mapping database records to stable public context contracts.

Its content reader is a focused `SqlPublicStorefrontContextRepository`; it does not replace or redesign the existing authenticated content service. The existing tables and indexes are sufficient, so this milestone adds no content-schema migration.

The authenticated content service already defines Page, Blog, and Article CRUD contracts, but local SQL startup does not currently provide its repository. Add `SqlContentRepository implements ContentRepository` and compose `ContentService` once in `createApp` when the configured storefront SQL executor is available and no explicit content service was injected. The editor continues using the authenticated content routes; it does not use anonymous public endpoints to discover draft resources. Explicit dependency injection remains authoritative for tests and non-local deployments.

The service exposes four operations:

```ts
interface PublicStorefrontContextService {
  search(storeId: string, rawQuery: string): Promise<SearchPageContext>;
  findPage(storeId: string, handle: string): Promise<PagePageContext | null>;
  findBlog(storeId: string, handle: string): Promise<BlogPageContext | null>;
  findArticle(
    storeId: string,
    blogHandle: string,
    articleHandle: string,
  ): Promise<ArticlePageContext | null>;
}
```

The public HTTP API is mounted once during backend startup beside the existing public snapshot and catalog services. Routes do not construct repositories or services.

Suggested HTTP shape:

```text
GET /api/public/stores/:storeId/storefront/context/search?q=...
GET /api/public/stores/:storeId/storefront/context/pages/:pageHandle
GET /api/public/stores/:storeId/storefront/context/blogs/:blogHandle
GET /api/public/stores/:storeId/storefront/context/blogs/:blogHandle/articles/:articleHandle
```

All SQL predicates include `storeId`. Missing, hidden, draft, archived, or cross-store records return no public resource rather than leaking a distinguishable state.

### Central template resolution

`resolveStorefrontRoute` remains the only template-selection boundary.

- Search is a non-resource route like Cart and uses `templateDefaults.search`.
- Page, Blog, and Article first resolve a visible live resource with a stable ID.
- The stable resource ID selects an assignment when one exists.
- Missing or incompatible assignments fall back to that page type's default template.
- Missing live resources return `not-found: resource`.
- Missing or incompatible templates return `not-found: template`.
- Section/page incompatibility remains a compiler/registry diagnostic and fails safely at runtime.

No route reads a draft workspace. The route first loads the active publication, then combines it with live context.

## Runtime Context Contracts

The shared renderer context gains explicit variants:

```ts
type StorefrontPageContext =
  | { pageType: "home"; resource: null }
  | { pageType: "cart"; resource: null; data?: CartRuntimeData }
  | {
      pageType: "search";
      resource: null;
      data: {
        query: string;
        state: "empty" | "results" | "none";
        resultCount: number;
        results: PublicProduct[];
      };
    }
  | { pageType: "product"; resource: PublicStorefrontResource }
  | { pageType: "collection"; resource: PublicStorefrontResource }
  | { pageType: "page"; resource: PublicStorefrontResource }
  | { pageType: "blog"; resource: PublicStorefrontResource }
  | { pageType: "article"; resource: PublicStorefrontResource };
```

Public context response schemas are validated at the frontend API boundary before entering template resolution or rendering. Database JSON content remains data inside the resource context; it does not become executable layout.

## Phase 1: Search

### Data behavior

The normalized query is `rawQuery.trim()`. Matching is case-insensitive and delegated to the existing public catalog service/repository.

- Empty query returns `state: "empty"`, zero results, and does not return the full catalog.
- A matching query returns only `ACTIVE` products from the requested store.
- Zero matches returns `state: "none"`; it is a valid page, never a 404.
- Catalog or context transport failure produces the existing safe route error state; it must not expose products from another source.
- Result summaries contain the data required by shared product cards, including stable ID, title, handle/href, image, and formatted or format-ready price.

### Runtime behavior

Add `{ type: "search", queryContext }` support to central route resolution. The Search default template is expanded with the same global regions as every other V4 page.

Upgrade the registry-owned `search-results` renderer to consume runtime Search context and render:

- the normalized query;
- deterministic empty-query guidance;
- a shared product-card grid for matches;
- a valid no-results message.

The route keeps the existing V3 compatibility renderer when the active document is not V4. New V4 sections do not parse V3 documents.

### Editor behavior

Search preview exposes a text field labeled `Preview query`. Its initial example value is `shoes`. The value is local editor/runtime state and is never saved into a template, theme configuration, assignment, or workspace generation.

## Phase 2: Custom Page

### Route and collision behavior

The canonical route remains:

```text
/[storeSlug]/[pageSlug]
```

Explicit Next.js route segments take precedence over the dynamic page route. A shared `RESERVED_STOREFRONT_PATHS` guard also rejects these handles defensively:

- `products`
- `collections`
- `cart`
- `search`
- `blogs`

The guard is case-normalized and tested independently, so routing behavior does not depend only on framework precedence.

### Data and template behavior

The public context service selects `StorePage` by `(storeId, handle)` and requires `status = PUBLISHED`. The live Page record owns title, content, SEO fields, featured media reference, and publication timestamps.

The resource's stable Page ID resolves:

```text
assigned Page template
→ default Page template
```

The smallest registry-owned presentation section is `page-content`, which renders the live title and supported content representation. It does not persist or duplicate Page content in section settings.

For this milestone, the supported content representation is deliberately small and safe: renderer helpers extract plain text from string `body`/`text` fields and recursively from text-bearing structured nodes. Raw HTML is never injected with `dangerouslySetInnerHTML`, and unknown JSON shapes render an empty body rather than serialized implementation data. The original content object remains available in runtime context for later richer content work.

The existing V3 custom-page renderer remains the fallback for V3 storefronts.

### Editor behavior

Page preview resources come from real current-store Page records. Changing the preview Page changes only context. It does not change the active template or write a template assignment.

## Phase 3: Blog

### Canonical route

```text
/[storeSlug]/blogs/[blogSlug]
```

`blogs` is reserved from the custom Page catch-all.

### Data and template behavior

The public context service resolves Blog by `(storeId, handle)`, then loads Articles belonging to that Blog and Store with `status = PUBLISHED`. Article ordering is deterministic: newest `publishedAt` first, then stable ID as a tie breaker.

The Blog context contains the live Blog and public Article summaries. Article lists are never stored in theme configuration or publication data.

The Blog's stable ID resolves:

```text
assigned Blog template
→ default Blog template
```

Add the minimum registry-owned sections:

- `blog-header` for live Blog identity;
- `article-list` for the visible Article summaries.

No separate CMS renderer is introduced.

### Editor behavior

Blog preview resources are real current-store Blogs. Their Article summaries come from current content state. Preview selection remains independent from template assignments.

## Phase 4: Article

### Canonical route

```text
/[storeSlug]/blogs/[blogSlug]/[articleSlug]
```

The context service resolves both handles under one Store and requires the Article to belong to the resolved Blog. Cross-Blog and cross-Store handle combinations return not found.

### Data and template behavior

Only `PUBLISHED` Articles are public. The live Article context owns title, excerpt, body, publication date, media/content metadata, and SEO fields. The current Article schema has no author field, so this milestone does not invent an author or add a persistence migration; a later content-domain change may add it without changing template resolution.

The Article's stable ID resolves:

```text
assigned Article template
→ default Article template
```

Add an `article-content` registry section that renders live Article context. It does not copy Article content into theme JSON.

Article content uses the same safe plain-text extraction contract as Page content. Unknown structured content remains present in context but is not rendered as raw HTML.

### Editor behavior

Article preview resources are real current-store Articles and retain their Blog identity. Changing preview Article does not write an assignment or change the selected template.

## Shared Public Route Composition

Each V4 public route uses the same high-level client composition:

1. Resolve the current Store identity from the route's `storeSlug`.
2. Load the active immutable public V4 publication by `storeId`.
3. Load live, public, store-scoped page context.
4. Adapt the context to `PublicStorefrontResource` or Search runtime data.
5. Call `resolveStorefrontRoute`.
6. Render `PublishedRuntimeStorefront`.

Shared hooks/loaders may remove duplication, but must retain explicit loading, not-found, and compatibility states. A failed live-context request cannot cause a draft or legacy publication read for a V4 storefront.

## Editor Completion

The editor supports these distinct values for all eight page types:

- Page type;
- template being edited;
- preview resource/context;
- persisted template assignment.

The template selector remains filtered to the selected page type. Preview resources are supplied independently:

- Home: none;
- Product: real Product;
- Collection: real Collection;
- Search: runtime preview query;
- Cart: runtime cart fixture/state;
- Page: real StorePage;
- Blog: real Blog;
- Article: real Article.

Changing Page type selects an available template of that type but does not create an assignment. Changing a preview resource/context does not change the template or assignment. Assignment changes continue only through the explicit assignment API.

Preview renders the compiled draft snapshot through the same runtime context and registry renderer used publicly.

## Publication Isolation

Every new public route is verified against:

```text
Publication A active
→ Draft B exists
→ route renders layout from A with current live context

Publish B
→ route renders layout from B with current live context
```

This distinction is intentional: content remains live, while presentation remains pinned to the active immutable publication. Editing Page or Article content may change the public content immediately once that content is published, but editing a theme template does not affect public presentation until activation.

## Error and Visibility Rules

- Empty Search query: rendered empty state, HTTP page remains valid.
- No Search matches: rendered zero-results state, not 404.
- Missing/default template: safe not-found result; no incompatible renderer invocation.
- Draft Page or Article: public not found.
- Missing Blog: public not found.
- Article under a different Blog: public not found.
- Cross-store handles or IDs: public not found.
- Hidden, draft, or archived Products: excluded from Search.
- Invalid public context payload: fail closed at the frontend schema boundary.
- Unsupported section for a page type: compiler diagnostic; published renderer never interprets it as another page type.

## Testing Strategy

Each phase follows test-driven development and leaves the repository buildable.

### Search

- query normalization;
- deterministic empty query;
- matching and zero-result states;
- current-store isolation;
- ACTIVE-only Product filtering;
- default Search template resolution;
- global announcement/header/footer;
- publication A/B isolation;
- editor preview query remains non-persistent.

### Page

- handle resolution;
- `PUBLISHED` visibility;
- store isolation;
- assignment and default fallback;
- live content changes without theme JSON changes;
- reserved-path guard;
- V3 compatibility fallback;
- editor preview resource independence;
- publication A/B isolation.

### Blog

- Blog handle resolution;
- published Article filtering and ordering;
- store and Blog isolation;
- assignment/default resolution;
- shared renderer/global regions;
- editor real-resource preview;
- publication A/B isolation.

### Article

- nested Blog/Article handle resolution;
- `PUBLISHED` visibility;
- Blog and Store isolation;
- live content context;
- assignment/default resolution;
- shared renderer/global regions;
- editor real-resource preview;
- publication A/B isolation.

### Final cross-page gate

- all eight major page types resolve through shared V4 runtime contracts;
- incompatible section/page combinations fail safely;
- V3 compatibility tests remain green;
- focused backend/frontend tests pass;
- relevant PGlite integration tests pass;
- backend and frontend TypeScript/build commands pass;
- known unrelated baseline failures are reported without being absorbed into this milestone.

## Out of Scope

- Compiler redesign.
- Publication repository or activation redesign.
- Draft/public separation changes.
- Multiple installed themes or `themeId` in workspace/publication identity; identity remains `storeId`.
- SQL-backed metafield/metaobject dynamic bindings.
- New V3 functionality or V4 sections that understand V3 documents.
- Theme Store marketplace UI.
- Richer Product/Collection commerce capability such as galleries, variant pickers, filtering, recommendations, and inventory presentation.

## Completion Boundary

After Search, Page, Blog, and Article are public and editor-preview capable through the shared V4 architecture, Milestone 2 stops. The next work is merchant-facing theme capability, not another runtime architecture redesign.
