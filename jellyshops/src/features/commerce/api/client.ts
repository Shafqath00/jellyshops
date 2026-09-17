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
import type { Product } from "@/lib/domain";

export interface PublicCatalogVariant {
  id: string;
  title: string;
  sku: string | null;
  priceMinor: number;
  quantity: number | null;
  available: boolean;
}

export interface PublicCatalogProduct {
  id: string;
  storeId: string;
  handle: string;
  title: string;
  description: string;
  productType: string | null;
  tags: string[];
  media: Array<{ id: string; url: string; altText: string | null; position: number }>;
  variants: PublicCatalogVariant[];
  available: boolean;
}

export interface PublicCatalogResponse {
  nodes: PublicCatalogProduct[];
  nextCursor: string | null;
}

export function catalogProductToStorefrontProduct(product: PublicCatalogProduct): Product {
  const image = [...product.media].sort((a, b) => a.position - b.position)[0];
  return {
    id: product.id,
    storeId: product.storeId,
    name: product.title,
    slug: product.handle,
    description: product.description,
    category: product.productType ?? product.tags[0] ?? "Collection",
    imageUrl: image?.url ?? "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=85",
    published: true,
    archived: false,
    featured: false,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.title,
      sku: variant.sku ?? "",
      priceMinor: variant.priceMinor,
      stock: variant.quantity ?? (variant.available ? Number.MAX_SAFE_INTEGER : 0),
    })),
  };
}

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
    getPublicCatalog: async (storeId: string) => {
      const response = await request<PublicCatalogResponse>(`/api/public/stores/${encodeURIComponent(storeId)}/catalog/products?limit=100`);
      return response.nodes.map(catalogProductToStorefrontProduct);
    },
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
