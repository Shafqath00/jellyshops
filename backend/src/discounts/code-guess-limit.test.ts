import { describe, expect, it } from "vitest";
import { ApiError } from "../http/errors.js";
import { DiscountGuessLimiter, withGuessLimit } from "./code-guess-limit.js";

describe("discount code guessing", () => {
  it("blocks an address after 10 wrong codes in one shop, for 10 minutes", async () => {
    let now = 0;
    const limiter = new DiscountGuessLimiter({ now: () => now });
    const wrong = () => withGuessLimit(limiter, "store-a", "1.2.3.4", true, async () => { throw new ApiError(422, "DISCOUNT_NOT_FOUND", "This code isn't valid."); });
    for (let i = 0; i < 10; i += 1) await expect(wrong()).rejects.toMatchObject({ code: "DISCOUNT_NOT_FOUND" });
    await expect(withGuessLimit(limiter, "store-a", "1.2.3.4", true, async () => "ok")).rejects.toMatchObject({ status: 429, code: "DISCOUNT_TOO_MANY_TRIES" });
    // Another shop, another address, or no code at all are not affected.
    await expect(withGuessLimit(limiter, "store-b", "1.2.3.4", true, async () => "ok")).resolves.toBe("ok");
    await expect(withGuessLimit(limiter, "store-a", "5.6.7.8", true, async () => "ok")).resolves.toBe("ok");
    await expect(withGuessLimit(limiter, "store-a", "1.2.3.4", false, async () => "ok")).resolves.toBe("ok");
    now = 10 * 60_000;
    await expect(withGuessLimit(limiter, "store-a", "1.2.3.4", true, async () => "ok")).resolves.toBe("ok");
  });

  it("never counts right codes or other errors", async () => {
    const limiter = new DiscountGuessLimiter({ limit: 1 });
    await withGuessLimit(limiter, "s", "ip", true, async () => "ok");
    await expect(withGuessLimit(limiter, "s", "ip", true, async () => { throw new ApiError(409, "OUT_OF_STOCK", "Sold out"); })).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    await expect(withGuessLimit(limiter, "s", "ip", true, async () => "ok")).resolves.toBe("ok");
  });
});
