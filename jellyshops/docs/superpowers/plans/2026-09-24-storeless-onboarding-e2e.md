# Storeless Merchant Onboarding E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Repeatedly prove real merchant sign-in, first-store creation, Fresh Market installation, and editor entry using an isolated test merchant that begins each run storeless.

**Architecture:** Keep production authentication and merchant APIs unchanged. Provision a distinct Supabase test account with the existing Admin API path, reset only its specifically identified test-store rows through a test-only script and explicit transactional allowlist, and exercise the normal sign-in/onboarding/starter flow in Playwright.

**Tech Stack:** Node.js/TypeScript, Supabase Auth Admin API, PostgreSQL, PGlite integration tests, Next.js, Playwright.

**Spec:** jellyshops/docs/superpowers/specs/2026-09-24-fresh-market-theme-editor-design.md

## Global Constraints

- Do not reuse the merchant that owns the existing Fresh Market and Artisan Boutique E2E stores.
- Use the real merchant login and API flow; do not bypass login or add another authentication mechanism.
- Keep JELLY_ONBOARDING_E2E_EMAIL and JELLY_ONBOARDING_E2E_PASSWORD only in ignored local E2E configuration; never print or commit them.
- Require JELLY_ONBOARDING_E2E_PROJECT_REF and match it against both configured Supabase Auth and database targets before any remote write.
- Reset only stores owned by the dedicated onboarding test identity and matching its explicit test-store identifier/prefix.
- Preserve both the Supabase Auth account and the internal User row.
- Add no production deletion endpoint and perform no broad deletion.
- Abort reset on project, identity, ownership, foreign-key, or publication-state ambiguity.

## Review Focus

- A wrong/mismatched Supabase project reference must abort before any write; test guard behavior before the reset runs.
- A same-prefix store owned by another merchant must be preserved; seed that case in the PGlite reset test.
- The dedicated Auth account/internal User row must survive repeated reset; assert both after two resets.
- Store publications are immutable and Store relationships are restrictive; reset must reject unexpected publication/dependency rows instead of forcing deletion.
- A merchant with an existing store must still land on /admin; assert this in the authenticated browser test.

---

### Task 1: Inventory reset dependencies and pin reset safety in PGlite

**Files:**
- Create: backend/scripts/lib/onboarding-e2e-reset.ts
- Create: backend/test/integration/onboarding-e2e-reset.test.ts
- Read for schema contract: backend/test/integration/pglite.ts and backend/sql/migrations/

**Interfaces:**
- Consumes: a PostgreSQL-compatible query executor, a verified Supabase merchant UID, the dedicated email, and the fixed onboarding store slug prefix.
- Produces: a test-only reset function that returns the exact reset store IDs and never deletes the Auth or internal User account.

- [ ] **Step 1: Add failing PGlite isolation and identity-preservation tests**

Create two migrated PGlite stores: one owned by the dedicated merchant with the allowed onboarding prefix, one owned by another merchant with the same prefix. Seed representative starter-install rows for each. Seed the dedicated internal User row. Assert reset removes only the dedicated store's allowlisted rows, preserves the other store and its workspace, and preserves the internal User row.

- [ ] **Step 2: Inventory foreign keys from the migrated PGlite schema**

In the test, query PostgreSQL catalog metadata for every table with a foreign key referencing Store and for every descendant referencing those tables. Record and assert the explicit test reset allowlist. Confirm publication rows/current-publication pointers are absent for the normal onboarding flow; an unexpected publication must make reset fail closed.

- [ ] **Step 3: Run the focused integration test**

Run from backend: npm run test:integration -- test/integration/onboarding-e2e-reset.test.ts

Expected: the test fails because the reset function is not yet implemented.

- [ ] **Step 4: Implement transactional, allowlisted reset**

Resolve eligible store IDs only with both owner_user_id equal to the verified merchant UID and slug matching the dedicated prefix. Before deleting, verify the Auth identity/email marker and ensure no unrecognized dependent relation or immutable publication exists. Delete only fixed allowlisted store-owned child rows in foreign-key order, then StoreMembership and Store rows, within one transaction. Do not delete User or Auth rows. On any failed guard, roll back and return a typed error.

- [ ] **Step 5: Rerun the focused reset integration test**

Run the same command. Expected: account and unrelated merchant/store rows remain; a second reset is a no-op and succeeds.

### Task 2: Provision a separate dedicated onboarding test merchant

**Files:**
- Create: backend/scripts/provision-onboarding-e2e.ts
- Modify: backend/package.json
- Use local-only configuration: jellyshops/.env.local

**Interfaces:**
- Consumes: existing Supabase URL, server key, anon key, database URL, and explicit onboarding test project reference.
- Produces: a dedicated Auth account marked for onboarding E2E and local-only email/password variables, without creating or modifying production users.

- [ ] **Step 1: Add project-target and dedicated-identity guard tests**

Extract pure guard functions into the script library and test that mismatched Auth/database project refs, missing test marker, or an email not configured for this dedicated test identity fail before store cleanup or account creation.

- [ ] **Step 2: Run the focused guard/reset integration tests**

Run from backend: npm run test:integration -- test/integration/onboarding-e2e-reset.test.ts

- [ ] **Step 3: Implement provisioning using Supabase Auth Admin**

