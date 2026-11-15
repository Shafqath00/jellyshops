# Resthaven (bright edition): research and remix plan

Date: 2026-11-15. Sources: the public Shopify Theme Store and five live Home-category demo stores, studied in a browser on this date. The Shopify editor notes come from the earlier signed-in study in `docs/reports/2026-11-06-template-quality-shopify-analysis.md` (section 2). Nothing here copies Shopify code, text, images or theme names. Only patterns are described.

## 1. Theme store UX

**Listing** (`themes.shopify.com/themes?industry[]=home`): 124 Home themes, 24 per page.
- Left filter column, each group folds: Price (Free 4 / Paid 120), Industry (21 ticks), Catalogue size (One product / Few / Some / Lots, with counts), Features (19 ticks with counts: mega menu, colour swatches, quick view, sticky header, stock counter, swatch filters...), language. "Sort: Relevance" select top right; "Filtered by: Home ×" chip above the grid.
- Cards: 3 per row, large rounded screenshot with a soft shadow that lifts on hover, then name, price and a thumbs-up approval % (or a NEW tag). No description on the card. The picture does the selling.

**Detail page** (Athens > Prism preset):
- A dark stage with a desktop/phone toggle above a big live preview (an iframe of the demo store).
- A floating white bar pinned over the preview: name, price, approval %, **View demo** (outline) and **Try theme** (filled).
- Tabs: Overview, Features, Reviews, Support.
- Overview: three short selling points ("Furniture and lighting stores", "Ready for any language", "51+ sections included").
- Features: about 60 features in groups (Cart and checkout, Marketing and conversion, Merchandising, Product discovery).
- **Presets**: "comes with 5 ready-made designs". Each preset is a thumbnail. Choosing one swaps the screenshots and the demo store. A preset is a separate demo store with the same code and different settings and content.
- Reviews with % positive, designer replies, version and changelog, designer contact, "More themes for home".

## 2. Demo preview UX

- View demo opens the demo store inside the theme store frame, with the toolbar still visible: desktop/phone toggle, preset switcher, and Try theme. Phone view is a narrow framed viewport, not a scaled screenshot.
- Demo stores are fully working shops (search, cart drawer, product pages), so shoppers' flows can be tried.

## 3. Editor UX (from the signed-in study, 2026-11-06)

- Top bar: exit, Sections / Theme settings / Apps tabs, theme name with an Active badge, a searchable page picker, phone preview, undo/redo, **Save**.
- Left tree in three groups: Header (announcement, header), Template, Footer. Each group has "Add section". Blocks nest under sections. Hide, duplicate and delete appear on hover. Sections can be dragged.
- Selecting a section outlines it in the live preview with a name tag and a floating toolbar. Settings appear on the right and are about the section's job: layout, width (page/full), height preset, colour scheme, padding.
- Theme settings: logo, colour palette and schemes, typography roles and text presets, buttons, product cards, cart, badges, swatches, custom CSS, **theme style** (swap the whole look without losing content).
- Add section: categories with designed presets and a thumbnail (Banners, Collections, Products, Storytelling, Text, Forms).
- Save writes a draft. Publish makes it live.

**Jelly already has most of this** (see `CLAUDE.md`): a store-designs gallery, `/theme-preview/<id>` with device and style switchers, an editor with a section tree, drag, hide, delete, blocks, nested groups, colour schemes, theme styles, undo, Save and Publish, and one renderer for preview and live store, all driven by JSON templates.

## 4. Five Home themes compared

