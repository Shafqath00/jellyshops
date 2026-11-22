# Speed and cost, Phase 2: small additive migrations (plan)

Status: **plan, waiting for approval.** Nothing has been written to any database. Part of
`docs/plans/2026-11-20-speed-and-cost-plan.md`.

Every change here **adds** something (a column, a table, an index). Nothing is renamed, retyped or dropped, and
every new column is optional or has a default, so the code running today keeps working before and after.

## What I checked on staging (read-only, 2026-11-22)

| Table | Rows | Size |
| --- | --- | --- |
| `Store` | 7 | 112 kB |
| `Media` | 51 | 232 kB |
| `ProductMedia` | 109 | 128 kB |
| `Order` | 5 | 160 kB |
| Every table in the index list below | under 10 each | 16–64 kB |

So every statement below runs in milliseconds and holds its lock for about as long. (On a large production database
the indexes should be built `CONCURRENTLY`, outside a transaction; noted in each file.)

## Three migrations

### 2a. `20261122000000_media_variants.sql`: image sizes and blur placeholders

```sql
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "variantWidths" INTEGER[];      -- copies that exist, e.g. {320,640,960}
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "placeholder" TEXT;             -- tiny blurred image, data URL
ALTER TABLE "Media" ADD CONSTRAINT "Media_placeholder_size"
  CHECK ("placeholder" IS NULL OR char_length("placeholder") <= 1200) NOT VALID;
ALTER TABLE "Media" VALIDATE CONSTRAINT "Media_placeholder_size";
```

Why:
- **`variantWidths`**: today the server guesses which copies exist and, after Phase 1, tries the next size when one is
  missing. Each miss is a wasted storage read (and a wasted function second). With the list stored, the image route
  goes straight to the right file and the storefront's `srcset` lists only real sizes. `NULL` means "uploaded before
  this": the route keeps its Phase 1 fallback for those.
- **`placeholder`**: a 16 px blurred copy (about 300–600 bytes as WebP base64) shown as the photo's background while
  it loads. It removes the empty grey box on slow phones and makes the page feel faster at no bandwidth cost worth
  mentioning. The 1,200-character limit stops anything large ending up in every product payload.

Code that comes with it:
- Upload (`media/service.ts`) records `variantWidths` and makes the placeholder from the smallest copy (one extra
  Sharp call, a few milliseconds).
- `GET /api/public/media/...` uses `variantWidths` when present.
- Catalogue product media (`catalog/postgres-repository.ts` already selects `m.*`) passes `placeholder` and
  `variantWidths` to the storefront; product cards and galleries set the placeholder as a background and build
  `srcset` from the real widths, including 960 and 1920 (safe now, since only existing widths are listed).
- Backfill script `backend/scripts/backfill-media-variants.ts` (`--dry-run` first): for each `Media` row without
  `variantWidths`, list which copies exist in storage, make the placeholder from the smallest, write both. On staging
  that is 51 rows. It only **adds** values to empty columns; it never deletes or rewrites a file.

### 2b. `20261122010000_foreign_key_indexes.sql`: the 20 indexes Supabase's advisor asks for

One `CREATE INDEX IF NOT EXISTS` per foreign key without a covering index:

| Table | Columns |
| --- | --- |
| `BackInStockRequest` | `productId`; `variantId` |
| `DigitalAsset` | `storeId, productId` |
| `DigitalDownloadAttempt` | `entitlementId` |
| `DigitalEntitlement` | `storeId, assetId` |
| `OrderEditHold` | `storeId, revisionId`; `storeId, variantId` |
| `OrderFulfilment`, `OrderNote`, `OrderNotification`, `OrderReturn` | `storeId, orderId` (one each) |
| `OrderTransaction` | `revisionId`; `storeId, revisionId`; `storeId, orderId` |
| `ProductReview` | `productId` |
| `ThemeInstall` | `packageId`; `versionId` |
| `ThemeUpgradeBackup` | `fromVersionId`; `packageId`; `toVersionId` |

