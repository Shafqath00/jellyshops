# V4 Collection Merchandising Design

## Goal

Let a merchant choose a real Collection in the V4 editor and preview its current-store title, description, and live products through shared Collection storefront sections. The public Collection route and editor draft preview must use compatible live Collection semantics while compiled snapshots continue to contain presentation only.

## Scope

This slice adds Collection sections/controls and a full current-store Collection detail path for editor preview. It does not add new Collection domain fields, collection authoring UI, search/blog/article work, or changes to publication storage.

## Existing state and gap

The registry currently has `collection-header` and `collection-product-grid`, but both have empty settings schemas and controls. The renderer consumes a loose `resource.data.collection` and `resource.data.products` shape. The editor selector uses `DemoCatalog.collections`, which is intentionally lightweight.

The catalog service/repository already have `getCollection(storeId, id)`. The merchant catalog router does not expose it. The SQL implementation returns an empty `productIds` array, so it is insufficient as full preview detail.

## Design

### Collection presentation contract

Add a typed `CollectionPresentationContext` to `@jelly/storefront-renderer`:

```ts
interface CollectionPresentationContext {
  collection: { id: string; title: string; description: string; imageUrl?: string };
  products: PublicProduct[];
  totalProducts: number;
}
```

This contract deliberately contains only the live presentation data used by shared sections. It has no workspace layout, publication ID, editor selection, filtering, or persisted sort state.

The public collection page and editor preview construct this contract. Collection section renderers read it first and retain a narrow legacy fallback only where existing tests need it.

### Registry and renderer

The Collection-only sections are:

| Section | Settings / controls |
| --- | --- |
| `collection-header` | show title, show description, show image |
| `collection-product-grid` | columns (2–4), product limit (1–24), empty-state text |
| `collection-description` | spacing (compact, standard, spacious) |

The default Collection page order becomes header → grid → description. Controls persist presentation configuration in the template exactly as other section settings do. They never persist selected Collection, product list, sort/filter values, or catalog inventory/pricing.

### Detail boundary and isolation

Add `GET /api/stores/:storeId/catalog/collections/:collectionId` behind `catalog:view` permission. The service calls the existing `getCollection(storeId, id)` boundary.

`CatalogPostgresRepository.getCollection` will read the Collection only with its `storeId`, then resolve products that include the collection ID and have the same `storeId`. It returns `null` for another store’s ID. The collection detail API response includes the collection record and its current-store products; list responses remain lightweight.

### Editor preview

`StoreEditorApi.getCollection(storeId, collectionId)` calls the detail endpoint. The editor:

1. continues to use the lightweight list for the selector;
2. fetches detail after a selected ID changes;
3. accepts it only when `detail.storeId === backendStoreId`;
4. maps its live Product rows to `PublicProduct`/Collection presentation input;
5. passes the shared `CollectionPresentationContext` through `createEditorPreviewPageContext`.

No editor Collection action writes a template, assignment, workspace, publication, cart, or catalog record.

### Public parity

The public collection page uses the same context shape and section renderer. Different template settings can change presentation, but the title, description, image, product IDs, product prices, and empty collection behavior come from equivalent live collection semantics.

## Error and empty behavior

- no selected Collection or loading detail: no Collection resource context, rather than fabricated Collection data;
- a Store B ID requested through Store A: detail is `null`/not rendered;
- no image: header omits image;
- no description: description section omits content;
- empty collection: grid renders the persisted empty-state message;
- absent optional collection image/metadata is never invented.

## Tests

Tests will prove:

1. Collection sections are Collection-only and expose controls/default settings.
2. SQL detail lookup includes only current-store collection/product records.
3. Client calls the scoped detail route with merchant authorization.
4. Editor preview context receives real title, description, image, and products.
5. Grid limit/columns and empty state are rendered through the shared context.
6. Selecting a Collection does not alter templates, assignments, workspace, or publication data.
7. Public and preview contexts have compatible Collection presentation data.
8. Existing public Collection route remains green.

## Non-goals

- Collection search, sort, filter, or pagination UI.
- Collection creation/editor experience.
- Persisting catalog fields into V4 workspace or compiled snapshots.
- Product or cart behavior changes.
- Blog, Article, Search, Theme Store, or publication-architecture work.
