# Jelly Shop: 20 premium template categories — research and strategy

Date: 2026-11-08. Deliverable 1 of the template programme: **research and category selection only. No template code was written.**

Companion documents: `docs/reports/2026-11-06-template-quality-shopify-analysis.md` (why Jelly templates looked basic, and the phase 0-9 platform fixes that followed), `docs/design-contract.md`, `docs/theme-architecture.md`, `docs/guides/template-generation-master-prompt.md`, `docs/reports/2026-11-07-forma-full-page-audit.md`.

## How this was researched, and how sure each part is

| Tag | Meaning |
| --- | --- |
| **[search]** | Confirmed today through web search (sources listed at the end). |
| **[known]** | Well-known reference I am confident about, but I did **not** open or measure the site today. |
| **[Jelly]** | Checked in this repository today. |
| **[rec]** | My recommendation or design judgement, not a fact. |

Honest limits: the reference sites were not opened, screenshotted or measured in this pass. The "which reference is strongest" calls in each category are design judgement from those references as they are generally known, not a measured audit. Before each template is designed, run `scripts/compare-reference.mjs` against its two strongest references (it measures and screenshots one page at a time and never bypasses bot checks) and confirm the calls. Theme prices, ratings and sales counts quoted by third-party blogs disagree with each other, so none are used to rank anything here.

---

## 0. Decisions (2026-11-08, after review)

- **Market:** UK/global first. Indian payment gateways and cash on delivery move to phase 2 (with Zari); Zari keeps its place but is built for the global South Asian market first.
- **Shared layout work first:** agreed. Phase 0 builds the layout archetype library before the first template. Progress is tracked in `jellyshops/packages/storefront-themes/src/template-programme.ts` (the 20 templates, their layout codes and an automatic check that no two are too alike).
- **Images:** generated with ChatGPT in the user's Chrome, per template, when that template is built; sources recorded in each theme's `SOURCES.md` (as Forma does).
- **Names:** checked on the Shopify Theme Store on 2026-11-08 (search per name). These names are already used by paid Shopify themes, so the working names change:

| Working name in this report | Clash on the Shopify Theme Store | New name |
| --- | --- | --- |
| Drop | Drop | **Asphalt** |
| Dew | Dewy | **Halo** |
| Vital | Vital | **Dose** |
| Stride | Stride | **Trailhead** |
| Circuit | Circuit | **Diode** |
| Hearth | Hearth | **Linden** |
| Sprout | Sprout | **Acorn** |
| Wag | Wag | **Kibble** |
| Bloom | Bloom | **Stem** |
| Torque | Torque | **Ratchet** |
| Spark | Spark | **Glyph** |
| Zari, Gilt, Basket, Larder, Loom, Bazaar, Resthaven | none found | unchanged |

  Existing themes: **Avenue** and **Forma** are also names of paid Shopify themes. Their internal ids never change (`jelly-avenue`, `jelly-forma`), but their display names should; proposed **Boulevard** and **Joinery** (both free on the Theme Store). Not renamed yet: waiting for your go-ahead, because merchants already see these names.

  Not checked: ThemeForest (it blocks automated visits, and the check was not forced), and trademark registers (UKIPO, EUIPO, USPTO). A formal clearance search for the final names, ideally by a trademark professional, is still needed before launch. The section 4 text below still uses the working names.

---

## 1. Executive summary

1. **The market's lesson.** Shopify's own answer to "many distinct looks" is the Horizon family: ten free themes (Atelier, Dwell, Fabric, Heritage, Horizon, Pitch, Ritual, Savor, Tinker, Vessel) on one shared foundation **[search]**. Premium independents (Prestige, Impulse, Impact, Hyper, Symmetry, Broadcast, Stiletto, Warehouse, Empire…) win on *one signature experience each* plus very polished defaults **[known]**. ThemeForest best-sellers (Ella, Kalles, Minimog) win on breadth: dozens of demo homepages and features, but a weaker identity per demo **[search]**. Jelly should combine the Horizon model (one engine) with the premium-independent standard (one signature experience per theme), and avoid the ThemeForest trap (many demos, same bones).
2. **The 20 categories** (section 4) cover fashion (3), beauty and wellness (2), jewellery, sport, electronics, home (3), food (2), kids, pets, handmade/art, gifting, auto/tools, a large-catalogue megastore and digital products. Three of them already exist in Jelly and are re-audited rather than rebuilt: **Jelly Avenue** (fashion), **Jelly Forma** (furniture), **Jelly Resthaven** (beds and big-ticket showroom). So the programme is **17 new templates + 3 upgrades**. Jelly Minimal stays the free all-purpose default and Harbour stays a generated variant; neither counts towards the 20.
3. **Uniqueness has to be structural, not cosmetic.** Today a Jelly theme is mostly CSS over one shared markup set (2026-11-06 analysis). Twenty genuinely different stores need a **layout archetype library**: several distinct headers, heroes, product cards, collection layouts, product page layouts and cart patterns, each a real component with its own markup. Each template picks its own combination, and a hard rule (section 3) stops two templates sharing more than three of eight structural choices.
4. **Features follow the industry.** About 30 feature modules (size guide, ingredient panel, spec table and comparison, vehicle fitment, delivery slot picker, quick-add steppers, engraving, gift message, drop countdown…) are built once and switched on only where they belong. Several need backend work that does not exist yet: product reviews, subscriptions, line-item properties (engraving, gift message, custom measurements), delivery scheduling, bundles, B2B pricing, cash on delivery and Indian payment gateways **[Jelly]**.
5. **Start with these five** (section 9): **Jelly Dew** (beauty and skincare), **Jelly Circuit** (electronics), **Jelly Basket** (grocery), **Jelly Gilt** (jewellery) and **Jelly Drop** (streetwear and limited drops). Together they are high-demand, visually as far apart as five themes can be, and they force the shared modules (routine/ingredients, specs/compare, quick-add/delivery, personalisation/gifting, size/countdown) that 14 of the other 15 templates reuse.

---

## 2. What the research shows

### 2.1 Shopify Theme Store

- **Horizon family (Summer '25, free, ten styles on one foundation)** **[search]**: Atelier (artisan, gallery-like, craft/jewellery/fashion), Dwell (cosy home, kids, outdoor), Fabric (product-first, edge-to-edge grids, large swatches), Heritage (storytelling, artisanal, cultural), Horizon (base), Pitch (bold type and colour), Ritual (editorial premium, wellness/skincare), Savor (food and drink), Tinker (playful, DIY/craft/education), Vessel (minimal and calm). Third-party sources disagree on some fits, so these are impressions, not Shopify's official positioning. Shared engine: nested theme blocks, theme styles, one performance/accessibility base. **Lesson:** one engine can carry many looks, but Horizon's styles mostly differ in tokens, presets and section mix; their product pages and carts are close cousins. Jelly must go further than Horizon on structure to meet the brief.
- **Premium independents** **[known]**: Prestige and Focal/Impact/Warehouse (Maestrooo: luxury editorial, bold high-impact, big-catalogue), Impulse/Motion/Expanse (Archetype: promotional fashion, motion-led, large catalogue), Symmetry (Clean Canvas: flexible general), Broadcast (Groupthought: content-led), Stiletto (Fluorescent: fashion), Empire (Pixel Union: large catalogues and search), Hyper (FoxEcom: fast, DTC and B2B with bulk ordering **[search]**), Be Yours (beauty). Premium themes sell for roughly $150-$450 **[search]**. **Lesson:** each is remembered for one thing (Prestige's restraint, Impact's scale, Warehouse's density, Hyper's B2B) and for defaults that look finished with the merchant's first five products.
- **Dawn** is the free baseline: fast, clean, widely compatible **[search]**. Every Jelly template must beat Dawn on identity without losing its speed.

### 2.2 ThemeForest and multipurpose themes

- **Ella** is widely cited as ThemeForest's best-selling Shopify theme of all time, **Kalles** (The4) and **Minimog** follow **[search]**. They sell breadth: 30-70 demo homepages, quick view, mega menus, lookbooks, size charts, countdowns, frequently-bought-together, multiple product page layouts.
- **Lesson to adopt:** a big library of designed presets and industry demo content makes a theme feel ready. **Lesson to avoid:** the demos share one card, one product page and one cart under different photos, which is exactly what the brief says it does not want.

### 2.3 Premium DTC brands and award galleries

Brands that set the bar per industry are listed in each category (Glossier, Aesop, Mejuri, Nothing, Teenage Engineering, Article, Graza, Lovevery, Wild One, Bloom & Wild, Kith, On, AG1…) **[known]**. Galleries to browse during design: Awwwards e-commerce, Commerce Cream, ecomm.design **[known]**.

What premium DTC sites do that templates usually miss **[known/rec]**:
1. **One idea per page**, often one product, told in one strong frame before any grid.
2. **Photography direction is part of the design** (consistent backgrounds, crop ratios, model vs still life). A template must ship with an art direction guide and crop ratios, not just image slots.
3. **Typography carries the brand**: a distinctive display face at large sizes, a quiet body face.
4. **Restraint in colour**: one neutral field, one ink, one accent.
5. **Product pages answer the industry's real question** (Does it fit? What's in it? Will it work with my car? When will it arrive?) above the fold.
6. **Motion is functional**: image reveals, sticky buy bars, drawers, not decoration.

### 2.4 UX research

- Baymard's 2026 product page benchmark: only 48% of leading US/EU desktop sites have "decent" or better product page UX, none "perfect"; mobile is worse (roughly 38% decent or better) **[search]**. A template that gets the product page right per industry is a real competitive edge, not polish.
- Principles every template must follow (Baymard-style, well established) **[known]**: visible price and stock, variant choice before Add to cart, size/spec info next to the choice, delivery estimate near the button, sticky Add to cart on phones, filter chips that show what is applied, search that understands categories, guest checkout, no surprise costs.

