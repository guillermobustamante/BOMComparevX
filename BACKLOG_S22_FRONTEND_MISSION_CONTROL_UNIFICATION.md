# Backlog S22 - Frontend Mission Control Unification

## Goal

Extend the Mission Control theme already established on `/upload` and `/results` across the remaining authenticated frontend pages and popup surfaces without breaking any current workflows.

This backlog should:

* preserve existing routes, API contracts, and page-level functionality
* reuse the current shell and results/upload Mission Control language instead of inventing another visual system
* unify `/admin`, `/notifications`, `/history`, `/mappings`, and related dialogs/popups under the same workspace treatment
* keep responsive behavior stable across desktop and smaller viewports
* update regression coverage where DOM shape or labels change

## Locked product decisions

1. Delivery boundary:
   * this is a frontend-only sprint
   * no backend contract or persistence changes are required
   * existing business behaviors must remain intact

2. Design source of truth:
   * `/upload` and `/results` are the visual anchors for Mission Control
   * the rest of the authenticated pages should inherit that surface language, spacing, controls, and popup treatment
   * the goal is coherence, not page duplication

3. Routing and functionality:
   * `/admin`, `/notifications`, `/history`, `/mappings`, and mapping-preview flows keep their current actions
   * all existing links, form submissions, and page-specific controls must continue working
   * existing test IDs should be preserved where practical to reduce regression risk

4. Page strategy:
   * add shared Mission Control workspace scaffolding for non-results pages
   * use each page's existing information architecture, then reframe it visually through cards, toolbar rhythm, and responsive layout
   * align dialogs, popovers, and compact details surfaces to the same Mission Control modal language

5. Scope guardrail:
   * do not redesign the domain model of admin, notifications, or mapping workflows in this sprint
   * only change copy where needed to support the theme and improve consistency

## Current problem

The shell chrome is already modernized, but the rest of the frontend still diverges noticeably:

* `/notifications` is still table-first and visually flatter than Mission Control
* `/mappings` mixes generic panels and legacy tables with only partial Mission styling
* `/history` is functionally improved but still not fully harmonized with the newer shared surfaces
* `/admin` uses a separate design language that reads like a different product
* popup and detail surfaces across these pages do not consistently match the Mission Control dialog treatment

## Current implementation evidence

Frontend shell and mission-control anchors:

* `apps/frontend/components/app-shell.tsx`
* `apps/frontend/components/results-grid.tsx`
* `apps/frontend/components/upload-validation-form.tsx`
* `apps/frontend/app/globals.css`

Affected pages and popups:

* `apps/frontend/components/notifications-panel.tsx`
* `apps/frontend/components/mapping-control-center.tsx`
* `apps/frontend/components/mapping-preview-editor.tsx`
* `apps/frontend/components/history-panel.tsx`
* `apps/frontend/components/admin-governance-console.tsx`

Regression coverage:

* `tests/e2e/auth-shell.spec.ts`
* `tests/e2e/navigation-redesign.spec.ts`

## Architecture decision

Recommended implementation boundary:

* extend the existing shell with page-aware Mission Control workspace classes
* introduce shared CSS tokens and layout classes for mission-styled secondary pages
* retheme the affected components in place instead of replacing their state or data flows
* preserve existing component entry points and test hooks where possible

Why this is the correct boundary:

* the user request is visual and experiential, not API-driven
* the current shell already provides enough theme context to expand safely
* page-level component rewrites would add risk without delivering more value for this scope
* preserving current selectors and actions reduces regression churn

## Scope

### In scope

1. Add shared Mission Control workspace styling for non-results authenticated pages
2. Align `/notifications` with Mission Control cards, toolbar, list/table surface, and responsive spacing
3. Align `/mappings` landing and mapping preview workspace surfaces with Mission Control cards, sections, and responsive layout
4. Align `/history` card surfaces and dialog treatment with the same shared theme
5. Align `/admin` cards, forms, tables, taxonomy editor surfaces, and popovers with Mission Control
6. Align popup and dialog surfaces used by these pages to the Mission Control modal language
7. Preserve current action behavior and update focused browser regression coverage

### Out of scope

* backend route or DTO changes
* workflow redesign of mapping, notifications, or admin domain behavior
* new feature additions unrelated to theming or responsive layout
* changes to `/upload` or `/results` beyond what is needed for shared styling compatibility

## UX changes

### Shared shell continuity

1. Secondary pages should feel like part of the same Mission Control workspace as `/upload` and `/results`.

2. Page bodies should use:
   * consistent card surfaces
   * consistent header and toolbar spacing
   * consistent pill and input rhythm
   * responsive stacking without overlapping controls

### Notifications

3. Notifications should read as an operational event workspace, not a raw table dropped into a panel.

4. The linked comparison action must remain obvious and intact.

### Mappings

5. The mappings landing page should present governance and review content using mission-styled sections instead of generic nested panels.

6. Mapping preview should keep its current review experience while harmonizing summary cards, groups, evidence panels, and confirm areas with the common Mission language.

### History

7. Revision chains should keep their grouped model while adopting the same shared secondary-page mission surface treatment and dialog styling.

### Admin

8. Governance surfaces should remain information-dense but visually belong to the same product through unified cards, forms, tables, collapse controls, and editor popovers.

## Data contract changes

No backend or API contract changes are required for this sprint.

## Stories

### S22-01 - Shared Mission Control workspace scaffolding for secondary pages
As the frontend shell, we need a reusable Mission Control page treatment for authenticated routes beyond `/upload` and `/results` so that the rest of the product can inherit a coherent visual system.

Status:
* `Completed`

### S22-02 - Notifications and revision chains surface unification
As a reviewer, I want notifications and revision chains to look and feel like the existing Mission Control workspace so that jumping between pages does not feel like context switching into a different product.

Status:
* `Completed`

### S22-03 - Mapping pages Mission Control adoption
As a mapping reviewer, I want the mappings pages to use the same Mission Control cards, toolbar rhythm, and responsive behavior so that mapping review feels like part of the same workflow family as compare and results.

Status:
* `Completed`

### S22-04 - Admin governance and popup surface unification
As an admin user, I want governance sections, editors, and popovers to share the same Mission Control language so that dense controls remain usable without looking disconnected from the rest of the app.

Status:
* `Completed`

### S22-05 - Regression coverage and responsive validation for theme adoption
As the delivery team, we need regression coverage proving the Mission Control unification did not break existing page workflows or route wiring.

Status:
* `Completed`

## Acceptance bar

* `/admin`, `/notifications`, `/history`, `/mappings`, and mapping-preview must visually align with the Mission Control language already present on `/upload` and `/results`.
* Dialogs, popovers, and compact detail surfaces used by those pages must adopt the same modal/surface language.
* The affected pages must remain responsive without overlapping controls.
* Existing user workflows on those pages must continue functioning.
* Existing routes and navigation must remain intact.
* Focused browser coverage must continue proving page load, navigation, and core actions across the affected surfaces.

## Completion note

Implemented and validated on `2026-03-17`.
