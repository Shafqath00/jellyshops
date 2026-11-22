# Storefront speed and running cost plan (2026-11-20)

Goal: fast storefronts and a $20/month plan with a margin above 70%, with stores nobody uses costing close to nothing.

This is the audit and the plan only. **Nothing has been changed yet.** Each phase below starts only after you approve it, and the phases that touch the database, storage or outside accounts are marked so you can decide on each one.

Prices are list prices as I know them (late 2026). Check them before you sign anything; the conclusions hold even if a price moves 20–30%.

---

## 1. What the audit found

### How it runs today

| Part | Today | Notes |
| --- | --- | --- |
| Storefront + admin (Next.js 16) | Not deployed (Vercel token invalid). Measured only as a local production build. | `images.unoptimized: true` in `next.config.ts`. |
| API (Express) | One Firebase Function (Cloud Functions gen 2), `us-central1`, 1 GiB, **max 5 instances**, 60 s timeout. | `backend/src/functions.ts`. Five instances will throttle long before 1,000 stores. |
| Scheduled work | `orderWorkers` every minute (43,200 runs/month), 1 GiB. | Emails, back-in-stock, stalled imports. Cheap, but it runs whether or not there is work. |
| Database | Supabase Postgres 17, `eu-west-1` (staging). | API in the US, database in Ireland: every query crosses the Atlantic (~80–100 ms each round trip). |
| Images | Supabase Storage bucket `media`, **served through the API function**. | Every image a shopper sees = a function call + a database lookup + a storage download + a SHA-256 of the whole file. |
| CDN | None. | No HTML, data or image is cached at an edge. |
| Email | SMTP through nodemailer (`ORDER_SMTP_*`). | Provider not chosen. |
| Custom domains | `StoreDomain` table exists, unused by code. | Stores live at `/<slug>` only. |
| Billing | **None.** No plans, trials, limits or subscriptions. | Needed before any inactive-store rule can mean "unpaid". |
| Store lifecycle | `Store.archivedAt` only. No last-login, last-order or last-visit tracking. | |

Staging today: 7 stores, 74 products, 97 images (72 MB of originals, 81 MB stored with copies; 20 originals over 1 MB, largest 1,900 px), database 21 MB.

### Why storefront pages are slow (and expensive)

Ranked by impact:

1. **Every shopper downloads the whole catalogue twice.** The store layout (`app/[storeSlug]/layout.tsx`) loads *every* product and collection on the server and puts them in the page; then `StorefrontCatalogSync` downloads them all **again** in the browser on every visit and stores them in localStorage. A 500-product store sends roughly 1.5 MB of JSON per visit, and it grows with the catalogue. This is the single biggest speed and cost problem.
2. **No page is ever cached.** The layout reads `cookies()` (for the password check), which makes every store page fully dynamic: each page view renders on the server. The data underneath is cached for only 30 s (`STOREFRONT_CACHE_SECONDS`), and nothing refreshes it when a merchant changes something, so the number had to stay short.
3. **Two uncached backend calls on every page view**: the password status (`cache: "no-store"`), called from both `generateMetadata` and the layout, and the uploaded-theme lookup.
4. **Images go through the API function.** No CDN, so each first view per shopper wakes a function and reads from storage. Originals are kept at full size (only rotated and stripped), and the page asks for the original wherever no width is given.
5. **Distance**: API in `us-central1`, database in `eu-west-1`. A page that needs four API calls each doing a few queries pays this many times. Measured first response on a cold path was 1.6–3 s; 0.57 s once the data cache was warm (`docs/reports/2026-11-13-lighthouse-resthaven.md`).
6. JavaScript is already trimmed (~335 KB compressed start-up, down from 547 KB), and photos already have `srcset` with 320/640/1280 copies. These are no longer the main problems.

The database itself is not a bottleneck: the slowest app query on staging averages 32 ms (`SELECT ... FROM "Order" ... FOR UPDATE`), and the rest are under 4 ms. Supabase's advisor lists 20 foreign keys without an index (order sub-tables, reviews, theme installs, back-in-stock). Cheap to add, small gain. The large count of `pgbouncer.get_auth` calls (154k) shows connections being opened and closed often; worth tidying, not urgent.

