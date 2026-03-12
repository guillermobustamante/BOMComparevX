# Frontend Backlog

## 2026-03-12 Admin Visual Refresh

### Goal
- Refresh the `/admin` experience to match the look and feel of [`randomtests/TestTaxonomy4.html`](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\randomtests\TestTaxonomy4.html) for `Admin > Mapping Governance > Taxonomy`, then apply the same design language to the rest of the current Admin surface.

### Scope
- Restyle the current Admin page only.
- Preserve existing Admin behavior, APIs, autosave, and data structure.
- Bring the taxonomy editor closer to the reference: glass card framing, accent rail headings, grouped form sections, chip swimlanes, and stronger hierarchy for move/remove controls.
- Add per-category collapse and expand behavior in the taxonomy editor using [`randomtests/testtaxonomy5.html`](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\randomtests\testtaxonomy5.html) as the interaction and layout base.
- Show the current impact criticality as a live badge beside each taxonomy category title and keep it synchronized with the `Impact Criticality` dropdown.
- Extend that same design language to:
  - Access & Roles
  - Audit & Compliance
  - Data Retention
  - Mapping Governance > Learned Aliases

### Acceptance Criteria
- `/admin` uses a consistent visual system that clearly reflects the reference HTML and screenshot.
- Taxonomy cards use sectioned content blocks and chip swimlanes similar to the reference.
- Each taxonomy category can be collapsed and expanded independently from its header.
- Each taxonomy category shows its current impact criticality beside the title, and changing the dropdown updates the badge immediately.
- The rest of Admin reads as part of the same family instead of generic app panels.
- Existing Admin actions still work: role grant/revoke, policy reset/override, audit export/archive, retention sweep, taxonomy autosave, taxonomy ordering/removal, alias enable/disable.
- Mobile and narrower desktop widths remain usable without layout breakage.
- Frontend verification runs before release.

### Implementation Notes
- Keep the redesign scoped to Admin-specific classes to avoid regressions in Upload, Results, History, Notifications, and Mappings.
- Prefer reusable Admin section and field styles over one-off taxonomy-only CSS.
- Keep current table-based content where it is still the most efficient representation, but restyle tables to fit the new Admin surface.
- Preserve or add stable `data-testid` hooks where Admin browser coverage depends on them.

### Assumptions For This Pass
- Scope is the currently implemented `/admin` page, not future Admin modules that are not yet built.
- Destructive or privileged actions keep current behavior and do not add confirmation dialogs in this pass.
- Dense data tables keep horizontal overflow on smaller screens instead of converting to fully stacked mobile cards.

### Clarification Points If Design Direction Needs Adjustment
- Admin scope options:
  - Option A: refresh only the current `/admin` page now.
  - Option B: create the shared Admin design system now and defer future sections to later implementation.
- Mobile table handling options:
  - Option A: keep horizontally scrollable tables for fidelity and delivery speed.
  - Option B: convert each Admin table to stacked records for stronger mobile ergonomics.
- Action safety options:
  - Option A: keep current one-click actions for parity.
  - Option B: add confirm steps for revoke, remove, archive, and retention actions.

### Verification Plan
- Run frontend typecheck.
- Run frontend build.
- Run Admin-focused Playwright coverage and extend it if the new taxonomy interactions need explicit coverage.
