# V4 Major Storefront Page Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Search, Custom Page, Blog, and Article through the active V4 publication, live store-scoped context, centralized template resolution, global layout, and shared section renderer, with equivalent draft editor previews.

**Architecture:** Add SQL-backed content persistence and one public context service, then feed its validated live data into the existing V4 publication and `resolveStorefrontRoute` contracts. Each route uses the shared `PublishedRuntimeStorefront`; editor preview uses the existing compiler and the same runtime contexts. The four public page phases remain independently buildable and preserve V3 compatibility without extending V3.

**Tech Stack:** TypeScript, Express, PostgreSQL/PGlite, Zod, Next.js App Router, React 19, Vitest, Testing Library, `@jelly/storefront-schema`, `@jelly/storefront-registry`, `@jelly/storefront-renderer`.

**Spec:** `docs/superpowers/specs/2026-09-22-v4-page-coverage-design.md`

## Global Constraints

- Reuse the existing V4 compiler, immutable publication repository, atomic activation, public snapshot reader, and draft/preview separation.
- Public presentation comes only from the active immutable publication; public routes never read the draft workspace.
- Search results and Page/Blog/Article content remain live context and are never persisted into theme JSON or a publication.
- Every SQL read and mutation carries `storeId`; cross-store records fail closed.
- V4 storefronts use V4 runtime; V3 storefronts retain compatibility rendering only. Do not teach V4 sections to parse V3 documents.
- Workspace/publication identity remains `storeId`; do not introduce `themeId` identity.
- SQL metafield/metaobject dynamic bindings remain out of scope.
- Do not start richer Product/Collection capability or Theme Store marketplace UI.
- Use RED → GREEN → REFACTOR for every behavior change and keep the repository buildable after every task.

## Review Focus

- An empty Search query must not accidentally return the entire catalog; Task 3 pins this at service, API, and renderer boundaries.
- A cross-store or wrong-Blog content handle must be indistinguishable from missing content; Tasks 2, 4, 5, and 6 pin every SQL predicate and HTTP result.
- A Draft B must never affect a public route while Publication A is active; Task 8 proves all new route types against A → draft B → publish B.
- Reserved paths with case or percent-decoding differences must not fall into Custom Page routing; Task 4 tests normalized route guards and explicit-route precedence.
- Changing editor preview context must not write an assignment or switch the selected template; Task 7 tests every new page type and Search query state.

---

### Task 1: Provide Real SQL Content Persistence at Backend Startup

**Files:**
- Create: `backend/src/content/sql-repository.ts`
- Create: `backend/src/content/sql-repository.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/app.local-v4.test.ts`

**Interfaces:**
- Consumes: existing `ContentRepository`, `PageRecord`, `BlogRecord`, `ArticleRecord`, `SqlExecutor`, and existing `StorePage`/`Blog`/`Article` tables.
- Produces: `SqlContentRepository implements ContentRepository` and default `ContentService` composition when `storefrontSql` exists.

- [ ] **Step 1: Write failing PGlite repository tests**

Use `createPGliteDatabase()` and seed Store A and Store B. Cover literal outcomes:

```ts
const page = await repository.createPage(pageInput("store-a", "about"));
expect(await repository.getPage("store-a", page.id)).toMatchObject({
  storeId: "store-a",
  handle: "about",
  status: "DRAFT",
  content: { blocks: [{ type: "paragraph", text: "Hello" }] },
});
expect(await repository.getPage("store-b", page.id)).toBeNull();

const blog = await repository.createBlog(blogInput("store-a", "journal"));
const article = await repository.createArticle(articleInput("store-a", blog.id, "opening-day"));
expect((await repository.listArticles("store-a", blog.id)).map(({ id }) => id)).toEqual([article.id]);
expect(await repository.updateArticle("store-b", article.id, { title: "Leaked" })).toBeNull();
```

Also prove Page/Blog/Article updates preserve immutable IDs and ownership, nullable fields clear correctly, JSON content is reread independently after caller mutation, duplicate handles fail through database constraints, and a second repository instance sees committed rows.

- [ ] **Step 2: Run the repository test to verify RED**

Run: `cd backend && npm test -- --run src/content/sql-repository.test.ts`

Expected: FAIL because `SqlContentRepository` does not exist.

- [ ] **Step 3: Implement row mapping and store-scoped CRUD**

Implement constructor defaults:

```ts
export class SqlContentRepository implements ContentRepository {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly id: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}
}
```

