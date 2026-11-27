import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { z } from "zod";

import type { CatalogReader } from "../catalog/service.js";
import { ApiError } from "../http/errors.js";
import type { StripeAccountService } from "../stripe/accounts/service.js";
import type { CheckoutPolicy } from "../tenants/settings.js";

import {
  PaymentIntentService,
  type PaymentIntentGateway,
  type PreparedPayment,
} from "./payment-intents.js";
import {
  cancelExistingAttempt,
  findExistingAttempt,
  tryReuseAttempt,
} from "./checkout-attempts.js";
import {
  checkoutInputSchema,
  validateCart,
  type ValidatedCart,
} from "./checkout-cart.js";
import { PublicOrderRateLimiter } from "./rate-limit.js";
import { recordOrderDiscounts, type DiscountSql } from "../discounts/service.js";
import { lineKey, requireBagDiscounts, type BagDiscounts, type BagInput } from "../discounts/checkout-discounts.js";

/** Stripe refuses smaller charges; a code may not bring an order below this. */
const MIN_CHARGE_MINOR = 50;
import type {
  CheckoutAttemptRow,
  CommerceRepository,
  CommerceTransaction,
  OrderRow,
} from "./repository.js";
import type {
  BeginCheckoutInput,
  CheckoutAttemptResult,
} from "./types.js";
import { buildPublicProgress, buildPublicShipments, buildPublicTimeline } from "./public-order-progress.js";

const CHECKOUT_TTL_MS = 15 * 60 * 1000;

export interface CheckoutServiceDeps {
  repository: CommerceRepository;
  catalog: CatalogReader;
  stripeAccountService: StripeAccountService;
  stripeGateway?: PaymentIntentGateway;
  checkoutPolicy: { getCheckoutPolicy(storeId: string): Promise<CheckoutPolicy> };
  enabledCountries?: readonly string[];
  enhancedSnapshots?: boolean;
  isTest?: boolean;
}

/** The bag as the discount calculation sees it. */
function bagOf(cart: ValidatedCart, currency: string, email: string | undefined, code: string | undefined): BagInput {
  return {
    lines: cart.lines.map((line) => ({ variantId: line.variantId, productId: line.productId, configurationKey: line.configurationKey, unitPriceMinor: line.unitPriceMinor, quantity: line.quantity })),
    shippingMinor: cart.shippingMinor, hasDelivery: cart.lines.some((line) => line.fulfillmentType !== "DIGITAL"), currency, email, code,
  };
}

function assertChargeable(discount: Pick<BagDiscounts, "totalMinor">): void {
  if (discount.totalMinor < MIN_CHARGE_MINOR) throw new ApiError(422, "DISCOUNT_NOT_APPLICABLE", "This code would make the order free, and this shop can't take free orders yet.");
}

const DELIVERY_FIELDS = ["name", "line1", "line2", "city", "region", "postalCode", "country"] as const;

/** Only the address lines of a delivery snapshot, as plain short strings. */
export function publicDelivery(snapshot: unknown, customerName?: unknown): Partial<Record<(typeof DELIVERY_FIELDS)[number], string>> | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const source: Record<string, unknown> = { name: customerName, ...(snapshot as Record<string, unknown>) };
  const address = Object.fromEntries(DELIVERY_FIELDS.flatMap((key) => typeof source[key] === "string" && source[key] ? [[key, (source[key] as string).slice(0, 200)]] : []));
  return Object.keys(address).length ? address : null;
}

export class CheckoutService {
  private readonly publicOrderRateLimiter: PublicOrderRateLimiter;

  constructor(
    private readonly deps: CheckoutServiceDeps,
  ) {
    this.publicOrderRateLimiter =
      // The order page checks every few seconds while a payment is being confirmed; links are long and random, so this only guards load.
      new PublicOrderRateLimiter(deps.repository, { limit: 30 });
  }

