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
  OrderListQuery, OrderListResult, OrderEditInput, OrderEditPreview,
} from "./types";
import type { Collection, Product, ProductOption } from "@/lib/domain";

export interface PublicCatalogVariant {
  id: string;
  title: string;
  sku: string | null;
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  costMinor?: number | null;
  unitPricing?: { totalAmount: number; totalUnit: string; baseAmount: number; baseUnit: string } | null;
  quantity: number | null;
  available: boolean;
  options?: Record<string, unknown>;
}

export interface PublicCatalogProduct {
  fulfillmentType?: "PHYSICAL" | "DIGITAL";
  id: string;
  storeId: string;
  handle: string;
  title: string;
  description: string;
  specifications?: Record<string, string>;
  productType: string | null;
  tags?: string[];
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  primaryCategoryId?: string | null;
  additionalCategoryIds?: string[];
  brandId?: string | null;
  collectionIds?: string[];
  options?: unknown[];
  inventoryOptionIds?: string[];
  media: Array<{ id: string; url: string; altText: string | null; position: number }>;
  variants: PublicCatalogVariant[];
  available: boolean;
}

export interface PublicCatalogResponse {
  nodes: PublicCatalogProduct[];
  nextCursor: string | null;
}

export interface PublicCatalogCollection {
  id: string;
  storeId: string;
  externalId: string | null;
  handle: string;
  title: string;
  description: string;
  productIds: string[];
}

export interface PublicCollectionsResponse {
  nodes: PublicCatalogCollection[];
  nextCursor: string | null;
}

export interface PublicStoreDetails {
  shippingMinor?: number;
  shippingCopy?: string;
  id: string;
  name: string;
  slug: string;
  currency: string;
  country: string;
}

export function catalogProductToStorefrontProduct(product: PublicCatalogProduct): Product {
  const image = [...product.media].sort((a, b) => a.position - b.position)[0];
  return {
    id: product.id,
    fulfillmentType: product.fulfillmentType ?? "PHYSICAL",
    storeId: product.storeId,
    name: product.title,
    slug: product.handle,
    description: product.description,
    specifications: product.specifications ?? {},
    category: product.productType ?? product.tags?.[0] ?? "Collection",
    imageUrl: image?.url ?? "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=85",
    published: product.status === undefined || product.status === "ACTIVE",
    archived: product.status === "ARCHIVED",
    primaryCategoryId: product.primaryCategoryId ?? undefined,
    additionalCategoryIds: product.additionalCategoryIds ?? [],
    brandId: product.brandId ?? undefined,
    collectionIds: product.collectionIds ?? [],
    options: (product.options ?? []) as ProductOption[],
    inventoryOptionIds: product.inventoryOptionIds ?? [],
    media: product.media.map((entry) => ({ id: entry.id, url: entry.url, altText: entry.altText ?? undefined })),
    featured: false,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.title,
      sku: variant.sku ?? "",
      priceMinor: variant.priceMinor,
      compareAtPriceMinor: variant.compareAtPriceMinor ?? undefined,
      costMinor: variant.costMinor ?? undefined,
      unitPricing: variant.unitPricing ?? undefined,
      stock: product.fulfillmentType === "DIGITAL" ? Number.MAX_SAFE_INTEGER : variant.quantity ?? (variant.available ? Number.MAX_SAFE_INTEGER : 0),
      available: product.fulfillmentType === "DIGITAL" || variant.available,
      options: variant.options as Record<string, string> | undefined,
    })),
  };
}

interface CommerceClientOptions { baseUrl: string; fetch?: typeof fetch; token?: string }

