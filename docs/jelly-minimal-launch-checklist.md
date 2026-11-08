# Jelly Minimal launch checklist

Use this before Jelly Minimal is offered to real merchants. The automated checks cover the theme itself. The end-to-end journey needs a staging merchant and the Stripe sandbox, so a person runs it by hand.

## Automated (run on every change)

| Check | Command (from `jellyshops/`) | Covers |
| --- | --- | --- |
| Unit and component tests | `npm test` | Sections, settings, editor, cart, checkout and account logic |
| Theme pages in a real browser | `JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/jelly-minimal-theme.spec.ts` | Home, collection, product, cart, search, information and 404 pages at 390, 768 and 1280 px: no horizontal overflow, no unnamed links or buttons, no page errors; cart totals and product size selection |
| Types, lint and build | `npm run typecheck && npm run lint && npm run build` | Whole frontend |
| Backend | `npm run typecheck && npm test && npm run build` (from `backend/`) | API, starter installation, checkout |

Review the theme visually at `/theme-preview/jelly-minimal` (Style guide, Home, Collection, Product, Cart, Search, Page and 404 tabs).

## Manual end-to-end journey (staging + Stripe sandbox)

Work in a fresh browser profile with a new test merchant. Tick each step and note any problem with a screenshot.

1. **Sign up** at `/signup` and confirm the email.
2. **Create a store** with a UK, US or Indian address.
3. **Choose Jelly Minimal** in Online Store → Templates and open the editor.
4. **Edit the home page.** Change the hero heading and image, reorder two sections, hide one, add a FAQ with two questions, and change the Buttons colour and Heading font in Theme settings. Check the preview at desktop, tablet and mobile. Undo and redo once.
5. **Edit the header and footer.** Upload a logo, centre it, and add footer text and a contact email.
6. **Leave the editor and come back.** The draft must still be there, and the live store must not show the changes yet.
7. **Add products.** Add one simple product and one with sizes, each with an image, price and stock.
8. **Publish.** The live store now shows the edits, the logo and both products.
9. **Shop as a customer** in a private window. Browse the collection, search, pick a size, add both products, change a quantity in the cart and remove one line.
10. **Check out** with Stripe test card `4242 4242 4242 4242`. The order confirmation page shows the items and the total.
11. **Merchant side.** The order appears in Orders with status Paid, and stock has gone down. Mark the order fulfilled, then refund it.
12. **Customer account.** Register with the checkout email, verify it, and check that Order history lists the order.
13. **Failure paths.** Try checkout with decline card `4000 0000 0000 0002` (the order must not be marked paid), an out-of-stock size, and an empty cart.
14. **Isolation.** A second test merchant must not see the first store's products, orders or draft.

## Known limits

- Stores installed before the Jelly Minimal redesign keep their saved colours and fonts. Re-apply the template, or update Theme settings, to adopt the new defaults.
- Product, collection and header photos in the starter come from Unsplash. Merchants replace them with their own images.
