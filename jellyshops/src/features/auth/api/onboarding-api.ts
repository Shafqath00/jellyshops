import type { MerchantStore } from "./merchant-api";

export const setupSteps = ["profile", "store", "branding", "business", "products", "review"] as const;
export type SetupStep = typeof setupSteps[number];
export type SetupImageKind = "profile" | "logo";
/** A store design id (any installable starter pack; the backend checks it). */
export type SetupTheme = string;
export const sellingChannels = ["starting", "own-website", "marketplace", "social", "in-person", "wholesale"] as const;
export type SellingChannel = typeof sellingChannels[number];
export type SetupMarket = "IN" | "GB" | "US";

export const markets = {
  IN: { label: "India", currency: "INR" },
  GB: { label: "United Kingdom", currency: "GBP" },
  US: { label: "United States", currency: "USD" },
};

export interface SetupAnswers {
  fullName?: string;
  bio?: string;
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  theme?: SetupTheme;
  country?: SetupMarket | "";
  businessType?: string;
  contactEmail?: string;
  timezone?: string;
  sellingChannels?: SellingChannel[];
  productCategories?: string[];
  product?: { title?: string; priceMinor?: number; stock?: number } | null;
}

export interface SetupDraft {
  revision: number;
  step: SetupStep;
  answers: SetupAnswers;
  store: MerchantStore | null;
  consentRequired: boolean;
  images: Record<SetupImageKind, boolean>;
}

export interface MerchantPolicies {
  termsUrl: string;
  privacyUrl: string;
  version: string;
}

export interface AccountProfile {
  fullName: string;
  bio: string;
  email: string;
  hasImage: boolean;
}

export class SetupRequestError extends Error {
  constructor(message: string, readonly code: string | undefined, readonly status: number) {
    super(message);
  }
}

type SetupApiOptions = Omit<RequestInit, "body"> & { body?: object; response?: "blob" };

export async function setupRequest<T>(apiOrigin: string, path = "", token?: string, options: SetupApiOptions = {}): Promise<T> {
  const { response: responseKind, body, ...init } = options;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body && !(body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${apiOrigin}/api/onboarding${path}`, {
    ...init,
    headers,
    cache: "no-store",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
    throw new SetupRequestError(body?.error?.message ?? "Could not connect to store setup. Try again.", body?.error?.code, response.status);
  }
  if (responseKind === "blob") return await response.blob() as T;
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
