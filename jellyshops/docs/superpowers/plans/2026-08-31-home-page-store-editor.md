# Home-Page Store Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Shopify-style home-page editor with comprehensive structured controls, local image uploads, private drafts, and explicit publishing that works without cloud credentials.

**Architecture:** Evolve the existing versioned storefront packages and shared renderer, then replace the editor's direct local repository access with a typed client for the sibling Express API. The API uses development auth, atomic local JSON persistence, local media storage, and demo catalog adapters selected through validated environment configuration; Firebase, Prisma/PostgreSQL, and Google Cloud Storage remain documented provider boundaries for connection after this phase.

**Tech Stack:** TypeScript, Next.js, React, Zod, npm workspaces, Express 5, Vitest, React Testing Library, Supertest, Playwright, local JSON files, local filesystem media.

**Spec:** `docs/superpowers/specs/2026-08-31-home-page-store-editor-design.md`

## Global Constraints

- Edit the home page only; product and collection template editing remains outside this phase.
- Use structured sections and blocks, not free-positioned canvas elements or merchant-authored HTML/CSS/JavaScript.
- The editor and public home page must use the same `@jelly/storefront-renderer` components.
- Draft changes remain private until an explicit Publish action creates an immutable snapshot.
- Development mode must work after service restart without Firebase, PostgreSQL, or Google Cloud credentials.
- The demo catalog is deterministic and is not written by the editor.
- Development authentication must refuse to start in production mode.
- Uploaded images must be validated from decoded content, stored by opaque ID, and referenced by media records rather than base64 data.
- All document mutations begin with a failing test, use immutable commands, and participate in undo/redo unless explicitly identified as view state.
- Every drag-based reorder action must have Move up and Move down controls.
- Before changing Next.js routes, layouts, configuration, or server/client boundaries, read the matching guide beneath `node_modules/next/dist/docs/` as required by `AGENTS.md`.
- Preserve the user-owned `next-env.d.ts` modification unless the user explicitly asks to change it.
- The sibling `backend/` directory is a separate service. If it has no `.git` directory when Task 1 starts, initialize a local Git repository there before its first task commit; do not nest it inside the frontend repository.

## File Structure Map

### Backend service (`../backend` from the frontend repository)

- `src/config.ts`: parse environment once and prevent unsafe provider combinations.
- `src/app.ts`: compose middleware and routes without opening a socket.
- `src/server.ts`: process entry point and graceful shutdown.
- `src/http/errors.ts`: stable API error envelope and error middleware.
- `src/auth/*`: auth-provider interface, demo provider, and ownership middleware.
- `src/storefront/*`: storefront record types, repository interface, local JSON repository, service, and routes.
- `src/catalog/*`: provider interface and deterministic demo products/collections.
- `src/media/*`: media records, validation, local storage provider, service, and routes.
- `src/testing/*`: temporary directory and authenticated request helpers.

### Frontend and workspace packages (`jellyshops/`)

- `packages/storefront-schema`: V2 home document, settings, media references, validation, and V1 migration.
- `packages/storefront-registry`: discriminated controls and complete phase-one section/block definitions.
- `packages/storefront-themes`: expanded semantic theme tokens and preset override behavior.
- `packages/storefront-renderer`: complete phase-one section renderers plus editor metadata hooks.
- `src/features/store-editor/model`: selection, immutable commands, history, and document-path helpers.
- `src/features/store-editor/api`: typed API client and demo-session adapter.
- `src/features/store-editor/state`: editor reducer, autosave controller, and publication workflow.
- `src/features/store-editor/components`: toolbar, hierarchy, inspector, canvas, control components, and media picker.
- `src/app/admin/store-design`: route composition and route-level tests.
- `src/features/storefront`: published API loader and shared public renderer boundary.

---

### Task 1: Establish the tested Express service and safe configuration

**Files:**
- Modify: `../backend/package.json`, `../backend/index.js`
- Create: `../backend/tsconfig.json`, `../backend/.gitignore`, `../backend/.env.example`
- Create: `../backend/src/config.ts`, `../backend/src/app.ts`, `../backend/src/server.ts`
- Create: `../backend/src/http/errors.ts`, `../backend/src/app.test.ts`

**Interfaces:**
- Produces: `loadConfig(env: NodeJS.ProcessEnv): AppConfig`, `createApp(deps?: Partial<AppDependencies>): Express`, and `ApiError`.
- `AppConfig` contains `port`, `nodeEnv`, `corsOrigins`, `authProvider`, `repositoryProvider`, `mediaProvider`, `dataDirectory`, `uploadDirectory`, `maxUploadBytes`, and `demoStoreId`.

- [ ] **Step 1: Replace the placeholder test script with a failing health/config test**

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

describe("service foundation", () => {
  it("returns a request id from health checks", async () => {
    const response = await request(createApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers["x-request-id"]).toMatch(/[0-9a-f-]{36}/);
  });

  it("rejects development auth in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production", AUTH_PROVIDER: "development" })).toThrow(
      "AUTH_PROVIDER=development is not allowed in production"
    );
  });
});
```

- [ ] **Step 2: Install the service toolchain and verify the test fails**

Update `package.json` with scripts `dev`, `build`, `start`, `test`, `test:watch`, and `typecheck`; add runtime packages `cors`, `express`, and `zod`; add development packages `@types/cors`, `@types/express`, `@types/node`, `supertest`, `@types/supertest`, `tsx`, `typescript`, and `vitest`.

Run: `npm --prefix ../backend install`

Run: `npm --prefix ../backend test -- --run src/app.test.ts`

Expected: FAIL because `createApp` and `loadConfig` do not exist.

- [ ] **Step 3: Implement validated configuration and the app factory**

```ts
export type ProviderName = "development" | "firebase" | "local-json" | "prisma" | "local-files" | "gcs";

