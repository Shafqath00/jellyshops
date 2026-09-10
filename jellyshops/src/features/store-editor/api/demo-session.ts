export interface DemoSession { storeId: "store-demo"; token: "jelly-demo-merchant" }

export function getDemoSession(): DemoSession | null {
  return process.env.NODE_ENV === "production" ? null : { storeId: "store-demo", token: "jelly-demo-merchant" };
}
