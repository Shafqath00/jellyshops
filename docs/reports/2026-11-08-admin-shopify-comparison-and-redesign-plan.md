# Jelly Shops vs Shopify: Admin Analysis and Redesign Plan

Nov 8, 2026 · @Shafqath

## Summary

Jelly Shops has a deep storefront and theme editor, but its merchant admin covers roughly a third of what Shopify's admin does, and several existing pages show developer-level wording and raw IDs. The fastest route to a professional platform is: (1) a shared admin design system and page templates, (2) fixing what already exists (orders, products, stock, customers, settings), then (3) adding the missing commerce basics in this order: discounts, real shipping and tax, customer management, inventory locations, purchase orders, analytics.

**How this was checked (8 November 2026).** Both admins were opened in your signed-in Chrome. Shopify: store "My Store" (gsz1ms-fj), 1 test order, 1 product. Jelly Shops: jellyshop.vercel.app, store "new", 5 orders, 7 products. Every main page and most create and detail pages were read. The Jelly Shops code (26 admin pages, backend routes, 48 SQL migrations) was read to confirm what exists behind each screen. Nothing was saved or changed in either store.

**Headline findings**

- Orders are Jelly's strongest admin area: refunds, cancel, shipments, tracking, packed/out-for-delivery, delays, revisions, invoices and staff comments all work. The gaps are creating orders by hand (draft orders), returns in the UI, filters with readable labels, bulk actions and abandoned checkouts.
- Products are close to Shopify on the form itself (photos, rich description, category, options, SKU, barcode, cost, unit price, shipping, customs, SEO, extra fields). Missing: bulk edit, import/export, duplicate, product type/vendor/tags management, sales-channel publishing, scheduled publishing.
- Customers are read-only: no create, edit, notes, tags, marketing consent, segments or export.
- Whole areas Shopify has and Jelly does not: Discounts, Draft orders, Abandoned checkouts, Purchase orders, Transfers, Locations, Gift cards, Segments, Analytics/Reports, Markets, Taxes, Shipping zones and rates (Jelly has one flat rate), Staff and permissions UI, Domains, Policies, Files library page.
- Wording and polish problems a first-time merchant would notice: raw status codes in order filters (`PENDING_PAYMENT`), "Social image media ID" and "Canonical override" on pages, "Hero image URL" on Store appearance, internal `previous-…` menus in Navigation, a variant listed twice in Stock, "No SKU" repeated on the home page, and order and product pages that take 7-10 seconds to load.

**Top priorities (detail in Implementation phases)**

1. Admin design system: page shell, index table, resource form, status badges, empty states (Phase 1).
2. Fix and finish existing pages: readable labels, slow loads, duplicate rows, customers you can edit, settings split into proper pages (Phase 2).
3. Discounts, draft orders and abandoned checkouts: the three missing features that directly earn money (Phase 3).
4. Shipping zones and rates, taxes, locations and inventory history (Phase 4).
5. Analytics, reports and purchase orders (Phase 5); markets, gift cards, staff roles and apps later (Phase 6).

## Feature comparison

Of 50 capabilities compared, 4 are done, 22 exist but need improvement, 16 must be built and 8 are advanced features for later. "Improve" = exists but needs work; "Build" = missing; "Later" = advanced, planned for a future release.

