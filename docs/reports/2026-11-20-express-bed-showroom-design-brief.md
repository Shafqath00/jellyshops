# Express Bed: premium showroom design brief

Date: 2026-11-20. Store `/express-bed` (staging), theme Resthaven, style "Fresh cobalt".
Status: **brief for approval. Nothing has been built from it yet.**
Follows `2026-11-20-express-bed-premium-refresh.md` (same day) and `2026-11-11-bed-showroom-sonno-dusk-analysis.md`.

We borrow layout ideas and shopping patterns only. No names, copy, logos, photos or exact colours from other
retailers.

## 1. Where Express Bed is today

Checked in the browser at 1440px: home, Beds collection, Ashby Divan Bed product page.

**What already works (keep):** mega menu with photo tiles, rotating announcement, search bar header, trust strip,
category tiles, best sellers with stars and sale badges, Quick view, Shop the look with hotspots, featured product,
review carousel, FAQ, newsletter, backend filters (size, extras, storage, fabric) with counts, sticky buying panel,
size tiles with prices, extras (assembly, old bed removal), Complete the set, slide-out bag, the new checkout.

**Why it still looks like a template.** The parts are there; the art direction is not:

| Problem | Where you see it |
| --- | --- |
| Type is small and polite. Headings are about 40px, the hero 64px, no contrast between big and small. | Every section heading looks the same weight and size. |
| One shape everywhere. Same 1280px box, same white background, similar section heights (550-700px). | Home has four "photo left, text right" sections in a row. |
| Colour is used only on buttons. The bright bands (cloud, butter, navy) are pale and rare. | Page reads as white-on-white. |
| Photography is warm oat/beige. It fights the cobalt palette and looks stock-like. | Hero, category tiles, all product photos. |
| Cards are small and plain. 4 small tiles in a row, no "from £", no colour dots, no story. | Shop by category, best sellers. |
| Product page photo is small and the buying column is a flat form. | Photo ~45% width with one thumbnail; disabled pale button until a size is chosen. |
| Collection page has no header moment. Title and two lines of text, then filters. | Beds collection. |
| Little motion. Sections fade in, nothing else moves or responds. | Whole site. |

The fix is mostly **design system and section design**, plus about a dozen new reusable components. It is not a
rebuild of the shop.

## 2. Reference study

Studied in the browser on 2026-11-20 at 1440px (home, a collection and a product page on Somne; home on DUSK and
Sonno; DUSK and Sonno product/collection pages were studied on 2026-11-11). Fonts and colours below were read
from the live pages.

### Somne (somne.co.uk): the "wow" reference

| Area | What they do |
| --- | --- |
| Header | Dark ink announcement strip that scrolls sideways (marquee) with a live sale countdown and a code chip; slim white header with centred menu, a dark "Shop the sale" pill, search and bag icons. |
| Type | Fraunces serif headings, huge: hero 104px, section headings 60px, offer number 136px. One word in each heading is **italic and coloured** ("Find the bed that *feels like you.*"). Manrope body, small uppercase eyebrows in the accent colour. |
| Colour | Warm white page, near-black ink, coral buttons, and whole sections in saturated colour (mustard offer panel, deep navy story band, blush, emerald). |
| Hero | Full-bleed slideshow with a dark wash, three short words stacked ("Lift. Store. Dream."), two pill buttons, slide progress bars, and a small floating "Shop the look" product card bottom right. A trust row of four white cards sits on the hero's bottom edge. |
| Categories | Bento grid: two large tiles then three smaller ones, 32px corners, a "from £255" chip top left, an arrow button bottom right, name in serif over the photo. |
| Product cards | Rounded photo on a white panel, two stacked badges (sale amount, Bestseller), colour dots with "7 colours", price right-aligned. |
| Story sections | Each one a different shape: offer panel with a code chip, dark band with fabric swatches and a floating fabric label on the photo, "Tidy room. *Clear mind.*" with a round sticker badge, mattress layers as a list with coloured squares. |
| Reviews | Cards in different pastel tints (peach, yellow, mint, lilac) with stars. |
| FAQ | Heading left ("Questions, *answered.*") with a button, rounded white question rows right. |
| Collection | Photo banner with breadcrumb, title, quick-link chips inside the banner and a promo pill; a row of colour swatches as a quick filter; count + sort; an offer tile inside the product grid. |
| Product | Large gallery left; buying column on a tinted rounded panel: badges, serif title, price with was-price and % chip, Klarna line, fabric tiles with photos, size tiles, add-ons as rows, quantity and a full-width coral "Add to bag · £460" button, three trust chips underneath. "Get the look" lifestyle row below. |
| Motion | Marquee, slide progress, hover lift on cards, sections fade up. |

