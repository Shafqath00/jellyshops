# Store Theme Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a merchant browse, install, and edit an original starter theme.

**Architecture:** Immutable bundled theme definitions are served by the backend. Installing one seeds an isolated store workspace in Supabase and opens the existing editor.

**Tech Stack:** Next.js, Express, `pg`, Supabase PostgreSQL, Vitest.

**Spec:** `backend/docs/superpowers/specs/2026-09-15-store-theme-library-design.md`

## Global Constraints

- No Prisma or Google Cloud SQL dependencies.
- Theme definitions are original and bundled with the application.
- Store data is isolated by `storeId`.

---

### Task 1: Theme catalog API

**Files:** Create `backend/src/themes/catalog.ts`; modify `backend/src/app.ts`; test `backend/src/themes/catalog.test.ts`.

- [ ] Define Sweet Bakes, Modern Retail, and Minimal Catalog with preview metadata and starter layouts.
- [ ] Add authenticated catalog and install endpoints.
- [ ] Verify catalog response and store isolation with Vitest.

### Task 2: Supabase installation transaction

**Files:** Create `backend/src/themes/supabase-theme-service.ts`; modify `backend/src/database/client.ts`; test `backend/src/themes/supabase-theme-service.test.ts`.

- [ ] Upsert `ThemeConfiguration`, `StorefrontWorkspace`, and starter template rows in one transaction.
- [ ] Increment the workspace generation after installation.
- [ ] Verify a store receives only its selected theme.

### Task 3: Online Store overview

**Files:** Create `jellyshops/src/app/admin/online-store/page.tsx`; modify the admin navigation; test the page.

- [ ] Render active-theme preview and edit action.
- [ ] Render theme cards with Add actions.
- [ ] Install selected theme and navigate to the editor.