| Area | Capability | Shopify | Jelly Shops today | Action | Phase |
| --- | --- | --- | --- | --- | --- |
| Home | Sales, sessions, orders, conversion with date range | Yes, with channel filter and comparison % | Total sales, order count, live products; no date range, no sessions | Improve | 5 |
| Home | Setup checklist and next steps | Yes (task list, AI assistant) | 5-step readiness card | Improve | 2 |
| Home | Needs-attention queues | Fulfill orders chip | Orders needing attention, running-low list | Improve | 2 |
| Orders | List with filters, saved views, columns | Yes (tabs, saved views, 12 columns, bulk actions) | Status counts, search, filters, sort; raw codes in filters; no bulk actions or saved views | Improve | 2 |
| Orders | Order detail: payment, items, timeline, comments | Yes | Yes, plus revisions and invoices | Improve | 2 |
| Orders | Fulfil, tracking, packing slips | Yes | Shipments, tracking, packed, out for delivery, delay; no packing slip | Improve | 2 |
| Orders | Refund, cancel | Yes | Yes | Done | - |
| Orders | Returns and exchanges | Yes | Backend `createReturn`/`receiveReturn`; no clear UI | Improve | 3 |
| Orders | Edit order (add/remove items) | Yes | Backend `edit` + revisions | Improve | 3 |
| Orders | Draft orders / create order by hand | Yes | No | Build | 3 |
| Orders | Abandoned checkouts + recovery email | Yes | `CheckoutAttempt` table only | Build | 3 |
| Orders | Tags, export, print, archive | Yes | Invoice PDF only | Build | 2 |
| Products | Create/edit form | Yes | Yes (builder): photos, rich text, category, options, price, SKU, barcode, cost, unit price, shipping, customs, SEO, extra fields | Done | - |
| Products | Vendor, product type, tags | Yes | Columns exist, no management | Improve | 2 |
| Products | Bulk edit, import/export CSV, duplicate | Yes | No | Build | 3 |
| Products | Sales channels and scheduled publishing | Yes | Active/Draft/Archived only | Later | 6 |
| Products | Gift cards | Yes | No | Later | 6 |
| Collections | Manual collections | Yes | Yes (name, products, description) | Improve | 2 |
| Collections | Automated (rule-based) collections | Yes (conditions) | No | Build | 3 |
| Collections | SEO, image, template | Yes | Partial (template picker, description) | Improve | 2 |
| Inventory | Stock table: on hand, committed, available, incoming | Yes | On hand, reserved, available; edit + history | Improve | 2 |
| Inventory | Multiple locations | Yes | No (single stock pool) | Build | 4 |
| Inventory | Transfers between locations | Yes | No | Later | 6 |
| Inventory | Low-stock alerts | Via apps/reports | Per-product threshold, home list | Improve | 2 |
| Purchase orders | Suppliers, POs, receive stock | Yes | No | Build | 5 |
| Customers | List, search, profile with orders | Yes | Yes (read-only) | Improve | 2 |
| Customers | Create, edit, addresses, notes, tags | Yes | No | Build | 2 |
| Customers | Marketing consent (email/SMS) | Yes | Newsletter subscribers export only | Improve | 3 |
| Customers | Segments | Yes (7 default + builder) | No | Build | 5 |
| Customers | B2B companies | Yes | No | Later | 6 |
| Content | Pages, blogs, articles | Yes | Yes (pages, blogs, articles, publish/unpublish) | Improve | 2 |
| Content | Menus | Yes | Yes (with leftover internal menus) | Improve | 2 |
| Content | Files library page | Yes | Media API, no page | Build | 3 |
| Content | Metaobjects / custom fields | Yes | Yes ("Custom content", "Extra fields") | Improve | 2 |
| Online store | Themes, editor, publish, history | Yes | Yes, very strong | Done | - |
| Online store | Domains, preferences, password page | Yes | Password page built; domains not built | Build | 4 |
| Payments | Provider setup, methods, capture mode | Yes | Stripe Connect status + dashboard link | Improve | 4 |
| Payments | Payouts, transactions, disputes in admin | Yes | Disputes table; viewed in Stripe only | Later | 5 |
| Settings | Store details, currency, timezone | Yes | Yes (one form) | Improve | 2 |
| Settings | Shipping zones, rates, local delivery, pickup | Yes | One flat rate | Build | 4 |
| Settings | Taxes and duties | Yes | No | Build | 4 |
| Settings | Checkout settings | Yes | Partial (`store_settings_checkout`) | Improve | 4 |
| Settings | Staff, roles, permissions | Yes | Roles in DB (`StoreMembership`), no UI | Build | 5 |
| Settings | Notifications | Yes | 12 order emails with branding and wording | Done | - |
| Settings | Policies, languages, customer accounts | Yes | Info pages; storefront languages in theme | Improve | 4 |
| Growth | Discounts (codes, automatic, BxGy, free shipping) | Yes | No | Build | 3 |
| Growth | Marketing campaigns, attribution | Yes | No | Later | 6 |
| Analytics | Reports, live view, explorations | Yes | No | Build | 5 |
| Markets | Multi-country pricing and currencies | Yes | No | Later | 6 |
| Apps | App store, integrations | Yes | Theme SDK + developer tokens only | Later | 6 |

## Page-by-page findings

Each area lists what was seen in Shopify, what was seen in Jelly Shops, then what to fix and what to add. "Seen" means read in the browser on 8 November 2026; "code" means confirmed in the repository only.

### 1. Home

- **Shopify:** top bar of Sessions, Total sales, Orders, Conversion rate for the last 30 days with % change and a channel filter; Live visitors; an assistant prompt; next-step chips ("Fulfill orders 1"); a setup card (custom domain) and a regional task list.
- **Jelly (seen):** greeting with date, View store and Add product, a 5/5 readiness card, Total sales (£2,048 across 5 orders), Needs attention (2), Live products (3, "5 products running low"), an order queue and a Running low list.
- **Fix:** the running-low list repeats "Utah Ottoman Divan Bed · No SKU · 0 left" five times; show the variant name (Double / Without storage) and hide "No SKU". Total sales says "£2,048 across 5 orders", but £2,048 is the two paid orders (£1,624 + £424); say "from 2 paid orders" and add a date range.
- **Add:** date range picker (Today, 7 days, 30 days, custom) with comparison; sessions and conversion (needs analytics events, Phase 5); a sales-over-time chart; once setup is complete, replace the readiness card with "Next steps" (add a discount, connect a domain, write a blog post).

### 2. Orders

- **Shopify:** list with view tabs (All, Unfulfilled, Unpaid, Open, Archived), save views, 12 columns (Order, Date, Customer, Channel, Total, Payment status, Fulfillment status, Items, Delivery status, Delivery method, Tags, Fulfill by), bulk select, Create order. Detail: customer card with order count, contact, shipping and billing address, conversion summary, tags, timeline with rich-text staff comments and attachments, Refund / Return / Edit / Print / More actions. Drafts and Abandoned checkouts are sub-pages.
- **Jelly (seen):** 9 status counters, search, Order status / Payment status / Sort filters, Previous/Next paging. Detail: Paid/Unfulfilled badges, Revision number, Email settings, Invoice PDF, Printable invoice, Refund, Cancel order, test-mode banner, items with variant and options, Create shipment, Delivery actions (Mark packed), payment summary with Stripe reference, Order revisions, Timeline with staff comments, Edit contact, Update tracking, Resend email.
- **Fix:** filter options show raw codes (`PENDING_PAYMENT`, `PAID`, `CONFIRMED`); use "Waiting for payment", "Paid", etc. The detail page took about 10 seconds to load. The timeline shows "Notification Failed" four times with no reason or retry; show the reason and a Retry button. "Revision 3" in the header while the list shows only Revision 1 is confusing; call revisions "Edits" and show all. "SKU Not recorded" and "Discounts Not recorded" read as errors; hide empty lines. Status counters are 9 boxes; replace with view tabs.
- **Add:** Create order (draft orders with send invoice / mark paid), Abandoned checkouts with recovery email, Returns UI (backend exists), order tags, bulk actions (mark fulfilled, print packing slips, export CSV, archive), packing slip and pick list templates, customer card with lifetime orders and addresses, "Fulfil by" date.

