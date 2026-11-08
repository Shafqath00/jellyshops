export interface AdminSummary {
  timezone?: string;
  setup?: { details: boolean; products: boolean; publication: boolean; shipping: boolean; payments: boolean };
  revenueMinor: number;
  orderCount: number;
  publishedProductCount: number;
  actionableOrders: Array<{ id: string; number: string; status: string; customerSnapshot: Record<string, unknown>; totalMinor: number; currency: string; createdAt: string }>;
  lowStock: Array<{ productId: string; variantId: string; title: string; variantTitle?: string | null; sku: string | null; available?: number; quantity: number }>;
}

export type SalesPeriod = 1 | 7 | 30 | 90;
export interface SalesFigures { revenueMinor: number; paidOrders: number; averageOrderMinor: number }
export interface AdminSales {
  days: SalesPeriod;
  timezone: string;
  current: SalesFigures;
  previous: SalesFigures;
  daily: Array<{ date: string; revenueMinor: number; paidOrders: number }>;
}

export interface CustomerAddress { line1?: string; line2?: string; city?: string; region?: string; postalCode?: string; country?: string }
export interface MerchantCustomer {
  id: string;
  name: string;
  email: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  note?: string;
  tags?: string[];
  address?: CustomerAddress | null;
  location?: string | null;
  acceptsEmailMarketing?: boolean;
  /** Orders that were not cancelled. */
  orderCount: number;
  lifetimeSpendMinor: number;
  latestOrderAt: string | null;
  createdAt?: string | null;
  revision?: number;
}
export interface CustomerOrder { id: string; number: string; status: string; totalMinor: number; currency: string; createdAt: string; paymentStatus?: string | null }
export interface MerchantCustomerDetail extends MerchantCustomer { orders: CustomerOrder[] }
export interface CustomerInput { email?: string; firstName?: string; lastName?: string; phone?: string; note?: string; tags?: string[]; address?: CustomerAddress | null; acceptsEmailMarketing?: boolean; revision?: number }

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function createAdminApi({ baseUrl, token, fetch: fetcher = fetch }: { baseUrl: string; token: string; fetch?: typeof fetch }) {
  const origin = baseUrl.replace(/\/$/, "");
  async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetcher(`${origin}${path}`, { method: init.method ?? "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new AdminApiError(body.error?.message ?? "Admin request failed", response.status);
    }
    return response.json() as Promise<T>;
  }
  return {
    getSummary: (storeId: string) => request<AdminSummary>(`/api/stores/${encodeURIComponent(storeId)}/admin-summary`),
    getSales: (storeId: string, days: SalesPeriod) => request<AdminSales>(`/api/stores/${encodeURIComponent(storeId)}/admin-summary/sales?days=${days}`),
    listCustomers: (storeId: string) => request<{ customers: MerchantCustomer[] }>(`/api/stores/${encodeURIComponent(storeId)}/customers`),
    getCustomer: (storeId: string, customerId: string) => request<{ customer: MerchantCustomerDetail }>(`/api/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customerId)}`),
    createCustomer: (storeId: string, input: CustomerInput & { email: string }) => request<{ customer: MerchantCustomerDetail }>(`/api/stores/${encodeURIComponent(storeId)}/customers`, { method: "POST", body: input }),
    updateCustomer: (storeId: string, customerId: string, input: CustomerInput) => request<{ customer: MerchantCustomerDetail }>(`/api/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customerId)}`, { method: "PATCH", body: input }),
    setOrderTags: (storeId: string, orderId: string, tags: string[]) => request<{ tags: string[] }>(`/api/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}/tags`, { method: "PUT", body: { tags } }),
  };
}
