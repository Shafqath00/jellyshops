# Jelly Shops backend

The production Stripe Connect deployment and verification procedure is documented in [docs/stripe-connect-deployment.md](docs/stripe-connect-deployment.md).

Run `npm run typecheck`, `npm run build`, and `npm test` before deployment. Apply SQL migrations in order and run the reservation sweeper every minute with `SCHEDULER_SECRET`.

## Firebase Cloud Functions

The compiled `api` export in `src/functions.ts` is the Firebase HTTP entrypoint (`dist/functions.js`). It wraps the existing Express application; local development still uses `src/server.ts` and `npm run dev`.

1. Install the Firebase CLI and authenticate with `firebase login`.
2. Copy `.firebaserc.example` to `.firebaserc` and set the Firebase project ID.
3. Configure production environment values/secrets for the function, including `NODE_ENV=production`, `AUTH_PROVIDER=firebase`, `JELLY_FIREBASE_PROJECT_ID`, `SUPABASE_DATABASE_URL`, `CORS_ORIGINS`, and the Stripe secrets used by the application. Use Secret Manager or your CI/CD secret store for credentials.
4. Select durable media storage (`MEDIA_PROVIDER=supabase` or a future GCS adapter); local filesystem storage is ephemeral in Cloud Functions.
5. Deploy with `firebase deploy --only functions:api` from the repository root. The configured predeploy hook builds the backend and its local workspace packages.

The deployed URL is `https://<region>-<project-id>.cloudfunctions.net/api`. Set the frontend's `NEXT_PUBLIC_STORE_EDITOR_API_URL` (and any public storefront API base URL) to that URL.

Hosting and authentication are independent. The current JellyShop frontend uses Supabase Auth and sends Supabase access tokens. Keep `AUTH_PROVIDER=supabase` in the function environment unless the frontend has been migrated to Firebase Auth. To use Firebase Auth, set `AUTH_PROVIDER=firebase` and `JELLY_FIREBASE_PROJECT_ID`, then change the frontend to send Firebase ID tokens. Firebase supplies Application Default Credentials, so Firebase Admin token verification works without a service-account JSON file.
