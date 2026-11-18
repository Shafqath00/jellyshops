import { describe, expect, it } from "vitest";
import { redactStripePayload } from "./receipt-repository.js";

describe("stored Stripe events", () => {
  it("drop the PaymentIntent client secret and keep everything else", () => {
    const event = { id: "evt_1", data: { object: { id: "pi_1", client_secret: "pi_1_secret_abc", metadata: { jelly_order_id: "o" }, charges: [{ client_secret: "x" }] } } };
    const stored = redactStripePayload(event);
    expect(JSON.stringify(stored)).not.toContain("secret_abc");
    expect(stored.data.object.client_secret).toBe("[redacted]");
    expect(stored.data.object.metadata).toEqual({ jelly_order_id: "o" });
    expect(event.data.object.client_secret).toBe("pi_1_secret_abc");
  });
});
