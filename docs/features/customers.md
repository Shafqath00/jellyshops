# Customers, accounts and engagement

Code: `backend/src/customers/`, `backend/src/admin/`, `jellyshops/src/features/customers/`, `jellyshops/src/app/[storeSlug]/account/**`, `jellyshops/src/app/admin/{customers,engagement}`. Tables: `StoreCustomer`, `CustomerAddress`, `CustomerWishlist`, `NewsletterSubscriber`, `ContactEnquiry`.

## Shopper side (`/api/public/stores/:storeId`)

| Area | Routes | Auth |
| --- | --- | --- |
| Profile | `GET/PATCH /customer/profile` | customer access token (`supabaseCustomerVerifier`) |
| Addresses | `GET/POST /customer/addresses`, `PATCH/DELETE /customer/addresses/:addressId` | same |
| Orders | `GET /customer/orders`, `GET /customer/orders/:orderId` | same |
| Wishlist | `GET /customer/wishlist`, `POST /customer/wishlist/merge`, `DELETE /customer/wishlist/:productId` | same |
| Contact form | `POST /engagement/contact` | none, rate limited |
| Newsletter | `POST /engagement/newsletter`, `POST /engagement/newsletter/unsubscribe` | none; unsubscribe links are signed with `CUSTOMER_LINK_SECRET` |

The customer router is mounted only when Supabase URL and anon key are configured. `StoreCustomerService` finds or creates the store-scoped `StoreCustomer` for the verified identity. Customers are per store: the same person has a separate record in each store. Checkout attaches the signed-in customer to the order (`resolveCheckoutCustomer` in `app.ts`); guests can check out without an account.

Frontend: `features/customers/customer-provider.tsx` (session and API), `customer-page.tsx`, `protected-storefront-page.tsx`, `wishlist.ts` / `wishlist-button.tsx`, `contact-form.tsx`, `newsletter-unsubscribe.tsx`; pages under `app/[storeSlug]/account/{login,register,recover,orders,addresses}`.

## Merchant side

- `GET /api/stores/:storeId/customers` and `/customers/:customerId` (`admin/service.ts` / `routes.ts`) back `app/admin/customers`.
- Engagement inbox: `GET/PATCH /engagement/enquiries[/:enquiryId]` and `GET /engagement/subscribers.csv` back `app/admin/engagement`.
