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

/** A small footer with the policy links. */
export function CheckoutFooter({ store }: { store: ChromeStore }) {
  const links = [["Returns", "returns"], ["Shipping", "shipping"], ["Privacy", "privacy"], ["Terms", "terms"]] as const;
  return (
    <footer className="jelly-checkout-chrome jelly-checkout-chrome--footer">
      <nav aria-label="Shop policies">
        <ul>{links.map(([label, handle]) => <li key={handle}><Link href={storePath(store.slug, `/pages/${handle}`)}>{label}</Link></li>)}</ul>
      </nav>
    </footer>
  );
}
