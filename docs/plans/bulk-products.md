# Bulk products: import, export and bulk edit

13 November 2026. Design for Phase 4 of the admin polish brief. Decisions taken with the owner on 13 November: libraries `papaparse` (CSV) and `exceljs` (Excel) are allowed; the migration is written and tested locally and applied to staging only after approval; phases run back to back.

## 1. What merchants get

- **Export** all products, the current filtered list, or the selected rows, as CSV or Excel, in the same columns as the import template.
- **Import** a CSV or Excel file: upload, match columns, check, preview what will happen, confirm, watch progress, read the results, download an error report, undo.
- **Bulk edit** selected products from the list: price, stock, status, collections, tags, brand, type, with a before and after preview.

Export, edit in a spreadsheet, import again updates the same products and never creates copies.

## 2. File format

One row per variant. A product with no options is one row. Rows of the same product share the **Handle** (the web address ending); they usually sit next to each other, but rows with the same handle anywhere in the file are treated as one product. Product columns (title, description, …) are read from the product's first row. A row with no handle belongs to the product its SKU already belongs to, else to a handle made from its title, else to the product on the row above.

| Column | Level | Rules |
| --- | --- | --- |
| Handle | product | Lowercase letters, numbers, hyphens. Empty on a new product: made from the Title. |
| Title | product | Required for a new product. Up to 255 characters. |
| Description | product | Plain text, up to 20,000 characters. Replaces a formatted description. |
| Status | product | `active`, `draft` or `archived` (also Active/Draft/Archived). New products default to draft. |
| Brand | product | Free text, up to 160. |
| Type | product | Free text, up to 160. |
| Collections | product | Collection names separated by `;`. Must already exist (matched by name or web address, without case). |
| Tags | product | Separated by `,`. Up to 50 tags. |
| Option 1 name … Option 3 value | variant | Up to three options (Size, Colour, …). A product with options needs a value in every option column it uses, on every row. |
| SKU | variant | Up to 120 characters. Unique in the store. |
| Barcode | variant | Up to 64. |
| Price | variant | Required for a new variant. `499`, `499.50`, `£499.50`, `1,299.00`. Not negative. |
| Compare-at price | variant | Price before a discount. Empty clears it. |
| Cost | variant | What the item costs the merchant. |
| Stock | variant | Whole number, 0 or more. Empty leaves stock alone. |
| Track stock | variant | `yes` or `no`. |
| Weight (g) | variant | Whole grams. |
| SEO title | product | Up to 70. |
| SEO description | product | Up to 160. |
| Image URLs | product | https addresses separated by `;`, up to 10 per product per import, 8 MB each. Added to the product's photos; none are removed. The store's own photo addresses (as written by an export) are linked without downloading (section 9). |

Headers are matched without regard to case, spaces or punctuation, with common aliases ("Vendor" = Brand, "Product type" = Type, "Variant SKU" = SKU, "Body" = Description). The merchant can re-match any column or choose "Don't import".

Templates (`GET …/bulk/template?format=csv|xlsx`) hold the header row and three example rows. The Excel template has a second sheet, **How to fill this in**, listing every column, what is allowed, an example and common mistakes.

**Tolerance.** CSV: UTF-8 with or without BOM, comma, semicolon or tab (detected), quoted cells with line breaks, blank rows skipped, cells trimmed. Excel: first sheet, formulas read as their last result, dates and numbers read as text.

## 3. Matching and modes

A row finds an existing variant by **SKU** when the row has one; otherwise it finds the product by **Handle** and the variant by its option values (a product without options has one variant). Both lookups are inside the store (every query takes `storeId`).

| Mode | Existing product | New product |
| --- | --- | --- |
| Create only | skipped ("already exists") | created |
| Update only | updated | skipped ("not in your store") |
| Create or update | updated | created |

**Updating changes only the columns in the file.** A column that is not matched is never touched. A matched column with an empty cell clears the value where clearing makes sense (brand, type, tags, compare-at price, barcode, SEO) and is ignored where it does not (title, price, stock, status).

Adding a row with new option values to an existing product adds a variant; the product's options gain the new values. Rows never remove variants or options.

## 4. Validation (nothing is saved)

Every row gets one outcome: **create**, **update**, **skip** or **problem**, with plain reasons naming the column. Problems on any row of a product stop that whole product (so a product is never half-imported); other products carry on.

