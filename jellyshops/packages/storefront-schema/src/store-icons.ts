/**
 * Small line icons merchants can pick for trust points (scrolling strip, header trust row).
 * The registry offers these names in a select; the renderer draws each one.
 */
export const STORE_ICON_NAMES = [
  "check", "truck", "shield", "calendar", "moon", "home", "card", "percent", "star", "phone", "leaf", "gift", "return", "palette", "tag", "clock",
] as const;

export type StoreIconName = typeof STORE_ICON_NAMES[number];

/** Merchant-facing names, in the same order. */
export const STORE_ICON_LABELS: Record<StoreIconName, string> = {
  check: "Tick", truck: "Delivery van", shield: "Shield (warranty)", calendar: "Calendar", moon: "Moon (sleep trial)", home: "House",
  card: "Payment card", percent: "Percent (finance)", star: "Star", phone: "Phone", leaf: "Leaf", gift: "Gift", return: "Return arrow",
  palette: "Palette (swatches)", tag: "Price tag", clock: "Clock",
};

export function isStoreIconName(value: unknown): value is StoreIconName {
  return typeof value === "string" && (STORE_ICON_NAMES as readonly string[]).includes(value);
}
