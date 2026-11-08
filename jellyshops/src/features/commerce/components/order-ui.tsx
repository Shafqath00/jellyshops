export const orderStatuses = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;
export const orderLabel = (value?: string | null) => value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
export const orderMoney = (minor: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);
export function OrderBadge({ value }: {
    value?: string | null;
}) { return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${["PAID", "DELIVERED", "SUCCEEDED"].includes(value ?? "") ? "bg-emerald-50 text-emerald-800" : ["FAILED", "CANCELLED"].includes(value ?? "") ? "bg-red-50 text-red-800" : "bg-muted text-foreground"}`}>{orderLabel(value)}</span>; }
export const orderInputClass = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
export const orderButtonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
export const orderPanelClass = "rounded-xl border border-border bg-card shadow-sm";
