# Setting up Cloudflare R2 for photos (staging first)

Part of `docs/plans/2026-11-22-speed-cost-phase-3-cdn-hosting.md`, step 2. You do these steps in your own browser;
I never see or type the keys. Cloudflare moves dashboard buttons around now and then, so a label may read slightly
differently from what is written here. The shape of each step stays the same.

Time: about 20 minutes. This version assumes you already own `jellyshop.io` and its DNS is on Cloudflare (if it is
not, see "If jellyshop.io is not on Cloudflare yet" at the end).

Cost: Cloudflare's free plan is enough. R2 asks for a payment method, but the first 10 GB of storage and 10 million
photo reads a month are free; staging uses 81 MB.

**Never paste a key into a chat, a ticket or a commit.** Keys go only into `backend/.env` (git-ignored) and, later,
into the hosting secrets.

---

## 1. The photo address

To avoid buying a second domain for now, photos use a subdomain of the domain you already own. The files are inert
(R2 stores image types only, we serve them with `nosniff` and a locked-down content policy, and nothing there can set
a cookie), so the risk of sharing the site with shops is small. It is easy to move to a separate domain later: the
photo address is built when a page is made, not saved in published designs, so it is one setting
(`MEDIA_PUBLIC_BASE`).

| Environment | Photo address | Bucket |
| --- | --- | --- |
| Staging | `img-staging.jellyshop.io` | `jellyshop-media-staging` |
| Production (later) | `img.jellyshop.io` | `jellyshop-media` |

Two things to do so a shop can never take these names:
- `img` and `img-staging` must be on the list of reserved shop addresses (the subdomain plan's reserved names). I'll
  add them to `RESERVED_STORE_SLUGS` in the backend when we do the subdomain work, or earlier if you ask.
- A shop wildcard (`*.jellyshop.io`) doesn't override these: a specific DNS record for `img-staging` always wins over
  the wildcard. Cloudflare creates that record for you in step 3.

## 2. Cloudflare account

1. Sign in at dash.cloudflare.com (you already have the account, since `jellyshop.io` is there) and make sure
   two-step sign-in is on (My Profile > Authentication).
2. Check that `jellyshop.io` shows **Active** on the Cloudflare home page.

## 3. Turn on R2 and create the staging bucket

1. In the left menu open **R2 Object Storage**. The first time, it asks you to add a payment method and accept the
   R2 terms. Do that.
2. **Create bucket**:
   - Name: `jellyshop-media-staging`
   - Location: **Automatic**, with the location hint **Western Europe (WEUR)** if offered (the database and API are in
     Ireland/London).
   - Default storage class: **Standard**.
3. Open the new bucket > **Settings**:
   - Under **Public access** > **Custom Domains** choose **Connect Domain**, enter `img-staging.jellyshop.io`,
     continue and confirm. Cloudflare adds the DNS record itself. Wait for the status **Active**.
   - Leave **Public Development URL** (the `r2.dev` address) **disabled**. Photos are served only through your
     domain, where the cache and the safety headers below apply.

## 4. Caching and safety headers on the photo address

All on the photo domain's own pages in the dashboard (pick the domain first).

1. **Caching > Tiered Cache**: turn on **Smart Tiered Cache Topology**. Repeat visits around the world then fetch
   from one Cloudflare location next to the bucket instead of each location asking R2.
2. **Caching > Cache Rules > Create rule**:
   - Name: `Photos are cached`
   - When incoming requests match: **Hostname equals** `img-staging.jellyshop.io`
   - Then: **Eligible for cache**. Edge TTL: **Use cache-control header if present** (every photo is stored with a
     one-year "never changes" header). Browser TTL: **Respect origin**.
   - Deploy.
3. **Rules > Transform Rules > Modify Response Header > Create rule**:
   - Name: `Photo safety headers`
   - When: **Hostname equals** `img-staging.jellyshop.io`
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
3. Check one photo through `https://img-staging.jellyshop.io/...`: it loads, carries the one-year header, `nosniff`
   and the CSP, and the second request shows `cf-cache-status: HIT`.
4. Switch the local backend to `MEDIA_PROVIDER=r2`, upload a test photo, check it lands in R2; then set
   `MEDIA_PUBLIC_BASE=https://img-staging.jellyshop.io` and check product pages load photos from the CDN and old
   photo links redirect.

## Production, later

Repeat steps 3 to 6 with the bucket `jellyshop-media`, the address `img.jellyshop.io` and a separate token
`jellyshop-backend-production`. Never reuse the staging token in production. Its values go into the hosting
secrets for the API (set up in Phase 3 step 4), not into a file.

Before real shoppers use it, decide whether to keep photos on a subdomain of `jellyshop.io` or move them to a
separate cheap domain. Moving later is one setting plus a repeat of steps 3 and 4 on the new domain; nothing saved
in a store needs changing. Reasons to move: the subdomain plan's strict "uploads never share a site with shops"
rule, or submitting `jellyshop.io` to the Public Suffix List.

## If jellyshop.io is not on Cloudflare yet

Its DNS has to be on Cloudflare for R2 to connect `img-staging.jellyshop.io`. Add the site on Cloudflare (Free
plan), copy every existing DNS record across first (mail, verification and the Vercel records included), then change
the nameservers at the registrar to the two Cloudflare shows. Wait for **Active**. If Vercel will serve the shop
wildcard, keep the nameservers on Cloudflare and use Vercel's other method for the wildcard certificate (the
`_acme-challenge` NS records, subdomain plan section 1).

## If something goes wrong

- Custom domain stuck on "Initializing": jellyshop.io isn't active on Cloudflare yet (step 2), or a DNS record with
  the same name already exists. Remove the old record and connect again.
- The copy script says "R2 upload failed (403)": the token is limited to a different bucket, or has read-only
  permission. Create a new token with **Object Read & Write** on the right bucket.
- Lost the secret: revoke the token and create a new one (step 5).

Sources: [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/),
[Cache with R2](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/),
[R2 with S3 tools](https://developers.cloudflare.com/r2/get-started/s3/).
