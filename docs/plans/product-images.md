# Product images, variant photos and customisation media — design plan

Status: implementation complete; migrations are prepared but unapplied, staging placeholder count is pending, and rollout is disabled by default. Date: 2026-10-25. Builds on `docs/plans/product-builder.md`.

## 0. What exists today (read from the code)

| Area | Today | Consequence |
| --- | --- | --- |
| Storage model | `Media` (per-store library: url, mime, size, width, height, originalName, altText, referenced) and `ProductMedia(storeId, productId, mediaId, position, altText)`. | Multiple, ordered, reusable images per product are **already modelled**. One media can be linked once per product, so a gallery can never contain duplicates. |
| Writing a product's image | Only `imageUrl`. `setProductImage` **deletes every `ProductMedia` row, then inserts one**. | Any save that sends `imageUrl` wipes a multi-photo gallery. The classic form sends it on every save. |
| Variant ↔ image | None. `ProductVariant.options` is JSON only. | We need a new relation. |
| Upload | `POST /media`, one file, 30/min, content sniffed with `file-type`, decoded with `sharp`, stored as the original bytes. Public URL `/api/public/media/:storeId/:mediaId`. | No EXIF stripping (GPS leaks), no resized copies, no content-hash de-duplication. |
| Serving | `response.type(mime).send(bytes)` — original size, **no `Cache-Control`/ETag**. | Slow product pages; an image switch would re-download full-size files. Media ids never change, so long-lived caching is safe. |
| Deleting | Library delete is refused while any product, page or published document references the image (`MEDIA_IN_USE`). | Safe deletion is already in place; keep it. |
| Storefront | Gallery section stacks every image; no switching. Cards and the cart use the first image. Orders snapshot `media[0]` as `imageSnapshot`. | A colour-specific image would never reach the cart or order. |
| Old product form | Defaults `imageUrl` to an Unsplash placeholder and saves it. | Some live products may carry a placeholder as their only "photo". Needs a read-only count before migration. |
| Builder (phase 3–6) | One cover photo through `uploadMedia`; sends `imageUrl` only if changed. | Replace with a real gallery. |

## 1. Comparing the three approaches

| | A. One gallery, tagged images | B. A gallery per variant | Hybrid as proposed |
| --- | --- | --- | --- |
| Upload effort | Low: upload once | High: colours × views, shared shots repeated | Low–medium |
| Duplicates | None | Repeated unless references are used | None |
| Customer sees | Black selected, but White/Blue shots still sit in the strip | Clean per-colour gallery | Clean |
| Handles "size doesn't change the look" | Yes | **No**: S/Black, M/Black, L/Black are separate variants | Yes |
| Handles a price-only choice that changes the look (bed Material) | Only if tagged to it | **No**: not a variant | Only if tags attach to variants |
| Survives editing options | Tags can orphan | Rows regenerate and orphan | Same problem if keyed to variants |
| Seller mental model | "Which photos go with Black?" | "Fill four galleries" | Two concepts |

**What I'd challenge in the hybrid:** the unit of assignment should not be the **variant**. Variants are stock combinations (size × colour); they are archived and regenerated whenever choices change, and price-only choices such as Material are not variants at all. Assign photos to **option values** instead (Colour = Black), which already have stable ids and cover both stock and price-only choices. A combination-specific photo is simply a photo tied to values of more than one choice.

## 2. Recommendation: one gallery, photos tagged with option values

**Core idea.** The seller manages one ordered gallery. Each photo may optionally say "show this for…" one or more values of any choice. No tag means "shown for everything".

- **Within one choice, tags are OR** (Black or White). **Across choices, tags are AND** (Black and Wood).
- This one rule replaces both options A and B:
  - Tag one photo per colour → the main image swaps (A).
  - Tag a full set per colour → the whole gallery swaps (B).
  - Photos with no tag stay as shared shots (size chart, lifestyle, back view).
- No tag on **Size** means Black + Large and Black + Medium show the same gallery with no extra work.
- Nothing ever needs a per-combination gallery, so there is no combinatorial blow-up. A bed with Size × Material × Colour × Storage needs tags only on the choices that change the look.

### Display rules (the same function runs in the storefront, the builder preview, the API and checkout)

