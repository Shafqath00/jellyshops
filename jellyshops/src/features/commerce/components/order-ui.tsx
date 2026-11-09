export const orderStatuses = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;
export const orderLabel = (value?: string | null) => value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
export const orderMoney = (minor: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);
export function OrderBadge({ value }: {
    value?: string | null;
}) {
    const tone = ["PAID", "DELIVERED", "SUCCEEDED", "APPLIED", "RECEIVED", "SUCCESS"].includes(value ?? "") ? "success" : ["FAILED", "CANCELLED", "UNCERTAIN", "LOST"].includes(value ?? "") ? "critical" : ["PENDING", "PROCESSING", "REQUESTED", "NEEDS_RESPONSE", "WARNING_NEEDS_RESPONSE"].includes(value ?? "") ? "warning" : "neutral";
    return <span className={`jk-badge jk-tone-${tone}`}><span className="jk-badge-dot" aria-hidden="true" />{orderLabel(value)}</span>;
}
/** Admin kit classes (app/admin/admin-kit.css), shared by the order list and order page. */
export const orderInputClass = "jk-input";
export const orderButtonClass = "jk-button";
export const orderPanelClass = "jk-card";
