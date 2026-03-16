# Backlog Execution Skill Examples

These examples show the expected triggers and operating style for this skill.

## Example 1: Full backlog implementation

User request:
- `Implement BACKLOG_S20_RESULTS_SESSION_WORKSPACE_CONTINUITY end-to-end.`

Expected behavior:
- read `BACKLOG_S20_RESULTS_SESSION_WORKSPACE_CONTINUITY.md` first
- read `V1_SPEC.md`, `SPRINT_PLAN.md`, repo README files, and any runbooks tied to results, history, or session behavior
- inspect the affected code in `apps/frontend/app`, `apps/frontend/components`, `apps/backend/src`, and relevant tests
- summarize constraints, risks, and unknowns before coding
- implement the smallest repo-consistent solution
- run relevant tests plus the browser flow
- end with a verified closeout

## Example 2: Ordered sprint train

User request:
- `Execute S19 first, then S20 Phase 0, then the rest of S20 in that order.`

Expected behavior:
- read the named sprint docs first
- normalize the request into an explicit phase train
- treat `S20` Phase 0 dependencies as blocking gates for later `S20` workspace UX
- execute only the current safe phase unless the user explicitly wants continuous execution
- after each phase, report validation, blockers, and whether it is safe to continue

## Example 3: Backlog-linked bug fix

User request:
- `Fix the mapping-confirmation bug as part of S14 and verify the full flow.`

Expected behavior:
- identify the S14 backlog file and related spec sections
- inspect existing mapping contracts, controller and service flow, route handlers, and tests
- preserve current mapping architecture and audit behavior
- add or update tests for the regression
- validate the real mapping flow in the running app when feasible

## Example 4: Frontend-only backlog slice

User request:
- `Complete the upload validation UX polish from the Stage 2 backlog item.`

Expected behavior:
- read the Stage 2 backlog and frontend and backend README sections relevant to upload validation
- inspect current upload page, validation route, and Playwright coverage
- match the existing component and route patterns
- validate responsive, loading, error, and blocked states
- run frontend build plus the targeted browser flow