All reads and updates use both ID and `storeId`. Inserts supply `randomUUID()`, JSON-serialize `content`, and write `updatedAt`. Map timestamps to `Date`, nullable fields to `null`, and content through a structured clone. Build updates only from present patch keys; return `null` when `RETURNING` yields no row.

- [ ] **Step 4: Verify repository GREEN**

Run: `cd backend && npm test -- --run src/content/sql-repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing startup-composition tests**

Extend `app.local-v4.test.ts` with real PGlite calls proving:

```ts
const created = await authed(app)
  .post("/api/stores/store-a/content/pages")
  .send({ title: "About", handle: "about", content: { body: "Hello" } });
expect(created.status).toBe(201);
expect((await authed(app).get("/api/stores/store-a/content/pages")).body)
  .toEqual([expect.objectContaining({ id: created.body.id, handle: "about" })]);
```

Assert an explicitly injected `contentService` wins over automatic composition and `storefrontSql: null` leaves the existing route-unavailable behavior unchanged.

- [ ] **Step 6: Compose `ContentService` once in `createApp`**

Add:

```ts
const contentService = dependencies.contentService ??
  (storefrontSql ? new ContentService(new SqlContentRepository(storefrontSql)) : undefined);
```

Pass `contentService` through the shared dependency object used by `mountContentRoutes`; never instantiate it inside a route.

- [ ] **Step 7: Run Task 1 gates**

Run:

```text
cd backend
npm test -- --run src/content/service.test.ts src/content/routes.test.ts src/app.local-v4.test.ts
npm test -- --run src/content/sql-repository.test.ts
npm run typecheck
npm run build
```

Expected: all focused tests, integration, TypeScript, and build pass.

- [ ] **Step 8: Commit**

```text
git add backend/src/content/sql-repository.ts backend/src/content/sql-repository.test.ts backend/src/app.ts backend/src/app.local-v4.test.ts
git commit -m "feat: persist local storefront content in sql"
```

---

### Task 2: Add the Shared Public Storefront Context Boundary

**Files:**
- Create: `backend/src/storefront/context/types.ts`
- Create: `backend/src/storefront/context/sql-repository.ts`
- Create: `backend/src/storefront/context/sql-repository.test.ts`
- Create: `backend/src/storefront/context/service.ts`
- Create: `backend/src/storefront/context/service.test.ts`
- Create: `backend/src/storefront/context/routes.ts`
- Create: `backend/src/storefront/context/routes.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/app.local-v4.test.ts`
- Create: `jellyshops/src/features/storefront/public-page-context-api.ts`
- Create: `jellyshops/src/features/storefront/public-page-context-api.test.ts`

**Interfaces:**
- Consumes: `CatalogReader.listPublicProducts`, `SqlExecutor`, existing content tables, and public store ID.
- Produces: one `PublicStorefrontContextService`, anonymous context routes, and schema-validated frontend client methods.

- [ ] **Step 1: Define the wished-for context contract in failing service tests**

Create exact types:

```ts
export interface PublicSearchProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  imageUrl: string | null;
  priceMinor: number;
}

export interface SearchPageContext {
  type: "search";
  query: string;
  state: "empty" | "results" | "none";
  resultCount: number;
  results: PublicSearchProduct[];
}

export interface PagePageContext { type: "page"; page: PublicPageRecord }
export interface BlogPageContext { type: "blog"; blog: PublicBlogRecord; articles: PublicArticleSummary[] }
export interface ArticlePageContext { type: "article"; blog: PublicBlogRecord; article: PublicArticleRecord }
```

The Search test must prove whitespace returns `{ query: "", state: "empty", resultCount: 0, results: [] }` without invoking the catalog. Matching and zero-result tests use literal product summaries and prove the service invokes `listPublicProducts(storeId, { query, limit: 100 })`.

- [ ] **Step 2: Write failing SQL public-context tests**

Insert Page/Blog/Article rows for Stores A and B. Assert:

```ts
await expect(repository.findPublishedPageByHandle("store-a", "about"))
  .resolves.toMatchObject({ id: "page-a", title: "About A" });
await expect(repository.findPublishedPageByHandle("store-b", "about"))
  .resolves.toMatchObject({ id: "page-b", title: "About B" });
await expect(repository.findPublishedPageByHandle("store-a", "draft-page"))
  .resolves.toBeNull();

