import { describe, expect, it, vi } from "vitest";
import { ContentRequestError, contentState, createContentApi } from "./client";

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

  it("sends list filters as query words and leaves empty ones out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0, counts: {} }));
    const api = createContentApi({ baseUrl: "http://localhost:3001/", token: "merchant", fetch: fetchMock });
    await api.browsePages("store-demo", { q: "about us", state: "draft", tag: "", limit: 20 });
    expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:3001/api/stores/store-demo/content/pages/browse?q=about+us&state=draft&limit=20");
  });

  it("passes on the server message, code and suggested address when a save is refused", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { code: "CONTENT_HANDLE_TAKEN", message: "Another page already uses about.", issues: [{ path: "handle", message: "about-2" }] } }, 409));
    const api = createContentApi({ baseUrl: "http://localhost:3001", token: "merchant", fetch: fetchMock });
    const error = await api.createPage("store-demo", { title: "About", handle: "about" }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ContentRequestError);
    expect(error).toMatchObject({ message: "Another page already uses about.", status: 409, code: "CONTENT_HANDLE_TAKEN", suggestion: "about-2" });
  });

  it("accepts an empty answer from a delete", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const api = createContentApi({ baseUrl: "http://localhost:3001", token: "merchant", fetch: fetchMock });
    await expect(api.deletePage("store-demo", "page-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/stores/store-demo/content/pages/page-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("works out the state a merchant sees", () => {
    expect(contentState({ status: "PUBLISHED" })).toBe("published");
    expect(contentState({ status: "DRAFT", scheduledAt: "2026-12-01T09:00:00Z" })).toBe("scheduled");
    expect(contentState({ status: "PUBLISHED", archivedAt: "2026-12-01T09:00:00Z" })).toBe("archived");
    expect(contentState({})).toBe("draft");
  });
});
