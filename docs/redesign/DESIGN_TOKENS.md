# Jelly Shop design tokens (home page, sign-in, onboarding)

**Direction (2026-11-15, third round):** bold, premium, black and white. A standalone SaaS brand: no Jelly Links colours or style anywhere. References: Vercel and Shopify for polish and structure, Linear and Webflow for dark surfaces (see `RESEARCH.md`). Dark mode is the default; a light mode swaps the surfaces. The admin keeps its own `--jk-*` tokens.

## Colour

Only neutrals. The single "accent" is light: soft white glows and gradients.

| Token | Dark (default) | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#0A0A0A` | `#FAFAFA` | Page |
| `--bg-raised` | `#111111` | `#FFFFFF` | Cards, panels, mega menu |
| `--bg-sunken` | `#050505` | `#F2F2F2` | Code blocks, inset areas |
| `--line` | `rgb(255 255 255 / 10%)` | `rgb(0 0 0 / 9%)` | 1px borders |
| `--line-strong` | `rgb(255 255 255 / 18%)` | `rgb(0 0 0 / 16%)` | Inputs, hovered borders |
| `--fg` | `#FAFAFA` | `#0A0A0A` | Headings, primary text (19:1) |
| `--fg-muted` | `#A1A1A1` | `#5C5C5C` | Body copy, captions (≥ 7:1 dark, 6.6:1 light) |
| `--fg-subtle` | `#6E6E6E` | `#8F8F8F` | Meta, disabled. Not for body text |
| `--btn-bg` / `--btn-fg` | `#FAFAFA` / `#0A0A0A` | `#0A0A0A` / `#FAFAFA` | Solid primary button ("Start free") |
| `--glow` | `rgb(255 255 255 / 14%)` | `rgb(0 0 0 / 6%)` | Radial glows behind the hero and CTA |
| `--success` | `#4ADE80` (text on dark only, small dot) | `#15803D` | Live status dots only |

`--fg-subtle` was raised on 2026-11-15 to `#858585` (dark, 5.1:1 or better on every dark surface) and `#6B6B6B` (light, 4.8:1 or better), because it is used for small text (footer, hints) and failed AA before.

### Accent system (2026-11-15, owner's request: "add colour to the system")

The dark foundation stays; a vibrant accent palette sits on top. Code: `features/brand/brand.css`.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--violet` `--blue` `--cyan` `--magenta` `--amber` | `#7C5CFF` `#3B82F6` `#22D3EE` `#F0449A` `#FFB547` | same | Fills, glows, gradients (not text) |
| `--accent` | `#9B87FF` (6.9:1) | `#5B3DF5` (5.9:1) | Eyebrow labels, icons, links |
| `--accent-2` | `#22D3EE` (11:1) | `#0E7490` (5.1:1) | Cyan text and icons |
| `--accent-warm` | `#FFB547` (11.3:1) | `#B45309` (4.8:1) | Amber text and icons |
| `--grad-brand` | violet → blue → cyan, 135° | same | Signature gradient for fills, bars, borders |
| `--grad-warm` | magenta → amber | same | Warm highlights |
| `--grad-text` | `#A78BFA` → `#60A5FA` → `#22D3EE` (weakest 7.3:1) | `#6D28D9` → `#2563EB` → `#0E7490` (weakest 4.95:1) | Gradient words: hero outcome line, final CTA, proof numbers |
| `--grad-text-warm` | `#F472B6` → `#FFB547` (7.5:1) | `#BE185D` → `#B45309` (4.8:1) | Story numbers |
| `--btn-primary` | `#6D4AFF` → `#2563EB` with white text (5.15:1) | same | Primary buttons, "New" tag, badges, billing pill |
| `--glow-accent` / `--glow-cyan` / `--glow-warm` | 40% / 28% / 24% | 28% / 20% / 16% | Glows behind the hero mockup, cards, CTA |
| `--tint-violet` / `--tint-cyan` / `--tint-warm` | 6-8% | 7-9% | Section background tints (each section a different one) |
| `--accent-line` / `--accent-soft` | violet at 45% / 14% | 35% / 9% | Coloured borders, icon tiles |

Rules:
- Text colours above are measured on the page colour; gradient text is measured at every stop. A page-level check (axe plus a script that photographs the background behind every text item axe cannot judge) found nothing below AA at 1440, 768 and 390px in either mode on 2026-11-15.
- Hover glows fade in with opacity only (a pseudo-element), so motion still animates only transform and opacity.
- Icons are Lucide (stroke 1.5) in duotone tiles that cycle violet, cyan and amber.
- Real brand logos appear in their own colours (`LOGOS.md`).
- Images are full colour in one style (`S4` / `T4` in `ASSETS.md`).
- The live dot stays green.

## Typography

| Role | Font | Desktop size / weight / tracking / line-height |
| --- | --- | --- |
| Display (hero h1) | Geist | clamp(3rem, 8vw, 6rem) (≈ 96px), 600, −0.05em, 0.98 |
| Section heading (h2) | Geist | clamp(2.25rem, 5vw, 4rem) (≈ 64px), 600, −0.045em, 1.02 |
| Card heading (h3) | Geist | 1.125–1.5rem, 550, −0.02em |
| Body large | Geist | 1.125–1.25rem, 400, 1.55 |
| Body | Geist | 1rem, 400, 1.6 |
| Labels / eyebrows | Geist Mono | 0.75rem, 500, 0.04em, uppercase |
| Code | Geist Mono | 0.875rem |

Loaded with `next/font/google` (`Geist`, `Geist_Mono`), self-hosted at build time.

## Shape, depth, spacing

| Token | Value |
| --- | --- |
| Radius | buttons 999px (pill) or 10px, inputs 10px, cards 16px, large panels 24px |
| Borders | always 1px `--line`; hover `--line-strong` |
| Shadow | dark: none, depth comes from borders and glows; light: `0 1px 2px rgb(0 0 0 / 5%), 0 12px 32px -16px rgb(0 0 0 / 20%)` |
| Background textures | 64px grid of 1px lines at 6% (masked to fade out), plus 3% grain |
| Grid | 12 columns, 1200px content, gutter clamp(20px, 4vw, 40px) |
| Section spacing | clamp(96px, 12vw, 160px) |
| Focus ring | 2px `--fg` outline, 3px offset |

## Motion

| What | How |
| --- | --- |
| Library | `motion` (Framer Motion) `motion/react`, Lenis for smooth scrolling |
| Easing | `[0.22, 1, 0.36, 1]` (ease-out-quint) for entrances; springs `{ stiffness: 300, damping: 30 }` for hover/tap and tab pills |
| Durations | 0.2s hover, 0.6–0.8s entrances, 0.04–0.08s stagger per word/item |
| Properties | transform and opacity only |
| Scroll | Lenis `lerp: 0.1`; scroll-linked parallax via `useScroll` + `useTransform`; pinned "How it works" uses a tall section with a sticky inner frame |
| Reduced motion | `useReducedMotion()`: no Lenis, no parallax, no marquee movement, entrances become plain fades or none |

## Icons
Lucide (`lucide-react`), stroke width 1.5 everywhere, 16/20px.

## Image style (generated assets)
Premium dark 3D / glass UI renders: matte black and graphite objects, frosted glass panels, crisp white UI, soft white rim light and glow, on near-black `#0A0A0A` with a faint grid. Strictly black, white and greys. No colour, no people photos, no real logos.