export function createCommerceApi({ baseUrl, token, fetch: fetcher = fetch }: CommerceClientOptions) {
  const origin = baseUrl.replace(/\/$/, "");
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(`${origin}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw Object.assign(new Error(body.error?.message ?? "Commerce request failed"), { status: response.status });
    }
    return response.json() as Promise<T>;
  }
  return {
    getPublicStore: (storeId: string) => request<{ store: PublicStoreDetails }>(`/api/public/stores/${encodeURIComponent(storeId)}`),
    getPublicStoreBySlug: (slug: string) => request<{ store: PublicStoreDetails }>(`/api/public/storefronts/${encodeURIComponent(slug)}`),
    getPublicCatalog: async (storeId: string) => {
      const response = await request<PublicCatalogResponse>(`/api/public/stores/${encodeURIComponent(storeId)}/catalog/products?limit=100`);
      return response.nodes.map(catalogProductToStorefrontProduct);
    },
    getPublicCollections: async (storeId: string): Promise<Collection[]> => {
      const nodes: PublicCatalogCollection[] = [];
      let cursor: string | null = null;
      do {
        const response: PublicCollectionsResponse = await request<PublicCollectionsResponse>(`/api/public/stores/${encodeURIComponent(storeId)}/catalog/collections?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        nodes.push(...response.nodes);
        cursor = response.nextCursor;
      } while (cursor);
      return nodes.map((collection) => ({
        id: collection.id,
        storeId: collection.storeId,
        name: collection.title,
        slug: collection.handle,
        ...(collection.description ? { description: collection.description } : {}),
      }));
    },
    createAttempt: (storeId: string, input: CommerceAttemptInput) => request<CommerceAttemptResult>(`/api/public/stores/${encodeURIComponent(storeId)}/checkout/attempts`, { method: "POST", body: JSON.stringify(input) }),
    preparePayment: (storeId: string, attemptId: string) => request<PreparedPayment>(`/api/public/stores/${encodeURIComponent(storeId)}/checkout/payment-intent`, { method: "POST", body: JSON.stringify({ attemptId }) }),
    getPublicOrder: (storeId: string, publicToken: string) => request<PublicOrderResult>(`/api/public/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(publicToken)}`),
    getOrderBalance: (storeId: string, publicToken: string) => request<{ revisionId: string; amountMinor: number; currency: string; status: string; clientSecret: string | null; connectedAccountId: string | null; expiresAt: string | null }>(`/api/public/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(publicToken)}/balance`),
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
  const orderPath = (storeId: string, orderId: string) => `${ordersPath(storeId)}/${encodeURIComponent(orderId)}`;
  const command = (storeId: string, orderId: string, action: string, input: unknown, method = "POST") => request<unknown>(`${orderPath(storeId, orderId)}/${action}`, { method, body: JSON.stringify(input) });
  return {
    queryOrders: (storeId: string, query: OrderListQuery = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
      return request<OrderListResult>(`${ordersPath(storeId)}${params.size ? `?${params}` : ""}`);
    },
    setOrderWorkspaceEnabled: (storeId: string, enabled: boolean) => request<{ enabled: boolean }>(`${ordersPath(storeId)}/settings`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
    listOrders: async (storeId: string) => (await request<{ orders: MerchantOrderListItem[] }>(ordersPath(storeId))).orders,
    getOrder: (storeId: string, orderId: string) => request<MerchantOrderDetail>(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}`),
    transitionFulfilment: (storeId: string, orderId: string, status: MerchantOrderStatus) => request<MerchantOrder>(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}/fulfilment`, { method: "POST", body: JSON.stringify({ status }) }),
    requestFullRefund: (storeId: string, orderId: string) => request<MerchantRefund>(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}/refunds`, { method: "POST", body: JSON.stringify({}) }),
    addOrderNote: (storeId: string, orderId: string, body: string) => command(storeId, orderId, "notes", { body }),
    updateOrderContact: (storeId: string, orderId: string, input: unknown) => command(storeId, orderId, "contact", input, "PATCH"),
    updateOrderTracking: (storeId: string, orderId: string, input: unknown) => command(storeId, orderId, "tracking", input, "PATCH"),
    cancelOrder: (storeId: string, orderId: string, input: unknown) => command(storeId, orderId, "cancel", input),
    previewOrderEdit: (storeId: string, orderId: string, input: OrderEditInput) => request<OrderEditPreview>(`${orderPath(storeId, orderId)}/edits/preview`, { method: "POST", body: JSON.stringify(input) }),
    commitOrderEdit: (storeId: string, orderId: string, input: OrderEditInput & { idempotencyKey: string }) => command(storeId, orderId, "edits", input),
    refundOrder: (storeId: string, orderId: string, input: unknown) => command(storeId, orderId, "refunds", input),
    fulfilOrder: (storeId: string, orderId: string, input: unknown) => command(storeId, orderId, "fulfilments", input),
    deliverFulfilment: (storeId: string, orderId: string, fulfilmentId: string, input: unknown) => command(storeId, orderId, `fulfilments/${encodeURIComponent(fulfilmentId)}/deliver`, input),
    markPacked: (storeId: string, orderId: string, input: { revision: number }) => command(storeId, orderId, "packed", input),
    markShipmentOutForDelivery: (storeId: string, orderId: string, fulfilmentId: string, input: { revision: number }) => command(storeId, orderId, `fulfilments/${encodeURIComponent(fulfilmentId)}/out-for-delivery`, input),
    setShipmentException: (storeId: string, orderId: string, fulfilmentId: string, input: { revision: number; exception: "DELAYED" | "DELIVERY_FAILED" | null }) => command(storeId, orderId, `fulfilments/${encodeURIComponent(fulfilmentId)}/exception`, input),
    returnOrder: (storeId: string, orderId: string, input: unknown) => command(storeId, orderId, "returns", input),
    receiveReturn: (storeId: string, orderId: string, returnId: string, input: unknown) => command(storeId, orderId, `returns/${encodeURIComponent(returnId)}/receive`, input),
    resendOrderNotification: (storeId: string, orderId: string, type: string) => command(storeId, orderId, "notifications/resend", { type }),
    listOrderNotifications: (storeId: string, orderId: string) => request<{ notifications: NonNullable<MerchantOrderDetail["notifications"]> }>(`/api/stores/${encodeURIComponent(storeId)}/order-notifications?orderId=${encodeURIComponent(orderId)}`),
    downloadInvoice: async (storeId: string, orderId: string, format: "pdf" | "html" = "pdf", revision?: number) => {
      const response = await fetcher(`${origin}${orderPath(storeId, orderId)}/invoice?format=${format}${revision ? `&revision=${revision}` : ""}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Unable to download invoice");
      return response.blob();
    },
    getStripeStatus: (storeId: string) => request<StripeMerchantStatus>(`${stripeConnectPath(storeId)}/status`),
    createOnboardingLink: (storeId: string, input: { returnUrl: string; refreshUrl: string }) => request<StripeOnboardingLink>(`${stripeConnectPath(storeId)}/onboarding-link`, { method: "POST", body: JSON.stringify(input) }),
  };
}

export type MerchantCommerceApi = ReturnType<typeof createMerchantCommerceApi>;
