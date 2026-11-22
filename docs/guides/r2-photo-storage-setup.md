# Setting up Cloudflare R2 for photos (staging first)

Part of `docs/plans/2026-11-22-speed-cost-phase-3-cdn-hosting.md`, step 2. You do these steps in your own browser;
I never see or type the keys. Cloudflare moves dashboard buttons around now and then, so a label may read slightly
differently from what is written here. The shape of each step stays the same.

Time: about 30 minutes, plus however long your domain registrar takes to switch nameservers (usually under an hour,
up to a day).

Cost: Cloudflare's free plan is enough. R2 asks for a payment method, but the first 10 GB of storage and 10 million
photo reads a month are free; staging uses 81 MB.

**Never paste a key into a chat, a ticket or a commit.** Keys go only into `backend/.env` (git-ignored) and, later,
into the hosting secrets.

---

## 1. Pick the photo domain

Photos must live on a domain of their own, not on `jellyshop.io` (a shop's photo can then never run as part of a
shop or the admin). Choose a short name you'll keep, for example `jellycdn.net` or `jellyshopusercontent.com`.

- Buying it through Cloudflare (Domain Registration > Register Domains) is simplest: it lands on Cloudflare
  already, and you can skip step 2's nameserver change.
- Buying it elsewhere works too; step 2 moves it onto Cloudflare.

We'll use two addresses on it:

| Environment | Photo address | Bucket |
| --- | --- | --- |
| Staging | `img-staging.<your domain>` | `jellyshop-media-staging` |
| Production (later) | `img.<your domain>` | `jellyshop-media` |

## 2. Cloudflare account and the domain

1. Sign up at dash.cloudflare.com (free) and turn on two-step sign-in (My Profile > Authentication).
2. If the domain was bought elsewhere: **Add a domain** (or "Add site"), type the domain, pick the **Free** plan.
   Cloudflare shows two nameservers. At your registrar, replace the domain's nameservers with those two. Wait until
   the domain shows **Active** in Cloudflare (you'll get an email).

## 3. Turn on R2 and create the staging bucket

1. In the left menu open **R2 Object Storage**. The first time, it asks you to add a payment method and accept the
   R2 terms. Do that.
2. **Create bucket**:
   - Name: `jellyshop-media-staging`
   - Location: **Automatic**, with the location hint **Western Europe (WEUR)** if offered (the database and API are in
     Ireland/London).
   - Default storage class: **Standard**.
3. Open the new bucket > **Settings**:
   - Under **Public access** > **Custom Domains** choose **Connect Domain**, enter `img-staging.<your domain>`,
     continue and confirm. Cloudflare adds the DNS record itself. Wait for the status **Active**.
   - Leave **Public Development URL** (the `r2.dev` address) **disabled**. Photos are served only through your
     domain, where the cache and the safety headers below apply.

## 4. Caching and safety headers on the photo address

All on the photo domain's own pages in the dashboard (pick the domain first).

1. **Caching > Tiered Cache**: turn on **Smart Tiered Cache Topology**. Repeat visits around the world then fetch
   from one Cloudflare location next to the bucket instead of each location asking R2.
2. **Caching > Cache Rules > Create rule**:
   - Name: `Photos are cached`
   - When incoming requests match: **Hostname equals** `img-staging.<your domain>`
   - Then: **Eligible for cache**. Edge TTL: **Use cache-control header if present** (every photo is stored with a
     one-year "never changes" header). Browser TTL: **Respect origin**.
   - Deploy.
3. **Rules > Transform Rules > Modify Response Header > Create rule**:
   - Name: `Photo safety headers`
   - When: **Hostname equals** `img-staging.<your domain>`
   - Then, **Set static**:
     - `X-Content-Type-Options` = `nosniff`
     - `Content-Security-Policy` = `default-src 'none'`
     - `Cross-Origin-Resource-Policy` = `cross-origin` (shops on other domains must be allowed to show the photos)
   - Deploy.

## 5. A key for the backend

1. Back in **R2 Object Storage**, find **Manage API tokens** (it may sit under **Account details** on the R2
   overview page) > **Create API token** (choose the **Account** token if asked).
   - Name: `jellyshop-backend-staging`
   - Permissions: **Object Read & Write**
   - **Apply to specific buckets only**: `jellyshop-media-staging`
   - TTL: forever (you can revoke it any time)
2. Create it. Cloudflare shows the **Access Key ID** and the **Secret Access Key** once. Copy them straight into
   `backend/.env` (next step); don't save them anywhere else.
3. Note the **Account ID** shown on the R2 overview page (also part of the S3 address
   `https://<account id>.r2.cloudflarestorage.com`).

## 6. Put the settings into `backend/.env`

Add these lines (the names are already listed in `backend/.env.example`):

```
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<access key id>
R2_SECRET_ACCESS_KEY=<secret access key>
R2_BUCKET=jellyshop-media-staging
```

**Leave `MEDIA_PROVIDER` and `MEDIA_PUBLIC_BASE` as they are for now.** The copy script only needs the four R2
lines; switching uploads and photo addresses over are separate steps I'll ask you about.

Then tell me "R2 is set up" and the photo address you used (the address only, never a key).

## 7. What I do next (each with your yes)

1. Copy dry run: `npx tsx scripts/copy-media-to-r2.ts ayvpxqwleurhkfyujzlu --dry-run` (reads only; reports how many
   files are missing from R2).
2. Copy for real (writes only to the new bucket; Supabase is untouched).
3. Check one photo through `https://img-staging.<your domain>/...`: it loads, carries the one-year header, `nosniff`
   and the CSP, and the second request shows `cf-cache-status: HIT`.
4. Switch the local backend to `MEDIA_PROVIDER=r2`, upload a test photo, check it lands in R2; then set
   `MEDIA_PUBLIC_BASE=https://img-staging.<your domain>` and check product pages load photos from the CDN and old
   photo links redirect.

## Production, later

Repeat steps 3 to 6 with the bucket `jellyshop-media`, the address `img.<your domain>` and a separate token
`jellyshop-backend-production`. Never reuse the staging token in production. Its values go into the hosting
secrets for the API (set up in Phase 3 step 4), not into a file.

## If something goes wrong

- Custom domain stuck on "Initializing": the domain isn't active on Cloudflare yet (step 2), or a DNS record with
  the same name already exists. Remove the old record and connect again.
- The copy script says "R2 upload failed (403)": the token is limited to a different bucket, or has read-only
  permission. Create a new token with **Object Read & Write** on the right bucket.
- Lost the secret: revoke the token and create a new one (step 5).

Sources: [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/),
[Cache with R2](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/),
[R2 with S3 tools](https://developers.cloudflare.com/r2/get-started/s3/).