export interface AppConfig {
  port: number;
  nodeEnv: "development" | "test" | "production";
  corsOrigins: string[];
  authProvider: "development" | "firebase";
  repositoryProvider: "local-json" | "prisma";
  mediaProvider: "local-files" | "gcs";
  dataDirectory: string;
  uploadDirectory: string;
  maxUploadBytes: number;
  demoStoreId: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: Array<{ path: string; message: string }>
  ) { super(message); }
}
```

`createApp` must add request IDs, JSON limit `2mb`, explicit configured CORS origins, `/health`, a 404 `ApiError`, and one JSON error middleware returning `{ error: { code, message, issues?, requestId } }`. Keep `index.js` as a compatibility shim that imports `dist/server.js` after builds.

- [ ] **Step 4: Document exact local and cloud configuration keys**

`.env.example` must list safe local defaults and empty server-only keys for `FIREBASE_PROJECT_ID`, `DATABASE_URL`, `GCS_BUCKET`, and `GCS_PROJECT_ID`. `loadConfig` must reject `firebase`, `prisma`, or `gcs` when its required values are absent, without importing those SDKs in this phase.

- [ ] **Step 5: Run backend verification**

Run: `npm --prefix ../backend test -- --run src/app.test.ts`

Run: `npm --prefix ../backend run typecheck`

Expected: PASS.

- [ ] **Step 6: Create the backend source-control boundary and commit**

Run `git -C ../backend init` only when `../backend/.git` is absent. Then run:

```bash
git -C ../backend add package.json package-lock.json tsconfig.json .gitignore .env.example index.js src
git -C ../backend commit -m "chore: establish tested store editor api"
```

### Task 2: Implement demo authentication, ownership, and atomic local records

**Files:**
- Create: `../backend/src/auth/types.ts`, `development-auth-provider.ts`, `middleware.ts`
- Create: `../backend/src/storefront/types.ts`, `repository.ts`, `local-json-repository.ts`
- Create: `../backend/src/testing/temp-service.ts`
- Create: `../backend/src/auth/middleware.test.ts`, `../backend/src/storefront/local-json-repository.test.ts`
- Modify: `../backend/src/app.ts`

**Interfaces:**
- Produces: `AuthProvider.verify(token): Promise<MerchantPrincipal>`, `requireMerchant`, `requireStoreAccess(storeId)`, and `StorefrontRepository`.
- `MerchantPrincipal` is `{ merchantId: string; storeIds: string[] }`.
- `StorefrontRepository` produces `getDraft`, `saveDraft`, `publish`, `getPublic`, `listMedia`, `saveMedia`, and `markMediaUnreferenced` operations with typed records.

- [ ] **Step 1: Write failing auth and persistence tests**

```ts
it("accepts the configured demo token for its store", async () => {
  const response = await request(app)
    .get("/api/stores/store-demo/private-check")
    .set("Authorization", "Bearer jelly-demo-merchant");
  expect(response.status).toBe(204);
});

it("rejects a valid merchant for another store", async () => {
  const response = await request(app)
    .get("/api/stores/store-other/private-check")
    .set("Authorization", "Bearer jelly-demo-merchant");
  expect(response.status).toBe(403);
});

