---
name: mission-control-aesthetics
description: Recreate BOM Compare VX frontend pages in the new Project Gravity Control aesthetic defined in docs/DESIGN_CONCEPT.md and the HTML examples in artifacts/. Use when the user wants a page, route, dialog, or the whole frontend redesigned to the new visual system. If the user has not already said whether the change is for one page or the whole frontend, clarify that scope before implementing.
---

# Mission Control Aesthetics

Use this skill when frontend work must follow the new BOM Compare VX design system from:

* `docs/DESIGN_CONCEPT.md`
* the HTML mockups in `artifacts/`

This skill replaces the old "match Upload and Results" baseline. The artifacts and the design concept are now the source of truth.

## First move: clarify scope

If the user has not already been explicit, ask one short question before implementation:

`Should I apply the new design across the whole frontend or only to a single page?`

Scope must be one of:

* whole frontend
* one specific page, route, dialog, or surface

When available:

* In Plan mode, use `request_user_input`
* Otherwise, ask directly in plain text

Do not guess between single-page and whole-frontend rollout if the request is ambiguous.

## Source order

Read sources in this order:

1. `docs/DESIGN_CONCEPT.md`
2. `references/artifact-map.md`
3. the relevant files in `artifacts/`
4. the current implementation for the affected route or routes

Rules:

* Treat the artifact HTML as the concrete visual target.
* Use `docs/DESIGN_CONCEPT.md` for system-wide tokens, layout intent, typography, color meaning, and gap-filling where a mockup is incomplete.
* If a route does not yet have a dedicated artifact pair, use the generic artifact pair plus the design concept.

## Artifact selection

Use `references/artifact-map.md` to choose the right examples.

Selection rules:

* For a single page, open the matching dark and light artifact pair first.
* For a whole-frontend rollout, use the generic dark/light pair to align shell-level design, then use route-specific pairs for each page family.
* If the user references a specific artifact file, prioritize that file.
* If multiple artifact files are relevant, read only the ones needed for the current page or rollout phase.

## Design system rules

Apply the new design as defined by the design concept and artifacts:

* Dark theme is primary, light theme must also be supported.
* Use the documented palette, including `#121212`, `#1E1E1E`, `#2A2A2A`, `#F7F9FC`, `#FFFFFF`, `#DADCE0`, `#424242`, and the cyan/lime/amber/red/blue accents.
* Use `Inter` for primary UI text and `Roboto Mono` for part numbers, revision ids, dense metadata, and tabular values.
* Reuse the existing line-art icon language from `mission-icons.tsx`.
* Preserve the shell structure, route behavior, and application workflow unless the user explicitly requests functional changes.
* Replace the old aesthetic completely; do not preserve legacy visual treatment just because it already exists in code.

## Implementation rules

Always:

* inventory current controls, states, and workflows before redesigning
* preserve behavior, data flow, and API interactions unless the user requested functional changes
* preserve route stability and existing selectors or test ids where practical
* translate existing controls into the new aesthetic even when the mockup is conceptual instead of exhaustive
* keep both dark and light theme implementations aligned with the artifact pair

When working on one page:

* scope changes tightly to that page
* touch shared shell or tokens only when needed for true parity
* prefer isolated page or feature styling over spraying changes across unrelated legacy selectors

When working across the whole frontend:

* establish or refactor shared design tokens first
* unify shell, page headers, cards, tables, controls, and theme handling across routes
* migrate route families in deliberate phases instead of mixing unrelated partial redesigns
* validate each route family as it is moved over

## Recommended workflow

### Single page

1. Clarify the exact target page if needed.
2. Read `docs/DESIGN_CONCEPT.md`.
3. Read `references/artifact-map.md`.
4. Open the matching artifact pair for that page.
5. Inspect the current implementation and list the behaviors that must survive the redesign.
6. Implement the redesign.
7. Validate with focused frontend checks.

### Whole frontend

1. Clarify that the user wants a whole-frontend rollout.
2. Read `docs/DESIGN_CONCEPT.md`.
3. Read `references/artifact-map.md`.
4. Open the generic dark/light artifact pair plus the route-specific pairs for the first rollout slice.
5. Inventory shared shell primitives and route families.
6. Establish shared tokens, layout primitives, and theme handling first.
7. Migrate routes in phases.
8. Validate each phase, then run broader frontend checks at the end.

## Validation

Run the smallest relevant set first, then broaden as needed.

Baseline checks:

* `npm --prefix apps/frontend run typecheck`
* `npm --prefix apps/frontend run build`

When interactions or page structure change:

* focused `npx playwright test ...`

For larger rollouts:

* `npm run frontend:ci`
* relevant route-specific or workflow-specific Playwright coverage

Always report:

* which artifacts were used
* whether scope was single page or whole frontend
* exact validation commands run
* pass/fail results

## Anti-patterns

Do not:

* treat `/upload` and `/results` as the only aesthetic source of truth
* invent a new visual system that conflicts with `docs/DESIGN_CONCEPT.md`
* apply only one theme when the artifact family clearly defines both
* make business logic changes without explicit user approval
* skip the scope question when the user did not specify whole frontend vs single page
* bulk-load every artifact file when only one pair is relevant
