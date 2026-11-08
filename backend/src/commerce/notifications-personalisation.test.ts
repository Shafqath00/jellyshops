import { describe, expect, it } from "vitest";
import { lineDetails, renderOrderNotification } from "./notifications.js";

describe("order emails show each line's choices and personalisation", () => {
  it("reads the order line's snapshot as Name: value", () => {
    expect(lineDetails([{ optionName: "Size", valueLabel: "M" }, { optionName: "Engraving", valueLabel: "SAM" }, { junk: true }])).toEqual(["Size: M", "Engraving: SAM"]);
    expect(lineDetails(null)).toEqual([]);
  });

  it("puts the details under the item, escaped, in HTML and plain text", () => {
    const message = renderOrderNotification("PLACED", { brandName: "Gilt", number: "1001", totalMinor: 9500, currency: "GBP", orderUrl: "https://shop.example/order/x", items: [{ title: "Ring", quantity: 1, unitPriceMinor: 9500, details: ["Engraving: <b>SAM</b>", "Gift message: Love you"] }] });
    expect(message.html).toContain("Engraving: &lt;b&gt;SAM&lt;/b&gt;");
    expect(message.html).not.toContain("<b>SAM</b>");
    expect(message.text).toContain("Ring × 1 — £95.00\n  Engraving: <b>SAM</b>\n  Gift message: Love you");
  });
});
