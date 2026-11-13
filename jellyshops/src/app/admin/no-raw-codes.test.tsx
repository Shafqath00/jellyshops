import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "./orders/page";
import ProductsPage from "./products/page";
import { expectNoRawCodes } from "@/test/raw-codes";


vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => ({ activeStore: { id: "store-demo", role: "OWNER", currency: "GBP" }, session: { access_token: "token" } }), authApiOrigin: () => "http://api.local" }));
const catalog = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/features/admin/api/catalog-api", () => ({ useAdminCatalog: () => ({ request: catalog.request, ready: true, storeId: "store-demo" }) }));
afterEach(() => { vi.unstubAllGlobals(); });

const statuses = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const payments = ["PENDING", "PROCESSING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

describe("admin lists show words, not codes", () => {
  it("orders list", async () => {
    const orders = statuses.map((status, index) => ({ id: `o${index}`, number: `JS-${index}`, status, paymentStatus: payments[index % payments.length], fulfilmentStatus: index % 2 ? "OUT_FOR_DELIVERY" : null, customerSnapshot: { name: "Asha" }, totalMinor: 1000, currency: "GBP", createdAt: "2026-11-01T10:00:00.000Z", items: [] }));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ orders, total: orders.length, page: 1, pageSize: 25, summary: { PENDING_PAYMENT: 1, PAID: 1 }, featureEnabled: true })))));
    render(<OrdersPage />);
    expect(await screen.findByText("JS-0")).toBeVisible();
    expectNoRawCodes();
    expect(screen.getByRole("tab", { name: /Waiting for payment/ })).toBeVisible();
  });

  it("products list", async () => {
    catalog.request.mockResolvedValue({ nodes: ["ACTIVE", "DRAFT", "ARCHIVED"].map((status, index) => ({ id: `p${index}`, title: `Product ${index}`, status, media: [], productType: null, vendor: null, variants: [{ id: `v${index}`, priceMinor: 100, quantity: 1, reserved: 0 }] })), nextCursor: null });
    render(<ProductsPage />);
    expect(await screen.findByText("Product 2")).toBeVisible();
    expectNoRawCodes();
  });
});