  preparePayment(
    attemptId: string,
    storeId: string,
  ): Promise<PreparedPayment> {
    const gateway = this.deps.stripeGateway;

    if (!gateway) {
      throw new ApiError(
        503,
        "MERCHANT_PAYMENTS_UNAVAILABLE",
        "Payments are not configured.",
      );
    }

    const service = new PaymentIntentService({
      repository: this.deps.repository,
      stripeGateway: gateway,
    });

    return service.preparePayment(
      attemptId,
      storeId,
    );
  }

  async getPublicOrder(
    storeId: string,
    publicToken: string,
  ) {
    if (
      !storeId?.trim() ||
      !publicToken?.trim()
    ) {
      throw new ApiError(
        404,
        "ORDER_NOT_FOUND",
        "Order not found.",
      );
    }

    const order =
      await this.deps.repository.getPublicOrder(
        storeId,
        publicToken,
      );

    if (!order) {
      throw new ApiError(
        404,
        "ORDER_NOT_FOUND",
        "Order not found.",
      );
    }

    // Explicit public projection: never serialize staff metadata or Stripe IDs.
    const source = order.order;
    const shipments = buildPublicShipments(order.shipments, order.items);
    const timeline = buildPublicTimeline(source.createdAt, order.events);
    return {
      order: {
        number: source.number, status: source.status, currency: source.currency,
        subtotalMinor: source.subtotalMinor, shippingMinor: source.shippingMinor,
        ...(Number((source as { discountMinor?: unknown }).discountMinor ?? 0) > 0 ? { discountMinor: (source as { discountMinor?: unknown }).discountMinor, discountCode: (source as { discountCode?: unknown }).discountCode ?? null } : {}),
        totalMinor: source.totalMinor, createdAt: source.createdAt,
        // The delivery address the shopper typed, shown back to the holder of the private order link (never the email or phone).
        delivery: publicDelivery((source as { deliverySnapshot?: unknown }).deliverySnapshot, (source as { customerSnapshot?: { name?: unknown } }).customerSnapshot?.name),
        ...("balanceDueMinor" in source ? { balanceDueMinor: source.balanceDueMinor } : {}),
      },
      items: order.items.map((item) => {
        const { titleSnapshot, imageSnapshot, unitPriceMinor, quantity, configurationSnapshot } = item;
        const fulfillmentType = (item as { fulfillmentType?: unknown }).fulfillmentType === "DIGITAL" ? "DIGITAL" : "PHYSICAL";
        return { titleSnapshot, imageSnapshot, unitPriceMinor, quantity, configurationSnapshot, fulfillmentType };
      }),
      payment: order.payment ? { status: order.payment.status } : null,
      shipments,
      timeline,
      progress: buildPublicProgress({ status: source.status, timeline, shipments }),
    };
  }

  assertPublicOrderAccess(
    storeId: string,
    ip: string,
  ): Promise<void> {
    return this.publicOrderRateLimiter.assertAllowed(
      storeId,
      ip,
    );
  }

  async assertCheckoutAccess(storeId: string, ip: string, key: string, preparation = false): Promise<void> {
    const store = await this.deps.repository.transaction((tx) => tx.query(`SELECT "id" FROM "Store" WHERE "id" = $1 AND "archivedAt" IS NULL`, [storeId]));
    if (!store.rows.length) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const namespace = preparation ? "checkout-payment" : "checkout-attempt";
    await new PublicOrderRateLimiter(this.deps.repository, { namespace, limit: preparation ? 60 : 20, code: "CHECKOUT_RATE_LIMITED" }).assertAllowed(storeId, ip);
    await new PublicOrderRateLimiter(this.deps.repository, { namespace: `${namespace}:cart`, limit: preparation ? 30 : 5, code: "CHECKOUT_RATE_LIMITED" }).assertAllowed(storeId, key);
  }

  async assertDiscountCheckAccess(storeId: string, ip: string): Promise<void> {
    await new PublicOrderRateLimiter(this.deps.repository, { namespace: "checkout-discount", limit: 30, code: "CHECKOUT_RATE_LIMITED" }).assertAllowed(storeId, ip);
  }