### Baseline numbers we already have

From the 13 November report (local production build against staging, Resthaven demo store, 24 products):

| Measure | Value |
| --- | --- |
| Lighthouse performance, desktop | 80–98 |
| Lighthouse performance, phone | 69–78 |
| Accessibility / best practices / SEO | 100 / 100 / 100 |
| Time to first byte, cold | ~3 s |
| Time to first byte, warm 30 s cache | ~0.57 s |
| Start-up JavaScript | ~335 KB compressed |

These were measured locally, not on real hosting. **Phase 0 measures a deployed store first**, so the before/after numbers you get are honest.

---

## 2. Target architecture

Recommendation: **put Cloudflare in front of everything** (CDN, DNS, SSL, custom domains, image storage), cache published store pages at the edge, and refresh them only when the merchant changes something. Keep the API and Supabase, but make them handle only what can't be cached: cart, checkout, admin, and cache refills.

```mermaid
flowchart LR
  Shopper -->|"shop.example.com or slug.jellyshop.app"| CF["Cloudflare edge\n(CDN + SSL + custom hostnames)"]
  CF -->|"cached HTML (hit ~95%)"| Shopper
  CF -->|"miss / refresh"| Next["Next.js storefront\n(ISR, tag-based refresh)"]
  Next -->|"cached data"| API["API (Express)"]
  API --> DB[("Supabase Postgres")]
  Shopper -->|"images: media.jellyshop.app"| R2[("Cloudflare R2\nno egress fees")]
  Merchant -->|"admin, editor"| Next
  API -->|"publish / product change:\npurge store tag"| Next
  API -->|"upload: resize, WebP/AVIF, blur"| R2
```

### Where to run Next.js (decision for you)

| Option | Monthly base | Traffic cost | Fit | Risk |
| --- | --- | --- | --- | --- |
| **A. Cloudflare Workers (OpenNext adapter)** (recommended, after a 1–2 day spike) | $5 | $0.30 per million requests, no bandwidth charge | Same network as the CDN, R2 and custom domains; ISR cache in R2; cheapest at scale | OpenNext can lag behind Next 16; some Node-only code may need changes |
| B. Vercel Pro behind Cloudflare | $20 per seat | 1 TB included, then ~$0.15/GB; ISR reads/writes billed | Easiest for Next 16 | Bandwidth and ISR costs grow with traffic; custom domains through Vercel's API, two CDNs |
| C. Cloud Run (next to the API) behind Cloudflare | ~$0–10 | Compute per request; Cloudflare caches HTML | Same Google project as the API | You run the cache layer yourself; cold starts |

Whatever runs Next.js, the code changes in Phase 1 are the same and give most of the speed gain.

### Cache strategy

| What | Where cached | How long | How it is refreshed |
| --- | --- | --- | --- |
| Images (`media.jellyshop.app/<store>/<hash>/<width>.webp`) | Browser + edge | 1 year, immutable | Never: the address contains the content hash, so a new photo gets a new address |
| Theme CSS, JS, fonts (`/_next/static`) | Browser + edge | 1 year, immutable | New build = new file names |
| Published store pages (home, collection, product, pages, blog) | Next ISR cache + edge | Until changed (safety limit 1 day) | Backend calls a refresh endpoint with tag `store:<id>` on publish; `store:<id>:product:<id>` on product save; collection/menu/page tags likewise |
| Store data the pages use (design, products, collections) | Next data cache | Until changed (safety limit 1 hour) | Same tags |
| Stock and price on a product page | Not cached | Live | Small browser request for the shown product only; checkout re-checks everything on the server (already true) |
| Cart, checkout, account, order pages, search with words, password page | Never cached | — | Always live |

Trade-off: with a long cache a shopper can see a price or stock badge for a few seconds after a change, until the refresh lands. Checkout already re-prices on the server, so no one can buy at a wrong price.

### Custom domains and SSL

