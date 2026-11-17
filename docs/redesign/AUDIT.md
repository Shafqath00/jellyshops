# Gradient, glow and image audit (2026-11-17)

Scope: Jellyshop home page, sign-in screens and onboarding. Searched `src/app/page.tsx`, `src/app/_home/`, `src/app/home-content.ts`, `src/app/home.module.css`, `src/features/brand/`, `src/app/login|signup|auth|onboarding|changelog/`, `src/features/auth/`, `src/app/layout.tsx` for `gradient`, `bg-gradient`, `from-/via-/to-`, `bg-clip-text`, `text-transparent`, `blur`, `radial`, `conic`, `mix-blend`, glow shadows, `drop-shadow`, `backdrop-filter`, mesh/aurora.

Decision (owner, 2026-11-17): the palette stays exactly as it is. Only gradients, glows and the images change.

## 0. Palette before the change (`features/brand/brand.css`)

Every colour below must still be present, with the same value, after the work. Gradient and glow tokens are listed separately because they are removed, not recoloured.

| Token | Dark (default) | Light |
| --- | --- | --- |
| `--bg` | #0a0a0a | #fafafa |
| `--bg-raised` | #111 | #fff |
| `--bg-sunken` | #050505 | #f2f2f2 |
| `--line` | rgb(255 255 255 / 10%) | rgb(0 0 0 / 9%) |
| `--line-strong` | rgb(255 255 255 / 18%) | rgb(0 0 0 / 16%) |
| `--fg` | #fafafa | #0a0a0a |
| `--fg-muted` | #a1a1a1 | #5c5c5c |
| `--fg-subtle` | #858585 | #6b6b6b |
| `--btn-bg` | #fafafa | #0a0a0a |
| `--btn-fg` | #0a0a0a | #fafafa |
| `--grid-line` | rgb(255 255 255 / 6%) | rgb(0 0 0 / 5%) |
| `--danger` | #ff8a8a | #b42318 |
| `--danger-bg` | rgb(255 138 138 / 10%) | rgb(180 35 24 / 7%) |
| `--ok` | #86efac | #15803d |
| `--violet` | #7c5cff | (same) |
| `--blue` | #3b82f6 | (same) |
| `--cyan` | #22d3ee | (same) |
| `--magenta` | #f0449a | (same) |
| `--amber` | #ffb547 | (same) |
| `--accent` | #9b87ff | #5b3df5 |
| `--accent-2` | #22d3ee | #0e7490 |
| `--accent-warm` | #ffb547 | #b45309 |
| `--accent-line` | rgb(124 92 255 / 45%) | rgb(91 61 245 / 35%) |
| `--accent-soft` | rgb(124 92 255 / 14%) | rgb(91 61 245 / 9%) |
| `--btn-primary-fg` | #fff | (same) |
| `--tint-violet` | rgb(124 92 255 / 8%) | rgb(124 92 255 / 7%) |
| `--tint-cyan` | rgb(34 211 238 / 6%) | rgb(34 211 238 / 7%) |
| `--tint-warm` | rgb(255 181 71 / 6%) | rgb(255 181 71 / 9%) |

