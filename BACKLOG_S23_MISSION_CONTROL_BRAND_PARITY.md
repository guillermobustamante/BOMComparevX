# Backlog S23 - Mission Control Brand Parity

## Goal

Correct the secondary authenticated pages so they match the approved Mission Control baseline already established on `/upload` and `/results`.

This backlog should:

* preserve current routes, data contracts, and user workflows
* treat the existing `/upload` and `/results` UI as the visual source of truth
* remove the looser first-pass workspace interpretation where it diverges from the baseline
* align `/mappings`, `/history`, `/notifications`, `/admin`, and their dialogs/popups to the exact Mission Control aesthetic principles
* create a reusable local skill so future pages can adopt the same aesthetic without reinterpretation

## Locked product decisions

1. Design source of truth:
   * the provided `/upload` and `/results` screenshots are the baseline
   * if a component is missing from those screenshots, the fallback is the same Mission Control language, not a new visual treatment

2. Aesthetic rules:
   * app background stays a subtle cool light gray
   * cards and popups use flat white surfaces with 1px light-gray borders
   * no drop shadows
   * corners stay restrained, roughly 4px to 6px where practical
   * UI text uses a clean sans-serif
   * data labels, file names, revision identifiers, and compact all-caps labels use monospace
   * color is reserved for pills, status, and row emphasis only

3. Component rules:
   * buttons stay white with thin gray borders and subtle rounding
   * icon actions use the same restrained treatment as `/results`
   * inputs and selects stay wide, flat, and lightly bordered
   * tables use horizontal separators only
   * dialogs and popovers follow the same flat Mission Control surface treatment

4. Functional guardrail:
   * this is still a frontend-only sprint
   * no workflow or API redesign is permitted
   * current selectors and user actions should remain stable wherever practical

5. Reuse rule:
   * future new pages should not restate this design system ad hoc
   * create a local skill that encodes the visual baseline and when to apply it

## Current problem

The first mission-control unification pass improved consistency, but it still drifted from the actual approved baseline:

* `/notifications` became card-heavy and too branded instead of quiet and operational
* `/mappings` added summary surfaces and chrome that do not exist in the baseline
* `/history` still uses heavier cards and dialogs than the baseline tone
* `/admin` still reads as a separate visual system despite partial retheming
* popup surfaces in those areas remain visually richer than the baseline allows

## Current implementation evidence

Baseline screens:

* `apps/frontend/components/upload-validation-form.tsx`
* `apps/frontend/components/results-grid.tsx`
* `apps/frontend/app/globals.css`

Affected pages:

* `apps/frontend/components/notifications-panel.tsx`
* `apps/frontend/components/mapping-control-center.tsx`
* `apps/frontend/components/mapping-preview-editor.tsx`
* `apps/frontend/components/history-panel.tsx`
* `apps/frontend/components/admin-governance-console.tsx`
* `apps/frontend/components/active-workspace-notice.tsx`

Regression coverage:

* `tests/e2e/auth-shell.spec.ts`
* `tests/e2e/navigation-redesign.spec.ts`

## Architecture decision

Recommended implementation boundary:

* keep the current page components and behaviors
* replace the secondary-page workspace theme layer with a stricter Mission Control token set and component rules
* simplify any markup that exists only to support the looser first-pass theme
* add a local skill that captures the approved baseline and its component mapping rules

Why this is the correct boundary:

* the gap is branding fidelity, not functionality
* the baseline already exists in the product
* a token-and-surface correction is lower risk than another broad redesign
* encoding the rules as a skill reduces repeat drift

## Scope

### In scope

1. Amend documentation to record the stricter baseline and the corrective sprint
2. Apply the flat Mission Control baseline to `/notifications`
3. Apply the flat Mission Control baseline to `/mappings` and mapping preview
4. Apply the flat Mission Control baseline to `/history`
5. Apply the flat Mission Control baseline to `/admin`
6. Align dialogs and popovers used by those pages to the same baseline
7. Create a local Mission Control aesthetics skill for future page implementation
8. Run focused regression validation proving no workflow breakage

### Out of scope

* backend changes
* workflow redesign
* changes to business logic on the affected pages
* redesigning `/upload` or `/results`

## UX changes

1. Replace gradients, larger radii, extra chrome, and summary-card interpretation with the flatter Mission Control baseline.
2. Increase whitespace and reduce decorative treatment so pages feel operational, not promotional.
3. Normalize buttons, pills, inputs, tables, and popup surfaces to the baseline component behavior.
4. Use monospace more intentionally for file names, revision identifiers, compact all-caps labels, and dense data surfaces.

## Data contract changes

No backend or API contract changes are required.

## Stories

### S23-01 - Corrective documentation and baseline codification
As the delivery team, we need the corrected mission-control baseline captured in sprint/backlog records so the implementation is traceable and no longer ambiguous.

Status:
* `Completed`

### S23-02 - Strict Mission Control parity for Notifications, History, and Mappings
As a user moving between operational pages, I want the secondary pages to match the exact upload/results Mission Control baseline so the product feels like one coherent system.

Status:
* `Completed`

### S23-03 - Strict Mission Control parity for Admin and popup surfaces
As an admin user, I want governance pages and supporting dialogs/popovers to use the same flat Mission Control language so dense workflows still look like part of the same product.

Status:
* `Completed`

### S23-04 - Reusable Mission Control aesthetics skill
As a coding agent, I need a reusable skill that encodes this aesthetic baseline so future pages can adopt it consistently.

Status:
* `Completed`

### S23-05 - Regression coverage and verification
As the delivery team, we need focused validation proving the theme correction did not break existing functionality.

Status:
* `Completed`

## Acceptance bar

* `/mappings`, `/history`, `/notifications`, and `/admin` must visually match the flatter Mission Control baseline already present on `/upload` and `/results`.
* Dialogs and popovers used by those pages must use flat white surfaces, thin borders, restrained radii, and no shadows.
* Buttons, icon actions, pills, inputs, and tables on those pages must follow the same baseline component rules.
* The affected pages must remain responsive without overlap or clipping.
* Existing workflows and routes must continue working.
* A local reusable aesthetics skill must exist in `.codex/skills`.

## Completion note

Implemented and validated on `2026-03-17`.
