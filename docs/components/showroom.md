# Showroom components

Sections, blocks and options built for large-ticket stores (beds, sofas, furniture) on 2026-11-20 for Express Bed.
They are platform pieces: every theme can use them, the editor shows them like any other section, and their look comes
from the theme tokens (`--j-color-*`, `--j-font-*`, `--jelly-media-radius`) plus the "Showroom" rules at the end of
`src/app/themes/storefront-base.css`. Themes restyle them with their own rules (theme files load later).

Registry: `packages/storefront-registry/src/sections/showroom.ts` (sections), `showroom-blocks.ts` (blocks).
Renderer: `packages/storefront-renderer/src/sections/showroom.tsx`.

## New sections

### Offer panel (`offer-panel`)
A bold offer: big text ("20% off"), heading with an italic accent word, text, a code shoppers copy with one tap, an
optional countdown and a photo with a floating label.

| Setting | Notes |
| --- | --- |
| `eyebrow`, `bigText` (24 chars), `heading`, `text` | Copy. |
| `code`, `codeLabel` | Optional. **Create the code in Admin > Discounts**, or shoppers copy a code that does not work. |
| `countdownTo` (`YYYY-MM-DD HH:MM`, UK time), `countdownEndText` | Optional countdown (the hero's countdown component). |
| `image`, `imageLabel`, `imagePosition` (left/right) | Photo with an optional label pill. |
| `buttonLabel`, `buttonLink` | Optional button with an arrow. |

Defaults to colour scheme 3. Preset "Offer panel" (Marketing).

### Shop by size (`size-picker`)
Sizes drawn to scale from top view (headboard, pillows, duvet fold), each a link, for example to a collection
filtered by size (`/collections/beds?f.size=King`). Blocks `size-option`: `label`, `width` and `length` (cm), `note`
("Most popular"), `link`. Section: `eyebrow`, `heading`, `text`, `unit` (cm or feet and inches), `contentAlignment`.
Every drawing uses one scale, so a single really is half the width of a super king. Phones scroll the row sideways.

### Steps (`steps`)
Numbered steps with an icon, title and text. With `showDates` on, each step shows its real date, worked out in the
shopper's browser in UK time: `days` working days after the order day (today, or the next working day after
`cutoffHour` or at weekends; `weekends` counts weekends). Day 0 shows "Today". Blocks `step`: `title`, `text`, `icon`,
`days`.

### Fabric swatches (`swatch-showcase`)
A large photo beside a grid of fabric or colour swatches. Picking a swatch shows its room photo large with a label
("Velvet · Soft sheen") and a "Shop velvet" button when it has a link. Blocks `swatch`: `name`, `color` (used when
there is no close-up), `image` (close-up), `photo` (room photo), `note`, `link`. Section: `eyebrow`, `heading`, `text`,
`image` (shown until a swatch with a room photo is picked), `imagePosition`, `buttonLabel`, `buttonLink`.

## New blocks

| Block | Where | What it does |
| --- | --- | --- |
| `code-chip` | Any "@content" list (Custom section, groups, pop-ups) | Discount code with a Copy button; "Code copied" is read out to screen readers. |
| `floating-card` | Hero only | A small card pinned over the hero photo: a product (photo, name, price, stars) or the merchant's own note. `productId`, `eyebrow`, `title`, `text`, `image`, `link`, `position`. Shown from 1024px (below that the hero's words reach the bottom of the photo). |

## New options on existing pieces

| Piece | Option | Notes |
| --- | --- | --- |
| Hero | `promises` (one per line, `icon: text`, up to four) | Promise cards along the hero's bottom edge, for example `truck: Two-person delivery`. |
| Announcement bar | `style`: Take turns (`rotate`) or Scroll sideways (`marquee`) | Marquee shows every message in a slow line; it stops when pointed at or focused, and stays still (wrapped) with reduced motion. |
| Collection list tile (`collection-card`) | `chip` | Small label on the photo ("From £299"). |
| Testimonials | `cardStyle`: Plain or Tinted | Tinted gives the cards colour schemes 2, 3, 6 and 1 in turn. |
| Collection header | `quickLinks` (`Text \| link` per line, up to 8) | Pill links under the title. |
| Product purchase (and the Main product part) | `showPrice` | "Add to bag · £598" (price times quantity). Until a required choice is made the button reads "Choose a size" and, when pressed, says so and moves focus to the options. |
| Delivery estimate block | `style`: One line or Countdown (`clock`) | "Order in 3h 12m for delivery Mon 30 Nov – Wed 2 Dec", updated every 30 seconds, with a pulsing dot (still with reduced motion). |
| Footer | `wordmark` | The store name very large at the foot (decorative, hidden from screen readers). |
| Section headings | Formatted one-line editor | See `editorial-look.md`: italic words become accent words. |

## Express Bed

`scripts/express-bed/build-plan.mjs` builds the store from these pieces and also writes
`jellyshops/src/features/theme-preview/express-bed-design.json`, shown at `/theme-preview/express-bed` (Home,
Collection, Product, Cart, Search, Page, 404; desktop, tablet and phone) before anything is installed or published.
Photos: `docs/express-bed/image-prompts.md` and `scripts/express-bed/images.mjs`.
