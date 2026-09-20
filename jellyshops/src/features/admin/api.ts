export interface AdminSummary {
  revenueMinor: number;
  orderCount: number;
  publishedProductCount: number;
  actionableOrders: Array<{ id: string; number: string; status: string; customerSnapshot: Record<string, unknown>; totalMinor: number; currency: string; createdAt: string }>;
  lowStock: Array<{ productId: string; variantId: string; title: string; sku: string | null; quantity: number }>;
}

export interface MerchantCustomer {
  id: string;
  name: string;
  email: string | null;
  orderCount: number;
  lifetimeSpendMinor: number;
  latestOrderAt: string | null;
}

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function createAdminApi({ baseUrl, token, fetch: fetcher = fetch }: { baseUrl: string; token: string; fetch?: typeof fetch }) {
  const origin = baseUrl.replace(/\/$/, "");
  async function request<T>(path: string): Promise<T> {
    const response = await fetcher(`${origin}${path}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new AdminApiError(body.error?.message ?? "Admin request failed", response.status);
    }
    return response.json() as Promise<T>;
  }
  return {
    getSummary: (storeId: string) => request<AdminSummary>(`/api/stores/${encodeURIComponent(storeId)}/admin-summary`),
    listCustomers: (storeId: string) => request<{ customers: MerchantCustomer[] }>(`/api/stores/${encodeURIComponent(storeId)}/customers`),
    getCustomer: (storeId: string, customerId: string) => request<{ customer: MerchantCustomer }>(`/api/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customerId)}`),
  };
}
