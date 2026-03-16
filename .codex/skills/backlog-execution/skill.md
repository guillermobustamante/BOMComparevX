---
name: backlog-execution
description: Implements a BOM Compare VX backlog item, sprint story, stage task, or ordered execution sequence end-to-end inside the existing repository. Use when Codex is asked to execute one or more backlog or sprint files in a defined order by reading repository docs first, following the current architecture and patterns, running relevant tests and validation commands, exercising the real web flow, and reporting validated results.
version: 1.1.0
owner: project-team
intended_audience:
  - AI coding agents
  - software engineers
  - QA engineers
  - tech leads
stage:
  - during backlog implementation
  - during backlog-linked bug fixes
  - before acceptance or demo
tags:
  - backlog
  - implementation
  - qa
  - full-stack
  - repo-aware
  - ai-agent
---

# Backlog Execution Skill

## Purpose

Execute one backlog item or an ordered execution sequence end-to-end in BOM Compare VX with minimal regression risk.

This skill must:
- discover the relevant repository documentation before coding
- align to the current implementation, not an imagined architecture
- keep changes small, explicit, and maintainable
- validate behavior with code-level, test-level, and runtime evidence
- avoid false completion claims

## Required Inputs

Use these inputs in this order whenever they are relevant:

1. target sprint, backlog, or execution-sequence file or files:
   - `docs/SPRINT_S*.md`
   - `BACKLOG_S*.md`
   - `SPRINT_PLAN.md`
   - `PRODUCT_PLAN.md`
2. requirements and decisions:
   - `V1_SPEC.md`
   - `V1_DECISIONS.md`
   - `V1_BacklogQA.md`
3. repo and environment docs:
   - `README.md`
   - `apps/backend/README.md`
   - `apps/frontend/README.md`
   - relevant `docs/runbooks/*`
   - `.env.example`
4. affected implementation and tests:
   - `apps/backend/src`
   - `apps/backend/test`
   - `apps/frontend/app`
   - `apps/frontend/components`
   - `tests/e2e`

If the user names a specific sprint file, read it first.

If the user names a specific backlog file, read it first.

If the user gives an execution order, phase list, or train, preserve that order unless the repository documents show a blocking dependency that requires resequencing.

If the backlog text conflicts with the current codebase, prefer the current implemented architecture unless the backlog item explicitly requires an architectural change.

## Project Anchors

Assume these repo signals unless current code disproves them:

- frontend: Next.js App Router in `apps/frontend`
- backend: NestJS in `apps/backend`
- persistence and config: Prisma, Azure SQL, Key Vault-backed secrets
- repo-level validation:
  - `npm run ci:checks`
  - `npm run verify:story`
  - `npm run ci:security`
- browser validation: Playwright in `tests/e2e`

Treat those as defaults, then verify the affected area from code.

## Mandatory Discovery Order

Before editing, do the following:

1. Read the target sprint or backlog item and traceability docs.
   - for sequence mode, read every named sprint or backlog file in order
   - identify dependencies, blocked stories, and acceptance-bar handoffs between phases
2. Read the relevant README, runbook, env, and contract docs for the touched area.
3. Inspect the affected code paths and nearby tests.
4. Capture the existing patterns:
   - naming
   - file placement
   - module boundaries
   - route and DTO contracts
   - error handling
   - logging and audit patterns
   - feature flags
   - UI composition and state handling
   - test organization
5. Summarize:
   - feature request or ordered execution train
   - affected modules
   - constraints and assumptions
   - risks, dependencies, and unknowns

Do not start coding before this discovery pass is complete.

## Sequence Mode

When the user asks for a sequence of execution rather than a single item:

1. Normalize the request into an explicit ordered train:
   - phase or sprint name
   - goal
   - dependencies
   - acceptance handoff to the next phase
2. Prefer the smallest safe execution slice at a time:
   - one sprint
   - one phase inside a sprint
   - one tightly coupled story cluster
3. Do not start a later phase while an earlier blocking dependency remains unresolved.
4. After each phase, report:
   - completed work
   - validation run
   - remaining blockers
   - whether it is safe to continue to the next phase
