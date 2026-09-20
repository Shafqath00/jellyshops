import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { z } from "zod";

import type { CatalogReader } from "../catalog/service.js";
import { ApiError } from "../http/errors.js";
import type { StripeAccountService } from "../stripe/accounts/service.js";

import {
  PaymentIntentService,
  type PaymentIntentGateway,
  type PreparedPayment,
} from "./payment-intents.js";
import { PublicOrderRateLimiter } from "./rate-limit.js";
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

const CHECKOUT_TTL_MS = 15 * 60 * 1000;

const inputSchema = z.object({
  storeId: z.string().min(1),
  cartKey: z.string().min(1),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive(),
        configurationSelections: z.array(z.object({ optionId: z.string().min(1), valueId: z.string().min(1), optionName: z.string().optional(), valueLabel: z.string().optional(), priceAdjustmentMinor: z.number().int().optional() })).optional(),
      }),
    )
    .min(1),
  customerSnapshot: z.record(
    z.string(),
    z.unknown(),
  ),
  deliverySnapshot: z
    .record(z.string(), z.unknown())
    .optional(),
});

interface ValidatedLine {
  variantId: string;
  quantity: number;
  titleSnapshot: string;
  skuSnapshot: string | null;
  imageSnapshot: string | null;
  unitPriceMinor: number;
  configurationSnapshot: Array<{ optionId: string; valueId: string; optionName: string; valueLabel: string; priceAdjustmentMinor: number }>;
  configurationKey: string;
}

interface ValidatedCart {
  lines: ValidatedLine[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  cartHash: string;
}

export interface CheckoutServiceDeps {
  repository: CommerceRepository;
  catalog: CatalogReader;
  stripeAccountService: StripeAccountService;
  stripeGateway?: PaymentIntentGateway;
}

function checkoutUnavailable() {
  return new ApiError(
    409,
    "CHECKOUT_ATTEMPT_UNAVAILABLE",
    "This checkout attempt is no longer available.",
  );
}

function isAlreadySucceededCancellation(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as Error & {
    code?: string;
  };

  if (
    candidate.code ===
    "payment_intent_unexpected_state"
  ) {
    return true;
  }

  return /already succeeded|cannot be canceled|cannot be cancelled/i.test(
    candidate.message,
  );
}

function createCartHash(
  currency: string,
  shippingMinor: number,
  lines: ValidatedLine[],
): string {
  const items = lines
    .map(
      (line) =>
        `${line.variantId}:${line.quantity}:${line.unitPriceMinor}`,
    )
    .sort();

  const value = [
    currency,
    shippingMinor,
    items.join("|"),
  ].join(":");

  return createHash("sha256")
    .update(value)
    .digest("hex");
}

export class CheckoutService {
  private readonly publicOrderRateLimiter: PublicOrderRateLimiter;

