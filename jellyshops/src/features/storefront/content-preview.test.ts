import { describe, expect, it, vi } from "vitest";
import { allowedPreviewOrigins, readPreviewDraft, PREVIEW_DRAFT } from "./content-preview-messages";
import { movedTo } from "./server-content-page";

describe("draft preview messages", () => {
  it("accepts drafts only from this site, plus the admin host when shops have their own addresses", () => {
    expect(allowedPreviewOrigins("http://localhost:3210", { mode: "path", rootDomain: "localhost:3210" } as never)).toEqual(["http://localhost:3210"]);
    expect(allowedPreviewOrigins("https://shop.jellyshop.io", { mode: "subdomain", rootDomain: "jellyshop.io" } as never)).toEqual(["https://shop.jellyshop.io", "https://admin.jellyshop.io"]);
  });

  it("reads only well-formed drafts", () => {
    const draft = { type: PREVIEW_DRAFT, kind: "page", title: "About", handle: "about", content: { type: "doc", content: [] } };
    expect(readPreviewDraft(draft)).toEqual(draft);
    expect(readPreviewDraft({ ...draft, kind: "product" })).toBeNull();
    expect(readPreviewDraft({ ...draft, type: "other" })).toBeNull();
    expect(readPreviewDraft("<script>")).toBeNull();
  });
});

describe("old content addresses on the storefront", () => {
  it("follows a store-relative content address and ignores anything else", async () => {
    const answer = (location: unknown) => vi.fn(async () => new Response(JSON.stringify({ location }), { status: 200 }));
    expect(await movedTo("store-a", "/pages/Delivery", answer("/pages/shipping") as unknown as typeof fetch)).toBe("/pages/shipping");
    expect(await movedTo("store-a", "/pages/x", answer("https://evil.example/") as unknown as typeof fetch)).toBeNull();
    expect(await movedTo("store-a", "/pages/x", answer(null) as unknown as typeof fetch)).toBeNull();
    expect(await movedTo("store-a", "/pages/x", vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch)).toBeNull();
  });
});
