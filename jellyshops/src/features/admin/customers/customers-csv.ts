import { csvCell } from "@/lib/csv-cell";
import type { MerchantCustomer } from "@/features/admin/api/admin-api";

const cell = csvCell;

/** CSV of the chosen customers, built in the browser. Amounts are in the store currency's main unit. */
export function customersCsv(customers: MerchantCustomer[]): string {
  const header = ["First name", "Last name", "Name", "Email", "Phone", "Accepts email marketing", "Location", "Orders", "Amount spent", "Tags", "Note"];
  const lines = customers.map((customer) => [
    customer.firstName, customer.lastName, customer.name, customer.email, customer.phone, customer.acceptsEmailMarketing ? "Yes" : "No",
    customer.location, customer.orderCount, (customer.lifetimeSpendMinor / 100).toFixed(2), (customer.tags ?? []).join(", "), customer.note,
  ].map(cell).join(","));
  return [header.map(cell).join(","), ...lines].join("\r\n");
}

export function downloadCustomersCsv(customers: MerchantCustomer[]) {
  const url = URL.createObjectURL(new Blob([customersCsv(customers)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `customers-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}
