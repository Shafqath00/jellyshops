# Design check on staging data (2026-11-07)

Roadmap phase 9, first pass. Run in the user's signed-in Chrome against the local frontend (port 3200) and a local backend (port 3001) connected to the staging database. The staging web address (Vercel) does not exist yet, so this is local code on staging data, not a deployed staging build.

Test store: "QA design check" (`qa-design-check`, GBP), created through the signed-in session, with 8 products (two discounted), one collection and no logo. Store "new" was not changed.

## What was checked

| Check | Result |
| --- | --- |
| Harbour preview in Store designs shows the store's own name | Pass |
| Install a design, open the editor, publish (Harbour, Jelly Minimal, Jelly Avenue, Resthaven, each on the same store) | Pass: install and publish returned success for all four |
| Live home page of each design: 8 real products, correct prices and compare-at prices, one image shape, no placeholders, no sideways scroll at 1280px | Pass for all four |
| Live product page (Jelly Minimal, Jelly Avenue, Resthaven, Harbour): gallery, brand, price, stock, related products | Pass |
| Live collection browser `/shop` (Minimal): 8 products, search, sort, filters | Pass |
| Bag: add to cart, quantities, subtotal | Pass (Harbour) |
| Checkout page: details form, address, order summary, Stripe frame loads | Pass |
| Empty store (before products): helpful hint instead of empty grids | Pass |
| Phone (390px) and tablet (820px), Resthaven home: no sideways scroll, 2 / 4 products per row | Pass; 16 / 20 small tap targets, the known baseline |
| Editor Theme styles panel on Jelly Minimal: apply Sage, preview and save, Undo | Pass |

## Findings

1. **Fixed:** on a store that had never changed its theme settings, the Theme styles panel did not mark the theme's first style as current (the saved settings are empty; the check ignored the theme's defaults). It now compares with the theme's resolved settings. Test added.
2. **Not a bug, but worth knowing:** the starter's "Collection list" shows the starter's placeholder collections (New arrivals, Accessories, …) that all link to the shop, not the merchant's own collections, until the merchant edits them.
3. **Payment cannot be completed on a new store:** checkout shows "Merchant cannot accept payments at this time." because no Stripe Connect account is connected to the test store. The message is plain and the page stays usable. A sandbox payment needs a connected store (store "new" shows Payments complete) or the Stripe onboarding for the test store; neither was done.
4. **Backend CORS:** the backend only allows the production web address, so a local page cannot call it. The check ran with `CORS_ORIGINS` set for the session (the `.env` file was not changed).
5. Screenshots time out in this Chrome, so everything was checked through page content, not images.

## Not checked

- Logo upload and the logo in the header and footer.
- A real card payment and the order confirmation page.
- Live versus preview at three widths for every design (structure was compared for desktop; phone and tablet only for Resthaven's home page).
- Account, wishlist and information pages on the live store.
- The deployed staging backend (it has not been redeployed with this session's routes).

## Cleanup

The test store, its draft, publications, products and collection are still on staging. Deleting a store that has a publication means switching off the publication guard inside one transaction (as in earlier checks), so it needs the owner's approval.
