# IssuesMar21 Assessment

Date: 2026-03-22

Source: [IssuesMar21.docx](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/docs/IssuesMar21.docx)

## Scope

This remediation covers the March 21 Results and Revision Chains issues with the approved decisions:

- Session naming: preserve the first established session name across chained uploads unless the session has no stored name yet.
- Impact overflow tooltip: list category name plus criticality.
- View Impact affordance: always apply a subtle glow when the button is clickable.

## Issue 1

Problem:
On the Results page, the session name changed to the newest file name every time a new revision was added to the chain.

Cause:
The backend created every accepted history entry with `sessionName = fileB.name`, including chained uploads for an existing session.

Fix:
When a new upload is added to an existing session, reuse the session name already stored on the latest active history entry. Only fall back to the incoming `fileB` name when the session does not yet have a stored title.

Validation:
- Backend e2e verifies chained uploads preserve the initial session name until renamed.
- Backend e2e verifies a manual rename stays in place when another revision is added later.
- Results e2e verifies the session title input shows the preserved session title while the current comparison dialog still shows the latest comparison file label.

## Issue 2

Problem:
The row of Results page action buttons was visually detached from the session title row.

Cause:
The session title bar and the icon-action strip were rendered in separate layout bands.

Fix:
When a session is active, place the icon-action strip on the same header row as the session title editor. Keep the toolbar fallback for the no-session state.

Validation:
- Results Playwright coverage confirms the updated toolbar and session header remain measurable and interactive.
- Mobile CSS keeps the header stacked when screen width is constrained.

## Issue 3

Problem:
The Impact column looked like a textbox rather than a mission-control pill with engineering-friendly severity cues.

Cause:
The Impact criticality element used a full-width rectangular style that read like an input field instead of a status pill.

Fix:
Restyle the Impact criticality element as a proper mission pill with High, Medium, Low, and review-state color coding.

Validation:
- Frontend typecheck passed after the Results grid markup change.
- Results Playwright coverage confirms the Impact dialog remains reachable through the updated cell presentation.

## Issue 4

Problem:
Rows with more than one matched taxonomy category showed a compact `+N` style summary, but the user could not inspect all impacted categories from the grid.

Cause:
The Results grid compressed multiple categories into a single string summary and exposed no complete hover detail.

Fix:
Render the primary category separately and show the additional categories count as a dedicated overflow pill with a tooltip listing every matched category and its criticality.

Validation:
- The Results grid now emits stable overflow test IDs and tooltip content for multi-category rows.
- Existing Results dialog behavior remains unchanged for deeper inspection.

## Issue 5

Problem:
The `View Impact` action was technically clickable but not visually emphasized.

Cause:
The button used the standard table-action styling with no persistent attention cue.

Fix:
Add a subtle always-on glow to clickable `View Impact` buttons, matching the intent of the Compare-page Run-button affordance without causing layout shift.

Validation:
- Results Playwright coverage confirms the button stays stable and clickable after the glow was introduced.
- The final animation avoids transform scaling to preserve click stability.

## Issue 6

Problem:
The progress badge was visually oversized for its information density and repeated row-count information that already appears in the `Showing ...` pagination summary.

Cause:
The completed badge displayed loaded-row and total-row counts inside a large badge, duplicating nearby pagination context.

Fix:
Reduce the badge footprint, add a compact progress track, use stronger color treatment, and switch the completed state to a concise readiness message instead of repeating total rows.

Validation:
- Results Playwright coverage confirms the completed badge still appears reliably.
- The updated badge text now communicates readiness instead of duplicating pagination totals.

## Issue 7

Problem:
The top-right session pills lacked plain-language explanations for support and purchasing users.

Cause:
The pills rendered as short labels only, with no tooltip help text.

Fix:
Add plain-language tooltips for:

- comparison count
- current loaded comparison
- latest available comparison

Validation:
- Results session-header Playwright coverage asserts the tooltip titles for all three pills.

## Files Changed

- [upload-history.service.ts](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/apps/backend/src/uploads/upload-history.service.ts)
- [stage1.e2e-spec.ts](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/apps/backend/test/stage1.e2e-spec.ts)
- [results-grid.tsx](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/apps/frontend/components/results-grid.tsx)
- [globals.css](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/apps/frontend/app/globals.css)
- [auth-shell.spec.ts](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/tests/e2e/auth-shell.spec.ts)
- [results-redesign.spec.ts](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/tests/e2e/results-redesign.spec.ts)