### 3. Products

- **Shopify:** list with Status, Inventory ("-1 in stock for 2 variants"), Category, Channels, Type, Vendor; bulk edit; import/export. Form: title, rich description, media (images, video, 3D), category (drives tax and metafields), price, compare-at, unit price, charge tax, cost, inventory per location, SKU, barcode, sell when out of stock, shipping package, weight, origin, HS code, variants, metafields, SEO preview, status, publishing channels, product organization (type, vendor, collections, tags), theme template.
- **Jelly (seen + code):** list with status tabs (All/Active/Draft/Archived), search, sort, columns Product, Status, Stock, Price, Type, Brand. Builder covers almost the whole Shopify form: name, rich description, specifications, up to 30 photos with library, category with custom categories, options and customer customisations, price, track stock, low-stock warning, original price, SKU, barcode, cost and unit pricing, shipping weight/size/origin, SEO, extra fields, organisation, page layout.
- **Fix:** two forms exist (`/admin/products/new` classic and the builder); keep only the builder. Known bugs from project notes: form stays "Unsaved product" after save (risk of duplicates), variant adjustments show ₹ on a £ store. List takes \~7 s to load. Brand column is empty for all products; Type shows "Other" and "car" (free text).
- **Add:** bulk select with Set status / Add to collection / Add tags / Delete; bulk editor grid; CSV import and export; Duplicate; tags; "Sell when out of stock"; charge-tax flag (with taxes, Phase 4); video media.

### 4. Collections

- **Shopify:** manual or smart collections built from conditions (title contains, type, vendor, tag, price, stock), exclusions, image, SEO preview, channels, template.
- **Jelly (seen):** list of 3 collections with product counts and Create collection; description editor and template picker in code.
- **Add:** smart collections with conditions, collection image, SEO fields, sort order of products, product count and status in the list, empty state that explains collections.

### 5. Inventory

- **Shopify:** per-location table with Unavailable, Committed, Available, On hand, Incoming; Transfers between locations; inventory history.
- **Jelly (seen):** Stock page with Product, SKU, Status, On hand, Reserved, Available, inline Save and History per variant.
- **Fix:** "Utah Ottoman Divan Bed · Single / With storage" appears twice with different stock (duplicate variant combination); block duplicate option combinations on save and add a data repair. The On hand column rendered empty in text. Save per row is slow for many edits; save all changed rows at once.
- **Add:** locations (Phase 4), Incoming (from purchase orders, Phase 5), adjustment reasons (received, damaged, correction), filters (low stock, out of stock), export.

### 6. Purchase orders

- **Shopify:** create PO with supplier, destination location, products, terms, currency, shipping, tags; statuses Draft → Ordered → Partially received → Received → Closed; receiving updates Incoming then On hand.
- **Jelly:** not built. **Add** in Phase 5 (spec in Page specifications).

### 7. Customers

- **Shopify:** list with segment search, email subscription, location, orders, amount spent; create form with name, email, phone, language, email/SMS/WhatsApp consent, address, notes, tags; profile with order history, timeline, comments; 7 default segments.
- **Jelly (seen):** list of 4 customers with initials, email, order count and spend; profile with orders, spend and order history.
- **Fix:** "Shafqath · 1 order · £0" counts a cancelled order as an order; label it. Two records for the same person (shafqathgame@ and shafqathgamer@) show the need for merge later.
- **Add:** Add customer, edit, addresses, notes, tags, marketing consent, timeline, export CSV, segments (Phase 5), filters (has ordered, subscribed, location).

### 8. Content

- **Shopify:** Metaobjects, Files, Menus, Blog posts (Pages live under Online Store).
- **Jelly (seen):** Pages (6 drafts, SEO fields, template), Blog posts (blogs + articles, publish), Custom content (metaobjects; page stayed on the loading screen for 6 s), Navigation menus under Online Store.
- **Fix:** pages editor shows developer fields ("Social image media ID", "Canonical override"); replace with an image picker and hide canonical under Advanced. Navigation lists five "Main menu · previous-…" menus that the merchant never created; hide them as Shopify hides theme internals. All 6 starter pages are Draft with no prompt to publish them.
- **Add:** Files page (media library with upload, search, delete, "used in"), page body preview, URL redirects.

### 9. Online store

- **Shopify:** Themes (current, library, customise), Pages, Preferences (title, meta, social image, password), Domains.
- **Jelly (seen):** Store designs with current design card, 4 designs, Customize, Preview; Navigation; Store appearance (tagline, story, hero image URL, accent, background, display type, published toggle).
- **Fix:** Store appearance overlaps the theme editor and asks for an image URL; fold its useful parts (store published toggle, tagline) into Preferences and remove the rest.
- **Add:** Preferences page (homepage title and description, social sharing image, password protection), Domains.

