# UI Approval Remediation Plan

## Purpose

This plan converts the current `ui-qa` findings for `/approval` into an auditable execution sequence that an AI coding agent can follow and verify.

Scope:
- `apps/frontend/app/approval/page.tsx`
- `apps/frontend/components/ui-approval-showcase.tsx`
- `apps/frontend/app/globals.css`
- downstream `ui-qa` rerun after implementation

## Inputs

Primary inputs:
- [FOUNDATION_GENERATION_UI_PLAN.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\FOUNDATION_GENERATION_UI_PLAN.md)
- [UI_VISUAL_APPROVAL_PACK.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\UI_VISUAL_APPROVAL_PACK.md)
- `/approval` implementation in [ui-approval-showcase.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\ui-approval-showcase.tsx)
- latest `ui-qa` findings: `QA-01` through `QA-05`

## Findings To Fix

### QA-01
- Problem: responsive shell breaks collapsed-by-default navigation
- Required outcome: nav stays collapsed by default at all breakpoints; small-screen expansion behaves like an overlay

### QA-02
- Problem: Results list/tree toggle is cosmetically active but structurally unchanged
- Required outcome: list and tree modes render visibly different review states

### QA-03
- Problem: major screen states are missing
- Required outcome: approval route exposes switchable states for loading, empty, error, no-access, and partial/degraded where relevant

### QA-04
- Problem: History lacks the actual compact row-action affordance
- Required outcome: history rows expose a visible action menu or action column with `Open` as primary

### QA-05
- Problem: export interaction model is ambiguous
- Required outcome: CSV and Excel-compatible actions are explicit and individually reviewable

## Execution Strategy

Order matters:
1. Fix shell behavior first so all later review surfaces inherit the right container behavior.
2. Add reusable approval-state controls and state rendering patterns.
3. Fix Results mode switching because it is the most workflow-critical behavior gap.
4. Fix History row actions and Exports action clarity.
5. Rerun build checks.
6. Rerun `ui-qa` and compare against the prior findings.

## File-Level Work Plan

### 1. `apps/frontend/app/globals.css`
- Implement overlay-style expanded nav behavior for smaller widths.
- Preserve collapsed rail as the default shell state.
- Add styling for approval-state toggles and overlay backdrop.
- Add styling for action menus and explicit export action groups if needed.

Acceptance:
- collapsed nav remains default on desktop and mobile
- mobile/tablet expanded nav visually overlays instead of permanently expanding layout

### 2. `apps/frontend/components/ui-approval-showcase.tsx`
- Add approval-state controllers for major screens.
- Render per-screen variants instead of a single happy path.
- Make Results list mode and tree mode structurally different.
- Add explicit History row actions with `Open` as the primary action.
- Split export actions into explicit `CSV` and `Excel-compatible` controls.

Acceptance:
- PM can inspect at least these states:
  - Compare BOMs: ready, loading, error, no-access
  - Mapping Check: populated, warning, empty, error
  - Results: list, tree, loading, empty, error, partial
  - Exports and Sharing: ready, empty recipients, permission-limited
  - History: populated, empty
  - Notifications: populated, empty
  - Admin: authorized, unauthorized

### 3. `apps/frontend/app/approval/page.tsx`
- Keep route metadata aligned to the actual approval scope if the screen list changes.

## AI Agent Execution Notes

Rules for the implementing agent:
- Do not redesign outside the approved Antigravity mission-control direction.
- Reuse one approval-state control pattern across sections instead of inventing per-screen toggles.
- Preserve icon-first controls where approved, but keep high-risk actions textual.
- Prefer explicit conditional rendering over fake labels that imply behavior without showing it.
- Do not remove existing dark/light behavior.

## Verification Plan

Required checks after code changes:
1. `npm --prefix apps/frontend run typecheck`
2. `npm --prefix apps/frontend run build`

## UI-QA Rerun Plan

After implementation:
1. rerun code-aware `ui-qa`
2. compare against prior findings `QA-01` to `QA-05`
3. record whether each finding is:
   - fixed
   - partially fixed
   - still open

## Exit Criteria

This remediation is complete only when:
- the five named findings are resolved or explicitly reduced with documented residual risk
- `/approval` exposes enough interaction and state coverage for PM review
- `ui-qa` no longer fails on the same major issues
