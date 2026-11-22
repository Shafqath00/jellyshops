import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCKED_WORD_STORE_ADDRESSES, BRAND_STORE_ADDRESSES, SYSTEM_STORE_ADDRESSES } from "@jelly/storefront-schema";
import { existingStoreSlugSchema, storeSlugSchema } from "./store-slug.js";

describe("store web addresses", () => {
  it("accept new addresses that pass the shared rules", () => {
    expect(storeSlugSchema.safeParse("express-bed").success).toBe(true);
  });

  it("refuse reserved, brand and too-long new addresses with one plain message", () => {
    for (const slug of ["admin", "paypa1-login"]) {
      const result = storeSlugSchema.safeParse(slug);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("This address isn't available. Try another.");
    }
    expect(storeSlugSchema.safeParse("a".repeat(41)).success).toBe(false);
  });

  it("still accept an existing address made under the older 63-character rule", () => {
    expect(existingStoreSlugSchema.safeParse("a".repeat(63)).success).toBe(true);
    expect(existingStoreSlugSchema.safeParse("Not Valid").success).toBe(false);
  });
});

describe("ReservedSlug seed", () => {
  const seeded = (folder: string) => {
    const sql = readFileSync(resolve(process.cwd(), folder, "20261122030000_reserved_slugs.sql"), "utf8");
    return [...sql.matchAll(/^\s*\('([^']+)', '([a-z]+)'\)/gm)].map(([, slug, reason]) => `${slug}:${reason}`).sort();
  };
  const expected = [
    ...SYSTEM_STORE_ADDRESSES.map((slug) => `${slug}:system`),
    ...BRAND_STORE_ADDRESSES.map((slug) => `${slug}:brand`),
    ...BLOCKED_WORD_STORE_ADDRESSES.map((slug) => `${slug}:profanity`),
  ].sort();

  it.each(["sql/migrations", "supabase/migrations"])("in %s equals the shared lists", (folder) => {
    expect(seeded(folder)).toEqual(expected);
  });
});
