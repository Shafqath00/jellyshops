# AGENTS.md — Jelly Shop Store Editor

## Mission

Implement the Jelly Shop Store Editor exactly from:

1. `docs/superpowers/specs/2026-08-30-jelly-shop-store-editor-design.md`
2. `docs/superpowers/plans/2026-08-30-jelly-shop-store-editor-implementation-plan.md`

Do not redesign the architecture while implementing it. If the existing repository materially conflicts with the plan, stop and report the conflict before changing core boundaries.

## Non-negotiable project rules

- Package manager: **npm only**. Do not introduce pnpm or yarn.
- Use npm workspaces from the repository root.
- Language: TypeScript.
- Frontend: Next.js + React.
- Backend: Node.js + Express.
- ORM: Prisma.
- Database: PostgreSQL / Google Cloud SQL.
- Auth: Firebase Authentication + Firebase Admin.
- Assets: Google Cloud Storage signed uploads.
- State: Zustand.
- Validation: Zod/shared storefront schemas.
- Drag/drop: `@dnd-kit`.
- API integration tests: Supertest.
- Unit/component tests: Vitest + React Testing Library.
- End-to-end tests: Playwright.
- Do not add Kubernetes, GraphQL, Redis, microservices, CRDTs, custom CSS execution, custom JavaScript execution, or a second storefront renderer.
- Public storefront must never read the editor draft.
- The iframe preview and public storefront must use the same renderer package.
- Content must survive switching among all five themes.
- Use optimistic draft revisioning.
- Use immutable publication rows.

## Working method

- Follow the implementation plan in order.
- Each task begins with its failing test.
- Run the exact focused test before implementation and verify it fails for the expected reason.
- Implement the smallest code that satisfies the task.
- Run focused tests, then the relevant package test suite.
- Commit at the end of every task using the plan’s commit message.
- Keep commits small and independently reviewable.
- Do not batch several plan tasks into one commit.
- Do not “clean up” unrelated code.
- Prefer small focused files and explicit interfaces.
- Do not leave `TODO`, `TBD`, dummy behavior, dead feature flags, or placeholder production code.

## Before implementation

Use the Superpowers workflow available in Codex:
- `superpowers:subagent-driven-development` is recommended for executing the plan.
- `superpowers:executing-plans` is acceptable for inline/batch execution.
- Use `superpowers:test-driven-development` for each implementation task.
- Use `superpowers:verification-before-completion` before claiming the plan is complete.

## Completion gate

Do not claim completion until:
- `npm run lint` passes;
- `npm run typecheck` passes;
- `npm test` passes;
- Playwright Store Editor E2E passes;
- production builds for admin, storefront, and API pass;
- all five themes pass compatibility tests;
- tenant isolation tests pass;
- draft/publication separation test passes.
