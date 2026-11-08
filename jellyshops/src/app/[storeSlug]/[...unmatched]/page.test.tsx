import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontNotFound } from "@/features/storefront/resource-loader";
import UnmatchedStorefrontPathPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "market", unmatched: ["unknown", "path"] }) }));
vi.mock("@/contexts/shop-context", () => ({
  useShop: () => ({ repository: {
    getStoreBySlug: () => ({ id: "store-a", slug: "market", currency: "USD" }),
    listProducts: () => [],
  } }),
}));
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: vi.fn() }));
vi.mock("@/features/storefront/resource-loader", () => ({ resolveStorefrontNotFound: vi.fn() }));
vi.mock("@/features/storefront/storefront-page", () => ({
  PublishedRuntimeStorefront: ({ route }: { route: { context: { pageType: string } } }) => <div data-testid="runtime-not-found">{route.context.pageType}</div>,
}));

describe("unmatched storefront path", () => {
  beforeEach(() => {
    vi.mocked(loadPublicStorefrontPublication).mockReset();
    vi.mocked(resolveStorefrontNotFound).mockReset();
  });

  it("renders the current publication's compiled Not Found template", async () => {
    const snapshot = { schemaVersion: 4, storeId: "store-a" } as never;
    const route = { status: "ready", context: { pageType: "not-found", resource: null }, sections: [], layout: { announcement: [], header: [], template: [], footer: [] } } as never;
    vi.mocked(loadPublicStorefrontPublication).mockResolvedValue({ kind: "v4", publicationId: "publication-a", snapshot } as never);
    vi.mocked(resolveStorefrontNotFound).mockReturnValue(route);

    render(<UnmatchedStorefrontPathPage />);

    await waitFor(() => expect(screen.getByTestId("runtime-not-found")).toHaveTextContent("not-found"));
    expect(resolveStorefrontNotFound).toHaveBeenCalledWith(snapshot);
  });
});
