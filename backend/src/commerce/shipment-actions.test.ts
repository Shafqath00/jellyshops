import { readFile } from 'node:fs/promises';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from '../../test/integration/pglite.js';
import { CommerceRepository } from './repository.js';
import { OrderManagementService } from './order-management.js';
import { buildPublicShipments, buildPublicTimeline } from './public-order-progress.js';

const SHOPPER_TYPES = ['PACKED', 'OUT_FOR_DELIVERY', 'SHIPMENT_DELAYED', 'DELIVERY_FAILED'];

describe('shipment progress and exceptions', () => {
  let db: IntegrationDatabase;
  let service: OrderManagementService;

  async function migrate(file: string) {
    await db.exec(await readFile(new URL('../../sql/migrations/' + file, import.meta.url), 'utf8'));
  }

  beforeEach(async () => {
    db = await createPGliteDatabase();
    for (const file of ['20260915120000_add_stripe_connect_commerce.sql', '20260916100000_add_refund_idempotency_key.sql', '20260920100000_add_order_item_configuration_snapshot.sql', '20261020143750_backend_runtime_role.sql', '20261022000000_order_management.sql', '20261022010000_notifications_digital.sql', '20261027000000_shipment_exceptions.sql'])
      await migrate(file);
    await seedStore(db, 's', 's');
    await db.exec(`INSERT INTO "StoreOrderManagementSettings" VALUES ('s', TRUE);
 INSERT INTO "Product" (id,"storeId",title,slug,status,"updatedAt") VALUES ('p','s','Cake','cake','ACTIVE',now());
 INSERT INTO "ProductVariant" (id,"storeId","productId",title,"priceMinor",options,"updatedAt") VALUES ('v','s','p','Small',100,'{}',now());
 INSERT INTO "InventoryLevel" ("storeId","variantId",quantity,"updatedAt") VALUES ('s','v',10,now());
 INSERT INTO "Order" (id,"storeId",number,"publicToken","customerSnapshot","subtotalMinor","shippingMinor","totalMinor",currency,status,"fulfilmentStatus") VALUES ('o','s','JS-1','token','{"name":"Alice","email":"a@example.com"}',200,0,200,'USD','PROCESSING','UNFULFILLED');
 INSERT INTO "OrderItem" ("orderId","storeId","variantId","titleSnapshot","unitPriceMinor",quantity) VALUES ('o','s','v','Cake Small',100,2);
 INSERT INTO "StripeConnectedAccount" ("storeId","stripeAccountId") VALUES ('s','acct_a');
 INSERT INTO "Payment" (id,"storeId","orderId","stripeAccountId","paymentIntentId",status,"amountMinor",currency) VALUES ('pay','s','o','acct_a','pi_a','PAID',200,'USD');`);
    service = new OrderManagementService(
      new CommerceRepository({ transaction: (work) => db.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) })) }),
      { createFullRefund: async () => ({ id: 're_a', status: 'pending' }), cancelPaymentIntent: async () => ({ status: 'canceled' }), createDirectPaymentIntent: async () => ({ id: 'pi_balance', client_secret: 'secret' }) } as any,
    );
  });
  afterEach(async () => { await db?.close(); });

  const revision = async () => Number((await db.query<{ revision: number }>(`SELECT revision FROM "Order" WHERE id='o'`)).rows[0].revision);
  const shopperNotifications = async () => (await db.query<{ type: string; dedupeKey: string }>(`SELECT type, "dedupeKey" FROM "OrderNotification" WHERE "storeId"='s' AND type = ANY($1::text[]) ORDER BY "dedupeKey"`, [SHOPPER_TYPES])).rows;
  async function shipShipment(id = 'f1') {
    await db.exec(`INSERT INTO "OrderFulfilment" (id,"storeId","orderId",items,status,"trackingNumber",carrier,"trackingUrl") VALUES ('${id}','s','o','[{"variantId":"v","quantity":2}]','SHIPPED','RM1','Royal Mail','https://track.example.com/RM1');
 UPDATE "Order" SET status='SHIPPED', "fulfilmentStatus"='FULFILLED' WHERE id='o';`);
  }

  it('packs a prepared order once, records it, and tells the shopper once per action', async () => {
    await service.markPacked('s', 'o', await revision());
    expect(await shopperNotifications()).toEqual([expect.objectContaining({ type: 'PACKED' })]);
    expect((await db.query(`SELECT type FROM "OrderEvent" WHERE "orderId"='o' AND type='ORDER_PACKED'`)).rows).toHaveLength(1);
    await expect(service.markPacked('s', 'o', 0)).rejects.toMatchObject({ code: 'ORDER_REVISION_CONFLICT' });
    expect(await shopperNotifications()).toHaveLength(1);
  });

  it('will not pack an order that is not being prepared', async () => {
    await db.exec(`UPDATE "Order" SET status='PAID' WHERE id='o'`);
    await expect(service.markPacked('s', 'o', await revision())).rejects.toMatchObject({ code: 'ORDER_TRANSITION_INVALID' });
  });

  it('moves a shipped parcel out for delivery, and only a shipped parcel', async () => {
    await shipShipment();
    await service.markOutForDelivery('s', 'o', 'f1', await revision());
    expect((await db.query<{ status: string }>(`SELECT status FROM "OrderFulfilment" WHERE id='f1'`)).rows[0].status).toBe('OUT_FOR_DELIVERY');
    expect(await shopperNotifications()).toEqual([expect.objectContaining({ type: 'OUT_FOR_DELIVERY' })]);
    await service.deliver('s', 'o', 'f1', await revision());
    await expect(service.markOutForDelivery('s', 'o', 'f1', await revision())).rejects.toMatchObject({ code: 'SHIPMENT_STATE_INVALID' });
  });

  it('reports a delay, sends one message per report, and clears without a message', async () => {
    await shipShipment();
    await service.setShipmentException('s', 'o', 'f1', await revision(), 'DELAYED');
    expect((await db.query<{ exception: string }>(`SELECT exception FROM "OrderFulfilment" WHERE id='f1'`)).rows[0].exception).toBe('DELAYED');
    await service.setShipmentException('s', 'o', 'f1', await revision(), 'DELAYED');
    expect((await shopperNotifications()).map((row) => row.type)).toEqual(['SHIPMENT_DELAYED', 'SHIPMENT_DELAYED']);
    await service.setShipmentException('s', 'o', 'f1', await revision(), null);
    expect((await db.query<{ exception: string | null }>(`SELECT exception FROM "OrderFulfilment" WHERE id='f1'`)).rows[0].exception).toBeNull();
    expect(await shopperNotifications()).toHaveLength(2);
  });

  it('reports a failed delivery attempt on a parcel that is out for delivery', async () => {
    await shipShipment();
    await service.markOutForDelivery('s', 'o', 'f1', await revision());
    await service.setShipmentException('s', 'o', 'f1', await revision(), 'DELIVERY_FAILED');
    expect((await shopperNotifications()).map((row) => row.type).filter((type) => type === 'DELIVERY_FAILED')).toEqual(['DELIVERY_FAILED']);
  });

  it('will not report a problem on a parcel that is not on its way', async () => {
    await shipShipment();
    await service.deliver('s', 'o', 'f1', await revision());
    await expect(service.setShipmentException('s', 'o', 'f1', await revision(), 'DELAYED')).rejects.toMatchObject({ code: 'SHIPMENT_STATE_INVALID' });
  });

  it('clears an open problem when the parcel is delivered', async () => {
    await shipShipment();
    await service.setShipmentException('s', 'o', 'f1', await revision(), 'DELAYED');
    await service.deliver('s', 'o', 'f1', await revision());
    expect((await db.query<{ exception: string | null }>(`SELECT exception FROM "OrderFulfilment" WHERE id='f1'`)).rows[0].exception).toBeNull();
  });

  it('sends nothing for stores that have not enabled order management', async () => {
    await db.exec(`UPDATE "StoreOrderManagementSettings" SET enabled=FALSE`);
    await service.markPacked('s', 'o', await revision());
    expect(await shopperNotifications()).toEqual([]);
  });

  it('shows the shopper an open problem and the new timeline steps, but never the internal reason', async () => {
    await shipShipment();
    await service.markOutForDelivery('s', 'o', 'f1', await revision());
    await db.exec(`INSERT INTO "OrderNote" (id,"storeId","orderId",body) VALUES ('n','s','o','customer is a regular, handle with care')`);
    await service.setShipmentException('s', 'o', 'f1', await revision(), 'DELIVERY_FAILED');
    const repository = new CommerceRepository({ transaction: (work) => db.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) })) });
    const order = await repository.getPublicOrder('s', 'token');
    const shipments = buildPublicShipments(order!.shipments, order!.items);
    const timeline = buildPublicTimeline(order!.order.createdAt, order!.events);
    expect(shipments[0]).toMatchObject({ exception: 'DELIVERY_FAILED', status: 'OUT_FOR_DELIVERY' });
    expect(timeline.map((entry) => entry.label)).toEqual(expect.arrayContaining(['Out for delivery', 'Delivery attempt failed']));
    expect(JSON.stringify({ shipments, timeline })).not.toContain('handle with care');
  });
});
