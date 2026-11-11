# Resthaven redesign (flagship bed and bedroom theme)

Requested 2026-11-11. Goal: turn Resthaven (`jelly-resthaven`) from a working but patchy showroom into a premium,
consistent bed and bedroom store that holds its own next to the large UK bed retailers. Theme id and version stay
the same (published stores pin them).

## What the reference stores do well (inspiration only, nothing copied)

Studied 2026-11-11 at 1440px and 390px. DFS could not be studied: it shows a bot check to automated browsers, which
was not bypassed.

| Store | Worth learning from |
| --- | --- |
| DUSK | Warm off-white page, charcoal text, pill buttons, "shop by room" photo carousel, white product cards with "More colours" and star ratings, finance and review promises in a slim row under the header. |
| Sonno | Search on the left, logo centred, category shortcuts on the hero, reviews strip near the top, savings shown in words under the price. |
| Somne | The most premium of the three: cream page, near-black ink, editorial serif with an italic accent word, small caps "eyebrow" labels, a row of four promise cards overlapping the hero, bento category tiles with a "From £" chip and a round arrow, name and price on one line in cards, colour dots, dark full-width story bands. |

## Problems in the current Resthaven

Measured on `/theme-preview/jelly-resthaven` (1280px and 390px):

1. It reads as a Sonno look-alike (plum on linen, the same section order and wording) rather than its own brand.
2. No design system: the stylesheet is a stack of patches (header styled three times, buttons twice, phone rules in four places); sizes and corners are fixed numbers.
3. Product cards: serif names at 13px, price indented differently from the name, savings and chips on separate loose rows, heavy shadow, rounded photo tops that do not match the rest of the page.
4. Home: duplicate newsletter (an unstyled section above the footer's own), empty photo gallery strip, "How it works" and "Comfort, considered" are plain text columns, centred headings above left-aligned columns, category tiles use big purple buttons as labels.
5. Product page: buying column has no visual order (rating, brand, title, price, then loose lines of text), option tiles and buttons have no clear states, Add to basket looks disabled, the purple trust strip cuts across the page, sections below run on white with uneven gaps.
6. Collection: header banner squashed, intro centred but title left, white band then linen band.
7. Fonts: Playfair Display at weight 400 is thin at small sizes; Inter everywhere else.

## Design direction

"Quiet luxury for the bedroom": calm, warm and confident, built for large photos of beds.

- **Colours** (default style "Midnight oat"): oat page `#f7f3ee`, white cards, sand band `#ece4d8`, midnight ink
  `#1d2333` for text and the main button, brass `#8a6a3d` for small highlights (eyebrows, stars, links), clay
  `#a3422c` for savings, a deep midnight band `#1d2333` with oat text for dark sections. All text pairs meet WCAG AA.
- **Styles** a merchant can switch to (Theme styles panel): Midnight oat (default), Heather (the previous plum and
  linen look, for stores that liked it), Sage linen, Charcoal and stone.
- **Type**: Cormorant-like elegance is too thin for prices, so headings use **Fraunces** (soft, optical serif, works
  from 16px to 64px) and body uses **Manrope**. Eyebrows in small capitals with letter spacing.
- **Shape**: 4px corners on photos and cards, pill buttons, 1px hairlines in a warm grey, almost no shadows.
- **Spacing**: one 8px scale; sections 96px apart on desktop, 56px on phones; 1280px page width.

## Phases

1. **Design system and shared pieces** (done 2026-11-11) – theme settings defaults and styles, the stylesheet rebuilt in ordered parts
   on the platform section defaults (tokens, type, buttons, fields, badges), announcement, header, large menu, phone
   menu, footer, product card, style guide. Remove the old patches.
2. **Home page** (done 2026-11-11) – new starter order: hero with promise cards, shop by category (bento tiles with "From £"), best
   sellers, shop by room, mattress story, reviews, sleep guides and help, newsletter in the footer only.
3. **Collection and search** (done 2026-11-11) – banner header, filter sidebar and phone filter drawer look, toolbar, empty states.
4. **Product page** – gallery, buying box (rating, title, price and savings, finance line, size and colour tiles,
   delivery promise, Add to basket), sticky bar, fold-out details, dimensions, reviews, related and recently viewed.
5. **Bag, slide-out bag, checkout, account, information pages, 404**.
6. **QA** – desktop/tablet/phone pass, contrast and accessibility (Resthaven Playwright spec), design lint with
   tidy and messy data, launch checklist, staging check.

Each phase is committed and reported before the next starts.
