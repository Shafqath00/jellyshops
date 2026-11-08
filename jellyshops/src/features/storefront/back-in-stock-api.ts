/** Asks the shop to email this shopper once when the sold-out variant can be bought again. */
export async function requestBackInStock(storeId: string, variantId: string, email: string, website?: string, fetcher: typeof fetch = fetch): Promise<{ ok: boolean; message?: string }> {
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  const response = await fetcher(`${origin}/api/public/stores/${encodeURIComponent(storeId)}/back-in-stock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, email, ...(website ? { website } : {}) }) });
  if (response.ok) return { ok: true };
  const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
  return { ok: false, message: data.error?.message };
}