### 2.5 Ten patterns that make a store look premium (the bar for every Jelly template) [rec]

1. One content edge and one vertical rhythm across every section (Jelly's design lint already checks this).
2. A display typeface used at a confident size (48-120px desktop) with tight leading.
3. Image crops fixed per template (e.g. 4:5 fashion, 1:1 electronics, 3:2 furniture), so any merchant photo looks intentional.
4. A product card designed for the industry, not a generic image-title-price.
5. A product page whose first screen answers the industry's main buying question.
6. Empty and loading states that look designed (no blank grids, no £0.00).
7. Phone layouts designed separately (thumb-reach buttons, swipe rows, sticky buy bar), not squeezed desktop.
8. Micro-interactions with one motion language per template (duration, easing, what moves).
9. Real demo content: copy, products and images that suit the industry.
10. Accessibility and speed as defaults: AA contrast, focus states, 44px tap targets, LCP under 2.5s on a mid phone.

---

## 3. How twenty designs will genuinely differ

### 3.1 The eight structural dimensions

Each template chooses one option per dimension from the archetype library (section 7). Codes are used in the matrix in section 5.

| Dimension | Options (archetypes) |
| --- | --- |
| **Header (H)** | H1 centred logo, split nav · H2 left logo, inline nav, big search · H3 transparent over hero · H4 minimal bar + full-screen menu · H5 two-row utility + category bar (megastore) · H6 side/drawer navigation always visible on desktop · H7 vertical rail · H8 sticky search-first with location/delivery slot |
| **Hero (R)** | R1 full-bleed video · R2 split image/text · R3 editorial collage (mixed sizes) · R4 product on colour field with callouts · R5 slideshow with promo tiles · R6 countdown/drop · R7 shoppable scene with hotspots · R8 search/finder hero (vehicle, gift, skin quiz) · R9 type-only statement |
| **Product card (C)** | C1 tall 3:4 image, minimal text · C2 square with spec chips · C3 card with quick-add stepper · C4 image on tinted field with concern/benefit chips · C5 outlined technical card with compare checkbox · C6 framed/arched image (decorative mask) · C7 large landscape lifestyle card · C8 list row (B2B/parts) |
| **Collection (L)** | L1 editorial grid with inserted story tiles · L2 dense grid + left sidebar filters · L3 top filter chips + 2-up phone grid · L4 shop-by-need entry (quiz/concern/goal) then grid · L5 list/table view with bulk add · L6 room/scene-led browsing · L7 aisle rows (horizontal carousels per sub-category) |
| **Product page (P)** | P1 stacked images left, sticky info right · P2 reverse (info left, images scroll right) · P3 centred hero image, info below in tabs · P4 gallery + spec/compare tables below · P5 configurator (choices change the picture and price) · P6 story-scroll (chapters with benefits) · P7 compact buy box + quantity stepper (grocery) · P8 enquiry/appointment-led (high-value) |
| **Cart (K)** | K1 full-height drawer · K2 cart page with rich upsells · K3 mini-cart popover · K4 bottom sheet on phones + side drawer desktop · K5 order-pad cart (editable table) · K6 drawer with gift step (message, wrap, date) |
| **Type pairing (T)** | Unique display face per template (see each category); body faces may repeat. |
| **Motion language (M)** | M1 still and slow (fades 400-600ms) · M2 snappy (120-180ms, hard cuts, marquee) · M3 playful (bounce, wiggle on add) · M4 technical (counters, reveal lines) · M5 cinematic (scroll-led scenes) · M6 none beyond essentials (utility stores) |

### 3.2 The uniqueness rule [rec]

- Two templates may share **at most three** of the six H/R/C/L/P/K choices, and never the same pair of hero + product page.
- Display typeface is unique per template.
- Each template has **one signature section or interaction** no other template ships by default (listed per category). Other templates may add it from the library, but it is not in their starter.
- The design lint gains a "sameness" check: render each template's home and product page at 1280px and compare layout outlines (section boxes and positions); flag any two templates whose outlines overlap too closely. [rec, new tooling]

---

## 4. The 20 template categories

Each entry: concept, audience, design direction, how each page differs, signature features, references with links and comparison, pages, commercial value, Jelly dependencies.

### 4.1 Fashion & apparel (editorial) — **Jelly Avenue 2.0** (existing, upgrade)

- **Concept:** image-led editorial fashion house: campaign imagery first, product second, a magazine rhythm.
- **Audience:** independent fashion labels, boutiques, multi-brand concept stores, mid-to-premium price points.
- **Design style:** large campaign photography, narrow serif or high-contrast sans headings, black/white/stone palette, no rounded corners, 4:5 crops, wide gutters. Motion M1.
- **Structure:** H3 header over the first image, R3 editorial collage hero, C1 tall cards with second image on hover and colour count, L1 grid with story tiles inserted, P1 stacked full-height images with sticky info, K1 drawer.
- **Signature:** **Shop the look**: a lookbook page where each look lists its pieces with size pickers and "add all".
- **Features:** size guide drawer with fit notes per product, colour swatches with image switch, "complete the look", recently viewed, back-in-stock alert, quick buy on cards (desktop), model size info ("model is 175cm, wears S").
- **References:** [COS](https://www.cos.com), [Arket](https://www.arket.com), [Toteme](https://toteme.com), [Reformation](https://www.thereformation.com), [Sézane](https://www.sezane.com), [Jacquemus](https://www.jacquemus.com); themes [Prestige](https://themes.shopify.com/themes/prestige), [Stiletto](https://themes.shopify.com/themes/stiletto), [Fabric](https://themes.shopify.com/themes/fabric), [Impulse](https://themes.shopify.com/themes/impulse).
- **Comparison [known/rec]:** strongest overall: Toteme (restraint and type). Best homepage: Jacquemus (campaign storytelling). Best product page: Reformation (fit info, model sizes, sustainability facts near the price). Best filtering: COS/Arket (simple chips, size first). Best phone: Sézane (swipe galleries, sticky buy bar). **Adopt:** model-size line, size-first filters, look pages. **Improve:** most editorial sites hide price and stock too long; Avenue keeps them in the first screen.
- **Pages:** all standard pages + lookbook, size guide page, stores/stockists.
- **Commercial value:** fashion is the largest single Shopify category by store count [known]; a flagship fashion theme is expected on any theme marketplace.
- **Jelly:** Avenue exists (`jelly-avenue`), so this is a re-audit and rework against this bar. Needs: back-in-stock alerts (new), look/outfit data (metaobjects can hold it).

### 4.2 Streetwear & limited drops — **Jelly Drop** (new)

- **Concept:** hype-brand storefront built around release moments: countdowns, sell-outs, archives.
- **Audience:** streetwear labels, sneaker resellers, merch for creators/bands/clubs, small-batch apparel.
- **Design style:** black/off-white with one acid accent (accent only on dark or as large shapes, for contrast), display face **Syne**, body Space Grotesk, square images, hard edges, marquee text strips, grainy textures allowed. Motion M2 (snappy, hard cuts).
- **Structure:** H4 minimal bar + full-screen menu, R6 countdown hero (video or image, "Drop 07 — Friday 18:00"), C1 square variant with size availability on hover and "Sold out" kept visible, L3 top chips + dense 4-up grid, P2 info left / images scroll right, K1 black full-height drawer.
- **Signature:** **Drop calendar + notify me**: upcoming releases page, countdown, "Notify me" per drop and per sold-out size.
- **Features:** per-customer purchase limit, sold-out sizes shown but disabled, archive (past drops), raffle sign-up (later), size grid buttons, preorder label, shipping-threshold bar.
- **References:** [Kith](https://kith.com), [Aimé Leon Dore](https://www.aimeleondore.com), [Palace](https://www.palaceskateboards.com), [Supreme](https://www.supreme.com), [Represent](https://representclo.com), [The Souled Store](https://www.thesouledstore.com), [Bewakoof](https://www.bewakoof.com); themes [Impact](https://themes.shopify.com/themes/impact), [Pitch](https://themes.shopify.com/themes/pitch).
- **Comparison:** strongest overall: Aimé Leon Dore (premium tone in a hype category). Best homepage: Kith (drop-led, editorial). Best product page: Represent (clear size grid, fit notes). Best filtering: Kith (deep catalogue, clean filters). Best phone: Palace/Supreme (fast, single column, nothing extra). **Adopt:** countdown + sold-out honesty. **Improve:** hype sites often have poor accessibility (tiny type, low contrast); Drop keeps AA contrast and 44px targets.
- **Pages:** standard + drop calendar, archive, single drop page, raffle/sign-up.
- **Commercial value:** large merch and creator market; very visible design style; reuses fashion modules.
- **Jelly:** needs scheduled publish/availability per product (new), purchase limits in checkout (new), notify-me list (shares back-in-stock with Avenue).

### 4.3 Ethnic & occasion wear — **Jelly Zari** (new)

- **Concept:** South Asian occasion wear (sarees, lehengas, kurtas, sherwanis) with craft and heritage at the centre.
- **Audience:** Indian and diaspora boutiques, designer labels, handloom collectives, bridal studios.
- **Design style:** ivory field, deep maroon ink, antique gold for ornament only (not text), emerald secondary scheme; display face **Cormorant Garamond**, body Hind (Devanagari support already in the font library); arch-topped image masks (jharokha arch) and fine ornamental dividers; 3:4 crops. Motion M1 with a slow image reveal.
- **Structure:** H1 centred logo with occasion mega menu (Wedding, Festive, Haldi, Mehendi, Everyday), R2 split hero framed by an arch, C6 arched card with fabric and craft line ("Banarasi silk · handwoven"), L4 shop by occasion/fabric/craft first then grid, P5 light configurator (stitching options change the price), K2 cart page with gift wrap.
- **Signature:** **Stitching and measurements**: unstitched / standard size / custom measurements with a measurement form saved to the account, plus fall-and-pico and blouse add-ons.
- **Features:** fabric close-up and drape video, "ready to ship in N days", WhatsApp enquiry button, video-call styling appointment, complete the look (jewellery, dupatta), COD note, multi-language (Hindi) storefront labels.
- **References:** [Sabyasachi](https://sabyasachi.com), [Taneira](https://www.taneira.com), [Fabindia](https://www.fabindia.com), [Nicobar](https://www.nicobar.com), [House of Masaba](https://www.houseofmasaba.com), [Kalki Fashion](https://www.kalkifashion.com), [Lashkaraa](https://www.lashkaraa.com); themes [Heritage](https://themes.shopify.com/themes/heritage), [Prestige](https://themes.shopify.com/themes/prestige).
- **Comparison:** strongest overall: Sabyasachi (brand world). Best homepage: House of Masaba (bold colour, collections up front). Best product page: Taneira (fabric, weave and care information). Best filtering: Kalki (occasion, fabric, colour, price, ready-to-ship). Best phone: Kalki/Lashkaraa (fast filters, WhatsApp). **Adopt:** occasion-first navigation and ready-to-ship filter. **Improve:** most sites are cluttered with banners; Zari keeps the luxury restraint of Sabyasachi with Kalki's shopping speed.
- **Pages:** standard + measurement guide, book a styling call, craft stories (blog), bridal lookbook.
- **Commercial value:** large and fast-growing segment with almost no premium-grade Shopify-style themes made for it [rec]; strong fit for an India-facing platform.
- **Jelly:** needs line-item properties (measurements, add-ons), saved measurement profile on customer accounts, appointment booking (new or app block), COD and Indian gateways (not built).

### 4.4 Beauty & skincare — **Jelly Dew** (new, first five)

- **Concept:** clinical-soft skincare and beauty: ingredient-led, routine-led, calm and bright.
- **Audience:** skincare and cosmetics brands, clean-beauty labels, salons selling retail, indie makeup.
- **Design style:** milk-white field, soft product colour per collection (each collection gets its own colour scheme), charcoal ink; display face **Plus Jakarta Sans** set large and tight, lowercase headlines; 20px card corners, pill buttons; generous white space. Motion M1 with texture loops (short muted video of the product texture).
- **Structure:** H2 left logo, inline nav, search with concern suggestions ("acne", "dryness"), R4 product on colour field with ingredient callouts, C4 tinted card with size (ml) and concern chips, L4 shop by concern / skin type / ingredient before the grid, P6 story-scroll product page with tabs (What it does · Key ingredients · How to use · Full ingredient list), K1 drawer with free-sample picker.
- **Signature:** **Routine builder**: AM/PM steps (cleanse, treat, moisturise, protect), each step suggests products; "add routine" adds the set.
- **Features:** skin quiz, ingredient glossary (one page per ingredient, linked from products), shade finder for makeup (swatches), before/after slider, texture video, "pairs with", subscribe & save, free-gift threshold, reviews with skin type.
- **References:** [Glossier](https://www.glossier.com), [Aesop](https://www.aesop.com), [The Ordinary](https://theordinary.com), [Rhode](https://www.rhodeskin.com), [Summer Fridays](https://summerfridays.com), [Minimalist](https://beminimalist.co), [Nykaa](https://www.nykaa.com); themes [Ritual](https://themes.shopify.com/themes/ritual), [Be Yours](https://themes.shopify.com/themes/be-yours), [Vessel](https://themes.shopify.com/themes/vessel).
- **Comparison:** strongest overall: Aesop (tone, type, restraint). Best homepage: Rhode (one product, one colour, huge type). Best product page: The Ordinary (regimen, ingredient and "don't use with" clarity). Best filtering: Nykaa (concern, skin type, ingredient, price at scale). Best phone: Glossier (fast, playful, sticky buy). **Adopt:** concern-first browsing, ingredient pages, routine. **Improve:** Aesop-style sites hide prices and benefits; Dew keeps Rhode's simplicity with The Ordinary's clarity.
- **Pages:** standard + skin quiz, routine builder, ingredient glossary and ingredient page, rewards (later).
- **Commercial value:** beauty is one of the most common and highest-repeat DTC categories [known]; theme buyers expect a dedicated beauty theme.
- **Jelly:** ingredients and concerns fit metaobjects (already built) and specifications; needs product reviews (no review data yet), subscriptions (not built), bundles for routines (cart change).

### 4.5 Jewellery & accessories — **Jelly Gilt** (new, first five)

- **Concept:** quiet luxury for fine and demi-fine jewellery and watches.
- **Audience:** jewellers, demi-fine DTC brands, watch boutiques, bridal and engagement studios.
- **Design style:** porcelain white, ink black, champagne accent fields; display face **EB Garamond**, labels in Jost small caps with wide tracking; hairline rules; small product on a large field; slow fades (M1, 400-600ms); macro photography.
- **Structure:** H1 centred logo with nav split left/right, R9 type-led statement over a macro image, C1 square on neutral with on-model hover and metal swatches (gold/silver/rose), L1 editorial grid with campaign tiles, P8 appointment-capable product page (vertical thumbnail rail, metal and size, engraving, "book an appointment"), K6 drawer with gift step.
- **Signature:** **Engraving + gift packaging**: engraving text with a live preview on the product image, gift box choice and gift message in the cart.
- **Features:** ring size guide (printable sizer), metal/stone filters, certification and hallmark panel, lifetime warranty and care, gift finder (by recipient, budget, occasion), appointment booking, virtual try-on later (needs AR/3D).
- **References:** [Mejuri](https://mejuri.com), [Missoma](https://www.missoma.com), [Catbird](https://www.catbirdnyc.com), [Monica Vinader](https://www.monicavinader.com), [CaratLane](https://www.caratlane.com), [Tanishq](https://www.tanishq.co.in); themes [Atelier](https://themes.shopify.com/themes/atelier), [Prestige](https://themes.shopify.com/themes/prestige).
- **Comparison:** strongest overall: Mejuri (luxury feel at accessible prices). Best homepage: Missoma (campaign + bestsellers + gifting). Best product page: Monica Vinader (engraving, materials, size guide). Best filtering: CaratLane (metal, stone, price, occasion at scale). Best phone: Mejuri (clean swipe gallery, sticky add). **Adopt:** engraving and gifting in the buying flow. **Improve:** luxury sites often bury delivery and returns; Gilt shows them by the button.
- **Pages:** standard + ring size guide, book an appointment, gift finder, care and warranty, store locator.
- **Commercial value:** high average order value and strong willingness to pay for design; a showcase theme for the marketplace.
- **Jelly:** needs line-item properties (engraving text, gift message, packaging), gift options at checkout; store visit section already exists for boutiques.

### 4.6 Health, wellness & supplements — **Jelly Vital** (new)

- **Concept:** science-backed wellness: goals, evidence, subscription-first.
- **Audience:** supplement and nutrition brands, functional drinks, Ayurveda brands, health coaches selling products.
- **Design style:** deep green and mint, white, warm yellow accent; display face **Outfit**, numeric data large; rounded rectangles; diagrams and timelines; M4 technical motion (numbers count up, timeline reveals).
- **Structure:** H1 centred logo with a goal strip under it (Sleep, Energy, Gut, Immunity), R9 type-led claim with one clinical stat and the product, C4 benefit card with price per serving, L4 shop by goal and diet (vegan, gluten-free) first, P6 story-scroll (how it works, week 1/4/12 timeline, facts table, studies), K2 cart page with subscription upsell.
- **Signature:** **"Build your stack"**: choose goals, get a bundle with a single subscription price.
- **Features:** subscription vs one-time toggle, price per serving, supplement facts table, research citations, certifications, regulatory disclaimer banner, goal quiz, compare vs alternatives.
- **References:** [AG1](https://drinkag1.com), [Seed](https://seed.com), [Ritual](https://ritual.com), [Thorne](https://www.thorne.com), [Moon Juice](https://moonjuice.com), [Kapiva](https://kapiva.in); themes [Vessel](https://themes.shopify.com/themes/vessel), [Impact](https://themes.shopify.com/themes/impact).
- **Comparison:** strongest overall: Seed (science made beautiful). Best homepage: AG1 (single-product clarity). Best product page: Ritual (traceable ingredients, visible sourcing). Best filtering: Thorne (by need, form, diet). Best phone: AG1 (sticky subscribe, short scroll). **Adopt:** evidence and timelines. **Improve:** avoid medical claims in starter copy; Vital's demo text stays within safe wording.
- **Pages:** standard + goal quiz, build your stack, science/research page, ingredient sourcing.
- **Commercial value:** high repeat purchase, subscription-heavy, large DTC segment.
- **Jelly:** subscriptions are the main dependency (not built); bundles; facts table can use product specifications.

### 4.7 Sports, fitness & outdoor — **Jelly Stride** (new)

- **Concept:** performance gear sold by activity, with technical proof and fit confidence.
- **Audience:** running, cycling, gym, outdoor and adventure brands, sports shops.
- **Design style:** white and graphite with a signal orange used on dark fields or large shapes; display face **Oswald** uppercase, italic for emphasis; action photography at 16:9; thin technical icons; M5 cinematic scroll scenes on the home page only.
- **Structure:** H3 header over the hero with an activity mega menu with images (Run, Train, Hike, Ride), R1 full-bleed action video, C2 square card with tech chips (waterproof, weight) and colour count, L2 dense grid with left sidebar filters (activity, terrain, gender, size, tech), P4 gallery then tech icons, fit guide and model comparison, K1 drawer with "complete your kit".
- **Signature:** **Gear finder**: a three-question finder (activity, terrain, distance/intensity) that lands on a filtered collection.
- **Features:** size by foot length or chest, fit notes ("runs small"), compare models table, terrain/use chart, athlete stories, care/repair, trade-in (later).
- **References:** [On](https://www.on.com), [Tracksmith](https://www.tracksmith.com), [Satisfy](https://satisfyrunning.com), [Rapha](https://www.rapha.cc), [Arc'teryx](https://arcteryx.com), [Patagonia](https://www.patagonia.com), [Gymshark](https://www.gymshark.com); themes [Impact](https://themes.shopify.com/themes/impact), [Motion](https://themes.shopify.com/themes/motion).
- **Comparison:** strongest overall: Tracksmith (craft and tone). Best homepage: On (product + motion). Best product page: Arc'teryx (tech specs, fit, use). Best filtering: Patagonia/Arc'teryx (activity first). Best phone: Gymshark (fast, sticky, size first). **Adopt:** activity-first navigation, compare. **Improve:** spec-heavy pages get long; Stride folds specs into panels below one clear buy box.
- **Pages:** standard + gear finder, compare page, athletes/stories, repair and care.
- **Commercial value:** large category spanning fashion and technical retail; reuses size guide (fashion) and specs/compare (electronics).
- **Jelly:** comparison table and specs come from the Circuit modules; no new backend beyond reviews.

### 4.8 Electronics & gadgets — **Jelly Circuit** (new, first five)

- **Concept:** precise, technical, confident product launches with full specs and comparison.
- **Audience:** consumer electronics brands, accessories (cases, chargers, audio), keyboards and peripherals, gadget shops.
- **Design style:** near-black and cool grey with one electric accent, or a light variant (two theme styles); display face **Space Grotesk**, data in **IBM Plex Mono** (new font); 1:1 product renders on seamless backgrounds; thin outlines, 8px grid lines visible as a motif; M4 technical motion (spec lines draw in, counters).
- **Structure:** H2 with big search and category mega menu, R4 product render with spec callouts (or R1 launch video), C5 outlined card with key spec chips and a compare checkbox, L2 sidebar with technical filters (connectivity, battery, compatibility, price), P4 product page: gallery, colourways, key specs strip, then full spec table, in-the-box, compatibility, compare with siblings, K1 drawer with accessories ("works with").
- **Signature:** **Compare tray**: tick up to four products from any grid, a tray docks at the bottom, compare page shows specs side by side with differences highlighted.
- **Features:** compatibility checker ("works with your device"), in-the-box list, warranty and protection plans as add-ons, firmware/support downloads, Q&A, bundles (device + accessories), pre-order for launches, EMI/finance line.
- **References:** [Nothing](https://nothing.tech), [Teenage Engineering](https://teenage.engineering), [Keychron](https://www.keychron.com), [Anker](https://www.anker.com), [Bang & Olufsen](https://www.bang-olufsen.com), [Peak Design](https://www.peakdesign.com), [boAt](https://www.boat-lifestyle.com); themes [Warehouse](https://themes.shopify.com/themes/warehouse), [Hyper](https://themes.shopify.com/themes/hyper), [Empire](https://themes.shopify.com/themes/empire).
- **Comparison:** strongest overall: Nothing (identity through type and grid). Best homepage: Teenage Engineering (product as object, wit). Best product page: Peak Design (feature chapters, compatibility, video). Best filtering: Keychron/Anker (layout, switch type, connectivity; large catalogue). Best phone: Nothing (clear, sticky buy). **Adopt:** specs strip + full table, compare, compatibility. **Improve:** launch-style pages are hard for merchants to fill; Circuit's sections fill themselves from product specifications.
- **Pages:** standard + compare page, support/downloads, warranty registration, product launch page.
- **Commercial value:** high demand; the spec and compare modules are reused by Stride, Torque, Bazaar and Resthaven.
- **Jelly:** specifications section exists (`product-specifications`); needs spec values typed for filtering and compare (structured, per collection), compare state (frontend), protection-plan add-ons (cart line linking, new).

### 4.9 Home décor & lifestyle — **Jelly Hearth** (new)

- **Concept:** warm, tactile home goods: textiles, ceramics, candles, kitchenware; mood and materials.
- **Audience:** home décor boutiques, bedding and bath brands, ceramics studios, lifestyle concept stores.
- **Design style:** linen, clay and olive palette, multiple soft colour schemes; display face **Lora**; rounded but not pill (8px); 3:2 lifestyle images mixed with 1:1 product; texture close-ups; M1 with gentle parallax.
- **Structure:** H1 centred logo with room mega menu, R7 shoppable scene with hotspots, C7 large landscape lifestyle card alternating with product cards, L6 browse by room/mood then grid, P1 stacked images with material and care, colour swatches as fabric chips, K2 cart page with "finish the room".
- **Signature:** **Shop the room page**: several styled rooms, each with hotspots and a "finish the room" set that adds the matching pieces in one go (other templates may use a single hotspot hero, R7, but not this page).
- **Features:** material and care panel, fabric swatch samples (order free samples), gift registry (later), bundles (sheet set builder), colour swatches.
- **References:** [HAY](https://www.hay.com), [Ferm Living](https://fermliving.com), [Schoolhouse](https://www.schoolhouse.com), [Parachute](https://www.parachutehome.com), [Good Earth](https://www.goodearth.in), [Chumbak](https://www.chumbak.com); themes [Dwell](https://themes.shopify.com/themes/dwell), [Impulse](https://themes.shopify.com/themes/impulse).
- **Comparison:** strongest overall: Ferm Living (calm, editorial). Best homepage: Parachute (lifestyle scenes + clear categories). Best product page: Parachute (materials, care, bundles, fabric swatches). Best filtering: HAY (by room and category). Best phone: Schoolhouse. **Adopt:** shop the room, sample ordering. **Improve:** lifestyle-heavy grids hide prices; Hearth keeps price and colour count on every card.
- **Pages:** standard + shop the room, lookbook, sample request, gift registry (later).
- **Commercial value:** broad and evergreen; the hotspot scene section is reused by Forma, Resthaven and Sprout.
- **Jelly:** hotspots need a new section (image + positioned product links); samples are ordinary products tagged as samples.

### 4.10 Furniture — **Jelly Forma** (existing, upgrade)

- **Concept:** design-led furniture with configuration and delivery confidence.
- **Audience:** furniture brands, design retailers, made-to-order workshops.
- **Design style (existing):** Manrope, warm neutrals, large product photography; structure inspired by Hyper (see `docs/reports/2026-11-07-forma-full-page-audit.md`).
- **Structure target:** H2, R7 room scene with hotspots, C7, L2 (filters sidebar from 1024px, already built), P5 configurator (material/fabric/leg finish change image and price), K2.
- **Signature (to add):** **Configurator with dimensions**: options change the picture; dimension drawing with "will it fit" (door width, room size).
- **Features:** fabric swatch samples, delivery and assembly options, lead time per variant, room planner/AR later, finance line.
- **References:** [Article](https://www.article.com), [Burrow](https://burrow.com), [Floyd](https://floydhome.com), [Hem](https://hem.com), [Vitra](https://www.vitra.com); theme [Hyper](https://themes.shopify.com/themes/hyper).
- **Comparison:** strongest overall: Hem (Scandinavian clarity). Best homepage: Article (shop by room + value). Best product page: Burrow (modular configurator, dimensions, delivery). Best filtering: Article. Best phone: Floyd. **Adopt:** configurator + dimensions + delivery. **Improve:** configurators are often slow; build with preloaded images per option.
- **Jelly:** exists (`jelly-forma`); needs variant images per option (builder has deferred variant photos), delivery options (new), dimension diagram section (new).

### 4.11 Sleep & big-ticket showroom — **Jelly Resthaven** (existing, upgrade)

- **Concept:** trust-heavy showroom for beds, mattresses, sofas and appliances: finance, comparison, guarantees.
- **Audience:** bed and mattress retailers, sofa shops, appliance dealers, showroom businesses.
- **Design style (existing):** Playfair Display + Inter, trust strips, tile-style option pickers, sticky add-to-basket bar.
- **Structure target:** H2 with search bar and logo in the middle (built), R5 promo slideshow with tiles, C2 card with savings and chips (built), L3, P5 large option tiles (built), K2 with add-ons.
- **Signature (existing):** **finance + trial**: monthly price by the price, 100-night trial, comparison of mattress firmness.
- **Features to add:** firmness comparison chart (from Circuit's compare), showroom finder with booking, add-ons (bed frame, removal of old mattress: cart change).
- **References:** [Emma](https://www.emma-sleep.co.uk), [Simba](https://simbasleep.com), [Casper](https://casper.com), [Eight Sleep](https://www.eightsleep.com), [Wakefit](https://www.wakefit.co).
- **Jelly:** exists (`jelly-resthaven`, plan `docs/plans/bed-showroom-theme.md`); add-ons were deferred because they need a cart/order change.

### 4.12 Grocery & daily essentials — **Jelly Basket** (new, first five)

- **Concept:** fast, utilitarian quick-commerce: find, add, repeat, choose a delivery slot.
- **Audience:** grocers, organic stores, kirana-plus shops, farm shops, meal-kit and pantry brands, pharmacies.
- **Design style:** white with fresh green primary and a warm yellow for offers; display face **Poppins** rounded and friendly; dense information, high-contrast prices; small rounded cards; illustrated category icons; M6 (only essential motion: add-to-cart pulse, stepper).
- **Structure:** H8 sticky search-first header with location/delivery slot and "deliver in 30 min / tomorrow 8-10" chip, R5 offer tiles (not one big image), C3 card with weight/unit, price per kg, and an inline **quantity stepper** (Add becomes − 1 +), L7 aisle rows per sub-category with a left category rail on desktop, P7 compact product page (stepper, unit choice, nutrition, "frequently bought together"), K4 bottom sheet on phones and side drawer on desktop with delivery slot and minimum-order bar.
- **Signature:** **Reorder and lists**: "buy again" from past orders, saved lists ("weekly shop"), one-tap add all.
- **Features:** delivery slot picker, minimum order and free-delivery bar, substitutions preference per line, unit pricing, veg/non-veg and diet marks, out-of-stock alternatives, offers aisle, pincode/postcode check.
- **References:** [Blinkit](https://blinkit.com), [Zepto](https://www.zeptonow.com), [BigBasket](https://www.bigbasket.com), [Ocado](https://www.ocado.com), [Thrive Market](https://thrivemarket.com), [Weee!](https://www.sayweee.com), [Misfits Market](https://www.misfitsmarket.com); ThemeForest grocery themes ([search](https://themeforest.net/search/grocery%20shopify)).
- **Comparison:** strongest overall: Ocado (mature full-shop UX). Best homepage: Weee! (offers + aisles, playful). Best product page: Thrive Market (nutrition, member price, diet marks). Best filtering: BigBasket (category depth, brand, price). Best phone: Blinkit/Zepto (steppers, bottom cart bar, speed). **Adopt:** inline steppers everywhere, reorder, slot picker. **Improve:** quick-commerce sites are cluttered; Basket keeps the speed with calmer type and spacing.
- **Pages:** standard + aisles/departments page, offers, buy again, lists, delivery areas check, substitutions info.
- **Commercial value:** huge demand among small local merchants, especially in India; the stepper and slot modules are reused by Larder, Wag, Bloom and Bazaar.
- **Jelly:** needs delivery slots (new backend), saved lists and reorder (new, customer data), substitution preference (line-item properties), unit pricing (product field), pincode check (shipping zones exist under Settings).

### 4.13 Gourmet food & beverage — **Jelly Larder** (new)

- **Concept:** artisanal food and drink brands with appetite appeal and story: coffee, tea, chocolate, sauces, snacks, olive oil.
- **Audience:** DTC food brands, roasters, tea houses, bakeries shipping nationally, specialty delis.
- **Design style:** bold colour blocks per product (each product its own scheme), illustrated labels, display face **Libre Baskerville**, body Work Sans; food photography close and saturated; playful stickers/badges; M3 playful motion (gentle bounce on add).
- **Structure:** H3 transparent over hero, R7 shoppable table spread (a styled meal or pantry shelf with hotspots on each product), C4 card on product colour with flavour notes, L1 grid with recipe tiles inserted, P6 story-scroll (origin, taste notes, how to use, recipes), K1 drawer with "build a box".
- **Signature:** **Build-a-box**: pick N items for a box price; progress shows slots filled.
- **Features:** subscribe (coffee every 2 weeks), grind/size options, taste notes chart, recipes linked to products, gift boxes and messages, allergen and nutrition panel, freshness/roast date.
- **References:** [Graza](https://www.graza.co), [Fly By Jing](https://flybyjing.com), [Omsom](https://omsom.com), [Brightland](https://brightland.co), [Blue Bottle](https://bluebottlecoffee.com), [Olipop](https://drinkolipop.com), [Blue Tokai](https://bluetokaicoffee.com); themes [Savor](https://themes.shopify.com/themes/savor), [Taste](https://themes.shopify.com/themes/taste).
- **Comparison:** strongest overall: Graza (personality, colour, humour). Best homepage: Fly By Jing (story + bestsellers + recipes). Best product page: Blue Bottle (origin, tasting notes, subscription). Best filtering: Blue Tokai (roast, taste, brew method). Best phone: Olipop (bold, quick add, bundles). **Adopt:** product-colour schemes, recipes, build-a-box. **Improve:** playful sites hide shipping facts; Larder shows dispatch day and freshness by the button.
- **Pages:** standard + recipes (blog) and recipe page with "shop the ingredients", build a box, subscriptions, wholesale enquiry.
- **Commercial value:** large DTC segment that buys design; distinct from Basket (brand story vs utility).
- **Jelly:** build-a-box needs bundle pricing (cart change); subscriptions; recipes fit the blog plus metaobjects.

### 4.14 Kids, baby & toys — **Jelly Sprout** (new)

- **Concept:** joyful but trustworthy: shop by age and stage, safety and gifting built in.
- **Audience:** baby brands, toy shops, kids' clothing, educational products, nursery stores.
- **Design style:** soft primaries on cream, rounded everything (24px), hand-drawn icons, display face **Fredoka** (new font), body Nunito Sans; M3 playful motion (wiggle on add, confetti on gift-wrap).
- **Structure:** H1 with age/stage strip under the header (0-6m, 6-12m, 1-2y, 3-5y, 6+), R2 split hero with illustration, C4 card with age badge and "safety tested" chip, L4 shop by age/stage and skill first, P3 centred hero image with tabs (what's in it, safety, age, skills), K6 drawer with gift wrap and message.
- **Signature:** **Age and stage navigator**: pick the child's age (saved in the browser), every collection highlights suitable products.
- **Features:** gift finder by age and budget, baby registry (later), safety certification panel, size by age for clothing, bundles (starter kits), subscription play kits (later).
- **References:** [Lovevery](https://lovevery.com), [Hanna Andersson](https://www.hannaandersson.com), [Maisonette](https://www.maisonette.com), [Mori](https://babymori.com), [KiwiCo](https://www.kiwico.com), [FirstCry](https://www.firstcry.com); themes [Dwell](https://themes.shopify.com/themes/dwell), [Tinker](https://themes.shopify.com/themes/tinker), [Colorblock](https://themes.shopify.com/themes/colorblock).
- **Comparison:** strongest overall: Lovevery (stage-based brand). Best homepage: KiwiCo (age picker up front). Best product page: Lovevery (skills, age, what's inside). Best filtering: FirstCry (age, gender, category at scale). Best phone: Hanna Andersson. **Adopt:** age first. **Improve:** playful must not mean cluttered; Sprout keeps one accent per section.
- **Pages:** standard + gift finder, registry (later), safety and certifications, size by age.
- **Commercial value:** strong gifting demand and repeat buying; reuses gift and bundle modules.
- **Jelly:** age data per product (structured field or tag convention), registry is later work.

### 4.15 Pets — **Jelly Wag** (new)

- **Concept:** characterful pet brand plus repeat-supply shop: personality, food plans, auto-ship.
- **Audience:** pet food and treats, accessories, pet care, local pet stores.
- **Design style:** bright warm palette (tomato, sky, sand), chunky shapes, display face **Bricolage Grotesque** (new font), body Figtree; pet photography with cut-outs on colour; M3 playful.
- **Structure:** H2 with "Dogs / Cats / Small pets" switch as the first nav item, R8 finder hero ("Tell us about your pet": species, size, age), C3 card with stepper for consumables and size chips for accessories, L3, P7 compact page for food (pack size, auto-ship, feeding calculator) and P1 for accessories, K1.
- **Signature:** **Pet profile and feeding calculator**: weight + age → daily amount → pack size and reorder date.
- **Features:** auto-ship subscription, pet profiles on the account (name, birthday treats), size guide for collars/harnesses, ingredient panel (shared with Dew), vet-approved badges, donation/rescue partner block.
- **References:** [Wild One](https://wildone.com), [Fable Pets](https://fablepets.com), [The Farmer's Dog](https://www.thefarmersdog.com), [Chewy](https://www.chewy.com), [Supertails](https://supertails.com), [Heads Up For Tails](https://headsupfortails.com).
- **Comparison:** strongest overall: Wild One (design-led accessories). Best homepage: The Farmer's Dog (finder-first). Best product page: Chewy (auto-ship, sizes, Q&A). Best filtering: Chewy. Best phone: Supertails. **Adopt:** finder hero + auto-ship. **Improve:** Chewy-scale clutter; Wag keeps the Wild One design tone.
- **Commercial value:** steady repeat demand; reuses steppers (Basket), ingredients (Dew), subscriptions (Vital).
- **Jelly:** subscriptions; pet profiles on customer accounts (new customer data).

### 4.16 Handmade, art & stationery — **Jelly Loom** (new)

- **Concept:** maker's studio: the person behind the work, small batches, prints and paper goods.
- **Audience:** artists, illustrators, print shops, ceramicists, stationery brands, Etsy sellers moving to their own store.
- **Design style:** paper white with ink and one pigment accent; display face **Crimson Pro** italic, body DM Sans; visible texture (paper grain), hand-drawn underline marks, framed images with mats; asymmetric layouts; M1.
- **Structure:** H6 side navigation on desktop (studio-style, like a portfolio), R3 collage hero, C6 framed card (mat around the image, edition size "12 of 50"), L1 grid with process/story tiles, P3 centred artwork with size/frame choices and an "in a room" preview, K3 mini-cart popover.
- **Signature:** **Edition and frame picker**: print size × frame × mount with live mockup in a room scene; edition counter.
- **Features:** artist/maker story, commissions request form, limited edition stock counter (stock counter exists), personalised stationery (name/monogram, line-item property), wholesale enquiry, gift cards.
- **References:** [Papier](https://www.papier.com), [Baron Fig](https://baronfig.com), [Appointed](https://www.appointed.com), [Ugmonk](https://ugmonk.com), [Desenio](https://desenio.com), [Society6](https://society6.com); themes [Atelier](https://themes.shopify.com/themes/atelier), [Heritage](https://themes.shopify.com/themes/heritage), [Craft](https://themes.shopify.com/themes/craft).
- **Comparison:** strongest overall: Appointed (craft and tone). Best homepage: Ugmonk (maker story + products). Best product page: Desenio (size, frame, room mockup). Best filtering: Desenio (style, colour, size, orientation). Best phone: Papier (personalisation on phone). **Adopt:** frame/size picker with mockup. **Improve:** portfolio-style sites forget shopping basics; Loom keeps price, size and delivery in the first screen.
- **Commercial value:** very large long tail of small creative sellers; strong fit for "Shopify-simple".
- **Jelly:** personalisation needs line-item properties; frame mockups need variant images.

### 4.17 Flowers, cakes & gifting — **Jelly Bloom** (new)

- **Concept:** date-first gifting: choose the day, write the message, send.
- **Audience:** florists, cake shops, gift hamper businesses, chocolatiers, local delivery gifting.
- **Design style:** blush and deep green, cream; display face **Gloock** (new font) or similar soft serif; rounded image masks; seasonal colour schemes (Valentine's, Diwali, Mother's Day) switchable from theme styles; M3 gentle (petal-like reveals, short).
- **Structure:** H8 with "Deliver to / on" chip (postcode + date) in the header, R8 occasion finder hero (occasion × date × budget), C4 card with "Delivered tomorrow" or "Same day before 2pm", L4 shop by occasion first, P5 options (size, vase, add-ons like chocolates, balloon) changing price, K6 drawer with message card, sender name, delivery date and time slot.
- **Signature:** **Date-first ordering**: pick a delivery date and area before browsing; products that cannot arrive on that date are marked.
- **Features:** cut-off countdown ("order in 2h 14m for same-day"), message card with character limit, add-ons, recurring flower subscription, reminders for occasions (account), photo of the delivered arrangement (later).
- **References:** [Bloom & Wild](https://www.bloomandwild.com), [UrbanStems](https://urbanstems.com), [The Bouqs](https://bouqs.com), [FNP](https://www.fnp.com), [Floward](https://floward.com).
- **Comparison:** strongest overall: Bloom & Wild (brand + subscription). Best homepage: UrbanStems (occasion + delivery date). Best product page: Bloom & Wild (sizes, add-ons, delivery). Best filtering: FNP (occasion, city, delivery type at scale). Best phone: Floward (date and city first). **Adopt:** date and area first. **Improve:** marketplace-style gifting sites are noisy; Bloom stays calm and editorial.
- **Commercial value:** many local merchants, high-margin occasions; reuses delivery slots (Basket) and gift steps (Gilt).
- **Jelly:** delivery date/slot and cut-off times (shared with Basket), message card (line-item/order properties).

### 4.18 Auto parts, tools & hardware — **Jelly Torque** (new)

- **Concept:** fitment-first parts and tools shop: "Will it fit my vehicle/machine?" answered before anything else.
- **Audience:** auto and bike parts sellers, tool shops, hardware, spare parts for appliances, trade suppliers.
- **Design style:** steel grey, white, high-visibility yellow on dark (contrast-safe); display face **Barlow Condensed** (new font), body Barlow; dense, table-friendly layouts; part diagrams; M6.
- **Structure:** H5 two-row header (utility + category bar) with a "My vehicle" garage chip, R8 vehicle finder hero (year, make, model, engine), C8 list rows on collections (part number, fitment badge, stock, price, quantity) with a grid toggle, L5 list/table with bulk add and technical filters, P4 product page: fits/does not fit banner, compatibility table, specs, diagrams, cross-references, K5 order-pad cart.
- **Signature:** **Garage and fitment check**: save vehicles, every page shows "Fits your 2019 Swift" or "Check fit"; search by part number.
- **Features:** part-number search with cross-references (OEM numbers), quick order by SKU, trade pricing (later, B2B), core charge/returns info, install guides and videos, compare (shared with Circuit).
- **References:** [RockAuto](https://www.rockauto.com), [FCP Euro](https://www.fcpeuro.com), [Boodmo](https://boodmo.com), [Toolstation](https://www.toolstation.com); themes [Warehouse](https://themes.shopify.com/themes/warehouse), [Enterprise](https://themes.shopify.com/themes/enterprise), [Spark Automotive](https://automotivetheme.sparkshipping.com/) (fitment-ready, pairs with a fitment app **[search]**). Note: mainstream themes rely on apps for year/make/model data **[search]**.
- **Comparison:** strongest overall: FCP Euro (modern, trusted). Best homepage: Boodmo (vehicle finder first). Best product page: FCP Euro (fitment, OEM numbers, kits). Best filtering: RockAuto (deep, if dated). Best phone: Boodmo. **Adopt:** garage + fitment banner + part-number search. **Improve:** RockAuto's density without its 2005 look.
- **Commercial value:** large, under-served by beautiful themes; reuses compare/specs; fitment is a strong differentiator for Jelly.
- **Jelly:** fitment needs a data model (vehicle table + product links; metaobjects could hold a first version), an import tool, and a fast filter. Heaviest backend item in the list.

### 4.19 Multi-category megastore — **Jelly Bazaar** (new)

- **Concept:** large-catalogue department store: deep navigation, strong search, promotions, many brands.
- **Audience:** general stores, electronics + home marts, regional retailers, marketplaces moving off Amazon/Flipkart.
- **Design style:** white with a strong brand primary, promotional colour tiles; display face **Figtree** heavy, compact type scale; dense but tidy grids; M6.
- **Structure:** H5 two-row header with "All categories" mega menu (3 levels with images), search with suggestions, account and orders; R5 promo slideshow + tile grid; C2 square card with rating, delivery promise, discount; L2 sidebar filters with brand search and counts, sort, infinite or paged; P4 gallery + buy box with offers, delivery estimate by pincode, seller/brand info, specs, Q&A, "frequently bought together"; K2 cart page with saved-for-later.
- **Signature:** **Department landing pages**: every top category gets its own mini-home (banners, sub-category tiles, top brands, deals).
- **Features:** deals of the day with countdown, brand pages, save for later, recently viewed, quick view, compare (Circuit), EMI and COD info, gift cards.
- **References:** [John Lewis](https://www.johnlewis.com), [Target](https://www.target.com), [Argos](https://www.argos.co.uk), [Noon](https://www.noon.com), [Flipkart](https://www.flipkart.com); themes [Empire](https://themes.shopify.com/themes/empire), [Warehouse](https://themes.shopify.com/themes/warehouse), [Enterprise](https://themes.shopify.com/themes/enterprise); ThemeForest [Ella](https://themeforest.net/search/ella%20shopify), [Kalles](https://the4.co/collections/shopify-theme/products/kalles-shopify-theme), [Minimog](https://themeforest.net/search/minimog).
- **Comparison:** strongest overall: John Lewis (trusted, tidy at scale). Best homepage: Target (seasonal, clear). Best product page: Argos (stock, delivery and collection clarity). Best filtering: John Lewis/Empire (counts, brand search). Best phone: Noon/Flipkart (bottom navigation, fast). **Adopt:** department landings, filter counts. **Improve:** avoid the ThemeForest "every widget on" look.
- **Commercial value:** broad appeal to bigger merchants; proves Jelly scales to large catalogues.
- **Jelly:** needs faceted search with counts at scale (backend), brand as a real field (persisted taxonomy is "not built yet"), save for later.

### 4.20 Digital products & creators — **Jelly Spark** (new)

- **Concept:** creator storefront for downloads: templates, presets, e-books, music, courses, licences.
- **Audience:** designers, photographers, educators, musicians, coaches, indie software.
- **Design style:** dark-mode-first option (light style too), display face **Unbounded** (new font), body Inter; gradient-free flat colour blocks; product previews as device mockups and animated previews; M2 snappy.
- **Structure:** H4 minimal bar, R9 creator statement with avatar and social proof, C7 landscape preview card with format and file size chips, L3 chips by type/format, P3 product page: centred preview gallery/video with tabs below for "what's inside" file list, licence choice (personal/commercial) as variants, FAQ, creator bio, K3 mini-cart with instant checkout.
- **Signature:** **Instant delivery + licence picker**: choose licence, pay, download on the thank-you page and by email, with download limits.
- **Features:** pay what you want (later), bundles, free downloads for email sign-up, sample/preview files, update notifications for buyers, affiliate links (later).
- **References:** [Gumroad](https://gumroad.com), [Creative Market](https://creativemarket.com), [Payhip](https://payhip.com); themes [Publisher](https://themes.shopify.com/themes/publisher), [Spotlight](https://themes.shopify.com/themes/spotlight).
- **Comparison:** strongest overall: Creative Market (clean previews, licence clarity). Best homepage: Gumroad creator pages (simple, personal). Best product page: Creative Market (file list, licences, previews). Best filtering: Creative Market. Best phone: Gumroad. **Adopt:** licence variants, file lists. **Improve:** creator pages lack brand; Spark gives a creator a real brand world.
- **Commercial value:** no shipping, fast to launch, growing creator economy; Jelly already built digital delivery (2026-10-22), so value with little backend work.
- **Jelly:** digital delivery exists (outbox emails, download limits); licence = variants; free downloads need zero-price checkout or an email gate.

---

## 5. How all 20 differ (comparison matrix)

| # | Template | Category | H | R | C | L | P | K | Display face | Motion | Signature |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Avenue 2.0 | Fashion editorial | H3 | R3 | C1 | L1 | P1 | K1 | current Avenue face (review) | M1 | Shop the look |
| 2 | Drop | Streetwear & drops | H4 | R6 | C1sq | L3 | P2 | K1 | Syne | M2 | Drop calendar + notify |
| 3 | Zari | Ethnic & occasion | H1 | R2 | C6 | L4 | P5 | K2 | Cormorant Garamond | M1 | Stitching & measurements |
| 4 | Dew | Beauty & skincare | H2 | R4 | C4 | L4 | P6 | K1 | Plus Jakarta Sans | M1 | Routine builder |
| 5 | Gilt | Jewellery | H1 | R9 | C1 | L1 | P8 | K6 | EB Garamond | M1 | Engraving + gift step |
| 6 | Vital | Wellness | H1 | R9 | C4 | L4 | P6 | K2 | Outfit | M4 | Build your stack |
| 7 | Stride | Sport & outdoor | H3 | R1 | C2 | L2 | P4 | K1 | Oswald | M5 | Gear finder |
| 8 | Circuit | Electronics | H2 | R4 | C5 | L2 | P4 | K1 | Space Grotesk + Plex Mono | M4 | Compare tray |
| 9 | Hearth | Home décor | H1 | R7 | C7 | L6 | P1 | K2 | Lora | M1 | Shop the room |
| 10 | Forma | Furniture | H2 | R7 | C7 | L2 | P5 | K2 | Manrope | M1 | Configurator + dimensions |
| 11 | Resthaven | Sleep showroom | H2 | R5 | C2 | L3 | P5 | K2 | Playfair Display | M6 | Finance + trial + firmness |
| 12 | Basket | Grocery | H8 | R5 | C3 | L7 | P7 | K4 | Poppins | M6 | Reorder + lists |
| 13 | Larder | Gourmet food | H3 | R7 | C4 | L1 | P6 | K1 | Libre Baskerville | M3 | Build-a-box |
| 14 | Sprout | Kids & baby | H1 | R2 | C4 | L4 | P3 | K6 | Fredoka | M3 | Age & stage navigator |
| 15 | Wag | Pets | H2 | R8 | C3 | L3 | P7 | K1 | Bricolage Grotesque | M3 | Pet profile + feeding calc |
| 16 | Loom | Handmade & art | H6 | R3 | C6 | L1 | P3 | K3 | Crimson Pro | M1 | Edition & frame picker |
| 17 | Bloom | Flowers & gifting | H8 | R8 | C4 | L4 | P5 | K6 | Gloock | M3 | Date-first ordering |
| 18 | Torque | Auto & tools | H5 | R8 | C8 | L5 | P4 | K5 | Barlow Condensed | M6 | Garage & fitment |
| 19 | Bazaar | Megastore | H5 | R5 | C2 | L2 | P4 | K2 | Figtree | M6 | Department landings |
| 20 | Spark | Digital products | H4 | R9 | C7 | L3 | P3 | K3 | Unbounded | M2 | Instant delivery + licence |

Notes [rec]:
- Checked by script against the rule in 3.2: no pair of templates shares more than three of the six H/R/C/L/P/K choices, and no pair shares both hero and product page. Pairs at exactly three (Dew/Circuit, Dew/Larder, Dew/Vital, Stride/Circuit, Stride/Bazaar, Forma/Hearth, Zari/Sprout, Zari/Vital, Vital/Sprout, Avenue/Larder and a few others) need the closest design review. Re-run the check whenever an archetype choice changes.
- Colour identities are already distinct by field colour: milk (Dew), porcelain (Gilt), ivory/maroon (Zari), black (Drop), mint/green (Vital), graphite/orange (Stride), near-black/electric (Circuit), linen/clay (Hearth), white/green (Basket), product colour blocks (Larder), cream/primaries (Sprout), tomato/sky (Wag), paper/ink (Loom), blush/green (Bloom), steel/yellow (Torque), white/brand (Bazaar), dark/flat (Spark).
- Image crop ratio per template: 4:5 Avenue/Zari (3:4), 1:1 Drop/Circuit/Gilt/Basket/Torque/Bazaar, 3:2 Hearth/Forma, 4:5 Dew/Vital, 16:9 Stride/Spark previews, framed Loom.

---

## 6. Page structure for every template

### 6.1 The universal page set (all 20)

Home · All products/Shop · Category listing (all categories) · Collection list · Collection detail · Product · Search + results · Filtering and sorting (on collection and search) · Cart page · Cart drawer/mini-cart · Checkout · Order confirmation · Login · Register · Password recovery · Account overview · Order history · Order detail (with tracking, built) · Addresses · Wishlist (built in Jelly) · About · Contact · FAQ · Policies (privacy, terms, shipping, returns) · Blog listing · Article · 404 · Password page (built) · Empty states (empty cart, no results, empty wishlist, no orders) · Loading states.

What Jelly already has [Jelly]: home, collection, product, cart, checkout, order confirmation, account pages, search, information pages, 404, wishlist, password page, blog/article sections, slide-out bag (theme setting), order progress. Missing as dedicated templates: "All products" and "Category listing" as their own designed layouts (today they reuse collection/collection list), and designed empty states per theme.

### 6.2 Industry pages per template

| Template | Extra pages / specialised layouts |
| --- | --- |
| Avenue 2.0 | Lookbook, look detail, size guide, stockists |
| Drop | Drop calendar, single drop, archive, raffle sign-up |
| Zari | Measurement guide, styling appointment, bridal lookbook, craft stories |
| Dew | Skin quiz, routine builder, ingredient glossary, ingredient page |
| Gilt | Ring size guide, appointment, gift finder, care & warranty, store locator |
| Vital | Goal quiz, build your stack, science/research, sourcing |
| Stride | Gear finder, compare, athletes/stories, repair & care |
| Circuit | Compare, support & downloads, warranty registration, launch page |
| Hearth | Shop the room, sample request, lookbook |
| Forma | Configurator page, room inspiration, delivery & assembly, samples |
| Resthaven | Firmness compare, showroom finder & booking, finance explained, trial |
| Basket | Departments/aisles, offers, buy again, lists, delivery area check |
| Larder | Recipes + recipe page, build a box, subscriptions, wholesale |
| Sprout | Gift finder by age, registry (later), safety, size by age |
| Wag | Pet finder, pet profile, feeding guide, rescue partner |
| Loom | About the maker, commissions, editions, wholesale |
| Bloom | Occasions, delivery areas & cut-offs, subscriptions, corporate gifting |
| Torque | My garage, vehicle results, part-number search, install guides, trade account |
| Bazaar | Department landings, brand pages, deals, gift cards |
| Spark | Creator about, free downloads, licences explained, buyer library |

### 6.3 Checkout

Jelly's checkout is its own page (`[storeSlug]/checkout/page.tsx`) with Stripe PaymentIntents, so unlike Shopify it **can** carry each template's fonts, colours, buttons and spacing [Jelly]. Limits: the card field is Stripe's (style it through Stripe's appearance options with the template's tokens), security text and legal lines stay fixed, and the step order stays the platform's. Per template: header style, summary placement (right column vs collapsible top on phones), trust badges, industry fields (delivery slot for Basket/Bloom, gift message for Gilt/Bloom/Sprout, measurements summary for Zari, licence summary for Spark). Indian gateways and COD are not built and matter for Zari, Basket and Bazaar.

---

## 7. Shared architecture: 20 different themes without 20 codebases

### 7.1 What Jelly already has [Jelly]

One renderer for preview and live; contract tokens `--j-*`; `SectionFrame`; layout primitives (`Stack`, `Grid`, `MediaFrame`, `TextBlock`); colour schemes; designer theme styles; section presets with content and sketches; product card parts; nested blocks; per-device values; recipes and declarative themes (`theme.json` + `starter.json`, `extends`); theme packages, upload, install, upgrade; design lint, conformance suite, axe checks, `compare-reference.mjs`; Theme SDK and CLI.

### 7.2 What to add (in this order) [rec]

1. **Layout archetype library (biggest change).** Each archetype in section 3.1 becomes a real section or component variant with its own markup in the renderer, chosen by setting or by the theme's starter, not by CSS overrides. For example `header` gains layouts H1-H8, `product-main` gains P1-P8, `cart-drawer` gains K1-K6, `StorefrontProductCard` gains layouts C1-C8 built from the existing card parts. All read the `--j-*` contract, so every theme styles them through tokens first and its own CSS second.
2. **Feature modules** (built once, opt-in per template):

| Module | First template | Reused by | Backend needed |
| --- | --- | --- | --- |
| Size guide drawer + fit notes | Drop | Avenue, Zari, Stride, Sprout, Wag | No (metaobjects) |
| Back-in-stock / notify me | Drop | Avenue, Zari, Gilt, Circuit | **Yes** (sign-ups + email) |
| Countdown + scheduled availability | Drop | Bazaar deals, Bloom cut-off | **Yes** (product availability window) |
| Ingredient panel + glossary | Dew | Vital, Wag, Larder | No (metaobjects) |
| Quiz / finder engine | Dew | Vital, Stride, Wag, Sprout, Bloom, Torque | No (rules in metaobjects) |
| Routine / bundle add-all | Dew | Vital stack, Larder box, Hearth sets | **Yes** for bundle pricing |
| Spec strip + spec table | Circuit | Stride, Torque, Bazaar, Resthaven, Vital | Partly (typed spec values for filters) |
| Compare tray + compare page | Circuit | Stride, Torque, Bazaar, Resthaven | No (browser state) |
| Inline quantity stepper | Basket | Larder, Wag, Torque, Bazaar | No |
| Delivery slot / date picker | Basket | Bloom, Larder | **Yes** (slots, cut-offs, capacity) |
| Reorder + saved lists | Basket | Wag, Torque, Bazaar | **Yes** (customer data) |
| Personalisation (line-item properties) | Gilt | Zari, Loom, Bloom, Sprout | **Yes** (cart, order, emails) |
| Gift step (message, wrap, date) | Gilt | Bloom, Sprout, Larder | **Yes** (same as above) |
| Appointment booking | Gilt | Zari, Resthaven, Forma | App block first, native later |
| Hotspot scene | Hearth | Forma, Resthaven, Sprout, Avenue | No |
| Configurator (option images + price) | Forma | Zari, Bloom, Loom, Resthaven | Variant images per option (deferred in builder) |
| Subscriptions | Vital | Dew, Larder, Wag, Bloom | **Yes** (largest item: billing, schedules, Stripe) |
| Product reviews + ratings | Dew | almost all | **Yes** (no review data today) |
| Fitment / garage | Torque | — | **Yes** (data model + import) |
| Faceted search with counts at scale | Bazaar | Circuit, Torque | **Yes** |
| Licence variants + instant download | Spark | — | Mostly exists (digital delivery) |
| COD + Indian gateways | Zari | Basket, Bazaar | **Yes** (payment provider interface) |

3. **Template spec format.** Each template gets a brief file in `docs/theme-briefs/` that states its archetype codes, tokens, fonts, crop ratios, motion values, modules, starter pages and demo content, so it can be checked by script and partly generated (`scripts/new-theme.mjs` already takes briefs).
4. **Demo content packs.** Industry products, copy and licensed or generated images per template (sources recorded, as Forma does in `SOURCES.md`).
5. **Quality gate per template** (all must pass before a template is listed): design lint at 1280/820/390 with no baseline exceptions, conformance suite, axe AA on every page, Playwright journey (browse → filter → product → add → cart → checkout to payment step), Lighthouse budget (LCP < 2.5s phone, CLS < 0.1), sameness check against all other templates, `compare-reference.mjs` against its two references, and a signed-in editor check that merchants can change colours, fonts, images and sections without breaking the layout.

---

## 8. Priority ranking and roadmap

### 8.1 Scoring [rec]

Scores 1-5 (higher is better; for effort, 5 = least effort). Weighted: demand ×3, merchant appeal ×2, reuse unlocked ×2, effort ×1, visual showcase ×1.

| Rank | Template | Demand | Appeal | Reuse | Effort | Showcase | Weighted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Dew (beauty) | 5 | 5 | 5 | 3 | 5 | 43 |
| 2 | Circuit (electronics) | 5 | 4 | 5 | 3 | 4 | 40 |
| 3 | Basket (grocery) | 5 | 4 | 5 | 2 | 3 | 38 |
| 4 | Drop (streetwear) | 4 | 4 | 4 | 4 | 5 | 37 |
| 5 | Gilt (jewellery) | 4 | 4 | 4 | 3 | 5 | 36 |
| 6 | Avenue 2.0 (fashion, upgrade) | 5 | 5 | 2 | 4 | 4 | 37* |
| 7 | Zari (ethnic wear) | 4 | 4 | 3 | 3 | 5 | 34 |
| 8 | Larder (gourmet food) | 4 | 4 | 3 | 3 | 5 | 34 |
| 9 | Vital (wellness) | 4 | 4 | 3 | 2 | 3 | 31 |
| 10 | Hearth (home décor) | 4 | 4 | 3 | 4 | 4 | 34 |
| 11 | Stride (sport) | 4 | 3 | 2 | 4 | 4 | 30 |
| 12 | Bloom (gifting) | 3 | 4 | 2 | 3 | 4 | 28 |
| 13 | Sprout (kids) | 3 | 4 | 2 | 4 | 4 | 29 |
| 14 | Loom (handmade/art) | 3 | 4 | 2 | 4 | 4 | 29 |
| 15 | Spark (digital) | 3 | 3 | 1 | 5 | 3 | 25 |
| 16 | Wag (pets) | 3 | 3 | 1 | 4 | 3 | 24 |
| 17 | Forma (furniture, upgrade) | 3 | 3 | 2 | 4 | 4 | 27 |
| 18 | Resthaven (showroom, upgrade) | 3 | 3 | 2 | 4 | 3 | 26 |
| 19 | Bazaar (megastore) | 4 | 3 | 2 | 1 | 2 | 25 |
| 20 | Torque (auto & tools) | 3 | 3 | 1 | 1 | 3 | 21 |

\* Avenue scores high but is an upgrade of an existing theme, so it runs alongside phase 2 rather than taking a "new template" slot. Ranks after 5 follow phase order (reuse and backend dependencies), not only the weighted score: Bazaar and Torque come last because they need the most backend work.

### 8.2 Phases [rec]

| Phase | Work | Why this order |
| --- | --- | --- |
| **0. Foundations** | Archetype library v1 (headers H1-H8, product pages P1-P8, cards C1-C8, carts K1-K6, collections L1-L7), template brief format, sameness check, demo-content pipeline; backend: product reviews, line-item properties, back-in-stock sign-ups. | Without real structural variants the 20 would be skins. Reviews and line-item properties are needed by most templates. |
| **1. First five** | Dew, Circuit, Basket, Gilt, Drop. Backend: delivery slots, scheduled availability, bundle pricing (routine add-all can ship first as "add all" without a bundle price). | Highest demand; together they build ~70% of the modules (section 7.2). |
| **2. Fashion and food depth** | Avenue 2.0, Zari, Larder, Hearth, Stride. Backend: COD + Indian gateway interface (Zari), hotspot section. | Reuse phase 1 modules; Avenue upgrade sets the fashion flagship. |
| **3. Subscriptions and gifting** | Vital, Bloom, Sprout, Wag. Backend: subscriptions. | All four depend on subscriptions or gift/date steps. |
| **4. Makers and creators** | Loom, Spark, Forma and Resthaven upgrades. | Low backend need; finish the home family with the configurator. |
| **5. Large catalogue** | Bazaar, Torque. Backend: faceted search with counts, brand/taxonomy persistence, fitment data model and import. | Heaviest backend work; best done once the module library is mature. |

Effort guide [rec]: phase 0 is the largest single block. After it, a new template with existing modules is roughly the size of the Forma work (design, starter, CSS, preview, spec, audit); a template that also needs a new backend module adds that module's work on top.

---

## 9. Recommendation: the first five

1. **Jelly Dew — Beauty & skincare.** Highest weighted score. Forces: concern/ingredient metaobject pages, the quiz engine, routine add-all, reviews UI, story-scroll product page (P6), tinted cards (C4). These modules then serve Vital, Wag, Larder and Sprout.
2. **Jelly Circuit — Electronics.** Forces: spec strip and table, compare tray, technical filters, outlined card (C5), gallery + tables product page (P4). Reused by Stride, Torque, Bazaar and Resthaven.
3. **Jelly Basket — Grocery.** Forces: inline steppers (C3), aisle rows (L7), compact product page (P7), bottom-sheet cart (K4), delivery slots, reorder and lists. Reused by Larder, Wag, Bloom, Bazaar; strong local-merchant demand.
4. **Jelly Gilt — Jewellery.** Forces: line-item properties (engraving, gift message, packaging), gift step cart (K6), appointment block, luxury motion language. Reused by Zari, Loom, Bloom, Sprout; a marketplace showcase piece.
5. **Jelly Drop — Streetwear & drops.** Forces: countdown/scheduled availability, notify me, size guide, reverse product page (P2), full-screen menu (H4). Reused by Avenue 2.0, Zari, Stride; the most visually different from the other four.

Why these five together: their cards, collection layouts and product pages all differ, and no two share more than three of the six structural choices (Dew and Circuit share header, hero type and cart type only), five display faces, five colour fields (milk, near-black, white/green, porcelain, black/acid), and five motion languages. If they look alike, the system has failed early and cheaply.

---

## 10. Decisions for you before design starts

1. **Confirm the 20** (or swap): candidates I left out are eyewear, kitchen and cookware, books, restaurant/takeaway ordering, mobile accessories and B2B wholesale-only. B2B could later be a mode on Torque and Bazaar.
2. **Market focus**: India-first (Zari, Basket, COD, Hindi) or UK/global first. This changes the order of phases 1-2 and whether Indian gateways move into phase 0.
3. **Phase 0 scope**: agree that the archetype library and the backend items (reviews, line-item properties, back-in-stock) come before the first template.
4. **Names**: the proposed names are working names; check trademarks and existing theme-store names before launch.
5. **Imagery**: licensed photography, generated illustrative images (as Forma), or merchant-style sample photos per template.

---

## Sources

Web search today (2026-11-08):
- Shopify Horizon family: [Shopify themes by Shopify](https://themes.shopify.com/designers/shopify), [Instant: Shopify Horizon themes](https://instant.so/blog/shopify-horizon-themes), [Aureate Labs: Horizon overview](https://aureatelabs.com/blog/shopify-horizon-themes-overview/), [NextSky: Horizon review](https://nextsky.co/blogs/review-themes/shopify-horizon-theme), [eSEOspace: Shopify themes in 2026](https://eseospace.com/blog/shopify-themes/)
- Premium themes 2026: [Charle: best Shopify themes](https://www.charleagency.com/articles/best-shopify-themes/), [ecomm.design: best Shopify themes 2026](https://ecomm.design/best-shopify-themes/), [Qualimero: best Shopify themes 2026](https://qualimero.com/en/blog/best-shopify-themes), [FoxEcom: best Shopify themes](https://foxecom.com/blogs/all/best-shopify-themes), [GemPages: paid Shopify themes](https://gempages.net/blogs/shopify/paid-shopify-themes)
- ThemeForest: [The4: Kalles](https://the4.co/collections/shopify-theme/products/kalles-shopify-theme), [NextSky: best Envato Shopify themes](https://nextsky.co/blogs/review-themes/best-shopify-themes-for-envato), [Ecommerce Paradise: ThemeForest review 2026](https://ecommerceparadise.com/envato-market-themeforest-shopify-themes-review-2026-the-best-budget-friendly-premium-themes-for-ecommerce/)
- UX research: [Baymard: current state of product page UX](https://baymard.com/research-articles/current-state-ecommerce-product-page-ux), [Baymard: 2025 review and 2026 roadmap](https://baymard.com/research-articles/year-in-review-2025-and-2026-roadmap), [Shopify: ecommerce UX](https://www.shopify.com/blog/ecommerce-ux)
- Automotive: [NextSky: Shopify themes for car stores](https://nextsky.co/blogs/review-themes/best-shopify-themes-for-car), [Spark Automotive theme](https://automotivetheme.sparkshipping.com/), [AutoFit Pro app](https://apps.shopify.com/autofit-pro)
- Grocery/food: [Shop Theme Detector: grocery themes](https://shopthemedetector.com/blog/grocery-shopify-themes/), [Getsitecontrol: Shopify themes for food products](https://getsitecontrol.com/blog/shopify-themes-for-food-products/), [Bird pickup and delivery app](https://www.birdchime.com/post/bird-shopify-pickup-and-delivery-app)

Brand and theme links in section 4 are references to study [known]; they were not opened in this pass.
