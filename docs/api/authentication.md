# Authentication and authorization

Endpoints: [endpoints.md](endpoints.md). Code: `backend/src/auth/`, `backend/src/tenants/store-context.ts`, `backend/src/customers/routes.ts`.

## Who can call the API

| Caller | Credential | Where checked |
| --- | --- | --- |
| Merchant (admin, editor) | `Authorization: Bearer <access token>` | `requireMerchant(authProvider)` in `auth/middleware.ts` |
| Shopper browsing/checking out | none | public routes under `/api/public/stores/:storeId/...` (rate limited where noted) |
| Shopper with an account | Supabase customer access token | `supabaseCustomerVerifier` / `customerIdentity` in `customers/routes.ts`, mounted at `/api/public/stores/:storeId/customer` |
| Shopper viewing an order | the order's unguessable `publicToken` in the URL | `GET /api/public/stores/:storeId/orders/:publicToken` (+ `PublicOrderRateLimiter`) |
| Shopper downloading a digital file | token embedded in the emailed link, hashed in `DigitalEntitlement.tokenHash` | `/api/public/stores/:storeId/digital/:entitlementId` |
| Stripe | `Stripe-Signature` header verified with `gateway.constructEvent` | `/webhooks/stripe/connect-payments`, `/webhooks/stripe/accounts-v2` (separate signing secrets) |
| Scheduler / worker | `x-scheduler-secret` header, timing-safe compare with `SCHEDULER_SECRET` | `/internal/commerce/reservations/sweep`, `/internal/commerce/orders/work` |

## Merchant authentication providers

`AuthProvider.verify(token) → MerchantPrincipal { userId, storeIds, storeRoles }`. The provider is chosen by `AUTH_PROVIDER` in `app.ts`:

| `AUTH_PROVIDER` | Class | Requirements |
| --- | --- | --- |
| `supabase` | `SupabaseAuthProvider` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DATABASE_URL`; memberships read through `PostgresTenantRepository` |
| `firebase` | `FirebaseAuthProvider` | `JELLY_FIREBASE_PROJECT_ID`, `SUPABASE_DATABASE_URL` |
| anything else | `DevelopmentAuthProvider` | accepts the fixed token `jelly-demo-merchant` for `DEMO_STORE_ID`. Local development and tests only. |

The frontend signs merchants in with Supabase (`jellyshops/src/features/auth/auth-provider.tsx`) and sends the session access token.

## Store authorization

`requireStorePermission(permission)` turns the principal into a `StoreRequestContext` for `request.params.storeId`:

- principal has no role in that store → `404 STORE_NOT_FOUND` (does not reveal existence);
- role lacks the permission → `403 STORE_FORBIDDEN`;
- otherwise `request.storeContext = { storeId, userId, role }`, which services and repositories use for every query.

Roles and permissions come from `ROLE_PERMISSIONS` in `auth/permissions.ts`:

| Role | Permissions |
| --- | --- |
| OWNER | everything: storefront view/edit/publish, content, catalog, navigation, custom_data, media, developer:*, team:manage, settings:manage, payments view/manage, orders view/manage/refund |
| ADMIN | OWNER without `developer:*` and `team:manage` |
| DESIGNER | storefront view/edit, content view, catalog view, navigation edit, media upload/delete |
| DEVELOPER | storefront view/edit, content/catalog view, media, developer view/edit/build |
| ORDER_MANAGER | storefront view, catalog view, payments view, orders view/manage |
| STAFF | storefront, content and catalog view |

The authoritative list of permission names is the `StorePermission` union in `auth/types.ts`. The permission guarding each route appears in [endpoints.md](endpoints.md).

## Error responses

Authentication and authorization failures are `ApiError`s with a stable `code`:

| Status | Code | When |
| --- | --- | --- |
| 401 | `AUTH_INVALID` | missing/invalid Bearer token |
| 401 | `SCHEDULER_UNAUTHORIZED` | wrong or missing scheduler secret |
| 403 | `STORE_FORBIDDEN` | role lacks the permission |
| 404 | `STORE_NOT_FOUND` | principal has no role in the store |

## Data isolation

Application-level: every repository method takes `storeId`. Database-level: server-owned tables have row-level security enabled and no policies for `anon`/`authenticated`; only the backend runtime role (`jelly_backend`) can read/write them. See [database-architecture](../architecture/database-architecture.md).
