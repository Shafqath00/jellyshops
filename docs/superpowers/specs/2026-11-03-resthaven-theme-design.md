# Resthaven: bed and mattress showroom theme

Status: proposed design, awaiting user approval.

## Intent and agreed direction

The business needs a fresh developer-created Jelly Shop theme that merchants can select, customize and publish. The user chose a bed and mattress showroom and explicitly asked for a design closely following https://sonno.co.uk/ rather than a different visual style. This is a reusable platform theme, integrated into the existing Store designs catalog and starter installation flow.

Working name Resthaven and internal id `jelly-resthaven`, version `1.0.0`, are builder proposals. Merchant storefront branding comes from the merchant's store identity. Reference inspected on 2026-11-03 at desktop 1280px and mobile 390px, including homepage and a bed product page.

## Approach

Selected direction: ship a platform theme in the repository, reusing the section registry, storefront renderer, starter installation and merchant editor. This makes it available to all merchants after deployment and preserves the shared preview/live rendering contract.

Alternatives considered: uploading a private package only serves an owning store through the currently built upload flow; it does not meet the requested all-merchant distribution. A standalone website would bypass the theme editor and backend installation flow. Neither is the chosen route.

Use declarative manifest settings, starter templates and recipes where appropriate. Add narrowly scoped reusable section settings when the shared sections cannot express the reference layout. Theme-owned shell components are allowed only if needed for the header/search arrangement; avoid copied product/cart business logic. Exact file placement is the builder's decision after inspecting the existing SDK and theme conventions.

## Visual direction

- Cream header and alternating cream sections, close to the observed reference `#f2e8e0`.
- Plum promotion bar, action buttons and price accents, proposed token `#7d285d`.
- White product cards, charcoal text `#353431`, subdued gray `#797571`.
- Playfair Display section headings, available in the platform font catalog; a neutral sans serif for navigation, labels, prices and body copy. Match observed sizing and spacing rather than introducing a new visual identity.
- Wide, image-led merchandising, compact vertical header layers, centered section titles, small card radii, minimal shadows. All theme colors derive from editable tokens.
- Use original or appropriately licensed bed photography, theme-owned icons and editable HTML text. Preserve the composition of Sonno's layout while using merchant identity and original sample copy. Do not place Sonno branding, review counts, discounts or guarantees into merchant defaults.

## Header and homepage

Desktop header: plum promotion strip; cream main row with search left, centered store logo/name and basket right; category navigation below; compact editable benefits row. On mobile: menu trigger, centered identity, search/basket actions and compact benefits treatment.

Homepage order closely follows the reference:

1. Wide bedroom hero with editable offer/headline and three category buttons. Desktop buttons form a horizontal row; phone buttons stack. Use a separate mobile crop/image when needed.
2. Merchant testimonials/reviews area. Sample testimonials are explicitly demo content in the developer preview; starter defaults do not assert verified ratings or external review counts.
3. Four popular category image cards: divan beds, ottoman/storage beds, mattresses, upholstered beds.
4. Featured products, four desktop columns and two mobile columns, with image, title, real catalog price and available variant information. Comparison prices and discounts appear only when supported by actual product data.
5. Editable service/benefit icons.
6. Divan bed image-and-benefits feature with a category action.
7. Bedroom/customer gallery using merchant-owned images.
8. Three shopping steps: choose a bed, order online, arrange delivery; copy editable to match the merchant's real service.
9. Mattress image-and-benefits feature.
10. FAQ accordion, newsletter section and multi-column footer with editable navigation/contact details.

## Other storefront pages

Collection and search: breadcrumbs/title, existing catalog filters and sorting, matching product card treatment, four/two-column desktop/mobile layouts and usable empty states. Do not promise specialized firmness/storage filters unless the existing catalog data supports them; builder can use supported options.

Product: large gallery left and title, real price, available options, quantity and add-to-cart right on desktop; stacked on phone. Bed size, fabric and storage are merchant-defined product options using existing variant support. Add editable delivery/benefit information, product description and FAQ/details sections. Availability, variant pricing, cart and checkout retain existing commerce behavior.

Cart, checkout, account and information pages use the existing platform functionality with consistent theme typography, colors, buttons and spacing. Provide a showroom/contact page layout with merchant-editable address, hours and contact links.

Sonno-specific finance providers, free-swatch ordering, professional-assembly upsells, delivery-date booking and a bespoke multi-step bed configurator are separate features. Do not create decorative controls that imply these services work. Link only to existing merchant pages or supported actions.

## Merchant editing and backend behavior

Manifest exposes colors, typography, button appearance and other supported theme settings. Section controls expose promotional copy, hero imagery, category links, feature content, FAQ entries and other merchant-owned content. Navigation uses the merchant menu system; catalog grids and product pages use the store's actual products.

Theme is discovered/registered in the platform catalog and has a valid starter pack. Install creates the merchant's own draft through the existing authenticated backend workflow, with the usual replace-draft protections. Publish pins its id/version. Preview and live use the same sections and theme CSS. Existing themes and published snapshots retain their behavior.

The starter does not seed fake sale products or create reviews as real customer records. Developer preview uses clearly sample bed/mattress products to demonstrate options and layouts. Merchants without products see useful catalog empty states and can edit the surrounding design.

## Builder choices and acceptance

Builder decides exact section composition, reusable settings needed, image selection, breakpoints and font sizing to achieve the agreed visual fidelity. Start with home, collection and product layouts, then make the remaining standard pages coherent; the delivered theme includes all starter-required page types.

Acceptance: theme appears in Store designs; preview/install/edit/publish use existing flows; key section content and tokens are editable; catalog/variants/cart remain real; no broken navigation or fake service controls; desktop 1280px, tablet 820px and phone 390px layouts are visually reviewed; meaningful theme validation/conformance checks and relevant typechecks pass. Test installation in an isolated local test store. A staging write or deployment is a separate authorized action after the local theme is reviewable.

## Open decision

User approval of this written design is required before implementation. The working name is provisional and can be changed before the first release.
