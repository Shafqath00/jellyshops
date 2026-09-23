# Merchant first-run onboarding design

Date: 2026-09-24
Status: Proposed for review

## Goal

Help a new Jelly Shop merchant reach an editable storefront in a short, understandable path:

```text
Create account → name the shop → choose a starter → edit the storefront
```

The merchant should choose between the existing Fresh Market and Artisan Boutique starters. The V4 starter installer remains responsible for creating the store-scoped workspace, and the existing editor remains the destination after a successful install.

## Current flow

Email/password signup uses the existing Supabase authentication flow. A successful signup with an established session routes to `/onboarding`; email confirmation behavior remains unchanged when signup does not return a session.

The real `/onboarding` route creates a store through the authenticated `POST /api/stores` endpoint, refreshes merchant store context, and currently navigates to `/admin`. Starter selection is already available at `/admin/online-store`; its existing install action sends the merchant to `/admin/online-store/editor` after a successful V4 install.

The separate `/admin/onboarding` route is backed by local demo shop state. It is not part of the real authenticated merchant path and remains out of scope.

## Proposed flow

After successful shop creation, `/onboarding` waits for `refreshMerchant()` to establish the new active store and then routes to `/admin/online-store`. The existing page presents the two starter choices. Choosing a starter uses the current authenticated, store-scoped install API; successful installation continues to the existing editor route.

The onboarding route’s existing-store behavior remains safe: a merchant who already has a store and visits `/onboarding` is sent to `/admin`, rather than being prompted to create another store or reinstall a starter. The new-store redirect must be coordinated with the store-context refresh so the existing-store guard cannot race and send a newly created merchant to the dashboard.

## Boundaries and non-goals

- Keep Supabase signup, login, email confirmation, and admin authentication unchanged.
- Use the existing `POST /api/stores` store-creation contract and V4 starter-install endpoint.
- Do not auto-select or auto-install a starter; merchants retain their choice.
- Do not add a new wizard, post-editor checklist, demo catalog records, publishing step, domain setup, or payments step.
- Do not change the atomicity, authorization, or conflict behavior of starter installation.
- Leave `/admin/onboarding` and its local demo-state behavior untouched.
- Do not create or publish a storefront during account signup or store creation.

## Error and navigation behavior

Store-creation errors stay on `/onboarding` and remain visible beside the form. The user stays on the starter chooser if installation fails or reports a conflict; the existing workspace is not overwritten. The editor opens only after the installer confirms success. Store context must be loaded before entering either authenticated destination.

## Verification

Add focused route/component tests for:

- a storeless signed-in merchant creates a store and is routed to the starter chooser only after merchant context refresh;
- a signed-in merchant with an existing store is routed to the dashboard without creating another store;
- failed store creation remains on onboarding and displays an error;
- signup without an established session retains the email-confirmation message and does not enter store setup;
- the existing starter chooser still installs the selected pack and opens the editor only on success;
- install conflict remains recoverable and does not navigate to the editor.

Run the focused onboarding, authentication, starter chooser, and editor-entry tests, followed by frontend TypeScript and `git diff --check`. No backend behavior change is expected for this slice.
