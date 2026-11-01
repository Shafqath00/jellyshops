import { describe, expect, it } from "vitest";
import { draftToPayload, emptyDraft, productToDraft } from "./draft";
import type { Product } from "@/lib/domain";

describe("gallery draft persistence", () => {
  it("sends an explicit empty gallery when all photos are unlinked", () => {
    const payload = draftToPayload({ ...emptyDraft, title: "Shirt", price: "10", media: [] } as typeof emptyDraft, undefined, { variantIds: [], imageUrl: "/old", media: [{ id: "old", url: "/old" }] } as never);
    expect(payload).toHaveProperty("media", []);
    expect(payload).not.toHaveProperty("imageUrl");
  });
  it("does not resend an unchanged gallery on a title edit", () => {
    const media = [{ id: "one", url: "/one", appliesTo: {}, altText: "Front" }];
    const payload = draftToPayload({ ...emptyDraft, title: "Shirt", price: "10", media } as typeof emptyDraft, undefined, { variantIds: [], imageUrl: "/one", media } as never);
    expect(payload).not.toHaveProperty("media");
  });
  it("opens every saved gallery photo", () => {
    const media = [{ id: "one", url: "/one" }, { id: "two", url: "/two" }];
    const opened = productToDraft({ name: "Shirt", description: "", imageUrl: "/one", published: true, variants: [], media } as unknown as Product);
    expect(opened.draft).toHaveProperty("media", media);
  });
});