it("survives repository recreation and rejects a stale revision", async () => {
  const first = await createTempRepository();
  const saved = await first.repository.saveDraft("store-demo", 0, validDocument);
  const second = await first.reopen();
  await expect(second.getDraft("store-demo")).resolves.toMatchObject({ revision: 1 });
  await expect(second.saveDraft("store-demo", 0, validDocument)).rejects.toMatchObject({ code: "DRAFT_CONFLICT" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix ../backend test -- --run src/auth/middleware.test.ts src/storefront/local-json-repository.test.ts`

Expected: FAIL because the provider, middleware, and repository are absent.

- [ ] **Step 3: Implement the development principal and ownership middleware**

```ts
export interface MerchantPrincipal { merchantId: string; storeIds: string[]; }
export interface AuthProvider { verify(token: string): Promise<MerchantPrincipal>; }

export const DEMO_TOKEN = "jelly-demo-merchant";
export const DEMO_PRINCIPAL: MerchantPrincipal = {
  merchantId: "merchant-demo",
  storeIds: ["store-demo"]
};
```

Missing/malformed authorization returns `AUTH_REQUIRED` with 401. Invalid tokens return `AUTH_INVALID` with 401. A principal lacking the route store ID returns `STORE_FORBIDDEN` with 403.

- [ ] **Step 4: Implement atomic JSON records**

```ts
export interface DraftRecord<TDocument> {
  storeId: string;
  revision: number;
  document: TDocument;
  updatedAt: string;
}

export interface PublicationRecord<TDocument> {
  id: string;
  storeId: string;
  sourceRevision: number;
  document: TDocument;
  publishedAt: string;
}
```

Write each store to `<dataDirectory>/stores/<storeId>.json.tmp`, then rename it to `<storeId>.json`. Clone documents before returning them. A publish appends a complete snapshot and points `currentPublicationId` to it. Use a per-store promise queue so concurrent writes in one process are serialized.

- [ ] **Step 5: Run focused and full backend checks**

Run: `npm --prefix ../backend test -- --run src/auth/middleware.test.ts src/storefront/local-json-repository.test.ts`

Run: `npm --prefix ../backend run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C ../backend add src
git -C ../backend commit -m "feat: add local store editor identity and records"
```

### Task 3: Add draft, publication, and demo catalog API contracts

**Files:**
- Create: `../backend/src/storefront/service.ts`, `routes.ts`, `routes.test.ts`
- Create: `../backend/src/catalog/types.ts`, `demo-catalog-provider.ts`, `routes.ts`, `routes.test.ts`
- Modify: `../backend/src/app.ts`

**Interfaces:**
- Consumes: `AuthProvider`, `StorefrontRepository`, and `ApiError` from Tasks 1-2.
- Produces: the draft, publish, public storefront, and demo catalog endpoints from the approved spec.
- `DocumentValidator.parse(input): unknown` is injected until the frontend schema is packaged for shared server use.

- [ ] **Step 1: Write failing route tests**

```ts
it("creates and returns a private default draft", async () => {
  const response = await authed(app).get("/api/stores/store-demo/storefront/draft");
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ storeId: "store-demo", revision: 0 });
});

it("returns a typed conflict for a stale save", async () => {
  await authed(app).put("/api/stores/store-demo/storefront/draft").send({ expectedRevision: 0, document: validDocument });
  const response = await authed(app).put("/api/stores/store-demo/storefront/draft").send({ expectedRevision: 0, document: validDocument });
  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe("DRAFT_CONFLICT");
  expect(response.body.error.currentRevision).toBe(1);
});

it("keeps an edited draft private until publication", async () => {
  await saveDraftWithHeading(app, "Private heading");
  expect((await request(app).get("/api/stores/store-demo/storefront/public")).status).toBe(404);
  await authed(app).post("/api/stores/store-demo/storefront/publish").send({ expectedRevision: 1 });
  const publicResponse = await request(app).get("/api/stores/store-demo/storefront/public");
  expect(publicResponse.body.document.regions.template[0].blocks[0].settings.text).toBe("Private heading");
});
```

- [ ] **Step 2: Verify the route tests fail**

Run: `npm --prefix ../backend test -- --run src/storefront/routes.test.ts src/catalog/routes.test.ts`

Expected: FAIL with route 404 responses.

- [ ] **Step 3: Implement the storefront service and routes**

Validate `expectedRevision` as a non-negative integer. Convert document parse errors to 422 `DOCUMENT_INVALID` issues shaped as `{ path, message }`. Return the current revision in the 409 error envelope. Publish only after the requested revision equals the stored draft revision.

```ts
export interface StorefrontService<TDocument> {
  getOrCreateDraft(storeId: string): Promise<DraftRecord<TDocument>>;
  saveDraft(storeId: string, expectedRevision: number, document: unknown): Promise<DraftRecord<TDocument>>;
  publish(storeId: string, expectedRevision: number): Promise<PublicationRecord<TDocument>>;
  getPublic(storeId: string): Promise<PublicationRecord<TDocument> | null>;
}
```

- [ ] **Step 4: Add deterministic demo catalog data**

Return at least eight products and three collections. Use stable IDs, local/public placeholder image URLs, integer minor-unit prices, and explicit product IDs on collections.

```ts
export interface DemoProduct { id: string; slug: string; name: string; imageUrl: string; priceMinor: number; currency: "USD"; }
export interface DemoCollection { id: string; slug: string; name: string; imageUrl: string; productIds: string[]; }
```

- [ ] **Step 5: Run backend checks**

Run: `npm --prefix ../backend test -- --run src/storefront/routes.test.ts src/catalog/routes.test.ts`

Run: `npm --prefix ../backend run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C ../backend add src
git -C ../backend commit -m "feat: add store draft and publication api"
```

### Task 4: Add safe local media upload and serving

**Files:**
- Modify: `../backend/package.json`, `../backend/package-lock.json`, `../backend/src/app.ts`
- Create: `../backend/src/media/types.ts`, `validation.ts`, `local-media-storage.ts`, `service.ts`, `routes.ts`
- Create: `../backend/src/media/routes.test.ts`, `../backend/src/testing/fixtures/tiny.png`

**Interfaces:**
- Produces: `MediaRecord`, `MediaStorage.put`, `MediaStorage.open`, `MediaService.upload`, and authenticated media routes.
- `MediaRecord` is `{ id, storeId, url, mimeType, byteSize, width, height, originalName, referenced, createdAt }`.

- [ ] **Step 1: Write failing upload-security tests**

```ts
it("stores a decoded PNG under an opaque id", async () => {
  const response = await authed(app)
    .post("/api/stores/store-demo/media")
    .attach("file", fixture("tiny.png"), { filename: "../../hero.png", contentType: "image/png" });
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({ mimeType: "image/png", originalName: "hero.png", referenced: false });
  expect(response.body.id).toMatch(/[0-9a-f-]{36}/);
  expect(response.body.url).toBe(`/api/public/media/store-demo/${response.body.id}`);
});

it("rejects executable content labelled as an image", async () => {
  const response = await authed(app)
    .post("/api/stores/store-demo/media")
    .attach("file", Buffer.from("console.log('x')"), { filename: "fake.png", contentType: "image/png" });
  expect(response.status).toBe(415);
  expect(response.body.error.code).toBe("MEDIA_TYPE_UNSUPPORTED");
});
```

- [ ] **Step 2: Install upload dependencies and verify failure**

Add runtime packages `multer`, `file-type`, `image-size`, and `express-rate-limit`, plus `@types/multer`.

Run: `npm --prefix ../backend install`

Run: `npm --prefix ../backend test -- --run src/media/routes.test.ts`

Expected: FAIL because the media routes do not exist.

- [ ] **Step 3: Implement validation and local storage**

Allow decoded PNG, JPEG, WebP, GIF, and AVIF only. Apply `maxUploadBytes` in Multer memory storage, rate-limit the upload route, normalize `originalName` with `path.basename`, and write `<uploadDirectory>/<storeId>/<mediaId>.<trustedExtension>`. Obtain width and height from decoded bytes. Never construct storage paths from route filenames.

- [ ] **Step 4: Implement media API behavior**

`POST /api/stores/:storeId/media` returns 201. `GET /api/stores/:storeId/media` returns merchant-owned records. `DELETE` marks an unreferenced record deleted and removes its local file; referenced records return 409 `MEDIA_IN_USE`. The public media route looks up the media record first, sets the trusted content type, and streams only its recorded path.

- [ ] **Step 5: Run media and backend checks**

Run: `npm --prefix ../backend test -- --run src/media/routes.test.ts`

Run: `npm --prefix ../backend test`

Run: `npm --prefix ../backend run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C ../backend add package.json package-lock.json src
git -C ../backend commit -m "feat: add safe local store media uploads"
```

### Task 5: Evolve the storefront document and control model to V2

**Files:**
- Modify: `packages/storefront-schema/src/version.ts`, `types.ts`, `schema.ts`, `defaults.ts`, `migrations.ts`, `index.ts`
- Modify: `packages/storefront-schema/src/schema.test.ts`, `migrations.test.ts`
- Modify: `packages/storefront-registry/src/types.ts`, `registry.ts`, `blocks.ts`, `sections/layout.ts`, `sections/content.ts`, `sections/commerce.ts`
- Modify: `packages/storefront-registry/src/registry.test.ts`
- Modify: `packages/storefront-themes/src/types.ts`, `theme-registry.ts`, `theme-registry.test.ts`
- Modify: `../backend/package.json`, `../backend/package-lock.json`, `../backend/src/app.ts`, `../backend/src/storefront/service.ts`
- Create: `../backend/src/storefront/document-validator.ts`, `document-validator.test.ts`

**Interfaces:**
- Produces: `StorefrontDocument` V2, `MediaReference`, expanded `GlobalSettings`, `ControlDefinition`, `ControlGroup`, `validateStorefrontDocument`, and V1-to-V2 migration.
- `StorefrontDocument` contains `schemaVersion: 2`, `storeId`, `template: "home"`, `theme`, and `regions: { header, template, footer }`.
- Produces for the backend: `storefrontDocumentValidator.parse(input): StorefrontDocument`, backed by the same `@jelly/storefront-schema` package used by the renderer.

- [ ] **Step 1: Write failing V2 document tests**

```ts
it("creates a validated home document with three regions", () => {
  const document = createDefaultStorefrontDocument("store-demo", "minimal");
  expect(document).toMatchObject({ schemaVersion: 2, storeId: "store-demo", template: "home" });
  expect(document.regions.header[0].type).toBe("header");
  expect(document.regions.template.some((section) => section.type === "hero")).toBe(true);
  expect(document.regions.footer[0].type).toBe("footer");
  expect(validateStorefrontDocument(document).success).toBe(true);
});

it("migrates the existing V1 header, home sections, and footer without changing node ids", () => {
  const migrated = migrateStoreDesignDocument(v1Document, "store-demo");
  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.regions.template.map(({ id }) => id)).toEqual(v1Document.pages.home.sections.map(({ id }) => id));
});
```

- [ ] **Step 2: Run schema tests to verify failure**

Run: `npm run test:unit -- --run packages/storefront-schema/src/schema.test.ts packages/storefront-schema/src/migrations.test.ts`

Expected: FAIL because V2 types and migration are absent.

- [ ] **Step 3: Implement V2 types, validation, defaults, and migration**

```ts
export interface MediaReference {
  id: string;
  url: string;
  alt: string;
  focalPoint: { x: number; y: number };
  fit: "cover" | "contain";
}

export interface StorefrontDocument {
  schemaVersion: 2;
  storeId: string;
  template: "home";
  theme: { presetId: ThemeId; settings: GlobalSettings };
  regions: Record<"header" | "template" | "footer", SectionNode[]>;
}
```

Reject unsafe URL protocols, invalid colors, unknown region types, duplicate node IDs, and documents whose serialized UTF-8 length exceeds 1.5 MB. Keep `StoreDesignDocument` as a deprecated type alias during migration so unrelated compilation errors can be corrected incrementally.

- [ ] **Step 4: Write failing control-definition tests**

Assert the registry exposes each discriminant: `text`, `textarea`, `rich-text`, `number`, `range`, `select`, `checkbox`, `segmented`, `color`, `font`, `spacing`, `link`, `image`, `product`, and `collection`. Assert every control key is accepted by its settings schema and every section is restricted to an approved region.

- [ ] **Step 5: Implement the discriminated control model and expanded theme settings**

```ts
export type ControlDefinition =
  | { type: "text" | "textarea" | "rich-text"; key: string; label: string; maxLength: number }
  | { type: "number" | "range"; key: string; label: string; min: number; max: number; step: number; unit?: string }
  | { type: "select" | "segmented"; key: string; label: string; options: Array<{ label: string; value: string }> }
  | { type: "checkbox"; key: string; label: string }
  | { type: "color"; key: string; label: string; allowAlpha: boolean }
  | { type: "font"; key: string; label: string; role: "heading" | "body" }
  | { type: "spacing"; key: string; label: string; min: 0; max: 160 }
  | { type: "link"; key: string; label: string }
  | { type: "image"; key: string; label: string }
  | { type: "product" | "collection"; key: string; label: string };
```

Add semantic colors, heading/body typography, page width, gutters, spacing scale, button styles, form styles, and reduced-motion-aware animation settings to theme resolution.

- [ ] **Step 6: Connect the backend to the shared validator**

Add `"@jelly/storefront-schema": "file:../jellyshops/packages/storefront-schema"` to the backend dependencies and run `npm --prefix ../backend install`. Implement:

```ts
import { migrateStoreDesignDocument, validateStorefrontDocument } from "@jelly/storefront-schema";

export const storefrontDocumentValidator = {
  parse(input: unknown): StorefrontDocument {
    const migrated = migrateStoreDesignDocument(input, "store-demo");
    const result = validateStorefrontDocument(migrated);
    if (!result.success) throw result.error;
    return result.data;
  }
};
```

Inject this validator in the production `createApp` dependency composition. Its test must reject an invalid section setting with the same field path returned by the schema package and accept a V1 document after migration.

- [ ] **Step 7: Run package and backend checks**

Run: `npm run test:unit -- --run packages/storefront-schema/src packages/storefront-registry/src packages/storefront-themes/src`

Run: `npm run typecheck`

Run: `npm --prefix ../backend test -- --run src/storefront/document-validator.test.ts src/storefront/routes.test.ts`

Run: `npm --prefix ../backend run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit the frontend schema and registry changes**

```bash
git add packages/storefront-schema packages/storefront-registry packages/storefront-themes
git commit -m "feat: define full home editor document controls"
```

- [ ] **Step 9: Commit the backend shared-validation integration**

```bash
git -C ../backend add package.json package-lock.json src/app.ts src/storefront/service.ts src/storefront/document-validator.ts src/storefront/document-validator.test.ts
git -C ../backend commit -m "feat: validate drafts with shared storefront schema"
```

### Task 6: Implement immutable editor commands, selection, and history

**Files:**
- Replace: `src/features/store-editor/editor-store.ts`, `editor-store.test.ts`
- Create: `src/features/store-editor/model/types.ts`, `selection.ts`, `document-path.ts`, `commands.ts`, `history.ts`
- Create: `src/features/store-editor/model/commands.test.ts`, `history.test.ts`

**Interfaces:**
- Produces: `EditorSelection`, `EditorCommand`, `applyCommand`, `createHistory`, `execute`, `undo`, and `redo`.
- Commands cover settings, add/remove/duplicate/move/toggle section, and add/remove/duplicate/move/toggle block.

- [ ] **Step 1: Write failing command tests**

```ts
it("duplicates a section with fresh section and block ids", () => {
  const result = applyCommand(document, {
    type: "duplicate-section",
    region: "template",
    sectionId: hero.id,
    createId: sequenceIds(["section-copy", "block-copy-1", "block-copy-2"])
  });
  expect(result.regions.template[1].id).toBe("section-copy");
  expect(result.regions.template[1].blocks.map(({ id }) => id)).toEqual(["block-copy-1", "block-copy-2"]);
  expect(document.regions.template).toHaveLength(1);
});

it("clamps movement and enforces registry removal rules", () => {
  expect(applyCommand(document, { type: "move-section", region: "template", sectionId: hero.id, toIndex: -1 }))
    .toEqual(document);
  expect(() => applyCommand(document, { type: "remove-section", region: "header", sectionId: header.id }))
    .toThrow("The header section cannot be removed");
});
```

- [ ] **Step 2: Run command tests to verify failure**

Run: `npm run test:unit -- --run src/features/store-editor/model/commands.test.ts`

Expected: FAIL because immutable commands do not exist.

- [ ] **Step 3: Implement commands and safe selection reconciliation**

```ts
export type EditorSelection =
  | { kind: "theme" }
  | { kind: "section"; region: RegionName; sectionId: string }
  | { kind: "block"; region: RegionName; sectionId: string; blockId: string }
  | null;

export function reconcileSelection(document: StorefrontDocument, selection: EditorSelection): EditorSelection;
export function applyCommand(document: StorefrontDocument, command: EditorCommand): StorefrontDocument;
```

Every command validates registry limits and returns the original document for a legal no-op. Settings commands update an exact entity path and validate the affected settings schema before returning.

- [ ] **Step 4: Write failing history tests**

Test 100-entry history cap, undo/redo across structural and settings edits, redo clearing after a new command, and exclusion of selection/device/save-status changes.

- [ ] **Step 5: Implement history and run checks**

```ts
export interface EditorHistory {
  past: StorefrontDocument[];
  present: StorefrontDocument;
  future: StorefrontDocument[];
}
```

Run: `npm run test:unit -- --run src/features/store-editor/model`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/store-editor
git commit -m "feat: add reversible store editor commands"
```

### Task 7: Complete the section library and editor-aware shared renderer

**Files:**
- Modify: `packages/storefront-registry/src/sections/layout.ts`, `content.ts`, `commerce.ts`, `blocks.ts`, `registry.test.ts`
- Modify: `packages/storefront-renderer/src/types.ts`, `storefront-renderer.tsx`, `page-renderer.tsx`, `section-renderer.tsx`, `storefront-renderer.test.tsx`
- Modify: `packages/storefront-renderer/src/sections/header.tsx`, `footer.tsx`, `hero.tsx`, `product-grid.tsx`, `rich-text.tsx`
- Create: `packages/storefront-renderer/src/sections/announcement-bar.tsx`, `image-with-text.tsx`, `featured-collection.tsx`, `multicolumn.tsx`, `newsletter.tsx`, `spacer-divider.tsx`
- Modify: `packages/storefront-ui/src/index.ts`, `button.tsx`, `container.tsx`, `product-card.tsx`

**Interfaces:**
- Consumes: V2 document and registry controls from Task 5.
- Produces: all eleven approved section types and `EditorRenderMetadata` support.
- `StorefrontRenderer` accepts `mode: "editor" | "published"`, `selected`, and `onSelect`.

- [ ] **Step 1: Write failing renderer coverage tests**

```tsx
it.each([
  "announcement-bar", "header", "hero", "rich-text", "image-with-text",
  "featured-collection", "product-grid", "multicolumn", "newsletter",
  "spacer-divider", "footer"
])("renders registered section %s", async (type) => {
  render(<StorefrontRenderer document={documentContaining(type)} mode="editor" commerce={demoCommerce} />);
  expect(await screen.findByTestId(`section-${type}`)).toBeVisible();
});

it("emits selection metadata only in editor mode", () => {
  const { rerender } = render(<StorefrontRenderer document={document} mode="editor" commerce={demoCommerce} />);
  expect(screen.getByTestId("section-hero")).toHaveAttribute("data-editor-section-id");
  rerender(<StorefrontRenderer document={document} mode="published" commerce={demoCommerce} />);
  expect(screen.getByTestId("section-hero")).not.toHaveAttribute("data-editor-section-id");
});
```

- [ ] **Step 2: Run renderer tests to verify failure**

Run: `npm run test:unit -- --run packages/storefront-renderer/src/storefront-renderer.test.tsx`

Expected: FAIL for missing sections and editor metadata.

- [ ] **Step 3: Implement complete registry defaults and renderer sections**

Use CSS custom properties for theme colors and typography. Use semantic HTML, real `<button>`/`<a>` elements, sanitized plain/rich text components, `MediaReference.focalPoint` for `object-position`, and demo provider IDs for product/collection content. Newsletter submission remains presentational and announces that connection is unavailable in demo mode.

- [ ] **Step 4: Implement editor metadata without polluting published markup**

```ts
export interface EditorRenderMetadata {
  selected: EditorSelection;
  onSelect(selection: Exclude<EditorSelection, null>): void;
}
```

Stop navigation/form submission in editor mode. Attach metadata at section and block roots. Selected styling belongs to an editor overlay class and must not alter layout dimensions.

- [ ] **Step 5: Run renderer and package checks**

Run: `npm run test:unit -- --run packages/storefront-registry/src packages/storefront-renderer/src`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/storefront-registry packages/storefront-renderer packages/storefront-ui
git commit -m "feat: complete editable home section library"
```

### Task 8: Add the typed API client, demo session, and autosave state

**Files:**
- Create: `src/features/store-editor/api/types.ts`, `client.ts`, `client.test.ts`, `demo-session.ts`
- Create: `src/features/store-editor/state/types.ts`, `reducer.ts`, `reducer.test.ts`, `autosave-controller.ts`, `autosave-controller.test.ts`
- Modify: `src/features/store-editor/editor-store.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `StoreEditorApi`, `createStoreEditorApi`, `getDemoSession`, `EditorState`, `editorReducer`, and `createAutosaveController`.
- API calls return typed draft/publication/media/catalog records and throw `StoreEditorApiError` with `status`, `code`, `issues`, and `currentRevision`.

- [ ] **Step 1: Write failing API-client tests**

```ts
it("sends the demo token and expected revision", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ storeId: "store-demo", revision: 4, document }));
  const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });
  await api.saveDraft("store-demo", 3, document);
  expect(fetchMock).toHaveBeenCalledWith(
    "http://localhost:3001/api/stores/store-demo/storefront/draft",
    expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) })
  );
});

