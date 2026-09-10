import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("demo catalog routes", () => {
  it("returns deterministic products and collections", async () => {
    const response = await request(createApp()).get("/api/demo/catalog");

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(8);
    expect(response.body.collections).toHaveLength(3);
    expect(response.body.products[0]).toMatchObject({ id: "product-strawberry", currency: "USD" });
    expect(response.body.collections[0].productIds).toContain("product-strawberry");
  });
});
