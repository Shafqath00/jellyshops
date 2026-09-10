import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import { AdminNav } from "@/components/admin-nav";
import StoreDesignPage, { StoreDesignEditor } from "./page";

function renderPage() { return render(<ShopProvider><StoreDesignPage /></ShopProvider>); }

function createApi() {
  const document = createDefaultStorefrontDocument("store-demo");
  return {
    loadDraft: vi.fn().mockResolvedValue({ storeId: "store-demo", revision: 3, document, updatedAt: "2026-09-04T00:00:00.000Z" }),
    saveDraft: vi.fn().mockImplementation(async (_storeId, expectedRevision, nextDocument) => ({ storeId: "store-demo", revision: expectedRevision + 1, document: nextDocument, updatedAt: "2026-09-04T00:00:01.000Z" })),
    publish: vi.fn().mockResolvedValue({ id: "pub-1", storeId: "store-demo", sourceRevision: 4, document, publishedAt: "2026-09-04T00:00:02.000Z" }),
    getPublic: vi.fn(), listCatalog: vi.fn().mockResolvedValue({ products: [], collections: [] }), uploadMedia: vi.fn(), deleteMedia: vi.fn(),
  };
}

it("loads the full home-page editor shell", async () => {
  renderPage();

  expect(await screen.findByRole("heading", { name: "Home page" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Hero section" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Publish" })).toBeVisible();
  expect(await screen.findByTestId("preview-viewport")).toHaveAttribute("data-viewport", "desktop");
});

it("switches the public preview to mobile width", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Mobile preview" }));

  expect(screen.getByTestId("preview-viewport")).toHaveAttribute("data-viewport", "mobile");
});

it("links merchant navigation to Store Design", () => {
  render(<AdminNav />);

  expect(screen.getByRole("link", { name: "Store Design" })).toHaveAttribute("href", "/admin/store-design");
});

it("uses the editor API to save the draft before publishing", async () => {
  const user = userEvent.setup();
  const api = createApi();
  render(<ShopProvider><StoreDesignEditor api={api} /></ShopProvider>);

  await screen.findByRole("heading", { name: "Home page" });
  await user.click(screen.getByRole("button", { name: "Publish" }));

  await waitFor(() => expect(api.publish).toHaveBeenCalledWith("store-demo", 4));
  expect(api.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(api.publish.mock.invocationCallOrder[0]);
});
