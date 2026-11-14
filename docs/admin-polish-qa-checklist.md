# Admin polish and bulk products: checks to do signed in

13 November 2026. These are the checks that need your sign-in, a real backend and real data. None of them was done by the developer session: everything below was verified only by automated tests and by looking at the screens through a temporary page with pretend data (1280px, 375px, light and dark).

## Before you start

1. The import migration (`20261113000000_product_imports.sql`) **was applied to staging on 14 November 2026** and checked. Still missing on staging: `20261108000000_customer_profiles_order_tags.sql`; until it is applied, Customers shows "Could not load customers" and order tags cannot be saved.
2. Deploy or run the backend from this branch (it has the new routes and two new libraries: run `npm install` in `backend/`).
3. Run `npm install` in `jellyshops/` if the admin fails to start with "Can't resolve '@jelly/storefront-schema'".
4. Use a test store, not a live one, for the import and bulk edit checks.

## 1. Look and feel (15 minutes)

At 1440px, 768px and 375px, in light and dark (the sun/moon button in the top bar):

- [ ] Home, Orders, Products, Customers, Content pages, Settings: the main button on each page is blue; nothing is cut off; no sideways scrolling on the phone width.
- [ ] Products list on a phone: rows are cards; the filters wrap onto new lines and stay usable.
- [ ] Settings > Developer access, Online store > Preferences (password), Store designs, Settings > Order emails, Settings > Custom data: readable in dark mode, no odd colours.
- [ ] Open a product: the "Ready to sell?" card shows in the side column (below the main column on a phone).

## 2. Products list (10 minutes)

- [ ] Filters: choose a type, a brand, a collection, a tag and "Out of stock" one at a time; the list changes and "Clear filters" resets it. A filter with nothing to offer is not shown.
- [ ] Tick two products, **Archive**: a dialog says "Archive 2 products?" and nothing happens until you confirm.
- [ ] Tick two products, **Bulk edit**: lower the price by 10%; the table shows each price before and after; confirm; the list shows the new prices. Repeat with Stock > Add 5 and Tags > Add.
- [ ] **Export** from the header: "All products" as Excel opens in Excel or Google Sheets with one row per variant. With a filter set, "The list as it is filtered now" exports only those.

## 3. Import (20 minutes)

- [ ] Products > Import: download the Excel template; it has a second sheet "How to fill this in".
- [ ] Upload the template unchanged: the columns are matched for you; **Check file** shows 2 products to create; **Import**; both appear in Products as drafts (one with two sizes).
- [ ] Upload the same file again with "Create only": both are skipped. With "Create or update": both are updated, none duplicated.
- [ ] Export your products, change three prices and one stock number in the file, import it: the preview says which columns change; after the import the products show the new values and nothing else changed.
- [ ] Put a mistake in a file (a price of "ten", a collection that does not exist): the check lists the row, the column and the reason; that product is left out and the others import; **Download the report** lists the same reasons.
- [ ] Start an import of 60+ rows, press **Pause**, leave the page, come back: the import is listed as "Not finished" with **Carry on**; carrying on finishes it without duplicates.
- [ ] On a finished import choose **Undo this import**: products it created are archived, changed prices and names are back, stock is unchanged.
- [ ] Put two photo addresses (https://…jpg; https://…jpg) in the Image URLs cell of a product and import: both photos appear on the product. Use one address that does not exist: the product is still imported and the report names that photo.
- [ ] Products > More actions > Add photos in bulk: name three photos after a product's SKU or web address ending (for example `oak-bed-frame-1.jpg`), drop them in with one unrelated photo: the three are matched, the fourth says "Not matched"; upload; the product shows the three photos in order.
- [ ] Keyboard only: Tab to "Choose file", upload, then complete every step without the mouse. Focus should land on each step's heading.

## 4. Product editor (10 minutes)

- [ ] New product: the checklist says "Add name and price before you publish"; each "Add" link jumps to the right field.
- [ ] Drag two photos from your desktop onto the Photos area: both upload with progress. Drag a PDF: it is refused with a plain message.
- [ ] Archive a product from the editor, then **Restore**: it comes back as a draft.
- [ ] Products list and the editor now look like the rest of the admin: blue main button, the same tabs, badges and cards, in light and dark. Tell me if anything on these two pages looks broken, since their styling changed the most.
- [ ] A product with sizes or colours, on a phone: each combination is a card with Price, Original price, Stock and SKU, and nothing scrolls sideways.

## 5. Other pages changed

- [ ] Store designs: **Switch to this design** on another design opens a dialog that explains what is replaced; Cancel changes nothing.
- [ ] Settings > Developer access: create a token (copy banner appears once), then **Switch off**: a dialog asks first.
- [ ] Online store > Preferences: save the password settings; a "Password settings saved" message appears at the bottom of the screen.
- [ ] Content > Menus: add a link; the destination list reads "A collection", "A web address" and so on.
- [ ] Reviews and Collections: search and paging work; Collections can be sorted by name or by number of products from the column headings.

## Known limits (not bugs)

- Photos in an import need a public https address of the picture itself; links to Google Drive or Dropbox pages do not work.
- Undoing an import does not take photos off products it changed.
- An import is quickest with its page open. If the page closes it carries on by itself, about 20 products a minute, as long as the backend's scheduled worker is running.
- Bulk edit covers the ticked rows, or every product that matches the search and filters, up to 1,000 at a time.
- Stock changed by bulk edit or import is not labelled with a reason in stock history.
