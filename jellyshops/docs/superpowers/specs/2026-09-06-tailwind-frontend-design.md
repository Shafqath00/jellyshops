# Tailwind frontend conversion design

## Goal

Convert the Jellyshops Next.js frontend from a monolithic semantic CSS stylesheet
to Tailwind CSS v4 utilities while preserving existing user flows, copy,
responsiveness, accessibility, and the Jellyshops visual identity.

## Visual direction

Jellyshops serves independent merchants who need an approachable commerce
workspace and a distinctive public storefront. Keep the existing "jelly"
identity: navy ink, guava pink, citrus yellow, soft paper backgrounds, playful
asymmetric radii, and tactile offset shadows. The signature is the existing
soft-edged, sticker-like surfaces rather than a generic SaaS dashboard.

## Architecture

- Define global Jellyshops colors, radii, shadows, and font stacks with Tailwind
  v4 `@theme` tokens in `src/app/globals.css`.
- Keep only browser resets, focus styles, reduced-motion support, and
  runtime-driven `--store-*` custom properties in global CSS.
- Move static layout, typography, spacing, borders, responsive behavior, and
  hover states into Tailwind `className` utilities in JSX.
- Use `clsx` for conditional Tailwind classes. Do not add a second styling
  library or change application behavior.
- Preserve runtime storefront theming through CSS variables, because store
  themes are data-driven and cannot be fully known to Tailwind at build time.

## Scope

1. Landing page and shared controls.
2. Merchant shell, navigation, empty states, product cards, cart, and forms.
3. Admin routes and store editor components.
4. Public storefront, product, shop, checkout, order, and renderer surfaces.
5. Delete obsolete semantic global selectors after each screen family is
   migrated.

## Acceptance criteria

- `globals.css` is a small Tailwind token/reset/runtime-variable file rather
  than the source of application layout.
- Each frontend screen uses Tailwind utilities for its static presentation.
- The existing responsive layout, keyboard focus, reduced-motion behavior, and
  dynamic store theme values continue to work.
- Unit tests, typecheck, and production Next.js build pass.
