# Sprint S22 - Frontend Mission Control Unification

## 1. Sprint metadata
- Sprint: `S22`
- Theme: `Frontend Mission Control Unification`
- Scope type: `Execution-ready frontend sprint record`
- Owner: `Product + Engineering`
- Status: `Completed`

## 2. Sprint goal
Adopt the Mission Control theme consistently across the authenticated frontend pages and popup surfaces that still diverge from `/upload` and `/results`, while preserving all current workflows and route behavior.

## 3. Locked decisions
- Keep this sprint frontend-only and avoid backend contract changes.
- Use `/upload` and `/results` as the design anchor for page framing, surface language, spacing, controls, and modal treatment.
- Reuse the current shell and existing component boundaries wherever possible.
- Preserve current workflows on `/admin`, `/notifications`, `/history`, `/mappings`, and mapping preview rather than redesigning their business behavior.
- Preserve existing test IDs and route wiring wherever practical to reduce regression churn.
- Unify dialogs, detail surfaces, and popovers visually with the Mission Control modal language.

## 4. Source evidence used

Code evidence reviewed:
- `apps/frontend/components/app-shell.tsx`
- `apps/frontend/components/notifications-panel.tsx`
- `apps/frontend/components/mapping-control-center.tsx`
- `apps/frontend/components/mapping-preview-editor.tsx`
- `apps/frontend/components/history-panel.tsx`
- `apps/frontend/components/admin-governance-console.tsx`
- `apps/frontend/app/globals.css`
- `tests/e2e/auth-shell.spec.ts`
- `tests/e2e/navigation-redesign.spec.ts`

Planning evidence reviewed:
- `BACKLOG_S22_FRONTEND_MISSION_CONTROL_UNIFICATION.md`
- `docs/ISSUE_TRACKER.md`
- `README.md`
- `apps/frontend/README.md`

## 5. Execution stories

### S22-01 - Shared Mission Control workspace scaffolding for secondary pages
As the frontend shell, we need a reusable Mission Control page treatment for authenticated routes beyond `/upload` and `/results` so that the rest of the product can inherit a coherent visual system.

Status:
- `Completed`

### S22-02 - Notifications and revision chains surface unification
As a reviewer, I want notifications and revision chains to look and feel like the existing Mission Control workspace so that jumping between pages does not feel like context switching into a different product.

Status:
- `Completed`

### S22-03 - Mapping pages Mission Control adoption
As a mapping reviewer, I want the mappings pages to use the same Mission Control cards, toolbar rhythm, and responsive behavior so that mapping review feels like part of the same workflow family as compare and results.

Status:
- `Completed`

### S22-04 - Admin governance and popup surface unification
As an admin user, I want governance sections, editors, and popovers to share the same Mission Control language so that dense controls remain usable without looking disconnected from the rest of the app.

Status:
- `Completed`

### S22-05 - Regression coverage and responsive validation for theme adoption
As the delivery team, we need regression coverage proving the Mission Control unification did not break existing page workflows or route wiring.

Status:
- `Completed`

## 6. Acceptance bar
- `/admin`, `/notifications`, `/history`, `/mappings`, and mapping preview must visually align with the Mission Control language already present on `/upload` and `/results`.
- Dialogs, popovers, and compact detail surfaces used by those pages must adopt the same modal/surface language.
- The affected pages must remain responsive without overlapping controls.
- Existing user workflows on those pages must continue functioning.
- Existing routes and navigation must remain intact.
- Focused browser coverage must continue proving page load, navigation, and core actions across the affected surfaces.

## 7. Source issue
- `ISSUE-033` in `docs/ISSUE_TRACKER.md`

## 8. Recommended sequencing
1. Add shared page-aware Mission Control shell classes and shared secondary-page surface styling.
2. Adopt the shared treatment on `/notifications` and `/history`.
3. Adopt the shared treatment on mappings landing and mapping preview surfaces.
4. Retheme admin cards, forms, tables, and taxonomy popovers.
5. Finish with browser regression updates and responsive verification.

## 9. Verification
- `npm --prefix apps/frontend run typecheck`
- `npm --prefix apps/frontend run build`
- focused Playwright coverage for:
  - shell navigation across themed pages
  - notifications workflow visibility
  - history grouped-session actions
  - mappings landing and preview flows
  - admin governance and taxonomy editor workflows

## 10. Residual notes
- Completion note:
  - Implemented and validated in repo with shared secondary-page Mission Control scaffolding, rethemed notifications, mappings, history, admin, and aligned dialogs/popovers across those flows.
- This sprint intentionally avoids backend contract changes and keeps the visual unification boundary separate from future workflow redesign.
