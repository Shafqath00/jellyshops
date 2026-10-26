# Jelly Shops documentation

Jelly Shops is a multi-tenant e-commerce platform for small merchants: a merchant admin, a visual theme editor, public storefronts and Stripe Connect payments.

This index describes the repository **as it is today**. Narrative documents were written from the code; reference documents (file maps, function reference, endpoints, database schema, dead-code report) are **generated** from the source and must not be edited by hand:

```bash
node scripts/generate-docs.mjs      # file maps, function reference, endpoints, dead-code report
node scripts/generate-db-docs.mjs   # database schema (reads the database in backend/.env, read-only)
```

If a narrative document disagrees with a generated one, the generated one is right: fix the narrative.

## Start here

| I want to... | Read |
| --- | --- |
| Understand the whole system | [architecture/system-overview.md](architecture/system-overview.md) |
| Run it locally | [development/local-setup.md](development/local-setup.md) |
| Know which environment variables exist | [development/environment-variables.md](development/environment-variables.md) |
| Find a file or see who imports it | [file-structure/frontend-file-map.md](file-structure/frontend-file-map.md), [file-structure/backend-file-map.md](file-structure/backend-file-map.md) |
| Find a function and its signature | [functions/frontend-functions.md](functions/frontend-functions.md), [functions/backend-functions.md](functions/backend-functions.md) |
| Call or change an API | [api/endpoints.md](api/endpoints.md), [api/authentication.md](api/authentication.md) |
| Understand a table | [architecture/database-schema.md](architecture/database-schema.md), [architecture/database-architecture.md](architecture/database-architecture.md) |
| Work on a feature | [features/](features/) |
| Test or deploy | [development/testing.md](development/testing.md), [development/deployment.md](development/deployment.md) |

## Contents

- `architecture/` — [system-overview](architecture/system-overview.md), [frontend-architecture](architecture/frontend-architecture.md), [backend-architecture](architecture/backend-architecture.md), [database-architecture](architecture/database-architecture.md), [database-schema](architecture/database-schema.md) (generated).
- `file-structure/` — [frontend-file-map](file-structure/frontend-file-map.md) and [backend-file-map](file-structure/backend-file-map.md) (generated), [shared-modules](file-structure/shared-modules.md).
- `api/` — [endpoints](api/endpoints.md) (generated), [authentication](api/authentication.md).
- `features/` — [feature coverage](features/README.md), [product-management](features/product-management.md), [order-management](features/order-management.md), [checkout](features/checkout.md), [payment-system](features/payment-system.md), [theme-system](features/theme-system.md), [theme-editor](features/theme-editor.md), [notifications-and-digital-delivery](features/notifications-and-digital-delivery.md), [customers](features/customers.md), [publishing](features/publishing.md).
- `functions/` — generated function references.
- `development/` — [local-setup](development/local-setup.md), [environment-variables](development/environment-variables.md), [testing](development/testing.md), [deployment](development/deployment.md).
- `reports/` — [dead-code-and-structure](reports/dead-code-and-structure.md) (generated), plus older audits and test reports.

Older documents kept in place: [backend-architecture.md](backend-architecture.md) (detailed backend guide), [theme-architecture.md](theme-architecture.md), [jelly-minimal-launch-checklist.md](jelly-minimal-launch-checklist.md), [jelly-avenue-launch-checklist.md](jelly-avenue-launch-checklist.md), [order-management-progress.md](order-management-progress.md), `../backend/docs/order-notifications-digital.md`.
