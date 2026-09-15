# Jelly Shop Store Editor — Codex Execution Pack

This folder contains the approved Store Editor design and an implementation plan designed for Codex.

## Files

- `AGENTS.md` — working rules for Codex.
- `docs/superpowers/specs/2026-08-30-jelly-shop-store-editor-design.md` — approved product and architecture specification.
- `docs/superpowers/plans/2026-08-30-jelly-shop-store-editor-implementation-plan.md` — task-by-task implementation plan.

## How to use it

1. Copy these files into the root of the Jelly Shop repository, preserving their paths.
2. Start Codex in the Jelly Shop repository.
3. Ask Codex:

   > Read `AGENTS.md`, the Store Editor design spec, and the Store Editor implementation plan. Use the Superpowers workflow. Verify the existing repo matches the plan assumptions, then execute Task 1 only. Stop for review after the task and its commit.

4. Review Task 1.
5. Continue task-by-task, or tell Codex to use subagent-driven development for the full plan.
6. Do not ask Codex to implement the whole editor in one unreviewed pass.

## Recommended Codex kickoff prompt

```text
Read AGENTS.md.
Read docs/superpowers/specs/2026-08-30-jelly-shop-store-editor-design.md.
Read docs/superpowers/plans/2026-08-30-jelly-shop-store-editor-implementation-plan.md.

Use superpowers:subagent-driven-development and TDD.
Before changing code, inspect the repository and report any conflict between the current project structure and the plan.
If there is no blocking conflict, execute Task 1 only.
Run the task's focused tests and the relevant package tests.
Commit using the specified message.
Then stop and summarize files changed, tests run, and the commit hash.
```