it("surfaces revision conflicts without discarding the current document", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ error: { code: "DRAFT_CONFLICT", message: "Stale", currentRevision: 5 } }, 409));
  await expect(api.saveDraft("store-demo", 4, document)).rejects.toMatchObject({ code: "DRAFT_CONFLICT", currentRevision: 5 });
});
```

- [ ] **Step 2: Verify API-client tests fail**

Run: `npm run test:unit -- --run src/features/store-editor/api/client.test.ts`

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement API methods and demo session**

```ts
export interface StoreEditorApi {
  loadDraft(storeId: string): Promise<DraftRecord>;
  saveDraft(storeId: string, expectedRevision: number, document: StorefrontDocument): Promise<DraftRecord>;
  publish(storeId: string, expectedRevision: number): Promise<PublicationRecord>;
  listCatalog(): Promise<DemoCatalog>;
  uploadMedia(storeId: string, file: File, onProgress?: (percent: number) => void): Promise<MediaRecord>;
  deleteMedia(storeId: string, mediaId: string): Promise<void>;
}
```

`.env.example` sets `NEXT_PUBLIC_STORE_EDITOR_API_URL=http://localhost:3001`. The demo session is displayed only in development and yields store ID `store-demo` and token `jelly-demo-merchant`.

- [ ] **Step 4: Write failing reducer/autosave tests**