await expect(repository.findPublishedArticleByHandles("store-a", "news", "launch"))
  .resolves.toMatchObject({ article: { id: "article-a" }, blog: { id: "blog-a" } });
await expect(repository.findPublishedArticleByHandles("store-a", "other-blog", "launch"))
  .resolves.toBeNull();
```

Prove Blog Article summaries include only `PUBLISHED` rows for the same Store and Blog, ordered by `publishedAt DESC, id ASC`.

- [ ] **Step 3: Verify RED**

Run:

```text
cd backend
npm test -- --run src/storefront/context/service.test.ts
npm test -- --run src/storefront/context/sql-repository.test.ts
```

Expected: FAIL because the context service/repository are absent.

- [ ] **Step 4: Implement service and SQL repository**

The repository API is read-only:

```ts
export interface PublicStorefrontContextRepository {
  findPublishedPageByHandle(storeId: string, handle: string): Promise<PublicPageRecord | null>;
  findBlogByHandle(storeId: string, handle: string): Promise<PublicBlogRecord | null>;
  listPublishedArticles(storeId: string, blogId: string): Promise<PublicArticleSummary[]>;
  findPublishedArticleByHandles(storeId: string, blogHandle: string, articleHandle: string): Promise<ArticlePageContext | null>;
}
```

Every SQL query includes `storeId`; Page and Article predicates require `status = 'PUBLISHED'`. `findPublishedArticleByHandles` joins `Article` to `Blog` on both `storeId` and `blogId`.

The service normalizes handles with `decodeURIComponent(value).trim().toLowerCase()` only after catching malformed encodings and returning `null`. It maps Catalog products without returning DRAFT/ARCHIVED state.

- [ ] **Step 5: Write failing route tests and implement anonymous routes**

Mount `createPublicStorefrontContextRouter(service)` at:

```text
/api/public/stores/:storeId/storefront/context
```

Test Search 200 for empty/results/none and 404 for missing Page/Blog/Article. Assert the route always supplies `request.params.storeId` and strips any caller-supplied store identity. Use these concrete paths:

```text
/search?q=shoes
/pages/about
/blogs/news
/blogs/news/articles/opening-day
```

- [ ] **Step 6: Compose the context service once in `createApp`**

Add an optional explicit `publicStorefrontContextApi` dependency. When SQL and catalog are available and no override exists, construct one SQL context repository and service. Mount no fallback router when dependencies are absent; the normal 404 handler remains authoritative.

- [ ] **Step 7: Write the failing frontend client contract test**

Create Zod schemas and a client:

```ts
export interface PublicPageContextApi {
  search(storeId: string, query: string): Promise<SearchPageContext>;
  findPage(storeId: string, handle: string): Promise<PagePageContext | null>;
  findBlog(storeId: string, handle: string): Promise<BlogPageContext | null>;
  findArticle(storeId: string, blogHandle: string, articleHandle: string): Promise<ArticlePageContext | null>;
}
```

The test asserts encoded paths, `null` on HTTP 404, exceptions on other non-2xx responses, and rejection of malformed JSON before renderer use.

- [ ] **Step 8: Run Task 2 gates**

Run:

```text
cd backend
npm test -- --run src/storefront/context/service.test.ts src/storefront/context/routes.test.ts src/app.local-v4.test.ts
npm test -- --run src/storefront/context/sql-repository.test.ts
npm run typecheck
cd ../jellyshops
npm test -- --run src/features/storefront/public-page-context-api.test.ts
npm run typecheck
```

- [ ] **Step 9: Commit**

```text
git add backend/src/storefront/context backend/src/app.ts backend/src/app.local-v4.test.ts jellyshops/src/features/storefront/public-page-context-api.ts jellyshops/src/features/storefront/public-page-context-api.test.ts
git commit -m "feat: add public storefront page contexts"
```

---

### Task 3: Migrate Search to the Published V4 Runtime

**Files:**
- Modify: `jellyshops/src/features/storefront/page-context-loaders.ts`
- Modify: `jellyshops/src/features/storefront/page-context-loaders.test.ts`
- Modify: `jellyshops/src/features/storefront/resource-loader.ts`
- Modify: `jellyshops/src/features/storefront/resource-loader.test.ts`
- Modify: `jellyshops/packages/storefront-renderer/src/types.ts`
- Modify: `jellyshops/packages/storefront-renderer/src/render-registry.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/sections/theme-pack-sections.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx`
- Modify: `jellyshops/src/app/[storeSlug]/search/page.tsx`
- Create: `jellyshops/src/app/[storeSlug]/search/page.test.tsx`
- Modify: `jellyshops/src/features/storefront/published-v4-routes.test.ts`

**Interfaces:**
- Consumes: active public V4 snapshot and `SearchPageContext` from Task 2.
- Produces: `{ type: "search", context }` route resolution and runtime-aware `search-results` rendering.

- [ ] **Step 1: Write failing Search resolution tests**

Add a Search template with global announcement/header/footer and assert:

```ts
const result = await resolveStorefrontRoute(snapshot, {
  type: "search",
  context: { type: "search", query: "shoes", state: "results", resultCount: 1, results: [resultProduct] },
}, reader(null));
expect(result).toMatchObject({
  status: "ready",
  context: { pageType: "search", data: { query: "shoes", resultCount: 1 } },
  template: { id: "search-default" },
});
```

Also assert missing or wrong-type Search default returns `not-found: template` and the resource reader is never called.

- [ ] **Step 2: Verify RED and implement the central resolver branch**

Run: `cd jellyshops && npm test -- --run src/features/storefront/resource-loader.test.ts`

Expected: FAIL because Search is not a route request/context variant.

Extend renderer/runtime context types with the explicit Search variant, then implement Search beside Home and Cart in `resolveStorefrontRoute`.

Update `createSearchPageContext` to adapt the validated API response into renderer-ready `PublicProduct` values. Build `href` as `/${storeSlug}/products/${handle}` and format `priceMinor` with the current Store currency; do not persist either derived value.

- [ ] **Step 3: Write failing renderer tests for all Search states**

Render `search-results` with literal contexts and assert:

- empty query shows deterministic guidance and no product grid;
- one result renders its title and link;
- none shows `No products found for “missing”`;
- result count comes from context rather than section settings.

The production mutation these tests catch is a renderer reading persisted section settings instead of runtime Search context.

- [ ] **Step 4: Implement runtime Search rendering**

Pass `context` to `SearchResultsSection`. Reuse `StorefrontProductCard`; do not create a separate product card. Set the form action to the current Store Search path supplied in context, and preserve the current query in the input.

- [ ] **Step 5: Write failing public page tests**

Mock only the HTTP boundary. Prove the route:

- requests the active publication endpoint and public Search context endpoint;
- renders V4 when `kind === "v4"`;
- renders empty and no-results states without 404;
- preserves the existing theme-shell Search renderer for a V3 publication;
- never requests draft or preview endpoints.

- [ ] **Step 6: Implement Search page composition**

Keep query trimming in the public context boundary. The page loads the active publication and context, calls `resolveStorefrontRoute`, and passes the ready result to `PublishedRuntimeStorefront`. V4 context failure renders a safe error/empty state and never falls back to draft.

- [ ] **Step 7: Add Publication A/B Search regression**

In `published-v4-routes.test.ts`, create Search templates `search-a` and `search-b`. Assert Draft B data is never an input to the public loader; resolving Publication A returns `search-a`, and resolving activated Publication B returns `search-b`, both with the same live query context.

- [ ] **Step 8: Run Search phase gates**

```text
cd jellyshops
npm test -- --run src/features/storefront/page-context-loaders.test.ts src/features/storefront/resource-loader.test.ts packages/storefront-renderer/src/registry-renderer.test.tsx src/app/[storeSlug]/search/page.test.tsx src/features/storefront/published-v4-routes.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 9: Commit**

