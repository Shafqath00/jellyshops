# Environment variables

Real values live only in git-ignored `.env` files or the hosting provider's secret store. Defaults below come from `backend/src/config.ts` and the code that reads each variable; `backend/.env.example` lists the same names.

## Backend

| Variable | Default / allowed | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` \| `test` \| `production` | Production turns on stricter checks (CORS origins, separate runtime DB URL, Stripe settings, distinct webhook secrets). |
| `PORT` | `3001` | HTTP port for `src/server.ts`. |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed browser origins (required in production). |
| `TRUST_PROXY` | `false` | Express trust-proxy flag (needed behind a proxy for correct client IPs/rate limits). |
| `AUTH_PROVIDER` | `development` \| `firebase` \| `supabase` | Merchant token verification ([authentication](../api/authentication.md)). |
| `DEMO_STORE_ID` | `store-sweet-bakes` | Store used by the development auth provider. |
| `JELLY_FIREBASE_PROJECT_ID` | — | Required for `AUTH_PROVIDER=firebase`. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | — | Supabase project and public key (auth verification, customer verification). |
| `SUPABASE_SECRET_KEY` | — | Server-only key for Supabase Storage. Never expose to the browser. |
| `SUPABASE_DATABASE_URL` | — | Postgres connection (migration/owner credentials). |
| `SUPABASE_RUNTIME_DATABASE_URL` | — | Runtime connection as `jelly_backend`; required in production. |
| `SUPABASE_DATABASE_CA_FILE`, `SUPABASE_DATABASE_CA` | — | CA certificate for TLS to Supabase Postgres. |
| `DATABASE_POOL_MAX` | `5` (allowed 1–20) | Postgres pool size (`database/client.ts`). |
| `MEDIA_PROVIDER` | `local-files` \| `gcs` \| `supabase` | Where uploaded images go. |
| `SUPABASE_MEDIA_BUCKET` | `media` | Bucket for media. |
| `GCS_BUCKET`, `GCS_PROJECT_ID` | — | Required when `MEDIA_PROVIDER=gcs`. |
| `DATA_DIRECTORY` | `.data` | Local JSON storage (development). |
| `UPLOAD_DIRECTORY` | `uploads` | Local media directory. |
| `MAX_UPLOAD_BYTES` | 10 MB | Media upload limit. |
| `FUNCTIONS_REGION` | — | Firebase Functions region. |
| `STRIPE_SECRET_KEY` | — | Platform secret key. |
| `STRIPE_ACCOUNTS_V2_VERSION` | — | Stripe API version for Accounts v2. |
| `STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID` | — | Required in production when Stripe is configured. |
| `STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET` | — | Signing secret for `/webhooks/stripe/connect-payments`. |
| `STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET` | — | Signing secret for `/webhooks/stripe/accounts-v2` (must differ in production). |
| `SCHEDULER_SECRET` | — | Value of `x-scheduler-secret` for `/internal/*` routes. |
| `CUSTOMER_LINK_SECRET` | — | At least 32 random characters; signs newsletter unsubscribe links. |
| `STOREFRONT_PUBLIC_URL` | `http://127.0.0.1:3200` in the example | Frontend origin used in emails and links. |
| `ORDER_PUBLIC_API_URL` | — | Public backend origin (including any Firebase function prefix) used in download links. |
| `DIGITAL_TOKEN_SECRET` | — | At least 32 chars, stable; derives digital download tokens. |
| `SUPABASE_DIGITAL_BUCKET` | — | Private bucket for digital files. |
| `DIGITAL_STORAGE_DIRECTORY` | `.data/private-digital` | Local private digital storage (development only). |
| `ORDER_SMTP_HOST`, `ORDER_SMTP_PORT` (587), `ORDER_SMTP_SECURE` (`false`), `ORDER_SMTP_USER`, `ORDER_SMTP_PASSWORD` | — | SMTP for order emails. Empty host = capture transport outside production. |
| `ORDER_EMAIL_FROM`, `ORDER_EMAIL_DOMAIN_VERIFIED` | — / `false` | Platform sender; must be `true` before SMTP is accepted. |

## Frontend (`jellyshops/`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_STORE_EDITOR_API_URL` | Backend base URL for browser calls (default `http://localhost:3001`). |
| `STOREFRONT_API_URL` | Server-side backend URL for storefront rendering; falls back to the variable above. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client for sign-in. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (must belong to the same platform as the backend secret key). |
| `NEXT_PUBLIC_DEMO_STOREFRONT_ID` | Demo storefront id. |
| `JELLY_E2E_NEXT_DIST_DIR` | Alternative Next build directory (second dev server, QA, E2E). |

Anything prefixed `NEXT_PUBLIC_` is visible in the browser: never put a secret there.
