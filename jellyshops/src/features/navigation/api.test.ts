import { describe, expect, it, vi } from "vitest";
import { createNavigationApi } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("navigation API", () => {
  it("serializes nested internal targets by stable resource id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ menu: { id: "main", revision: 2 }, generation: 9 }));
    const api = createNavigationApi({ baseUrl: "http://localhost:3001", token: "merchant", fetch: fetchMock });
    const items = [{
      id: "shop",
      label: "Shop",
      target: { kind: "collection" as const, resourceId: "collection-1" },
      children: [{
        id: "about",
        label: "About",
        target: { kind: "page" as const, resourceId: "page-1" },
        children: [],
      }],
    }];

    await api.updateMenu("store-demo", "main", 1, { items });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/storefront/menus/main",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ expectedRevision: 1, items }),
      }),
    );
  });
});
