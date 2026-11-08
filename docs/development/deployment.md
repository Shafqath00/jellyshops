# Deployment

What exists today, and what does not.

| Part | Target | State |
| --- | --- | --- |
| Backend API | Firebase Functions (`firebase.json`: source `backend`, codebase `api`, runtime `nodejs22`, predeploy `npm --prefix backend run build`) | Configured. Entry `backend/src/functions.ts` exports the `api` function wrapping the Express app. |
| Frontend | Vercel (planned) | **Not set up** (no Vercel project config in the repo; the deploy token was invalid). |
| Database | Supabase Postgres | Staging project `ayvpxqwleurhkfyujzlu` is used by the backend `.env`. Production isolation (RLS) has not been applied. |
| CI | GitHub Actions `core-mvp.yml` | Typecheck, lint, tests, builds on every push and PR. Does not deploy. |
| Domains / SSL / subdomains | — | Not built. |

## Backend (Firebase Functions)

1. Install the Firebase CLI and `firebase login`.
2. Copy `.firebaserc.example` (repo root) to `.firebaserc` and set the project id.
3. Configure the function's environment/secrets: `NODE_ENV=production`, `AUTH_PROVIDER` (`firebase` or `supabase`), database URLs (`SUPABASE_RUNTIME_DATABASE_URL` is mandatory in production), CORS origins, Stripe keys and both webhook secrets, `SCHEDULER_SECRET`, `CUSTOMER_LINK_SECRET`, order-email and digital-file variables ([environment-variables](environment-variables.md)). Local-disk media is ephemeral on Functions: use `MEDIA_PROVIDER=supabase`.
4. `firebase deploy --only functions:api` from the repo root.
5. The function URL is `https://<region>-<project-id>.cloudfunctions.net/api`; the frontend adds the `/api/...` prefix itself, so set `NEXT_PUBLIC_STORE_EDITOR_API_URL` to the function URL.

Stripe webhook endpoints to register: `/webhooks/stripe/connect-payments` and `/webhooks/stripe/accounts-v2` (separate signing secrets). Full procedure: [../../backend/docs/stripe-connect-deployment.md](../../backend/docs/stripe-connect-deployment.md).

## Scheduled jobs

Call these with the header `x-scheduler-secret: <SCHEDULER_SECRET>` (for example from Cloud Scheduler), about every minute:

- `POST /internal/commerce/reservations/sweep` — release expired inventory reservations.
- `POST /internal/commerce/orders/work` — order operations and notification outbox.

## Database migrations

There is no automated runner. Apply files from `backend/sql/migrations` in filename order to the target database with an owner-capable connection, record each version in `supabase_migrations.schema_migrations`, and run each file in a transaction. Order of the recent ones: `20261020…` (core, runtime role, customer services, FK indexes), then `20261022000000_order_management`, then `20261022010000_notifications_digital`. Check the current state with the generated [database-schema](../architecture/database-schema.md) (“Applied migrations”). Ask before touching a shared database.

## Shared packages

The backend bundles tarballs of the shared packages. Before every backend deploy: `node scripts/prepare-shared-packages.mjs --check` (CI does this), and after changing the packages repack and reinstall ([shared-modules](../file-structure/shared-modules.md)).

## Frontend (when set up)

`cd jellyshops && npm run build` (the `prebuild` step builds the storefront packages). Needed build-time/run-time variables: `NEXT_PUBLIC_STORE_EDITOR_API_URL`, `STOREFRONT_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

## Pre-launch checklist

See [../jelly-minimal-launch-checklist.md](../jelly-minimal-launch-checklist.md) (staging journey with Stripe sandbox is still to be run).
