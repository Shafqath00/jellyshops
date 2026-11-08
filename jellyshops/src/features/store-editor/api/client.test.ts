import { describe, expect, it, vi } from "vitest";
import { createStoreEditorApi } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("store editor API client", () => {
  it("resolves saved section images against the current API, including old local server URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      templates: [{ layout: { sections: [{ settings: {
        image: { id: "hero", url: "http://127.0.0.1:3001/api/public/media/store-demo/hero", alt: "Hero" },
        logo: { id: "logo", url: "/api/public/media/store-demo/logo", alt: "Logo" },
        external: { url: "https://images.example.com/photo.jpg" },
        link: { url: "/shop" },
        text: "http://127.0.0.1:3001/api/public/media/store-demo/hero",
      } }] } }],
    }));
    const api = createStoreEditorApi({ baseUrl: "http://127.0.0.1:5001/project/us-central1/api/", token: "merchant", fetch: fetchMock });
    const workspace = await api.loadWorkspace("store-demo");
    expect(workspace).toMatchObject({ templates: [{ layout: { sections: [{ settings: {
      image: { url: "http://127.0.0.1:5001/project/us-central1/api/api/public/media/store-demo/hero" },
      logo: { url: "http://127.0.0.1:5001/project/us-central1/api/api/public/media/store-demo/logo" },
      external: { url: "https://images.example.com/photo.jpg" },
      link: { url: "/shop" },
      text: "http://127.0.0.1:3001/api/public/media/store-demo/hero",
    } }] } }] });
  });

  it("installs a V4 starter into the current store through the workspace endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ storeId: "store-a", starterPackId: "fresh-market", starterPackVersion: "1.0.0", generation: 1, installed: true }, 201));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "merchant-token", fetch: fetchMock });

    await expect(api.installStarterPack("store-a", "fresh-market")).resolves.toMatchObject({ generation: 1, installed: true });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/stores/store-a/storefront/starters/fresh-market/install", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer merchant-token" }),
    }));
  });

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

  it("loads dynamic sources by template context and accepted value types", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await api.listDynamicSources("store-demo", "product", ["string", "image"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/custom-data/dynamic-sources?context=product&accepts=string%2Cimage",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
  });

  it("loads saved section presets from the normalized workspace", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await api.listPresets("store-demo");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/storefront/presets",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
  });

  it("loads page, blog, and article preview resources from the current store", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await Promise.all([
      api.listPages("store-demo"),
      api.listBlogs("store-demo"),
      api.listArticles("store-demo"),
    ]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3001/api/stores/store-demo/content/pages",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3001/api/stores/store-demo/content/blogs",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3001/api/stores/store-demo/content/articles",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
  });

  it("loads a selected product detail through the current store catalog boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "product-a", storeId: "store-a", variants: [] }));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await expect(api.getProduct("store-a", "product-a")).resolves.toMatchObject({ id: "product-a", storeId: "store-a" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-a/catalog/products/product-a",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
  });

  it("loads selected Collection detail from the authenticated current-store catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "collection-a", storeId: "store-a", products: [] }));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await expect(api.getCollection("store-a", "collection-a")).resolves.toMatchObject({ id: "collection-a", storeId: "store-a" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-a/catalog/collections/collection-a",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
  });

  it("returns compiler diagnostics from an intentional 422 validation response", async () => {
    const diagnostics = [{ severity: "error", code: "BINDING_INVALID", message: "Bad binding", location: { entityType: "template", entityId: "home-default" } }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: false, diagnostics, dependencies: { edges: [] } }, 422));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await expect(api.validate("store-demo", 22)).resolves.toEqual({ ok: false, diagnostics, dependencies: { edges: [] } });
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

  it("returns publish diagnostics when strict compilation blocks publication", async () => {
    const diagnostics = [{ severity: "error", code: "REFERENCE_MISSING", message: "Menu missing", location: { entityType: "menu", entityId: "main" } }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: false, diagnostics }, 422));
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await expect(api.publish("store-demo", 22, "publish-bad")).resolves.toEqual({ ok: false, diagnostics });
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

  it("reports actual upload progress and authenticates the progress transport", async () => {
    let xhrInstance: ProgressXhr;
    class ProgressXhr {
      upload: XMLHttpRequestUpload = { onprogress: null } as XMLHttpRequestUpload;
      status = 201;
      responseText = JSON.stringify({ id: "media-2", storeId: "store-demo", url: "/api/public/media/store-demo/media-2", mimeType: "image/png", byteSize: 12, width: 100, height: 100, originalName: "hero.png", referenced: false, createdAt: "2026-09-04T00:00:00.000Z" });
      onload: ((event: ProgressEvent) => void) | null = null;
      onerror: ((event: ProgressEvent) => void) | null = null;
      onabort: ((event: ProgressEvent) => void) | null = null;
      authorization = "";
      constructor() { xhrInstance = this; }
      open() {}
      setRequestHeader(name: string, value: string) { if (name === "Authorization") this.authorization = value; }
      send() {
        this.upload.onprogress?.call(this as unknown as XMLHttpRequest, { lengthComputable: true, loaded: 60, total: 100 } as ProgressEvent);
        this.onload?.({} as ProgressEvent);
      }
    }
    vi.stubGlobal("XMLHttpRequest", ProgressXhr);
    const api = createStoreEditorApi({ baseUrl: "http://localhost:3001", token: "merchant-token", fetch: vi.fn() as unknown as typeof fetch });
    const progress = vi.fn();

    await expect(api.uploadMedia("store-demo", new File(["image"], "hero.png", { type: "image/png" }), progress)).resolves.toMatchObject({ id: "media-2" });
    expect(progress.mock.calls.map(([value]) => value)).toEqual([60, 100]);
    expect(xhrInstance!.authorization).toBe("Bearer merchant-token");
  });
});
