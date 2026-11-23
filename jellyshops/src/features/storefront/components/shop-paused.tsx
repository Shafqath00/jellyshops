import { jellyshopHomeUrl } from "@jelly/storefront-schema";

/**
 * "This shop is temporarily unavailable": shown on every page of a shop that billing has paused (its trial ended or
 * its payment stopped). It never says why to shoppers; the owner sees the reason in their admin.
 */
export function ShopPaused() {
  return (
    <main className="store-missing">
      <h1>Back soon.</h1>
      <p>This shop is temporarily unavailable. If it is yours, sign in to your dashboard to open it again.</p>
      <a className="button button-primary" href={jellyshopHomeUrl()}>Go to Jellyshop</a>
    </main>
  );
}
