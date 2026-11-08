# Local setup

Requirements: Node 22 (CI uses 22; Firebase runtime is `nodejs22`), npm. Windows, macOS and Linux work; the repository uses LF line endings.

## 1. Install

```bash
cd jellyshops && npm ci
cd ../backend && npm ci
```

The backend installs the shared packages from tarballs, so build them first if you changed anything under `jellyshops/packages` (see [shared-modules](../file-structure/shared-modules.md)):

```bash
node scripts/prepare-shared-packages.mjs
cd backend && rm -rf node_modules/@jelly && npm install
```

## 2. Configure

- `backend/.env`: copy `backend/.env.example`. With no values it runs in development mode (`AUTH_PROVIDER=development`, local file media, local JSON repositories for storefront and media under `DATA_DIRECTORY`). For the real SQL path set `SUPABASE_DATABASE_URL` (+ `SUPABASE_DATABASE_CA_FILE`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `AUTH_PROVIDER=supabase`.
- `jellyshops/.env.local`: copy `jellyshops/.env.example` (`NEXT_PUBLIC_STORE_EDITOR_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and the Supabase public URL/anon key for sign-in).
- `.env` files are git-ignored; never commit secrets. All variables: [environment-variables](environment-variables.md).

## 3. Run

Backend (port 3001):

```bash
cd backend
npm run dev          # tsx watch src/server.ts
```

Frontend:

```bash
cd jellyshops
npm run dev          # builds the storefront packages, then next dev --turbopack (port 3000)
```

To run a second dev server alongside another one on port 3000, use a separate dist dir and port (this is what `.claude/launch.json` does):

```bash
cd jellyshops
JELLY_E2E_NEXT_DIST_DIR=.next/qa NEXT_PUBLIC_STORE_EDITOR_API_URL=http://127.0.0.1:3001 npx next dev --turbopack -p 3200
```

Starting Next rewrites `jellyshops/tsconfig.json` and `next-env.d.ts`; run `git checkout` on them before committing.

## 4. Useful pages

- `/login`, `/signup`, `/onboarding`, `/admin`
- `/theme-preview/jelly-minimal`, `/theme-preview/jelly-avenue` (no store needed)
- Storefront: `/<storeSlug>`

## 5. Utility scripts (backend)

| Script | Purpose |
| --- | --- |
| `npm run seed:starter-catalog` | Seed a starter catalog (`scripts/seed-starter-catalog.ts`). |
| `npm run provision:onboarding-e2e` / `reset:onboarding-e2e` | Create or reset the onboarding E2E store. |
| `npm run test:start` | Boot the built server and check it (`scripts/verify-built-server.mjs`). |

## Stripe locally

Use test-mode keys, a Connect platform account, and `stripe listen --forward-to localhost:3001/webhooks/stripe/connect-payments` for webhooks. Details: `backend/docs/stripe-connect-deployment.md`.