### 10. Payments

- **Shopify:** providers, payment methods (cards, wallets, PayPal), manual methods, capture method (automatic/manual), customisations, gift card expiry.
- **Jelly (seen):** Stripe account readiness (card payments Active, payouts Active) and a link to the Stripe dashboard.
- **Add:** payouts list and payment transactions (from Stripe API), capture mode, manual payment methods (bank transfer, cash on delivery), a provider interface so Indian gateways can be added (Razorpay), dispute alerts.

### 11. Settings

- **Shopify:** 20 settings pages: General, Plan, Billing, Users, Payments, Checkout, Customer accounts, Shipping and delivery, Taxes and duties, Locations, Apps, Sales channels, Domains, Customer events, Notifications, Metafields and metaobjects, Languages, Customer privacy, Policies.
- **Jelly (seen):** tabs General (store name, slug, contact email, timezone, flat shipping, shipping info text, country/currency), Payments, Notifications (branding + 12 email templates with preview), Extra fields.
- **Fix:** flat shipping inside General hides a key setting; move it to Shipping. Settings tabs should become a left-hand settings list like Shopify.
- **Add:** Shipping and delivery, Taxes, Locations, Checkout, Users and permissions, Domains, Policies, Customer accounts, Plan and billing, Developer tokens and password page as their own items.

### 12. Discounts, analytics, marketing, markets

- **Shopify:** Discounts (amount off products, amount off order, buy X get Y, free shipping; code or automatic; eligibility, minimums, usage limits, combinations, start/end dates), Analytics (dashboard, Reports, Live View), Growth (Attribution, Campaigns), Markets (Catalogs, Rollouts), Abandoned checkouts.
- **Jelly:** none of these exist. Discounts and abandoned checkouts are Phase 3; analytics and reports Phase 5; marketing and markets Phase 6.

## Navigation

The admin moves from 8 to 10 top-level areas: Discounts and Analytics are added, Navigation becomes Menus under Content, Store appearance becomes Online store > Preferences, and Messages & subscribers becomes Customers > Messages.

| Area | Pages (new pages marked *) |
| --- | --- |
| Home | Sales overview, setup and tasks, needs attention |
| Orders | All orders, Drafts*, Abandoned carts*, Returns* |
| Products | All products, Collections, Inventory, Purchase orders* |
| Customers | All customers, Segments*, Messages |
| Discounts* | Discount codes*, Automatic* |
| Content | Pages, Blog posts, Files*, Menus, Custom content |
| Online store | Store designs, Preferences*, Domains* |
| Analytics* | Dashboard*, Reports* |
| Payments | Overview, Payouts*, Transactions* |
| Settings | General, Users*, Shipping*, Taxes*, Checkout* |

