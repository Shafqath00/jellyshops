import { expect } from "vitest";

/** Internal codes such as PENDING_PAYMENT or low_stock must never reach the merchant. */
const RAW_CODE = /\b(?:[A-Z]{2,}_[A-Z_]{2,}|[a-z]{2,}_[a-z_]{2,})\b/;

/** Everything a merchant can read in `root`: text, option labels, placeholders and accessible names. */
export function visibleText(root: HTMLElement): string {
  const attributes = [...root.querySelectorAll<HTMLElement>("[aria-label],[placeholder],[title]")]
    .flatMap((element) => [element.getAttribute("aria-label"), element.getAttribute("placeholder"), element.getAttribute("title")]);
  return [root.textContent ?? "", ...[...root.querySelectorAll("option")].map((option) => option.textContent ?? ""), ...attributes].filter(Boolean).join(" ");
}

/** Fails when the rendered page shows an API code. Call it once the page has its data. */
export function expectNoRawCodes(root: HTMLElement = document.body) {
  expect(visibleText(root).match(RAW_CODE)?.[0] ?? "").toBe("");
}