```text
git add jellyshops/src/features/storefront jellyshops/packages/storefront-renderer/src jellyshops/src/app/[storeSlug]/search
git commit -m "feat: render search through v4 publication"
```

---

### Task 4: Migrate Custom Page with Reserved-Path Protection

**Files:**
- Modify: `jellyshops/packages/storefront-schema/src/types.ts`
- Modify: `jellyshops/packages/storefront-schema/src/schema.test.ts`
- Create: `jellyshops/src/features/storefront/reserved-paths.ts`
- Create: `jellyshops/src/features/storefront/reserved-paths.test.ts`
- Create: `jellyshops/packages/storefront-renderer/src/sections/content-pages.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/render-registry.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx`
- Create: `jellyshops/packages/storefront-registry/src/sections/content-pages.ts`
- Modify: `jellyshops/packages/storefront-registry/src/registry.ts`
- Modify: `jellyshops/packages/storefront-registry/src/registry.test.ts`
- Modify: `jellyshops/src/features/storefront/resource-loader.test.ts`
- Modify: `jellyshops/src/app/[storeSlug]/[pageSlug]/page.tsx`
- Create: `jellyshops/src/app/[storeSlug]/[pageSlug]/page.test.tsx`
- Modify: `jellyshops/src/features/storefront/published-v4-routes.test.ts`