| Theme (preset) | Home section order | Header | Cards | Type and colour |
| --- | --- | --- | --- | --- |
| Athens (Prism) | announcement · header with category bar · slideshow · 4 feature icons · category circles · promo mosaic · best sellers · featured categories · countdown sale · new arrivals · room mosaic · deal tabs · scrolling offer strip · product spotlight · bedroom call to action · carousel · sliding panels · style tiles · **shop-the-look hotspots** · brand tabs · Instagram gallery · footer features · newsletter · footer | Two rows: logo, search, account, cart; then mega menu | Square photos, round media, quick view, sale %, stars | Bricolage Grotesque 600 + Inter. White page, burnt orange buttons (#CE4100), 2-5px corners. Very busy (27 sections). |
| Omega (Lounge) | top bar · header · 800px slideshow · shop by room · media cards (bedroom/living) · most loved · countdown · trending (tabs) · **product hotspots** · animated story · newsletter · journal · footer | Transparent over the hero photo, logo centred | 4:5 portrait, quick view | Host Grotesk Light 50px headings, warm neutrals, square buttons. Calm and editorial. |
| Hyper | blue top bar · header with "All categories" · category icon slider · slideshow · featured collection · promo banner · tabs · favourites · lookbook slider · icon buttons · testimonials · scrolling gallery · service icons · footer | Category button + search-first | Pill buttons (100px radius) | Instrument Sans, strong cobalt (#1D349A) accent. Retail and energetic. |
| Expanse | toolbar with rotating messages · header · split slideshow · shop by category · bestsellers · shop the look · promo grid · outdoor slideshow · brand logos · newsletter · arrivals · promo grid · countdown · split story · brands · journal · footer promotions · footer | Big search bar | Round quick-shop button | Figtree 500, navy (#313652) round buttons. Built for big catalogues. |
| Habitat | announcement · white header · hero slideshow · benefits strip · shop by category · new arrivals · split "for the whole family" · featured product · testimonials · journal · cosy story · footer sale bar · footer | Centred serif logo, icons right | Clean, pill outline buttons | **Crimson Text serif headings + Instrument Sans**, deep teal text (#103A3A), coloured walls in the photos. Warmest of the five. |

**What the best ones share**
1. Hero first, then a quick way into categories within one scroll (Athens, Hyper, Expanse, Habitat).
2. A trust strip (delivery, returns, trial) right after the hero or above the footer.
3. Two product rows (best sellers, new or seasonal), split by a story or promo, never back to back.
4. A **shop-the-look / hotspot** room photo (Athens, Lounge, Expanse): the strongest "home" pattern.
5. Colour comes from the photography and one confident accent. Section backgrounds stay mostly white, with one or two tinted bands.
6. Fewer, richer sections read as premium (Lounge 13, Habitat 13). Athens' 27 feel like a catalogue.

## 5. Remix plan for Resthaven (original design)

**Idea:** "a bright Sunday morning bedroom". Habitat's warmth (serif headings, coloured rooms) + Lounge's calm pacing + Athens' retail tools (mega menu, hotspots, spotlight) + Expanse's rotating trust messages. Bright tinted bands instead of white or black.

**Home order (15 sections, tinted bands alternate so no two neighbours share a colour):**
1. Announcement bar: rotating messages (sky band)
2. Header: logo left, mega menu (Beds, Mattresses, Bedding, Pillows, Decor, Sale) with photo tiles, search, account, bag that opens a slide-out bag
3. Hero: full-width bright bedroom photo, light wash only at the text side, headline, sub-line, two buttons (slideshow optional)
4. Shop by category: 6 square tiles (1:1) with names under the photos
5. Best sellers: 4:5 cards with hover second photo, badges, swatches, price and was-price, stars, quick add
6. Promo banner: split image + offer on blush
7. Shop by room: room photo with hotspots (new section)
8. Image with text: two alternating rows (fabrics, mattress) on cream
9. Benefits strip: free delivery, 100-night trial, 10-year guarantee, easy returns (Lucide icons)
10. Featured product spotlight (new section)
11. Reviews carousel with avatars on sky
12. Brand story with image
13. Social / customer photo gallery
14. Newsletter on night navy
15. Footer: link columns, payment icons, social

**New platform pieces needed** (work for every theme, not just Resthaven): hotspots section, featured product section, rotating announcement, reviews carousel layout, payment icons in the footer, reveal-on-scroll motion. Everything else already exists in the registry and renderer.

## 6. Proposed palette (all text pairs checked against WCAG AA)

| Role | Colour | Use |
| --- | --- | --- |
| Linen | `#FBF7F1` | page background |
| Night navy | `#1F2A44` | text (13.4:1 on linen), dark band |
| Slate | `#5A6478` | quiet text (5.6:1 on linen) |
| Morning sky | `#3D6E96` | main buttons (white text 5.4:1) |
| Sky wash | `#E3EEF7` | tinted band (navy 12.1:1) |
| Sunset coral | `#F2A488` | accent, buttons on navy (navy text 7.1:1) |
| Clay | `#B5452B` | sale price and offer buttons (5.1:1 on linen, white 5.5:1) |
| Blush | `#F8E6DE` | tinted band (navy 11.8:1) |
| Sage wash | `#E6EEE3` | tinted band (navy 12.0:1) |

**Colour schemes** (sections pick one): 1 Linen (linen / navy / sky button), 2 Sky (sky wash / navy / navy button), 3 Blush (blush / navy / clay button), 4 Night (navy / linen / coral button with navy text).

**Presets (theme styles), switchable in the preview:**
- **Morning sky** (default): the palette above, Fraunces headings + Figtree body, pill buttons, 12px card corners.
- **Sage garden**: sage `#4E6E4B` buttons (white 5.7:1), cream and sage bands, terracotta accent, Cormorant Garamond + Inter.
- **Sunset blush**: blush base `#FCEFEA`, clay `#A8462F` buttons (white 5.9:1), plum-navy text `#2B2440` (13.1:1), Fraunces + Inter.

**Shape and rhythm:** 8px spacing scale, 1280px page, products 4:5, categories 1:1, banners 16:9 (21:9 hero on desktop), pill buttons, 12px card corners, one soft shadow for lifted cards only.

## 7. What changes for existing stores

Resthaven already exists (id `jelly-resthaven`) with a "Midnight oat" look (dark navy, brass, oat). Stores keep their saved colours and fonts. Changing the default look changes the stylesheet for every store on Resthaven, as the 2026-11-11 redesign did. The theme id and version stay the same. The other choice is a separate bright theme, leaving the current Resthaven alone.
