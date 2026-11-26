import Link from "next/link";
import Image from "next/image";
import { storePath } from "@jelly/storefront-schema";

interface ChromeStore { name: string; slug: string; logoUrl?: string | null }

/** Logo only: no menus or search, so nothing pulls shoppers away from paying. */
export function CheckoutHeader({ store }: { store: ChromeStore }) {
  return (
    <header className="jelly-checkout-chrome jelly-checkout-chrome--header">
      <Link href={storePath(store.slug)} className="jelly-checkout-chrome__brand" aria-label={`${store.name}, back to the shop`}>
        {store.logoUrl ? <Image src={store.logoUrl} alt="" width={160} height={40} unoptimized /> : null}
        <span>{store.name}</span>
      </Link>
    </header>
  );
}

const FALLBACK_LINKS = [["Returns", "returns"], ["Shipping", "shipping"], ["Privacy", "privacy"], ["Terms", "terms"]] as const;

/**
 * A small footer with the policy links: the published policy pages the merchant chose (Settings > Store preferences >
 * Policies) when known, otherwise the starter's usual addresses.
 */
export function CheckoutFooter({ store, policies }: { store: ChromeStore; policies?: Array<{ label: string; href: string }> | null }) {
  const links = policies ?? FALLBACK_LINKS.map(([label, handle]) => ({ label, href: storePath(store.slug, `/pages/${handle}`) }));
  if (!links.length) return null;
  return (
    <footer className="jelly-checkout-chrome jelly-checkout-chrome--footer">
      <nav aria-label="Shop policies">
        <ul>{links.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
      </nav>
    </footer>
  );
}
