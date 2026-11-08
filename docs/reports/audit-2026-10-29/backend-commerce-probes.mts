// Read-only production-code audit probes. All database and Stripe I/O is mocked.
import assert from 'node:assert/strict';
import { cancelExistingAttempt } from '../../../backend/src/commerce/checkout-attempts.ts';
import { ReservationSweeper } from '../../../backend/src/commerce/sweeper.ts';

let released = 0;
let orderStatus = 'PENDING_PAYMENT';
const tx = {
  async query(sql: string) {
    if (sql.includes('SELECT "stripeAccountId"')) return { rows: [{ stripeAccountId: 'acct_audit' }] };
    if (sql.includes('UPDATE "Order"') && orderStatus === 'PENDING_PAYMENT') {
      orderStatus = 'CANCELLED'; return { rows: [{ id: 'order-audit' }] };
    }
    return { rows: [] };
  },
  async releaseAttempt() { released++; },
};
await cancelExistingAttempt({ stripeGateway: { async cancelPaymentIntent() {
  throw Object.assign(new Error('PaymentIntent has already succeeded'), { code: 'payment_intent_unexpected_state' });
} } } as any, tx as any, { id: 'attempt-audit', orderId: 'order-audit', paymentIntentId: 'pi_audit', stripeIdempotencyKey: 'audit' } as any, 'store-audit');
assert.equal(orderStatus, 'CANCELLED');
assert.equal(released, 1);
console.log('CONFIRMED: Stripe already-succeeded cancellation error still cancels a pending local order and releases its inventory.');

orderStatus = 'PENDING_PAYMENT';
let releaseCalls = 0;
const sweepTx = { async query(sql: string) {
  if (sql.includes('SELECT') && sql.includes('FROM "CheckoutAttempt"')) return { rows: orderStatus === 'PENDING_PAYMENT' ? [{ id: 'a', orderId: 'o', storeId: 's', paymentIntentId: null, stripeAccountId: null }] : [] };
  if (sql.includes('UPDATE "Order"')) { orderStatus = 'CANCELLED'; return { rows: [{ id: 'o' }] }; }
  return { rows: [] };
} };
const sweeper = new ReservationSweeper({ transaction: async (work: any) => work(sweepTx), async releaseAttempt() { releaseCalls++; throw new Error('simulated database interruption'); } } as any, {} as any);
await assert.rejects(() => sweeper.sweep(), /simulated database interruption/);
assert.equal(orderStatus, 'CANCELLED');
assert.equal(await sweeper.sweep(), 0);
assert.equal(releaseCalls, 1);
console.log('CONFIRMED: After cancellation commits and release fails, a later sweep excludes the cancelled order and never retries its held inventory.');
