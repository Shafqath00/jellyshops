# Design review: Apple-style feel and visual identity (2026-10-29)

How Jelly Shops' storefront themes and editor could feel more responsive and look more distinctive. This uses two lenses: Apple's fluid-interface guidance (response, interruptibility, materials, reduced motion, typography) and the frontend-design skill (distinct identity, restrained decoration, clear copy).

Based on reading `src/app/themes/jelly-minimal.css`, `jelly-avenue.css`, `storefront-base.css`, `globals.css` and the editor page. Nothing was changed and nothing was checked in a browser.

## What is already good

- Both themes read every colour from tokens, use an 8px spacing scale, `clamp()` type sizes, tighter letter-spacing on headings (`-0.02em`) and `text-wrap: balance`.
- `:focus-visible` outlines exist in both themes.
- `prefers-reduced-motion` is handled in each theme and globally.
- Product galleries on mobile use native `scroll-snap`, so swipes already have real momentum.
- Avenue's header goes transparent over a first image and turns solid on scroll, hover or focus. That is good wayfinding.

## Priority 1: quick wins (CSS only, low risk)

| # | Problem | Fix | Where |
|---|---|---|---|
| 1 | **Buttons give no feedback when pressed.** There is no `:active` state in either theme, so on phones a tap shows nothing until the next page loads. | Add `:active { transform: scale(.98); transition-duration: 80ms }` to primary, secondary, add-to-cart and the quantity steppers. Leave colour on hover and add the press feedback on top. | `jelly-minimal.css` §3, `jelly-avenue.css` buttons |
| 2 | **Sticky headers are flat, opaque bars.** | When `data-scrolled="true"`, use a translucent material: `background: color-mix(in srgb, var(--jm-bg) 82%, transparent); backdrop-filter: blur(16px) saturate(160%)`. Swap the hard bottom border for a soft shadow that only shows once the page scrolls. Add a `prefers-reduced-transparency` fallback that makes it solid. | header rules, minimal :195, avenue :216 |
| 3 | **Reduced motion only shortens durations to 1ms.** The 8-second Ken Burns zoom on the Avenue slideshow (`scale(1.05)`, :534) and the 900ms slide fades then jump instead of easing. | Under reduced motion, set `transform: none` on `.jelly-slide-media`, keep a short 200ms opacity cross-fade between slides, and pause autoplay. | avenue :529–534, base :42 |
| 4 | **No `prefers-contrast: more` support.** Muted text and the 12% borders (`--jm-border`) get faint on low-quality screens. | Add a block that raises `--jm-border` to about 40%, uses `--jm-text` for muted text and makes the sticky header solid. Repeat for `--av-*`. | token blocks in both themes |
| 5 | **Zoom on hover everywhere.** Avenue zooms the product card, category card, gallery image and signature card; Minimal zooms two of these. When every image moves, none of them stands out, and it looks templated. | Keep the zoom on product cards only. On the others, change underline or opacity instead. | avenue :400, :610, :764, :814 |
| 6 | **Too many all-caps labels.** About 13 rules across both themes use tracked uppercase (eyebrows, footer headings, testimonial names, checkout step, store hours). This is the most common "generated" look. | Keep it for one role (for example the section eyebrow). Use sentence case and muted colour at `--text-sm` for the rest. Keep letter-spacing tied to size: about +0.02em at 11–12px and 0 at body size. | minimal :98, :295, :296, :471, :672, :807; avenue :105, :328, :632 |
| 7 | **Avenue category cards add a `→` with CSS** (`::after`, :618). Screen readers may read the arrow out, and the arrow is a template habit. | Use an inline SVG chevron with `aria-hidden`, or drop it and let the whole card's hover state show that it is a link. | avenue :618 |
| 8 | **Headings don't use optical sizing.** Fraunces is a variable font with an `opsz` axis. | Add `font-optical-sizing: auto` to headings so large titles get the display cut and small ones stay sturdy. | minimal §2 |

## Priority 2: interaction features (React, medium effort)