  /**
   * The discounts on this bag for the bag page and the order summary: the store's automatic discounts plus the typed code,
   * if any. A typed code that can't be used throws a 422 in the shopper's words. The order itself works them out again.
   */
  async previewDiscount(storeId: string, input: { code?: string; currency: string; items: BeginCheckoutInput["items"]; email?: string }) {
    const policy = await this.deps.checkoutPolicy.getCheckoutPolicy(storeId);
    const currency = input.currency.toUpperCase();
    if (currency !== policy.currency) throw new ApiError(422, "CHECKOUT_CURRENCY_MISMATCH", "Use the store's currency to check out.");
    const parsedItems = checkoutInputSchema.shape.items.safeParse(input.items);
    if (!parsedItems.success) throw new ApiError(422, "DISCOUNT_INPUT_INVALID", "Enter a discount code.");
    const cart = await validateCart(this.deps, storeId, currency, parsedItems.data, policy.shippingMinor);
    const result = await this.deps.repository.transaction((tx) => requireBagDiscounts(tx as unknown as DiscountSql, storeId, bagOf(cart, currency, input.email, input.code)));
    if (result.discounts.length) assertChargeable(result);
    return {
      code: result.code, label: result.discounts.find((line) => line.code === result.code)?.label ?? null,
      subtotalMinor: result.subtotalMinor, discountMinor: result.discountMinor, shippingMinor: result.shippingMinor, totalMinor: result.totalMinor, currency,
      discounts: result.discounts.map(({ discountId: _id, ...line }) => line),
    };
  }

  async begin(
    rawInput: BeginCheckoutInput,
    customerId?: string,
  ): Promise<CheckoutAttemptResult> {
    const input = { ...this.parseInput(rawInput), customerId };

    const policy = await this.deps.checkoutPolicy.getCheckoutPolicy(input.storeId);
    if (input.currency !== policy.currency) throw new ApiError(422, "CHECKOUT_CURRENCY_MISMATCH", "Use the store's currency to check out.");
    const countries = [input.deliverySnapshot?.country, (input.deliverySnapshot?.address as Record<string, unknown> | undefined)?.country, (input.customerSnapshot.address as Record<string, unknown> | undefined)?.country].filter((value) => value !== undefined);
    if (countries.some((country) => String(country).toUpperCase() !== policy.country)) throw new ApiError(422, "CHECKOUT_DELIVERY_COUNTRY_INVALID", "An address within the store's country is required.");
    if (this.deps.enabledCountries && !this.deps.enabledCountries.includes(policy.country)) throw new ApiError(409, "MARKET_PAYMENTS_UNAVAILABLE", "Payments are not yet available for this store's country.");

    const cart = await validateCart(
      this.deps,
      input.storeId,
      input.currency,
      input.items,
      policy.shippingMinor,
    );
    if (cart.lines.some((line) => line.fulfillmentType !== "DIGITAL") && !countries.length) throw new ApiError(422, "CHECKOUT_DELIVERY_COUNTRY_INVALID", "A delivery address within the store's country is required.");
    const stripeAccountId = await this.getStripeAccountId(input.storeId);

    // Buyer/delivery changes must not reuse an attempt holding an older snapshot.
    const discountCode = input.discountCode?.trim() || undefined;
    cart.cartHash = createHash("sha256").update(JSON.stringify([cart.cartHash, input.customerSnapshot, input.deliverySnapshot ?? null, customerId ?? null, discountCode?.toUpperCase() ?? null])).digest("hex");

    return this.deps.repository.withCheckoutLock(
      input.storeId,
      input.cartKey,
      async (tx) => {
        const existing =
          await findExistingAttempt(
            tx,
            input.storeId,
            input.cartKey,
          );

        if (existing) {
          const reused =
            await tryReuseAttempt(
              tx,
              existing,
              cart.cartHash,
            );

          if (reused) {
            return reused;
          }

          await cancelExistingAttempt(
              this.deps,
              tx,
            existing,
            input.storeId,
          );
        }

        // Checked inside the lock, after any earlier attempt for this bag gave its use back.
        // Automatic discounts and the typed code, locked so limited uses can't be taken twice.
        const bag = await requireBagDiscounts(tx as unknown as DiscountSql, input.storeId, bagOf(cart, input.currency, input.customerSnapshot.email, discountCode), { lock: true });
        const discount = bag.discounts.length ? bag : undefined;
        if (discount) assertChargeable(discount);

        return this.createCheckout(
          tx,
          input,
          discount ? { ...cart, shippingMinor: discount.shippingMinor, totalMinor: discount.totalMinor } : cart,
          stripeAccountId,
          discount,
        );
      },
    );
  }

