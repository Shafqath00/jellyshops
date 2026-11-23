import express from "express";
import type { StripeBillingService } from "./stripe-billing.js";

/**
 * `POST /webhooks/stripe/billing`: Stripe Billing events for shops paying Jellyshop. Its own signing secret
 * (STRIPE_BILLING_WEBHOOK_SECRET), separate from the Connect endpoints. Answers 400 for anything not signed by Stripe,
 * 500 when saving failed (Stripe then retries), 200 otherwise.
 */
export function createBillingWebhookRouter(service: Pick<StripeBillingService, "constructEvent" | "handleEvent">, onChange?: (storeId: string) => void): express.Router {
  const router = express.Router();
  router.post("/", express.raw({ type: "application/json" }), async (request, response) => {
    const signature = request.header("stripe-signature");
    if (!signature) return response.status(400).json({ error: { code: "STRIPE_SIGNATURE_INVALID" } });
    let event;
    try {
      // Firebase parses JSON before Express; its rawBody keeps the signed bytes.
      event = service.constructEvent((request as typeof request & { rawBody?: Buffer }).rawBody ?? (request.body as Buffer), signature);
    } catch {
      return response.status(400).json({ error: { code: "STRIPE_SIGNATURE_INVALID" } });
    }
    try {
      const outcome = await service.handleEvent(event);
      const storeId = (event.data.object as { metadata?: Record<string, string> }).metadata?.jelly_store_id;
      if (outcome === "saved" && storeId) onChange?.(storeId);
      return response.json({ received: true });
    } catch (error) {
      console.error("Billing webhook failed", { eventId: event.id, type: event.type, error: error instanceof Error ? error.message : String(error) });
      return response.status(500).json({ error: { code: "BILLING_WEBHOOK_FAILED" } });
    }
  });
  return router;
}
