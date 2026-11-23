# Moving the API to London and the storefront to Dublin

Part of `docs/plans/2026-11-22-speed-cost-phase-3-cdn-hosting.md` (step 4). Every step that changes something live
needs the owner's yes; nothing here deletes data.

## Where things are today (checked 2026-11-23)

| Piece | Where | Address |
| --- | --- | --- |
| Database | Supabase, Ireland (`eu-west-1`) | staging project `ayvpxqwleurhkfyujzlu` |
| API | Firebase project `jelly-507118`, function `api` + `orderWorkers`, Iowa (`us-central1`) | `https://api-ejususpvea-uc.a.run.app` |
| Storefront and admin | Vercel project `jellyshop`, Washington (`iad1`) | `https://jellyshop.vercel.app`; `jellyshop.io` is added to the project |
| Photos | Cloudflare R2 bucket `jellyshop-media-staging` | `https://img-staging.jellyshop.io` |

Every page that isn't cached goes Washington → Iowa → Ireland and back, several times.

## Status: parked while testing (2026-11-23)

Nothing is moved. The code defaults are unchanged: the API runs in Iowa (`us-central1`, 5 instances) and Vercel uses its
default region. London was tried, but a first deploy paused on Firebase asking about deleting the Iowa functions and was
cancelled; nothing was created or deleted. Do this when real shops are close.

To move later:

- Set `FUNCTIONS_REGION=europe-west2` in `backend/.env.jelly-507118` (the code reads it for both `api` and
  `orderWorkers`). Optionally raise `maxInstances` in `backend/src/functions.ts` from 5.
- Add `jellyshops/vercel.json` with `{ "regions": ["dub1"] }` to run Vercel functions in Dublin.
- Deploying to a new region creates a **new** function with a **new address**; the Iowa one keeps running until it is
  deleted. When Firebase asks whether to delete the Iowa functions, answer **No** (it needs a person at the terminal).
  That gives a safe switch-over: deploy London, point the storefront and Stripe at it, check, then delete Iowa.

## Before deploying: check the function's settings

Firebase sends `backend/.env` **and** `backend/.env.jelly-507118` to the function (the second wins where both set a
name). `backend/.env` is the local development file, so look at it first:

- [ ] Local-only values that must not go live are overridden in `.env.jelly-507118` (e.g. `CORS_ORIGINS`,
      `NODE_ENV` is forced to production by `functions.ts`).
- [ ] Add to `.env.jelly-507118` (or keep in `.env`) the photo settings: `MEDIA_PROVIDER=r2`, the four `R2_*` values,
      `MEDIA_PUBLIC_BASE=https://img-staging.jellyshop.io`.
- [ ] Add the storefront cache refresh: `STOREFRONT_REVALIDATE_URL=https://jellyshop.vercel.app/api/revalidate` and
      `STOREFRONT_REVALIDATE_SECRET=<a long random value>` (the same secret goes into Vercel below).
- [ ] Two local addresses in `backend/.env` would otherwise go live (found 2026-11-23): override them in
      `.env.jelly-507118` with `STOREFRONT_PUBLIC_URL=https://jellyshop.vercel.app` and
      `ORDER_PUBLIC_API_URL=<the London address>` (known after the first deploy, so set it and deploy once more).
      Other names that only `backend/.env` holds (Stripe test keys, SMTP, Supabase, scheduler secret) are what the
      live function has been running on; keep them, or move them into `.env.jelly-507118`.
- [ ] `CORS_ORIGINS` lists every address shoppers and merchants use (`https://jellyshop.vercel.app`, and
      `https://jellyshop.io`, `https://*.jellyshop.io` once the subdomain switch is on).

## Steps

1. **Deploy the API to London** (repo root): `firebase deploy --only functions --project jelly-507118`.
   Firebase will say the Iowa functions are no longer in the code and ask whether to delete them: answer **No**
   for now. Note the new address (`https://api-…-nw.a.run.app`, shown at the end of the deploy and by
   `firebase functions:list --project jelly-507118`).
2. **Check London answers**: `curl <new address>/health` (or any public route) returns 200.
3. **Point Stripe at London**: in the Stripe dashboard (Developers → Webhooks), edit both endpoints
   (`/webhooks/stripe/connect-payments` and `/webhooks/stripe/accounts-v2`) to the new address. Editing keeps each
   endpoint's signing secret, so no secret changes.
4. **Point the storefront at London** in Vercel (project `jellyshop`, Production and Preview):
   - `NEXT_PUBLIC_STORE_EDITOR_API_URL` = new address
   - `STOREFRONT_API_URL` = new address (server-side reads; falls back to the one above if unset)
   - `STOREFRONT_REVALIDATE_SECRET` = the secret from the function settings
   - `NEXT_PUBLIC_SITE_URL` = the public site address (canonical links)
5. **Redeploy the storefront** (this also applies `vercel.json`, Dublin): push the branch Vercel builds from, or
   `vercel --prod` from `jellyshops/`. Check in the deployment's details that functions run in `dub1`.
6. **Check end to end** on `https://jellyshop.vercel.app`: a store page, a product page, sign in to the admin, save a
   product and see the store page change within seconds (cache refresh), a test checkout with Stripe's test card.
7. **Stop Iowa**: `firebase functions:delete api orderWorkers --region us-central1 --project jelly-507118`.
   Until this is done both `orderWorkers` run every minute (they lock their work, so nothing is sent twice, but it
   costs twice).
8. **Budget alert** on the Google Cloud project `jelly-507118` (Billing → Budgets), e.g. £20/month with emails at
   50/90/100%.

## Going back

Before step 7: point Vercel's two API addresses and the Stripe endpoints back to the Iowa address and redeploy.
After step 7: `FUNCTIONS_REGION=us-central1 firebase deploy --only functions --project jelly-507118`, then the same.

## Not in this step

- Vercel Pro: the project is on the owner's account; the Hobby plan is for non-commercial use, so upgrade before real
  shops trade (the subdomain checklist says the same).
- Production photos (`img.jellyshop.io`, own bucket and token) and the subdomain switch
  (`docs/launch/subdomains-go-live-checklist.md`).