### DUSK (dusk.com): large-catalogue confidence

| Area | What they do |
| --- | --- |
| Header | Promo strip, big serif wordmark, search, two rows of category links, then a service bar (finance, payment, review count with stars). |
| Type and colour | Playfair Display wordmark and campaign headlines, Montserrat everywhere else. Warm cream page `#FAF6F3`, charcoal text, dark pill buttons. Campaign banners are moody and rich (deep reds, browns). |
| Hero | Campaign banners with huge serif lettering set into the photo ("Cosy in time for Christmas", "New arrivals, *just landed*"). |
| Navigation | "Shop by room" row of photo tiles with uppercase labels; product carousels on dark bands; collection carousel; awards strip. |
| Cards | Badge, stars and review count, "More colours & sizes available", "from £", Add to bag / Choose options pill on every card. |
| Collection and product | Many filters, sort, SEO links; colour swatches link to sibling products, Complete the set, "Will it fit?" fold-out. |

### Sonno (sonno.co.uk): reassurance and clarity

| Area | What they do |
| --- | --- |
| Header | Plum promo strip, search bar left, centred logo, "Free swatches" link, basket with total; a trust row under the menu (trial, delivery, UK made, pay monthly). |
| Type and colour | Playfair Display headings 36px, Nunito Sans body, plum `#7F285B` buttons with 6px corners on a light cream page. |
| Home | Sale hero with three category buttons along the bottom, "Over 100,000 happy customers" review cards, popular categories, new and trending, benefits with icons, customer photos, "3 easy steps", FAQ. |
| Product | Option tabs with big tiles, assembly add-on, finance line, dimensions table per size in cm and inches, sticky Add to basket. |
| Note | A sale pop-up blocks the page after a few seconds; we will not copy that pattern. |

### Secondary references (not opened this time)

Dreams, Bensons for Beds, Button & Sprung, Hypnos, Silentnight and Land of Beds share the same trust pattern
(delivery promise, finance, reviews, "made in Britain", guarantees). Button & Sprung refused automated reading on
2026-11-20 earlier; the others were covered by the earlier report.

## 3. What we borrow, and how Express stays its own

| From | We borrow (pattern only) | Express's own take |
| --- | --- | --- |
| Somne | Editorial scale (very large serif headings), one accent word per heading, saturated colour bands, bento categories with "from £", floating product card on the hero, tinted review cards, offer panel with a code chip, marquee strip | Express's angle is **speed**: "delivered this week". A **delivery clock** idea runs through the site (next delivery day in the strip, "order by 2pm" chip on products, "In your room by Thursday"). Different palette (cobalt, tangerine, butter, mint), different fonts, different shapes (soft 24px corners, a signature quarter-circle cut on hero and offer panels). |
| DUSK | "Shop by room" photo tiles, review counts on every card, "More colours & sizes available", awards/press strip, service bar under the header | Rooms become **"Shop by sleeper"** (main bedroom, guest room, kids room, small room) to fit a bed specialist. |
| Sonno | Trust row under the header, category buttons on the hero, "3 easy steps", dimensions per size, finance line by the price | Steps become **"Order today, sleep on it this week"** with real dates worked out from the delivery promise. |

What makes it Express and not a copy:
1. **Palette**: cobalt and tangerine on warm paper. None of the three references use it.
2. **Type pair**: DM Serif Display (sharp, high contrast) with Plus Jakarta Sans (geometric, friendly). Somne
   uses Fraunces/Manrope, DUSK and Sonno use Playfair.
