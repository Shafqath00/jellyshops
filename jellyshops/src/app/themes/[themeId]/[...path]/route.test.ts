import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const call = (themeId: string, path: string[], query = "") => GET(new Request(`http://store.test/themes/${themeId}/${path.join("/")}${query}`), { params: Promise.resolve({ themeId, path }) });

afterEach(() => { vi.unstubAllGlobals(); });

describe("theme files on the store address", () => {
  it("passes an uploaded theme's file through with its type and safety headers", async () => {
    const fetcher = vi.fn<(url: string) => Promise<Response>>(async () => new Response("<svg/>", { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=300", "content-security-policy": "default-src 'none'; sandbox", "x-content-type-options": "nosniff", "set-cookie": "a=b" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await call("acme-shop", ["icons", "mark.svg"]);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<svg/>");
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/public\/themes\/acme-shop\/assets\/icons\/mark\.svg$/);
  });

  it("passes a pinned version on, and only a real version number", async () => {
    const fetcher = vi.fn<(url: string) => Promise<Response>>(async () => new Response("x", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await call("acme-shop", ["mark.svg"], "?version=1.2.0");
    expect(fetcher.mock.calls[0][0]).toMatch(/mark\.svg\?version=1\.2\.0$/);
    await call("acme-shop", ["mark.svg"], "?version=../../x");
    expect(fetcher.mock.calls[1][0]).toMatch(/mark\.svg$/);
  });

  it("answers 404 without asking the platform for names that cannot be theme files", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const [id, path] of [["Bad_Id", ["a.svg"]], ["acme", [".."]], ["acme", ["..", "secret"]], ["acme", ["A.SVG"]], ["acme", []]] as Array<[string, string[]]>) {
      expect((await call(id, path)).status).toBe(404);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("answers 404 when the platform has no such file or cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    expect((await call("acme-shop", ["gone.svg"])).status).toBe(404);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await call("acme-shop", ["mark.svg"])).status).toBe(404);
  });
});
