import { describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "../commerce/repository.js";
import { createStorefrontMediaReferenceReader } from "./storefront-reference-reader.js";

describe("storefront media reference reader", () => {
  it("protects media referenced by a store's draft or retained publication only", async () => {
    const query = vi.fn(async (statement: string, values?: unknown[]) => {
      const storeId = values?.[0];
      if (statement.includes('"StorefrontTemplate"')) {
        return { rows: storeId === "store-a" ? [{ value: { sections: [{ settings: { image: { id: "media-a", url: "/media/store-a/media-a", alt: "A", focalPoint: { x: 50, y: 50 } } } }] } }] : [] };
      }
      if (statement.includes('"GlobalSection"')) return { rows: [] };
      if (statement.includes('"StorefrontPublication"')) return { rows: [] };
      throw new Error(`Unexpected SQL: ${statement}`);
    });
    const reader = createStorefrontMediaReferenceReader({ query } as unknown as SqlExecutor);

    await expect(reader("store-a", "media-a")).resolves.toBe(true);
    await expect(reader("store-b", "media-a")).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(6);
  });
});