1. **Slide-out cart drawer (not built yet; the bag links to the cart page).** This is where Apple's guidance matters most:
   - It slides in from the right and closes to the right, along the same path.
   - Drag it to close with 1:1 tracking (Pointer Events + `setPointerCapture`). On release, use the drag speed to decide whether it closes or snaps back, not only how far it was dragged.
   - Use a spring that can be interrupted (Motion: `type: "spring", bounce: 0.15, duration: 0.3` for a flick, `bounce: 0` when opened by a tap). Never block input while it animates.
   - Dim the page behind it and trap focus. With reduced motion, it fades in place instead of sliding.
   - When an item is added: the bag count changes in the same frame as the drawer opens. No separate toast.
2. **Slideshow swipe.** Arrows and dots only, today. Add horizontal drag with momentum (Apple's projection formula, `d = 0.998`) to choose the next slide, and rubber-band resistance on the first and last slide. Pause autoplay while the shopper is touching it and when the tab is hidden.
3. **Product gallery edges.** Native scroll-snap is good. Add a position indicator (`2 / 5` or thin bars) so shoppers know there are more photos. Today the only hint is that 12–14% of the next photo shows.
4. **Avenue quick view on touch.** It is hidden below the breakpoint (:837), which is the right call. Make sure the whole card stays one large tap target to the product page.
5. **Add-to-cart states.** Show the press feedback on pointer-down, then "Adding…", then "Added", using the same button. Disable it only for the duration of the request so double taps don't add twice.

## Priority 3: editor and admin

1. **Save status is hidden on small screens.** The "Saving… / Not saved / Saved" text has `hidden md:block` (editor `page.tsx:995`), so a merchant on a phone or narrow window never sees "Not saved". Show a small dot that is always visible (grey saving, red not saved) and keep the text for wider screens. This is the most important finding in this section.
2. **Settings panel transitions.** Opening a section's settings should slide in from the side it came from and slide back the same way, and must stay interruptible (clicking another section mid-animation goes straight there).
3. **Preview device switch.** Animate the preview width with one critically damped spring (`bounce: 0, duration: 0.35`) instead of a CSS transition, so switching Desktop → Mobile → Tablet quickly never jumps. (`.theme-preview-viewport` already respects reduced motion.)
4. **Publish confirmation.** Use the same word all the way through: button "Publish", progress "Publishing…", result "Published". Offer "View store" straight after.
5. **Admin labels.** `globals.css` has 28 uppercase rules, for example the inspector header at 10px with 0.08em tracking (:562). At 10px, uppercase is hard to read; use 12px sentence case.

## Priority 4: visual identity (needs your decision)

- **Jelly Minimal** (warm white `#faf9f7`, charcoal, sand, Fraunces serif + Inter) is very close to the most common look in AI-made and template stores today. It is clean, but shops built on it will look like everyone else's. Options, from smallest to largest change:
  1. Keep the palette and give it one signature detail, for example a recognisable product card (a crop ratio or caption layout unique to Jelly) or a distinctive price style.
  2. Offer two or three curated colour presets in the theme settings that move away from cream (for example a cool stone, or a deep green with ivory).
  3. Change the default heading face to something less common than Fraunces.
  Existing stores keep their saved colours and fonts. **Do not bump the theme `version`**; change defaults only.
- **Jelly Avenue** defaults to Arial for both headings and body when no font is chosen (`--av-font-heading` fallback, :31). For an editorial, image-led theme, choose a real typeface as the default. The type is the theme's personality.
- In both themes, put the boldness in one place (Avenue: big imagery; Minimal: type) and keep everything else quiet. Remove decoration that doesn't help shoppers find or buy something.

## Suggested order

1. Priority 1 items 1–4, plus the editor save-status fix (P3 #1). About half a day, CSS plus one component, covered by the existing Playwright theme specs.
2. Cart drawer (P2 #1), its own phase with tests.
3. Slideshow swipe and gallery indicator.
4. Identity decision (P4). Needs your choice before any work starts.