Why: deleting a store, product or order makes Postgres check every table that points at it; without these indexes
each check reads the whole child table. Today that is invisible (tiny tables); with thousands of stores it is what
makes store deletion and order pages slow, and it matters for Phase 5, which deletes old stores in batches.

Not dropping the 11 "unused" indexes the advisor also lists: on a database this young "unused" only means "not
queried yet", and several back admin filters and checkout. Revisit after a month of real traffic.

### 2c. `20261122020000_store_activity.sql`: knowing which stores are in use

```sql
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lastMerchantActivityAt" TIMESTAMPTZ;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lastOrderAt" TIMESTAMPTZ;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lastVisitAt" TIMESTAMPTZ;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lifecycleState" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lifecycleChangedAt" TIMESTAMPTZ;
ALTER TABLE "Store" ADD CONSTRAINT "Store_lifecycleState_check"
  CHECK ("lifecycleState" IN ('active', 'quiet', 'paused', 'archived')) NOT VALID;
ALTER TABLE "Store" VALIDATE CONSTRAINT "Store_lifecycleState_check";
CREATE INDEX IF NOT EXISTS "Store_lifecycle_idx" ON "Store" ("lifecycleState", "lastMerchantActivityAt");

CREATE TABLE IF NOT EXISTS "StoreLifecycleEvent" (
  "id" TEXT PRIMARY KEY,
  "storeId" TEXT NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fromState" TEXT NOT NULL,
  "toState" TEXT NOT NULL,
  "reason" TEXT NOT NULL,                -- plain words, e.g. "No sign-in or order for 30 days"
  "emailedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "StoreLifecycleEvent_store_idx" ON "StoreLifecycleEvent" ("storeId", "createdAt" DESC);
-- + the usual block: RLS on, nothing for anon/authenticated, backend_access policy for jelly_backend.

-- Starting values so no store looks idle on day one:
UPDATE "Store" SET "lastMerchantActivityAt" = "updatedAt" WHERE "lastMerchantActivityAt" IS NULL;
UPDATE "Store" s SET "lastOrderAt" = o.latest
  FROM (SELECT "storeId", max("createdAt") AS latest FROM "Order" WHERE "status" NOT IN ('CANCELLED', 'PENDING_PAYMENT') GROUP BY "storeId") o
  WHERE o."storeId" = s."id" AND s."lastOrderAt" IS NULL;
```

Adding a `NOT NULL DEFAULT 'active'` column is instant in Postgres 11+ (no table rewrite). Nothing reads
`lifecycleState` yet: Phase 5 is what acts on it, and only after you approve that phase. This migration only starts
**recording** activity.

How activity is recorded, without adding cost per page view:

| Signal | Written by | At most |
| --- | --- | --- |
| Merchant activity | `requireStorePermission` (any admin request for the store) | once an hour per store (remembered in memory, and the `UPDATE ... WHERE "lastMerchantActivityAt" < now() - interval '1 hour'` does nothing if another server already wrote it) |
| Order | the payment webhook, next to the Phase 1 storefront refresh | once per paid order |
| Shopper visit | new public `POST /api/public/stores/:id/visit`, sent by the shopper's browser **once a day per store** (a date in localStorage), `sendBeacon`, after the page has loaded | one database write per store per day |

Why a beacon for visits: since Phase 1, page views no longer reach the backend at all, so the backend can't see
them. A once-a-day beacon costs about one tiny request per shopper per day, versus the five per page view removed in
Phase 1. When Cloudflare sits in front (Phase 3) its analytics can replace this.

**Billing columns (`billingStatus`, `trialEndsAt`, plan) are left for Phase 4.** They depend on choices you haven't
made yet (trial length, free tier, annual plans); adding them now would mean guessing their shape.

## Rollout

1. Write the three files in `backend/sql/migrations` and `backend/supabase/migrations`, add them to
   `backend/test/integration/pglite.ts`, plus the code above and tests (unit + PGlite integration).
