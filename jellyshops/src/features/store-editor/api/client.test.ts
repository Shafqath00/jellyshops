import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { describe, expect, it, vi } from "vitest";
import { createStoreEditorApi } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("store editor API client", () => {
  it("sends the demo token and expected revision", async () => {
    const document = createDefaultStorefrontDocument("store-demo");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ storeId: "store-demo", revision: 4, document }));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await api.saveDraft("store-demo", 3, document);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/storefront/draft",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }),
        body: JSON.stringify({ expectedRevision: 3, document }),
      }),
    );
  });

  it("surfaces revision conflicts without discarding details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "DRAFT_CONFLICT", message: "Stale draft", currentRevision: 5, requestId: "request-1" },
    }, 409));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await expect(api.saveDraft("store-demo", 4, createDefaultStorefrontDocument("store-demo"))).rejects.toMatchObject({
      status: 409,
      code: "DRAFT_CONFLICT",
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