1. **Which value counts for each choice:** the shopper's pick; if they haven't picked, the value the **cover photo** is tagged with; if the cover is untagged, the choice's default (or first) value. Used for *images only*; it never selects anything for purchase.
2. **Visible photos:** every photo whose tags are all satisfied by step 1. Untagged photos are always satisfied. Choices hidden by a condition are ignored.
3. **Order:** photos tagged for the shopper's choices **lead**, in the seller's order. Shared photos follow, in the seller's order. So picking Black puts the Black shot first even if a shared front view sits earlier in the gallery.
4. **Main image = first photo.** A photo shows once only (guaranteed by the data model).
5. **Gallery vs main image:** changes whenever the visible set changes. If the picked value has no photos, nothing changes (the shopper keeps the shared gallery).
6. **Fallback chain, never empty:** (a) matching tagged photos then shared ones → (b) shared photos only → (c) all photos in the seller's order, cover first → (d) the theme placeholder (product stays sellable).
7. **Cover** = position 0. It is the card, search, share and cart-thumbnail image before any choice. Cart lines and order snapshots use the first photo of the line's **resolved** gallery, so a Black T-shirt shows black in the cart.

### Why this beats the alternatives
- Smaller seller task: upload, then optionally answer "which colour is this?" per photo.
- Works for choices that are not stock variants.
- Survives editing: tags reference stable value ids; deleting a value prunes its tags and warns.
- One pure function shared by every surface, so preview and live store cannot disagree (the approach used for choices in phase 6).

## 3. Seller experience (single page, no extra screens)

```
Photos                                          12 / 30   [ + Add photos ]
┌─────┬─────┬─────┬─────┬─────┐  drag to reorder · tap a photo for details
│COVER│     │     │     │     │  every tile: ⠿ handle · alt text · remove
│     │     │     │     │     │  chip under a tile: "All" or "Black", "Black · Wood"
└─────┴─────┴─────┴─────┴─────┘
 Select several → [ Show for… ▾ ]  [ Remove from product ]

Choices ▸ Colour  (Black, White, Blue)
   ☑ Photos change with Colour                 ← offered automatically for colour-like choices
   Black  [▣][▣][▣] + Choose photos            ← strip of assigned photos
   White  [▣][▣]    + Choose photos
   Blue   (no photos yet — shoppers see the shared photos)

Combinations table: extra "Photo" column (the first photo that variant will show)

Preview rail: real gallery; switching Colour in the preview swaps the gallery
```

- **Simple product:** just the Photos grid. Nothing about options appears.
- **Smart defaults:**
  - The "Photos change with…" prompt appears for choices that look like appearance (swatch display, or named Colour/Finish/Style/Pattern/Material); other choices stay out of the way.
  - **Filename matching:** after uploading, if filenames contain value names (`black-front.jpg`), propose the tags with one "Apply" and an undo. Always a suggestion.
  - Uploading from inside a value strip adds the photo to the gallery **and** tags it at once.
- **Two views, one dataset:** tag from the photo (fast for bulk) or from the value (discoverable). Both edit the same `appliesTo` data.
- **Reuse:** "Choose from library" lists the store's existing images; the same file is never stored twice (content hash).
- **Remove vs delete:** *Remove* unlinks from this product (the library keeps it). Library deletion stays blocked while anything uses the image. An "unused photos" list helps clean up.
- **Replace:** upload a new file into an existing tile; position and tags carry over.
- **Accessibility:** drag and drop always has up/down buttons (as the Choices cards do); alt text field per photo with a gentle "describe it" nudge.

## 4. Data model

Two additive migrations; nothing is rewritten.

```sql
ALTER TABLE "ProductMedia"
  ADD COLUMN "appliesTo" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT "ProductMedia_appliesTo_check" CHECK (jsonb_typeof("appliesTo") = 'object');

ALTER TABLE "Media" ADD COLUMN "contentHash" TEXT;            -- sha-256 of the original bytes
CREATE UNIQUE INDEX "Media_storeId_contentHash_key" ON "Media"("storeId","contentHash") WHERE "contentHash" IS NOT NULL;
```

Example (`ProductMedia` rows for a T-shirt):

| position | mediaId | appliesTo |
| --- | --- | --- |
| 0 (cover) | black-front | `{"colour":["black"]}` |
| 1 | black-back | `{"colour":["black"]}` |
| 2 | white-front | `{"colour":["white"]}` |
| 3 | size-chart | `{}` |
| 4 | bed-black-wood | `{"colour":["black"],"material":["wood"]}` |