Use fake timers to assert a 700 ms debounce, immediate `flush`, no overlapping saves, a queued save after an in-flight edit, persistent unsaved state after failure, and a blocked state after conflict.

- [ ] **Step 5: Implement state and autosave controller**

```ts
export type SaveStatus = "loading" | "saved" | "dirty" | "saving" | "error" | "conflict" | "publishing" | "published";
export interface AutosaveController { changed(): void; flush(): Promise<void>; retry(): Promise<void>; dispose(): void; }
```

The reducer owns history, selection, viewport, current revision, validation issues, and save status. Browser unload warning is active only for dirty/saving/error/conflict states or active uploads.

- [ ] **Step 6: Run frontend checks**

Run: `npm run test:unit -- --run src/features/store-editor/api src/features/store-editor/state`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .env.example src/features/store-editor
git commit -m "feat: connect editor state to draft api"
```

### Task 9: Build the responsive editor shell, hierarchy, and canvas selection

**Files:**
- Replace: `src/app/admin/store-design/page.tsx`, `page.test.tsx`
- Create: `src/features/store-editor/components/editor-shell.tsx`, `editor-toolbar.tsx`, `page-hierarchy.tsx`, `hierarchy-row.tsx`, `preview-canvas.tsx`, `insertion-control.tsx`, `add-section-dialog.tsx`, `status-announcer.tsx`
- Create: `src/features/store-editor/components/editor-shell.test.tsx`, `page-hierarchy.test.tsx`, `preview-canvas.test.tsx`
- Modify: `src/app/admin/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: editor state/API from Task 8 and editor-aware renderer from Task 7.
- Produces: full-screen editor shell with toolbar, hierarchy/settings panel slot, and responsive canvas.

