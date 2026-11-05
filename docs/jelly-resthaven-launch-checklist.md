# Resthaven launch checklist

Resthaven (`jelly-resthaven`) is the bed and mattress showroom theme ([plan](plans/bed-showroom-theme.md)). Use this
before offering it to real merchants. The automated checks cover the theme itself. The end-to-end journey needs a
staging merchant and the Stripe sandbox, so a person runs it by hand. Same shape as the
[Jelly Avenue checklist](jelly-avenue-launch-checklist.md).

## Automated (run on every change)

| Check | Command (from `jellyshops/`) | Covers |
| --- | --- | --- |
| Unit and component tests | `npm test` | Trust badges and scrolling strip, search-bar header, rating, photo gallery, Read more, card savings, option tiles and tabs, sale label, finance line, add to basket bar; Resthaven conformance suite (every template renders, axe without contrast, safe links) |
| Theme pages in a real browser | `JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/jelly-resthaven-theme.spec.ts` | Home, collection, product, cart, search, information and 404 at 390, 768 and 1280 px: no horizontal overflow, no unnamed links or buttons, no page errors; **axe WCAG 2.1 A/AA including colour contrast** on every page; Beds dropdown and store links, readable footer with help links, "% off" label and the add to basket bar, cart totals |
| Other themes still work | `JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/jelly-minimal-theme.spec.ts e2e/jelly-avenue-theme.spec.ts` | Shared sections and stylesheet base |
| Theme folder | `node scripts/validate-theme.mjs jellyshops/packages/storefront-themes/src/themes/jelly-resthaven` (from the repo root) | `theme.json` and `starter.json` against the platform rules |
| Types, lint and build | `npm run typecheck && npm run lint && npm run build` | Whole frontend |
| Backend | `npm run typecheck && npm test && npm run build` (from `backend/`) | API, starter installation (including the theme's own main menu), menus with store paths |

After editing `storefront-themes/src/themes/jelly-resthaven/theme.css`, run `node scripts/generate-resthaven-styles.mjs`
(writes `jellyshops/src/app/themes/jelly-resthaven.css`). After changing the starter or the shared packages, repack the
backend copies (`node scripts/prepare-shared-packages.mjs`, then reinstall `@jelly` in `backend/`).

Review the theme visually at `/theme-preview/jelly-resthaven`, or with the theme tool:
`node jellyshops/packages/theme-cli/bin/jelly-theme.mjs dev jellyshops/packages/storefront-themes/src/themes/jelly-resthaven`.

## Accessibility

Checked against WCAG 2.1 AA by axe in a real browser (contrast included) on every page:

- **Colours.** Plum `#7d285d` with white text (footer, scrolling strip, buttons) and charcoal `#353431` on linen
  `#f2e8e0` pass. Merchants who change colours in Theme settings take on the contrast.
- **Keyboard.** Option tabs use arrow keys, Home and End; the Beds dropdown is a button; the scrolling strip pauses on
  focus and its second copy is hidden from screen readers; "Choose options" in the bar opens the first unanswered option.
- **Motion.** The scrolling strip and the bar's slide-in stop for visitors who ask for reduced motion.
- **Landmarks.** The header search is named "Search the store" so the search page has no duplicate search landmark.

## Manual end-to-end journey (staging + Stripe sandbox)

Work in a fresh browser profile with a new test merchant.

1. **Create a store** and choose Resthaven in Store designs. The main menu must be Beds (Divan, Ottoman, Upholstered),
   Mattresses, Headboards, Shop all, Help.
2. **Editor.** Check the home page order (trust row, hero, categories, products, scrolling strip, story, rating, photo
   gallery, how it works, second story, benefits, FAQ, newsletter). Enter a rating and review count, add two gallery
   photos, change a trust point. Check desktop, tablet and phone previews.
3. **Products.** Add a bed with Colour (colour swatches), Size and Storage options, a compare-at price and
   specifications (dimensions). Tag it `label:More colours`. Turn on Theme settings > Product cards > Savings.
4. **Product page.** Options show as tabs with tiles; "% off" shows by the price; scrolling down shows the add to basket
   bar. Turn on the finance line (e.g. 12 months) only if the store offers finance.
5. **Collection.** Make a collection with a long description: it shows two lines and Read more. Point the menu's bed
   links at real collections in Navigation.
6. **Publish** and repeat 4-5 as a shopper in a private window; footer links (Delivery, Returns, About us) open the
   store's pages.
7. **Check out** with Stripe test card `4242 4242 4242 4242`; then the order, account and failure paths as in the
   Avenue checklist (steps 12-15).

## Known limits

- **Account, checkout and order pages** were styled (fields, buttons, headings) but not viewed in a browser yet; check
  them in the staging journey.
- **Add-ons** (assembly and similar extras on the product page) are not built: they change the cart and orders.
- **Pictures.** The starter uses the theme's one bedroom photo everywhere; merchants replace it.
- **Rating and gallery** stay hidden on the live store until the merchant enters a rating or adds photos (nothing made
  up). Trust points make no delivery, trial or warranty promises; merchants add their own.
- **Stores that installed Resthaven before 2026-11-05** keep their old starter content (the theme's id and version are
  unchanged); they get the new styles, including the readable footer.
