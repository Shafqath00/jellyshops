export interface DemoSession { storeId: "store-sweet-bakes"; token: "jelly-demo-merchant" }

export function getDemoSession(): DemoSession | null {
  return process.env.NODE_ENV === "production" ? null : { storeId: "store-sweet-bakes", token: "jelly-demo-merchant" };
}
