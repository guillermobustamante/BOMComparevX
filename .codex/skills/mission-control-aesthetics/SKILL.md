---
name: mission-control-aesthetics
description: Apply the BOM Compare VX Mission Control baseline from Upload and Results to new or corrected frontend pages with strict visual parity and no workflow drift.
---

# Mission Control Aesthetics

Use this skill when a page, dialog, popover, or interactive surface must match the approved BOM Compare VX Mission Control visual baseline already established on `/upload` and `/results`.

## Workflow

1. Read `references/mission-control-baseline.md`.
2. Inspect the current `/upload` and `/results` implementation before designing anything new:
   * `apps/frontend/components/upload-validation-form.tsx`
   * `apps/frontend/components/results-grid.tsx`
   * `apps/frontend/app/globals.css`
3. Reuse existing shell structure, buttons, icon actions, pills, tables, and typography where possible.
4. Apply the baseline to the target page using minimal markup changes first and shared CSS second.
5. Preserve routes, behavior, selectors, and data flow unless the user explicitly asks for functional changes.
6. Validate with the relevant frontend checks and focused browser coverage.

## Baseline rules

* Use a cool light-gray app background with flat white surfaces.
* Use thin 1px light-gray borders and restrained radii.
* Do not add gradients, glassmorphism, shadows, or decorative hero treatments.
* Keep UI copy in a clean sans-serif.
* Use monospace for data labels, filenames, revision identifiers, compact all-caps labels, and dense metadata.
* Use color sparingly, mainly in pills, row emphasis, and readiness states.
* Keep tables horizontal-only with subtle headers and no vertical dividers.
* Keep dialogs and popovers visually identical to the same flat surface language.

## Anti-patterns

Do not introduce:

* gradients or tinted panel backgrounds
* drop shadows
* oversized summary cards that are not present in the baseline
* large radii that drift away from Upload and Results
* decorative visual systems that compete with data readability

## Validation

Run the smallest relevant set:

* `npm --prefix apps/frontend run typecheck`
* `npm --prefix apps/frontend run build`
* focused `npx playwright test ...` coverage for affected workflows