Rules: one level of children only; the area a page belongs to stays highlighted on its detail pages; Settings opens a full page with its own grouped list (Store, Selling, Customers, Store data) instead of tabs; the search box at the top of the nav also finds orders, products and customers (Shopify's Ctrl K), not only page names.

## Page specifications

Every list page uses the Index page template and every create/edit page uses the Resource page template (see Design system). Below, each page lists its fields, actions and special states; loading, empty and error states follow the shared rules unless stated.

### Home (`/admin`)

- Header: greeting, store switcher, date range (Today, Yesterday, 7 days, 30 days, custom) with "compared to previous period".
- Metric strip: Total sales, Orders, Average order value, Returning customer rate, Sessions and Conversion rate (last two from Phase 5); each with % change and a sparkline; click opens the matching report.
- Next steps: setup checklist until complete (store details, first product, design published, payments, shipping, domain), then rotating suggestions.
- Needs attention: unfulfilled paid orders, orders with failed notifications, out-of-stock variants, unread messages; each row links to a filtered list.
- Empty state (new store): "Add your first product" and "Choose a store design" as two large cards.

### Orders list (`/admin/orders`)

- View tabs: All, Unfulfilled, Unpaid, Open, Archived + saved custom views.
- Columns (choosable): Order, Date, Customer, Total, Payment, Fulfilment, Items, Delivery method, Tags, Channel.
- Filters as chips: payment status, fulfilment status, date, tag, delivery method, risk; search across order number, customer, email, product, SKU.
- Bulk actions: Mark as fulfilled, Print packing slips, Add/remove tags, Archive, Export CSV.
- Primary action: Create order.

### Order detail (`/admin/orders/:id`)

- Header: order number, payment and fulfilment badges, date, channel; actions Refund, Return, Edit, Print (invoice, packing slip), More (Duplicate, Cancel, Archive, Resend confirmation, View status page).
- Main column: Unfulfilled / Fulfilled cards per shipment (items, quantity, Create shipment, tracking, delivery steps), Payment summary (subtotal, discounts with code, shipping, tax, total, paid, refunded, balance), Timeline (events, staff comments with attachments and @mentions, notification results with Retry).
- Side column: Notes (customer note), Customer (name, order count, contact, shipping and billing address, Edit), Tags, Conversion (landing page, referrer, UTM; Phase 5), Fraud/risk (Phase 6).
- Rules: refund cannot exceed balance; cancelling a paid order offers refund + restock; a return creates a return record with reason and restock option.

### Draft order / Create order (`/admin/orders/new`)

- Products (search, add custom item), quantities, line price override, discount on line or order, shipping (rate or custom), tax (auto), customer (search or create), notes, tags.
- Actions: Save draft, Send invoice (email with checkout link that expires in 30 days), Mark as paid, Collect payment (card through Stripe).
- States: Open, Invoice sent, Completed (becomes an order).

### Abandoned checkouts (`/admin/orders/abandoned`)

- Columns: Checkout, Date, Customer, Region, Recovery status (Not recovered / Recovered), Total; Export; detail shows items, contact, and Send recovery email (with optional discount code).
- Automatic recovery email after 1, 6 or 24 hours (setting).

### Product list and builder

- List: tabs All/Active/Draft/Archived; columns Product, Status, Inventory ("40 in stock for 4 variants"), Category, Type, Vendor, Collections; filters Status, Type, Vendor, Tag, Collection, Stock; bulk actions; Import, Export; Add product.
- Builder (keep, single form): add Tags, Vendor (picker with create), Type (picker), Collections (multi-select), "Continue selling when out of stock", Charge tax, Status + Publish date, Duplicate, Delete (with confirm), Archive. Sticky save bar appears on change, with Discard.
- Variants: block duplicate option combinations with an inline error ("Double / With storage already exists").

### Collections

- Type: Manual or Smart. Smart: "Products must match all/any conditions" with rows (field, operator, value): title, type, vendor, tag, price, compare-at price, weight, stock, variant title. Live count of matching products.
- Fields: title, description (rich text), image, sort order (Best selling, A-Z, price, newest, manual), SEO title/description/handle, page layout, status.

### Inventory (`/admin/products/inventory`)

- Location switcher; columns Product/variant, SKU, Unavailable, Committed, Available, On hand, Incoming; editable Available and On hand with a reason; filters (low, out of stock); bulk save bar; history drawer per variant (date, change, reason, staff, reference).
- Transfers (Phase 6): origin, destination, items, status Draft / In transit / Received.

### Purchase orders (`/admin/products/purchase-orders`)

- Supplier (name, contact, address; saved list), destination location, payment terms (none, on receipt, net 7/15/30/60, due on date), currency, expected arrival, shipping carrier and tracking, products with supplier SKU, cost and quantity, shipping and other costs, notes, tags.
- Actions: Save draft, Mark as ordered (optionally email supplier PDF), Receive (per line, partial), Close. Statuses: Draft, Ordered, Partially received, Received, Closed.
- Receiving moves quantity from Incoming to On hand and writes inventory history with the PO reference.

### Customers

- List: columns Name, Email subscription, Location, Orders, Amount spent, Tags; filters; segments dropdown; bulk Add tags, Export, Delete.
- Create/edit: first and last name, email, phone, language, email and SMS consent (with "customer agreed" wording), addresses (default shipping), notes, tags, tax exempt (Phase 4).
- Profile: summary (customer since, orders, total spent, average order), last order card, order list, timeline with staff comments, marketing status, addresses, Send email, Create order for this customer.
- Segments (Phase 5): saved filters (purchased at least once, more than once, never, subscribers, abandoned checkout in 30 days) + simple builder.

### Discounts (`/admin/discounts`)

- Types: Amount off products, Amount off order, Buy X get Y, Free shipping.
- Method: code (with Generate) or automatic (title); value (% or fixed); applies to (all, collections, products); minimum (none, amount, quantity); eligibility (all customers, segments, specific customers); limits (total uses, one per customer); combinations (product, order, shipping); start and end date/time.
- Summary card on the right updates live, as in Shopify ("Amount off products · All customers · No minimum · Active from today").
- List: Title/code, Status (Active, Scheduled, Expired), Method, Type, Used count.

### Content and Online store

- Pages: title, body (rich text), visibility (published, hidden, scheduled), template, search listing preview (title, description, URL handle), social image picker. Advanced (collapsed): canonical URL, hide from search.
- Files: grid/list of media, upload (drag and drop, 20 MB images), search, filter by type, "used in" count, delete with warning if used, copy link.
- Menus: list only merchant menus; tree editor with drag to reorder and nest, link picker (product, collection, page, blog, URL).
- Preferences: homepage title and meta description, social sharing image, password protection, store published toggle.
- Domains (Phase 4): connect existing domain (DNS instructions + verification), primary domain, SSL status, redirect to primary.

### Payments and Settings

- Payments: provider card (Stripe status), payment methods shown to shoppers, capture (automatic/manual), manual methods (bank transfer, cash on delivery), payouts table (date, amount, status) and transactions (Phase 5).
- Settings index: left list grouped as Store (General, Plan and billing, Users and permissions), Selling (Payments, Checkout, Shipping and delivery, Taxes, Locations, Markets), Customers (Customer accounts, Notifications, Privacy, Policies), Store data (Extra fields, Languages, Domains, Developer access).
- Shipping: zones (countries/regions), rates per zone (flat, by weight, by order price, free over amount), local delivery (postcodes, fee, minimum), pickup in store, package presets, delivery date estimates.
- Taxes: tax region per country, rate overrides, prices include tax (yes/no), charge tax on shipping, tax-exempt customers; VAT/GST number on invoices.
- Users and permissions: invite by email, roles Owner, Admin, Staff, Developer with per-area permissions, remove, transfer ownership; activity log (AuditEvent already exists).

## Design system

Today each admin page styles itself (cards, buttons and tables differ between Orders, Products, Stock and Settings). Build one admin kit first, in `jellyshops/src/components/admin/`, on top of the existing shadcn tokens (`shadcn-theme.css`) and Lucide icons, then move pages onto it. The Jelly identity: warm white surfaces, charcoal text, one jelly accent colour, rounded 12px cards, Inter for UI.

### Foundations

| Token | Value | Use |
| --- | --- | --- |
| Spacing | 4, 8, 12, 16, 24, 32, 48 px | Card padding 16 (20 on desktop), page gutter 16 phone / 32 desktop |
| Type | 12 / 13 / 14 / 16 / 20 / 24 px, weights 400, 550, 650 | Body 14, table 13, page title 20-24, labels 13/550 |
| Radius | 8 (inputs, buttons), 12 (cards), 999 (badges) |  |
| Colour roles | surface, surface-subdued, border, text, text-subdued, accent, success, warning, critical, info | Light and dark from the same tokens; text AA 4.5:1 |
| Layout widths | full (lists), 1000px (detail: 2/3 + 1/3 columns), 640px (settings forms) | Side column drops under main below 1024px |
| Motion | 150ms ease-out, none with reduced motion | Drawers, toasts, save bar |

### Components to build (and where they replace current code)

| Component | Behaviour | Replaces |
| --- | --- | --- |
| `AdminPage` | Title, back link, badges, primary + secondary actions, "More actions" menu, optional tabs | Hand-made headers on every page |
| `IndexTable` | Tabs/views, search, filter chips, sortable columns, row select + bulk bar, paging with counts, row click, sticky header, mobile card mode | Orders, Products, Stock, Customers, Collections tables |
| `ResourceForm` + `SaveBar` | Card sections, sticky "Unsaved changes · Discard · Save" bar, leave-page warning, field-level errors from the API | Product builder, settings, pages, collections |
| `StatusBadge` | One map from internal status to label + tone (e.g. `PENDING_PAYMENT` → "Waiting for payment", warning) | Raw enum text in filters and lists |
| `EmptyState` | Illustration, one-sentence purpose, primary action, "Learn more" | "No messages yet" style lines |
| `Skeleton` | Shape-matched loading for table rows, cards and detail pages | "Loading orders…" text |
| `Toast` + `Banner` | Success toasts after save; page banners for warning/critical with action | Inline alerts |
| `ConfirmDialog` | Destructive confirm naming the item and consequence | Window confirm / none |
| `Picker` | Searchable modal to pick products, collections, customers, files | Ad-hoc pickers |
| `Timeline` | Events + comments with rich text, attachments, @mentions | Order timeline only |
| `MoneyField`, `DateRangePicker`, `TagInput`, `AddressForm` | Locale currency formatting, presets, create-on-type, country-aware fields | Repeated inputs |
| `HelpTip` | ⓘ next to a label: one-line explanation | Missing explanations |

### Writing and beginner rules

- Every page title has a one-line description under it saying what the page is for (Jelly already does this on several pages; make it universal).
- Never show internal values: enum codes, IDs, handles like `previous-…`, "Not recorded". Hide empty data or say "None".
- Buttons say what happens: "Send invoice", "Mark as paid", not "Submit".
- After every save: toast ("Product saved") and, where useful, the next step ("Add it to a collection").
- Destructive actions name the thing and whether it can be undone.
- Use the same words everywhere: "Fulfil" (UK spelling, matching the store currency GBP), "Stock", "Customers", "Store design".

### Responsive and accessible

- Works from 360px: navigation becomes a drawer, tables become stacked cards with the 3 key fields, side column moves below.
- Keyboard: every action reachable, focus visible, `Esc` closes overlays, `/` focuses search; tables have proper headers; axe checks in tests (the editor already does this).

## Key workflows

These six journeys are the acceptance tests for "a first-time merchant can run the store". Each must be completable without documentation, and each step must show what happens next.

**A. First sale (new merchant, target under 20 minutes)**

1. Sign up → store name, country, currency (sets tax and shipping defaults).
2. Home shows the checklist; "Add your first product" opens the builder with tips beside each card.
3. Save → toast "Product saved" + "Next: choose a store design".
4. Store designs → pick one → editor → Publish.
5. Payments → Connect Stripe (returns to Jelly with status).
6. Shipping → one zone with a default rate is pre-filled; merchant confirms.
7. Checklist complete → "Your store is live" with the store link and Share.

**B. Fulfil an order**

1. Home "3 orders to fulfil" → Orders filtered to Unfulfilled.
2. Select orders → Print packing slips (bulk).
3. Open order → Create shipment → choose items, carrier, tracking → "Send shipping email" ticked by default.
4. Badge changes to Fulfilled; timeline shows the email result; failed emails show reason and Retry.

**C. Refund or return**

1. Order → Return → choose items, reason, restock yes/no.
2. When received → Refund: amount pre-filled from returned items, shipping refund optional, reason, notify customer.
3. Payment card shows Refunded / Partially refunded; stock rises if restocked.

**D. Phone or WhatsApp order (draft order)**

1. Orders → Create order → add products, customer (create inline), shipping.
2. Send invoice → customer pays via link → order created and stock reserved; or Mark as paid for cash/bank transfer.

**E. Run a sale**

1. Discounts → Create → Amount off products → 20% → collection "Beds" → start Friday 00:00, end Monday 23:59.
2. Summary card confirms; storefront shows the sale price and the automatic Sale badge (theme setting exists).
3. Discount list shows Scheduled → Active → Expired with usage count.

**F. Restock**

1. Home "5 variants running low" → Inventory filtered to low stock.
2. Select → Create purchase order → supplier, quantities pre-filled to reach the low-stock threshold × 2.
3. Mark as ordered (email PDF) → Incoming shows the quantity → Receive → On hand rises, history notes the PO.

## Backend, database and API

The backend (Express 5, raw `pg`, Supabase Postgres, Stripe Connect) already has the right shape: every merchant route is `/api/stores/:storeId/...` behind `requireStorePermission`, and order management (edit, return, refund, cancel, fulfil, tracking, notes, revisions) is complete in `backend/src/commerce/order-management.ts`. New features should follow the same module pattern (`routes.ts`, `service.ts`, `repository.ts`, tests with the pglite harness).

### New tables (one migration per feature, RLS on, `jelly_backend` policy as for recent tables)

| Feature | Tables | Notes |
| --- | --- | --- |
| Discounts | `Discount`, `DiscountCode`, `DiscountRedemption`, `DiscountTarget` | Evaluate server-side in `checkout-cart.ts`; store applied discounts on `OrderItem` and `Order` snapshots; unique code per store (case-insensitive) |
| Draft orders | `DraftOrder`, `DraftOrderItem` | Converting reuses checkout pricing and reservations; invoice link = signed token, 30-day expiry |
| Abandoned checkouts | reuse `CheckoutAttempt` + `CheckoutRecovery` | Needs email captured before payment; recovery email through existing `jelly_queue_notification` outbox |
| Customers | extend `StoreCustomer` (phone, notes, tags, marketingEmail, marketingSms, consentUpdatedAt, taxExempt) + `CustomerNote`, `CustomerEvent` | Merge later |
| Tags | `Tag` + join tables per resource, or `tags text[]` with GIN index | Simpler: `text[]` on Order, Product, Customer |
| Locations | `Location`; move `InventoryLevel` to (variantId, locationId) | Migration creates one default location per store and copies levels |
| Purchase orders | `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrderReceipt` | Receiving writes `InventoryAdjustment` with reason `received` and PO reference |
| Shipping | `ShippingZone`, `ShippingZoneCountry`, `ShippingRate` (flat, weight, price, free-over), `LocalDeliveryArea` | Replace `StoreSettings` flat rate; keep flat rate as the default zone |
| Taxes | `TaxRegion`, `TaxRate`, `StoreTaxSettings` | Start with manual rates per country/region; prices-include-tax flag; integrate a tax service later |
| Collections | add `rules jsonb`, `disjunctive bool`, `sortOrder` to `Collection` | Smart membership recomputed on product save and nightly |
| Staff | use `StoreMembership`; add `StaffInvitation`, `permissions text[]` | Owner-only actions guarded server-side |
| Analytics | `StorefrontEvent` (session, page view, add to cart, checkout started, purchase) partitioned by month; daily rollup `StoreDailyMetrics` | Write from storefront via a small public endpoint with rate limiting; reports read rollups |
| Saved views | `AdminSavedView` (resource, name, filters jsonb, columns) | Per store, shared by staff |
| Gift cards (later) | `GiftCard`, `GiftCardTransaction` | Code hashed; balance in minor units |

### API additions

- Index endpoints accept one shared query shape: `q`, `filters` (field/operator/value), `sort`, `direction`, `cursor`, `limit` (max 100), and return `{ items, nextCursor, total }`.
- Bulk endpoints: `POST /api/stores/:id/{orders|products|customers}/bulk` with `{ action, ids, params }`, processed in a job for more than 50 items, with a status endpoint.
- CSV import/export for products and customers through the same job runner; files in media storage, link emailed.
- Readable labels live in the frontend `StatusBadge` map; the API keeps enum codes.

### Performance (measured: order and product pages 7-10 s)

- Add a server timing header and log slow queries; likely causes are cold Firebase Function starts and N+1 queries for variants and media. Set a minimum instance for the API, batch variant/media queries, and add `EXPLAIN`-checked indexes for list filters.
- Target: list pages under 1 s and detail pages under 1.5 s at p75.

### Integrations

- Payments: wrap Stripe behind a `PaymentProvider` interface before adding Razorpay or PayPal; add capture mode and manual methods (bank transfer, cash on delivery) that create orders with payment "Pending".
- Shipping labels and carrier rates: provider interface (e.g. EasyPost/ShipEngine) in Phase 6.
- Email: existing SMTP outbox; add recovery and draft-invoice templates to the 12 existing ones.
- Domains: `StoreDomain` table exists unused; implement verification (TXT/CNAME) and SSL via the host (Vercel domains API) in Phase 4.

## Implementation phases

Six phases, each ending in a shippable admin; Phases 1-3 make Jelly feel professional and earn money, Phases 4-6 close the remaining Shopify gaps. Durations are not estimated here because team size is unknown.

### Phase 1 — Admin design system (improve)

| Task | Acceptance criteria |
| --- | --- |
| Build `AdminPage`, `IndexTable`, `ResourceForm` + `SaveBar`, `StatusBadge`, `EmptyState`, `Skeleton`, `Toast`, `ConfirmDialog`, `Picker`, `HelpTip` | Each has a unit test, an axe test and a demo page at `/admin/_kit` |
| Regroup navigation (see Navigation) with Settings as a full page list | Every current page reachable in 2 clicks; old URLs redirect |
| `StatusBadge` label map for all order, payment, fulfilment, product statuses | No enum code visible anywhere in the admin (test scans rendered text for `[A-Z]+_[A-Z]+`) |
| Move Orders and Products lists onto `IndexTable` | Same data, plus row select; mobile shows cards at 390px |

**Deliverables:** kit, two migrated pages, Storybook-style demo page. **Tests:** Vitest + axe for components; Playwright for list navigation at 1280/820/390.

### Phase 2 — Fix and finish existing pages (improve)

| Task | Acceptance criteria |
| --- | --- |
| Speed: server timing, query batching, min instance | Orders/products lists < 1 s, details < 1.5 s at p75 on staging |
| Orders: view tabs, readable filters, tags, bulk fulfil/print/export/archive, packing slip, failed-notification reason + Retry | Workflow B passes end to end |
| Products: one form (remove classic), vendor/type pickers, tags, duplicate, bulk status/collection/tags/delete, block duplicate variant combos, fix "Unsaved product" and ₹ label bugs | Saving twice never creates a duplicate; duplicate combination shows inline error |
| Stock: bulk save, adjustment reasons, low/out filters, repair the duplicate Utah variant | History shows reason and staff for every change |
| Customers: create, edit, addresses, notes, tags, consent, export | Customer created in admin can be picked on a draft order (Phase 3) |
| Content: image picker instead of media ID, hide `previous-…` menus, Files page | No raw IDs on content pages |
| Settings: split into pages; move flat shipping to Shipping; Preferences page replaces Store appearance | Store appearance URL redirects to Preferences |
| Home: date range, paid-order wording, variant names in running-low list, Next steps | Totals match the Orders list for the same range |

### Phase 3 — Revenue features (build)

| Task | Acceptance criteria |
| --- | --- |
| Discounts: 4 types, code/automatic, limits, combinations, schedule | Workflow E passes; checkout total equals server-calculated total; usage limit enforced under concurrent checkouts |
| Draft orders + send invoice + mark as paid | Workflow D passes; stock reserved only after payment or mark-paid |
| Abandoned checkouts + recovery email | Recovery link restores cart; status flips to Recovered when paid |
| Returns UI on existing backend; order edit UI | Workflow C passes; refund cannot exceed balance |
| Smart collections | Product matching rules appears/disappears within 1 minute of save |
| Product CSV import/export | 1,000-product file imports with a per-row error report |

### Phase 4 — Selling setup (build)

Shipping zones and rates, local delivery and pickup; taxes (manual rates, prices include tax); locations with per-location stock; checkout settings; custom domains with verification and SSL; policies; manual payment methods and capture mode; `PaymentProvider` interface.

**Acceptance:** an order to a second country uses that zone's rate and tax; stock decreases at the fulfilling location; a custom domain serves the storefront over HTTPS.

### Phase 5 — Insight and operations (build)

Storefront events and daily rollups; Analytics dashboard (sales, orders, AOV, sessions, conversion, top products, sales by channel) and 10 standard reports with CSV export; customer segments; purchase orders and suppliers (Workflow F); staff invitations and permissions; payouts and transactions view.

**Acceptance:** dashboard figures match order data to the penny for the same range; a Staff member without Orders permission gets 403 from the API and no menu item.

### Phase 6 — Advanced (later)

Markets (multi-currency prices), gift cards, inventory transfers, B2B companies, marketing campaigns and attribution, shipping labels, apps/webhooks platform, AI assistant on Home.

### Testing requirements (all phases)

- Backend: unit + pglite integration test for every new route, including another store's ID returning 404 (tenant isolation).
- Frontend: Vitest for logic, axe for every new page, Playwright journey per workflow (A-F) at desktop and phone width.
- Migrations: applied to staging only after review; RLS checked; rollback script noted.
- Definition of done: no raw codes or IDs shown, empty/loading/error states present, keyboard usable, docs updated in `docs/features/`.

## Not checked, and open questions

**Not accessed or tested**

- Nothing was created, saved, refunded or sent in either store; forms were read, not submitted. Validation messages were therefore not seen.
- Shopify: Analytics showed no data (1 test order); Reports, Live View, Growth (Attribution, Autopilot, Campaigns), Markets, Gift cards, Companies, Metaobjects, Files, Menus, Blog posts, Billing, Users, Domains and most Settings sub-pages were seen only as menu items. Their descriptions above come from the menu and general Shopify knowledge, not from this store.
- Shopify order-detail header buttons (Refund, Return, Edit, More actions) sit outside the page text that could be read; they are listed from Shopify's standard layout.
- Jelly Shops: screenshots timed out in Chrome, so visual design was judged from two early screenshots and page text, not pixel review. Custom content (metaobjects) stayed on the loading screen. The product builder's lower cards (SEO, organisation, status) were confirmed in code, not on screen. Returns and order edit UI were not found on the order page but may appear for other order states.
- Mobile and tablet layouts of either admin were not checked.
- Load times (7-10 s) were observed once each and may include cold starts.

**Open questions for you**

- Which market first: UK (GBP, VAT) or India (INR, GST, Razorpay)? It changes Phase 4's tax and payment work.
- Should Jelly keep UK spelling ("Fulfil", "colour") in the admin? The current admin mixes both.
- Is a plan/billing system (charging merchants) in scope, or is Jelly free for now?
- Is an AI assistant on Home (as Shopify's Sidekick) wanted, and in which phase?
