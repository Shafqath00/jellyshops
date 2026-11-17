import type { CommerceDataProvider } from "@jelly/storefront-renderer";

const origin = () => process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

/**
 * Email sign-up and contact messages for the store's sections: page sections, and the header, footer and overlay
 * groups drawn by the storefront frame (a pop-up's sign-up form). Contact messages land in Customers > Messages.
 */
export function engagementActions(storeId: string | undefined): Pick<CommerceDataProvider, "subscribeNewsletter" | "sendContactMessage"> {
  if (!storeId) return {};
  return {
    async subscribeNewsletter(email, source) {
      const response = await fetch(`${origin()}/api/public/stores/${encodeURIComponent(storeId)}/engagement/newsletter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, source, consent: true }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error?.message ?? "Unable to subscribe. Please retry."); }
    },
    async sendContactMessage(message) {
      const response = await fetch(`${origin()}/api/public/stores/${encodeURIComponent(storeId)}/engagement/contact`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(message) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error?.message ?? "We couldn’t send your message. Please try again."); }
    },
  };
}