5. If the user asks for the full train to continue automatically, still treat each phase boundary as a quality gate and stop on failed validation or architectural conflict.

## Required Workflow

1. Start by listing the docs and code areas reviewed.
2. Provide a concise implementation plan.
   - for sequence mode, list the ordered phases first and mark the current phase being executed
3. Implement in small, logical steps.
4. After each meaningful change, run the narrowest useful validation.
5. Add or update tests with the code change.
6. Run broader validation for the impacted layers before finishing.
7. If local execution is possible, run the application and validate the user flow from the browser perspective.
8. Report blockers, failed assumptions, and corrections as they happen.
9. At phase boundaries, decide explicitly whether to continue, stop, or resequence.
10. Do not declare success until behavior has been validated or an exact blocker is stated.

## Change Rules

- Reuse existing patterns before creating new abstractions.
- Keep diffs as small as practical.
- Do not break unrelated functionality.
- Do not leave TODOs unless unavoidable; explain any exception.
- Prefer explicit, readable code over clever indirection.
- Update tests, types, config, and docs when impacted.
- Verify imports, async flows, null handling, and feature-flag behavior.
- For UI work, cover accessibility, responsive behavior, loading, empty, and error states.
- For backend work, cover validation, error handling, idempotency where relevant, and contract compatibility.
- For full-stack work, verify the frontend, backend, API, and persisted behavior together.

## Validation Expectations

Pick the smallest set that proves the change, then scale up to the relevant repo gates.

Use these commands as the default validation toolbox:

- backend focused:
  - `npm --prefix apps/backend run typecheck`
  - `npm --prefix apps/backend run test:e2e`
  - `npm --prefix apps/backend run ci`
- frontend focused:
  - `npm --prefix apps/frontend run typecheck`
  - `npm --prefix apps/frontend run build`
  - `npx playwright test`
- repo-wide:
  - `npm run check:env-contract`
  - `npm run check:required-files`
  - `npm run ci:checks`
  - `npm run verify:story`
- security or governance related:
  - `npm run ci:security`
- Prisma or schema related:
  - `npm --prefix apps/backend run prisma:validate`
  - `npm --prefix apps/backend run prisma:generate`

Prefer:
- targeted validation first
- `npm run ci:checks` for multi-file or cross-layer work
- `npm run verify:story` for user-visible or end-to-end behavior when feasible

If a command is skipped, state why.

## Runtime and Manual QA Expectations

When the project supports local execution, validate actual behavior from the user perspective. Cover the paths that matter to the change:

- primary happy path
- validation rules
- error handling
- failed network or API scenario where practical
- refresh or reload continuity
- browser console errors
- regression on nearby routes or components
- permissions or tenant behavior if relevant

Use the existing app entrypoints:

- backend:
  - `npm --prefix apps/backend run start:dev`
  - `npm --prefix apps/backend run start:test`
- frontend:
  - `npm --prefix apps/frontend run dev`
  - `npm --prefix apps/frontend run start:e2e`

Do not say manual validation was performed unless it actually was.

## Output Contract

The skill output must contain:

1. docs and code areas reviewed
2. concise implementation plan
   - in sequence mode, include the ordered execution train and current phase status
3. execution findings, blockers, and course corrections
4. final closeout with:
   - files changed
   - what was implemented
   - tests added or updated
   - commands run
   - test results
   - manual web app validation performed
   - remaining risks or follow-ups

For sequence mode, the closeout must also include:
- phases completed
- current phase result
- next recommended phase
- explicit stop reason if the train should not continue yet

## Rejection Triggers

Reject the execution as incomplete if any of the following is true:

- coding started before the relevant docs and local patterns were reviewed
- the solution invents a new architecture without repo evidence
- changed behavior has no corresponding validation
- runtime or browser validation was skipped without explanation
- the closeout omits files, tests, commands, results, or remaining risks
- a multi-phase request does not state which phase was executed and what comes next
- success is claimed despite failing tests or unverified behavior

## AI Coding Agent Orientation

Act as a senior software engineer and QA engineer working inside an existing project.

Your default posture is:
- repo-aware
- low-risk
- verification-heavy
- honest about unknowns

Choose the conservative implementation that best fits the current codebase.
