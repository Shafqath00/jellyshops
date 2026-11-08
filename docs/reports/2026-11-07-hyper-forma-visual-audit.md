# Hyper compared with Jelly Forma

Audit date: 7 November 2026. This is a visual/structure audit, not a new accessibility certification. No theme implementation changes were made during this audit.

## Evidence and scope

Captured fresh home desktop, product desktop and home phone views from https://hyper-theme-demo.myshopify.com/ and the local Forma preview. Desktop storefront content is approximately 1280 × 900; phone content is approximately 390 × 844. Forma's preview controls were excluded from its screenshots. Small fractional capture sizes come from browser scaling. Rejected initial captures with the wrong scroll position/dimensions are not used.

Accepted screenshots and an interactive comparison are saved in `C:/Users/newbi/.codex/visualizations/2026/11/07/01a1b4ea-4c0d-7161-bf31-a25f5547001a/hyper-comparison/`.

1. Desktop home — substantial composition mismatch. Both have blue announcements, a search header, categories and a hero, but the density and proportions differ.
2. Desktop product — substantial gallery and purchase-column mismatch. The preview's mock product data also selects a different renderer path from the intended thumbnail gallery.
3. Phone home — usable basic structure, excessive space before the hero and poor image/copy treatment. Category labels appear crowded and uneven, and the primary action is low in the viewport.

Collection, cart, footer, checkout, keyboard interaction and a live installed store were not audited in this run. Screenshots do not prove screen-reader behaviour or complete WCAG compliance.

## Main finding

The first implementation matched ingredients rather than the reference's measured composition. Hyper's merchandising is designed as a coordinated system: compact category shortcuts, isolated product imagery, a short product-led hero headline and a dense product purchase column. Forma combines generic sections, a tall hero, broad room photography and generic preview data. Test success established structural/accessibility checks, not fidelity to Hyper.

## Measured and visible differences

| Area | Hyper observed | Forma observed | Recommended correction |
| --- | --- | --- | --- |
| Header | Utility links, category-aware search and fuller navigation; approximately 178px to the category area | Approximately 197px to categories, less information but more space | Define the announcement, main header and nav row independently, on one shared edge; tighten their heights |
| Categories | Eight shortcuts visible on desktop; 80px product cutouts | Four widely separated shortcuts; 96px room/photo crops; section approximately 249px high | Use 72–80px isolated-object images, shorter labels, consistent gaps and a compact strip; let real catalogue size determine the count |
| Hero position | Begins around y=340 on desktop | Begins around y=446 | Remove about 100px from the preceding header/category stack, using deliberate per-component spacing |
| Hero proportions | Approximately 480px-high landscape panel; whole call to action visible | Approximately 721px high; call to action reaches the lower viewport edge | Set a landscape desktop media ratio/height independent of the preview iframe's height; design phone height separately |
| Hero image and copy | Clear sofa as subject, short single-line title and small supporting label | Busy room image, dark overlay, longer two-line title plus supporting paragraph | Use a matching subject/crop, a short category/product headline and less competing copy; remove dark outer gutters |
| Typography | Rendered headline Instrument Sans, 70px with 84px line height, one line | Manrope, 64px, headline block approximately 141px high across two lines | Tune family/weight/measure/line breaks together; size alone will not match the composition |
| Product gallery | One large product view with a thumbnail rail | Two large images side by side; one is an unrelated room | Use the actual thumbnail viewer and coherent images of the same product; remove room imagery from product media |
| Purchase column | Breadcrumbs, title/price, options and action form a continuous group | Details, options and purchase are separate section frames with large gaps | Group the purchase column as a single coordinated layout, while preserving merchant-editable parts |
| Phone categories/hero | Small shortcuts, hero starts around y=273; button visible in the first screen | Hero starts around y=413; large thumbnails and awkwardly cropped final label; button reaches the bottom | Reduce header/category height, use a defined carousel item width and label baseline, and bring the hero action into view |

## Code causes

