import type { CommerceAttemptInput, CommerceAttemptResult, PreparedPayment, PublicOrderResult } from "./types";

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
