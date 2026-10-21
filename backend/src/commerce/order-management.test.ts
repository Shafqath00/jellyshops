import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPGliteDatabase, seedStore } from '../../test/integration/pglite.js';
import { CommerceRepository } from './repository.js';
import { OrderManagementService } from './order-management.js';
import { FulfilmentService } from './fulfilment.js';
describe('order management transactions', () => {
    let db: PGlite;
    let service: OrderManagementService;
    beforeEach(async () => {
        db = await createPGliteDatabase();
        for (const file of ['20260915120000_add_stripe_connect_commerce.sql', '20260916100000_add_refund_idempotency_key.sql', '20260920100000_add_order_item_configuration_snapshot.sql', '20261020143750_backend_runtime_role.sql', '20261022000000_order_management.sql'])
            await db.exec(await readFile(new URL('../../sql/migrations/' + file, import.meta.url), 'utf8'));
        await seedStore(db, 's', 's');
        await seedStore(db, 'other', 'other');
        await db.exec(`INSERT INTO "Product" (id,"storeId",title,slug,status,"updatedAt") VALUES ('p','s','Cake','cake','ACTIVE',now());
 INSERT INTO "ProductVariant" (id,"storeId","productId",title,"priceMinor",options,"updatedAt") VALUES ('v','s','p','Small',100,'{}',now());
 INSERT INTO "InventoryLevel" ("storeId","variantId",quantity,"updatedAt") VALUES ('s','v',10,now());
 INSERT INTO "Order" (id,"storeId",number,"publicToken","customerSnapshot","subtotalMinor","shippingMinor","totalMinor",currency,status) VALUES ('o','s','JS-1','token','{"name":"Alice","email":"a@example.com"}',200,0,200,'USD','PAID');
 INSERT INTO "OrderItem" ("orderId","storeId","variantId","titleSnapshot","unitPriceMinor",quantity) VALUES ('o','s','v','Cake Small',100,2);
 INSERT INTO "StripeConnectedAccount" ("storeId","stripeAccountId") VALUES ('s','acct_a');
 INSERT INTO "Payment" (id,"storeId","orderId","stripeAccountId","paymentIntentId",status,"amountMinor",currency) VALUES ('pay','s','o','acct_a','pi_a','PAID',200,'USD');`);
        service = new OrderManagementService(new CommerceRepository({ transaction: work => db.transaction(tx => work({ query: (sql, values) => tx.query(sql, values) })) }), { createFullRefund: async () => ({ id: 're_a', status: 'pending' }), cancelPaymentIntent: async () => ({ status: 'canceled' }), createDirectPaymentIntent: async () => ({ id: 'pi_balance', client_secret: 'secret' }) } as any);
    });
    afterEach(async () => { await db?.close(); });
    it('requires verified payment even when the legacy status says paid', async () => {
        await db.exec(`UPDATE "Payment" SET status='PENDING'`);
        const repository = new CommerceRepository({ transaction: work => db.transaction(tx => work({ query: (sql, values) => tx.query(sql, values) })) });
        await expect(new FulfilmentService(repository).transition('s', 'o', 'CONFIRMED')).rejects.toMatchObject({ code: 'ORDER_NOT_PAID' });
    });
    it('rejects stale edits and scopes staff notes', async () => {
        await service.contact('s', 'o', { revision: 1, customerSnapshot: { name: 'Bob' } });
        await expect(service.contact('s', 'o', { revision: 1, customerSnapshot: { name: 'Eve' } })).rejects.toMatchObject({ code: 'ORDER_REVISION_CONFLICT' });
        await expect(service.note('other', 'o', 'private', 'staff')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
        await service.note('s', 'o', 'private', 'staff');
        expect((await db.query(`SELECT body FROM "OrderNote"`)).rows).toEqual([{ body: 'private' }]);
    });
    it('runs settlement with the restricted production role and denies direct browser reads',async()=>{
        const repository=new CommerceRepository({transaction:work=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE jelly_backend');return work({query:(sql,values)=>tx.query(sql,values)});})});
        const restricted=new OrderManagementService(repository,{createDirectPaymentIntent:async()=>({id:'pi_role',client_secret:'secret'})} as any);
        await restricted.edit('s','o',{revision:1,idempotencyKey:'role',items:[{variantId:'v',quantity:3}]});await restricted.runOperations();await restricted.settlePaymentIntent('pi_role','succeeded');
        expect((await db.query(`SELECT quantity FROM "OrderItem"`)).rows[0]).toEqual({quantity:3});
        await db.exec('CREATE ROLE browser_user NOLOGIN');
        await expect(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE browser_user');await tx.query('SELECT * FROM "OrderRevision"');})).rejects.toThrow(/permission denied/);
    });
    it('searches snapshots and isolates tenants', async () => { const result = await service.search('s', { query: 'Alice' }); expect(result.total).toBe(1); expect(result.summary.PAID).toBe(1); expect((await service.search('other', {})).total).toBe(0); });
    it('holds stock once and applies only verified settlement', async () => {
        const edit = { revision: 1, idempotencyKey: 'edit-a', items: [{ variantId: 'v', quantity: 3 }] };
        const a = await service.edit('s', 'o', edit);
        const b = await service.edit('s', 'o', edit);
        expect(a.id).toBe(b.id);
        expect((await db.query(`SELECT reserved FROM "InventoryLevel"`)).rows[0]).toEqual({ reserved: 1 });
        expect((await db.query(`SELECT quantity FROM "OrderItem"`)).rows[0]).toEqual({ quantity: 2 });
        await service.runOperations();
        await service.settlePaymentIntent('pi_balance', 'succeeded');
        await service.settlePaymentIntent('pi_balance', 'succeeded');
        expect((await db.query(`SELECT quantity FROM "OrderItem"`)).rows[0]).toEqual({ quantity: 3 });
        expect((await db.query(`SELECT quantity,reserved FROM "InventoryLevel"`)).rows[0]).toEqual({ quantity: 9, reserved: 0 });
    });
    it('prevents overfulfilment and duplicate restocking', async () => {
        await db.exec(`UPDATE "Order" SET status='PROCESSING'`);
        await service.fulfil('s', 'o', { revision: 1, items: [{ variantId: 'v', quantity: 2 }] });
        await expect(service.fulfil('s', 'o', { revision: 2, items: [{ variantId: 'v', quantity: 1 }] })).rejects.toMatchObject({ code: 'FULFILMENT_QUANTITY_INVALID' });
        const r = await service.createReturn('s', 'o', { revision: 2, items: [{ variantId: 'v', quantity: 1 }], reason: 'Wrong size' });
        await service.receiveReturn('s', 'o', r.id, { revision: 3, sellable: true });
        await service.receiveReturn('s', 'o', r.id, { revision: 4, sellable: true });
        expect((await db.query(`SELECT quantity FROM "InventoryLevel"`)).rows[0]).toEqual({ quantity: 11 });
    });
    it('queues a compensating refund for a late payment after proposal expiry', async () => {
        await service.edit('s', 'o', { revision: 1, idempotencyKey: 'late', items: [{ variantId: 'v', quantity: 3 }] });
        await service.runOperations();
        await db.exec(`UPDATE "OrderRevision" SET status='EXPIRED' WHERE status='PENDING'; UPDATE "OrderEditHold" SET released=TRUE; UPDATE "InventoryLevel" SET reserved=0; UPDATE "Order" SET "balanceDueMinor"=0;`);
        await service.settlePaymentIntent('pi_balance', 'succeeded');
        await service.settlePaymentIntent('pi_balance', 'succeeded');
        expect((await db.query(`SELECT "amountMinor" FROM "OrderTransaction" WHERE kind='REFUND'`)).rows).toEqual([{ amountMinor: 100 }]);
        expect((await db.query(`SELECT quantity FROM "OrderItem"`)).rows[0]).toEqual({ quantity: 2 });
    });
    it('cancels only the remaining captured balance after a partial refund', async () => {
        await service.refund('s', 'o', { revision: 1, idempotencyKey: 'partial', amountMinor: 50 });
        await service.cancel('s', 'o', { revision: 2, idempotencyKey: 'cancel' });
        expect((await db.query(`SELECT sum("amountMinor")::int AS amount FROM "OrderTransaction" WHERE kind='REFUND'`)).rows[0]).toEqual({ amount: 200 });
    });
    it('keeps the original purchase snapshot when a settled edit changes the order', async () => {
        await service.edit('s', 'o', { revision: 1, idempotencyKey: 'snapshot', items: [{ variantId: 'v', quantity: 3 }] });
        await service.runOperations();
        await service.settlePaymentIntent('pi_balance', 'succeeded');
        const original = (await db.query<any>(`SELECT snapshot FROM "OrderRevision" WHERE "idempotencyKey"='original'`)).rows[0];
        expect(original.snapshot.items[0].quantity).toBe(2);
        expect(original.snapshot.order.totalMinor).toBe(200);
    });
    it('allocates a full refund across base and supplementary captures', async () => {
        await service.edit('s','o',{revision:1,idempotencyKey:'add',items:[{variantId:'v',quantity:3}]});
        await service.runOperations();await service.settlePaymentIntent('pi_balance','succeeded');
        await service.refund('s','o',{revision:2,idempotencyKey:'full'});
        const refunds=(await db.query<any>(`SELECT "paymentIntentId","amountMinor" FROM "OrderTransaction" WHERE kind='REFUND' ORDER BY "amountMinor"`)).rows;
        expect(refunds).toEqual([{paymentIntentId:'pi_balance',amountMinor:100},{paymentIntentId:'pi_a',amountMinor:200}]);
    });
    it('prices a new configured line from current catalog values while preserving original prices',async()=>{
        await db.query(`UPDATE "Product" SET options=$1 WHERE id='p'`,[JSON.stringify([{id:'wrap',name:'Wrapping',required:true,values:[{id:'gift',label:'Gift wrap',priceAdjustmentMinor:20}]}])]);
        const preview=await service.preview('s','o',{revision:1,items:[{variantId:'v',quantity:2},{variantId:'v',configurationKey:'wrap:gift',quantity:1}]});
        expect(preview.totalMinor).toBe(320);expect(preview.items[1].unitPriceMinor).toBe(120);expect(preview.items[1].configurationSnapshot[0].valueLabel).toBe('Gift wrap');
    });
    it('rejects unpaid edits and a second pending financial proposal', async () => {
        await db.exec(`UPDATE "Payment" SET status='PENDING'`);
        await expect(service.edit('s','o',{revision:1,idempotencyKey:'unpaid',items:[{variantId:'v',quantity:3}]})).rejects.toMatchObject({code:'ORDER_NOT_PAID'});
        await db.exec(`UPDATE "Payment" SET status='PAID'`);
        await service.edit('s','o',{revision:1,idempotencyKey:'one',items:[{variantId:'v',quantity:3}]});
        await expect(service.edit('s','o',{revision:1,idempotencyKey:'two',items:[{variantId:'v',quantity:4}]})).rejects.toMatchObject({code:'ORDER_NOT_PAID'});
        expect((await db.query(`SELECT reserved FROM "InventoryLevel"`)).rows[0]).toEqual({reserved:1});
    });
    it('expires a proposal whose payment intent was never created without charging',async()=>{
        await service.edit('s','o',{revision:1,idempotencyKey:'expired',items:[{variantId:'v',quantity:3}]});
        await db.exec(`UPDATE "OrderRevision" SET "expiresAt"=now()-interval '1 hour' WHERE status='PENDING'`);
        await service.runOperations();
        expect((await db.query<any>(`SELECT status FROM "OrderRevision" WHERE "idempotencyKey"='expired'`)).rows[0].status).toBe('EXPIRED');
        expect((await db.query(`SELECT reserved FROM "InventoryLevel"`)).rows[0]).toEqual({reserved:0});
    });
    it('retains purchased items when a decrease refund fails',async()=>{
        await service.edit('s','o',{revision:1,idempotencyKey:'decrease',items:[{variantId:'v',quantity:1}]});
        await service.runOperations();await service.settleRefund('re_a','failed');
        expect((await db.query(`SELECT quantity FROM "OrderItem"`)).rows[0]).toEqual({quantity:2});
        expect((await db.query(`SELECT "totalMinor" FROM "Order"`)).rows[0]).toEqual({totalMinor:200});
        expect((await db.query<any>(`SELECT status FROM "OrderRevision" WHERE "idempotencyKey"='decrease'`)).rows[0].status).toBe('FAILED');
    });
    it('tracks item refunds and emits variant revocation only after settlement',async()=>{
        await service.refund('s','o',{revision:1,idempotencyKey:'item',items:[{variantId:'v',quantity:1}]});
        expect((await db.query(`SELECT type FROM "OrderEvent" WHERE type='REFUND_PROCESSED'`)).rows).toHaveLength(0);
        await service.runOperations();await service.settleRefund('re_a','succeeded');
        const event=(await db.query<any>(`SELECT details FROM "OrderEvent" WHERE type='REFUND_PROCESSED'`)).rows[0];
        expect(event.details.variantIds).toEqual(['v']);
        await expect(service.refund('s','o',{revision:2,idempotencyKey:'too-many',items:[{variantId:'v',quantity:2}]})).rejects.toMatchObject({code:'REFUND_QUANTITY_INVALID'});
    });
    it('retries a refund with its persisted key after remote success and database failure',async()=>{
        const keys:string[]=[];let failAfterRemote=true;let inTransaction=false;
        const repository=new CommerceRepository({transaction:work=>db.transaction(async tx=>{inTransaction=true;try{return await work({query:async(sql,values)=>{if(failAfterRemote&&sql.includes('SET "stripeRefundId"')){failAfterRemote=false;throw new Error('connection interrupted after refund');}return tx.query(sql,values);}});}finally{inTransaction=false;}})});
        const runner=new OrderManagementService(repository,{createFullRefund:async(_input:any,context:any)=>{expect(inTransaction).toBe(false);keys.push(context.idempotencyKey);return {id:'re_retry',status:'pending'};}} as any);
        await runner.refund('s','o',{revision:1,idempotencyKey:'retry',amountMinor:50});await runner.runOperations();
        await db.exec(`UPDATE "OrderOperation" SET "leaseUntil"=now()-interval '1 minute' WHERE kind='REFUND'`);
        await runner.runOperations();
        expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
        expect((await db.query<any>(`SELECT "stripeRefundId" FROM "OrderTransaction" WHERE kind='REFUND'`)).rows[0].stripeRefundId).toBe('re_retry');
    });
});