Checked: required title and price for new products; price, cost and stock formats; status words; handle format; unknown collection; text too long; more than three options; an option value missing on some rows; the same combination twice; more than 100 variants; the same SKU twice in the file; a SKU that belongs to a different product in the store; a row that cannot be tied to any product.

## 5. Limits

| Limit | Value | Message |
| --- | --- | --- |
| File size | 5 MB | "This file is larger than 5 MB. Split it into smaller files." |
| Rows | 5,000 | "This file has N rows. The most in one import is 5,000." |
| Columns | 60 | extra columns are ignored |
| Variants per product | 100 (platform rule) | per product |
| Imports per store | 10 uploads per 10 minutes; one import running at a time | "Wait for the import that is running to finish." |
| Export | 5,000 products | banner when more exist, with advice to filter |

## 6. How an import runs

The API function stops after 60 seconds, so no request does the whole job.

1. `POST /api/stores/:storeId/catalog/imports` (multipart, field `file`) parses the file, stores the rows in a `ProductImport` record and returns the headers, a suggested column match and a sample.
2. `POST …/imports/:id/check` `{ mapping, mode }` plans every row against the store and returns counts, the first 200 planned rows and the first 500 problems. Status `checked`. It can be repeated with another mapping or mode.
3. `POST …/imports/:id/run` applies the next 20 products and returns progress. The browser calls it until the status is `finished`. Each product is saved in its own transaction through the same `CatalogService.createProduct` / `updateProduct` the product builder uses, so every existing rule applies.
4. `GET …/imports/:id` returns the state; `GET …/imports/:id/report` is the error report as CSV (row number, column, reason, the row's handle and title).
5. `POST …/imports/:id/undo` reverses a finished import (section 8).
6. `GET …/imports` lists the store's imports (who, when, file name, counts): the audit trail.

**Safe to stop and resume.** The record keeps a cursor (the next product to do). If the tab closes, the import page shows the unfinished import with "Carry on". A product saved just before a crash is found again by its handle or SKU on the next run, so it is updated or skipped, never created twice. A run request that finds another one in flight (a lock on the row) answers with the current progress.

A failed product (for example a rule in the catalogue refuses it) is recorded against its rows and the import moves on.

## 7. Data model

One table, migration `20261113000000_product_imports.sql` (in `backend/sql/migrations` and `backend/supabase/migrations`, listed in `test/integration/pglite.ts`). RLS on, `jelly_backend` policy only, like the other server-only tables.

`ProductImport`: `id`, `storeId`, `createdBy` (user id), `fileName`, `format` (csv/xlsx), `status` (uploaded, checked, running, finished, undone), `mode`, `headers` jsonb, `rows` jsonb (cell text), `mapping` jsonb, `summary` jsonb (counts from the last check), `cursor` int, `results` jsonb (per product: rows, outcome, product id, reasons), `undo` jsonb (ids created, and for updated products the values before), `counts` jsonb (created, updated, skipped, failed), timestamps `createdAt`, `updatedAt`, `finishedAt`, `undoneAt`.

Rows are removed from finished imports after 30 days by the import service when a new import starts (the results and counts stay).

## 8. Undo

Possible, with one limit. Undo **archives** the products the import created (products are never hard-deleted in this platform) and **puts back** the values the import changed on existing products: title, description, status, brand, type, tags, collections, SEO, and each variant's SKU, barcode, price, compare-at price, cost and weight. **Stock is not put back**, because orders may have changed it since; the result page says so. Variants an import added to an existing product are switched to "not for sale" rather than removed. Undo is offered for 30 days.

## 9. Images

Built on 14 November 2026.

**From web addresses in an import.** The Image URLs cell of a product's first row lists photo addresses. They are checked when the file is checked (https only, no sign-in details, no port, never a local or private address, at most 10) and a bad address holds the product back like any other problem. During the import, after a product is saved, each photo is fetched by the server, stored through the same media service as every other upload (which checks the bytes really are a JPEG, PNG, WebP, GIF or AVIF and makes the resized copies), and added after the product's existing photos. A photo that cannot be fetched or is not a picture is reported ("Imported, but a photo was not added", with the address and the reason); the product stays imported. Undo does not take photos off a product.

**Safe fetching (`backend/src/catalog-bulk/image-fetch.ts`).** The address comes from a merchant's file, so it is treated as hostile: the host name is looked up once, every address it returns must be on the public internet (loopback, private, link-local and cloud metadata, carrier NAT, multicast, documentation ranges, IPv4-mapped and NAT64 IPv6 are refused, and one private address among several refuses the name), and the connection is made to exactly the address that was checked. Redirects are followed by hand, three at most, with the same checks each time. 8 MB and 8 seconds per photo. A step of the import stops taking new products after 25 seconds, so slow downloads cannot run into the request limit.

**Photo files in bulk (`/admin/products/photos`).** The merchant drops up to 300 photo files. `POST …/catalog/bulk/photo-matches` matches each file name to a product: first as an item's SKU, then as a product's handle, ignoring capitals, the extension and a trailing number or word such as `-2`, `_3`, `(4)`, `-front`. The page shows every file with the product it will go to, and files with no match, before anything is uploaded. `POST …/catalog/bulk/photos` (multipart: `productId`, `file`) then stores one photo and adds it to the end of the product's photos; files go up one at a time in name order. A product keeps to 30 photos; the same photo is not added twice. 600 photos per 10 minutes per store and user.

## 10. Security

- Every route is under `/api/stores/:storeId/…` with `requireStorePermission("catalog:edit")` (`catalog:view` for export and reads). An import id from another store answers 404.
- Files are parsed in memory and never written to disk or executed. Excel files are read with `exceljs`; macros are not run; only the first sheet's cell values are used.
- Export guards against formula injection: a cell that starts with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with `'`. On import a leading `'` before one of those characters is removed, so a round trip is unchanged. The existing order and customer exports get the same guard.
- Upload rate limit per store and user; file size checked by the upload middleware before parsing.
- Messages never include raw database errors.

## 11. Bulk edit

From the product list: select rows, **Bulk edit**. Choose one change:

- Price: set to, raise by amount, lower by amount, raise by %, lower by % (rounded to the penny, never below 0).
- Compare-at price: set, clear.
- Stock: set to, add, take away (tracked variants only; never below 0).
- Status: active, draft, archived.
- Collections: add to, remove from.
- Tags: add, remove.
- Brand, Type: set, clear.

A preview table shows each affected product or variant with the value before and after, and rows that cannot change (for example stock on a product that does not track stock). Confirm applies the change product by product with a progress line; failures are listed and the rest carry on. Every change, stock included, is saved through the ordinary product update (`PATCH /catalog/products/:id`), one product at a time. Stock changed this way is not given its own reason in stock history; use Inventory for counted adjustments with a reason.

The selection is the rows ticked on the page shown (up to 50). To change more, filter the list and repeat, or export, edit and import.

## 12. Screens

- Products list: **Import** and **Export** in the page header; **Bulk edit** in the selection bar.
- `/admin/products/import`: steps Upload, Match columns, Check, Import, Results, built from kit parts; progress is announced to screen readers (`role="status"`, `aria-live`); every step works with the keyboard.
- Earlier imports are listed under the upload box with their counts, the report and Undo.

## 13. What was built (13 November 2026)

Built as designed: sections 1 to 8 and 10 to 12. Code: `backend/src/catalog-bulk/` (`sheet.ts` format and file reading/writing, `plan.ts` the planner, `service.ts`, `routes.ts`), `jellyshops/src/features/product-bulk/` (`api.ts`, `import-wizard.tsx`, `export-dialog.tsx`, `bulk-edit.ts`, `bulk-edit-dialog.tsx`), page `/admin/products/import`.

Not built: a server worker that carries an import on while the browser is closed (the merchant chooses "Carry on"); "select all matching" for bulk edit beyond the 50 rows on a page; an import that changes a product's handle.

The migration is written and tested against the in-memory test database only. **It must be applied to staging and production before import works there**; export, the template and bulk edit need no migration.

## 14. Tests

- Unit: header matching, cell parsing (money, numbers, yes/no, lists), formula guard both ways, planning (create, update, skip, every validation), bulk edit maths.
- Integration (PGlite): upload, check, run in chunks, resume, another store's id is 404, undo.
- Frontend: wizard steps with mocked API, axe on each step, export link building.
