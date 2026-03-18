# Sprint S23 - Mission Control Brand Parity

## 1. Sprint metadata
- Sprint: `S23`
- Theme: `Mission Control Brand Parity`
- Scope type: `Execution-ready frontend corrective sprint`
- Owner: `Product + Engineering`
- Status: `Completed`

## 2. Sprint goal
Bring `/mappings`, `/history`, `/notifications`, `/admin`, and their popup surfaces into strict visual parity with the approved Mission Control baseline already visible on `/upload` and `/results`.

## 3. Locked decisions
- Treat the `/upload` and `/results` screenshots plus the explicit visual brief as the baseline source of truth.
- Remove gradients, heavier cards, larger radii, and stronger chrome from the secondary-page pass where they diverge from the baseline.
- Keep the sprint frontend-only and preserve all current workflows and routes.
- Use monospace intentionally for data labels, file names, revision codes, and compact all-caps labels.
- Keep color restrained and limited to pills, status, and row emphasis.
- Add a reusable local skill so future pages can adopt the same aesthetic rules without reinterpretation.

## 4. Source evidence used

Code evidence reviewed:
- `apps/frontend/components/upload-validation-form.tsx`
- `apps/frontend/components/results-grid.tsx`
- `apps/frontend/components/notifications-panel.tsx`
- `apps/frontend/components/mapping-control-center.tsx`
- `apps/frontend/components/mapping-preview-editor.tsx`
- `apps/frontend/components/history-panel.tsx`
- `apps/frontend/components/admin-governance-console.tsx`
- `apps/frontend/components/active-workspace-notice.tsx`
- `apps/frontend/app/globals.css`
- `tests/e2e/auth-shell.spec.ts`
- `tests/e2e/navigation-redesign.spec.ts`

Planning evidence reviewed:
- `BACKLOG_S23_MISSION_CONTROL_BRAND_PARITY.md`
- `docs/ISSUE_TRACKER.md`
- `README.md`
- `apps/frontend/README.md`
- user-provided Mission Control baseline brief and screenshots

## 5. Execution stories

### S23-01 - Corrective documentation and baseline codification
As the delivery team, we need the corrected mission-control baseline captured in sprint/backlog records so the implementation is traceable and no longer ambiguous.

Status:
- `Completed`

### S23-02 - Strict Mission Control parity for Notifications, History, and Mappings
As a user moving between operational pages, I want the secondary pages to match the exact upload/results Mission Control baseline so the product feels like one coherent system.

Status:
- `Completed`

### S23-03 - Strict Mission Control parity for Admin and popup surfaces
As an admin user, I want governance pages and supporting dialogs/popovers to use the same flat Mission Control language so dense workflows still look like part of the same product.

Status:
- `Completed`

### S23-04 - Reusable Mission Control aesthetics skill
As a coding agent, I need a reusable skill that encodes this aesthetic baseline so future pages can adopt it consistently.

Status:
- `Completed`

### S23-05 - Regression coverage and verification
As the delivery team, we need focused validation proving the theme correction did not break existing functionality.

Status:
- `Completed`

## 6. Acceptance bar
- `/mappings`, `/history`, `/notifications`, and `/admin` must visually match the flatter Mission Control baseline already present on `/upload` and `/results`.
- Dialogs and popovers used by those pages must use flat white surfaces, thin borders, restrained radii, and no shadows.
- Buttons, icon actions, pills, inputs, and tables on those pages must follow the same baseline component rules.
- The affected pages must remain responsive without overlap or clipping.
- Existing workflows and routes must continue working.
- A local reusable aesthetics skill must exist in `.codex/skills`.

## 7. Source issue
- `ISSUE-034` in `docs/ISSUE_TRACKER.md`

## 8. Recommended sequencing
1. Amend traceability docs to capture the stricter baseline.
2. Replace the secondary-page workspace theme with flat Mission Control tokens and component rules.
3. Simplify notifications and mappings markup where it only existed to support the looser first-pass theme.
4. Align admin, history, dialogs, and popovers to the same flat baseline.
5. Add the reusable aesthetics skill and finish with focused validation.

## 9. Verification
- `npm --prefix apps/frontend run typecheck`
- `npm --prefix apps/frontend run build`
- focused Playwright coverage for:
  - notifications workflow visibility
  - history rename/tag/open/delete behavior
  - mapping preview flows
  - admin governance and taxonomy editor flows
  - navigation across the corrected pages

## 10. Residual notes
- Completion note:
  - Implemented and validated in repo with flat Mission Control parity corrections across the targeted pages plus a reusable local aesthetics skill for future implementation.
- This sprint intentionally corrects branding fidelity without reopening workflow or contract scope.
