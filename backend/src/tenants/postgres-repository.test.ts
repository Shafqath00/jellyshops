import { describe, expect, it, vi } from "vitest";
import { PostgresTenantRepository } from "./postgres-repository.js";

describe("PostgresTenantRepository", () => {
  it("lists stores only by the recorded Supabase owner", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: "store-a",
        name: "A Shop",
        slug: "a-shop",
        currency: "INR",
        country: "IN",
      }],
    });
    const repository = new PostgresTenantRepository({ query } as never);

    await expect(repository.listStores("8fd1ea18-97e7-4f80-a466-fa64388c0d0a"))
      .resolves.toEqual([{
        id: "store-a",
        name: "A Shop",
        slug: "a-shop",
        currency: "INR",
        country: "IN",
        role: "OWNER",
      }]);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('s."owner_user_id" = $1::uuid'),
      ["8fd1ea18-97e7-4f80-a466-fa64388c0d0a"],
    );
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining("StoreMembership"), expect.anything());
  });
});
