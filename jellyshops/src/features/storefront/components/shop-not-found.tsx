import { storeLinkSettings } from "@jelly/storefront-schema";

/** The Jellyshop home page: the main address on subdomain deployments, "/" otherwise. */
function homeAddress(): string {
  const { mode, rootDomain } = storeLinkSettings();
  if (mode !== "subdomain") return "/";
  const local = /^(localhost|127.0.0.1)(:|$)/.test(rootDomain);
  return `${local ? "http" : "https"}://${rootDomain}`;
}

/**
 * "There's no shop here": unknown shop addresses, reserved names and unknown hosts. It never says whether a shop
 * exists or why an address is unavailable.
 */
export function ShopNotFound() {
  return (
    <main className="store-missing">
      <span>404</span>
      <h1>There&apos;s no shop here.</h1>
      <p>Check the address and try again. Shop owners can find their shop from their dashboard.</p>
      <a className="button button-primary" href={homeAddress()}>Go to Jellyshop</a>
    </main>
  );
}
