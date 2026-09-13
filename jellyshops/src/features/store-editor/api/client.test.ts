import { describe, expect, it, vi } from "vitest";
import { createStoreEditorApi } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("store editor API client", () => {
  it("saves only the edited template revision and receives the new workspace generation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      template: {
        id: "product-featured",
        storeId: "store-demo",
        revision: 4,
        type: "product",
        handle: "featured",
        name: "Featured product",
        layout: { sections: [] },
      },
      generation: 22,
    }));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    const result = await api.updateTemplate("store-demo", "product-featured", 3, {
      layout: { sections: [{ kind: "inline", section: { id: "hero-1" } }] },
    });

    expect(result.template.revision).toBe(4);
    expect(result.generation).toBe(22);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/storefront/templates/product-featured",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }),
        body: JSON.stringify({
          expectedRevision: 3,
          layout: { sections: [{ kind: "inline", section: { id: "hero-1" } }] },
        }),
      }),
    );
  });

  it("publishes by workspace generation with an idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      publication: { id: "publication-1", storeId: "store-demo", sourceGeneration: 22 },
      diagnostics: [],
      reused: false,
    }, 201));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await api.publish("store-demo", 22, "publish-abc");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/storefront/publish",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expectedGeneration: 22, idempotencyKey: "publish-abc" }),
      }),
    );
  });

  it("surfaces resource revision conflicts without discarding details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "RESOURCE_REVISION_CONFLICT", message: "Stale template", currentRevision: 5, requestId: "request-1" },
    }, 409));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await expect(api.updateTemplate("store-demo", "product-featured", 4, { name: "Featured" })).rejects.toMatchObject({
      status: 409,
      code: "RESOURCE_REVISION_CONFLICT",
      currentRevision: 5,
    });
  });

  it("turns local API media paths into browser-safe absolute URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      id: "media-1", storeId: "store-demo", url: "/api/public/media/store-demo/media-1", mimeType: "image/png",
      byteSize: 12, width: 100, height: 100, originalName: "hero.png", referenced: false, createdAt: "2026-09-04T00:00:00.000Z",
    }));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    const media = await api.uploadMedia("store-demo", new File(["image"], "hero.png", { type: "image/png" }));

    expect(media.url).toBe("http://localhost:3001/api/public/media/store-demo/media-1");
  });
});
