# Backlog S25 - Frontend PM Assessment Closeout

## Goal

Close the remaining open UI, copy, and performance issues recorded in `docs/Frontend-PM-Assessment-2026-03-22.md` so the authenticated BOM Compare VX frontend reads as one production-ready manufacturing workspace.

This backlog should:

* preserve current routes, workflow sequence, and data contracts
* treat the PM assessment as the authoritative open-issue list
* apply the documented manufacturing-focused naming recommendations across shell and page copy
* tighten the visual density and action hierarchy on secondary pages without reopening the broader Mission Control baseline
* reduce avoidable Results polling and late-loading churn that still contributes to instability and perceived noise

## Locked product decisions

1. UX direction:
   * keep the current Mission Control baseline established in `/upload` and `/results`
   * this sprint is a closeout pass, not a redesign

2. Language direction:
   * prioritize BOM managers, change managers, engineering, purchasing, and support users
   * use operational manufacturing language instead of system/debug/internal terms

3. Scope guardrail:
   * remain frontend-only unless a narrowly scoped backend endpoint change is strictly required for performance hardening
   * preserve existing route structure, user intents, and current core workflows

4. Performance direction:
   * keep server pagination and the current large-BOM strategy on Results
   * optimize instability, refetch churn, and late data movement before attempting broad speed work

5. Validation rule:
   * every user-visible change must be backed by targeted validation
   * Results performance changes must be checked with the existing runtime/perf test harness where practical

## Source problem

The PM assessment shows the product is close to release-quality, but it still has a visible gap between the anchor experience on `/upload` and `/results` and the rest of the authenticated workspace:

* naming and helper text still expose internal/system phrasing
* Mapping, History, Notifications, and Admin remain too loose, tall, and low-density
* History, Notifications, and Admin still under-emphasize the primary actions users need most
* the expanded-shell footer still looks crowded and technical
* Compare still spends too much vertical space on the upload hero
* Results still has an open performance/design issue around layout stability and unnecessary polling/refetch activity

## Current implementation evidence

PM assessment and performance evidence:

* `docs/Frontend-PM-Assessment-2026-03-22.md`
* `docs/runbooks/s4-08-performance-baseline.md`
* `test-results/live-frontend-profile/runtime-profile-report.json`
* `test-results/live-frontend-profile/results-interaction-profile.json`

Affected implementation:

* `apps/frontend/components/app-shell.tsx`
* `apps/frontend/components/active-workspace-notice.tsx`
* `apps/frontend/components/upload-validation-form.tsx`
* `apps/frontend/components/mapping-control-center.tsx`
* `apps/frontend/components/history-panel.tsx`
* `apps/frontend/components/notifications-panel.tsx`
* `apps/frontend/components/admin-governance-console.tsx`
* `apps/frontend/components/results-grid.tsx`
* `apps/frontend/app/globals.css`

Regression and perf coverage:

* `tests/e2e/auth-shell.spec.ts`
* `tests/e2e/navigation-redesign.spec.ts`
* `tests/e2e/results-redesign.spec.ts`
* `tests/e2e/results-interaction-perf.spec.ts`

## Architecture decision

Recommended implementation boundary:

* use a docs-first corrective sprint anchored to the PM report
* fix cross-page language, visual density, and action prominence inside the existing component structure
* keep the Results page workflow intact while reducing refetch churn and deferring nonessential side-data loads until the corresponding dialogs are opened

Why this is the correct boundary:

* the report now shows the main remaining problems are polish, clarity, and one concentrated Results stability/perf slice
* the existing frontend architecture already supports the required workflows
* a targeted closeout sprint is lower risk than another broad UI reinterpretation

## Scope

### In scope

1. Add a new sprint/backlog record that turns the PM assessment open items into an execution plan
2. Apply manufacturing-focused navigation, title, subtitle, and helper-copy changes
3. Tighten visual density and spacing on `/upload`, `/mappings`, `/history`, `/notifications`, and `/admin`
4. Improve action hierarchy and button labeling on `/history`, `/notifications`, and `/admin`
5. Simplify the expanded-navigation profile footer treatment
6. Normalize pill semantics where passive metadata currently competes with status/urgency
7. Reduce Results polling/refetch churn and defer side-data loads until needed
8. Update validation coverage and the PM assessment status tracker

### Out of scope

* broad backend redesign
* changing business logic or route structure
* removing the current Results server pagination model
* revisiting the already completed S23 Mission Control baseline

## Stories

### S25-01 - PM assessment traceability and sprint documentation
As the delivery team, we need the PM assessment open items converted into backlog and sprint records so the closeout work is scoped, ordered, and testable.

Status:
* `Completed`

### S25-02 - Manufacturing-focused shell naming and profile cleanup
As a manufacturing user, I want navigation and shell identity areas to use plain operational language so I can understand the workspace without decoding internal product terminology.

Status:
* `Completed`

### S25-03 - Secondary-page density and action-hierarchy correction
As a cross-functional reviewer, I want Mapping, History, Notifications, and Admin to surface the important information and actions earlier so the product feels efficient and consistent.

Status:
* `Completed`

### S25-04 - Compare page vertical-rhythm cleanup
As a repeat upload user, I want the Compare screen to place the revision work area higher on the page so I can move into the task faster.

Status:
* `Completed`

### S25-05 - Results refetch and stability hardening
As a reviewer on the core change-review page, I want Results to avoid unnecessary background churn and late-moving support data so the workspace remains stable and efficient.

Status:
* `Completed with residual follow-up`

### S25-06 - Regression, performance, and report closeout
As the delivery team, we need targeted validation and a refreshed PM report so completed versus remaining work is explicit.

Status:
* `Completed`

## Acceptance bar

* The open UI items from the PM report must be either completed or explicitly updated with narrower residual status.
* Navigation, page titles, and helper text must align with manufacturing-focused wording.
* The secondary pages must present denser layouts and clearer primary actions without breaking current workflows.
* The expanded-shell footer must show cleaner identity text with reduced technical clutter.
* The Compare page hero must consume less vertical space while preserving drag/drop clarity.
* Results must defer nonessential share/history data loading until the corresponding surfaces are opened.
* Results polling must no longer depend on unrelated filter/view state.
* Focused frontend validation and relevant Playwright coverage must pass.

## Completion note

Implemented and validated on `2026-03-22`.

Residual follow-up:

* The broader PM assessment closeout was completed in the current branch.
* One narrowed issue remains open after the refetch hardening pass:
  * `UI-03` / residual Results CLS and layout instability