- [ ] **Step 1: Write failing shell interaction tests**

```tsx
it("synchronizes hierarchy and canvas selection", async () => {
  renderEditor();
  await user.click(screen.getByRole("button", { name: "Hero section" }));
  expect(screen.getByTestId("section-hero")).toHaveAttribute("data-editor-selected", "true");
  await user.click(within(screen.getByTestId("section-rich-text")).getByText("Our story"));
  expect(screen.getByRole("button", { name: "Rich text section" })).toHaveAttribute("aria-current", "true");
});

it("supports non-drag section ordering", async () => {
  renderEditor();
  await user.click(screen.getByRole("button", { name: "Move Hero down" }));
  expect(screen.getAllByTestId("template-hierarchy-row").map((row) => row.textContent)).toEqual(["Rich text", "Hero"]);
});
```

- [ ] **Step 2: Run component tests to verify failure**

Run: `npm run test:unit -- --run src/features/store-editor/components/editor-shell.test.tsx src/features/store-editor/components/page-hierarchy.test.tsx src/features/store-editor/components/preview-canvas.test.tsx`

Expected: FAIL because the shell components do not exist.

- [ ] **Step 3: Implement the toolbar and hierarchy**

Toolbar controls: back, identity, Home page label, desktop/tablet/mobile, undo, redo, save state, Save, and Publish. Hierarchy groups: Header, Template, Footer. Rows expose select, visibility, duplicate, delete where allowed, Move up, and Move down. Add section opens a registry-filtered dialog at the requested insertion point.

