import { describe, expect, it } from "vitest";
import { notificationRetry, renderOrderNotification, digitalToken, notificationTypes, defaultNotificationTemplate } from "./notifications.js";

describe("order notification safety", () => {
  it("provides meaningful default copy for shipment and delivery updates", () => {
    expect(defaultNotificationTemplate("SHIPPED").message).toMatch(/on its way/i);
    expect(defaultNotificationTemplate("DELIVERED").message).toMatch(/delivered/i);
    expect(defaultNotificationTemplate("DELIVERY_FAILED").message).toMatch(/delivery attempt/i);
  });
  it("renders a branded email-safe layout with tracking in HTML and text", () => {
    const message = renderOrderNotification("SHIPPED", { brandName: "My shop", number: "JS-1", customerName: "Alex", totalMinor: 2500, currency: "GBP", orderUrl: "https://example.test/order", logoUrl: "https://example.test/logo.png", contactEmail: "help@example.test", tracking: [{ carrier: "DHL", number: "ABC123", url: "https://example.test/track" }], items: [{ title: "Mug", quantity: 2, unitPriceMinor: 1250 }] });
    expect(message.html).toContain('role="presentation"');
    expect(message.html).toContain('max-width:600px');
    expect(message.html).toContain('#fffdf8');
    expect(message.html).toContain('alt="My shop"');
    expect(message.html).toContain('href="https://example.test/track"');
    expect(message.html).toContain('mailto:help@example.test');
    expect(message.text).toContain('ABC123');
    expect(message.text).toContain('https://example.test/track');
    expect(message.html).toContain('View your order');
  });
  it("avoids unsafe links and keeps readable buttons for light merchant accents", () => {
    const message = renderOrderNotification("DIGITAL_READY", { brandName: "Shop", number: "1", totalMinor: 100, currency: "GBP", orderUrl: "https://example.test/order", accentColor: "#ffffff", downloads: [{ filename: "Guide", url: "javascript:alert(1)" }] });
    expect(message.html).not.toContain('href="javascript:');
    expect(message.html).toContain('color:#14213d');
  });
  it("provides a useful default order confirmation with item details in HTML and text", () => {
    const message = renderOrderNotification("PLACED", { brandName: "Shop", number: "JS-1", customerName: "Alex", totalMinor: 2500, currency: "GBP", orderUrl: "https://example.test/order", items: [{ title: "Mug", quantity: 2, unitPriceMinor: 1250 }] });
    expect(message.html).toContain("Thank you for your order");
    expect(message.html).toContain("Mug");
    expect(message.html).toContain("£25.00");
    expect(message.text).toContain("Mug");
    expect(message.text).toContain("£25.00");
  });
  it("uses editable wording while escaping HTML and retaining order details", () => {
    const message = renderOrderNotification("PLACED", { brandName: "Shop", number: "JS-1", totalMinor: 2500, currency: "GBP", orderUrl: "https://example.test/order", items: [{ title: "Mug", quantity: 2, unitPriceMinor: 1250 }] }, { subject: "Your order is in", heading: "Thanks!", message: "<script>hello</script>", closing: "See you soon" });
    expect(message.subject).toContain("Your order is in");
    expect(message.html).toContain("&lt;script&gt;hello&lt;/script&gt;");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("Mug");
    expect(message.html).toContain("See you soon");
    expect(message.text).toContain("Mug");
  });
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