3. **Shape**: 24px corners plus one big quarter-circle corner on hero, offer and story photos (the "Express
   swoosh"). Somne uses 32px all round, DUSK square, Sonno 6px.
4. **Voice**: short, fast, practical ("Pick it today. Sleep on it Thursday."), not moody.
5. **Signature component**: the delivery clock (see section 6).

## 4. Palette options

All pairs below are measured WCAG AA or better (ratios in brackets).

### Option A: "Express Sunrise" (recommended)

| Role | Colour | Use |
| --- | --- | --- |
| Paper | `#FFFBF5` | Page background (warm white, not grey) |
| Ink | `#101A3A` | Text (16.6:1 on paper), dark bands |
| Soft ink | `#4B5470` | Secondary text (7.3:1) |
| Cobalt | `#2348E0` | Main buttons, links (white text 6.8:1) |
| Tangerine | `#FF7A45` | Highlight buttons, accent word fill, stickers (ink text 6.6:1) |
| Tangerine text | `#A3360A` | Small headings above titles (6.6:1 on paper, 4.9:1 on butter; changed from `#C2410C` after the axe check) |
| Butter | `#FFD84D` | Offer panels (ink text 12.3:1), butter buttons on ink (12.3:1) |
| Blush | `#FFDCD2` | Soft band, review tint (ink 13.3:1) |
| Mint | `#CFEFDF` | Soft band, review tint (ink 13.9:1) |
| Sale red | `#B71C3C` | Sale badges and sale prices (white 6.5:1; 4.5:1 or better on every band; darkened from `#D7263D` after the axe check) |

Colour schemes (sections pick one): 1 Paper, 2 Mint, 3 Butter, 4 Ink (butter buttons), 5 Cobalt (white text,
butter buttons), 6 Blush.

Why: it keeps Express's cobalt (customers already see it), adds energy with tangerine and butter, and the mint
and blush bands let every section feel different without looking messy. Bright, not corporate.

### Option B: "Berry Lemon"

Paper `#FFFCF7`, aubergine ink `#2A1433` (16.5:1), raspberry buttons `#C8235A` (white 5.5:1), lemon `#F7E36A`
(ink 13.0:1), lilac `#E8DEFB` (ink 13.1:1), teal accent `#0F766E` (5.4:1).
Bold and fashion-like. Risk: raspberry is close to Sonno's plum family and to sale red, so offers stand out less.

### Option C: "Lagoon"

White, deep teal ink `#0B2E33` (14.5:1), lagoon buttons `#0B7A75` (white 5.2:1), coral `#FF7B66` (ink 5.7:1),
sand `#F6EBDD` (ink 12.3:1), sky `#D7ECF8` (ink 11.9:1).
Calm and spa-like. Risk: coral on dark is close to Somne's coral, and it is the least energetic of the three.

**Pick: Option A, Express Sunrise.** It is added as a new Resthaven theme style, so Express Bed switches to it and
other Resthaven stores keep their own look.

## 5. Design system (tokens)

| Token | Value |
| --- | --- |
| Heading font | DM Serif Display, with its italic loaded for accent words (today only the upright style is loaded) |
| Body font | Plus Jakarta Sans 400/500/600/700 |
| Type scale (desktop / phone) | Display 112/56, H1 72/44, H2 56/36, H3 32/26, H4 22/20, body 17/16, small 14, eyebrow 13 uppercase +0.12em |
| Accent words | Italic word in a heading draws in tangerine text colour (on dark: butter) |
| Spacing | 8px base; section padding 120/96/64px (desktop/tablet/phone); page margin 48/32/20px; container 1360px, wide 1600px |
| Corners | small 12px (chips, fields), medium 24px (cards, panels), large 40px (hero, offer panels), pill buttons, the quarter-circle cut 120px on one corner of feature photos |
| Shadows | card `0 1px 2px rgb(16 26 58 / 6%), 0 8px 24px rgb(16 26 58 / 6%)`; lift on hover `0 18px 40px rgb(16 26 58 / 12%)`; floating card `0 24px 60px rgb(16 26 58 / 22%)` |
| Buttons | 52px high (44px small), pill, 600 weight; hover lifts 2px and darkens 6%; arrow icon slides 4px on hover |
| Motion | 200ms for hovers, 600ms for reveals, easing `cubic-bezier(.2,.7,.2,1)`; sections fade up 24px; cards in a row stagger 60ms; photos scale 1.04 on hover; marquee 40s per loop; all of it off with reduced motion |

These become theme tokens (`--j-*` contract and Resthaven settings), not one-off CSS.

## 6. Pages

### Header (every page)
- **Marquee strip** on Ink: "Order by 2pm for delivery this Thursday · Two-person delivery to your room · Spread
  the cost with Klarna · Showroom open 7 days", moving slowly, pauses on hover and focus, static with reduced
  motion.
- **Header**: logo left, menu centre (Beds, Mattresses, Headboards, Bedroom, Sale in tangerine), search, account,
  bag with count; a cobalt "Visit the showroom" pill. Transparent over the hero on the home page, solid white with a
  shadow after scrolling (sticky, shrinks from 88px to 68px).
- **Mega menu** (exists): columns + photo tiles, restyled with 24px corners and the new type.

### Home (in order)
1. **Hero**: full-bleed slideshow (3 slides), headline 112px ("Pick it today. *Sleep on it Thursday.*"), two pill
   buttons, slide progress bars, floating product card (photo, name, from £, stars) bottom right, trust cards
   sitting on the bottom edge (Two-person delivery / 5-7 days / Klarna / Showroom).
2. **Shop by type**: bento grid of five category tiles (two large, three small) with "from £" chips and arrow
   buttons.
3. **Shop by size**: a row of size chips drawn as little bed outlines to scale (Single 90, Small double 120,
   Double 135, King 150, Super king 180) linking to the filtered collection.
4. **Best sellers**: carousel of large product cards (badges, colour dots, stars, from £, Quick view).
5. **Offer panel** on Butter: huge "Up to 30% off" with a code chip that copies on click, photo with the quarter
   cut and a floating fabric label, countdown.
6. **Shop by sleeper** (rooms): four tall photo tiles with uppercase labels.
7. **Comfort story** on Ink: "Built in layers. *Made for you.*" with a mattress cut-away photo and a layer list
   with coloured squares; count-up numbers (1,000 springs, 25cm deep, 10 year frame).
8. **Material story** on Mint: fabric swatch row (velvet, boucle, linen, weave) with photo tiles.
9. **Reviews**: big rating ("4.8 out of 5 from 1,200 reviews"), tinted review cards (blush, butter, mint, sky)
   scrolling sideways, press/award strip.
10. **How delivery works**: three steps with real dates ("Order today", "We call you Tuesday", "In your room
    Thursday").
11. **FAQ**: heading left with a button, questions right.
12. **Newsletter** on Cobalt: "Sleep better, spend less." with the form and a sticker badge "10% off your first order".
13. **Footer**: four link columns, payment marks, a very large "Express Bed" wordmark at the bottom.

### Collection / listing
- Photo banner header (40px corners, inset from the page edge) with breadcrumb, title, one line, and quick-link
  chips inside the banner (Divan, Ottoman, Upholstered, Wooden, Kids).
- Colour swatch quick filter row above the grid; count and sort on one row.
- Sidebar filters on desktop (size, type, material, price, storage, colour), a full-height drawer on phones with
  "Show 18 beds".
- 3 columns of large cards on desktop, 2 on phones; an offer tile inside the grid after the 6th product.
- Bottom: "Not sure which bed?" band and SEO text with Read more.
- Fix: the "Extras" (assembly, old bed removal) filter is not useful to shoppers and will be hidden.

### Product
- Breadcrumb; large gallery (60% width) with a main photo and a thumbnail rail, zoom, a "Bestseller" label.
- Buying column on a tinted rounded panel, sticky: badges, title, stars with count, price with was-price and % chip,
  Klarna line ("or 3 payments of £99.66"), **delivery clock** ("Order in 3h 12m for delivery Thursday 26 Nov"),
  colour tiles with photos, size tiles with prices, extras as rows, quantity and "Add to bag · £298.99" (the button
  shows the live price; before a size is chosen it reads "Choose a size" and is not faded out), trust chips.
- Below: "Why you'll love it" three icon points; dimensions per size (exists) with a "Will it fit?" note; specs;
  reviews; Complete the set (exists); "Get the look" lifestyle row; related products; recently viewed.
- Phone: sticky buy bar (exists) restyled.

### Bag, checkout and other pages
- Slide-out bag: free delivery note, "Complete your bedroom" suggestions, delivery date line.
- Bag page and checkout: already rebuilt on 20 Nov; restyle only (fonts, colours, corners) through tokens.
- Showroom page (new): address, hours, map, photo gallery, "Book a visit" form (contact form block).
- Delivery and returns, About, Mattress guide (exists as pages): give them a photo header and the new type.
- 404: "This bed has been made already." with search and best sellers.

## 7. Library audit: reuse, extend, build

Everything below is built in the shared packages (registry, renderer, themes), works for every theme, and is
switched on for Express Bed through settings. No page-only code.

### Reuse as is (restyle through tokens only)
Mega menu, search suggestions, bag count, trust strip, product grid, Quick view, Shop the look, featured product,
FAQ, newsletter, rating, gallery, logo/press strip, filters and sort (backend), product gallery with zoom, size
tiles, extras, Complete the set, dimensions, reviews, recently viewed, slide-out bag, checkout, counter block,
icon list, image comparison, contact form, countdown block.

### Extend (new options on existing pieces)
| Piece | New option |
| --- | --- |
| Typography | Accent words: italic in a heading draws in the accent colour (theme setting); italic styles loaded for the heading fonts that have one |
| Type scale | Theme setting "Headline size: Standard / Editorial" (editorial = the larger scale above) |
| Corners | Large corner token and "signature corner" option on image sections (quarter cut) |
| Announcement | "Scroll sideways" (marquee) style, pause on hover/focus |
| Header | "Over the first section" with solid-on-scroll and shrink (transparent mode exists for Avenue; make it a platform option) |
| Slideshow | Progress bars, floating product card block, trust cards on the bottom edge |
| Category grid / collection card | "From £" chip (lowest price in the collection), arrow button |
| Product card | Colour dots + "N colours" (exists, off), second badge from a tag (`badge:Bestseller`) |
| Testimonials | "Tinted cards" style (each card takes the next colour scheme) |
| Collection header | Quick-link chips inside the banner |
| Product purchase | Live price on the button, "Choose a size" state instead of faded, tinted panel style |
| Footer | Large wordmark option, payment marks (exist) |

### Build new
| Component | What it does |
| --- | --- |
| `delivery-clock` block (product) and strip variable | "Order in 3h 12m for delivery Thursday 26 Nov" worked out from the theme's delivery days and a cut-off time; also usable in the announcement |
| `size-picker` section ("Shop by size") | Size chips drawn to scale, each linking to the collection filtered by that size |
| `offer-panel` section | Huge number, text, code chip that copies, optional countdown, photo with floating label |
| `code-chip` block | Discount code with copy button ("Copied") |
| `floating-card` block | Small product or note card pinned over a photo (hero, story) |
| `swatch-row` block | Fabric/colour swatches with names, optional link to a filtered collection |
| `steps` section | Numbered steps with optional working-day dates |
| `promo-tile` in product lists | Offer tile placed inside a grid (the editorial story tile, restyled as an offer) |

Each new or extended piece gets a short entry in `docs/components/` (what it is, settings, where it works, an
example) and a line in the theme developer guide.

## 8. Images

New photography in the Express Sunrise palette: bright daylight bedrooms, cobalt, tangerine, butter and mint
accents, no beige-on-beige. Full ready-to-paste ChatGPT prompts with file names, sizes and style notes are in
`docs/express-bed/image-prompts.md` (24 images). Until they arrive, the build uses clearly labelled placeholders
(`placeholder-<name>.webp`, a flat tint with the file name written on it), so the layout can be reviewed now.

## 9. Decisions for you

1. **Palette**: A Express Sunrise (recommended), B Berry Lemon or C Lagoon.
2. **Fonts**: DM Serif Display + Plus Jakarta Sans (recommended), or keep Fraunces + Figtree.
3. **Scope**: new components go into the shared library and Express Bed opts in through a new Resthaven style
   and settings, so other Resthaven stores are unchanged (recommended). The alternative is changing Resthaven's
   default look for everyone.
4. **Publishing**: the build ends with republishing Express Bed on staging with the installer (needs your yes at
   that point, as before).

## 10. Build order after approval

1. Tokens and theme style (palette, fonts with italics, editorial scale, corners, shadows, motion).
2. Extend existing components (announcement marquee, header over hero, slideshow parts, card chips, tinted
   reviews, accent words, purchase button).
3. New components (delivery clock, size picker, offer panel, code chip, floating card, swatch row, steps, promo
   tile) with tests and docs.
4. Rebuild Express Bed's pages with them (home, collection, product, bag, showroom, info pages, 404) using
   placeholders.
5. Browser pass at 1440, 1024, 768 and 390px, axe contrast, design lint, Resthaven spec; fix what looks basic.
6. Republish on staging (with your approval), then swap in your photos as they arrive.