- **Why a JSON column and not a join table:** tags are only ever read with the product, the options themselves already live in JSON, and a row's tags then change atomically with the row. Integrity is validated on write (ids exist in the product's options) and pruned when a choice or value is removed.
- **Why not `ProductVariant`↔`Media`:** see section 1.
- **API:** `PUT /catalog/products/:id/media` replaces the gallery in one transaction: `{ items: [{ mediaId, altText?, appliesTo? }] }` (array order = position). Product create/update also accept `media`. Reads return `appliesTo`, `width`, `height`, `mimeType`, `altText`.
- **Rules enforced server-side:** ≤ 30 photos; media must belong to the same store; no repeats; `appliesTo` option/value ids must exist in the (new) options; hidden-by-condition choices are not allowed as tags.
- **Legacy `imageUrl`:** becomes non-destructive. Same as the current cover → no-op. Product has one photo → replace it (today's behaviour). Product has several → add/move it to the cover and keep the rest. The classic form is also changed to send `imageUrl` only when it changed.

## 5. Delivery, speed and safety

- **Upload processing:** auto-rotate and **strip EXIF** (removes GPS), keep the original; generate fixed WebP copies at 320/640/1280 px **at upload** (cold-start friendly on Firebase Functions; read stays a plain file read). Reject < 300 px; warn < 800 px; keep the 40 MP guard and size cap.
- **Serving:** `?w=` accepts only the fixed widths; `Cache-Control: public, max-age=31536000, immutable` plus ETag (safe: a replaced photo gets a new media id).
- **Storefront:** `srcset`/`sizes`, intrinsic `width`/`height` to prevent layout shift, first image eager with high fetch priority, the rest lazy; thumbnails at 320 px; preload the first photo of a value on hover/focus; 150 ms cross-fade; fixed gallery height so the page doesn't jump.
- **External images** (legacy `external/…` rows) are shown as-is, without derivatives.
- **Cleanup:** never automatic. A library tab lists unreferenced images older than 30 days for manual delete.

## 6. Components and responsibilities

**Shared package** (`storefront-schema/src/product-media.ts`, pure, used by API, storefront, builder and checkout)
`resolveProductGallery(media, options, selections, cover)`, `validateMediaAssignments(media, options)`, `pruneMediaAssignments(media, options)`, `suggestAssignmentsFromFilenames(media, options)`.

**Backend:** media service (hash de-dupe, EXIF strip, derivatives, cache headers), catalog service (gallery write + validation), checkout (`imageSnapshot` from the resolved gallery), reference reader (unchanged; already counts `ProductMedia`).

**Builder:** `PhotosSection` (multi-upload with per-tile progress/retry, drag + button reorder, cover, alt text, unlink, replace), `MediaPickerSheet` (library, upload-and-assign), `ValuePhotoStrip` (inside Choices), `PhotoTags` (chip + bulk "Show for…"), `Combinations` photo column, `BuyerPreview` gallery.

**Storefront:** `ProductGalleryViewer` in the renderer (main image + thumbnail strip; existing "stacked" and "grid" layouts kept), fed by the presentation context's resolved `media`.

## 7. Migration of existing products

1. Existing `ProductMedia` rows have `appliesTo = {}` → shown for everything → **identical to today**. Nothing to rewrite.
2. A read-only staging count of placeholder images (`external/…` rows with the Unsplash default) to decide whether to flag them in the builder ("this is a sample photo").
3. Hashes are filled lazily (new uploads only); old duplicates stay but can be merged from the library later.

## 8. Roadmap (each phase shippable, behind a per-store flag)

1. **Shared logic** + tests (gallery resolution truth table, validation, filename suggestions). No UI.
2. **Backend:** migrations (shown for approval before staging), upload hardening, derivatives + caching, gallery write API, non-destructive `imageUrl`, checkout snapshot.
3. **Photos section** in the builder (no tagging yet).
4. **Tagging UI** (value strips, chips, bulk, suggestions, combinations column, preview gallery).
5. **Storefront gallery** (switching, srcset, preload) and cart/order thumbnails.
6. **Polish:** unused-photos list, accessibility pass, Playwright journeys (colour T-shirt, three-choice bed), docs, retire the single-photo field.

**Testing:** pure truth-table tests for the resolver (no tags, all tagged, mixed, multi-choice AND/OR, hidden choice, cover default, no match fallback); API tests (tenant isolation, caps, atomic reorder, bad tags, hash de-dupe, headers, EXIF removed, width whitelist); staging SQL checks inside a rolled-back transaction; component tests (upload states, keyboard reorder, bulk tag, preview swapping); Playwright on the storefront gallery; budgets for CLS and LCP on the product page.

## 9. Decisions for you

1. Tag **option values** (recommended), not variants.
2. Tags stored as JSON on `ProductMedia` (recommended) vs a join table.
3. Non-destructive `imageUrl` with the single-photo shortcut described above.
4. 30 photos per product; minimum 300 px.
5. Strip EXIF from uploads (the stored original changes; GPS is removed).
6. Derivatives generated at upload (recommended for Firebase Functions) vs on demand.
