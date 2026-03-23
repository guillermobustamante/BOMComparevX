# Sprint S25 - Frontend PM Assessment Closeout

## 1. Sprint metadata
- Sprint: `S25`
- Theme: `Frontend PM Assessment Closeout`
- Scope type: `Execution-ready frontend corrective sprint`
- Owner: `Product + Engineering`
- Status: `Completed with narrowed follow-up`

## 2. Sprint goal
Close the remaining open issues from `docs/Frontend-PM-Assessment-2026-03-22.md` so the authenticated frontend is visually consistent, manufacturing-oriented in language, and more stable on the Results workflow.

## 3. Locked decisions
- Treat `docs/Frontend-PM-Assessment-2026-03-22.md` as the source of truth for the remaining open items.
- Keep the existing Mission Control baseline and do not reopen S23 as a redesign exercise.
- Use the documented manufacturing-focused wording set across shell labels, page titles, and helper copy.
- Preserve current routes, workflow order, and API contracts unless a small performance hardening change proves necessary.
- Prioritize Results stability/refetch hardening over broad speed tuning because the current measured issue is instability, not raw slowness.

## 4. Source evidence used

Planning and assessment evidence reviewed:
- `BACKLOG_S25_FRONTEND_PM_ASSESSMENT_CLOSEOUT.md`
- `docs/Frontend-PM-Assessment-2026-03-22.md`
- `docs/ISSUE_TRACKER.md`
- `PRODUCT_PLAN.md`
- `README.md`
- `apps/frontend/README.md`
- `docs/runbooks/s4-08-performance-baseline.md`

Code evidence reviewed:
- `apps/frontend/components/app-shell.tsx`
- `apps/frontend/components/active-workspace-notice.tsx`
- `apps/frontend/components/upload-validation-form.tsx`
- `apps/frontend/components/mapping-control-center.tsx`
- `apps/frontend/components/history-panel.tsx`
- `apps/frontend/components/notifications-panel.tsx`
- `apps/frontend/components/admin-governance-console.tsx`
- `apps/frontend/components/results-grid.tsx`
- `apps/frontend/app/globals.css`

Validation evidence reviewed:
- `tests/e2e/auth-shell.spec.ts`
- `tests/e2e/navigation-redesign.spec.ts`
- `tests/e2e/results-redesign.spec.ts`
- `tests/e2e/results-interaction-perf.spec.ts`
- `test-results/live-frontend-profile/runtime-profile-report.json`
- `test-results/live-frontend-profile/results-interaction-profile.json`

## 5. Execution stories

### S25-01 - PM assessment traceability and sprint documentation
As the delivery team, we need the PM assessment open items converted into backlog and sprint records so the closeout work is scoped, ordered, and testable.

Status:
- `Completed`

### S25-02 - Manufacturing-focused shell naming and profile cleanup
As a manufacturing user, I want navigation and shell identity areas to use plain operational language so I can understand the workspace without decoding internal product terminology.

Status:
- `Completed`

### S25-03 - Secondary-page density and action-hierarchy correction
As a cross-functional reviewer, I want Mapping, History, Notifications, and Admin to surface the important information and actions earlier so the product feels efficient and consistent.

Status:
- `Completed`

### S25-04 - Compare page vertical-rhythm cleanup
As a repeat upload user, I want the Compare screen to place the revision work area higher on the page so I can move into the task faster.

Status:
- `Completed`

### S25-05 - Results refetch and stability hardening
As a reviewer on the core change-review page, I want Results to avoid unnecessary background churn and late-moving support data so the workspace remains stable and efficient.

Status:
- `Completed with residual follow-up`

### S25-06 - Regression, performance, and report closeout
As the delivery team, we need targeted validation and a refreshed PM report so completed versus remaining work is explicit.

Status:
- `Completed`

## 6. Acceptance bar
- The open items `UI-03` through `UI-10`, `PERF-03`, and `COPY-01` from the PM report must be addressed in code or reclassified with a narrower residual status.
- Navigation labels, page titles, subtitles, and helper text must align with manufacturing-focused wording.
- Secondary pages must show tighter spacing and clearer primary actions without overlap or workflow loss.
- The Compare page hero must consume less vertical space.
- Results must defer nonessential share/history fetches until those surfaces are opened.
- Results polling must not reset unnecessarily because unrelated local view state changes.
- Focused frontend validation and relevant Playwright coverage must pass.

## 7. Source issue
- `ISSUE-036` in `docs/ISSUE_TRACKER.md`

## 8. Recommended sequencing
1. Add traceability docs and the new issue entry.
2. Correct shell naming, page titles, subtitles, and identity/footer treatment.
3. Tighten Compare hero spacing and secondary-page density/action hierarchy.
4. Harden Results polling and lazy side-data loading.
5. Update tests, rerun focused validation, and refresh the PM report status tracker.

## 9. Verification
- `npm --prefix apps/frontend run typecheck`
- `npm --prefix apps/frontend run build`
- focused Playwright coverage for:
  - shell/navigation labels and expanded/collapsed behavior
  - upload layout and CTA continuity
  - mappings/history/notifications/admin page content and actions
  - Results redesign and interaction performance coverage

## 10. Residual notes
- This sprint is intended as a closeout pass on an already-strong frontend, not a new UX direction.
- Implemented and validated on `2026-03-22`.
- If Results CLS remains materially open after refetch hardening, a follow-up issue should isolate the remaining late-layout source with dedicated instrumentation.
- Residual follow-up after completion:
  - `UI-03` remains open in the PM assessment because post-change live profiling still reports Results Lighthouse `78` with `CLS 0.586446`.