- [ ] **Step 4: Implement the canvas**

Viewport widths are desktop `100%`, tablet `768px`, and mobile `390px`. The canvas scrolls independently and centers fixed widths. Use renderer callbacks for selection, insertion controls between template sections, and a zero-layout-shift selection outline. Prevent storefront links and form submissions while in editor mode.

- [ ] **Step 5: Add responsive and accessible shell styles**

Use a full-height grid with a 64 px toolbar and 320 px side panel on desktop. At narrow admin widths, keep the panel accessible as a drawer rather than shrinking the preview below its chosen device width. Ensure 44 px pointer targets, visible focus, labelled icon buttons, and an aria-live save-status region.

- [ ] **Step 6: Run shell and route checks**

Run: `npm run test:unit -- --run src/app/admin/store-design src/features/store-editor/components`

Run: `npm run typecheck`

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/store-design src/features/store-editor/components src/app/admin/layout.tsx src/app/globals.css
git commit -m "feat: build responsive store editor shell"
```

### Task 10: Generate inspectors and complete image controls

**Files:**
- Create: `src/features/store-editor/components/inspector/inspector.tsx`, `control-renderer.tsx`, `theme-settings.tsx`, `section-settings.tsx`, `block-settings.tsx`, `validation-summary.tsx`
- Create: `src/features/store-editor/components/controls/text-control.tsx`, `number-control.tsx`, `choice-control.tsx`, `color-control.tsx`, `font-control.tsx`, `spacing-control.tsx`, `link-control.tsx`, `catalog-control.tsx`, `image-control.tsx`
- Create: `src/features/store-editor/components/inspector/inspector.test.tsx`, `control-renderer.test.tsx`
- Create: `src/features/store-editor/components/controls/image-control.test.tsx`
- Modify: `src/features/store-editor/components/editor-shell.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: registry `ControlDefinition`, editor commands, API media methods, and demo catalog.
- Produces: `Inspector`, exhaustive `ControlRenderer`, and `ImageControl`.

- [ ] **Step 1: Write failing exhaustive-control tests**

```tsx
it.each([
  "text", "textarea", "rich-text", "number", "range", "select", "segmented",
  "checkbox", "color", "font", "spacing", "link", "image", "product", "collection"
])("renders and updates a %s control", async (type) => {
  const onChange = vi.fn();
  render(<ControlRenderer definition={definitionFor(type)} value={valueFor(type)} onChange={onChange} />);
  await interactWithControl(type, user);
  expect(onChange).toHaveBeenCalled();
});
```

Add an exhaustiveness assertion so a new control discriminant causes a TypeScript error until rendered.

- [ ] **Step 2: Run inspector tests to verify failure**

Run: `npm run test:unit -- --run src/features/store-editor/components/inspector src/features/store-editor/components/controls`

Expected: FAIL because inspectors and controls do not exist.

- [ ] **Step 3: Implement theme, section, and block inspectors**

Theme settings expose preset choice plus colors, typography, layout, spacing, buttons, forms, and motion. Preset changes open a confirmation with `Apply preset defaults` and `Keep my overrides`. Section/block controls dispatch exact settings commands and show server/client validation messages beside matching paths. Back returns to hierarchy without changing the document.

- [ ] **Step 4: Implement image upload behavior**

```ts
export interface ImageControlValue extends MediaReference {}
export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; percent: number }
  | { status: "error"; message: string; file: File };
```

Upload shows progress, replace retains the current image until success, remove clears the document reference, retry reuses the selected file, and cancel aborts the request. Alternative text is required for meaningful images; an explicit decorative checkbox allows empty alt. Focal point uses two 0-100 range controls and a clickable preview. Fit supports cover/contain.

- [ ] **Step 5: Run inspector and accessibility checks**

Run: `npm run test:unit -- --run src/features/store-editor/components/inspector src/features/store-editor/components/controls`

Run: `npm run typecheck`

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/store-editor/components src/app/globals.css
git commit -m "feat: add complete store editor inspectors"
```

### Task 11: Integrate publication with the public home page

**Files:**
- Modify: `src/features/storefront/storefront-page.tsx`, `storefront-page.test.tsx`
- Modify: `src/app/[storeSlug]/page.tsx`, `page.test.tsx`
- Create: `src/features/storefront/public-storefront-api.ts`, `public-storefront-api.test.ts`
- Modify: `src/app/admin/store-design/page.tsx`, `page.test.tsx`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: public API publication and shared renderer.
- Produces: public home rendering from only the latest published API snapshot, with the current default storefront as no-publication fallback.

- [ ] **Step 1: Write failing private-draft/publication tests**

```tsx
it("does not expose a newer private draft", async () => {
  api.publication = publicationWithHeading("LIVE");
  api.draft = draftWithHeading("DRAFT");
  render(await loadPublicStorefront("sweet-bakes"));
  expect(screen.getByText("LIVE")).toBeVisible();
  expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
});

