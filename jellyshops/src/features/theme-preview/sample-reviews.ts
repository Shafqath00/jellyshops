import type { StorefrontReviewAccess } from "@jelly/storefront-renderer";

/** Sample reviews for theme previews (style guide panel and product page); sending one only pretends. */
export const sampleReviews: StorefrontReviewAccess = {
  async list(_productId, page = {}) {
    const reviews = [
      { id: "r1", rating: 5, title: "Exactly as pictured", body: "Arrived quickly and feels even better in person. I've already ordered a second one.", authorName: "Priya S.", verifiedPurchase: true, createdAt: "2026-10-30T10:00:00Z" },
      { id: "r2", rating: 4, title: "Lovely, runs a little small", body: "Great quality. I'd size up next time.", authorName: "Tom R.", verifiedPurchase: false, createdAt: "2026-10-21T10:00:00Z" },
      { id: "r3", rating: 5, title: "", body: "Beautiful finish and well packed.", authorName: "Grace", verifiedPurchase: true, createdAt: "2026-10-02T10:00:00Z" },
    ].slice(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? 5));
    return { summary: { average: 4.7, count: 3, distribution: [2, 1, 0, 0, 0] }, reviews };
  },
  async submit() { return { ok: true }; },
};
