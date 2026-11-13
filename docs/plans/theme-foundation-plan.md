# Theme foundation plan (2026-11-13)

Goal: every existing template, and every template made from now on, is built the same way Shopify themes are: one
settings schema the platform owns, pages composed of main sections with blocks, header and footer as section groups,
one styling model where a theme only sets tokens and its identity, and checks that keep it that way. No new
templates until this is done.

## Where things stand (measured today)

| Theme | Styling model | Product page | Settings schema | Internals styled* |
| --- | --- | --- | --- | --- |
| Resthaven | platform base (`platform-base.css`) | Main product section | own copy, 128 settings | 5 (+4 legacy) |
| Minimal (`jelly-signature`), Harbour | old global rules (`globals.css`) + theme kit | separate sections | own copy, 129 | 9 + kit 31 |
| Avenue | old global rules + theme kit | separate sections | own copy, 130 | 24 + kit 31 |
| Forma, Halo, Diode | "own" (each brings full CSS) | separate sections | own copy, 124-128 | 7 / 20 / 22 |
| Default, Classic, Bold, Elegant, Playful, Fresh Market, Artisan Boutique | old global rules, token presets | separate sections | 20 settings | - |

\* Renderer class names a theme's CSS styles directly instead of named parts or tokens (frozen in
`theme-css-internals.baseline.json`, 122 in all). Each one breaks silently when the renderer changes.

So there are four ways a theme is built, the settings schema exists in nine copies that drift, only one page type
(product) is composed like Shopify, and every store page downloads every theme's CSS (~120 KB compressed).

## Phases

Each phase ends with: unit tests, the theme specs, the design lint (tidy + messy), screenshot comparison of every
theme preview page at 1280/820/390 against the phase start, a commit and a report. Theme ids and versions never
change; stores keep their saved settings; layout changes reach stores through layout revisions with Undo.

0. **Scorecard** (done 2026-11-13). A test that reports, per theme: styling model, internals styled, which page types use main
   sections, where its settings schema comes from, CSS size, demo content, lint findings. It is the progress meter
   for every later phase and the gate for new themes.
1. **One settings schema** (done 2026-11-13). The platform owns the theme settings schema (built once in storefront-themes); a theme's
   `theme.json` gives only its defaults, its colour schemes and type, and which optional groups it shows. The nine
   copies and the scripts that write them go. Setting ids stay, so saved settings keep working; validation is checked
   to give the same answers.
2. **Pages composed like Shopify.** Checked 2026-11-13: collection, search, bag, information page, blog, article
   and 404 already have their main section in every theme (collection header + product grid like Dawn's
   main-collection-banner + main-collection-product-grid, search results, bag, page content, post list, post,
   404 message; essential, so they cannot be deleted). The gaps are the product page (only Resthaven uses Main
   product; the other six stack separate product sections that their CSS lines up with `:has()` and section-type
   selectors) and header/footer groups. Because moving a product page to Main product means rewriting that theme's
   product CSS, phases 2 and 3 run **theme by theme**: for each theme, Main product (layout revision with Undo), then
   its CSS onto the platform base, checked with before/after screenshots. Order: Diode, Halo, Forma (folder themes,
   own CSS), then Minimal + Harbour and Avenue (built-in starters, theme kit). Header and footer groups are built
   once for the platform before the first built-in theme.
3. **One styling model.** (Run with phase 2, theme by theme.) Minimal, Harbour, Avenue, Forma, Halo and Diode move
   onto the platform base: their CSS becomes tokens plus identity (type, hero, signature pieces). `theme-kit.css`,
   `theme-kit-late.css` and the old storefront rules in `globals.css` are deleted once no theme uses them. The seven
   token-preset themes become token presets on the platform base. Internals styled go to 0 (only layout-history
   `legacy.css` files may keep theirs).
4. **Only the active theme's CSS.** Store pages load the platform CSS plus the one theme they use; the editor and
   previews load a theme's CSS when it is shown. Phone Lighthouse checked again.
5. **Every template finished.** Each complete theme gets a demo content pack (products, collections, reviews, pages,
   photos) and a demo store from the generalised installer; its information pages are linked correctly; the
   launch checklist is run for each.
6. **Making a theme.** The CLI scaffold and the generator build on the platform base and must pass the scorecard;
   the developer guide is rewritten for this model; design lint, conformance and scorecard become blocking in CI.
7. **Proof on staging.** Every theme installed on a staging demo store; the shopper journey including a Stripe test
   payment (needs the user's sign-in).

Out of scope here: new templates, add-ons, discounts, Klarna, deployment.
