import type { MerchantOrderDetail } from "./api/types";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const ADDRESS_ORDER = ["name", "line1", "line2", "city", "region", "postalCode", "country"];

function addressLines(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const known = ADDRESS_ORDER.map((key) => record[key]).filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
  return known.length ? known : Object.values(record).filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
}

/** One packing slip: what to put in the box and where it goes. No prices, so it can travel with the parcel. */
export function packingSlipSection(detail: MerchantOrderDetail, storeName: string): string {
  const { order, items } = detail;
  const customer = order.customerSnapshot ?? {};
  const delivery = (order.deliverySnapshot ?? {}) as Record<string, unknown>;
  const address = addressLines(delivery.address ?? customer.address);
  const physical = items.filter((item) => (item.fulfillmentType ?? item.fulfilmentType) !== "DIGITAL");
  const rows = physical.map((item) => `<tr><td><strong>${escape(item.productTitleSnapshot ?? item.titleSnapshot)}</strong>${item.variantTitleSnapshot ? `<br><span>${escape(item.variantTitleSnapshot)}</span>` : ""}${(item.configurationSnapshot ?? []).map((selection) => `<br><span>${escape(selection.optionName)}: ${escape(selection.valueLabel)}</span>`).join("")}</td><td>${escape(item.skuSnapshot ?? "")}</td><td class="qty">${escape(item.quantity)}</td></tr>`).join("");
  return `<section class="slip">
<header><h1>${escape(storeName)}</h1><p>Packing slip · Order ${escape(order.number)} · ${escape(new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}</p></header>
<div class="cols"><div><h2>Ship to</h2><p>${escape(customer.name ?? "")}<br>${address.map(escape).join("<br>") || "No address recorded"}</p></div>
<div><h2>Contact</h2><p>${escape(customer.email ?? "")}${customer.phone ? `<br>${escape(customer.phone)}` : ""}</p></div></div>
<table><thead><tr><th>Item</th><th>SKU</th><th class="qty">Quantity</th></tr></thead><tbody>${rows || `<tr><td colspan="3">No items to ship</td></tr>`}</tbody></table>
${order.customerNote ? `<h2>Note from the customer</h2><p>${escape(order.customerNote)}</p>` : ""}
<footer>Thank you for shopping with ${escape(storeName)}.</footer></section>`;
}

/** A printable page holding one or more slips, each starting on a new sheet. */
export function packingSlipDocument(details: MerchantOrderDetail[], storeName: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Packing slips</title><style>
body{font:14px/1.5 system-ui,sans-serif;color:#111;margin:0}.slip{padding:32px;max-width:720px;margin:auto;page-break-after:always}.slip:last-child{page-break-after:auto}
h1{font-size:20px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#555;margin:20px 0 4px}header p{color:#555;margin:4px 0 0}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;vertical-align:top}
th{font-size:12px;color:#555}td span{color:#555;font-size:12px}.qty{text-align:right}footer{margin-top:28px;color:#555;font-size:12px}
</style></head><body>${details.map((detail) => packingSlipSection(detail, storeName)).join("")}</body></html>`;
}

/** Opens the slips in a new tab and starts printing. Returns false when a pop-up blocker stopped it. */
export function printPackingSlips(details: MerchantOrderDetail[], storeName: string): boolean {
  const page = window.open("", "_blank");
  if (!page) return false;
  page.document.open();
  page.document.write(packingSlipDocument(details, storeName));
  page.document.close();
  page.focus();
  page.print();
  return true;
}
