import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { CheckoutAttemptResult, BeginCheckoutInput } from "./types.js";
import type { CommerceRepository, CheckoutAttemptRow, OrderRow } from "./repository.js";
import type { CatalogReader } from "../catalog/service.js";
import type { StripeAccountService } from "../stripe/accounts/service.js";
import { ApiError } from "../http/errors.js";
import { PaymentIntentService, type PaymentIntentGateway, type PreparedPayment } from "./payment-intents.js";
import { PublicOrderRateLimiter } from "./rate-limit.js";

const inputSchema = z.object({
  storeId: z.string().min(1),
  cartKey: z.string().min(1),
  currency: z.string().min(3).max(3),
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().positive()
  })).min(1),
  customerSnapshot: z.record(z.string(), z.unknown()),
  deliverySnapshot: z.record(z.string(), z.unknown()).optional(),
});

export interface CheckoutServiceDeps {
  repository: CommerceRepository;
  catalog: CatalogReader;
  stripeAccountService: StripeAccountService;
  stripeGateway?: PaymentIntentGateway;
}

function isAlreadySucceededCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { code?: string; raw?: unknown };
  if (candidate.code === "payment_intent_unexpected_state") return true;
  return /already succeeded|cannot be canceled|cannot be cancelled/i.test(candidate.message);
}

export class CheckoutService {
  private readonly publicOrderRateLimiter: PublicOrderRateLimiter;

  constructor(private readonly deps: CheckoutServiceDeps) {
    this.publicOrderRateLimiter = new PublicOrderRateLimiter(deps.repository);
  }

  preparePayment(attemptId: string, storeId: string): Promise<PreparedPayment> {
    if (!this.deps.stripeGateway) throw new ApiError(503, "MERCHANT_PAYMENTS_UNAVAILABLE", "Payments are not configured.");
    return new PaymentIntentService({ repository: this.deps.repository, stripeGateway: this.deps.stripeGateway }).preparePayment(attemptId, storeId);
  }

  async getPublicOrder(storeId: string, publicToken: string) {
    if (!storeId?.trim() || !publicToken?.trim()) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    const result = await this.deps.repository.getPublicOrder(storeId, publicToken);
    if (!result) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    return result;
  }

  assertPublicOrderAccess(storeId: string, ip: string): Promise<void> {
    return this.publicOrderRateLimiter.assertAllowed(storeId, ip);
  }

