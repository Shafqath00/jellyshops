import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '../http/errors.js';
import type { StripeGateway } from '../stripe/client.js';
import type { CommerceRepository, SqlExecutor } from './repository.js';
type Row = Record<string, any>;
export interface OrderQuery {
    query?: string;
    status?: string;
    paymentStatus?: string;
    sort?: string;
    direction?: string;
    page?: number;
    pageSize?: number;
}
export interface ItemQuantity {
    variantId: string;
    configurationKey?: string;
    quantity: number;
}
export interface OrderEdit {
    revision: number;
    items: ItemQuantity[];
    shippingMinor?: number;
    idempotencyKey?: string;
}
function fail(code: string, message: string, status = 409): never { throw new ApiError(status, code, message); }
const key = (i: Row) => `${i.variantId}:${i.configurationKey ?? ''}`;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = (prefix: string) => `${prefix}-${randomUUID()}`;
export async function appendOrderEvent(tx: SqlExecutor, storeId: string, orderId: string, type: string, details: unknown = {}, actorId: string | null = null) { await tx.query(`INSERT INTO "OrderEvent" (id,"storeId","orderId",type,details,"actorId") VALUES ($1,$2,$3,$4,$5,$6)`, [id('event'), storeId, orderId, type, JSON.stringify(details), actorId]); }

