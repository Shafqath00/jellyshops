/**
 * Storefront password protection, as the frontend sees it. Shoppers keep an
 * access token in a cookie (set by `/api/storefront-access`); the backend checks
 * it, so no secret lives in the frontend.
 */
export interface AccessStatus { protected: boolean; unlocked: boolean; message: string }
export interface AccessSettings { enabled: boolean; hasPassword: boolean; message: string }

const origin = () => (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

export const accessCookieName = (storeId: string) => `jelly-access-${storeId.replace(/[^\w-]/g, "")}`;

/**
 * Whether the store asks for a password and whether this token unlocks it.
 * If the status can't be read (backend without this feature, network error) the
 * store stays open: the pages come from the same backend and would not load anyway.
 */
export async function loadAccessStatus(storeId: string, token: string | undefined, fetcher: typeof fetch = fetch): Promise<AccessStatus> {
  try {
    const response = await fetcher(`${origin()}/api/public/stores/${encodeURIComponent(storeId)}/storefront/access/status`, {
      cache: "no-store",
      headers: { Accept: "application/json", ...(token ? { "x-storefront-access": token } : {}) },
    });
    if (!response.ok) return { protected: false, unlocked: true, message: "" };
    const body = await response.json() as Partial<AccessStatus>;
    return { protected: body.protected === true, unlocked: body.unlocked !== false, message: typeof body.message === "string" ? body.message : "" };
  } catch {
    return { protected: false, unlocked: true, message: "" };
  }
}

/** The token for a correct password; throws a plain message otherwise. */
export async function requestAccessToken(storeId: string, password: string, fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher(`${origin()}/api/public/stores/${encodeURIComponent(storeId)}/storefront/access/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as { token?: string; error?: { message?: string } };
  if (!response.ok || typeof body.token !== "string") throw new Error(response.status === 429 ? "Too many tries. Wait a minute and try again." : body.error?.message ?? "That password isn't right.");
  return body.token;
}
