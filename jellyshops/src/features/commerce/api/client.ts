import type {
  CommerceAttemptInput,
  CommerceAttemptResult,
  MerchantOrderDetail,
  MerchantOrder,
  MerchantOrderListItem,
  MerchantOrderStatus,
  MerchantRefund,
  PreparedPayment,
  PublicOrderResult,
  StripeMerchantStatus,
  StripeOnboardingLink,
} from "./types";

interface CommerceClientOptions { baseUrl: string; fetch?: typeof fetch }

export function createCommerceApi({ baseUrl, fetch: fetcher = fetch }: CommerceClientOptions) {
  const origin = baseUrl.replace(/\/$/, "");
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(`${origin}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? "Commerce request failed");
    }
    return response.json() as Promise<T>;
  }
  return {
    createAttempt: (storeId: string, input: CommerceAttemptInput) => request<CommerceAttemptResult>(`/api/public/stores/${encodeURIComponent(storeId)}/checkout/attempts`, { method: "POST", body: JSON.stringify(input) }),
    preparePayment: (storeId: string, attemptId: string) => request<PreparedPayment>(`/api/public/stores/${encodeURIComponent(storeId)}/checkout/payment-intent`, { method: "POST", body: JSON.stringify({ attemptId }) }),
    getPublicOrder: (storeId: string, publicToken: string) => request<PublicOrderResult>(`/api/public/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(publicToken)}`),
  };
}
export type CommerceApi = ReturnType<typeof createCommerceApi>;

interface MerchantCommerceClientOptions extends CommerceClientOptions {
  token: string;
}

/**
 * Authenticated browser boundary for merchant-only order actions.
 * The token comes from the merchant-session adapter, never from local order data.
 */
export function createMerchantCommerceApi({ baseUrl, token, fetch: fetcher = fetch }: MerchantCommerceClientOptions) {
  const origin = baseUrl.replace(/\/$/, "");
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(`${origin}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? "Merchant commerce request failed");
    }
    return response.json() as Promise<T>;
  }
  const ordersPath = (storeId: string) => `/api/stores/${encodeURIComponent(storeId)}/orders`;
  const stripeConnectPath = (storeId: string) => `/api/stores/${encodeURIComponent(storeId)}/stripe-connect`;
  return {
    listOrders: async (storeId: string) => (await request<{ orders: MerchantOrderListItem[] }>(ordersPath(storeId))).orders,
    getOrder: (storeId: string, orderId: string) => request<MerchantOrderDetail>(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}`),
    transitionFulfilment: (storeId: string, orderId: string, status: MerchantOrderStatus) => request<MerchantOrder>(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}/fulfilment`, { method: "POST", body: JSON.stringify({ status }) }),
    requestFullRefund: (storeId: string, orderId: string) => request<MerchantRefund>(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}/refunds`, { method: "POST", body: JSON.stringify({}) }),
    getStripeStatus: (storeId: string) => request<StripeMerchantStatus>(`${stripeConnectPath(storeId)}/status`),
    createOnboardingLink: (storeId: string, input: { returnUrl: string; refreshUrl: string }) => request<StripeOnboardingLink>(`${stripeConnectPath(storeId)}/onboarding-link`, { method: "POST", body: JSON.stringify(input) }),
  };
}

export type MerchantCommerceApi = ReturnType<typeof createMerchantCommerceApi>;
