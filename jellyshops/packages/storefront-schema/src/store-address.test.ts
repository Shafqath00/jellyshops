import { describe, expect, it } from "vitest";
import {
  BLOCKED_WORD_STORE_ADDRESSES,
  BRAND_STORE_ADDRESSES,
  SYSTEM_STORE_ADDRESSES,
  checkStoreAddress,
  foldLookalikes,
  normaliseStoreAddress,
} from "./store-address";

const problem = (address: string) => {
  const result = checkStoreAddress(address);
  return result.ok ? null : result.problem;
};

describe("checkStoreAddress", () => {
  it.each(["new", "express-bed", "resthaven-demo", "shop123", "a1b", "apple-tree-bakery", "river-bank-crafts", "wise-owl-books", "scunthorpe-sweets", "grapevine", "a".repeat(40)])(
    "accepts %s",
    (address) => expect(checkStoreAddress(address)).toEqual({ ok: true }),
  );

  it("refuses the wrong length", () => {
    expect(problem("ab")).toBe("length");
    expect(problem("a".repeat(41))).toBe("length");
  });

  it.each(["My-Shop", "-shop", "shop-", "my--shop", "my_shop", "my shop", "café"])("refuses the shape of %s", (address) =>
    expect(problem(address)).toBe("shape"),
  );

  it("needs a letter", () => {
    expect(problem("12345")).toBe("letters");
    expect(problem("123-456")).toBe("letters");
  });

  it("refuses punycode (its double hyphen already breaks the shape)", () => {
    expect(problem("xn--bcher-kva")).toBe("shape");
  });

  it.each(["admin", "www", "api", "mail", "login", "checkout", "platform", "sites", "jellyshop", "status"])("refuses the system name %s", (address) =>
    expect(problem(address)).toBe("unavailable"),
  );

  it.each(["paypal", "paypa1", "pay-pal", "paypal-secure", "secure-paypal", "paypalsecure", "loginpaypal", "amaz0n", "stripe-payments", "hmrc-refunds", "klarna", "rnicrosoft", "g00gle-help"])(
    "refuses the brand lookalike %s",
    (address) => expect(problem(address)).toBe("unavailable"),
  );

  it.each(["shit", "sh1t", "big-shit-shop", "fuck-off"])("refuses the offensive address %s", (address) =>
    expect(problem(address)).toBe("unavailable"),
  );

  it("gives one message for every blocked name, so the lists can't be probed", () => {
    const messages = new Set(["admin", "paypal", "paypa1-login", "shit"].map((address) => {
      const result = checkStoreAddress(address);
      return result.ok ? "" : result.message;
    }));
    expect([...messages]).toEqual(["This address isn't available. Try another."]);
  });
});

describe("foldLookalikes", () => {
  it("folds swapped characters and drops hyphens", () => {
    expect(foldLookalikes("pay-pa1")).toBe(foldLookalikes("paypal"));
    expect(foldLookalikes("rnonzo")).toBe(foldLookalikes("monzo"));
    expect(foldLookalikes("vvhatsapp")).toBe(foldLookalikes("whatsapp"));
    expect(foldLookalikes("5tr1p3")).toBe(foldLookalikes("stripe"));
  });
});

describe("normaliseStoreAddress", () => {
  it("turns a shop name into an address", () => {
    expect(normaliseStoreAddress("  Express Bed  ")).toBe("express-bed");
    expect(normaliseStoreAddress("Café & Crème")).toBe("cafe-and-creme");
    expect(normaliseStoreAddress("Tom's   Shop!!")).toBe("tom-s-shop");
    expect(normaliseStoreAddress("--a__b--")).toBe("a-b");
  });

  it("cuts long names without leaving a hyphen at the end", () => {
    const address = normaliseStoreAddress(`${"a".repeat(39)} bcd`);
    expect(address).toBe("a".repeat(39));
    expect(address.length).toBeLessThanOrEqual(40);
  });
});

describe("lists", () => {
  it("hold lowercase addresses with no repeats", () => {
    for (const list of [SYSTEM_STORE_ADDRESSES, BRAND_STORE_ADDRESSES, BLOCKED_WORD_STORE_ADDRESSES]) {
      expect(new Set(list).size).toBe(list.length);
      for (const entry of list) expect(entry).toBe(entry.toLowerCase());
    }
  });
});
