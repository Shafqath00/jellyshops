# Admin real-backend integration design

## Goal

Make every `/admin` screen an authenticated merchant experience backed by the
Express/Supabase API. The admin must not read from, write to, or fall back to
the browser-local `ShopRepository`. An unavailable or failed API is surfaced
as a recoverable UI state, never replaced with fabricated business data.

## Scope

The migration covers the dashboard, products, orders, customers, payments,
store profile/settings, content, custom data, navigation, online-store
workspace, and onboarding. Existing public storefront and checkout flows are
out of scope except where an admin mutation already changes their source data.

## Frontend architecture

`AuthProvider` remains the authority for the Supabase session and active
merchant store. A new typed `admin-api` boundary receives the API origin and
the current access token, attaches the bearer token to every merchant request,
normalizes API errors, and exposes domain methods. A small reusable query hook
will handle cancellation, loading, error, retry, and post-mutation refresh.

Admin routes will use `activeStore.id` and these query methods directly. The
existing `ShopProvider` and `useShop` calls will be removed from the admin
tree; no local persistence will be used for operational data. Pages preserve
their current layout but render loading skeletons, explicit empty states, and
error panels with retry actions.

## Backend contracts

Existing protected routes remain the source of truth for catalog, orders,
Stripe Connect, content, custom data, media, and storefront workspace. New
merchant-protected routes under `/api/stores/:storeId` will provide:

- `GET /admin-summary`: revenue and order counts, actionable/recent orders,
  published-product count, and low-stock variants. Values are computed in the
  database for the requested store.
- `GET /customers` and `GET /customers/:customerId`: customers derived from
  completed/recorded orders, with their order count, lifetime spend, latest
  order, and detail history. No duplicate customer store is introduced.
- `GET /settings` and `PATCH /settings`: store name, slug, currency, country,
  description/tagline, publication state, and supported storefront appearance
  fields. The patch is validated and constrained to the authenticated store.

The tenant repository gains the store-profile read/update operations required
by settings. Commerce repository queries supply dashboard and customer
projections; all use store-id predicates. Routes enforce `requireMerchant` and
the least-privilege existing store permission, with new named permissions only
if the current permission model cannot express the operation.

## Page migration map

| Admin area | Source and mutation path |
| --- | --- |
| Dashboard | `admin-summary`; no local aggregation |
| Products and product detail/create | catalog products endpoints |
| Orders and order detail | merchant-order endpoints and fulfillment/refund mutations |
| Customers and customer detail | new customers endpoints |
| Payments | existing Stripe Connect endpoints |
| Store and settings | new settings endpoint; authenticated tenant store list for selector |
| Content/custom data/navigation | existing content, custom-data, and storefront workspace endpoints |
| Online store/editor/store design | existing storefront workspace/publication APIs and settings where applicable |
| Onboarding | authenticated store creation and settings mutation |

## Failure, security, and consistency

No request is made until both an active store and access token exist. A 401
returns the user to authentication; 403 presents a permission message; other
errors preserve the page shell and offer retry. After successful mutations,
the affected resource is refreshed and dashboard data is invalidated. Client
input remains validated for usability, while the server remains authoritative.

## Tests and verification

Backend route/service tests will prove store isolation, authorization,
validation, aggregate calculations, and customer projections. Frontend tests
will mock the API boundary to prove each migrated screen handles loading,
success, empty, error, and mutation refresh behavior. Final verification runs
the focused suites, both project typechecks, and production builds where the
environment permits.

## Non-goals

This change does not invent analytics beyond order/catalog data, add a CRM,
change Stripe payment semantics, or migrate public storefront rendering to a
new architecture.