Gradient and glow tokens (removed): `--grad-brand` (#7c5cff → #3b82f6 → #22d3ee), `--grad-warm` (#f0449a → #ffb547), `--grad-text` (dark #a78bfa → #60a5fa → #22d3ee; light #6d28d9 → #2563eb → #0e7490), `--grad-text-warm`, `--glow`, `--glow-accent`, `--glow-cyan`, `--glow-warm`.

`--btn-primary` was the gradient #6d4aff → #2563eb. It becomes the solid first stop **#6d4aff** (white text 5.15:1), and its hover is the palette's existing light accent **#5b3df5** (6.1:1). No new colour is introduced. Gradient text becomes solid `--accent` (dark #9b87ff, 6.9:1 on #0a0a0a; light #5b3df5, 5.9:1 on #fafafa).

No Tailwind `from-*/via-*/to-*`, `bg-clip-text` or `mix-blend` classes were found; everything is in the CSS modules and `brand.css`. Paths are relative to `jellyshops/src/`.

## 1. Code hits

Action key: **remove** = delete the effect; **solid** = replace with a flat token colour; **keep** = not a decorative gradient (explained).

### Tokens: `features/brand/brand.css`
| Line | What | Action |
| --- | --- | --- |
| 21, 69 | `--glow` (white/black haze) | remove |
| 28-47 | accent set: violet, blue, cyan, magenta, amber fills | keep (palette unchanged) |
| 39 | `--grad-brand` violet→blue→cyan | remove |
| 40 | `--grad-warm` magenta→amber | remove |
| 41, 80 | `--grad-text` (headline gradient text) | remove |
| 42, 81 | `--grad-text-warm` | remove |
| 43 | `--btn-primary` violet→blue button | solid primary |
| 45-47, 82-84 | `--glow-accent`, `--glow-cyan`, `--glow-warm` | remove |
| `--tint-*` (colour layer) | violet/cyan/warm tints, used inside radial gradients | keep the tokens; use them as flat section and card fills |

### Home: `app/_home/hero.tsx`
| Line | What | Action |
| --- | --- | --- |
| 15-16 | word reveal animates `filter: blur(8px)` → 0 | keep (animation, not a colour effect; task says animations stay) |
| 32, 102 | `glowOpacity` + `.heroStageGlow` coloured glow behind the mockup | remove element and transform |
| 38 | `hero-bg.webp` aurora streak background | remove (flat section colour) |
| 61-66 | gradient text on "Sell from day one." (`styles.gradientWord`, per-word slices) | solid primary word |

### Home: `app/_home/sections-bottom.tsx`
| Line | What | Action |
| --- | --- | --- |
| 308, 313-314 | `glowScale` + `.ctaGlow` colour glows in the final call to action | remove |
| 316 | `gradientText` on "live this afternoon." | solid primary |

### Home: `app/home.module.css`
| Line | What | Action |
| --- | --- | --- |
| 74-82 | primary button gradient + hover glow shadow | solid fill, solid hover, focus ring |
| 120-130 | header `backdrop-filter: saturate(1.4) blur(16px)` | solid header background (blur shows colour bleeding through) |
| 229 | `.heroGrid` `mask-image: linear-gradient` fade | remove with the grid picture |
| 237-240 | hero radial glows + `blur(30px)` | remove |
| 258 | `backdrop-filter: blur(8px)` (hero chip) | solid |
| 278 | `.gradientWord` (background-clip text) | remove |
| 289-291 | `.heroStageGlow` radials + `blur(60px)` | remove |
| 301-302 | mockup `drop-shadow`, violet-tinted in light mode | keep a soft neutral drop shadow only (allowed: "subtle drop shadow under a device"); remove the violet tint |
| 314 | floating card `backdrop-filter: blur(14px)` | solid card |
| 322-323 | float icon tiles teal→blue, magenta→amber | flat tinted square, solid icon |
| 335, 905-907 | logo strip / image edge `mask-image: linear-gradient` fades | remove (edge fade is a gradient) |
| 393, 813-817 | bento card top tints + radial hover glow | solid card, 1px border, primary border on hover |
| 408 | mini chart bars `linear-gradient` | solid bars |
| 470-472, 830-833 | radial glow + grid-line pattern made with `linear-gradient` | remove glow; grid pattern removed too (it is a gradient) |
| 588 | `.planFeatured` vertical gradient | solid tint + primary border + badge |
| 685 | dialog backdrop `blur(6px)` | solid dark overlay |
| 775 | `.gradientText` | remove |
| 786-791 | per-section radial tint washes (how, features, templates, sell-everywhere, stories, pricing) | flat section backgrounds alternating `--bg` / `--bg-subtle` |
| 793+ | proof band and story numbers in gradient | solid primary |
| 809-810 | how-it-works images with violet glow shadow | neutral soft shadow or none |
| 824 | template card hover glow | primary 1px border |
| 837 | integrations hub glow | solid primary ring |
| 853-863 | "Most popular" plan gradient border + tint + glow | solid primary border + badge |
| 873-879 | final CTA radial glows + `blur(20px)` | flat section colour |

### Sign-in: `features/auth/components/merchant-auth.module.css`
| Line | What | Action |
| --- | --- | --- |
| 169, 217 | `.artGlow` radial glows + `blur(50px)` | remove |
| 187 | card `backdrop-filter: blur(14px)` | solid |
| 207 | primary button hover glow | solid hover |
| 219 | art frame violet glow shadow | remove |

### Sign-in: `features/auth/components/admin-auth-gate.tsx`
| Line | What | Action |
| --- | --- | --- |
| 46-47, 90 | blurred colour blobs (`blur-3xl`) | remove |
| 49 | `backdrop-blur` card with pinkish shadow | solid card, neutral shadow |

### Onboarding: `app/onboarding/onboarding.module.css`
| Line | What | Action |
| --- | --- | --- |
| 203 | loading skeleton shimmer `linear-gradient` | flat pulse (opacity) |
| 252, 305 | `.stageGlow` radials + `blur(50px)` | remove |
| 263 | translucent preview body (colour shows through) | solid |
| 294 | selected design card glow | primary border only |
| 300 | primary button hover glow | solid hover |
| 306 | stage image violet glow shadow | remove |

## 2. Images

All were checked on a magenta backdrop (shows transparency and edges). Every replacement keeps its current size and aspect ratio so the layout does not move.

| Image | Used on | Size | Problems | Decision |
| --- | --- | --- | --- | --- |
| `hero-bg.webp` | Home hero background | 2400×1350 | aurora light streaks, glow, colour wash | **remove** (flat section colour, no image) |
| `hero-mockup.webp` | Home hero | 1536×1024, transparent | neon violet/cyan chart gradient, glowing device rims, purple UI | **replace** |
| `bg-hero-grid.webp` | Sign-in + onboarding backdrop | 1600×1067 | radial light glow on a grid | **remove** |
| `auth-visual.webp` | Sign-in side panel | 768×1152 | dark violet wash, neon glow, glassy panels | **replace** (flat vector) |
| `onboarding-store.webp` | Onboarding step | 1024² | neon storefront, glowing 3D shop, violet wash | **replace** (flat vector) |
| `onboarding-sell.webp` | Onboarding step | 1024² | neon podiums, glow, gradient bars | **replace** (flat vector) |
| `onboarding-channels.webp` | Onboarding step | 1024² | neon lines, glow, coloured background | **replace** (flat vector) |
| `onboarding-product.webp` | Onboarding step | 1024² | glass card, glow, gradient button | **replace** (flat vector) |
| `og-image.jpg` | Social share card | 1200×630 | aurora streaks, gradient headline | **replace** (solid background, logo, headline) |
| `feature-storefront.webp` | How it works / bento | 1536×1024 | purple wash, glow, gradient buttons | **replace** |
| `feature-products.webp` | How it works / bento | 1536×1024 | purple wash, glow, gradient bars | **replace** |
| `feature-checkout.webp` | How it works / bento | 1536×1024 | neon card, glow, gradient pay button | **replace** |
| `feature-analytics.webp` | How it works / bento | 1536×1024 | neon chart gradient, glow | **replace** |
| `feature-orders.webp` | Bento | 1536×1024 | purple glow, glowing parcel | **replace** |
| `feature-marketing.webp` | Bento | 1536×1024 | glass cards, glow, gradient buttons | **replace** |
| `avatar-1/2/3.webp` | Testimonials | 192², transparent | gradient circle backgrounds (blue→violet, cyan→blue, pink→orange) | **replace** (flat illustrated, solid palette circle) |
| `template-*.webp` (6) | Store designs | 1200×800 | storefront screenshots are fine, but each sits on a black frame with a violet/cyan glow around the browser | **replace** (same storefronts on a transparent or solid background) |
| `brand/jelly-mascot.webp` | not used on these pages | 480², transparent | glossy lime gradient sphere | **keep** (unused; flag for deletion later) |
| `logos/*-color.svg` | Integrations | SVG | brand colours, no effects | **keep** (brand guidelines) |
| `brand/jellyshop*.svg` | Header / footer | SVG | monochrome | **keep** |

Summary: 21 images to replace, 2 backgrounds to remove, logos kept.

## 3. Result (2026-11-17)

Every code hit in section 1 was replaced as planned; the palette in section 0 is unchanged apart from `--btn-primary` (gradient → its own first stop, #6d4aff) and the new `--btn-primary-hover` (#5b3df5, already in the palette).

- **Code search** (same files and patterns as section 1): no `gradient`, `bg-clip-text`, `background-clip: text`, `blur-`, `backdrop-filter`, `radial`, `conic`, `mix-blend` or `mask-image` left. The only matches are comments and the `::backdrop` selector name. The headline words still blur in as part of the existing Motion animation (`filter: blur(8px)` → `0`), kept on purpose.
- **Computed-style check** on the live home page at 1440, 768 and 390px in dark and light, every element and its `::before`/`::after`: 0 gradients, 0 backdrop blurs, 0 blur filters at rest, 0 clipped-text.
- **Also removed:** `bg-hero-grid.webp` (glow grid) behind sign-in and onboarding, the blurred colour blobs in `admin-auth-gate.tsx`, the onboarding loading shimmer (now a flat pulse), the final call-to-action glows (now a flat accent tint with an accent border).
- **Contrast fixes found once the decorative layers were gone:** the dimmed How it works steps (opacity .35, below 4.5:1) now use `--fg-subtle`; the "2 months free" note on the billing toggle no longer uses opacity. Axe (WCAG A/AA) is clean on the home page, sign-in and sign-up in both modes at 1440 and 390px.
- **Images:** see IMAGE_INVENTORY.md and ASSETS.md. The sign-in and onboarding pictures (`auth-visual.webp`, `onboarding-*.webp`) were regenerated the same day as flat vector illustrations on transparent backgrounds; their frames no longer paint a colour behind them.