Require the explicit project ref and verify both configured Auth and database targets match it before writes. Create the dedicated account only if absent; if present, verify a dedicated app_metadata marker set through the Admin API. Generate credentials only when absent and append them to the ignored jellyshops/.env.local file without overwriting unrelated entries. Never log credential values. Do not create a store during provisioning.

- [ ] **Step 4: Add a backend package command and verify safe output**

Add a script command that runs the provisioner. Run it only against the approved test project, inspect the output for credential leakage, and confirm it reports only account identity/status and the local env-file path.

### Task 3: Add a repeatable local reset runner

**Files:**
- Create: backend/scripts/reset-onboarding-e2e.ts
- Modify: backend/package.json
- Modify: jellyshops/scripts/run-onboarding-e2e.mjs
- Modify: jellyshops/package.json
- Modify: jellyshops/playwright.config.ts

**Interfaces:**
- Consumes: verified onboarding credentials, explicit project ref, reset helper from Task 1, and the existing Playwright runner.
- Produces: an explicit onboarding E2E command that resets the dedicated test merchant to storeless state before launching the authenticated browser test.

- [ ] **Step 1: Add failing runner configuration checks**

Test the reset runner's pure argument/environment validation: it must reject missing project reference, wrong project target, missing dedicated identity marker, and a normal non-onboarding merchant. Do not print any secret values.

- [ ] **Step 2: Implement reset orchestration**

Load the ignored local onboarding credentials and backend connection configuration explicitly. Resolve the Auth user with the Admin API, pass only its verified UID/email and the fixed slug prefix to the reset helper, and verify /api/me returns zero stores through a real signed-in API request before launching Playwright. Preserve the account.

- [ ] **Step 3: Ensure Playwright can read local test configuration**

Load Next's normal local environment configuration in Playwright setup so the test process sees dedicated onboarding credentials; do not add credential values to the config or logs. Keep the existing merchant fixture variables separate.

- [ ] **Step 4: Add an explicit onboarding E2E package command**

The command must run reset orchestration first and only then invoke the existing local Playwright runner for e2e/onboarding.spec.ts. It must propagate a nonzero status from reset or Playwright and must not run reset during the general responsive suite.

- [ ] **Step 5: Run reset twice and confirm storeless state**

Run the dedicated reset command twice against the approved test project. Expected: both invocations succeed, /api/me has zero stores, and the Auth account remains usable.

### Task 4: Prove both storeless and existing-merchant browser flows

**Files:**
- Create: jellyshops/e2e/onboarding.spec.ts
- Modify: jellyshops/e2e/fixtures/merchant-auth.ts
- Modify only if needed for env loading: jellyshops/playwright.config.ts
- Read for behavior contract: jellyshops/src/app/onboarding/page.tsx and jellyshops/src/components/admin-auth-gate.tsx

**Interfaces:**
- Consumes: the existing UI login form, dedicated onboarding credential variables, existing merchant credential variables, merchant state refresh, starter chooser, and editor.
- Produces: browser proof of first-store onboarding and the non-onboarding existing-store path.

- [ ] **Step 1: Add failing authenticated browser tests**

Use the real login page. For the dedicated account, verify zero stores, create a unique test store using the onboarding form, wait for merchant state refresh and navigation to the starter chooser, install Fresh Market, then assert the Theme editor opens without another sign-in. For the existing merchant account, sign in through the same login UI and assert /admin is reached rather than /onboarding.

- [ ] **Step 2: Run the browser spec against the current fixture**

Run from jellyshops: npm run test:e2e:onboarding

Expected: the dedicated path fails until the reset/provision setup and assertions are wired.

- [ ] **Step 3: Implement fixture support without weakening auth**

Extend the existing fixture with a credential-set parameter or dedicated onboarding helper. Keep the same real sign-in interaction and session handling. Never inject tokens, mock /api/me, or bypass the auth gate.

- [ ] **Step 4: Verify the storeless merchant flow**

Run: npm run test:e2e:onboarding

Expected: storeless login → first store creation → refreshed merchant state → starter chooser → Fresh Market installation → editor.

- [ ] **Step 5: Verify the existing merchant path**

In the same spec, assert existing merchant login → /admin and no first-store onboarding. Confirm test output never contains either password.

### Task 5: Onboarding gate and data-integrity verification

**Files:** no additional implementation files.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: repeatable authenticated onboarding E2E with a clean, preserved Auth identity.

- [ ] **Step 1: Run reset safety tests**

Run from backend: npm run test:integration -- test/integration/onboarding-e2e-reset.test.ts

Expected: project guards, owner scoping, fixed allowlist, fail-closed publication behavior, idempotence, and account preservation pass.

- [ ] **Step 2: Run the onboarding E2E twice**

Run from jellyshops: npm run test:e2e:onboarding, then run it again.

Expected: each run starts storeless, creates and installs Fresh Market, enters the editor, and the existing merchant still lands at /admin. The dedicated Auth account persists between runs.

- [ ] **Step 3: Run TypeScript and check the intended diff**

Run from backend: npm run typecheck.

Run from jellyshops: npm run typecheck.

Run git diff --check and git status --short. Do not stage or alter unrelated dirty files, generated output, or local credential files.
