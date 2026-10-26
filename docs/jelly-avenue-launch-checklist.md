# Jelly Avenue launch checklist

Use this before Jelly Avenue is offered to real merchants. The automated checks cover the theme itself. The end-to-end journey needs a staging merchant and the Stripe sandbox, so a person runs it by hand. It follows the same shape as the [Jelly Minimal checklist](jelly-minimal-launch-checklist.md).

## Automated (run on every change)

| Check | Command (from `jellyshops/`) | Covers |
| --- | --- | --- |
| Unit and component tests | `npm test` | Sections (slideshow, product tabs, stock counter, footer columns, header overlay), editor section limits, stylesheet scoping |
| Theme pages in a real browser | `JELLY_E2E_FRONTEND_PORT=3200 npx playwright test e2e/jelly-avenue-theme.spec.ts` | Home, collection, product, cart, search, information and 404 pages at 390, 768 and 1280 px: no horizontal overflow, no unnamed links or buttons, no page errors; slideshow arrows, cart totals, product size selection, product information tabs |
| Minimal theme still works | `JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/jelly-minimal-theme.spec.ts` | Shared sections and the shared stylesheet base |
| Types, lint and build | `npm run typecheck && npm run lint && npm run build` | Whole frontend |
| Backend | `npm run typecheck && npm test && npm run build` (from `backend/`) | API, starter installation, checkout |

Review the theme visually at `/theme-preview/jelly-avenue` (Style guide, Home, Collection, Product, Cart, Search, Page and 404 tabs).

## Accessibility

Checked against WCAG 2.1 AA:

- **Text contrast.** Body and soft text reach 4.5:1 on white and on the soft-grey panels (cart totals, checkout summary). The soft-text default is `#666b70`; merchants who pick a lighter colour in Theme settings take on that responsibility.
- **Text on images.** Overlay text uses a darkening overlay (the merchant sets its strength). Check any new photo with the overlay at its default before publishing.
- **Keyboard.** Product tabs use arrow keys; the slideshow controls are buttons with names; the header menu is a native disclosure.
- **Motion.** Slideshow autoplay and image zoom turn off for visitors who ask for reduced motion.
- **Touch targets.** Links and controls are at least 24 px tall, and header buttons 44 px.

## Manual end-to-end journey (staging + Stripe sandbox)

Work in a fresh browser profile with a new test merchant. Tick each step and note any problem with a screenshot.

1. **Sign up** and confirm the email.
2. **Create a store** with a UK, US or Indian address.
3. **Choose Jelly Avenue** in Online Store → Templates and open the editor.
4. **Edit the home page.** Change the slides, reorder two sections, hide one, change the featured tabs to two of the merchant's collections, and change the Buttons colour and Heading font in Theme settings. Check the preview at desktop, tablet and mobile. Undo and redo once.
5. **Check the editor's new sections.** Add a slide (up to six), a product tab (up to four), an information tab on the product page, and the stock counter. Try to add a seventh slide: the editor must refuse it.
6. **Edit the header and footer.** Turn on "show header over the first image", upload a light logo for the overlay, add footer link columns and turn on the newsletter.
7. **Leave the editor and come back.** The draft must still be there, and the live store must not show the changes yet.
8. **Add products.** Add one simple product and one with sizes, each with two photos, a price and stock. Add the information tabs (materials, shipping and returns) to the product page.
9. **Publish.** The live store shows the slideshow, tabs, footer columns and both products.
10. **Shop as a customer** in a private window. Browse the collection (try the Filters panel and the larger-image toggle), search, open the product, pick a size, check "Only N left" when stock is low, add both products, change a quantity and remove one line.
11. **Check out** with Stripe test card `4242 4242 4242 4242`. The order confirmation page shows the items and the total.
12. **Merchant side.** The order appears in Orders with status Paid, and stock has gone down. Mark the order fulfilled, then refund it.
13. **Customer account.** Register with the checkout email, verify it, and check that Orders lists the order.
14. **Failure paths.** Try checkout with decline card `4000 0000 0000 0002` (the order must not be marked paid), an out-of-stock size, and an empty cart.
15. **Isolation.** A second test merchant must not see the first store's products, orders or draft.

## Known limits

- **No slide-out cart.** The bag icon opens the cart page. A drawer is planned once the cart work is committed.
- **Colour swatches** on product options are not built.
- **Order confirmation** has been reviewed only with the Jelly Minimal styles it reuses; check it in the staging journey.
- **Merchant photos.** The starter uses Unsplash photos. A store with no collections shows placeholder tiles.
- **Stores that install Avenue later** get its defaults; stores already on Jelly Minimal keep their colours and fonts.
