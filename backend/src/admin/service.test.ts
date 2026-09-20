import { describe, expect, it, vi } from "vitest";

import type { CommerceRepository, CommerceTransaction } from "../commerce/repository.js";
import { AdminSummaryService, CustomerService } from "./service.js";

function setup(rows: unknown[][]) {
  const query = vi.fn(async () => ({ rows: rows.shift() ?? [] }));
  const tx = { query } as unknown as CommerceTransaction;
  const repository = {
    transaction: vi.fn(async (work: (transaction: CommerceTransaction) => unknown) => work(tx)),
  } as unknown as CommerceRepository;
  return { query, repository };
}

describe("AdminSummaryService", () => {
  it("returns zero revenue and empty queues for a store without orders", async () => {
    const { repository } = setup([[{ revenueMinor: 0, orderCount: 0 }], [{ publishedProductCount: 0 }], [], []]);

    await expect(new AdminSummaryService(repository).getSummary("store-empty")).resolves.toEqual({
      revenueMinor: 0,
      orderCount: 0,
      publishedProductCount: 0,
      actionableOrders: [],
      lowStock: [],
    });
  });

  it("uses the requested store id for every dashboard projection", async () => {
    const { query, repository } = setup([[{ revenueMinor: 0, orderCount: 0 }], [{ publishedProductCount: 0 }], [], []]);
    await new AdminSummaryService(repository).getSummary("store-a");
    expect(query.mock.calls).toHaveLength(4);
    expect(query.mock.calls.every(([, values]) => values?.includes("store-a"))).toBe(true);
  });
});

describe("CustomerService", () => {
  it("groups customer projections by normalized snapshot email", async () => {
    const { repository } = setup([[{
      id: "email:buyer@example.com", name: "Buyer", email: "buyer@example.com", orderCount: 2,
      lifetimeSpendMinor: 2500, latestOrderAt: new Date("2026-09-19T00:00:00.000Z"),
    }]]);
    await expect(new CustomerService(repository).list("store-a")).resolves.toEqual([
      expect.objectContaining({ id: "email:buyer@example.com", email: "buyer@example.com", orderCount: 2, lifetimeSpendMinor: 2500 }),
    ]);
  });

  it("returns null when the requested customer belongs only to another store", async () => {
    const { repository } = setup([[]]);
    await expect(new CustomerService(repository).get("store-a", "email:buyer@example.com")).resolves.toBeNull();
  });
});
