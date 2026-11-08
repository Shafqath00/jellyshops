import type { SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";
import { DEFAULT_LOW_STOCK_THRESHOLD, stockStatusOf, type CatalogInventoryRow, type Connection, type InventoryAdjustment, type InventoryAdjustmentReason, type ListInventoryHistoryInput, type ListInventoryInput, type UpdateInventoryInput } from "./types.js";

const revision = `(to_char(i."updatedAt",'YYYY-MM-DD HH24:MI:SS.US') || ':' || i."quantity" || ':' || i."reserved")`;
const projection = `SELECT p."id" AS "productId",v."id" AS "variantId",p."title" AS "productTitle",
 v."title" AS "variantTitle",v."sku",v."barcode",v."lowStockThreshold",v."trackInventory",i."quantity",COALESCE(i."reserved",0) AS reserved,
 ${revision} AS revision FROM "ProductVariant" v JOIN "Product" p ON p."storeId"=v."storeId" AND p."id"=v."productId"
 LEFT JOIN "InventoryLevel" i ON i."storeId"=v."storeId" AND i."variantId"=v."id"`;
function row(value: Record<string, unknown>): CatalogInventoryRow {
  const quantity = value.quantity == null ? null : Number(value.quantity), reserved = Number(value.reserved);
  const lowStockThreshold = value.lowStockThreshold == null ? null : Number(value.lowStockThreshold);
  return { productId:String(value.productId),variantId:String(value.variantId),productTitle:String(value.productTitle),
    variantTitle:String(value.variantTitle),sku:value.sku == null ? null : String(value.sku),barcode:value.barcode == null ? null : String(value.barcode),lowStockThreshold,
    stockStatus:stockStatusOf(Boolean(value.trackInventory),quantity,reserved,lowStockThreshold),trackInventory:Boolean(value.trackInventory),
    quantity,reserved,availableQuantity:value.trackInventory && quantity !== null ? Math.max(0,quantity-reserved) : null,
    revision:value.revision == null ? null : String(value.revision) };
}
export async function listInventory(db: SqlExecutor, storeId: string, input: ListInventoryInput): Promise<Connection<CatalogInventoryRow>> {
  const values: unknown[] = [storeId], filters = ['v."storeId"=$1','v."archivedAt" IS NULL',`p."status" != 'ARCHIVED'`];
  if (input.query) { values.push('%'+input.query+'%'); const bind='$'+values.length; filters.push(`(p."title" ILIKE ${bind} OR v."title" ILIKE ${bind} OR v."sku" ILIKE ${bind} OR v."barcode" ILIKE ${bind})`); }
  const available = 'GREATEST(COALESCE(i."quantity",0)-COALESCE(i."reserved",0),0)';
  if (input.stock === "out") filters.push('v."trackInventory"=true AND i."quantity" IS NOT NULL AND '+available+'<=0');
  if (input.stock === "low") filters.push('v."trackInventory"=true AND i."quantity" IS NOT NULL AND '+available+'>0 AND '+available+'<=COALESCE(v."lowStockThreshold",'+DEFAULT_LOW_STOCK_THRESHOLD+')');
  if (input.cursor) { values.push(input.cursor); filters.push('v."id">$'+values.length); }
  values.push(input.limit+1);
  const result=await db.query(projection+' WHERE '+filters.join(' AND ')+' ORDER BY v."id" LIMIT $'+values.length,values);
  const nodes=result.rows.slice(0,input.limit).map(row);
  return {nodes,nextCursor:result.rows.length>input.limit ? nodes.at(-1)!.variantId : null};
}
export async function updateInventory(db: SqlExecutor, storeId: string, variantId: string, input: UpdateInventoryInput): Promise<CatalogInventoryRow> {
  if (!Number.isInteger(input.quantity) || input.quantity < 0) throw new ApiError(422,"INVENTORY_INVALID","Stock must be a whole number, zero or more.");
  // The settings are read by the stock-history trigger, which records this change as a manual adjustment.
  const changed=await db.query(`WITH ctx AS (SELECT set_config('jelly.inventory_reason','manual',true) AS reason,
    set_config('jelly.inventory_note',$5,true) AS note,set_config('jelly.inventory_actor',$6,true) AS actor)
    UPDATE "InventoryLevel" i SET "quantity"=$3,
    "updatedAt"=GREATEST(clock_timestamp(),i."updatedAt"+interval '1 millisecond')
    FROM "ProductVariant" v, ctx WHERE i."storeId"=$1 AND i."variantId"=$2
    AND v."storeId"=i."storeId" AND v."id"=i."variantId" AND v."archivedAt" IS NULL
    AND v."trackInventory"=true AND ${revision}=$4 AND i."reserved"<=$3 RETURNING i."variantId"`,
    [storeId,variantId,input.quantity,input.expectedRevision,input.note?.trim() ?? "",input.actor ?? ""]);
  const latest=await db.query(projection+' WHERE v."storeId"=$1 AND v."id"=$2 AND v."archivedAt" IS NULL',[storeId,variantId]);
  if (!latest.rows[0]) throw new ApiError(404,"NOT_FOUND","This product version was not found.");
  const current=row(latest.rows[0]);
  if (!changed.rows.length) {
    if (!current.trackInventory || !current.revision) throw new ApiError(409,"INVENTORY_NOT_TRACKED","Turn on stock tracking in the product editor first.");
    if (current.revision !== input.expectedRevision) throw new ApiError(409,"INVENTORY_CHANGED","Stock changed while you were editing. Refresh the row and try again.");
    throw new ApiError(409,"INVENTORY_RESERVED","Stock cannot be lower than the quantity reserved by active checkouts.");
  }
  return current;
}

const HISTORY_CURSOR = /^\d{1,18}$/;
/** Newest first. Rows are only ever appended by the database trigger, so this is a faithful audit trail. */
export async function listInventoryHistory(db: SqlExecutor, storeId: string, variantId: string, input: ListInventoryHistoryInput): Promise<Connection<InventoryAdjustment>> {
  if (input.cursor !== undefined && !HISTORY_CURSOR.test(input.cursor)) throw new ApiError(422,"INVENTORY_HISTORY_CURSOR","That page of history is not valid.");
  const variant=await db.query('SELECT 1 FROM "ProductVariant" WHERE "storeId"=$1 AND "id"=$2',[storeId,variantId]);
  if (!variant.rows.length) throw new ApiError(404,"NOT_FOUND","This product version was not found.");
  const values: unknown[] = [storeId,variantId], filters = ['a."storeId"=$1','a."variantId"=$2'];
  if (input.cursor) { values.push(input.cursor); filters.push('a."id"<$'+values.length+'::bigint'); }
  values.push(input.limit+1);
  const result=await db.query(`SELECT a."id"::text AS "id",a."quantityDelta",a."quantityAfter",a."reason",a."note",a."actor",a."createdAt"
    FROM "InventoryAdjustment" a WHERE ${filters.join(' AND ')} ORDER BY a."id" DESC LIMIT $${values.length}`,values);
  const nodes=result.rows.slice(0,input.limit).map((entry: Record<string, unknown>): InventoryAdjustment => ({
    id:String(entry.id),quantityDelta:Number(entry.quantityDelta),quantityAfter:Number(entry.quantityAfter),
    reason:String(entry.reason) as InventoryAdjustmentReason,note:entry.note == null ? null : String(entry.note),actor:entry.actor == null ? null : String(entry.actor),
    createdAt:entry.createdAt instanceof Date ? entry.createdAt.toISOString() : new Date(String(entry.createdAt)).toISOString() }));
  return {nodes,nextCursor:result.rows.length>input.limit ? nodes.at(-1)!.id : null};
}