2. Show you the final SQL; **you approve applying it to staging** (`ayvpxqwleurhkfyujzlu`).
3. Apply, then check: columns and constraint present, 20 indexes present, RLS on `StoreLifecycleEvent` with the
   `jelly_backend` policy only, no browser grants, advisor no longer lists the foreign keys.
4. Run the media backfill with `--dry-run`, show you the counts, then run it (writes to staging, so it needs your yes
   too).
5. Check in a browser: new upload gets its widths and placeholder, product cards show the blur while loading, images
   load with the larger widths, an admin action updates `lastMerchantActivityAt` once.

Undo, if ever needed: drop the new columns, table and indexes. Nothing existing depends on them until later phases.

## Decisions for you

1. Approve this scope (2a, 2b, 2c) or trim it.
2. The once-a-day visit beacon: OK? It sends only the store id (no shopper data, no cookie).
3. Billing columns wait for Phase 4: OK?

## Built (2026-11-22), not yet applied to staging

| Piece | Where |
| --- | --- |
| Migrations (both folders; 2a and 2c also in the PGlite test list) | `backend/sql/migrations/20261122000000_media_variants.sql`, `20261122010000_foreign_key_indexes.sql`, `20261122020000_store_activity.sql` |
| Upload records `variantWidths` and a 16px WebP placeholder (≤1,200 chars, else none); the image route only tries copies the record lists | `backend/src/media/service.ts` (`makePlaceholder`) |
| Saves still work before the migration: the repository checks once whether the columns exist | `backend/src/media/sql-media-repository.ts` |
| Catalogue product media carries `variantWidths` and `placeholder`; product cards list exactly those widths in `srcset` (including 960/1920) and paint the blur behind the photo (only a `data:image/webp;base64,` value) | `backend/src/catalog/*`, `jellyshops/src/features/storefront/product-card-data.ts`, `packages/storefront-ui/src/product-card.tsx` |
| Activity: merchant at most hourly after an authorised successful store request; paid order from the payment webhook; visit beacon once a day per browser and store (`POST /api/public/stores/:id/visit`, 204); recording switches itself off on a database without the columns | `backend/src/tenants/store-activity.ts`, `app.ts`, `app/routes/commerce.ts`, `jellyshops/src/features/storefront/use-visit-beacon.ts` |
| Backfill (`--dry-run` first; refuses a project ref that doesn't match both Supabase targets) | `backend/scripts/backfill-media-variants.ts`, logic in `src/media/backfill-variants.ts` |

Checked: all migrations in the folder run in order on PGlite, including the 20 indexes; backend 826/826 tests;
unit and PGlite tests for upload widths/placeholder, the repository before and after the migration, the backfill
(dry run writes nothing, real run fills only empty rows, never touches files, second run does nothing), activity
throttling, the beacon. Product galleries and other sections still use the older three sizes and no blur (cards first).

## Applied to staging (2026-11-22, with approval)

`media_variants`, `foreign_key_indexes`, `store_activity` applied to `ayvpxqwleurhkfyujzlu`, then
`foreign_key_indexes_order_fix`: the `OrderEditHold` key is `("storeId", "revisionId")`, so the index I had written
the other way round didn't cover it; the fix adds the right index and drops the wrong one (the repo file now has the
right order, so fresh databases get only the correct index).

Checked: 2 `Media` columns, 5 `Store` columns, both check constraints, all 20 indexes; `StoreLifecycleEvent` has RLS on,
the `backend_access` policy for `jelly_backend` only and no anon/authenticated grants; the performance advisor lists no
unindexed foreign keys (the new indexes show as "unused" only because they are new); the security advisor shows
nothing new. All 7 stores start as `active` with their last-update date as last merchant activity; store `new` has a
last order date (26 Oct).

Backfill dry run: 97 images checked, 86 would get their copy widths and a placeholder, nothing written. The other 11
have no copies in storage: 10 are outside photo links added by the bulk import (nothing stored), 1 is an early upload
whose file isn't in storage. They are skipped.
