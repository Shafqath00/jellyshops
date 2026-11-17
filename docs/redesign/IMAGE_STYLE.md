# Jellyshop image style guide (2026-11-17)

One guide for every home page picture. Every prompt is built from the blocks below: **subject** + **S-PALETTE** + **S-LOOK** + **S-DATA** (when the picture shows store data) + **S-NEGATIVE**. Colours come from `features/brand/brand.css` and are not changed.

## Palette (theme tokens, exact hex)

| Role | Hex | Token |
| --- | --- | --- |
| Dark UI page | #0a0a0a | `--bg` (dark) |
| Dark UI card | #111111 | `--bg-raised` (dark) |
| Dark UI hairline | #2a2a2a | ≈ `--line-strong` on #0a0a0a |
| Light UI page | #fafafa | `--bg` (light) |
| Light UI card | #ffffff | `--bg-raised` (light) |
| Light UI panel | #f2f2f2 | `--bg-sunken` (light) |
| Text on dark | #fafafa / muted #a1a1a1 | `--fg`, `--fg-muted` |
| Text on light | #0a0a0a / muted #5c5c5c | `--fg`, `--fg-muted` (light) |
| Primary (buttons, selected) | #6d4aff, white text | `--btn-primary` |
| Accent line / highlight on dark | #9b87ff | `--accent` |
| Second accent | #22d3ee (dark) | `--accent-2` |
| Warm accent | #ffb547 (dark) | `--accent-warm` |
| Success | #86efac (dark) / #15803d (light) | `--ok` |
| Device frames | matte graphite #1a1a1a | neutral |

No other colours, apart from neutral greys and the natural colours of product photos (clay, cream, linen).

## S-PALETTE (pasted into prompts)

> Colours: dark interface #0a0a0a page, #111111 cards, #2a2a2a 1px lines, #fafafa text, #a1a1a1 secondary text; light interface #fafafa page, #ffffff cards, #f2f2f2 panels, #0a0a0a text, #5c5c5c secondary text; primary buttons and selected states solid #6d4aff with white text; chart lines and highlights #9b87ff; status colours #22d3ee, #ffb547, #86efac used only as small text or tiny dots. Device frames matte graphite #1a1a1a.

## S-LOOK

> Style: flat, realistic product interface, like a crisp screenshot. Straight-on view, no tilt, no perspective distortion (devices may sit at a plain front view). Cards with 12px corner radius, buttons 8px radius, 1px hairlines, generous whitespace, one clean sans-serif typeface (Inter-like), short realistic labels, crisp legible text. Icons are thin outline icons with a 1.5px line. Exactly one soft, neutral, realistic drop shadow directly under the main object (black at about 20% opacity), nothing else. Transparent PNG background.

## S-DATA (one fictional store, used everywhere)

- Platform name in admin screens: **Jellyshop** (logo: white shopping-bag outline + "Jellyshop").
- Merchant store shown to shoppers: **Fern Studio**, handmade ceramics and home goods, prices in £.
- Products: Ceramic vase £42 (terracotta), Glazed mug £18, Bowl set (3) £42, Linen tote £32, Soy candle £26, Stoneware plate £24.
- Dashboard numbers: Sales £24,860 (+12.6%), Orders 312 (+8.4%), Visitors 8,940 (+15.9%), Conversion 3.4% (+0.7 pp); average order £79.70.
- Orders: #10496 Emma Carter £78.00 Paid; #10495 James Wilson £34.00 Packed; #10494 Sophie Reed £128.00 Shipped; #10493 Daniel Brooks £45.00 Paid; #10492 Olivia Hayes £69.00 Shipped.
- Product photos: real-looking studio shots on plain #f2f2f2, soft natural light, no props beyond the product.

## S-NEGATIVE (appended to every prompt, word for word)

> no gradients, no glow, no light effects, no colored or textured background, no border, no outline, no frame, no watermark, no stock-photo look, no 3D blobs, no abstract shapes, no neon, no reflections, no bokeh, no light rays, nothing outside the subject and its shadow.

## Picture types

| Type | Subject rule | Canvas |
| --- | --- | --- |
| Hero | Laptop (Jellyshop dashboard, dark UI) + phone in front right (Fern Studio storefront, light UI) | 1536×1024 |
| How it works | One step each: create store, add products, get paid, publish and grow; one main UI card per picture, at most one small supporting card | 1536×1024 |
| Feature / tour | One focused UI close-up per feature, composed for its bento tile shape (wide, tall or 3:2) | 1536×1024 or 1024×1536, trimmed |
| Templates | Real screenshots of each theme preview (see inventory) | 770×513 |
| Avatars | Flat illustrated head and shoulders, front view, simple shapes, no outlines, on a solid circle of #6d4aff, #9b87ff or #22d3ee | 1024×1024 → 192×192 |
| Open Graph | Solid #0a0a0a, Jellyshop logo, headline "Launch your store. Sell from day one." with "Sell from day one." in #9b87ff | 1200×630 (HTML capture) |

## Acceptance checks (every picture)

1. Transparent background (alpha 0 in all four corners), or solid and equal to its section colour.
2. Zero light semi-transparent fringe pixels (script check), and viewed on magenta, #0a0a0a and #fafafa at 100% and 200%.
3. No gradient, glow, wash, reflection or light streak anywhere in the picture.
4. Text readable and spelled exactly as in S-DATA.
5. Same look as the hero: straight-on, same radius, same shadow, same palette.

A picture that fails any check is regenerated, never fixed with CSS.

## Learned while generating (2026-11-17)

- Ask for a "REAL transparent PNG background (alpha channel, not a checkerboard pattern)" and put every label in quotes.
- Never use ChatGPT's edit to fix one detail: it painted a fake checkerboard and kept the typo. Start a fresh prompt.
- Light cards get no drop shadow. ChatGPT draws their shadow grey, which shows as a pale haze on the dark page ("pure black shadow" did not help).
- Line charts can come out as a neon tube (light core, violet edge). Sample the line's colours; prefer flat bar charts.
- Halo test used for check 2: composite on #0a0a0a; nothing more than 2px outside the subject may be more than 5% lighter than the page.