- `jellyshops/src/app/globals.css:613–640`: unscoped gallery, section and hero defaults remain active. The gallery defaults to two columns and a 4:5 image treatment. Other legacy rules use 560/700/720px breakpoints, while the contract uses 767/1023px.
- `jellyshops/src/app/globals.css:849–858`: category-card defaults still contribute visual styling. The theme has to override those in addition to the shared base CSS. This is an ownership/cascade problem, not a lack of CSS rules.
- `jellyshops/packages/storefront-themes/src/themes/jelly-forma/theme.css`: the large hero uses `--j-height-lg` (80svh). The category strip uses a general section-spacing setting. The product layout spans the gallery across three independent content rows instead of grouping a purchase column.
- `jellyshops/src/features/theme-preview/template-preview.tsx:37–49`: all sample products get Small/Medium/Large options. `galleryEnabled` is not set on the preview product.
- `jellyshops/packages/storefront-renderer/src/sections/product-sections.tsx:24`: the thumbnail viewer is conditional on `product.product.galleryEnabled`; otherwise the fallback gallery is rendered.
- `jellyshops/src/features/theme-preview/configs.ts:180–201`: the sample catalogue mixes individual products with room photographs, and the stool gallery includes an unrelated dining-room photograph.

## Recommended implementation order

1. **Correct visual ownership and preview fidelity.** Scope legacy defaults to the themes that need them without changing existing stores. Align new-theme component rules to the fixed platform breakpoints. Give Forma realistic product options and the same thumbnail-gallery path as the intended storefront.
2. **Match one desktop home screen.** Lock header row heights, shared edges, 80px category media, category spacing, hero top position, landscape hero dimensions and headline measure against the captured reference. Use original, coherent imagery.
3. **Match the phone home screen.** Design at 390px independently: compact two-row header, roughly three visible shortcuts plus a carousel peek, readable label baselines, and a visible hero action. Recheck at 820px.
4. **Rebuild product composition.** One large gallery, thumbnail rail, coherent product media and a grouped purchase column. Avoid using extra section padding to position each piece.
5. **Expand merchandising deliberately.** Catalogue cutouts, curated product rows, richer menus/search and quick-view/upsell interactions should be evaluated separately. A visual control must have its corresponding behaviour and data.
6. **Add visual acceptance gates.** Compare reference and output together at identical viewport sizes, scroll positions and content states. Keep the existing conformance/axe/design lint checks, but also assert hero position/height, image ratio, purchase-column gaps and phone CTA visibility. Passing a four-heading-size rule or an overflow rule cannot establish visual quality.

Prioritise the header/category/hero composition first; it produces the largest visible improvement with the smallest scope. Then address the product layout. A blank scaffold is no longer necessary, but further unmeasured CSS patches will repeat the same problem.

## Refinement completed after the audit

The original observations above describe the before state. The refinement now isolates Forma from legacy visual defaults, tightens header/category spacing, uses eight 80px product cutouts, gives the desktop hero a fixed 480px landscape height and a short single-line headline, and defines phone proportions independently. Original generated illustrative assets replace the earlier mismatched category and product imagery. The product preview enables the existing thumbnail viewer with two views of the same sample stool and Finish choices. Information, options and purchase now form consecutive grid rows.

Final browser verification passed 13 checks, including seven responsive/accessibility page checks, interactive controls, merchant tokens, alternate layouts, composition and design lint. The design report contains zero findings and the baseline was not changed. Geometry gates require desktop hero top <=360px and height <=520px; phone hero top <=300px with its action above 820px; and gaps between purchase-column sections <=24px. These prevent recurrence of the original 446px/721px desktop and 413px phone composition problems. Screenshots were visually compared against the captured reference.

The review package is `C:/Users/newbi/.codex/visualizations/2026/11/07/01a1b4ea-4c0d-7161-bf31-a25f5547001a/forma-refinement/comparison.html`, with desktop home, phone home and product tabs. It presents reference, before and after together. Hyper's richer menus, comparison, wholesale pricing and upsells remain outside this visual refinement. No staging writes were made.
