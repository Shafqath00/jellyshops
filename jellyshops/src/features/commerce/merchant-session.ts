export interface MerchantSession { storeId: string; token: string }

export function getMerchantSession(): MerchantSession | null {
  if (process.env.NODE_ENV === "production") return null;
  return { storeId: "store-demo", token: "jelly-demo-merchant" };
}
