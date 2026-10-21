import { describe, expect, it } from "vitest";
import { notificationRetry, renderOrderNotification, digitalToken, notificationTypes } from "./notifications.js";

describe("order notification safety", () => {
  it("stops retrying uncertain delivery and exhausts eight attempts", () => {
    expect(notificationRetry(1, true)).toEqual({ status: "UNCERTAIN", delaySeconds: 0 });
    expect(notificationRetry(8, false).status).toBe("FAILED");
    expect(notificationRetry(2, false)).toEqual({ status: "QUEUED", delaySeconds: 120 });
  });
  it("escapes merchant/customer content in all email templates", () => {
    const rendered = renderOrderNotification("PAYMENT_CONFIRMED", { brandName: "<script>", number: "<img>", totalMinor: 1200, currency: "USD", orderUrl: "https://example.test/order", customerName: "<b>", items: [{ title: "Guide <pdf>", quantity: 1, unitPriceMinor: 1200 }], logoUrl: "https://example.test/logo.png", contactEmail: "support@example.test" });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.subject).toContain("Payment confirmed");
    expect(rendered.html).toContain("Guide &lt;pdf&gt;");
    expect(rendered.html).toContain("support@example.test");
    expect(rendered.html).toContain("https://example.test/logo.png");
  });
  it("renders all eight lifecycle emails with responsive order links", () => {
    for (const type of notificationTypes) {
      const rendered = renderOrderNotification(type, { brandName: "Store", number: "001", totalMinor: 100, currency: "GBP", orderUrl: "https://example.test/order" });
      expect(rendered.html).toContain('name="viewport"');
      expect(rendered.html).toContain('href="https://example.test/order"');
      expect(rendered.text).toContain("001");
    }
  });
  it("distinguishes partial refund amount from the order total", () => {
    const message = renderOrderNotification("REFUND_PROCESSED", { brandName: "Store", number: "001", totalMinor: 1000, refundAmountMinor: 200, currency: "GBP", orderUrl: "https://example.test/order" });
    expect(message.html).toContain("Order total: £10.00");
    expect(message.html).toContain("Refund amount: £2.00");
    expect(message.text).toContain("Refund amount £2.00");
  });
  it("requires a strong secret and binds download tokens to entitlement IDs", () => {
    expect(() => digitalToken("one", "short")).toThrow();
    expect(digitalToken("one", "x".repeat(32))).not.toEqual(digitalToken("two", "x".repeat(32)));
  });
});
