/** Mirrors the server: the warning level used when a merchant has not chosen one for a variant. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

export type StockStatus = "untracked" | "out" | "low" | "in_stock";

/** Out and low are measured against what shoppers can still buy: on hand minus held by active checkouts. */
export function stockStatusOf(trackInventory: boolean, quantity: number | null, reserved: number, lowStockThreshold: number | null): StockStatus {
  if (!trackInventory || quantity === null) return "untracked";
  const available = Math.max(0, quantity - reserved);
  if (available <= 0) return "out";
  return available <= (lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD) ? "low" : "in_stock";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = { untracked: "Not tracked", out: "Out of stock", low: "Low stock", in_stock: "In stock" };
export const STOCK_STATUS_TONE: Record<StockStatus, "neutral" | "success" | "warning"> = { untracked: "neutral", out: "warning", low: "warning", in_stock: "success" };

export type InventoryAdjustmentReason = "initial" | "sale" | "restock" | "manual";
export const ADJUSTMENT_REASON_LABEL: Record<InventoryAdjustmentReason, string> = { initial: "Starting stock", sale: "Sold", restock: "Returned or restocked", manual: "Adjusted by hand" };
