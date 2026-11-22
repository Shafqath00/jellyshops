import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveStorefrontNotFound } from "@/features/storefront/resource-loader";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";
import StoreNotFound from "./not-found";

const notFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "market" }), notFound: () => notFound() }));
vi.mock("@/contexts/shop-context", () => ({
  useShop: () => ({ repository: {
    getStoreBySlug: () => ({ id: "store-a", slug: "market", currency: "USD" }),
    listProducts: () => [],
  } }),
}));
vi.mock("@/features/storefront/storefront-bootstrap", () => ({ useInitialStorefrontPublication: vi.fn() }));
vi.mock("@/features/storefront/resource-loader", () => ({ resolveStorefrontNotFound: vi.fn() }));
vi.mock("@/features/storefront/storefront-page", () => ({
  PublishedRuntimeStorefront: ({ route }: { route: { context: { pageType: string } } }) => <div data-testid="runtime-not-found">{route.context.pageType}</div>,
}));

describe("store not found", () => {
  beforeEach(() => {
    vi.mocked(useInitialStorefrontPublication).mockReset();
    vi.mocked(resolveStorefrontNotFound).mockReset();
  });

  it("draws the published design's 404 template straight away (no loading step)", () => {
    const snapshot = { schemaVersion: 4, storeId: "store-a" } as never;
    const route = { status: "ready", context: { pageType: "not-found", resource: null }, sections: [], layout: { announcement: [], header: [], template: [], footer: [] } } as never;
    vi.mocked(useInitialStorefrontPublication).mockReturnValue({ kind: "v4", publicationId: "publication-a", snapshot } as never);
    vi.mocked(resolveStorefrontNotFound).mockReturnValue(route);

    render(<StoreNotFound />);

    expect(screen.getByTestId("runtime-not-found")).toHaveTextContent("not-found");
    expect(resolveStorefrontNotFound).toHaveBeenCalledWith(snapshot);
  });

  it("falls back to a plain message when the store has no 404 template", () => {
    vi.mocked(useInitialStorefrontPublication).mockReturnValue(null);
    render(<StoreNotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/market");
  });

  it("sends any unknown store address to the 404 page", async () => {
    const { default: Unmatched } = await import("./[...unmatched]/page");
    expect(() => Unmatched()).toThrow("NEXT_NOT_FOUND");
  });
});