- Every store gets `<slug>.jellyshop.app` (one wildcard DNS record; Cloudflare's free certificate covers one level of wildcard).
- Own domains through **Cloudflare for SaaS**: the merchant adds a CNAME to `stores.jellyshop.app`; Cloudflare issues and renews the certificate. 100 hostnames free, then about $0.10 per hostname per month.
- A Next.js `proxy` (Next 16's name for middleware) maps the host to the store (`StoreDomain` table, cached at the edge) and rewrites to `/[storeSlug]`. The existing `/<slug>` addresses keep working.

---

## 3. Images

| Step | Today | Planned |
| --- | --- | --- |
| Upload limit | 10 MB file, 40 MP decode limit | Keep 10 MB and 40 MP as input limits; refuse sides over 8,000 px with a plain message |
| Original kept | Full size, rotated, metadata stripped | Longest side capped at 2,560 px and re-encoded (JPEG q82 / WebP q80); the true original is not kept |
| Copies | WebP at 320/640/1280 | WebP **and** AVIF at 320/640/960/1280/1920 (only sizes smaller than the source) |
| Placeholder | None | 16 px blur image stored with the record (≈300 bytes), shown while the photo loads |
| Delivery | Through the API function | Straight from R2 through Cloudflare's CDN, address contains the hash |
| `<img>` | `srcset`, lazy except first row | Same, plus `<picture>` with AVIF first, width/height always set (no layout shift) |
| Duplicates | Same file in the same store is reused (hash check) | Same; plus a scheduled clean-up of images no product, page or published design uses for 30 days (moved to a "removed" area first, deleted 30 days later) |

Effect on a typical 1.2 MB phone photo: stored ≈ 350 KB original + ≈ 450 KB of copies; a shopper on a phone downloads 30–60 KB instead of the original.

Storage choice: **Cloudflare R2** ($0.015/GB-month, $0.36 per million reads, **no egress fees**) instead of Supabase Storage (100 GB included on Pro, then $0.021/GB, egress beyond 250 GB at $0.09/GB, and today every read also costs a function call). Moving is done with a new `R2MediaStorage` adapter behind `MEDIA_PROVIDER=r2` (the code already switches storage by this setting), a copy job, and a fallback that reads from Supabase until the copy is complete. Old addresses (`/api/public/media/...`) keep working by redirecting to the new address.

**Storage and bandwidth per store (after the plan):**

| Store | Images | Stored | R2 storage | Image views / month | Reads reaching R2 (5% miss) | Image cost / month |
| --- | --- | --- | --- | --- | --- | --- |
| Small | 150 | ~0.12 GB | $0.002 | 24k | 1.2k | **< $0.01** |
| Medium | 1,500 | ~1.2 GB | $0.02 | 240k | 12k | **~$0.02** |
| Large | 15,000 | ~12 GB | $0.18 | 2.4M | 120k | **~$0.22** |

---

## 4. Cost model

### Assumptions

| | Small | Medium | Large |
| --- | --- | --- | --- |
| Products / images | 50 / 150 | 500 / 1,500 | 5,000 / 15,000 |
| Page views / month | 2,000 | 20,000 | 200,000 |
| Orders / month | 20 | 200 | 2,000 |
| Emails / month (≈3 per order + admin) | 70 | 700 | 7,000 |
| Custom domain | yes | yes | yes |

Platform-wide fixed costs, shared across stores (at 1,000 paying stores):

| Item | Monthly | Per store |
| --- | --- | --- |
| Supabase Pro + Large compute (2 cores, 8 GB) | ~$135 | $0.14 |
| Cloudflare Workers paid + Pro zone | ~$30 | $0.03 |
| Cloud Functions/Run baseline, scheduler, logs | ~$20 | $0.02 |
| Monitoring and error tracking | ~$30 | $0.03 |
| Email domain / provider minimum | ~$10 | $0.01 |
| **Total fixed** | **~$225** | **~$0.23** |

At 100 stores the same fixed costs are about $1.50 per store (smaller database), so the margin is still above 85%; below ~20 paying stores fixed costs dominate.

### Cost per store per month, after the plan

| Item | Small | Medium | Large |
| --- | --- | --- | --- |
| Share of fixed costs | $0.23 | $0.23 | $0.23 |
| Pages (edge requests, cache misses re-rendered) | $0.00 | $0.03 | $0.30 |
| API calls (cart, checkout, admin, refills) | $0.01 | $0.05 | $0.35 |
| Database disk and extra load | $0.00 | $0.01 | $0.60 |
| Images (table above) | $0.00 | $0.02 | $0.22 |
| Email (~$0.10 per 1,000, e.g. Amazon SES) | $0.01 | $0.07 | $0.70 |
| Custom domain (Cloudflare for SaaS) | $0.10 | $0.10 | $0.10 |
| **Infrastructure subtotal** | **$0.35** | **$0.51** | **$2.50** |
| Collecting the $20 (Stripe card fee ~2.9% + $0.30, Stripe Billing 0.7%) | $1.02 | $1.02 | $1.02 |
| **Total** | **$1.37** | **$1.53** | **$3.52** |
| **Margin on $20** | **93%** | **92%** | **82%** |

Not included: support time, your salaries, VAT, refunds/chargebacks on subscriptions, and shopper payment fees (paid by the merchant, see below).

### Same stores today (rough estimate, current design deployed as is)

| | Small | Medium | Large |
| --- | --- | --- | --- |
| Catalogue JSON sent to browsers | small | ~12 GB | ~1 TB+ |
| Images through the function | ~1.5 GB | ~14 GB | ~140 GB |
| Function calls | ~15k | ~160k | ~1.6M |
| **Estimated infrastructure** | **~$0.50** | **~$5–8** | **~$60–120** |

A large store today would cost more than its $20 plan. The catalogue download and image route are the reason.

### Biggest cost drivers, in order

1. **Who pays Stripe Connect fees.** If the platform pays them, Stripe charges about $2 per active connected account per month plus 0.25% + $0.25 per payout. On a store selling $50k a month that is ~$130, far more than everything else together. The connected accounts must be set up so **the merchant pays Stripe's fees** (the Accounts v2 "fees collector" setting in `backend/src/stripe/client.ts`). **To check together before launch.**
2. Collecting the subscription itself (~$1 per $20). Annual plans cut this to ~$0.10/month.
3. Shopper traffic hitting servers instead of the cache (fixed by Phase 1).
4. Images through the API (fixed by Phases 1 and 3).
5. Email at high order volume (fine at $0.10 per 1,000; avoid per-seat email products).

### Plan limits and fair use (to set with billing)

| $20 plan | Limit |
| --- | --- |
| Products | 5,000 |
| Image storage | 10 GB (≈12,000 photos after processing) |
| Page views | 250k / month fair use; above that we contact the merchant about a higher plan |
| Staff accounts | 3 |
| Custom domains | 1 (+ the free `*.jellyshop.app` address) |
| Emails | Order and account emails only; marketing email is a paid add-on later |

---

## 5. Inactive and unused stores

Most stores that are never used should cost **only a few database rows**. With Phase 1 in place they already cost almost nothing (no traffic = no compute; images in R2 at fractions of a cent). The stages below make sure storage and risk stay small too.

### What counts as activity

Recorded once a day per store (no per-request database writes):

- merchant sign-in or admin request (`lastMerchantActivityAt`)
- order placed (`lastOrderAt`)
- storefront visits (daily count taken from edge analytics or a sampled beacon, `lastVisitAt`)
- subscription state: trialing / active / past due / cancelled (`billingStatus`, `trialEndsAt`)

### Stages

```mermaid
stateDiagram-v2
  [*] --> Active
  Active --> Quiet: 30 days, no sign-in and no orders
  Quiet --> Active: any activity
  Quiet --> Paused: trial ended + 14 days unpaid,\nor 90 days fully idle on an unpaid store
  Paused --> Active: merchant pays or signs in and restores
  Paused --> Archived: 60 days paused
  Archived --> Active: merchant restores (minutes)
  Archived --> Deleted: 12 months archived,\nafter emails at 30, 7 and 1 day
  Deleted --> [*]
```

| Stage | What shoppers see | What we keep | Cost |
| --- | --- | --- | --- |
| Active | Normal store | Everything | Normal |
| Quiet | Normal store, served from the edge cache only (no scheduled work for it) | Everything | ~$0 |
| Paused | A static "This store is closed for now" page (cached); checkout off | Everything | Rows + images only |
| Archived | Same closed page | A compressed export (products, pages, design, orders, customers) in R2 Infrequent Access ($0.01/GB); image copies removed (rebuilt from originals on restore); draft history and old publications removed | Fractions of a cent |
| Deleted | Store address shows "not found" | Order and invoice records kept anonymised for accounting (UK: 6 years) unless legal advice says otherwise | 0 |

Rules that protect merchants:

- A paying (active subscription) store is never paused for inactivity.
- A store with orders is never deleted without an emailed export link first.
- Every stage change sends an email and is written to an audit table; every step is undoable until deletion.
- Restore is one button in the admin ("Restore my store"); archived stores come back within minutes from the export.
- Trials: one free trial per merchant account and card (14 days suggested), at most 1 unpaid store per account, unpaid stores can't take orders after the trial.

Scheduled jobs (one daily job, not one per minute):

1. Roll up the day's activity per store.
2. Move stores between stages, send warning emails.
3. Archive / restore / delete in small batches.
4. Image clean-up: mark images unused for 30 days, delete marked images 30 days later.
5. Remove expired imports, old rate-limit rows, old draft generations beyond the last 20.

---

## 6. Workflows

### Store creation

```mermaid
sequenceDiagram
  Merchant->>Admin: Sign up, onboarding
  Admin->>API: Create store (trial starts)
  API->>DB: Store, membership, starter design (draft)
  API->>Stripe: Customer + trial subscription (Phase 4)
  Merchant->>Admin: Publish
  API->>DB: Immutable publication
  API->>Next: Refresh tag store:<id>
  API->>Cloudflare: Add custom hostname (if any)
```

### Page request

```mermaid
sequenceDiagram
  Shopper->>Cloudflare: GET shop.example.com/products/oak-bed
  alt cached
    Cloudflare-->>Shopper: HTML (~50 ms)
  else not cached
    Cloudflare->>Next: render
    Next->>API: design + this product (cached data, tags)
    API->>DB: queries
    Next-->>Cloudflare: HTML, stored until the tag is refreshed
    Cloudflare-->>Shopper: HTML
  end
  Shopper->>API: live stock/price for this product (small)
  Shopper->>R2: photos via CDN (WebP/AVIF, right size)
```

### Image upload and delivery

```mermaid
sequenceDiagram
  Merchant->>API: Upload photo (≤10 MB)
  API->>API: Check type and size, hash (reuse if duplicate)
  API->>API: Rotate, cap 2560 px, WebP/AVIF copies, blur placeholder
  API->>R2: Write original + copies under the hash
  API->>DB: Media row (sizes, placeholder, address)
  Shopper->>Cloudflare: media.jellyshop.app/<store>/<hash>/640.avif
  Cloudflare->>R2: only on first request per edge
```

### Billing

Stripe Billing subscription per merchant account → webhook updates `billingStatus` → lifecycle job reads it. Failed payment: Stripe retries for 14 days, the merchant sees a banner, then the store is paused (not deleted).

---

## 7. Monitoring

| Watch | Tool | Alert when |
| --- | --- | --- |
| Monthly cost | Google Cloud budget, Supabase usage, Cloudflare billing | Daily spend > 1.5× the 7-day average; month forecast > budget |
| Edge cache hit rate | Cloudflare analytics | HTML hit rate < 85% for an hour |
| Real shopper speed | Web Vitals sent from the storefront (`useReportWebVitals`) to a small endpoint or PostHog | p75 LCP > 2.5 s, INP > 200 ms, CLS > 0.1, TTFB > 800 ms, per store and overall |
| API health | Cloud Logging + the existing `Server-Timing` / slow-request log | p95 > 1 s, error rate > 1% |
| Database | Supabase advisors and `pg_stat_statements` | Query mean > 100 ms; connections > 80% |
| Storage growth | Daily job writes bytes per store | Platform growth > 10%/week; a store over 80% of its plan limit |
| Heavy stores | Daily top 20 by requests and image bytes | A store over its fair-use page views |
| Lifecycle job | Job result log | Job failed or ran > 10 min |

---

## 8. Implementation phases

Each phase ends with tests, a commit and a report, as usual.

| Phase | What | Touches DB/storage/accounts? |
| --- | --- | --- |
| **0. Measure** | Deploy a preview build (or measure staging through a production build), record Lighthouse, TTFB and page weight for 3 stores × 3 pages × phone/desktop; record request counts per page view. | No |
| **1. Cacheable storefront (code only)** | (a) Stop the browser catalogue download on store pages; load only what each page needs on the server. (b) Move the password check to the Next `proxy` (cookie read only for protected stores) so pages can be cached; send the "protected" flag with the cached store details. (c) Tag-based refresh endpoint in Next + backend calls on publish, product, collection, menu, page and theme changes; raise the cache limits. (d) Live stock/price request on product pages. (e) Image route: use the stored hash as ETag (no SHA-256 per request), `s-maxage`, redirect to the right size. (f) Upload processing: 2,560 px cap, more widths, AVIF. | No (code only) |
| **2. Small additive migrations** | `Media.placeholder`, `Media.variants` (sizes/formats); 20 missing foreign-key indexes; `Store` activity and billing columns + `StoreLifecycleEvent` table; backfill placeholders for existing images. | **Yes: new columns/tables only, needs your OK and staging apply** |
| **3. Cloudflare** | R2 bucket + `media.` domain, `R2MediaStorage` adapter, copy job with fallback; Cloudflare in front of the storefront; `*.jellyshop.app`; Cloudflare for SaaS custom hostnames + `proxy` host mapping; spike OpenNext and pick a host. | **Yes: new accounts, storage move** |
| **4. Billing and limits** | Stripe Billing plan, 14-day trial, webhook → `billingStatus`, plan limits enforced in the API, admin billing page; check Stripe Connect fee responsibility. | Yes (Stripe settings) |
| **5. Lifecycle** | Daily job (activity roll-up, stages, emails, archive/restore, image clean-up); closed-store page; restore button. Deletion step stays switched off until you approve it separately. | Yes (deletes data; gated) |
| **6. Monitoring** | Web Vitals collection, budgets and alerts, daily cost/storage report. | Accounts |

Expected effect of Phase 1 alone (to be confirmed by Phase 0/1 measurements): cached pages answer in roughly 50–150 ms from the edge instead of 0.6–3 s, phone Lighthouse performance in the 85–95 range, and server calls per page view drop from ~5 to ~0.1.

### Also recommended

- Run the API in the same region as the database (move the function to `europe-west1`, or the database to the US). Quick, big win for every uncached request.
- Raise the function's `maxInstances` from 5 once caching is in place, with a budget alert.
- Cache confirmed users for the admin (the `User` upsert runs on every signed-in request: 18k times on staging).

---

## 9. Decisions I need from you

1. **Phase 1 go-ahead** (code only; no database or storage changes).
2. **Hosting**: Cloudflare Workers (recommended, after a short spike) vs Vercel Pro vs Cloud Run.
3. **Move images to Cloudflare R2** (needs a Cloudflare account).
4. **Cache freshness**: OK that a price/stock badge on a page can lag a few seconds after a change (checkout always re-checks)?
5. **Billing**: $20 monthly; trial length (14 days?); annual plan; any free tier?
6. **Retention**: 30 / 90 / 60 days / 12 months as above, and how long to keep order records after deletion.
7. **Stripe Connect fees**: confirm merchants pay their own Stripe fees.
8. **API/database region**: move one so they sit together.

---

## Phase 1 results (2026-11-22)

Code only: no database, storage or account changes.

### What changed

| Change | Where |
| --- | --- |
| Store pages are cached (rendered on the first visit, kept until the store changes). Home, product, information, blog, metaobject, cart, checkout and account pages. Collection, Shop all, search and newsletter pages still render per visit (they read filters and search words from the address) but their store data is cached. | `app/[storeSlug]/layout.tsx` (`generateStaticParams` returns `[]`, `revalidate`), the dynamic child pages, `force-dynamic` on search/shop/unsubscribe |
| Every server read of published data is tagged `storefront:<slug>` + `store:<id>`; safety limit `STOREFRONT_CACHE_SECONDS` (default 300 s) | `features/storefront/storefront-cache.ts`, `server-storefront.ts`, page/blog/article/binding/metaobject/access readers, uploaded theme files (1 day) |
| Refresh endpoint `POST /api/revalidate` (`Authorization: Bearer STOREFRONT_REVALIDATE_SECRET`, body `{ storeId }` or `{ slug }`) | `app/api/revalidate/route.ts` |
| Backend asks for a refresh after every successful merchant change under `/api/stores/:id/...` (waits up to 1.5 s, never fails the request) and after a payment settles, fails or is cancelled (stock changes) | `backend/src/storefront/cache-refresh.ts`, `app.ts`, `stripe/webhooks/connect-payments-route.ts`; `STOREFRONT_REVALIDATE_URL` + `STOREFRONT_REVALIDATE_SECRET` |
| Password check moved out of the page into `src/proxy.ts` (cached pages can't read cookies). Open stores pass through; a locked shopper on a protected store sees `/store-password/<slug>` at the same address; the backend is asked at most once a minute per store and per token. Backend unreachable = store open (as before). `store-password` added to reserved store addresses. | `features/storefront-access/access-gate.ts`, `src/proxy.ts`, `app/store-password/[storeSlug]/page.tsx` |
| The browser no longer downloads the whole catalogue a second time on every visit | `features/commerce/components/storefront-catalog-sync.tsx` |
| Menu destinations (pages, blogs, articles) come with the page: menus are complete in the first HTML and one browser request per page is gone | `server-storefront.ts` (`navigation`), `storefront-bootstrap.tsx`, `navigation/use-resource-links.ts` |
| Uploads: longest side capped at 2,560 px; copies at 320/640/960/1280/1920 but none larger than the photo itself (one copy at the photo's own width); a missing width is served by the next larger copy, else the largest smaller one; ETag from the stored content hash instead of hashing every response; `s-maxage` added so a CDN may keep images | `backend/src/media/service.ts`, `routes.ts` |
| Site address for canonical links from `NEXT_PUBLIC_SITE_URL` (was read from the request) | store layout |

### Measured (local production build, local backend, staging data, read-only)

Same machine, same stores, before and after. "Backend calls" were counted by a small proxy between the storefront and the API.

| Page | Server response before | after (cached) | Backend calls per 4 views, before | after | Browser API calls per visit, before | after |
| --- | --- | --- | --- | --- | --- | --- |
| Resthaven demo home | 580 ms | 8–15 ms | 4 | 0 | 5 (+4 photos) | 1 |
| Product page | 590 ms | 7–14 ms | 4 | 0 | 6 (+4 photos) | 2 (+4 photos) |
| Collection (still per visit) | 560–985 ms | 30–80 ms | 4 | 0 | 7 (+11 photos) | 2 (+11 photos) |
| Information page | 530–600 ms | 6–9 ms | 8 | 0 | 5 | 1 |
| Express Bed home | 570–620 ms | 6–8 ms | 8 | 0 | 5 | 1 |

The first visit after a change (or after a deploy) still renders the page: 1.3 s measured locally, 2.4–4.8 s from a cold server. HTML weight is unchanged (190–300 KB), because each page still carries the store's catalogue; that is the next speed item (see below). Lighthouse was not run this time; the change it would see is the first byte.

Checked: refresh with the right secret rebuilt only that store (`MISS` then `HIT`), a wrong secret is refused (401), search words still give their own results, 8 store pages load in Chrome with no console errors, a missing page still gives the store's 404. Not checked live: a password-protected store (none exists on staging; unit tests cover the gate), the backend calling the refresh after a real merchant edit or payment (unit tests cover both).

### Deploying it

1. Backend first or together: the new image widths are accepted only by the new backend (the storefront does not ask for them yet).
2. Storefront: set `NEXT_PUBLIC_SITE_URL`, `STOREFRONT_REVALIDATE_SECRET`; backend: `STOREFRONT_REVALIDATE_URL=https://<site>/api/revalidate` and the same secret. Then `STOREFRONT_CACHE_SECONDS=3600`.
3. With more than one storefront server, Next's page cache is per server unless a shared cache handler is set up (part of the hosting choice in Phase 3).

### Still to do (later phases)

- Pages still carry the whole catalogue (HTML 200–300 KB, grows with products). Moving sections to load only what they show is the next storefront speed item.
- Photos are still served through the API function (Phase 3: R2 + CDN). The storefront can ask for 960/1920 widths once the new backend is live.
- Reviews summary is still one browser request per page.
