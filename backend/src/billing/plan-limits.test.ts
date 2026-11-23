import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { CatalogService } from "../catalog/service.js";
import type { CatalogRepository, CatalogWriter } from "../catalog/repository.js";
import { MediaService } from "../media/service.js";
import type { MediaRepository } from "../media/repository.js";
import type { MediaStorage } from "../media/storage.js";
import { PlanLimitChecker, formatBytes, sqlUsageReader, type UsageReader } from "./plan-limits.js";
import { PLANS } from "./plans.js";

const limits = PLANS.standard.limits;
const reader = (usage: Partial<Record<keyof typeof limits, number>>): UsageReader => ({ usage: async (_store, kind) => usage[kind] ?? 0 });

describe("plan limits", () => {
  it("lets a store add things while it has room, up to exactly the limit", async () => {
    const checker = new PlanLimitChecker(reader({ products: limits.products - 1 }));
    await expect(checker.check("s", "products")).resolves.toBeUndefined();
    await expect(new PlanLimitChecker(reader({ products: limits.products })).check("s", "products")).rejects.toMatchObject({ status: 409, code: "PLAN_LIMIT" });
  });

  it("explains a full plan in plain words, with the numbers", async () => {
    const products = new PlanLimitChecker(reader({ products: 5000 }));
    await expect(products.check("s", "products")).rejects.toThrow("Your plan allows up to 5,000 products and this shop already has 5,000. Archive products you no longer sell");
    const photos = new PlanLimitChecker(reader({ photoBytes: limits.photoBytes - 1024 }));
    await expect(photos.check("s", "photoBytes", 3 * 1024 * 1024)).rejects.toThrow("Your plan includes 10 GB of photos and this shop uses 10 GB, so there is no room for this 3 MB photo. Delete photos you no longer use in Content > Files");
  });

  it("never limits an exempt store, and reports its usage without a limit", async () => {
    const checker = new PlanLimitChecker(reader({ products: 1_000_000 }), async () => "exempt");
    await expect(checker.check("s", "products")).resolves.toBeUndefined();
    await expect(checker.usage("s", "products")).resolves.toEqual({ plan: "exempt", kind: "products", used: 1_000_000, limit: null });
  });

  it("counts from the database by store: products not archived, photo bytes, people", async () => {
    const query = vi.fn(async () => ({ rows: [{ value: "42" }] }));
    const usage = sqlUsageReader({ query } as never);
    expect(await usage.usage("store-a", "products")).toBe(42);
    expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/FROM "Product" WHERE "storeId" = \$1 AND "status" <> 'ARCHIVED'/), ["store-a"]);
    await usage.usage("store-a", "photoBytes");
    expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/sum\("byteSize"\).*FROM "Media" WHERE "storeId" = \$1/), ["store-a"]);
    await usage.usage("store-a", "staff");
    expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/FROM "StoreMembership" WHERE "storeId" = \$1/), ["store-a"]);
    // Custom domains are not built yet, so there is nothing to count.
    query.mockClear();
    expect(await usage.usage("store-a", "customDomains")).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("writes sizes the way people read them", () => {
    expect(formatBytes(512)).toBe("512 bytes");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(750 * 1024 ** 2)).toBe("750 MB");
    expect(formatBytes(10 * 1024 ** 3)).toBe("10 GB");
  });
});

describe("where the limits are checked", () => {
  const product = { handle: "t", title: "T", variants: [{ title: "Default", priceMinor: 100, options: {} }] };

  it("refuses a new product when the plan is full, before anything is written; archived products need no room", async () => {
    const writer = { createProduct: vi.fn(async () => ({ id: "new" })) } as unknown as CatalogWriter;
    const catalog = new CatalogService({} as CatalogRepository, writer, new PlanLimitChecker(reader({ products: limits.products })));
    await expect(catalog.createProduct("s", product)).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    expect(writer.createProduct).not.toHaveBeenCalled();
    await expect(catalog.createProduct("s", { ...product, status: "ARCHIVED" })).resolves.toMatchObject({ id: "new" });
  });

  it("refuses a photo that does not fit, before any file is stored", async () => {
    const photo = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#123456" } }).png().toBuffer();
    const repository = { create: vi.fn(), get: vi.fn(), list: vi.fn(async () => []), delete: vi.fn() } as unknown as MediaRepository;
    const storage = { put: vi.fn(), open: vi.fn(), remove: vi.fn() } as unknown as MediaStorage;
    const service = new MediaService(repository, storage, undefined, undefined, new PlanLimitChecker(reader({ photoBytes: limits.photoBytes })));
    await expect(service.upload("s", { buffer: photo, size: photo.length, originalname: "a.png" } as Express.Multer.File)).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    expect(storage.put).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });
});