**Interfaces:**
- Consumes: Task 2 Page context and existing resource assignment/default logic.
- Produces: V4 `page` rendering, safe content extraction, and reserved-path rejection.

- [ ] **Step 1: Write failing Page type and registry tests**

Add `page` to `PageType`. Register:

```ts
{
  type: "page-content",
  category: "content",
  supportedPages: ["page"],
  settingsSchema: z.object({}).passthrough(),
  controls: [],
  allowedBlockTypes: [],
  defaultSettings: {},
  defaultBlocks: [],
  responsiveFields: [],
}
```

Assert `page-content` is accepted for Page and rejected for Home/Search/Article.

- [ ] **Step 2: Write failing safe-content renderer tests**

Test `{ body: "About Jelly" }`, nested `{ blocks: [{ type: "paragraph", text: "Made locally" }] }`, and `{ html: "<script>alert(1)</script>" }`. The first two render text; the HTML-only payload renders no script or raw tag. Title always comes from live context.

- [ ] **Step 3: Implement `extractContentText` and `PageContentSection`**

Export one helper from `content-pages.tsx`:

```ts
export function extractContentText(value: unknown): string[]
```

It accepts strings, recursively visits arrays and object `text`, `body`, `content`, and `blocks` values, ignores `html`, limits recursion depth to 20, removes blank strings, and never calls `dangerouslySetInnerHTML`.

- [ ] **Step 4: Write failing reserved-path tests**

Assert `isReservedStorefrontPath()` returns true for decoded/case-normalized `products`, `collections`, `cart`, `search`, and `blogs`; false for `about-us`; and true/fail-closed for malformed percent encoding.

- [ ] **Step 5: Write failing Page route tests**

Prove:

- published Page context resolves an explicit Page assignment;
- no assignment falls back to `templateDefaults.page`;
- a Draft/missing/cross-store Page yields not found;
- reserved handles never invoke `findPage`;
- a V4 publication uses only public snapshot + live Page context;
- a V3 publication retains the existing legacy custom-page path.

- [ ] **Step 6: Implement the Custom Page route**

Decode and guard the slug, load active publication and live Page context, adapt it to:

```ts
{
  type: "page",
  id: context.page.id,
  handle: context.page.handle,
  visible: true,
  data: { page: context.page, title: context.page.title, content: context.page.content },
}
```

Resolve centrally and render `PublishedRuntimeStorefront`. Keep the current migrated-document renderer only for V3.

- [ ] **Step 7: Add Page Publication A/B regression and run gates**

Run:

```text
cd jellyshops
npm test -- --run packages/storefront-schema/src/schema.test.ts packages/storefront-registry/src/registry.test.ts packages/storefront-renderer/src/registry-renderer.test.tsx src/features/storefront/reserved-paths.test.ts src/features/storefront/resource-loader.test.ts src/app/[storeSlug]/[pageSlug]/page.test.tsx src/features/storefront/published-v4-routes.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 8: Commit**

```text
git add jellyshops/packages/storefront-schema/src jellyshops/packages/storefront-registry/src jellyshops/packages/storefront-renderer/src jellyshops/src/features/storefront jellyshops/src/app/[storeSlug]/[pageSlug]
git commit -m "feat: render custom pages through v4 publication"
```

---

### Task 5: Add the Canonical V4 Blog Route

**Files:**
- Modify: `jellyshops/packages/storefront-schema/src/types.ts`
- Create: `jellyshops/packages/storefront-registry/src/sections/content-pages.test.ts`
- Modify: `jellyshops/packages/storefront-registry/src/sections/content-pages.ts`
- Modify: `jellyshops/packages/storefront-renderer/src/sections/content-pages.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/render-registry.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx`
- Modify: `jellyshops/src/features/storefront/resource-loader.test.ts`
- Create: `jellyshops/src/app/[storeSlug]/blogs/[blogSlug]/page.tsx`
- Create: `jellyshops/src/app/[storeSlug]/blogs/[blogSlug]/page.test.tsx`
- Modify: `jellyshops/src/features/storefront/published-v4-routes.test.ts`

**Interfaces:**
- Consumes: `BlogPageContext`, live Article summaries, and existing Blog assignment/default resolution.
- Produces: `/[storeSlug]/blogs/[blogSlug]` through shared V4 rendering.

- [ ] **Step 1: Write failing Blog registry/renderer tests**

Add `blog` to `PageType`. Register `blog-header` and `article-list` only for Blog. Test the renderer with literal live context:

```ts
{
  pageType: "blog",
  resource: {
    id: "blog-a",
    handle: "news",
    data: {
      blog: { id: "blog-a", title: "News", handle: "news" },
      articles: [{ id: "article-a", title: "Opening Day", handle: "opening-day", excerpt: "We opened", publishedAt: "2026-09-20T00:00:00.000Z" }],
    },
  },
}
```

Assert header title and article link `/<storeSlug>/blogs/news/opening-day` render from context. An empty Article list renders a valid empty state.

- [ ] **Step 2: Implement Blog sections and verify GREEN**

Reuse shared content containers and links; do not introduce CMS rendering. `article-list` reads only `context.page.resource.data.articles` and ignores section-configured Article arrays.

- [ ] **Step 3: Write failing Blog route tests**

Prove Blog context resolves by current Store handle, assignment overrides default, no assignment uses default, missing/cross-store Blog is not found, globals render, and the route never calls draft/preview APIs.

- [ ] **Step 4: Implement Blog route composition**

Load the active public publication plus `findBlog`. Adapt to a visible `blog` resource and call `resolveStorefrontRoute`. Non-V4 storefronts use the existing compatibility boundary and receive not found; no new V3 Blog feature is introduced.

- [ ] **Step 5: Add Blog Publication A/B regression and run gates**

```text
cd jellyshops
npm test -- --run packages/storefront-registry/src/sections/content-pages.test.ts packages/storefront-renderer/src/registry-renderer.test.tsx src/features/storefront/resource-loader.test.ts src/app/[storeSlug]/blogs/[blogSlug]/page.test.tsx src/features/storefront/published-v4-routes.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```text
git add jellyshops/packages/storefront-schema/src/types.ts jellyshops/packages/storefront-registry/src jellyshops/packages/storefront-renderer/src jellyshops/src/features/storefront/resource-loader.test.ts jellyshops/src/features/storefront/published-v4-routes.test.ts jellyshops/src/app/[storeSlug]/blogs/[blogSlug]
git commit -m "feat: add v4 blog storefront route"
```

---

### Task 6: Add the Canonical V4 Article Route

**Files:**
- Modify: `jellyshops/packages/storefront-schema/src/types.ts`
- Modify: `jellyshops/packages/storefront-registry/src/sections/content-pages.ts`
- Modify: `jellyshops/packages/storefront-registry/src/sections/content-pages.test.ts`
- Modify: `jellyshops/packages/storefront-renderer/src/sections/content-pages.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/render-registry.tsx`
- Modify: `jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx`
- Modify: `jellyshops/src/features/storefront/resource-loader.test.ts`
- Create: `jellyshops/src/app/[storeSlug]/blogs/[blogSlug]/[articleSlug]/page.tsx`
- Create: `jellyshops/src/app/[storeSlug]/blogs/[blogSlug]/[articleSlug]/page.test.tsx`
- Modify: `jellyshops/src/features/storefront/published-v4-routes.test.ts`

**Interfaces:**
- Consumes: `ArticlePageContext` and existing Article assignment/default resolution.
- Produces: nested canonical Article rendering through the shared V4 runtime.

- [ ] **Step 1: Write failing Article registry/renderer tests**

Add `article` to `PageType`. Register `article-content` only for Article. Render live title, excerpt, publication date, and safe extracted body. Assert absent author renders no invented byline and `html` content is not injected.

- [ ] **Step 2: Implement the Article renderer**

Reuse `extractContentText`. Read only Article context fields; section settings may control presentation copy/styles but never replace the live Article identity/body.

- [ ] **Step 3: Write failing nested-route tests**

Prove:

- `/blogs/news/opening-day` resolves only when Article belongs to Blog `news` in the current Store;
- Draft Article, wrong Blog, wrong Store, or missing handle returns not found;
- assigned Article template overrides default;
- default fallback works;
- global layout renders through shared regions;
- public route calls no draft/preview API.

- [ ] **Step 4: Implement nested Article route**

