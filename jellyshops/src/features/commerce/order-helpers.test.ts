import { describe, expect, it } from "vitest";
import { describeActivity, emailName } from "./order-activity";
import { packingSlipDocument } from "./packing-slip";
import type { MerchantOrderDetail } from "./api/types";

describe("describeActivity", () => {
  const notifications = [{ id: "n1", type: "PLACED", status: "FAILED", lastError: "SMTP 535 authentication failed" }];
  it("names the email, gives the reason and says what happens next", () => {
    expect(describeActivity({ id: "1", type: "NOTIFICATION_FAILED", createdAt: "", payload: { notificationId: "n1", type: "PLACED", status: "QUEUED", attempts: 2 } }, notifications))
      .toBe("Order confirmation email could not be sent (attempt 2). Reason: SMTP 535 authentication failed. Jelly will try again automatically.");
    expect(describeActivity({ id: "2", type: "NOTIFICATION_FAILED", createdAt: "", payload: { notificationId: "n1", type: "PLACED", status: "FAILED", attempts: 5 } }, notifications))
      .toMatch(/Jelly has stopped trying\. Use Retry under Customer emails\.$/);
    expect(describeActivity({ id: "3", type: "NOTIFICATION_ACCEPTED", createdAt: "", payload: { type: "SHIPPED" } })).toBe("Shipping confirmation email sent to the customer.");
    expect(describeActivity({ id: "4", type: "ORDER_CONFIRMED", createdAt: "" })).toBe("Order confirmed");
    expect(describeActivity({ id: "5", type: "X", createdAt: "", message: "Custom words" })).toBe("Custom words");
    expect(emailName("SOMETHING_NEW")).toBe("Something new email");
  });
});

describe("packing slip", () => {
  const detail = {
    order: { id: "o1", number: "JS-1004", createdAt: "2026-10-26T20:42:00.000Z", customerSnapshot: { name: "Rahul <b>Kumar</b>", email: "rahul@example.com" }, deliverySnapshot: { address: { line1: "1 High St", city: "London", postalCode: "N1 1AA", country: "GB" } }, customerNote: "Leave at door" },
    items: [
      { id: "i1", titleSnapshot: "Crew Tee", variantTitleSnapshot: "Large", skuSnapshot: "TEE-L", quantity: 2, unitPriceMinor: 3200 },
      { id: "i2", titleSnapshot: "E-book", quantity: 1, unitPriceMinor: 500, fulfillmentType: "DIGITAL" },
    ],
  } as unknown as MerchantOrderDetail;
  it("lists what goes in the box and where, escapes text and leaves out prices and digital items", () => {
    const html = packingSlipDocument([detail, detail], "Jelly Beds");
    expect(html).toContain("Order JS-1004");
    expect(html).toContain("Rahul &lt;b&gt;Kumar&lt;/b&gt;");
    expect(html).toContain("1 High St<br>London<br>N1 1AA<br>GB");
    expect(html).toContain("TEE-L");
    expect(html).toContain("Leave at door");
    expect(html).not.toContain("E-book");
    expect(html).not.toContain("32.00");
    expect(html.match(/class="slip"/g)).toHaveLength(2);
  });
});
