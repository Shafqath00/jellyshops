# Testing

## Commands

| Where | Command | What it runs |
| --- | --- | --- |
| `backend/` | `npm run typecheck` | `tsc --noEmit` |
| `backend/` | `npm test` | Vitest unit/route/service tests (`vitest.config.ts`: setup `test/unit-environment.ts`, 2 workers, 15 s test timeout; `test/integration/**` excluded). `pretest` rebuilds the three shared packages. |
| `backend/` | `npm run test:integration` | `test/integration/*.test.ts` (catalog schema, local V4 publication pipeline and workspace compilation, onboarding reset) using `vitest.integration.config.ts` |
| `backend/` | `npm run test:start` | Boots the built server and checks it (`scripts/verify-built-server.mjs`) |
| `jellyshops/` | `npm run typecheck`, `npm run lint`, `npm test` | `tsc`, ESLint, Vitest (`pretest` builds the storefront packages) |
| `jellyshops/` | `npm run test:e2e` | Playwright through `scripts/run-playwright.mjs`, which starts the backend and a Next dev server on separate ports |
| `jellyshops/` | `JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/jelly-minimal-theme.spec.ts` | One spec, avoiding the port used by another dev server |

CI (`.github/workflows/core-mvp.yml`) runs: frontend `npm ci`; `node scripts/prepare-shared-packages.mjs --check`; backend `npm ci`, typecheck, tests (`--maxWorkers=2`), build; frontend typecheck, lint, tests, build.

## Results at the time this document was written (2026-10-22, branch `local/task3`)

- Backend: typecheck clean; 97 test files, 427 tests pass.
- Frontend: typecheck clean; 112 test files, 461 of 462 pass on the full run. The checkout page test (`src/app/[storeSlug]/checkout/page.test.tsx`) timed out at its 5 s limit while the machine was under load and passed when run alone.
- Frontend lint: 144 errors and 211 warnings exist repo-wide (none in the order-management files); the CI lint step is therefore expected to fail until they are fixed.
- Production build of the frontend passes.
- Playwright specs (`jellyshops/e2e/`): `first-order`, `jelly-minimal-theme`, `onboarding`, `starter-responsive`, `store-editor`, `stripe-connect-commerce`, `template-library`. Not re-run for this document.

## Where tests live

- Backend: next to the code as `*.test.ts` (routes with Supertest-style requests against `createApp`, services with fakes for repositories and the Stripe gateway, SQL behaviour with PGlite-compatible databases).
- Frontend: `*.test.ts(x)` next to the component or module (Testing Library); shared setup in `jellyshops/src/test`.
- Shared packages: tests beside each package's `src`.

## What to run before changing sensitive areas

| Area | Minimum |
| --- | --- |
| Checkout, payments, webhooks | `backend`: `npm test -- src/commerce src/stripe` |
| Order management, notifications, digital | `backend`: `npm test -- src/commerce`; frontend: `npx vitest run src/app/admin/orders "src/app/[storeSlug]"` |
| Auth and store isolation | `backend`: `npm test -- src/auth src/tenants` |
| Theme, editor, publishing | `backend`: `npm test -- src/storefront`; frontend: `npx vitest run src/features/store-editor`; `npm run test:e2e` for the theme spec |