Load active publication and `findArticle(storeId, blogHandle, articleHandle)`, adapt the Article to a visible `article` resource containing both Blog and Article context, resolve centrally, and render `PublishedRuntimeStorefront`. V3 receives not found without new functionality.

- [ ] **Step 5: Add Article Publication A/B regression and run gates**

```text
cd jellyshops
npm test -- --run packages/storefront-registry/src/sections/content-pages.test.ts packages/storefront-renderer/src/registry-renderer.test.tsx src/features/storefront/resource-loader.test.ts src/app/[storeSlug]/blogs/[blogSlug]/[articleSlug]/page.test.tsx src/features/storefront/published-v4-routes.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```text
git add jellyshops/packages/storefront-schema/src/types.ts jellyshops/packages/storefront-registry/src jellyshops/packages/storefront-renderer/src jellyshops/src/features/storefront/resource-loader.test.ts jellyshops/src/features/storefront/published-v4-routes.test.ts jellyshops/src/app/[storeSlug]/blogs/[blogSlug]/[articleSlug]
git commit -m "feat: add v4 article storefront route"
```

---

### Task 7: Complete Eight-Page Editor Preview Navigation

**Files:**
- Modify: `jellyshops/src/features/store-editor/api/types.ts`
- Modify: `jellyshops/src/features/store-editor/api/client.ts`
- Modify: `jellyshops/src/features/store-editor/api/client.test.ts`
- Create: `jellyshops/src/features/store-editor/preview-context.ts`
- Create: `jellyshops/src/features/store-editor/preview-context.test.ts`
- Modify: `jellyshops/src/features/store-editor/components/template-resource-selector.tsx`
- Modify: `jellyshops/src/features/store-editor/components/template-resource-selector.test.tsx`
- Modify: `jellyshops/src/features/store-editor/editor-navigation.ts`
- Modify: `jellyshops/src/features/store-editor/editor-navigation.test.ts`
- Modify: `jellyshops/src/app/admin/online-store/editor/page.tsx`
- Create: `jellyshops/src/app/admin/online-store/editor/page.test.tsx`

**Interfaces:**
- Consumes: authenticated SQL content routes, draft compiler snapshot, editor template records, and runtime context types.
- Produces: independent Page type, Template, Preview resource/query, and Assignment controls across all eight page types.

- [ ] **Step 1: Write failing API client tests for real content lists**

Extend `StoreEditorApi` with:

```ts
listPages(storeId: string): Promise<PagePreviewRecord[]>;
listBlogs(storeId: string): Promise<BlogPreviewRecord[]>;
listArticles(storeId: string, blogId?: string): Promise<ArticlePreviewRecord[]>;
```

Assert authenticated calls target `/content/pages`, `/content/blogs`, and `/content/articles?blogId=...`, preserving complete content fields needed for preview.

- [ ] **Step 2: Implement client methods and verify GREEN**

Reuse the existing request helper and content record shapes. Do not call anonymous public endpoints because editor preview may use draft content.

- [ ] **Step 3: Write failing pure preview-context tests**

Create `buildPreviewContext(input)` and test all eight page types with literal outputs. Search input `"  shoes  "` filters the editor catalog case-insensitively and yields a runtime Search context with query `shoes`, matching renderer-ready products, and a literal result count; Page/Blog/Article use selected real IDs; Cart uses runtime cart data; Home has no resource.

Test changing only `previewResourceId` changes only the returned context, while `templateId` remains untouched. Test changing Search query has no workspace/API side effect.

- [ ] **Step 4: Implement preview context builder**

The builder is pure and has no assignment mutation methods. It accepts compiled snapshot-independent live resources and returns renderer `StorefrontPageContext` only.

- [ ] **Step 5: Write failing selector tests for Search and content resources**

Extend `TemplateResourceSelector` with:

```ts
previewQuery?: string;
onPreviewQueryChange?(query: string): void;
```

For Search, render a text input labeled `Preview query` and disable the resource select. For Page/Blog/Article, render real resource options. Existing tests must continue proving template selection and preview selection do not call one another.

- [ ] **Step 6: Write failing editor page integration tests**

Mock the API boundary with all eight templates and real content records. Prove:

- selecting each Page type selects a template of that type;
- Page/Blog/Article resource lists display real titles;
- Search defaults to `shoes` and renders Search context;
- switching preview resource/query never calls `assignTemplate` or `updateTemplate`;
- compiled draft snapshot, not the public publication API, supplies preview layout;
- incompatible section/page combinations are absent from the section library.

- [ ] **Step 7: Implement editor wiring**

Load content lists with the existing workspace/catalog bootstrap. Keep `activeTemplateId`, `previewResourceId`, and `previewQuery` as separate state. Use `buildPreviewContext` for the `RegistrySectionRenderer` calls. Assignment remains available only through explicit content assignment workflows.

- [ ] **Step 8: Run editor gates**

```text
cd jellyshops
npm test -- --run src/features/store-editor/api/client.test.ts src/features/store-editor/preview-context.test.ts src/features/store-editor/components/template-resource-selector.test.tsx src/features/store-editor/editor-navigation.test.ts src/app/admin/online-store/editor/page.test.tsx
npm run typecheck
npm run build
```

- [ ] **Step 9: Commit**

```text
git add jellyshops/src/features/store-editor jellyshops/src/app/admin/online-store/editor
git commit -m "feat: complete v4 page preview navigation"
```

---

### Task 8: Prove Eight-Page Publication Isolation and Close Milestone 2

**Files:**
- Create: `backend/test/integration/local-v4-page-contexts.test.ts`
- Modify: `backend/test/integration/local-v4-publication-pipeline.test.ts`
- Modify: `jellyshops/src/features/storefront/published-v4-routes.test.ts`
- Modify: `jellyshops/src/features/storefront/storefront-page.test.tsx`
- Modify: `backend/README.md`
- Modify: `jellyshops/README.md`

**Interfaces:**
- Consumes: completed SQL context boundary, active publication reader, all eight template types, and shared renderer.
- Produces: end-to-end milestone evidence; no new production interfaces.

- [ ] **Step 1: Write full PGlite public-context integration tests**

Seed Store A and Store B with same handles, mixed Product status, published/draft Pages, Blogs, and Articles. Exercise real HTTP endpoints and assert:

- Search empty/match/none behavior;
- only Store A ACTIVE products appear for Store A;
- Store A Page never returns Store B content;
- Blog lists only its own published Articles in deterministic order;
- Article requires matching Store + Blog + Article handles;
- restarting `createApp` over the same PGlite database returns the same live content.

- [ ] **Step 2: Extend publication lifecycle fixtures to all eight templates**

Persist default Search/Page/Blog/Article templates and assignments plus globals. Publish A, mutate only draft layouts to B, and assert the public snapshot endpoint still returns A template markers. Publish B and assert B markers. Confirm content rows are unchanged by both publishes.

- [ ] **Step 3: Add the frontend eight-route table**

Extend `published-v4-routes.test.ts`:

```ts
it.each([
  [homeRequest, "home-a"],
  [productRequest, "product-a"],
  [collectionRequest, "collection-a"],
  [searchRequest, "search-a"],
  [cartRequest, "cart-a"],
  [pageRequest, "page-a"],
  [blogRequest, "blog-a"],
  [articleRequest, "article-a"],
])("resolves %s through active publication template %s", ...);
```

Repeat with Publication B and the same live contexts. Assert all ready results carry announcement/header/footer layout and their correct page context.

- [ ] **Step 4: Add shared renderer and V3 compatibility assertions**

Prove every new template section is rendered through `RegistrySectionRenderer`, published unsupported sections fail closed, editor mode exposes unsupported diagnostics, and existing V3 renderer/custom-page/Search compatibility tests remain unchanged.

- [ ] **Step 5: Document completion and limitations**

Update READMEs with:

- eight V4 page types;
- canonical Blog/Article paths;
- reserved Custom Page handles;
- live content versus immutable presentation semantics;
- `storeId`-only identity;
- custom-data dynamic-binding limitation;
- next work is merchant-facing theme capability, not runtime architecture.

- [ ] **Step 6: Run the full verification gate**

```text
cd backend
npm test
npm run test:integration
npm run typecheck
npm run build
cd ../jellyshops
npm test
npm run typecheck
npm run build
cd ..
git diff --check
```

Expected: all touched/focused suites, integrations, typechecks, and builds pass. Record any known unrelated repository baseline failure by exact test name without modifying it.

- [ ] **Step 7: Commit**

```text
git add backend/test/integration/local-v4-page-contexts.test.ts backend/test/integration/local-v4-publication-pipeline.test.ts jellyshops/src/features/storefront/published-v4-routes.test.ts jellyshops/src/features/storefront/storefront-page.test.tsx backend/README.md jellyshops/README.md
git commit -m "test: complete v4 major page coverage"
```
