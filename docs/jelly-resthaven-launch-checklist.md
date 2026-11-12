# Resthaven launch checklist

Resthaven (`jelly-resthaven`) is the bed and mattress showroom theme ([showroom plan](plans/bed-showroom-theme.md),
[redesign plan](plans/resthaven-redesign.md), redesigned 2026-11-11). Use this
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
| Design lint (all themes, tidy and messy data) | `npx playwright test e2e/design-lint.spec.ts` | Edges, tap targets, title sizes, heading counts, overflow. Resthaven must have no findings. Run the whole file: a single theme skips the baseline comparison |
| Types, lint and build | `npm run typecheck && npm run lint && npm run build` | Whole frontend |
| Backend | `npm run typecheck && npm test && npm run build` (from `backend/`) | API, starter installation (including the theme's own main menu), menus with store paths |

After editing `storefront-themes/src/themes/jelly-resthaven/theme.css`, run `node scripts/generate-theme-assets.mjs jelly-resthaven`
(writes `jellyshops/src/app/themes/jelly-resthaven.css`). After changing the starter or the shared packages, repack the
backend copies (`node scripts/prepare-shared-packages.mjs`, then reinstall `@jelly` in `backend/`).

Review the theme visually at `/theme-preview/jelly-resthaven`, or with the theme tool:
`node jellyshops/packages/theme-cli/bin/jelly-theme.mjs dev jellyshops/packages/storefront-themes/src/themes/jelly-resthaven`.

## Accessibility

Checked against WCAG 2.1 AA by axe in a real browser (contrast included) on every page:

- **Colours (default "Midnight oat").** Midnight `#1D2333` on oat `#F7F3EE` (14.2:1), brass `#7E5F35` on oat (5.3:1),
  muted `#5E6270` on oat (5.5:1) and clay `#A3422C` on white (6.2:1) pass. The four theme styles keep text and button
  pairs at 4.5:1 or better (`theme-styles.test.ts`). Merchants who change colours take on the contrast.
- **Keyboard.** Option tiles, fold-out rows, the large menu (arrow button) and the slide-out bag (focus stays inside,
  Escape closes) work without a mouse.
- **Motion.** Transitions drop to 1 ms for visitors who ask for reduced motion.
- **Touch.** Links and buttons are at least 24px tall (the design lint checks this on phones); main buttons are 50px+.

## Manual end-to-end journey (staging + Stripe sandbox)

Work in a fresh browser profile with a new test merchant.

1. **Create a store** and choose Resthaven in Store designs. The main menu must be Beds (Divan, Ottoman, Upholstered),
   Mattresses, Headboards, Shop all, Help.
2. **Editor.** Check the home page order (hero, promise row, Shop by category, most-loved beds, storage story, four
   steps, fabrics story, mattress story, ratings, Before you buy, Recently viewed). Change a hero button, a category
   photo and a trust point. Try the four Theme styles (Midnight oat, Heather, Sage linen, Charcoal and stone). Check
   desktop, tablet and phone previews.
3. **Products.** Add a bed with Colour (colour swatches), Size and Storage options, a compare-at price and
   specifications (dimensions). Tag it `label:More colours`. Turn on Theme settings > Product cards > Savings.
4. **Product page.** Rating, title and price, size tiles, Add to basket, the promise box and fold-out details sit in one
   column beside the photos; "% off" shows by the price; scrolling down shows the add to basket bar. Turn on the finance
   line only if the store offers finance. Add a bag item: the slide-out bag opens.
5. **Collection.** Make a collection with a long description: it shows two lines and Read more. Point the menu's bed
   links at real collections in Navigation.
6. **Publish** and repeat 4-5 as a shopper in a private window; footer links (Delivery, Returns, About us) open the
   store's pages.
7. **Check out** with Stripe test card `4242 4242 4242 4242`; then the order, account and failure paths as in the
   Avenue checklist (steps 12-15).

## Known limits

- **Staging.** The redesign (home, collection, product, bag, checkout, account) was checked read-only on the test
  store `resthaven-showroom-check` through a local frontend and backend; that store still holds its pre-redesign
  published design. A clean install of the new starter on staging, then the manual journey above, is the remaining
  launch gate. Payment was not run.
- **Order confirmation and signed-in account pages** were styled but not viewed.
- **Add-ons** (assembly and similar extras on the product page) are not built: they change the cart and orders.
- **Pictures.** Nine generated photos (see the theme's `SOURCES.md`); merchants replace them with real product photos.
- **Rating** stays hidden on the live store until reviews exist (nothing made up). Trust points make no delivery,
  trial or warranty promises; merchants add their own.
- **Stores that installed Resthaven earlier** keep their saved colours, fonts and page layouts (id and version are
  unchanged); they get the new stylesheet. The footer and announcement follow the store's main button colour.
