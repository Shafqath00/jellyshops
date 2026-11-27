# Discounts

Code: shared rules `jellyshops/packages/storefront-schema/src/{discount-rules,discounts}.ts` (the backend uses the packed copy), backend `backend/src/discounts/` (`service.ts`, `checkout-discounts.ts`, `code-guess-limit.ts`, `end-reminders.ts`, `routes.ts`), admin `jellyshops/src/features/discounts/` and `src/app/admin/s/[shop]/discounts/`, checkout `features/checkout/use-bag-discounts.ts` + `components/order-summary.tsx`, bag page `app/sites/[storeSlug]/cart/cart-client.tsx`. Tables: `DiscountCode`, `DiscountRedeemCode`, `OrderDiscount` (migrations `20261118000000_discount_codes.sql`, `20261127000000_discounts_v2.sql`).

## What a discount is

| Part | Choices |
| --- | --- |
| Type | Amount off products, Amount off order, Buy X get Y, Free shipping (type can't change after creating) |
| Method | Discount code (typed at checkout) or Automatic (applied to everyone who qualifies) |
| Value | Percentage 1-100 or a fixed amount (never more than the items cost); fixed off products can be once per order |
| Applies to | All products, chosen products or chosen collections (amount off products; Buy X get Y buys and gets) |
| Minimum | None, a spend, or a number of items |
| Who | Everyone, first order, customer tags, chosen customers (matched by the checkout email, which isn't verified) |
| Limits | Total uses (orders not cancelled; a cancelled order gives its use back), one per customer (by email) |
| Combines with | Product, order, shipping discounts; both discounts must allow each other |
| Dates | Start and optional end, entered in the shop's time zone |

Free shipping has an optional highest delivery charge. Shops have one flat delivery rate, so there are no countries to choose.

## How a bag is priced (`calculateDiscounts`)

1. Every candidate (the typed code plus up to 50 live automatic discounts) is checked alone: switched on, started, not ended, not used up, the shopper may use it, the minimum is met, something in the bag qualifies. A typed code that fails gets a reason in the shopper's words.
2. Product discounts work out what they take off each line; a line keeps only its largest product discount. Buy X get Y takes the dearest qualifying "buy" items and discounts the cheapest "get" items.
3. Order discounts come off what is left, oldest first (two 10% order discounts = 19%). An order discount's minimum is counted after product discounts.
4. Free shipping makes delivery free.
5. Of all the sets of discounts that may combine, the one saving the shopper most wins; ties go to older discounts, so the same bag always gets the same answer. A typed code left out is explained ("can't be used with … which saves you more").

Totals are integers in minor units; percentages round per line (half up); an order-level amount is shared across lines by value with leftover pennies going to the largest lines, so the line shares add up exactly (refunds and order edits read them). Prices are as entered (no tax engine). An order must still come to at least 50p (Stripe's minimum).

## Checkout and the bag

- `POST /api/public/stores/:storeId/checkout/discount` `{ code?, currency, items, email? }` returns totals and one line per discount; with a code that can't be used it answers 422 with the reason. The bag page calls it without a code (automatic discounts only); the checkout calls it again when the bag, code or a complete-looking email changes.
- Placing an order works it all out again inside the checkout lock; the typed code and any limited automatic discount are locked `FOR UPDATE`, so two shoppers can't both take the last use. Each discount is written to `OrderDiscount` (code, title, type, amount, delivery saved); `Order.discountCode` keeps the typed code.
- Guessing: 10 wrong or unusable codes from one address in one shop within 10 minutes block further code checks there (429 `DISCOUNT_TOO_MANY_TRIES`, in memory per server), on top of 30 checks a minute in the database limiter. A code that doesn't exist and one that is switched off get the same words.
- A database without the second migration checks out without discounts.

## Admin

- **List** (`/admin/discounts`): results cards (active, uses, sales with discounts, given away), tabs by status, search, type and method filters, sort, paging, bulk switch on/off/delete, a summary sentence per discount. Everyone who can see orders can see discounts; only owners and admins (`discounts:manage`) change them.
- **Create**: a picker explains each type with an example and offers templates (10% off a first order, free shipping over £50, buy 1 get 1 free, £5 off over £30).
- **Form**: one form for every type with a live summary, warnings (ended, code in use, 100% off, products not on sale, automatic discounts that won't combine), problems under each field, Generate code and a live code check, and "Try it on a sample bag" (the same calculation on the unsaved discount).
- **Discount page**: the form, status, results (paid orders, sales, average order, given away), Duplicate (switched off, `-COPY` code), switch on/off, delete. A used code can't be renamed.
- **Codes**: a code discount can make up to 1,000 extra unique codes per request (optional prefix) that share its settings and usage limit; list with uses; CSV export (`Code,Times used`).
- **End reminders**: the owner gets one email about three days before a switched-on discount ends (scheduled tick, needs the order email sender); moving the end date sends a new one.

## Plan limits

`discounts` (trial 20, paid 1,000) and `discountCodes` (every typeable code in the shop: trial 200, paid 100,000), in `backend/src/billing/limits-config.ts`.

## Not built

Single-use generated codes, countries or regions for free shipping (needs delivery zones), tiered "spend more save more", discounts for signed-in accounts only, tax-aware discounting.
