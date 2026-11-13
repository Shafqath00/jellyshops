import { csvCell } from "@/lib/csv-cell";
import { statusLabel } from "@/components/admin/status";
import type { OrderListResult } from "@/features/commerce/api/types";

type OrderCsvRow = OrderListResult["orders"][number];



/** Builds a CSV of the selected orders in the browser; nothing is sent anywhere. */
export function ordersCsv(orders: OrderCsvRow[]): string {
  const header = ["Order", "Date", "Customer", "Email", "Items", "Payment", "Fulfilment", "Total", "Currency"];
  const lines = orders.map((order) => [
    order.number, order.createdAt, order.customerSnapshot.name, order.customerSnapshot.email,
    order.items?.map((item) => `${item.titleSnapshot} x ${item.quantity}`).join("; ") ?? "",
    statusLabel("payment", order.paymentStatus), statusLabel("fulfilment", order.fulfilmentStatus ?? order.status),
    (order.totalMinor / 100).toFixed(2), order.currency,
  ].map(csvCell).join(","));
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}

export function downloadOrdersCsv(orders: OrderCsvRow[]) {
  const url = URL.createObjectURL(new Blob([ordersCsv(orders)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `orders-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}