  async begin(rawInput: BeginCheckoutInput): Promise<CheckoutAttemptResult> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError(422, "CHECKOUT_INPUT_INVALID", "Invalid checkout input");
    }
    const input = parsed.data;
    
    // Check Stripe readiness first
    const isReady = await this.deps.stripeAccountService.getLivePaymentReadiness(input.storeId);
    if (!isReady) {
      throw new ApiError(409, "MERCHANT_PAYMENTS_UNAVAILABLE", "Merchant cannot accept payments at this time");
    }

    const status = await this.deps.stripeAccountService.getStatus(input.storeId);
    const stripeAccountId = status.stripeAccountId!;

    let subtotalMinor = 0;
    const validatedLines = await Promise.all(input.items.map(async (item) => {
      const variant = await this.deps.catalog.getVariant(input.storeId, item.variantId);
      if (!variant) throw new ApiError(422, "CHECKOUT_INPUT_INVALID", `Variant not found: ${item.variantId}`);
      if (!variant.available) throw new ApiError(409, "OUT_OF_STOCK", `Variant out of stock: ${item.variantId}`);
      
      subtotalMinor += variant.priceMinor * item.quantity;
      return {
        variantId: variant.id,
        quantity: item.quantity,
        titleSnapshot: variant.title,
        skuSnapshot: variant.sku,
        imageSnapshot: null,
        unitPriceMinor: variant.priceMinor,
      };
    }));
    
    const shippingMinor = 0;
    const totalMinor = subtotalMinor + shippingMinor;
    
    // Calculate deterministic hash
    const hashItems = validatedLines.map(v => `${v.variantId}:${v.quantity}:${v.unitPriceMinor}`).sort();
    const hashBase = `${input.currency}:${shippingMinor}:${hashItems.join("|")}`;
    const cartHash = createHash("sha256").update(hashBase).digest("hex");

    return this.deps.repository.withCheckoutLock(input.storeId, input.cartKey, async (tx) => {
      const { rows: existing } = await tx.query<CheckoutAttemptRow>(
        `SELECT * FROM "CheckoutAttempt" WHERE "storeId" = $1 AND "cartKey" = $2 AND "status" IN ('PAYMENT_INTENT_CREATING', 'READY') ORDER BY "createdAt" DESC LIMIT 1`,
        [input.storeId, input.cartKey]
      );
      
      const existingAttempt = existing[0];
      if (existingAttempt) {
        if (existingAttempt.cartHash === cartHash && existingAttempt.expiresAt.getTime() > Date.now()) {
          const { rows: orders } = await tx.query<OrderRow>(`SELECT "publicToken" FROM "Order" WHERE "id" = $1`, [existingAttempt.orderId]);
          return {
            attemptId: existingAttempt.id,
            orderId: existingAttempt.orderId,
            publicToken: orders[0]?.publicToken ?? "",
          };
        } else {
          // Cancel the external intent before releasing the local hold. Both operations
          // remain inside this checkout transaction so a replacement cannot briefly
          // expose the old stock to a third shopper.
          if (existingAttempt.paymentIntentId && this.deps.stripeGateway?.cancelPaymentIntent) {
            const payment = (await tx.query<{ stripeAccountId: string }>(
              `SELECT "stripeAccountId" FROM "Payment" WHERE "orderId" = $1 AND "storeId" = $2 FOR UPDATE`,
              [existingAttempt.orderId, input.storeId],
            )).rows[0];
            if (!payment) throw new ApiError(409, "CHECKOUT_ATTEMPT_UNAVAILABLE", "This checkout attempt is no longer available.");
            try {
              await this.deps.stripeGateway.cancelPaymentIntent(existingAttempt.paymentIntentId, {
                connectedAccountId: payment.stripeAccountId,
                idempotencyKey: `${existingAttempt.stripeIdempotencyKey}-cancel`,
              });
            } catch (error) {
              // Stripe rejects cancellation when a concurrent webhook already won.
              // Keep the local state untouched; the webhook's PAID/SOLD transition wins.
              if (!isAlreadySucceededCancellation(error)) throw error;
            }
          }

          const cancelled = await tx.query(
            `UPDATE "Order" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
             WHERE "id" = $1 AND "storeId" = $2 AND "status" = 'PENDING_PAYMENT' RETURNING "id"`,
            [existingAttempt.orderId, input.storeId],
          );
          if (cancelled.rows.length === 1) {
            await tx.query(`UPDATE "CheckoutAttempt" SET "status" = 'CANCELLED' WHERE "id" = $1 AND "status" IN ('PAYMENT_INTENT_CREATING', 'READY')`, [existingAttempt.id]);
            await tx.query(`UPDATE "Payment" SET "status" = 'CANCELLED' WHERE "orderId" = $1 AND "storeId" = $2 AND "status" = 'PENDING'`, [existingAttempt.orderId, input.storeId]);
            await tx.releaseAttempt(existingAttempt.id);
          }
        }
      }

      const orderId = `order-${randomUUID()}`;
      const publicToken = randomBytes(32).toString("base64url");
      await tx.query(
        `INSERT INTO "Order" (
          "id", "storeId", "number", "publicToken", "status", "customerSnapshot",
          "subtotalMinor", "shippingMinor", "totalMinor", "currency"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [orderId, input.storeId, orderId.slice(0, 8).toUpperCase(), publicToken, "PENDING_PAYMENT", input.customerSnapshot, subtotalMinor, shippingMinor, totalMinor, input.currency]
      );

      for (const line of validatedLines) {
        await tx.query(
          `INSERT INTO "OrderItem" (
            "orderId", "storeId", "variantId", "titleSnapshot", "skuSnapshot", "imageSnapshot", "unitPriceMinor", "quantity"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [orderId, input.storeId, line.variantId, line.titleSnapshot, line.skuSnapshot, line.imageSnapshot, line.unitPriceMinor, line.quantity]
        );
      }

      const paymentId = `pay-${randomUUID()}`;
      await tx.query(
        `INSERT INTO "Payment" (
          "id", "storeId", "orderId", "stripeAccountId", "paymentIntentId", "chargeId", "status", "amountMinor", "currency"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [paymentId, input.storeId, orderId, stripeAccountId, null, null, "PENDING", totalMinor, input.currency]
      );

      const attemptId = `attempt-${randomUUID()}`;
      const stripeIdempotencyKey = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      await tx.query(
        `INSERT INTO "CheckoutAttempt" (
          "id", "orderId", "storeId", "cartKey", "cartHash", "stripeIdempotencyKey", "paymentIntentId", "status", "expiresAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [attemptId, orderId, input.storeId, input.cartKey, cartHash, stripeIdempotencyKey, null, "PAYMENT_INTENT_CREATING", expiresAt]
      );

      try {
        await tx.reserveVariants({ storeId: input.storeId, attemptId, items: input.items });
      } catch (error: any) {
        if (error.message.includes("Insufficient inventory")) {
          throw new ApiError(409, "OUT_OF_STOCK", "One or more items are out of stock");
        }
        throw error;
      }

      return {
        attemptId,
        orderId,
        publicToken,
      };
    });
  }
}
