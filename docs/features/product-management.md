# Product management, collections and media

Code: `backend/src/catalog/`, `backend/src/media/`, `jellyshops/src/app/admin/products/**`, `jellyshops/src/features/commerce/components/{product-form,product-category-picker,category-recommendations}.tsx`, `jellyshops/src/lib/{product-variants,product-configuration}.ts`. Tables: `Product`, `ProductVariant`, `InventoryLevel`, `Collection`, `CollectionProduct`, `Media`, `ProductMedia`.

## API (merchant, `/api/stores/:storeId`)

| Method | Path | Permission |
| --- | --- | --- |
| GET / POST | `/catalog/products` | `catalog:view` / `catalog:edit` |
| GET / PATCH | `/catalog/products/:productId` | `catalog:view` / `catalog:edit` |
| GET / POST | `/catalog/collections` | `catalog:view` / `catalog:edit` |
| GET / PATCH | `/catalog/collections/:collectionId` | `catalog:view` / `catalog:edit` |
| GET / POST / DELETE | `/media`, `/media/:mediaId` | `storefront:view` / `media:upload` / `media:delete` |
| GET / PUT / POST / DELETE | `/digital-products/:productId[/assets[/:assetId]]` | see [notifications-and-digital-delivery](notifications-and-digital-delivery.md) |

There is no product or collection delete endpoint (variants carry an `archivedAt` column that list queries filter on). Public reads: `GET /api/public/stores/:storeId/catalog/products` and `/collections` (published, visible data only).

## How it works

- `CatalogService` (`catalog/service.ts`) validates and applies product/collection changes; `CatalogPostgresRepository` is the SQL adapter and every statement joins on `storeId`. A product detail request returns media, options, variants (price, compare-at price, SKU, inventory/availability), vendor and description. The list endpoint is intentionally lighter.
- `catalog/types.ts` defines the product, variant and `fulfillmentType` (`PHYSICAL` | `DIGITAL`) shapes shared by routes and repositories.
- Uploads: `media/routes.ts` accepts one file (multer, `MAX_UPLOAD_BYTES`), `media/validation.ts` checks type and size, and a storage adapter stores it (`MEDIA_PROVIDER`: `local-files`, `supabase`, or `gcs`, which config.ts calls reserved). Media in use by a product or storefront cannot be deleted (`MEDIA_IN_USE`); `storefront-reference-reader.ts` supplies the storefront references.
- The product form (`features/commerce/components/product-form.tsx`, ~830 lines) edits title, description, media, price, options and variants (generation helpers in `lib/product-variants.ts`) and stock; `app/admin/products/[id]/page.tsx` also renders `DigitalProductSettings` for delivery files.
- Collections are used by the editor's resource selectors and storefront collection pages. Categories shown in `product-category-picker.tsx` are a UI helper; there is no persisted category/brand taxonomy yet.

## Isolation

Repository methods take `storeId` from the request context; a product id from another store returns not found.
