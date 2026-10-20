# Jelly Shops backend

The production Stripe Connect deployment and verification procedure is documented in [docs/stripe-connect-deployment.md](docs/stripe-connect-deployment.md).

Run `npm run typecheck`, `npm run build`, and `npm test` before deployment. Apply SQL migrations in order and run the reservation sweeper every minute with `SCHEDULER_SECRET`.

Customer newsletter unsubscribe links are signed with the server-only `CUSTOMER_LINK_SECRET`. Set it to at least 32 random characters in each environment before enabling newsletter subscriptions. Customer identities are verified against Supabase Auth independently from merchant authentication; customer email verification and recovery redirects must point to the matching frontend environment.

## V4 storefront publication lifecycle

V4 storefront state has four strict boundaries. **Draft** is the mutable SQL workspace for a store. **Preview** compiles that persisted draft without saving or activating a publication. **Publish** compiles the requested draft generation, saves an immutable snapshot, and only then moves the store's active publication pointer. **Public** follows that pointer and serves only the active immutable snapshot; it never falls back to draft state.

Publication rows and `Store.currentPublicationId` are SQL-backed. A restarted application rebuilds its process-local read cache from SQL and continues serving the same active publication while later draft generations remain private.

Workspace and publication identity is `storeId` only. This milestone does not introduce installed-theme or multi-theme publication identity. Built-in resource-field dynamic bindings compile locally, but custom-data metafield and metaobject bindings still require an injected dynamic-source service; SQL-backed custom-data definition loading is not part of this milestone.

## Firebase Cloud Functions

The compiled `api` export in `src/functions.ts` is the Firebase HTTP entrypoint (`dist/functions.js`). It wraps the existing Express application; local development still uses `src/server.ts` and `npm run dev`.

1. Install the Firebase CLI and authenticate with `firebase login`.
2. Copy `.firebaserc.example` to `.firebaserc` and set the Firebase project ID.
3. Configure production environment values/secrets for the function, including `NODE_ENV=production`, `AUTH_PROVIDER=firebase`, `JELLY_FIREBASE_PROJECT_ID`, `SUPABASE_DATABASE_URL`, `CORS_ORIGINS`, and the Stripe secrets used by the application. Use Secret Manager or your CI/CD secret store for credentials.
4. Select durable media storage (`MEDIA_PROVIDER=supabase` or a future GCS adapter); local filesystem storage is ephemeral in Cloud Functions.
5. Deploy with `firebase deploy --only functions:api` from the repository root. The configured predeploy hook builds the backend and its local workspace packages.

The deployed function endpoint is `https://<region>-<project-id>.cloudfunctions.net/api`, but the frontend API clients add the Express `/api/...` route prefix themselves. Set `NEXT_PUBLIC_STORE_EDITOR_API_URL` (and any public storefront API base URL) to the origin only: `https://<region>-<project-id>.cloudfunctions.net`.

### Supabase PostgreSQL TLS

The backend always verifies the PostgreSQL server certificate. If Node.js reports `SELF_SIGNED_CERT_IN_CHAIN`, do not turn off certificate verification. Download the root CA for the matching Supabase project from its Dashboard under **Database → Settings → SSL Configuration**, save it in a local untracked file, and set `SUPABASE_DATABASE_CA_FILE` to that file path (relative paths resolve from the backend process working directory). Restart the API or Firebase emulator after changing the setting. The inline `SUPABASE_DATABASE_CA` PEM setting is also supported for secret managers.

If the connection reports `ENOTFOUND` or `ERR_NAME_NOT_RESOLVED`, fix DNS/network access or verify that the configured Supabase project hostname is current; a CA setting cannot fix name resolution. If the presented certificate is issued by a corporate TLS inspection service, use an approved database egress route or the IT-provided trust configuration rather than trusting an unknown certificate.

Hosting and authentication are independent. The current JellyShop frontend uses Supabase Auth and sends Supabase access tokens. Keep `AUTH_PROVIDER=supabase` in the function environment unless the frontend has been migrated to Firebase Auth. To use Firebase Auth, set `AUTH_PROVIDER=firebase` and `JELLY_FIREBASE_PROJECT_ID`, then change the frontend to send Firebase ID tokens. Firebase supplies Application Default Credentials, so Firebase Admin token verification works without a service-account JSON file.