  constructor(
    private readonly deps: CheckoutServiceDeps,
  ) {
    this.publicOrderRateLimiter =
      new PublicOrderRateLimiter(
        deps.repository,
      );
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

    return order;
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

  async begin(
    rawInput: BeginCheckoutInput,
  ): Promise<CheckoutAttemptResult> {
    const input = this.parseInput(rawInput);

    const stripeAccountId =
      await this.getStripeAccountId(
        input.storeId,
      );

    const cart = await this.validateCart(
      input.storeId,
      input.currency,
      input.items,
    );

    return this.deps.repository.withCheckoutLock(
      input.storeId,
      input.cartKey,
      async (tx) => {
        const existing =
          await this.findExistingAttempt(
            tx,
            input.storeId,
            input.cartKey,
          );

        if (existing) {
          const reused =
            await this.tryReuseAttempt(
              tx,
              existing,
              cart.cartHash,
            );

          if (reused) {
            return reused;
          }

          await this.cancelExistingAttempt(
            tx,
            existing,
            input.storeId,
          );
        }

        return this.createCheckout(
          tx,
          input,
          cart,
          stripeAccountId,
        );
      },
    );
  }

  private parseInput(
    input: BeginCheckoutInput,
  ) {
    const parsed =
      inputSchema.safeParse(input);

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

  private async validateCart(
    storeId: string,
    currency: string,
    items: BeginCheckoutInput["items"],
  ): Promise<ValidatedCart> {
    const lines = await Promise.all(
      items.map(async (item) => {
        const variant =
          await this.deps.catalog.getVariant(
            storeId,
            item.variantId,
          );

        if (!variant) {
          throw new ApiError(
            422,
            "CHECKOUT_INPUT_INVALID",
            `Variant not found: ${item.variantId}`,
          );
        }

        if (!variant.available) {
          throw new ApiError(
            409,
            "OUT_OF_STOCK",
            `Variant out of stock: ${item.variantId}`,
          );
        }

        const product = await this.deps.catalog.getProduct(storeId, variant.productId);
        const productOptions = (product?.options ?? []) as Array<{ id: string; name: string; type?: string; required?: boolean; values?: Array<{ id: string; label: string; priceAdjustmentMinor?: number; priceAdjustment?: number }> }>;
        const selections = item.configurationSelections ?? [];
        const selectedOptionIds = new Set<string>();
        const snapshot = selections.map((selection) => {
          const option = productOptions.find((candidate) => candidate.id === selection.optionId);
          const value = option?.values?.find((candidate) => candidate.id === selection.valueId);
          if (!option || !value) throw new ApiError(422, "CHECKOUT_INPUT_INVALID", `Invalid product configuration: ${selection.optionId}`);
          if (selectedOptionIds.has(option.id)) throw new ApiError(422, "CHECKOUT_INPUT_INVALID", `Duplicate product configuration: ${option.id}`);
          selectedOptionIds.add(option.id);
          if (option.type === "variant" && variant.options[option.id] !== value.id) throw new ApiError(422, "CHECKOUT_INPUT_INVALID", "Configuration does not match the selected variant.");
          const priceAdjustmentMinor = Number.isFinite(value.priceAdjustmentMinor) ? Number(value.priceAdjustmentMinor) : Number.isFinite(value.priceAdjustment) ? Math.round(Number(value.priceAdjustment) * 100) : 0;
          return { optionId: option.id, valueId: value.id, optionName: option.name, valueLabel: value.label, priceAdjustmentMinor };
        });
        for (const option of productOptions) {
          if (option.required && !selectedOptionIds.has(option.id)) {
            throw new ApiError(422, "CHECKOUT_INPUT_INVALID", `Missing required product configuration: ${option.id}`);
          }
        }
        const unitPriceMinor = variant.priceMinor + snapshot.filter((selection) => productOptions.find((option) => option.id === selection.optionId)?.type !== "variant").reduce((total, selection) => total + selection.priceAdjustmentMinor, 0);
        return {
          variantId: variant.id,
          quantity: item.quantity,
          titleSnapshot: variant.title,
          skuSnapshot: variant.sku,
          imageSnapshot: null,
          unitPriceMinor,
          configurationSnapshot: snapshot,
          configurationKey: snapshot.map((selection) => `${selection.optionId}:${selection.valueId}`).sort().join("|"),
        };
      }),
    );

    const subtotalMinor = lines.reduce(
      (total, line) =>
        total +
        line.unitPriceMinor *
          line.quantity,
      0,
    );

    const shippingMinor = 0;
    const totalMinor =
      subtotalMinor + shippingMinor;

    return {
      lines,
      subtotalMinor,
      shippingMinor,
      totalMinor,
      cartHash: createCartHash(
        currency,
        shippingMinor,
        lines,
      ),
    };
  }

  private async findExistingAttempt(
    tx: CommerceTransaction,
    storeId: string,
    cartKey: string,
  ) {
    const result =
      await tx.query<CheckoutAttemptRow>(
        `
          SELECT *
          FROM "CheckoutAttempt"
          WHERE "storeId" = $1
            AND "cartKey" = $2
            AND "status" IN (
              'PAYMENT_INTENT_CREATING',
              'READY'
            )
          ORDER BY "createdAt" DESC
          LIMIT 1
        `,
        [storeId, cartKey],
      );

    return result.rows[0] ?? null;
  }

  private async tryReuseAttempt(
    tx: CommerceTransaction,
    attempt: CheckoutAttemptRow,
    cartHash: string,
  ): Promise<CheckoutAttemptResult | null> {
    const reusable =
      attempt.cartHash === cartHash &&
      attempt.expiresAt.getTime() >
        Date.now();

    if (!reusable) {
      return null;
    }

    const result = await tx.query<OrderRow>(
      `
        SELECT "publicToken"
        FROM "Order"
        WHERE "id" = $1
      `,
      [attempt.orderId],
    );

    return {
      attemptId: attempt.id,
      orderId: attempt.orderId,
      publicToken:
        result.rows[0]?.publicToken ?? "",
    };
  }

  private async cancelExistingAttempt(
    tx: CommerceTransaction,
    attempt: CheckoutAttemptRow,
    storeId: string,
  ): Promise<void> {
    if (attempt.paymentIntentId) {
      await this.cancelStripeIntent(
        tx,
        attempt,
        storeId,
      );
    }

    const cancelled = await tx.query(
      `
        UPDATE "Order"
        SET
          "status" = 'CANCELLED',
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
          AND "storeId" = $2
          AND "status" = 'PENDING_PAYMENT'
        RETURNING "id"
      `,
      [attempt.orderId, storeId],
    );

    if (cancelled.rows.length !== 1) {
      return;
    }

    await tx.query(
      `
        UPDATE "CheckoutAttempt"
        SET "status" = 'CANCELLED'
        WHERE "id" = $1
          AND "status" IN (
            'PAYMENT_INTENT_CREATING',
            'READY'
          )
      `,
      [attempt.id],
    );

    await tx.query(
      `
        UPDATE "Payment"
        SET "status" = 'CANCELLED'
        WHERE "orderId" = $1
          AND "storeId" = $2
          AND "status" = 'PENDING'
      `,
      [attempt.orderId, storeId],
    );

    await tx.releaseAttempt(attempt.id);
  }

  private async cancelStripeIntent(
    tx: CommerceTransaction,
    attempt: CheckoutAttemptRow,
    storeId: string,
  ): Promise<void> {
    const cancel =
      this.deps.stripeGateway
        ?.cancelPaymentIntent;

    if (!cancel || !attempt.paymentIntentId) {
      return;
    }

    const result = await tx.query<{
      stripeAccountId: string;
    }>(
      `
        SELECT "stripeAccountId"
        FROM "Payment"
        WHERE "orderId" = $1
          AND "storeId" = $2
        FOR UPDATE
      `,
      [attempt.orderId, storeId],
    );

    const payment = result.rows[0];

    if (!payment) {
      throw checkoutUnavailable();
    }

    try {
      await cancel(
        attempt.paymentIntentId,
        {
          connectedAccountId:
            payment.stripeAccountId,
          idempotencyKey:
            `${attempt.stripeIdempotencyKey}-cancel`,
        },
      );
    } catch (error) {
      if (
        !isAlreadySucceededCancellation(
          error,
        )
      ) {
        throw error;
      }
    }
  }

  private async createCheckout(
    tx: CommerceTransaction,
    input: z.infer<typeof inputSchema>,
    cart: ValidatedCart,
    stripeAccountId: string,
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
        orderId.slice(0, 8).toUpperCase(),
        publicToken,
        "PENDING_PAYMENT",
        input.customerSnapshot,
        cart.subtotalMinor,
        cart.shippingMinor,
        cart.totalMinor,
        input.currency,
      ],
    );

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
      await tx.reserveVariants({
        storeId: input.storeId,
        attemptId,
        items: input.items,
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

    return {
      attemptId,
      orderId,
      publicToken,
    };
  }
}