/** Queues a shopper message through the database queue, which skips stores without order management enabled. */
async function queueShipmentNotification(tx: SqlExecutor, storeId: string, orderId: string, type: string, dedupeKey: string) {
    await tx.query(`SELECT jelly_queue_notification($1,$2,$3,$4,'{}'::jsonb)`, [storeId, orderId, type, dedupeKey]);
}
export class OrderManagementService {
    constructor(private readonly repository: CommerceRepository, private readonly stripe: StripeGateway) { }
    async settings(storeId: string) { return this.repository.transaction(async (tx) => { const row = (await tx.query<Row>(`SELECT enabled FROM "StoreOrderManagementSettings" WHERE "storeId"=$1`, [storeId])).rows[0]; return { enabled: row?.enabled ?? false }; }); }
    async updateSettings(storeId: string, enabled: boolean) { return this.repository.transaction(async (tx) => { await tx.query(`INSERT INTO "StoreOrderManagementSettings" ("storeId",enabled) VALUES ($1,$2) ON CONFLICT ("storeId") DO UPDATE SET enabled=EXCLUDED.enabled`, [storeId, enabled]); return { enabled }; }); }
    private async lock(tx: SqlExecutor, storeId: string, orderId: string, revision?: number): Promise<Row> {
        const order = (await tx.query<Row>(`SELECT * FROM "Order" WHERE "storeId"=$1 AND id=$2 FOR UPDATE`, [storeId, orderId])).rows[0];
        if (!order)
            return fail('ORDER_NOT_FOUND', 'Order not found.', 404);
        if (revision !== undefined && order.revision !== revision)
            return fail('ORDER_REVISION_CONFLICT', 'This order changed. Refresh and review the latest version.');
        return order;
    }
    private async bump(tx: SqlExecutor, storeId: string, orderId: string) { return (await tx.query<Row>(`UPDATE "Order" SET revision=revision+1,"updatedAt"=now() WHERE "storeId"=$1 AND id=$2 RETURNING *`, [storeId, orderId])).rows[0]; }
    async search(storeId: string, q: OrderQuery) {
        return this.repository.transaction(async (tx) => {
            const page = Math.max(1, Math.floor(q.page ?? 1)), pageSize = Math.min(100, Math.max(1, Math.floor(q.pageSize ?? 25)));
            const values: unknown[] = [storeId];
            const where = ['o."storeId"=$1'];
            if (q.query) {
                values.push('%' + q.query.replace(/[\\%_]/g, '\\$&') + '%');
                where.push(`(o.number ILIKE $${values.length} OR o."customerSnapshot"::text ILIKE $${values.length} OR EXISTS(SELECT 1 FROM "OrderItem" i WHERE i."orderId"=o.id AND i."storeId"=o."storeId" AND (i."titleSnapshot" ILIKE $${values.length} OR i."productTitleSnapshot" ILIKE $${values.length})))`);
            }
            if (q.status) {
                values.push(q.status);
                where.push(`o.status=$${values.length}`);
                if (q.status === 'PAID') where.push(`o."fulfilmentStatus" NOT IN ('FULFILLED','DELIVERED')`);
            }
            if (q.paymentStatus) {
                values.push(q.paymentStatus);
                where.push(`p.status=$${values.length}`);
            }
            const join = `FROM "Order" o LEFT JOIN "Payment" p ON p."orderId"=o.id AND p."storeId"=o."storeId" WHERE ${where.join(' AND ')}`;
            const total = Number((await tx.query<Row>(`SELECT count(*)::int AS total ${join}`, values)).rows[0]?.total ?? 0);
            const sort = { date: 'o."createdAt"', status: 'o.status', amount: 'o."totalMinor"' }[q.sort ?? 'date'] ?? 'o."createdAt"';
            const direction = q.direction === 'asc' ? 'ASC' : 'DESC';
            const orders = (await tx.query<Row>(`SELECT o.*,p.status AS "paymentStatus",p."paymentIntentId", (SELECT COALESCE(jsonb_agg(jsonb_build_object('variantId',i."variantId",'titleSnapshot',i."titleSnapshot",'imageSnapshot',i."imageSnapshot",'quantity',i.quantity)),'[]'::jsonb) FROM "OrderItem" i WHERE i."orderId"=o.id AND i."storeId"=o."storeId") AS items ${join} ORDER BY ${sort} ${direction},o.id ${direction} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, (page - 1) * pageSize])).rows;
            const counts = (await tx.query<Row>(`SELECT status,count(*)::int AS count,count(*) FILTER (WHERE "fulfilmentStatus" NOT IN ('FULFILLED','DELIVERED'))::int AS awaiting FROM "Order" WHERE "storeId"=$1 GROUP BY status`, [storeId])).rows;
            const summary: Record<string, number> = { total: 0, PENDING_PAYMENT: 0, PAID: 0, CONFIRMED: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0, REFUNDED: 0 };
            for (const row of counts) {
                summary[row.status] = row.status === 'PAID' ? row.awaiting : row.count;
                summary.total += row.count;
            }
            const settings = (await tx.query<Row>(`SELECT timezone FROM "StoreSettings" WHERE "storeId"=$1`, [storeId])).rows[0];
            const feature = (await tx.query<Row>(`SELECT enabled FROM "StoreOrderManagementSettings" WHERE "storeId"=$1`, [storeId])).rows[0];
            return { orders, total, page, pageSize, summary, timeZone: settings?.timezone ?? "UTC", featureEnabled: feature?.enabled ?? false };
        });
    }
    async details(storeId: string, orderId: string, executor?: SqlExecutor) {
        const work = async (tx: SqlExecutor) => {
            await this.lock(tx, storeId, orderId);
            const result: Row = {};
            for (const [field, table] of Object.entries({ events: 'OrderEvent', notes: 'OrderNote', fulfilments: 'OrderFulfilment', returns: 'OrderReturn', revisions: 'OrderRevision', transactions: 'OrderTransaction' }))
                result[field] = (await tx.query<Row>(`SELECT * FROM "${table}" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "createdAt" DESC`, [storeId, orderId])).rows;
            const exists = (await tx.query<Row>(`SELECT to_regclass('"OrderNotification"') AS name`)).rows[0]?.name;
            result.notifications = exists ? (await tx.query<Row>(`SELECT * FROM "OrderNotification" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "createdAt" DESC`, [storeId, orderId])).rows : [];
            result.operations = (await tx.query<Row>(`SELECT id,kind,status,attempts,"lastError","createdAt","updatedAt" FROM "OrderOperation" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "createdAt" DESC`, [storeId, orderId])).rows;
            result.featureEnabled = (await tx.query<Row>(`SELECT enabled FROM "StoreOrderManagementSettings" WHERE "storeId"=$1`, [storeId])).rows[0]?.enabled ?? false;
            result.timeZone = (await tx.query<Row>(`SELECT timezone FROM "StoreSettings" WHERE "storeId"=$1`, [storeId])).rows[0]?.timezone ?? 'UTC';
            return result;
        };
        return executor ? work(executor) : this.repository.transaction(work);
    }
    async note(storeId: string, orderId: string, body: string, actorId: string | null = null) { return this.repository.transaction(async (tx) => { await this.lock(tx, storeId, orderId); if (!body.trim() || body.length > 10000)
        fail('NOTE_INVALID', 'Enter a comment of 1–10000 characters.', 422); const note = (await tx.query<Row>(`INSERT INTO "OrderNote" (id,"storeId","orderId",body,"actorId") VALUES ($1,$2,$3,$4,$5) RETURNING *`, [id('note'), storeId, orderId, body.trim(), actorId])).rows[0]; await appendOrderEvent(tx, storeId, orderId, 'NOTE_ADDED', { noteId: note.id }, actorId); return note; }); }
    async contact(storeId: string, orderId: string, input: {
        revision: number;
        customerSnapshot: Row;
        deliverySnapshot?: Row;
        billingAddress?: Row;
    }) {
        return this.repository.transaction(async (tx) => {
            const order = await this.lock(tx, storeId, orderId, input.revision);
            if (input.deliverySnapshot && ['SHIPPED', 'DELIVERED'].includes(order.status))
                fail('ADDRESS_LOCKED', 'The shipping address cannot change after shipment.');
            await tx.query(`UPDATE "Order" SET "customerSnapshot"="customerSnapshot"||$3::jsonb,"deliverySnapshot"=COALESCE($4::jsonb,"deliverySnapshot"),"billingAddress"=COALESCE($5::jsonb,"billingAddress") WHERE "storeId"=$1 AND id=$2`, [storeId, orderId, JSON.stringify(input.customerSnapshot), input.deliverySnapshot ? JSON.stringify(input.deliverySnapshot) : null, input.billingAddress ? JSON.stringify(input.billingAddress) : null]);
            await appendOrderEvent(tx, storeId, orderId, 'CONTACT_UPDATED');
            return this.bump(tx, storeId, orderId);
        });
    }
    async tracking(storeId: string, orderId: string, input: {
        revision: number;
        fulfilmentId?: string;
        trackingNumber?: string;
        carrier?: string;
        trackingUrl?: string;
    }) { return this.repository.transaction(async (tx) => { await this.lock(tx, storeId, orderId, input.revision); const result = await tx.query<Row>(`UPDATE "OrderFulfilment" SET "trackingNumber"=$3,carrier=$4,"trackingUrl"=$5 WHERE "storeId"=$1 AND "orderId"=$2 AND ($6::text IS NULL OR id=$6) RETURNING *`, [storeId, orderId, input.trackingNumber ?? null, input.carrier ?? null, input.trackingUrl ?? null, input.fulfilmentId ?? null]); if (!result.rows.length)
        fail('FULFILMENT_NOT_FOUND', 'Create a shipment before adding tracking.', 404); await appendOrderEvent(tx, storeId, orderId, 'TRACKING_UPDATED', input); await this.bump(tx, storeId, orderId); return result.rows; }); }
    private async requirePaid(tx: SqlExecutor, order: Row) { const p = (await tx.query<Row>(`SELECT status FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2`, [order.storeId, order.id])).rows[0]; const pending = (await tx.query<Row>(`SELECT id FROM "OrderRevision" WHERE "storeId"=$1 AND "orderId"=$2 AND status='PENDING'`, [order.storeId, order.id])).rows.length; if (p?.status !== 'PAID' || order.balanceDueMinor > 0 || pending)
        fail('ORDER_NOT_PAID', 'Verified payment and a settled order balance are required.'); }
    private quantities(items: ItemQuantity[]) { if (!items.length || items.some(i => !Number.isSafeInteger(i.quantity) || i.quantity <= 0) || new Set(items.map(key)).size !== items.length)
        fail('ITEM_QUANTITIES_INVALID', 'Choose distinct items with positive integer quantities.', 422); }
    async fulfil(storeId: string, orderId: string, input: {
        revision: number;
        items: ItemQuantity[];
        trackingNumber?: string;
        carrier?: string;
        trackingUrl?: string;
    }) {
        return this.repository.transaction(async (tx) => {
            const order = await this.lock(tx, storeId, orderId, input.revision);
            await this.requirePaid(tx, order);
            if (!['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.status))
                fail('ORDER_TRANSITION_INVALID', 'Confirm this order before shipping.');
            this.quantities(input.items);
            const items = (await tx.query<Row>(`SELECT * FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows;
            const shipments = (await tx.query<Row>(`SELECT items FROM "OrderFulfilment" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows;
            const shipped = new Map<string, number>();
            for (const s of shipments)
                for (const i of s.items)
                    shipped.set(key(i), (shipped.get(key(i)) ?? 0) + i.quantity);
            for (const i of input.items) {
                const item = items.find(x => key(x) === key(i));
                if (!item || item.fulfillmentType === 'DIGITAL' || i.quantity + (shipped.get(key(i)) ?? 0) > item.quantity)
                    fail('FULFILMENT_QUANTITY_INVALID', 'Shipment quantities exceed the remaining physical items.');
                shipped.set(key(i), (shipped.get(key(i)) ?? 0) + i.quantity);
            }
            const result = (await tx.query<Row>(`INSERT INTO "OrderFulfilment" (id,"storeId","orderId",items,"trackingNumber",carrier,"trackingUrl") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id('shipment'), storeId, orderId, JSON.stringify(input.items), input.trackingNumber ?? null, input.carrier ?? null, input.trackingUrl ?? null])).rows[0];
            const full = items.filter(i => i.fulfillmentType !== 'DIGITAL').every(i => (shipped.get(key(i)) ?? 0) >= i.quantity);
            await tx.query(`UPDATE "Order" SET status='SHIPPED',"fulfilmentStatus"=$3,"fulfilmentStartedAt"=COALESCE("fulfilmentStartedAt",now()) WHERE "storeId"=$1 AND id=$2`, [storeId, orderId, full ? 'FULFILLED' : 'PARTIAL']);
            await this.bump(tx, storeId, orderId);
            await appendOrderEvent(tx, storeId, orderId, 'SHIPMENT_CREATED', result);
            return result;
        });
    }
    async deliver(storeId: string, orderId: string, fulfilmentId: string, revision: number) { return this.repository.transaction(async (tx) => { await this.lock(tx, storeId, orderId, revision); const shipment = (await tx.query<Row>(`UPDATE "OrderFulfilment" SET status='DELIVERED',exception=NULL,"deliveredAt"=COALESCE("deliveredAt",now()) WHERE "storeId"=$1 AND "orderId"=$2 AND id=$3 RETURNING *`, [storeId, orderId, fulfilmentId])).rows[0]; if (!shipment)
        fail('FULFILMENT_NOT_FOUND', 'Shipment not found.', 404); const remaining = (await tx.query<Row>(`SELECT 1 FROM "OrderFulfilment" WHERE "storeId"=$1 AND "orderId"=$2 AND status<>'DELIVERED'`, [storeId, orderId])).rows.length; await tx.query(`UPDATE "Order" SET status=CASE WHEN NOT $3 AND "fulfilmentStatus"='FULFILLED' THEN 'DELIVERED' ELSE status END,"fulfilmentStatus"=CASE WHEN NOT $3 AND "fulfilmentStatus"='FULFILLED' THEN 'DELIVERED' ELSE "fulfilmentStatus" END WHERE "storeId"=$1 AND id=$2`, [storeId, orderId, remaining > 0]); await this.bump(tx, storeId, orderId); await appendOrderEvent(tx, storeId, orderId, 'SHIPMENT_DELIVERED', { fulfilmentId }); return shipment; }); }
    /** Records that an order is packed. The shopper gets one message per merchant action. */
    async markPacked(storeId: string, orderId: string, revision: number) { return this.repository.transaction(async (tx) => { const order = await this.lock(tx, storeId, orderId, revision); if (order.status !== 'PROCESSING') fail('ORDER_TRANSITION_INVALID', 'Mark an order as packed once it is being prepared.'); await appendOrderEvent(tx, storeId, orderId, 'ORDER_PACKED', {}); await this.bump(tx, storeId, orderId); await queueShipmentNotification(tx, storeId, orderId, 'PACKED', `packed:${orderId}:${randomUUID()}`); return { packed: true }; }); }
    /** Marks a shipped parcel as out for delivery. Courier updates will set this automatically in a later phase. */
    async markOutForDelivery(storeId: string, orderId: string, fulfilmentId: string, revision: number) { return this.repository.transaction(async (tx) => { await this.lock(tx, storeId, orderId, revision); const shipment = (await tx.query<Row>(`UPDATE "OrderFulfilment" SET status='OUT_FOR_DELIVERY' WHERE "storeId"=$1 AND "orderId"=$2 AND id=$3 AND status='SHIPPED' AND "deliveredAt" IS NULL RETURNING *`, [storeId, orderId, fulfilmentId])).rows[0]; if (!shipment) fail('SHIPMENT_STATE_INVALID', 'This shipment cannot change to out for delivery.'); await this.bump(tx, storeId, orderId); await appendOrderEvent(tx, storeId, orderId, 'SHIPMENT_OUT_FOR_DELIVERY', { fulfilmentId }); await queueShipmentNotification(tx, storeId, orderId, 'OUT_FOR_DELIVERY', `out-for-delivery:${fulfilmentId}:${randomUUID()}`); return shipment; }); }
    /** Reports a delay or failed delivery on a parcel that is on its way, or clears the problem. */
    async setShipmentException(storeId: string, orderId: string, fulfilmentId: string, revision: number, exception: 'DELAYED' | 'DELIVERY_FAILED' | null) { return this.repository.transaction(async (tx) => { await this.lock(tx, storeId, orderId, revision); const shipment = (await tx.query<Row>(`UPDATE "OrderFulfilment" SET exception=$4 WHERE "storeId"=$1 AND "orderId"=$2 AND id=$3 AND status IN ('SHIPPED','OUT_FOR_DELIVERY') AND "deliveredAt" IS NULL RETURNING *`, [storeId, orderId, fulfilmentId, exception])).rows[0]; if (!shipment) fail('SHIPMENT_STATE_INVALID', 'Problems can only be reported on a shipment that is on its way.'); await this.bump(tx, storeId, orderId); if (exception) { await appendOrderEvent(tx, storeId, orderId, 'SHIPMENT_EXCEPTION_SET', { fulfilmentId, exception }); await queueShipmentNotification(tx, storeId, orderId, exception === 'DELAYED' ? 'SHIPMENT_DELAYED' : 'DELIVERY_FAILED', `exception:${fulfilmentId}:${exception}:${randomUUID()}`); } else { await appendOrderEvent(tx, storeId, orderId, 'SHIPMENT_EXCEPTION_CLEARED', { fulfilmentId }); } return shipment; }); }
    async createReturn(storeId: string, orderId: string, input: {
        revision: number;
        items: ItemQuantity[];
        reason: string;
    }) { return this.repository.transaction(async (tx) => { const order = await this.lock(tx, storeId, orderId, input.revision); if (!['SHIPPED', 'DELIVERED'].includes(order.status))
        fail('RETURN_NOT_ALLOWED', 'Returns require shipped physical goods.'); this.quantities(input.items); const shipments = (await tx.query<Row>(`SELECT items FROM "OrderFulfilment" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows; const returns = (await tx.query<Row>(`SELECT items FROM "OrderReturn" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows; const remaining = new Map<string, number>(); for (const row of shipments)
        for (const i of row.items)
            remaining.set(key(i), (remaining.get(key(i)) ?? 0) + i.quantity); for (const row of returns)
        for (const i of row.items)
            remaining.set(key(i), (remaining.get(key(i)) ?? 0) - i.quantity); if (input.items.some(i => i.quantity > (remaining.get(key(i)) ?? 0)))
        fail('RETURN_QUANTITY_INVALID', 'Return quantities exceed shipped goods not already returned.'); const result = (await tx.query<Row>(`INSERT INTO "OrderReturn" (id,"storeId","orderId",items,reason) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [id('return'), storeId, orderId, JSON.stringify(input.items), input.reason])).rows[0]; await this.bump(tx, storeId, orderId); await appendOrderEvent(tx, storeId, orderId, 'RETURN_REQUESTED', result); return result; }); }
    async receiveReturn(storeId: string, orderId: string, returnId: string, input: {
        revision: number;
        sellable: boolean;
    }) { return this.repository.transaction(async (tx) => { await this.lock(tx, storeId, orderId); const row = (await tx.query<Row>(`SELECT * FROM "OrderReturn" WHERE "storeId"=$1 AND "orderId"=$2 AND id=$3 FOR UPDATE`, [storeId, orderId, returnId])).rows[0]; if (!row)
        fail('RETURN_NOT_FOUND', 'Return not found.', 404); if (row.status === 'RECEIVED')
        return row; await this.lock(tx, storeId, orderId, input.revision); if (input.sellable)
        for (const i of row.items)
            await tx.query(`UPDATE "InventoryLevel" SET quantity=quantity+$3,"updatedAt"=now() WHERE "storeId"=$1 AND "variantId"=$2`, [storeId, i.variantId, i.quantity]); const updated = (await tx.query<Row>(`UPDATE "OrderReturn" SET status='RECEIVED',sellable=$4,"receivedAt"=now() WHERE "storeId"=$1 AND "orderId"=$2 AND id=$3 RETURNING *`, [storeId, orderId, returnId, input.sellable])).rows[0]; await this.bump(tx, storeId, orderId); await appendOrderEvent(tx, storeId, orderId, 'RETURN_RECEIVED', { returnId, sellable: input.sellable }); return updated; }); }
    private async previewTx(tx: SqlExecutor, storeId: string, orderId: string, input: OrderEdit) {
        const order = await this.lock(tx, storeId, orderId, input.revision);
        await this.requirePaid(tx, order);
        if (!['PAID', 'CONFIRMED'].includes(order.status) || order.fulfilmentStartedAt)
            fail('ORDER_EDIT_LOCKED', 'Item edits are available before processing and digital delivery.');
        this.quantities(input.items);
        const entitlementTable = (await tx.query<Row>(`SELECT to_regclass('"DigitalEntitlement"') AS name`)).rows[0]?.name;
        if (entitlementTable && (await tx.query<Row>(`SELECT 1 FROM "DigitalEntitlement" WHERE "storeId"=$1 AND "orderId"=$2 LIMIT 1`, [storeId, orderId])).rows.length)
            fail('DIGITAL_EDIT_LOCKED', 'Digital access has already been granted.');
        const originals = (await tx.query<Row>(`SELECT * FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "variantId","configurationKey"`, [storeId, orderId])).rows;
        const result: Row[] = [];
        let subtotalMinor = 0;
        let taxMinor = 0;
        let discountMinor = 0;
        for (const inputItem of [...input.items].sort((a, b) => key(a).localeCompare(key(b)))) {
            const previous = originals.find(i => key(i) === key(inputItem));
            let item: Row;
            if (previous) {
                item = { ...previous, quantity: inputItem.quantity };
                if ((order.taxMinor ?? 0) !== 0 || (order.discountMinor ?? 0) !== 0) {
                    if (previous.taxMinor == null || previous.discountMinor == null)
                        fail('ADJUSTMENT_ALLOCATION_UNKNOWN', 'Captured line tax and discount allocations are required for this edit.');
                    item.taxMinor = Math.round(previous.taxMinor * inputItem.quantity / previous.quantity);
                    item.discountMinor = Math.round(previous.discountMinor * inputItem.quantity / previous.quantity);
                }
            }
            else {
                if ((order.taxMinor ?? 0) !== 0 || (order.discountMinor ?? 0) !== 0)
                    fail('ADJUSTMENT_RECALCULATION_REQUIRED', 'Adding products would require a tax or discount recalculation.');
                const v = (await tx.query<Row>(`SELECT v.*,p.title AS "productTitle",p.options AS "productOptions",to_jsonb(p)->>'fulfillmentType' AS "fulfillmentType",(SELECT m.url FROM "ProductMedia" pm JOIN "Media" m ON m."storeId"=pm."storeId" AND m.id=pm."mediaId" WHERE pm."storeId"=p."storeId" AND pm."productId"=p.id ORDER BY pm.position LIMIT 1) AS "imageSnapshot" FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId" AND p."storeId"=v."storeId" WHERE v."storeId"=$1 AND v.id=$2 AND p.status='ACTIVE'`, [storeId, inputItem.variantId])).rows[0];
                if (!v)
                    fail('VARIANT_NOT_FOUND', 'Product variant not found.', 404);
                const selectedKeys = (inputItem.configurationKey ?? '').split('|').filter(Boolean);
                const configurationSnapshot: Row[] = [];
                const options: Row[] = Array.isArray(v.productOptions) ? v.productOptions : [];
                for (const option of options) {
                    const values: Row[] = Array.isArray(option.values) ? option.values : [];
                    const selected = values.filter(value => selectedKeys.includes(`${option.id}:${value.id}`));
                    if (selected.length > 1 || (option.required && selected.length !== 1)) fail('CONFIGURATION_INVALID', 'Choose one value for each required product option.', 422);
                    if (!selected.length) continue;
                    const value = selected[0];
                    if (option.type === 'variant' && v.options?.[option.id] !== value.id) fail('CONFIGURATION_INVALID', 'Configuration does not match the product variant.', 422);
                    const priceAdjustmentMinor = Number.isFinite(value.priceAdjustmentMinor) ? value.priceAdjustmentMinor : Number.isFinite(value.priceAdjustment) ? Math.round(value.priceAdjustment * 100) : 0;
                    configurationSnapshot.push({ optionId: option.id, valueId: value.id, optionName: option.name, valueLabel: value.label, priceAdjustmentMinor });
                }
                if (configurationSnapshot.length !== selectedKeys.length) fail('CONFIGURATION_INVALID', 'One or more product options are no longer available.', 422);
                const unitPriceMinor = v.priceMinor + configurationSnapshot.filter(selection => options.find(option => option.id === selection.optionId)?.type !== 'variant').reduce((sum, selection) => sum + selection.priceAdjustmentMinor, 0);
                if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) fail('TOTAL_INVALID', 'The current configured price requires review.', 422);
                if (v.fulfillmentType === 'DIGITAL') {
                    const hasAsset = (await tx.query<Row>(`SELECT id FROM "DigitalAsset" WHERE "storeId"=$1 AND "productId"=$2 AND "archivedAt" IS NULL LIMIT 1`, [storeId, v.productId])).rows.length;
                    if (!hasAsset) fail('DIGITAL_FILE_UNAVAILABLE', 'This digital product has no active private file.');
                }
                item = { ...inputItem, configurationKey: selectedKeys.sort().join('|'), configurationSnapshot, titleSnapshot: v.productTitle + ' — ' + v.title, productTitleSnapshot: v.productTitle, variantTitleSnapshot: v.title, skuSnapshot: v.sku ?? null, imageSnapshot: v.imageSnapshot ?? null, unitPriceMinor, fulfillmentType: v.fulfillmentType ?? 'PHYSICAL', taxMinor: 0, discountMinor: 0 };
            }
            subtotalMinor += item.unitPriceMinor * item.quantity;
            taxMinor += item.taxMinor ?? 0;
            discountMinor += item.discountMinor ?? 0;
            result.push(item);
        }
        const originalQty = new Map<string, number>();
        const proposedQty = new Map<string, number>();
        for (const i of originals)
            originalQty.set(i.variantId, (originalQty.get(i.variantId) ?? 0) + i.quantity);
        for (const i of result)
            proposedQty.set(i.variantId, (proposedQty.get(i.variantId) ?? 0) + i.quantity);
        const deltas: Row[] = [];
        for (const variantId of [...new Set([...originalQty.keys(), ...proposedQty.keys()])].sort()) {
            const quantity = (proposedQty.get(variantId) ?? 0) - (originalQty.get(variantId) ?? 0);
            if (quantity > 0) {
                const inventory = (await tx.query<Row>(`SELECT * FROM "InventoryLevel" WHERE "storeId"=$1 AND "variantId"=$2 FOR UPDATE`, [storeId, variantId])).rows[0];
                if (!inventory || inventory.quantity - inventory.reserved < quantity)
                    fail('INVENTORY_UNAVAILABLE', 'Insufficient inventory for this order change.');
            }
            if (quantity)
                deltas.push({ variantId, quantity });
        }
        const shippingMinor = input.shippingMinor ?? order.shippingMinor;
        if (!Number.isSafeInteger(shippingMinor) || shippingMinor < 0)
            fail('SHIPPING_INVALID', 'Shipping must be nonnegative integer minor units.', 422);
        const totalMinor = subtotalMinor + shippingMinor + taxMinor - discountMinor;
        if (!Number.isSafeInteger(totalMinor) || totalMinor < 0 || totalMinor > 2147483647)
            fail('TOTAL_INVALID', 'Order total is outside the supported range.', 422);
        return { order, items: result, subtotalMinor, shippingMinor, taxMinor: order.taxMinor === null && taxMinor === 0 ? null : taxMinor, discountMinor: order.discountMinor === null && discountMinor === 0 ? null : discountMinor, totalMinor, deltaMinor: totalMinor - order.totalMinor, deltas, settlement: totalMinor > order.totalMinor ? 'PAYMENT' : totalMinor < order.totalMinor ? 'REFUND' : 'NONE' };
    }
    async preview(storeId: string, orderId: string, input: OrderEdit) { return this.repository.transaction(tx => this.previewTx(tx, storeId, orderId, input)); }
    async edit(storeId: string, orderId: string, input: OrderEdit) {
        if (!input.idempotencyKey)
            fail('IDEMPOTENCY_REQUIRED', 'An idempotency key is required.', 422);
        const requestHash = hash({ ...input, idempotencyKey: undefined });
        return this.repository.transaction(async (tx) => {
            await this.lock(tx, storeId, orderId);
            const existing = (await tx.query<Row>(`SELECT * FROM "OrderRevision" WHERE "storeId"=$1 AND "orderId"=$2 AND "idempotencyKey"=$3`, [storeId, orderId, input.idempotencyKey])).rows[0];
            if (existing) {
                if (existing.requestHash !== requestHash)
                    fail('IDEMPOTENCY_CONFLICT', 'This key was already used for a different change.');
                return existing;
            }
            const snapshot = await this.previewTx(tx, storeId, orderId, input);
            await this.ensureOriginal(tx, snapshot.order);
            const revisionSnapshot = { ...snapshot, order: { ...snapshot.order, subtotalMinor: snapshot.subtotalMinor, shippingMinor: snapshot.shippingMinor, taxMinor: snapshot.taxMinor, discountMinor: snapshot.discountMinor, totalMinor: snapshot.totalMinor, revision: input.revision + 1 } };
            const revision = (await tx.query<Row>(`INSERT INTO "OrderRevision" (id,"storeId","orderId",number,status,snapshot,"deltaMinor","idempotencyKey","requestHash","expiresAt") VALUES ($1,$2,$3,$4,'PENDING',$5,$6,$7,$8,now()+interval '30 minutes') RETURNING *`, [id('revision'), storeId, orderId, input.revision + 1, JSON.stringify(revisionSnapshot), snapshot.deltaMinor, input.idempotencyKey, requestHash])).rows[0];
            for (const delta of snapshot.deltas.filter(d => d.quantity > 0)) {
                await tx.query(`UPDATE "InventoryLevel" SET reserved=reserved+$3,"updatedAt"=now() WHERE "storeId"=$1 AND "variantId"=$2`, [storeId, delta.variantId, delta.quantity]);
                await tx.query(`INSERT INTO "OrderEditHold" ("revisionId","storeId","variantId",quantity) VALUES ($1,$2,$3,$4)`, [revision.id, storeId, delta.variantId, delta.quantity]);
            }
            if (snapshot.deltaMinor === 0) {
                await this.applyRevision(tx, revision);
                return { ...revision, status: 'APPLIED' };
            }
            await tx.query(`UPDATE "Order" SET "balanceDueMinor"=$3 WHERE "storeId"=$1 AND id=$2`, [storeId, orderId, Math.max(0, snapshot.deltaMinor)]);
            if (snapshot.deltaMinor > 0) {
                const payment = (await tx.query<Row>(`SELECT * FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows[0];
                const transactionId = id('transaction');
                await tx.query(`INSERT INTO "OrderTransaction" (id,"storeId","orderId",kind,"amountMinor","revisionId") VALUES ($1,$2,$3,'PAYMENT',$4,$5)`, [transactionId, storeId, orderId, snapshot.deltaMinor, revision.id]);
                await this.operation(tx, storeId, orderId, 'BALANCE_PAYMENT', { revisionId: revision.id, transactionId, amountMinor: snapshot.deltaMinor, currency: snapshot.order.currency, stripeAccountId: payment.stripeAccountId });
            }
            else
                await this.refundOperations(tx, storeId, orderId, -snapshot.deltaMinor, revision.id);
            await appendOrderEvent(tx, storeId, orderId, 'EDIT_PROPOSED', { revisionId: revision.id, deltaMinor: snapshot.deltaMinor });
            return revision;
        });
    }
    private async ensureOriginal(tx: SqlExecutor, order: Row) { await tx.query(`INSERT INTO "OrderRevision" (id,"storeId","orderId",number,status,snapshot,"idempotencyKey","requestHash","appliedAt") SELECT $1,$2,$3,1,'APPLIED',jsonb_build_object('order',$4::jsonb,'items',COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM "OrderItem" i WHERE i."storeId"=$2 AND i."orderId"=$3),'[]'::jsonb)),'original','original',now() ON CONFLICT DO NOTHING`, ['original-' + order.id, order.storeId, order.id, JSON.stringify(order)]); }
    private async operation(tx: SqlExecutor, storeId: string, orderId: string, kind: string, payload: Row, operationId = id('operation')) { await tx.query(`INSERT INTO "OrderOperation" (id,"storeId","orderId",kind,payload) VALUES ($1,$2,$3,$4,$5)`, [operationId, storeId, orderId, kind, JSON.stringify(payload)]); return operationId; }
    private async refundOperations(tx: SqlExecutor, storeId: string, orderId: string, amountMinor: number, revisionId: string | null) {
        const base = (await tx.query<Row>(`SELECT * FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2 AND status IN ('PAID','REFUNDED')`, [storeId, orderId])).rows[0];
        if (!base)
            fail('ORDER_NOT_REFUNDABLE', 'No settled payment is available.');
        const supplements = (await tx.query<Row>(`SELECT * FROM "OrderTransaction" WHERE "storeId"=$1 AND "orderId"=$2 AND kind='PAYMENT' AND status='SUCCEEDED' ORDER BY "createdAt" DESC`, [storeId, orderId])).rows;
        const prior = (await tx.query<Row>(`SELECT "paymentIntentId",sum("amountMinor")::int AS amount FROM "OrderTransaction" WHERE "storeId"=$1 AND "orderId"=$2 AND kind='REFUND' AND status<>'FAILED' GROUP BY "paymentIntentId"`, [storeId, orderId])).rows;
        const legacy = (await tx.query<Row>(`SELECT COALESCE(sum("amountMinor"),0)::int AS amount FROM "Refund" WHERE "storeId"=$1 AND "orderId"=$2 AND status NOT IN ('FAILED','CANCELLED')`, [storeId, orderId])).rows[0]?.amount ?? 0;
        const available: Row[] = [...supplements, base].map(p => ({ ...p, available: p.amountMinor - (prior.find(r => r.paymentIntentId === p.paymentIntentId)?.amount ?? 0) - (p.id === base.id ? legacy : 0) }));
        if (available.reduce((sum, p) => sum + Math.max(0, p.available), 0) < amountMinor)
            fail('REFUND_AMOUNT_INVALID', 'Refund exceeds the unrefunded captured amount.');
        const transactionIds: string[] = [];
        let remaining = amountMinor;
        for (const payment of available) {
            if (remaining <= 0)
                break;
            const amount = Math.min(remaining, Math.max(0, payment.available));
            if (!amount)
                continue;
            remaining -= amount;
            const transactionId = id('transaction');
            transactionIds.push(transactionId);
            await tx.query(`INSERT INTO "OrderTransaction" (id,"storeId","orderId",kind,"amountMinor","paymentIntentId","revisionId") VALUES ($1,$2,$3,'REFUND',$4,$5,$6)`, [transactionId, storeId, orderId, amount, payment.paymentIntentId, revisionId]);
            await this.operation(tx, storeId, orderId, 'REFUND', { transactionId, amountMinor: amount, paymentIntentId: payment.paymentIntentId, stripeAccountId: base.stripeAccountId, revisionId });
        }
        return transactionIds;
    }
    private async releaseHolds(tx: SqlExecutor, revisionId: string, sold: boolean) { const holds = (await tx.query<Row>(`SELECT * FROM "OrderEditHold" WHERE "revisionId"=$1 AND released=FALSE FOR UPDATE`, [revisionId])).rows; for (const hold of holds) {
        await tx.query(`UPDATE "InventoryLevel" SET reserved=reserved-$3,quantity=quantity-$4,"updatedAt"=now() WHERE "storeId"=$1 AND "variantId"=$2 AND reserved>=$3`, [hold.storeId, hold.variantId, hold.quantity, sold ? hold.quantity : 0]);
        await tx.query(`UPDATE "OrderEditHold" SET released=TRUE WHERE "revisionId"=$1 AND "variantId"=$2`, [revisionId, hold.variantId]);
    } }
    private async applyRevision(tx: SqlExecutor, revision: Row) {
        if (revision.status !== 'PENDING')
            return;
        const snapshot = revision.snapshot;
        const { storeId, orderId } = revision;
        await this.lock(tx, storeId, orderId);
        await this.releaseHolds(tx, revision.id, true);
        for (const delta of snapshot.deltas.filter((d: Row) => d.quantity < 0))
            await tx.query(`UPDATE "InventoryLevel" SET quantity=quantity-$3,"updatedAt"=now() WHERE "storeId"=$1 AND "variantId"=$2`, [storeId, delta.variantId, delta.quantity]);
        await tx.query(`DELETE FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId]);
        for (const item of snapshot.items)
            await tx.query(`INSERT INTO "OrderItem" ("storeId","orderId","variantId","configurationKey","configurationSnapshot","titleSnapshot","productTitleSnapshot","variantTitleSnapshot","skuSnapshot","imageSnapshot","unitPriceMinor",quantity,"fulfillmentType","taxMinor","discountMinor") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [storeId, orderId, item.variantId, item.configurationKey ?? '', JSON.stringify(item.configurationSnapshot ?? []), item.titleSnapshot, item.productTitleSnapshot ?? null, item.variantTitleSnapshot ?? null, item.skuSnapshot ?? null, item.imageSnapshot ?? null, item.unitPriceMinor, item.quantity, item.fulfillmentType ?? 'PHYSICAL', item.taxMinor ?? null, item.discountMinor ?? null]);
        await tx.query(`UPDATE "Order" SET "subtotalMinor"=$3,"shippingMinor"=$4,"taxMinor"=$5,"discountMinor"=$6,"totalMinor"=$7,"balanceDueMinor"=0,revision=revision+1,"updatedAt"=now() WHERE "storeId"=$1 AND id=$2`, [storeId, orderId, snapshot.subtotalMinor, snapshot.shippingMinor, snapshot.taxMinor, snapshot.discountMinor, snapshot.totalMinor]);
        await tx.query(`UPDATE "OrderRevision" SET status='APPLIED',"appliedAt"=now() WHERE id=$1`, [revision.id]);
        await appendOrderEvent(tx, storeId, orderId, 'EDIT_APPLIED', { revisionId: revision.id });
    }
    private async refundableBalance(tx: SqlExecutor, storeId: string, orderId: string) {
        const base = (await tx.query<Row>(`SELECT "amountMinor" FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2 AND status IN ('PAID','REFUNDED')`, [storeId, orderId])).rows[0];
        const transactions = (await tx.query<Row>(`SELECT COALESCE(sum(CASE WHEN kind='PAYMENT' AND status='SUCCEEDED' THEN "amountMinor" WHEN kind='REFUND' AND status<>'FAILED' THEN -"amountMinor" ELSE 0 END),0)::int AS net FROM "OrderTransaction" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows[0];
        const legacy = (await tx.query<Row>(`SELECT COALESCE(sum("amountMinor"),0)::int AS amount FROM "Refund" WHERE "storeId"=$1 AND "orderId"=$2 AND status NOT IN ('FAILED','CANCELLED')`, [storeId, orderId])).rows[0];
        return (base?.amountMinor ?? 0) + (transactions?.net ?? 0) - (legacy?.amount ?? 0);
    }
    async refund(storeId: string, orderId: string, input: {
        revision: number;
        idempotencyKey: string;
        amountMinor?: number;
        reason?: string;
        items?: ItemQuantity[];
    }) {
        return this.repository.transaction(async (tx) => {
            const order = await this.lock(tx, storeId, orderId);
            const operationId = 'refund-' + hash([storeId, orderId, input.idempotencyKey]);
            const existing = (await tx.query<Row>(`SELECT * FROM "OrderOperation" WHERE id=$1`, [operationId])).rows[0];
            if (existing) {
                if (existing.payload.requestHash !== hash({ ...input, revision: undefined }))
                    fail('IDEMPOTENCY_CONFLICT', 'Key already used with different refund details.');
                return existing;
            }
            await this.lock(tx, storeId, orderId, input.revision);
            if ((await tx.query(`SELECT 1 FROM "OrderRevision" WHERE "storeId"=$1 AND "orderId"=$2 AND status='PENDING'`, [storeId, orderId])).rows.length)
                fail('ORDER_SETTLEMENT_PENDING', 'Complete the pending edit before refunding.');
            let itemAmount: number | undefined;
            if (input.items) {
                this.quantities(input.items);
                const purchased = (await tx.query<Row>(`SELECT * FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows;
                const requests = (await tx.query<Row>(`SELECT payload FROM "OrderOperation" WHERE "storeId"=$1 AND "orderId"=$2 AND kind='REFUND_REQUEST'`, [storeId, orderId])).rows;
                const used = new Map<string, number>();
                for (const request of requests) {
                    const transactions = (await tx.query<Row>(`SELECT status FROM "OrderTransaction" WHERE id=ANY($1::text[])`, [request.payload.transactionIds ?? []])).rows;
                    if (transactions.length && transactions.every(t => t.status === 'FAILED'))
                        continue;
                    for (const i of request.payload.items ?? [])
                        used.set(key(i), (used.get(key(i)) ?? 0) + i.quantity);
                }
                itemAmount = 0;
                for (const i of input.items) {
                    const line = purchased.find(x => key(x) === key(i));
                    if (!line || i.quantity + (used.get(key(i)) ?? 0) > line.quantity)
                        fail('REFUND_QUANTITY_INVALID', 'Item refund quantities exceed the unrefunded purchase.');
                    if (((order.taxMinor ?? 0) !== 0 || (order.discountMinor ?? 0) !== 0) && (line.taxMinor == null || line.discountMinor == null))
                        fail('ADJUSTMENT_ALLOCATION_UNKNOWN', 'Captured line tax and discount allocations are needed for an item refund.');
                    itemAmount += line.unitPriceMinor * i.quantity + Math.round((line.taxMinor ?? 0) * i.quantity / line.quantity) - Math.round((line.discountMinor ?? 0) * i.quantity / line.quantity);
                }
                if (input.amountMinor !== undefined && input.amountMinor !== itemAmount)
                    fail('REFUND_AMOUNT_INVALID', 'Refund amount must match the selected item quantities.', 422);
            }
            const amount = itemAmount ?? input.amountMinor ?? await this.refundableBalance(tx, storeId, orderId);
            if (!Number.isSafeInteger(amount) || amount <= 0)
                fail('REFUND_AMOUNT_INVALID', 'Enter a positive refund amount.', 422);
            const transactionIds = await this.refundOperations(tx, storeId, orderId, amount, null);
            const op = await this.operation(tx, storeId, orderId, 'REFUND_REQUEST', { amountMinor: amount, items: input.items, transactionIds, reason: input.reason, requestHash: hash({ ...input, revision: undefined }) }, operationId);
            await this.bump(tx, storeId, orderId);
            await appendOrderEvent(tx, storeId, orderId, 'REFUND_REQUESTED', { amountMinor: amount, reason: input.reason });
            return { id: op, status: 'PENDING', amountMinor: amount };
        });
    }
    async cancel(storeId: string, orderId: string, input: {
        revision: number;
        idempotencyKey: string;
        reason?: string;
    }) {
        return this.repository.transaction(async (tx) => {
            const order = await this.lock(tx, storeId, orderId);
            const operationId = 'cancel-' + hash([storeId, orderId, input.idempotencyKey]);
            const existing = (await tx.query<Row>(`SELECT * FROM "OrderOperation" WHERE id=$1`, [operationId])).rows[0];
            if (existing)
                return existing;
            await this.lock(tx, storeId, orderId, input.revision);
            if (!['PENDING_PAYMENT', 'PENDING', 'PAID', 'CONFIRMED'].includes(order.status))
                fail('CANCELLATION_NOT_ALLOWED', 'Only unfulfilled orders can be cancelled.');
            if ((await tx.query(`SELECT 1 FROM "OrderRevision" WHERE "storeId"=$1 AND "orderId"=$2 AND status='PENDING'`, [storeId, orderId])).rows.length)
                fail('ORDER_SETTLEMENT_PENDING', 'Resolve the pending edit before cancelling.');
            const payment = (await tx.query<Row>(`SELECT * FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2 FOR UPDATE`, [storeId, orderId])).rows[0];
            if (payment?.status === 'PAID') {
                const amount = await this.refundableBalance(tx, storeId, orderId);
                if (amount > 0)
                    await this.refundOperations(tx, storeId, orderId, amount, null);
                await this.operation(tx, storeId, orderId, 'CANCEL_PAID', { reason: input.reason }, operationId);
                await tx.query(`UPDATE "Order" SET status='CANCELLED',lifecycle='CANCELLED' WHERE "storeId"=$1 AND id=$2`, [storeId, orderId]);
            }
            else {
                await this.operation(tx, storeId, orderId, 'CANCEL_PAYMENT', { paymentIntentId: payment?.paymentIntentId, stripeAccountId: payment?.stripeAccountId, reason: input.reason }, operationId);
            }
            await this.bump(tx, storeId, orderId);
            await appendOrderEvent(tx, storeId, orderId, 'CANCELLATION_REQUESTED', { reason: input.reason });
            return { id: operationId, status: 'PENDING' };
        });
    }
    async getPublicBalance(storeId: string, publicToken: string) { return this.repository.transaction(async (tx) => { const order = (await tx.query<Row>(`SELECT id,currency FROM "Order" WHERE "storeId"=$1 AND "publicToken"=$2`, [storeId, publicToken])).rows[0]; if (!order)
        fail('ORDER_NOT_FOUND', 'Order not found.', 404); const revision = (await tx.query<Row>(`SELECT * FROM "OrderRevision" WHERE "storeId"=$1 AND "orderId"=$2 AND "deltaMinor">0 ORDER BY "createdAt" DESC LIMIT 1`, [storeId, order.id])).rows[0]; if (!revision)
        fail('BALANCE_NOT_FOUND', 'No balance payment is available.', 404); const operation = (await tx.query<Row>(`SELECT payload,status FROM "OrderOperation" WHERE "storeId"=$1 AND "orderId"=$2 AND kind='BALANCE_PAYMENT' AND payload->>'revisionId'=$3`, [storeId, order.id, revision.id])).rows[0]; return { revisionId: revision.id, amountMinor: revision.deltaMinor, currency: order.currency, status: revision.status, expiresAt: revision.expiresAt, clientSecret: revision.status === 'PENDING' ? operation?.payload.clientSecret : undefined, connectedAccountId: operation?.payload.stripeAccountId }; }); }
    async settlePaymentIntent(paymentIntentId: string, status: string, executor?: SqlExecutor) { const work = async (tx: SqlExecutor) => { const transactions = (await tx.query<Row>(`SELECT * FROM "OrderTransaction" WHERE "paymentIntentId"=$1 AND kind='PAYMENT' FOR UPDATE`, [paymentIntentId])).rows; for (const transaction of transactions) {
        if (transaction.status === 'SUCCEEDED' || (transaction.status === 'FAILED' && status !== 'succeeded'))
            continue;
        if (status !== 'succeeded' && status !== 'canceled')
            continue;
        await tx.query(`UPDATE "OrderTransaction" SET status=$2 WHERE id=$1`, [transaction.id, status === 'succeeded' ? 'SUCCEEDED' : 'FAILED']);
        const revision = (await tx.query<Row>(`SELECT * FROM "OrderRevision" WHERE id=$1 FOR UPDATE`, [transaction.revisionId])).rows[0];
        if (!revision)
            continue;
        if (revision.status !== 'PENDING') {
            if (status === 'succeeded' && revision.status !== 'APPLIED') {
                await this.refundOperations(tx, transaction.storeId, transaction.orderId, transaction.amountMinor, null);
                await appendOrderEvent(tx, transaction.storeId, transaction.orderId, 'LATE_SETTLEMENT_REFUND_QUEUED', { revisionId: revision.id, amountMinor: transaction.amountMinor });
            }
            continue;
        }
        if (status === 'succeeded')
            await this.applyRevision(tx, revision);
        else
            await this.failRevision(tx, revision, 'EXPIRED');
    } return transactions.length > 0; }; return executor ? work(executor) : this.repository.transaction(work); }
    private async failRevision(tx: SqlExecutor, revision: Row, status: string) {
        await this.lock(tx, revision.storeId, revision.orderId);
        await this.releaseHolds(tx, revision.id, false);
        await tx.query(`UPDATE "OrderRevision" SET status=$2 WHERE id=$1 AND status='PENDING'`, [revision.id, status]);
        const refunded = (await tx.query<Row>(`SELECT COALESCE(sum("amountMinor"),0)::int AS amount FROM "OrderTransaction" WHERE "revisionId"=$1 AND kind='REFUND' AND status='SUCCEEDED'`, [revision.id])).rows[0]?.amount ?? 0;
        // A partially completed multi-capture refund needs reconciliation before
        // shipping the original order. Never silently treat it as fully paid.
        await tx.query(`UPDATE "Order" SET "balanceDueMinor"=$3 WHERE "storeId"=$1 AND id=$2`, [revision.storeId, revision.orderId, refunded]);
        await appendOrderEvent(tx, revision.storeId, revision.orderId, 'EDIT_' + status, { revisionId: revision.id, reconciliationMinor: refunded });
    }
    async settleRefund(stripeRefundId: string, status: string, executor?: SqlExecutor) {
        const work = async (tx: SqlExecutor) => {
            const transaction = (await tx.query<Row>(`SELECT * FROM "OrderTransaction" WHERE "stripeRefundId"=$1 FOR UPDATE`, [stripeRefundId])).rows[0];
            if (!transaction)
                return false;
            if (transaction.status !== 'PENDING')
                return true;
            if (!['succeeded', 'failed', 'canceled'].includes(status))
                return true;
            const state = status === 'succeeded' ? 'SUCCEEDED' : 'FAILED';
            await tx.query(`UPDATE "OrderTransaction" SET status=$2 WHERE id=$1`, [transaction.id, state]);
            await this.lock(tx, transaction.storeId, transaction.orderId);
            if (transaction.revisionId) {
                const revision = (await tx.query<Row>(`SELECT * FROM "OrderRevision" WHERE id=$1 FOR UPDATE`, [transaction.revisionId])).rows[0];
                if (revision?.status === 'PENDING') {
                    const all = (await tx.query<Row>(`SELECT status FROM "OrderTransaction" WHERE "revisionId"=$1 AND kind='REFUND'`, [revision.id])).rows;
                    if (all.some(t => t.status === 'FAILED'))
                        await this.failRevision(tx, revision, 'FAILED');
                    else if (all.every(t => t.status === 'SUCCEEDED'))
                        await this.applyRevision(tx, revision);
                }
                else if (revision?.status === 'FAILED') {
                    await this.failRevision(tx, revision, 'FAILED');
                }
            }
            const request = (await tx.query<Row>(`SELECT * FROM "OrderOperation" WHERE "storeId"=$1 AND "orderId"=$2 AND kind='REFUND_REQUEST' AND (payload->'transactionIds') ? $3`, [transaction.storeId, transaction.orderId, transaction.id])).rows[0];
            if (request && state === 'SUCCEEDED') {
                const parts = (await tx.query<Row>(`SELECT status FROM "OrderTransaction" WHERE id=ANY($1::text[])`, [request.payload.transactionIds])).rows;
                if (parts.every(part => part.status === 'SUCCEEDED')) {
                    await appendOrderEvent(tx, transaction.storeId, transaction.orderId, 'REFUND_PROCESSED', { requestId: request.id, amountMinor: request.payload.amountMinor, variantIds: request.payload.items?.map((item: Row) => item.variantId) ?? [] });
                }
            } else {
                await appendOrderEvent(tx, transaction.storeId, transaction.orderId, state === 'SUCCEEDED' ? 'REFUND_PROCESSED' : 'REFUND_FAILED', { transactionId: transaction.id, amountMinor: transaction.amountMinor });
            }
            const order = (await tx.query<Row>(`SELECT * FROM "Order" WHERE "storeId"=$1 AND id=$2`, [transaction.storeId, transaction.orderId])).rows[0];
            const totals = (await tx.query<Row>(`SELECT COALESCE(sum(CASE WHEN kind='PAYMENT' AND status='SUCCEEDED' THEN "amountMinor" WHEN kind='REFUND' AND status='SUCCEEDED' THEN -"amountMinor" ELSE 0 END),0)::int AS net FROM "OrderTransaction" WHERE "storeId"=$1 AND "orderId"=$2`, [transaction.storeId, transaction.orderId])).rows[0];
            const payment = (await tx.query<Row>(`SELECT * FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2`, [transaction.storeId, transaction.orderId])).rows[0];
            if (state === 'SUCCEEDED' && payment && payment.amountMinor + totals.net === 0) {
                await tx.query(`UPDATE "Order" SET status=CASE WHEN status='CANCELLED' THEN status ELSE 'REFUNDED' END,lifecycle=CASE WHEN lifecycle='CANCELLED' THEN lifecycle ELSE 'CLOSED' END WHERE "storeId"=$1 AND id=$2`, [transaction.storeId, transaction.orderId]);
                await tx.query(`UPDATE "Payment" SET status='REFUNDED' WHERE id=$1`, [payment.id]);
                if (!order.fulfilmentStartedAt) {
                    const restored = (await tx.query<Row>(`SELECT 1 FROM "OrderEvent" WHERE "storeId"=$1 AND "orderId"=$2 AND type='CANCELLED_STOCK_RESTORED'`, [transaction.storeId, transaction.orderId])).rows.length;
                    if (!restored) {
                        const items = (await tx.query<Row>(`SELECT "variantId",sum(quantity)::int AS quantity FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2 GROUP BY "variantId"`, [transaction.storeId, transaction.orderId])).rows;
                        for (const item of items)
                            await tx.query(`UPDATE "InventoryLevel" SET quantity=quantity+$3,"updatedAt"=now() WHERE "storeId"=$1 AND "variantId"=$2`, [transaction.storeId, item.variantId, item.quantity]);
                        await appendOrderEvent(tx, transaction.storeId, transaction.orderId, 'CANCELLED_STOCK_RESTORED');
                    }
                }
            }
            return true;
        };
        return executor ? work(executor) : this.repository.transaction(work);
    }
    async runOperations(limit = 25) {
        // Expired balance proposals retain stock until Stripe confirms cancellation.
        await this.repository.transaction(async (tx) => { const expired = (await tx.query<Row>(`SELECT r.*,t."paymentIntentId",p."stripeAccountId" FROM "OrderRevision" r LEFT JOIN "OrderTransaction" t ON t."revisionId"=r.id AND t.kind='PAYMENT' LEFT JOIN "Payment" p ON p."orderId"=r."orderId" AND p."storeId"=r."storeId" WHERE r.status='PENDING' AND r."deltaMinor">0 AND r."expiresAt"<now() AND t."paymentIntentId" IS NOT NULL FOR UPDATE OF r`, [])).rows; for (const r of expired)
            await tx.query(`INSERT INTO "OrderOperation" (id,"storeId","orderId",kind,payload) VALUES ($1,$2,$3,'EXPIRE_REVISION',$4) ON CONFLICT DO NOTHING`, ['expire-' + r.id, r.storeId, r.orderId, JSON.stringify({ revisionId: r.id, paymentIntentId: r.paymentIntentId, stripeAccountId: r.stripeAccountId })]); });
        let completed = 0;
        for (let n = 0; n < limit; n++) {
            const op = await this.repository.transaction(async (tx) => { const row = (await tx.query<Row>(`SELECT * FROM "OrderOperation" WHERE (status='PENDING' OR (status='RUNNING' AND "leaseUntil"<now())) AND attempts<8 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0]; if (!row)
                return null; await tx.query(`UPDATE "OrderOperation" SET status='RUNNING',attempts=attempts+1,"leaseUntil"=now()+interval '2 minutes',"updatedAt"=now() WHERE id=$1`, [row.id]); return row; });
            if (!op)
                break;
            try {
                const p = op.payload;
                let remote: Row | undefined;
                if (op.kind === 'BALANCE_PAYMENT') {
                    const revision = await this.repository.transaction(async (tx) => (await tx.query<Row>(`SELECT status,"expiresAt" FROM "OrderRevision" WHERE id=$1`, [p.revisionId])).rows[0]);
                    if (revision?.status === 'PENDING' && new Date(revision.expiresAt) > new Date())
                        remote = await this.stripe.createDirectPaymentIntent({ amount: p.amountMinor, currency: p.currency.toLowerCase(), orderId: op.orderId, checkoutAttemptId: p.revisionId }, { connectedAccountId: p.stripeAccountId, idempotencyKey: op.id });
                }
                else if (op.kind === 'REFUND')
                    remote = await this.stripe.createFullRefund({ paymentIntentId: p.paymentIntentId, orderId: op.orderId, refundId: p.transactionId, amountMinor: p.amountMinor } as any, { connectedAccountId: p.stripeAccountId, idempotencyKey: op.id });
                else if ((op.kind === 'CANCEL_PAYMENT' || op.kind === 'EXPIRE_REVISION') && p.paymentIntentId)
                    remote = await this.stripe.cancelPaymentIntent(p.paymentIntentId, { connectedAccountId: p.stripeAccountId, idempotencyKey: op.id });
                await this.repository.transaction(async (tx) => {
                    await this.lock(tx, op.storeId, op.orderId);
                    if (op.kind === 'BALANCE_PAYMENT' && remote) {
                        await tx.query(`UPDATE "OrderTransaction" SET "paymentIntentId"=$2 WHERE id=$1`, [p.transactionId, remote.id]);
                        p.paymentIntentId = remote.id;
                        p.clientSecret = remote.client_secret;
                    }
                    else if (op.kind === 'BALANCE_PAYMENT') {
                        const revision = (await tx.query<Row>(`SELECT * FROM "OrderRevision" WHERE id=$1 FOR UPDATE`, [p.revisionId])).rows[0];
                        if (revision?.status === 'PENDING' && new Date(revision.expiresAt) <= new Date())
                            await this.failRevision(tx, revision, 'EXPIRED');
                    }
                    if (op.kind === 'REFUND' && remote) {
                        await tx.query(`UPDATE "OrderTransaction" SET "stripeRefundId"=$2 WHERE id=$1`, [p.transactionId, remote.id]);
                        await this.settleRefund(remote.id, remote.status, tx);
                    }
                    if (op.kind === 'CANCEL_PAYMENT') {
                        const payment = (await tx.query<Row>(`SELECT * FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2 FOR UPDATE`, [op.storeId, op.orderId])).rows[0];
                        if (payment?.status === 'PAID')
                            fail('PAYMENT_ALREADY_SUCCEEDED', 'Payment completed during cancellation. Refund is required.');
                        await tx.query(`UPDATE "Payment" SET status='CANCELLED' WHERE "storeId"=$1 AND "orderId"=$2`, [op.storeId, op.orderId]);
                        const holds = (await tx.query<Row>(`SELECT r.* FROM "InventoryReservation" r JOIN "CheckoutAttempt" a ON a.id=r."attemptId" WHERE a."storeId"=$1 AND a."orderId"=$2 AND r.status='HELD' FOR UPDATE OF r`, [op.storeId, op.orderId])).rows;
                        for (const hold of holds) {
                            await tx.query(`UPDATE "InventoryLevel" SET reserved=reserved-$3,"updatedAt"=now() WHERE "storeId"=$1 AND "variantId"=$2`, [op.storeId, hold.variantId, hold.quantity]);
                            await tx.query(`UPDATE "InventoryReservation" SET status='RELEASED' WHERE "attemptId"=$1 AND "variantId"=$2`, [hold.attemptId, hold.variantId]);
                        }
                        await tx.query(`UPDATE "CheckoutAttempt" SET status='CANCELLED' WHERE "storeId"=$1 AND "orderId"=$2 AND status<>'SUCCEEDED'`, [op.storeId, op.orderId]);
                        await tx.query(`UPDATE "Order" SET status='CANCELLED',lifecycle='CANCELLED' WHERE "storeId"=$1 AND id=$2`, [op.storeId, op.orderId]);
                        await appendOrderEvent(tx, op.storeId, op.orderId, 'ORDER_CANCELLED');
                    }
                    if (op.kind === 'EXPIRE_REVISION') {
                        const revision = (await tx.query<Row>(`SELECT * FROM "OrderRevision" WHERE id=$1 FOR UPDATE`, [p.revisionId])).rows[0];
                        if (revision?.status === 'PENDING')
                            await this.failRevision(tx, revision, 'EXPIRED');
                    }
                    await tx.query(`UPDATE "OrderOperation" SET status='SUCCEEDED',payload=$2,"leaseUntil"=NULL,"updatedAt"=now() WHERE id=$1`, [op.id, JSON.stringify(p)]);
                });
                completed++;
            }
            catch (error) {
                await this.repository.transaction(async (tx) => { await tx.query(`UPDATE "OrderOperation" SET status=CASE WHEN attempts>=8 THEN 'FAILED' ELSE 'RUNNING' END,"lastError"=$2,"leaseUntil"=now()+interval '1 minute'*(power(2,LEAST(attempts,6))),"updatedAt"=now() WHERE id=$1`, [op.id, error instanceof Error ? error.message : 'Operation failed']); await appendOrderEvent(tx, op.storeId, op.orderId, 'OPERATION_RETRY', { operationId: op.id }); });
            }
        }
        return { completed };
    }
}
