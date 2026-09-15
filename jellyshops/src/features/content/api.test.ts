import { describe, expect, it, vi } from "vitest";
import { createContentApi } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("content API", () => {
  it("updates page content through the content lifecycle endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "page-1", title: "About" }));
    const api = createContentApi({ baseUrl: "http://localhost:3001", token: "merchant", fetch: fetchMock });

    await api.updatePage("store-demo", "page-1", { title: "About us" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/content/pages/page-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "About us" }) }),
    );
  });

  it("updates template assignment through storefront workspace separately", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ assignment: { resourceId: "page-1", templateId: "page-alt" }, generation: 12 }));
    const api = createContentApi({ baseUrl: "http://localhost:3001", token: "merchant", fetch: fetchMock });

    await api.assignTemplate("store-demo", "page", "page-1", "page-alt", 2);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/storefront/assignments/page/page-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ templateId: "page-alt", expectedRevision: 2 }),
      }),
    );
  });
});
