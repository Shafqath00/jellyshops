export interface MerchantStore {
  id: string; name: string; slug: string; currency: string; country: string; role: string;
}

const fallbackMessage = "Could not load your stores. Check your connection and retry.";

export async function loadMerchant(apiOrigin: string, accessToken: string, signal?: AbortSignal): Promise<MerchantStore[]> {
  const response = await fetch(`${apiOrigin}/api/me`, {
    signal,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body
      && typeof body.error === "object" && body.error !== null && "message" in body.error
      && typeof body.error.message === "string"
      ? body.error.message
      : fallbackMessage;
    throw new Error(message);
  }

  const stores = typeof body === "object" && body !== null && "stores" in body ? body.stores : null;
  if (!Array.isArray(stores)) throw new Error("The server returned an invalid store list. Retry loading.");
  return stores as MerchantStore[];
}