it("publishes only after flushing the current draft", async () => {
  renderEditorWithDirtyHeading("READY");
  await user.click(screen.getByRole("button", { name: "Publish" }));
  expect(api.saveDraft).toHaveBeenCalledBefore(api.publish);
  expect(api.publish).toHaveBeenCalledWith("store-demo", api.savedRevision);
});
```

- [ ] **Step 2: Run publication tests to verify failure**

Run: `npm run test:unit -- --run src/features/storefront src/app/admin/store-design/page.test.tsx`

Expected: FAIL because public API loading and flush-before-publish are absent.

- [ ] **Step 3: Implement public loading and safe fallback**

Map the demo storefront slug to `store-demo` in the development catalog adapter. Fetch `/storefront/public` without merchant credentials. Validate/migrate the response before rendering. A 404 uses the existing default published storefront; any invalid response logs a safe diagnostic and also uses the last valid/default storefront. Configure local media images through the API origin without allowing arbitrary remote image hosts.

- [ ] **Step 4: Implement publish validation and status flow**

Publish calls `autosave.flush()`, validates the complete local document, focuses the first invalid inspector field when validation fails, then calls the API with the saved revision. Success sets `published`; failure leaves the draft intact with Retry. Conflict disables Publish until Reload latest is chosen.

- [ ] **Step 5: Run integration checks**

Run: `npm run test:unit -- --run src/features/storefront src/app/admin/store-design`

Run: `npm run typecheck`

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/storefront 'src/app/[storeSlug]' src/app/admin/store-design next.config.ts
git commit -m "feat: publish api storefront snapshots"
```

### Task 12: Verify the complete local merchant journey and document operation

**Files:**
- Create: `e2e/store-editor.spec.ts`
- Modify: `playwright.config.ts`, `scripts/run-playwright.mjs`, `README.md`
- Modify: `../backend/README.md`
- Modify only proven failures in files owned by Tasks 1-11.

**Interfaces:**
- Produces: repeatable two-service E2E startup, full merchant journey coverage, and connection instructions for cloud providers.

- [ ] **Step 1: Write the failing end-to-end journey**

```ts
test("merchant edits a private home draft and publishes it", async ({ page }) => {
  await page.goto("/admin/store-design");
  await page.getByRole("button", { name: "Continue as demo merchant" }).click();
  await page.getByRole("button", { name: "Hero section" }).click();
  await page.getByLabel("Heading").fill("A new jelly season");
  await page.getByLabel("Background color").fill("#4f46e5");
  await page.getByLabel("Top spacing").fill("80");
  await page.getByLabel("Hero image").setInputFiles("e2e/fixtures/store-hero.png");
  await page.getByRole("button", { name: "Move Hero down" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const publicPage = await page.context().newPage();
  await publicPage.goto("/sweet-bakes");
  await expect(publicPage.getByText("A new jelly season")).not.toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  await publicPage.reload();
  await expect(publicPage.getByText("A new jelly season")).toBeVisible();
});
```

Add focused tests for mobile preview, keyboard Move up/down, upload rejection/retry, reload persistence, and publish validation focus.

- [ ] **Step 2: Configure two-service Playwright startup and verify failure**

Start the backend on port 3001 with temporary E2E data/upload directories, then start Next.js with `NEXT_PUBLIC_STORE_EDITOR_API_URL=http://127.0.0.1:3001`. Reuse neither service in CI. Ensure shutdown terminates both process trees on Windows.

Run: `npm run test:e2e -- --grep "merchant edits a private home draft"`

Expected: FAIL until the complete journey and process orchestration are correct.

- [ ] **Step 3: Correct only demonstrated integration gaps**

For each failure, add or tighten the nearest unit/integration regression test before the smallest production change. Do not weaken assertions or add arbitrary waits; wait on accessible UI state or API completion.

- [ ] **Step 4: Document local operation and later cloud connection**

Frontend README commands must cover install, API start, frontend start, demo login, tests, and local data reset paths. Backend README must describe each environment key and the exact adapter boundaries for Firebase token verification, Prisma repository implementation, PostgreSQL migrations, GCS object storage, and production prohibition of demo auth. State clearly that those cloud services are not connected in this phase.

- [ ] **Step 5: Run the complete quality gate**

```bash
npm --prefix ../backend test
npm --prefix ../backend run typecheck
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Expected: every command exits 0; the editor E2E verifies private draft isolation and published preview fidelity.

- [ ] **Step 6: Perform manual responsive and accessibility verification**

At desktop, tablet, and mobile preview widths, verify selection outlines do not shift layout, images respect focal point, controls remain keyboard reachable, focus is visible, status changes are announced, and reduced-motion disables nonessential animation. Record any defect as a failing automated test before correction.

- [ ] **Step 7: Commit backend verification and documentation changes**

```bash
git -C ../backend add README.md src package.json package-lock.json
git -C ../backend commit -m "test: verify local store editor api journey"
```

Do not create this backend commit when there are no backend changes after Task 4.

- [ ] **Step 8: Commit frontend verification and documentation changes**

```bash
git add e2e playwright.config.ts scripts/run-playwright.mjs README.md src packages package.json package-lock.json next.config.ts
git commit -m "test: verify complete home store editor journey"
```

Do not create this frontend commit when there are no frontend changes after Task 11.

## Plan Self-Review

- **Spec coverage:** Tasks 1-4 implement configuration, demo authentication, ownership, local persistence, draft/publication endpoints, demo catalog, and safe media. Task 5 implements the V2 document, comprehensive control registry, themes, and the shared backend validator. Tasks 6-7 implement reversible commands, the full section library, and shared editor/public renderer. Tasks 8-10 implement API state, autosave, history, the Shopify-style shell, hierarchy/canvas selection, responsive previews, exhaustive inspectors, and image controls. Task 11 enforces the private-draft/publication boundary. Task 12 covers end-to-end, restart persistence, accessibility, responsive behavior, visual fidelity, and cloud-connection documentation.
- **Placeholder scan:** The plan contains no unfinished requirement markers or generic error/testing instructions. Cloud integrations are intentionally configuration-only per the approved scope and have explicit startup validation and documentation tasks.
- **Type consistency:** `StorefrontDocument`, `MediaReference`, `ControlDefinition`, and region names originate in Task 5 and are consumed unchanged by Tasks 6-12. Backend `DraftRecord`, `PublicationRecord`, `MediaRecord`, and `StorefrontRepository` originate in Tasks 2-4 and match the frontend client contracts introduced in Task 8.
- **Source-control consistency:** Frontend/package work commits to the existing `jellyshops` repository. The sibling backend receives its own Git repository only if absent, then all API work commits there; the user-owned frontend `next-env.d.ts` modification remains unstaged.
