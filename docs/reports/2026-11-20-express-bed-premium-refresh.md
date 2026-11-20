# Express Bed: brighter, more premium storefront

Date: 2026-11-20. Store `/express-bed` (staging), theme Resthaven. Follows `2026-11-19-express-bed-store.md`.
Ideas taken from layout and shopping patterns only; no names, copy, logos or images from other retailers.

## Research (UK bed and mattress retailers)

Read on 2026-11-20: Sonno, DUSK, Dreams, Silentnight and Eve in full or in part. Somne returned only a page title
(rendered in the browser), Button & Sprung refused automated reading (403), Simba's UK address returned 404, Emma
returned only its header. None of the readable pages exposed their CSS, so colours below are described, not measured.

| Area | What the leaders do well | Adopted for Express Bed |
| --- | --- | --- |
| Layout | Promises (delivery, trial, finance) in a strip right under the hero (Eve, Dreams, Sonno); categories, then best sellers; clear chapters | Trust row moved directly under the hero; categories, best sellers, then stories in alternating colour bands |
| Colour | Bright white pages with one strong brand colour and a promo colour for offers (Sonno red, Dreams blue, Eve yellow) | "Fresh cobalt": white, cobalt buttons, butter promo band, cloud bands, navy close |
| Type | Clean sans body, confident headings; Silentnight lowercase, Eve playful | Fraunces headings (warm, premium) + Figtree body |
| Imagery | Light lifestyle bedrooms, cut-outs for product detail, customer photos | Existing lifestyle photos kept; cards zoom gently and show the second photo on hover |
| Trust | Trustpilot counts, trial/guarantee, 0% finance, awards (Dreams, Eve) | Two-person delivery, 5-7 days, Klarna, showroom (owner's terms: no trial or guarantee) |
| Product presentation | "From £", % off, stars on cards (Silentnight), size tiles with prices, sticky buy bar, compare | Stars, % off, "From" price, Quick view with size tiles and prices, sticky panel (already built) |
| FAQ | Sonno and Dreams answer delivery/finance/size questions on the home page | New "Before you buy" FAQ on the home page |

## Palette options

All text/background and button pairs are WCAG AA (checked in `theme-styles.test.ts`, and axe found no contrast
problems on the live home, collection, product and bag pages).

1. **Fresh cobalt (applied)**: white `#FFFFFF`, text navy `#13213F`, soft text `#4A5875`, buttons cobalt `#2453D4`,
   accent/stars burnt orange `#C2410C`, sale badges raspberry `#D12E4F`; bands Cloud `#EEF3FC`, Butter `#FFF4D1`,
   Navy `#13213F` with butter `#FFD866` buttons. Bright and confident, closest to UK retail leaders.
2. **Morning sky** (existing Resthaven default): linen, sky blue and coral. Softer, more boutique.
3. **Sage garden** (existing): cream, sage and terracotta. Calm and natural, less retail energy.

The palette lives as a Resthaven theme style (`packages/storefront-themes/src/theme-styles.ts`, id `fresh-cobalt`),
so it is a set of theme tokens (colours, four colour schemes, fonts, button shape, badge colours). The merchant can
switch styles in the editor (Theme settings > Theme styles) or edit any colour.

## What changed

- **Quick view** (new platform component): theme setting Product cards > "Quick view on cards"
  (`productCard.quickView`, default off). A button over the card photo (icon only on touch screens) opens a modal
  pop-up: photos with thumbnails, rating, price ("From" until a size is chosen, sale and was-price), summary, size
  tiles with prices (sold out shown dashed), Add to bag (then the slide-out bag opens) and a link to all details.
  Renderer `quick-view.tsx`, data from the store's published products (`features/storefront/quick-view-data.ts`).
  Native `<dialog>`: focus stays inside, Escape and the backdrop close it, phones get a bottom sheet.
- **Resthaven polish** (all Resthaven stores): product cards on raised white panels with a soft shadow that lift on
  hover, button hover shadow, accent small headings, trust icons in tinted circles, rounded category tiles with zoom;
  all respect reduced motion. Slimmer card panels on phones.
- **Express Bed store**: Fresh cobalt style, Quick view on, home reordered (hero, trust row, categories, best sellers,
  butter bundle story, shop the room, spotlight, reviews on Cloud, headboard and mattress stories, FAQ, showroom
  story, customer photos, sign-up on Navy). Published 2026-11-20 with the installer (products, pages and reviews
  unchanged).
- **Fix for every platform theme**: collection page titles were drawn in the faded description colour.

Already in place before this pass and reused: mega menu with photo tiles, rotating announcement, trust strip,
sticky buying panel and phone buy bar, Complete the set, FAQ accordion, review carousel, compare tray (off for this
store), slide-out bag, sliders.

## Checked

- Live store through the local frontend at 1440, 820 and 390px: home, Beds collection, product, bag; no sideways
  scroll; Quick view opened, chose King, added to the bag, slide-out bag opened.
- axe (WCAG A/AA, contrast included) on the live home, collection, product and bag: no problems.
- Resthaven Playwright spec 18/18, full design lint 17/17, frontend renderer/theme/storefront tests, backend 814 tests.

## Still open

- Quick view adds the bed without extras (assembly, old bed removal); the link opens the full page for those.
- Quick view loads the full-size photo (no smaller copy yet).
- Test-product descriptions start with "TEST PRODUCT", which also shows in Quick view until real copy is added.
- Klarna is mentioned but still not enabled at checkout (Stripe payment methods).
- Not built: product comparison table for this store (the compare tray exists; turn on Product cards > "Let shoppers
  compare products" if wanted), promo countdown banner, new bright photography (the current photos are warm oat).