  private parseInput(
    input: BeginCheckoutInput,
  ) {
    const parsed =
      checkoutInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "CHECKOUT_INPUT_INVALID",
        "Invalid checkout input.",
      );
    }

    return parsed.data;
  }

  private async getStripeAccountId(
    storeId: string,
  ): Promise<string> {
    const ready =
      await this.deps.stripeAccountService
        .getLivePaymentReadiness(storeId);

    if (!ready) {
      throw new ApiError(
        409,
        "MERCHANT_PAYMENTS_UNAVAILABLE",
        "Merchant cannot accept payments at this time.",
      );
    }

    const status =
      await this.deps.stripeAccountService
        .getStatus(storeId);

    if (!status.stripeAccountId) {
      throw new ApiError(
        409,
        "MERCHANT_PAYMENTS_UNAVAILABLE",
        "Merchant cannot accept payments at this time.",
      );
    }

    return status.stripeAccountId;
  }


  private async createCheckout(
    tx: CommerceTransaction,
    input: z.infer<typeof checkoutInputSchema> & { customerId?: string },
    cart: ValidatedCart,
    stripeAccountId: string,
    discount?: BagDiscounts,
  ): Promise<CheckoutAttemptResult> {
    const orderId =
      `order-${randomUUID()}`;

    const publicToken =
      randomBytes(32).toString("base64url");

    await tx.query(
      `
        INSERT INTO "Order" (
          "id",
          "storeId",
          "number",
          "publicToken",
          "status",
          "customerSnapshot",
          "subtotalMinor",
          "shippingMinor",
          "totalMinor",
          "currency"
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10
        )
      `,
      [
        orderId,
        input.storeId,
        await tx.nextOrderNumber(input.storeId),
        publicToken,
        "PENDING_PAYMENT",
        input.customerSnapshot,
        cart.subtotalMinor,
        cart.shippingMinor,
        cart.totalMinor,
        input.currency,
      ],
    );

    // Only written when a code is used, so checkout keeps working before the discount migration is applied.
    if (discount) {
      await tx.query('UPDATE "Order" SET "discountCode" = $3, "discountMinor" = $4, "taxMinor" = 0 WHERE "storeId" = $1 AND "id" = $2', [input.storeId, orderId, discount.code, discount.discountMinor]);
      await recordOrderDiscounts(tx as unknown as DiscountSql, input.storeId, orderId, discount.applied);
    }
    if (input.customerId) await tx.query('UPDATE "Order" SET "customerId" = $3 WHERE "storeId" = $1 AND "id" = $2', [input.storeId, orderId, input.customerId]);
    if (this.deps.enhancedSnapshots) {
      await tx.query('UPDATE "Order" SET "deliverySnapshot"=$3::jsonb,"billingAddress"=$4::jsonb,"customerNote"=$5,"isTest"=$6 WHERE "storeId"=$1 AND "id"=$2', [input.storeId, orderId, input.deliverySnapshot ? JSON.stringify(input.deliverySnapshot) : null, input.customerSnapshot.billingAddress ? JSON.stringify(input.customerSnapshot.billingAddress) : null, typeof input.customerSnapshot.note === "string" ? input.customerSnapshot.note.slice(0,10000) : null, this.deps.isTest ?? false]);
    }

    // Refunds and order edits read each line's share of the discount.
    const lineDiscounts = cart.lines.map((line) => discount?.lineDiscounts[lineKey(line)] ?? 0);
    for (const line of cart.lines) {
      await tx.query(
        `
          INSERT INTO "OrderItem" (
            "orderId",
            "storeId",
            "variantId",
            "titleSnapshot",
            "skuSnapshot",
            "imageSnapshot",
            "unitPriceMinor",
            "quantity",
            "configurationSnapshot"
            ,"configurationKey"
          )
          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9, $10
          )
        `,
        [
          orderId,
          input.storeId,
          line.variantId,
          line.titleSnapshot,
          line.skuSnapshot,
          line.imageSnapshot,
          line.unitPriceMinor,
          line.quantity,
          JSON.stringify(line.configurationSnapshot),
          line.configurationKey,
        ],
      );
      if (discount) await tx.query('UPDATE "OrderItem" SET "discountMinor" = $5, "taxMinor" = 0 WHERE "storeId" = $1 AND "orderId" = $2 AND "variantId" = $3 AND "configurationKey" = $4', [input.storeId, orderId, line.variantId, line.configurationKey, lineDiscounts[cart.lines.indexOf(line)] ?? 0]);
      if (this.deps.enhancedSnapshots) await tx.query('UPDATE "OrderItem" SET "productTitleSnapshot"=$4,"variantTitleSnapshot"=$5,"fulfillmentType"=$6 WHERE "storeId"=$1 AND "orderId"=$2 AND "variantId"=$3 AND "configurationKey"=$7', [input.storeId, orderId, line.variantId, line.productTitleSnapshot, line.variantTitleSnapshot, line.fulfillmentType, line.configurationKey]);
    }

    const paymentId =
      `pay-${randomUUID()}`;

    await tx.query(
      `
        INSERT INTO "Payment" (
          "id",
          "storeId",
          "orderId",
          "stripeAccountId",
          "paymentIntentId",
          "chargeId",
          "status",
          "amountMinor",
          "currency"
        )
        VALUES (
          $1, $2, $3, $4, NULL,
          NULL, 'PENDING', $5, $6
        )
      `,
      [
        paymentId,
        input.storeId,
        orderId,
        stripeAccountId,
        cart.totalMinor,
        input.currency,
      ],
    );

    const attemptId =
      `attempt-${randomUUID()}`;

    const stripeIdempotencyKey =
      randomBytes(32).toString("hex");

    const expiresAt = new Date(
      Date.now() + CHECKOUT_TTL_MS,
    );

    await tx.query(
      `
        INSERT INTO "CheckoutAttempt" (
          "id",
          "orderId",
          "storeId",
          "cartKey",
          "cartHash",
          "stripeIdempotencyKey",
          "paymentIntentId",
          "status",
          "expiresAt"
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, NULL,
          'PAYMENT_INTENT_CREATING',
          $7
        )
      `,
      [
        attemptId,
        orderId,
        input.storeId,
        input.cartKey,
        cart.cartHash,
        stripeIdempotencyKey,
        expiresAt,
      ],
    );

    try {
      const physicalItems = input.items.filter((item) => cart.lines.some((line) => line.variantId === item.variantId && line.fulfillmentType !== "DIGITAL"));
      if (physicalItems.length) await tx.reserveVariants({
        storeId: input.storeId,
        attemptId,
        items: physicalItems,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes(
          "Insufficient inventory",
        )
      ) {
        throw new ApiError(
          409,
          "OUT_OF_STOCK",
          "One or more items are out of stock.",
        );
      }

      throw error;
    }

    if (this.deps.enhancedSnapshots) await tx.query(`INSERT INTO "OrderRevision" (id,"storeId","orderId",number,status,snapshot,"idempotencyKey","requestHash","appliedAt") SELECT 'original-'||o.id,o."storeId",o.id,1,'APPLIED',jsonb_build_object('order',to_jsonb(o),'items',COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM "OrderItem" i WHERE i."storeId"=o."storeId" AND i."orderId"=o.id),'[]'::jsonb)),'original','original',o."createdAt" FROM "Order" o WHERE o."storeId"=$1 AND o.id=$2 ON CONFLICT DO NOTHING`, [input.storeId, orderId]);
    return {
      attemptId,
      orderId,
      publicToken,
    };
  }
}
