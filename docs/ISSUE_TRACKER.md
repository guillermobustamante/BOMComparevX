# Issue Tracker

## 1. Tracker metadata
- Scope: `Product + Engineering open issues`
- Format: `Sprint-style planning and triage record`
- Status: `Active`

## 2. Open issues

### ISSUE-001 - Excel export loses uploaded workbook presentation
- Status: `Resolved`
- Priority: `P0`
- Area: `Exports / Results`
- First observed: `2026-03-09`

Problem:
- Excel export does not preserve the uploaded workbook look and feel.
- The downloaded workbook is rebuilt as a flat generated sheet, so presentation details such as column widths, colors, table styling, and other workbook formatting are lost.

Evidence:
- Export service rebuilds a fresh workbook from `sheetData` using `XLSX.utils.aoa_to_sheet(...)` at [exports.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\exports\exports.service.ts:144)
- Export uses only parsed headers/template field mapping, not the source workbook structure/styling model, starting at [exports.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\exports\exports.service.ts:99)

Desired outcome:
- Exported Excel should preserve the latest uploaded workbook presentation as closely as possible, including layout and visual structure, while replacing BOM rows with current comparison output.

Locked decisions:
- Use the `latest uploaded file` as the export template baseline.
- Preserve `all sheets/tabs` from the uploaded workbook.
- Preserve Excel `Table` objects and resize them to fit exported data.
- Export BOM Compare metadata in `both` places:
  - appended on the main BOM sheet
  - separate metadata sheet
- Preserve all relevant workbook presentation details where present:
  - column widths
  - cell fills/fonts/borders
  - freeze panes
  - filters
  - hidden rows/columns
  - merged cells
  - conditional formatting
  - formulas outside the replaced BOM row region
- When the exported row count differs from the template row count, preserve and extend the row styling pattern so the output still looks like the uploaded workbook.

Chosen solution:
- `Option 2`
- Patch the latest uploaded workbook package directly at the OOXML level so the BOM sheet, drawings, images, comments, and workbook presentation stay intact while the three comparison metadata columns and metadata sheet are added.

Implementation direction:
- Load the latest uploaded workbook as the export template.
- Preserve every sheet as-is unless the BOM target sheet must be updated.
- Keep the latest uploaded BOM rows as-is on the target sheet.
- Patch the BOM worksheet XML directly instead of rebuilding the workbook through `xlsx.write(...)`.
- Resize the Excel table or query-backed table metadata so it includes the three appended comparison metadata columns.
- Preserve sheet drawings/media and related OOXML parts so image columns survive export.
- Preserve workbook- and sheet-level presentation artifacts.
- Append `Change Type`, `Changed Fields`, and `Classification Reason` on the BOM sheet.
- Also emit a dedicated comparison metadata sheet for audit/readability, with `comparisonId` hidden.

Acceptance bar:
- Downloaded Excel must visually match the latest uploaded workbook closely enough that a user recognizes it as the same workbook family.
- Downloaded Excel must open in Microsoft Excel without repair prompts or discarded worksheet content.
- Main BOM sheet must preserve styling, widths, and table behavior.
- Metadata must be available both inline and on a separate sheet.
- Non-BOM sheets must remain intact.

Resolution:
- Implemented in Sprint `S13`.
- Export now patches the latest uploaded workbook package directly, preserves workbook sheets/tabs, keeps the visible BOM rows from the latest upload intact, preserves drawings/media for image-based sheets, appends the three inline comparison metadata columns, and adds a dedicated metadata sheet with hidden `comparisonId`.
- Follow-up regression fix: corrected malformed `<col>` generation in `sheet1.xml` that caused Excel repair and empty main-sheet rows.
- Verified with backend typecheck and full backend e2e coverage, including a real `.xlsx` preservation test and a guard against duplicate `min`/`max` attributes in worksheet column XML.

### ISSUE-002 - Reopening a previous comparison creates a new comparison instead of reopening the original
- Status: `Open`
- Priority: `P0`
- Area: `Results / History`
- First observed: `2026-03-09`

Evidence:
- [results-grid.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\results-grid.tsx:1367)
- [results-grid.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\results-grid.tsx:682)

Follow-up:
- tracked in `Sprint 12.1`

### ISSUE-003 - Previous-comparisons visibility is initiator-only
- Status: `Open`
- Priority: `P0`
- Area: `Results / History / Authorization`
- First observed: `2026-03-09`

Evidence:
- [upload-history.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\upload-history.service.ts:99)
- [history.controller.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\history.controller.ts:39)

Follow-up:
- tracked in `Sprint 12.1`

### ISSUE-004 - Previous-comparisons modal does not expose real comparison status
- Status: `Open`
- Priority: `P1`
- Area: `Results / History`
- First observed: `2026-03-09`

Evidence:
- [upload-history.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\upload-history.service.ts:16)
- [results-grid.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\results-grid.tsx:1349)

Follow-up:
- tracked in `Sprint 12.1`

### ISSUE-005 - Mapping explainability review UI is intentionally minimal
- Status: `Open`
- Priority: `P2`
- Area: `Mapping / UX`
- First observed: `2026-03-10`

Problem:
- Mapping explainability is now generated backend-first and only lightly surfaced in the current mapping preview.
- Reviewers can see basic reasons and negative signals, but there is no richer UI for score breakdowns, tooltips, grouped evidence, or admin explainability diagnostics.

Desired outcome:
- Add a richer explainability review UI for mapping suggestions after the current S14 backend-first rollout stabilizes.

Locked decision:
- Park richer explainability UI as future work while keeping the current backend-first/light-UI approach.

Follow-up:
- track as future backlog work after S14 mapping-intelligence stabilization

### ISSUE-006 - Results page progress indicator only appears after BOM processing completes
- Status: `Resolved`
- Priority: `P1`
- Area: `Results / Diff Processing / UX`
- First observed: `2026-03-11`

Problem:
- After uploading two BOM files and opening the results page, the user was redirected correctly but did not see live processing progress.
- The results progress badge only became visible after diff computation had already finished, so the user had no true in-flight indication that the BOMs were still being processed.

Evidence:
- Diff jobs were often started inline and only returned a job id after compute completed, preventing the results screen from polling live status early enough: [diff-job.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\diff\diff-job.service.ts:152)
- Diff progress while running was time-based placeholder logic instead of real compute progress: [diff-job.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\diff\diff-job.service.ts:649)
- The results page cleared the just-started running status when `comparisonId` was pushed into the URL, creating a visible progress gap: [results-grid.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\results-grid.tsx:680)

Desired outcome:
- The results page should show a true running progress state while BOM diff computation is actively executing.
- Progress should reflect actual matching/classifying/finalizing work rather than a timer-based placeholder.
- The running badge should remain visible during the initial navigation and URL handoff into the results workspace.

Resolution:
- Implemented on `2026-03-11`.
- Added live runtime progress tracking to diff jobs and changed non-test diff startup to return immediately so the results page can poll while processing is still in progress.
- Added async progressive compute paths for matching, classification, and finalization that periodically yield to the event loop and report real phase progress from the backend.
- Preserved synchronous compute APIs for existing tests and test-mode execution so the established backend test contract remains stable.
- Updated the results page to retain the current running status when the `comparisonId` query parameter is written, avoiding the temporary badge reset during navigation.
- Verified with:
  - `npm --prefix apps/frontend run ci`
  - `npm --prefix apps/backend run typecheck`
  - `npm --prefix apps/backend run build`
  - `npm --prefix apps/backend run test`
- Note: full backend `ci` remains blocked by a Windows Prisma file-lock issue during `prisma generate`, which is separate from this fix.

### ISSUE-007 - Auto-accept fuzzy taxonomy property matches needs governance review
- Status: `Open`
- Priority: `P2`
- Area: `Mapping / Taxonomy / Governance`
- First observed: `2026-03-11`

Problem:
- Tenant taxonomy classification currently auto-accepts high-confidence fuzzy matches between changed BOM property names and taxonomy trigger properties.
- This is acceptable for the current rollout, but it is not yet tenant-governed and may need review workflows, thresholds, or explainability before broader production hardening.

Desired outcome:
- Revisit fuzzy taxonomy matching so tenants can tune thresholds, inspect auto-accepted matches, and optionally require review before fuzzy matches affect controlled classifications.

Locked current decision:
- Keep auto-accept enabled for high-confidence fuzzy matches during the first change-intelligence rollout.

### ISSUE-008 - Compliance trigger overrides are not yet tenant-configurable
- Status: `Open`
- Priority: `P2`
- Area: `Mapping / Taxonomy / Compliance`
- First observed: `2026-03-11`

Problem:
- Compliance triggers currently follow the seeded taxonomy content as-is.
- Tenants cannot yet override or extend the governing standard / compliance trigger text for their internal governance model.

Desired outcome:
- Revisit whether compliance triggers should remain locked to the platform taxonomy or support tenant-level overrides, extensions, or internal policy references.

Locked current decision:
- Keep compliance trigger text as authored in the taxonomy source during the first rollout.

### ISSUE-009 - Repeated BOM instances can be false-matched on shared part/object ids
- Status: `Resolved`
- Priority: `P0`
- Area: `Diff / Matching / Upload Semantics`
- First observed: `2026-03-12`

Problem:
- Some source BOMs contain the same part multiple times while also providing a unique identifier for each occurrence.
- The matching pipeline could collapse shared object ids such as `PartKey` and occurrence ids such as `OccurrenceInternalName` into one generic identifier.
- When that happened, repeated instances of the same part could be cross-matched, producing false `modified` rows and large changed-field lists even though the occurrences were unchanged.

Evidence:
- Upload parsing treated `partkey` and `occurrenceinternalname` as the same `internalId` alias family: [upload-revision.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\upload-revision.service.ts:80)
- Parser resolved that alias family into a single `internalId` field during intake: [upload-revision.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\upload-revision.service.ts:504)
- Generic stable keys did not treat occurrence ids as a first-class identity source: [profile-adapter.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\diff\profile-adapter.service.ts:97)
- Matcher identity token precedence depended on the generic internal id field: [matcher.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\diff\matcher.service.ts:276)

Desired outcome:
- The system must distinguish occurrence identity from object identity.
- Occurrence ids must outrank shared object ids during row matching.
- Repeated identical part instances must remain `no_change` even when row order changes between BOM versions.

Resolution:
- Implemented on `2026-03-12`.
- Added separate diff-row fields for `occurrenceInternalId` and `objectInternalId`.
- Split upload alias handling so occurrence-like headers and object-like headers are preserved separately, while `internalId` remains as a compatibility field resolved with safer precedence.

### ISSUE-010 - Upload Run CTA does not draw attention when both BOM files are ready
- Status: `Resolved`
- Priority: `P2`
- Area: `Upload / UX`
- First observed: `2026-03-12`

Problem:
- The `/upload` screen enables the Run action once two BOM files are selected, but the CTA does not stand out visually at the moment the user can proceed.
- Users can miss the next step because the enabled Run button looks too similar to its idle state.

Desired outcome:
- When two BOM files are loaded and the Run action is available, the CTA should visibly attract attention without feeling noisy or broken.
- The attention treatment should stop once the upload flow is busy or has transitioned to the results handoff state.

Resolution:
- Implemented on `2026-03-12`.
- Added a pulse animation to the Run button on `/upload` whenever both files are present and comparison can be started.
- Kept the treatment motion-based rather than a hard blink so the CTA is more noticeable without reading as an error state.

### ISSUE-011 - Results impact popup does not match the new Admin visual language
- Status: `Resolved`
- Priority: `P2`
- Area: `Results / UX / Impact Review`
- First observed: `2026-03-12`

Problem:
- The `/results` "View Impact" popup still uses the older generic modal/card styling.
- The impact review experience feels visually disconnected from the newer governance surfaces under `/admin`.

Desired outcome:
- Restyle the impact popup so it carries the same look and feel as the Admin governance experience.
- Preserve the existing data and hierarchy while improving clarity for summary, changed properties, and category-level governance details.

Resolution:
- Implemented on `2026-03-12`.
- Reworked the impact popup to use Admin-style summary cards, softer glass panels, cyan section rails, and taxonomy-like criticality badges.
- Kept the existing impact content intact while restructuring the layout so category details scan more like the governance editor.

### ISSUE-012 - Historical comparison results are not locked to the taxonomy/classification version used at comparison time
- Status: `Open`
- Priority: `P1`
- Area: `Results / Governance / Auditability`
- First observed: `2026-03-12`

Problem:
- Existing comparison results can change when Admin taxonomy definitions or classification tags are edited after the comparison has already completed.
- This makes historical results unstable and weakens auditability, because the same past comparison may present different impact classifications over time.

Desired outcome:
- Each comparison result should remain locked to the taxonomy/classification version that was active when that comparison was executed.
- Later taxonomy or classification-tag edits should only affect new comparisons unless a user explicitly requests a governed reclassification flow.

Future consideration:
- Persist a taxonomy/classification snapshot version or immutable resolved classification payload with each comparison.
- Show the governing taxonomy version on results so users can distinguish historical classifications from newer taxonomy revisions.

### ISSUE-013 - Taxonomy impact matching misses semantically equivalent property names
- Status: `Resolved`
- Priority: `P1`
- Area: `Mapping / Taxonomy / Classification`
- First observed: `2026-03-12`

Problem:
- Impact classification currently compares changed BOM property names against taxonomy trigger properties mostly as raw labels.
- This misses semantically equivalent names such as `MEVS Current Revision` vs `Component Revision` or `MEVS Part Number` vs `Component PN`.
- As a result, legitimate taxonomy categories can fail to trigger even when the changed field clearly represents the same business concept.

Desired outcome:
- Taxonomy impact matching should resolve both changed property names and taxonomy trigger properties through canonical semantic meaning before using raw fuzzy string fallback.
- Industry-seeded aliases should cover common Generic and Automotive classification-tag vocabulary.
- Positive and negative automated tests should prove that real aliases trigger correctly and unrelated fields do not.

Resolution:
- Implemented on `2026-03-12`.
- Added canonical semantic matching to taxonomy classification between changed properties and taxonomy trigger tags.
- Kept raw exact-label matching first, inserted semantic canonical matching second, and left raw fuzzy fallback as the last path.
- Seeded Generic and Automotive alias coverage for common trigger/tag vocabulary including part number, revision, quantity, UoM, supplier part number, PPAP, tooling, and service-part semantics.
- Added positive and negative automated tests proving that multiple aliases classify correctly while unrelated fields remain unclassified.

Verification:
- `npm --prefix apps/backend run typecheck`
- `npm --prefix apps/backend run build`
- `npm --prefix apps/backend run test -- change-intelligence.e2e-spec.ts`

### ISSUE-014 - Results impact popup duplicates low-value summary fields
- Status: `Resolved`
- Priority: `P2`
- Area: `Results / UX / Impact Review`
- First observed: `2026-03-12`

Problem:
- The `/results` "View Impact" popup showed `Industry` in the summary hero even though that value is low-signal during row review.
- The popup also repeated impact criticality inside each category card even though the screen already shows criticality in the hero summary.
- This spent prime summary space on redundant information while pushing the more useful `Changed properties` content lower in the layout.

Desired outcome:
- Remove `Industry` from the popup summary hero.
- Move `Changed properties` into the summary hero area.
- Remove the duplicate secondary impact-criticality badge from each category card.

Resolution:
- Implemented on `2026-03-12`.
- Replaced the `Industry` summary card with `Changed properties` in the impact dialog hero.
- Removed the standalone changed-properties section below the hero to avoid duplication.
- Removed the per-category criticality badge from the category cards so the popup keeps one primary criticality signal.

### ISSUE-015 - Governance Command Center section rails look disconnected
- Status: `Resolved`
- Priority: `P2`
- Area: `Admin / UX / Visual Hierarchy`
- First observed: `2026-03-12`

Problem:
- The cyan top rails on the Governance Command Center section cards appeared as detached segments rather than one connected guidance system.
- The left start point, spacing, and width behavior did not read as a shared layout rhythm across cards.
- This made the stack feel visually inconsistent compared with the primary cyan rule directly beneath the `Governance Command Center` heading.

Desired outcome:
- Every governance section card should use the same left offset, width behavior, and spacing for its cyan rail.
- The cyan rail on each card should start flush from the same left boundary.
- The card rails should visually connect through a shared vertical guide in the stack container.
- The rail treatment should match the look and feel of the top cyan rule under the page title.

Resolution:
- Implemented on `2026-03-12`.
- Introduced shared admin rail CSS variables so the page-level rule and section-card rules use the same thickness and gradient treatment.
- Added a vertical guide rail to the governance section stack.
- Reduced inter-card spacing and changed each card rail to run flush across the full top edge so the sections read as one connected system.

### ISSUE-016 - Results impact popup detail blocks include low-value matched-properties section
- Status: `Resolved`
- Priority: `P2`
- Area: `Results / UX / Impact Review`
- First observed: `2026-03-12`

Problem:
- The `/results` impact popup still included a `Matched properties` section inside each category card even though it added little value compared with reviewer routing and governance controls.
- That extra section pushed the higher-signal detail blocks down and weakened the intended two-row review layout.

Desired outcome:
- Remove `Matched properties` from the category detail grid.
- Keep `Internal reviewers` and `External reviewers` on the first row.
- Keep `Compliance trigger` and `Control path` on the second row.

Resolution:
- Implemented on `2026-03-12`.
- Removed the `Matched properties` section from each impact category card.
- Kept the remaining four detail blocks in grid order so they render as:
  - row 1: `Internal reviewers`, `External reviewers`
  - row 2: `Compliance trigger`, `Control path`

### ISSUE-017 - Results impact popup needs category-trigger properties and better hero hierarchy
- Status: `Resolved`
- Priority: `P2`
- Area: `Results / UX / Impact Review`
- First observed: `2026-03-12`

Problem:
- The `/results` impact popup no longer showed the category-triggering property set inside each category card.
- The hero area also gave `Impact class` its own top-row card, which weakened the summary hierarchy and left `Changed properties` visually compressed.

Desired outcome:
- Bring back the category-triggering property section using the label `Properties in this Category`.
- Place that section above the reviewer row inside each impact category card.
- Highlight the changed properties that triggered the category.
- Stack `Impact class` directly under `Impact criticality` in the left summary column.
- Expand `Changed properties` to occupy the two right-side hero columns.

Resolution:
- Implemented on `2026-03-12`.
- Added a `Properties in this Category` section above the reviewer row in each category card.
- Rendered the triggering properties as highlighted chips using the category-level matched property list.
- Reworked the hero grid so `Impact criticality` and `Impact class` share the left column and `Changed properties` spans the two right-side columns.

### ISSUE-018 - Results impact popup needs full category property context, not only triggered subset
- Status: `Resolved`
- Priority: `P2`
- Area: `Results / UX / Impact Review`
- First observed: `2026-03-12`

Problem:
- The `/results` impact popup showed only the triggered property subset for each category, which made it hard to understand the full taxonomy scope of that category.
- Reviewers could not easily distinguish which properties belong to the category overall versus which ones actually triggered on the current row.

Desired outcome:
- Show all taxonomy trigger properties for the category in the `Properties in this Category` section.
- Highlight the properties that triggered for the current change.
- Fade the properties that belong to the category but were not involved in the current change.

Resolution:
- Implemented on `2026-03-12`.
- Extended the results impact payload so each category includes the full taxonomy `triggerProperties` list as well as the matched trigger-property subset.
- Updated the popup to render every taxonomy property in the category.
- Highlighted the properties that triggered the current classification and muted the non-triggered properties for contrast.

### ISSUE-019 - Engineering measurement fields do not resolve to taxonomy tags
- Status: `Resolved`
- Priority: `P1`
- Area: `Diff / Taxonomy Classification / Semantics`
- First observed: `2026-03-13`

Problem:
- Engineering properties such as `Volume_mm3`, `Area_mm2`, `BoundingBox_mm`, and `CenterOfMass` were detected as changed but did not trigger tenant taxonomy tags like `Volume`, `Area`, `Bounding Box`, or `Center of Mass`.
- The taxonomy matcher relied on exact string equality, curated semantic aliases, and a strict fuzzy threshold, which is not sufficient for unit-bearing engineering fields.

Desired outcome:
- Resolve unit-bearing and source-specific engineering properties to stable classification tags automatically.
- Do this without requiring tenants to manually add every suffix and naming variant to taxonomy trigger properties.

Resolution:
- Implemented on `2026-03-13`.
- Added a dedicated taxonomy property-family semantic layer in the backend.
- Inserted family matching ahead of fuzzy taxonomy matching.
- Added unit-aware normalization so properties such as `Volume_mm3` can classify against taxonomy tag `Volume`.
- Encoded the canonical engineering property-family runbook baseline into the resolver.
- Added regression tests for engineering property family matching plus public-source BOM vocabularies across general manufacturing, electronics, aerospace, defense, construction, and medical-service contexts.

### ISSUE-020 - Medical devices industry taxonomy is referenced by architecture but not defined in the runbook
- Status: `Pending`
- Priority: `P2`
- Area: `Taxonomy / Industry Coverage`
- First observed: `2026-03-13`

Problem:
- The backend industry handling anticipates a `Medical devices` taxonomy, but [bom_change_taxonomy_by_industry.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\runbooks\bom_change_taxonomy_by_industry.md) does not currently include a medical-devices section.
- This limits deterministic family-to-category mapping for medical-device-specific trigger properties.

Desired outcome:
- Add a first-class `Medical devices` taxonomy section with categories, trigger properties, approving roles, control path, and compliance triggers.

Current recommendation:
- Keep the canonical family model global.
- Add the dedicated medical-devices taxonomy as a follow-up stage rather than overfitting the current industries.

### ISSUE-021 - Results page redesign needs to adopt the new mission-control surface without breaking actions
- Status: `Resolved`
- Priority: `P1`
- Area: `Frontend / Results / UX`
- First observed: `2026-03-14`

Problem:
- The `/results` page still rendered with the older table-and-toolbar shell rather than the redesigned mission-control layout in `randomtests/Results-Redisign.html`.
- The redesign also had to preserve all existing toolbar tooltips, backend wiring, filters, pagination, view toggles, exports, sharing, and impact-review actions.

Desired outcome:
- Apply the new results surface only to `/results` in both light and dark themes.
- Preserve all existing button tooltips and interactive behavior.
- Keep the page wired to the current backend routes and comparison workflow.
- Add regression coverage for the redesigned toolbar and impact workflow.

Resolution:
- Implemented on `2026-03-14`.
- Refactored the `/results` toolbar, action cluster, pagination placement, and results table styling to match the redesign intent while preserving the existing fetch/start/share/export/history/upload wiring.
- Kept the current tooltip set on all toolbar controls.
- Added Playwright regression coverage for the redesigned toolbar actions and impact dialog flow.

### ISSUE-022 - Navigation shell needs to adopt the new sidebar design without breaking routing or theme controls
- Status: `Resolved`
- Priority: `P1`
- Area: `Frontend / Navigation / Shell`
- First observed: `2026-03-14`

Problem:
- The app shell still used the previous rail-style navigation rather than the redesigned sidebar in `randomtests/Nav-Redisign.html`.
- The new navigation also needed to preserve route wiring, theme toggles, current tooltips, and responsive open/close behavior.

Desired outcome:
- Apply the new navigation design only to the app shell.
- Preserve navigation routing and existing page actions.
- Keep tooltip coverage on nav items, toggle, profile, and theme controls.
- Ensure light/dark theme switching still works correctly.
- Add regression coverage for the redesigned navigation behavior.

Resolution:
- Implemented on `2026-03-14`.
- Refactored the app shell sidebar into the redesigned wide/collapsed navigation model while preserving route links and shell header behavior.
- Added tooltip/title coverage to nav items, sidebar toggle, profile avatar, and theme buttons.
- Kept light/dark theme wiring on the shell and preserved mobile auto-close behavior on route changes.
- Added Playwright regression coverage for navigation routing, collapse/expand behavior, tooltip presence, and theme switching.

### ISSUE-023 - Results grid still diverges from the redesign in toolbar rhythm, typography, and row treatment
- Status: `Resolved`
- Priority: `P1`
- Area: `Frontend / Results / Visual System`
- First observed: `2026-03-14`

Problem:
- The `/results` page was functionally wired, but its toolbar rhythm, button strip, grid typography, and row backgrounds still diverged materially from the redesign reference.
- The desktop toolbar split too early into two rows, the button strip had an extra grouped treatment, table header/body typography felt heavier than the mock, and semantic row colors were more saturated than intended.

Desired outcome:
- Make the `/results` toolbar, pagination cluster, table header typography, grid body sizing, and semantic row colors align much more closely with the redesign.
- Keep all current backend wiring, tooltips, actions, filters, pagination, and impact behavior intact.
- Allow any small shared shell adjustments that are needed to support the design direction across pages.

Resolution:
- Implemented on `2026-03-14`.
- Reworked the `/results` desktop toolbar layout so the filter row and action/pagination cluster align much more closely with the redesign before collapsing at narrower widths.
- Updated the results controls, progress badge, icon buttons, pagination cluster, and table action buttons to the flatter redesign sizing and typography.
- Switched the results grid headings back to normal-case UI typography and tightened the body sizing and mono treatment.
- Shifted the semantic row fills to the lighter redesign palette while preserving all current results interactions and regression coverage.

### ISSUE-024 - Navigation shell still diverges from the redesign iconography and active-state styling
- Status: `Resolved`
- Priority: `P1`
- Area: `Frontend / Navigation / Visual System`
- First observed: `2026-03-14`

Problem:
- The shell navigation behavior was already wired, but the rendered navigation still diverged from the redesign in iconography, active-state tint, and general look-and-feel in both expanded and collapsed modes.
- The top toggle button icon and several nav icons did not match the redesign reference closely enough.

Desired outcome:
- Make the navigation shell match the redesign more closely in both expanded and collapsed states.
- Align the toggle button, active-state treatment, and nav icon set with the reference design.
- Preserve current routing, theme controls, collapse/expand behavior, and tooltip coverage.

Resolution:
- Implemented on `2026-03-14`.
- Updated the navigation icon set and rail toggle icon to the redesigned visual language.
- Refined the nav-specific active-state styling and rail presentation to better match the new design in both expanded and collapsed modes.
- Preserved all existing shell routing, tooltip, and theme-toggle behavior and revalidated the navigation Playwright coverage.

### ISSUE-025 - Results page still falls short of exact target parity against the redesign mock
- Status: `Resolved`
- Priority: `P1`
- Area: `Frontend / Results / Visual Parity`
- First observed: `2026-03-15`

Problem:
- The `/results` page is closer to the redesign than the original implementation, but it still does not match the target in [Results-Redisign.html](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\randomtests\Results-Redisign.html).
- The most visible remaining gaps are the missing `MISSION CONTROL` eyebrow, the wrong theme-toggle component, the multi-row toolbar layout, oversized controls, heavier outer surface chrome, non-matching table header treatment, row density differences, and final semantic color tuning.

Desired outcome:
- Bring `/results` into near-exact visual parity with the target mock while preserving existing backend wiring, filters, tooltips, exports, sharing, pagination, and impact actions.
- Explicitly exclude mock-data composition parity from this stage.

Resolution:
- Implemented on `2026-03-15`.
- Executed [BACKLOG_S18_RESULTS_VISUAL_PARITY.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\BACKLOG_S18_RESULTS_VISUAL_PARITY.md).
- Restored the `MISSION CONTROL` eyebrow on `/results` and reduced the title scale to match the target rhythm more closely.
- Replaced the results-page segmented theme selector with a compact pill-style toggle while preserving theme wiring.
- Reworked the desktop results toolbar into a compact horizontal working row with tighter control sizing and flatter chrome.
- Retuned the table header band, row density, impact cell spacing, classification buttons, and semantic row fills to align more closely with the target mock.
- Added a screenshot-driven QA step and captured [results-visual-capture.png](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\artifacts\results-visual-capture.png), then removed the inherited panel chrome based on the live capture review.
- Verified with frontend typecheck, frontend build, and Playwright coverage for navigation, results behavior, and visual capture.

### ISSUE-026 - Upload page still diverges from the redesign mock and lacks per-revision drag/drop
- Status: `Resolved`
- Priority: `P1`
- Area: `Frontend / Upload / Visual Parity`
- First observed: `2026-03-15`

Problem:
- The `/upload` page does not yet match the target in [Compare-Redisign.html](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\randomtests\Compare-Redisign.html).
- The current page is functionally close, but the shell chrome, theme control, dropzone treatment, revision-card styling, metadata rendering, and copy still diverge visibly from the redesign.
- The most important functional mismatch is that only the master upload zone accepts drag/drop today. `Revision A` and `Revision B` are not individual drag/drop targets, even though the target design expects each card to behave as its own drop zone.

Evidence:
- Current upload implementation renders one active top dropzone and two non-droppable revision cards in [upload-validation-form.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\upload-validation-form.tsx:282)
- Current upload styling uses the mission-shell surface system rather than the flatter redesign treatment in [globals.css](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\app\globals.css:3473)
- The app shell currently applies the segmented `Light / Dark` toggle and rounded mission header rather than the compact compare-page toggle from the redesign in [app-shell.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\app-shell.tsx:23)

Desired outcome:
- Make `/upload` match the redesign in `randomtests/Compare-Redisign.html` as closely as possible.
- Keep the top master dropzone behavior where one dropped file maps to `Revision A` and two dropped files map to `Revision A` then `Revision B`.
- Make `Revision A` and `Revision B` independently drag-drop enabled so a user can drag one file directly onto either card.
- Align the shell/header, theme toggle, spacing, dashed borders, flatter surfaces, button sizing, typography, and status/role pills with the redesign.
- Replace upload-card empty-state copy and status text so the screen reads like the target mock.

Gap summary:
- Header mismatch:
  - current `/upload` uses the rounded mission-shell header instead of the flatter compare-page header with a simple divider
  - current theme control is segmented `Light / Dark`; target uses a compact slider toggle
- Action mismatch:
  - current page includes a floating run icon control in the top-right of the workspace
  - target mock does not use that floating action treatment in the compare workspace
- Global dropzone mismatch:
  - current dropzone is more glassy, bluer, and more rounded than the target
  - target uses a flatter white panel, lighter dashed border, and tighter spacing
- Revision card mismatch:
  - current cards are static bordered cards, not dashed drop cards
  - current cards do not visually enter drag-over state
  - current buttons and corner radii are heavier than the target
- Metadata mismatch:
  - current empty-state source text says `No file selected`; target says `Drag file here or select`
  - current status uses plain text such as `Waiting for source`; target uses pills
  - current ready state reads `Ready for validation`; target reads `Ready for comparison`
- Typography mismatch:
  - target uses stronger mono eyebrow and metadata treatment
  - current title and body rhythm are still closer to the shared mission shell than the redesign

Current recommendation:
- Treat this as a dedicated upload visual-parity pass, not a minor CSS cleanup.
- Execute the work in this order:
  - page-header and theme-toggle parity
  - master dropzone parity
  - revision-card drag/drop behavior
  - revision-card visual parity
  - metadata text and pill parity
  - final spacing and responsive tuning
- Hold implementation until this issue is explicitly scheduled.

Resolution:
- Implemented on `2026-03-15`.
- Updated the `/upload` shell so the page uses a flatter compare-page header, compact theme switch, and lighter top-surface treatment aligned to the redesign.
- Restyled the master upload zone and both revision cards to match the flatter dashed-outline compare mock more closely.
- Follow-up refinement on `2026-03-15`:
  - aligned the upload page more literally to `randomtests/Compare-Redisign.html` for light/dark token values, typography scale, button chrome, pill styling, and stack breakpoint behavior
  - reduced style leakage from the broader mission-control theme so `/upload` follows the compare mock rather than the shared Admin/Results surface system
- Added true drag/drop support on both `Revision A` and `Revision B` cards while preserving deterministic top-dropzone mapping of one file to `Revision A` and two files to `Revision A` then `Revision B`.
- Updated upload metadata copy and status rendering to use the redesign language, including:
  - `Drag file here or select`
  - `Ready for comparison`
  - pill-based `Waiting for source`, `Baseline BOM`, and `Candidate BOM`
- Hid the compare action in the idle state so the initial screen composition aligns more closely with the target mock, while still showing the compare CTA with attention treatment once both files are ready.
- Added focused Playwright coverage for:
  - master dropzone deterministic mapping
  - direct drag/drop onto `Revision A` and `Revision B`
  - upload-page shell theme-toggle behavior after the header redesign

Verification:
- `npm --prefix apps/frontend run typecheck`
- `npm --prefix apps/frontend run build`
- `npx playwright test tests/e2e/upload-redesign.spec.ts tests/e2e/navigation-redesign.spec.ts`

### ISSUE-027 - Mapping Check screen is too technical and too narrow for broader business use
- Status: `Pending`
- Priority: `P1`
- Area: `Mapping / UX / Taxonomy / Governance`
- First observed: `2026-03-15`

Problem:
- The current `Mapping Check` screen is still presented primarily as a technical column-to-canonical-field review table.
- It is understandable for engineering or data-steering users, but it is not friendly enough for purchasing, sales, managers, or other non-engineering reviewers.
- It also under-represents the broader purpose of the system now that all BOM columns are preserved and taxonomy-driven impact classification is a first-class capability.
- Users can see only a narrow mapping contract expressed as the main decision surface, which makes the experience feel like “map a handful of fields” instead of “teach the system how to understand this BOM.”

Evidence:
- Frontend mapping review remains a table-first editor centered on raw canonical fields, strategy, confidence, and review state in [mapping-preview-editor.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\mapping-preview-editor.tsx:1)
- Backend preview contract is still minimal and comparison-centric in [mapping-contract.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\mapping\mapping-contract.ts:1)
- Preview generation still mainly answers “are required canonical fields mapped?” rather than “how well does the system understand this BOM?” in [mapping-preview.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\mapping\mapping-preview.service.ts:1)

Desired outcome:
- Redesign `Mapping Check` as a business-friendly `Field Understanding Workspace`.
- Keep all source columns visible somewhere in the experience, but group and rank them by importance.
- Clearly distinguish:
  - fields required for safe comparison
  - fields that improve matching quality
  - fields that improve change impact classification
  - fields that are preserved but not yet semantically understood
- Surface plain-language guidance, sample values, and taxonomy relevance so non-engineering users can understand why the screen matters.
- Preserve expert explainability and backend mapping rigor without forcing every user through a technical table.

Options ranked:
- `Option 1` - Recommended: summary-first `Field Understanding Workspace` with grouped columns, business-readable labels, sample values, and progressive disclosure for evidence
- `Option 2`: enhanced version of the current table with clearer labels, filters, and taxonomy badges
- `Option 3`: persona-based simple/expert dual-mode workflow

Current recommendation:
- Execute [BACKLOG_S19_MAPPING_CHECK_REDESIGN.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\BACKLOG_S19_MAPPING_CHECK_REDESIGN.md)
- Keep the existing detection engine and semantic/taxonomy services
- Add a richer preview contract and redesign the frontend as a grouped, summary-first field-understanding experience
- Make the experience safe for business users without weakening engineering/admin control over durable alias learning and governance

### ISSUE-028 - Results workspace still leaves an unnecessary left gutter between navigation and content
- Status: `Resolved`
- Priority: `P2`
- Area: `Frontend / Results / Layout`
- First observed: `2026-03-16`

Problem:
- The `/results` workspace still renders with an extra left gutter between the redesigned sidebar and the page content.
- That gap reduces usable horizontal space and makes the page feel narrower than the surrounding shell.

Desired outcome:
- Remove the extra gutter so the results workspace uses the available page width while preserving the existing toolbar, table, and modal behavior.

Resolution:
- Implemented on `2026-03-16`.
- Removed the results-shell body gutter and moved the inner spacing into the results surface itself so the workspace now fills the available content area without changing current interactions.

### ISSUE-029 - Session rename controls sit too far away from the Results page title
- Status: `Resolved`
- Priority: `P2`
- Area: `Frontend / Results / Session UX`
- First observed: `2026-03-16`

Problem:
- The session title textbox and save action were buried inside the larger `Session Workspace` panel instead of living directly beneath the page title.
- This made the primary session naming control feel detached from the page heading and harder to discover.

Desired outcome:
- Move the session title textbox and save action directly under the `Results` page title while preserving session-wide rename behavior.

Resolution:
- Implemented on `2026-03-16`.
- Replaced the large session-workspace panel with a compact session-title bar directly below the `Results` header and kept the existing blur-save and explicit-save flows intact.

### ISSUE-030 - Results page lacks a dedicated current-file comparison details action
- Status: `Resolved`
- Priority: `P2`
- Area: `Frontend / Results / Session Continuity`
- First observed: `2026-03-16`

Problem:
- The current comparison details were only visible inside the larger session workspace area, with no dedicated toolbar action for quickly checking the latest loaded file comparison.

Desired outcome:
- Add a recognized file-details action near `Upload next revision` that opens a popup with the current file comparison details.

Resolution:
- Implemented on `2026-03-16`.
- Added a document-style current-comparison action to the results toolbar, positioned to the left of `Upload next revision`, and wired it to a popup showing the active comparison label, state, user, uploaded timestamp, and session title.

### ISSUE-031 - Session Workspace panel is redundant after session continuity actions moved into the header and dialogs
- Status: `Resolved`
- Priority: `P2`
- Area: `Frontend / Results / Session UX`
- First observed: `2026-03-16`

Problem:
- The `Session Workspace` section consumed a large amount of vertical space after the results page already had a title area, toolbar, and previous-comparisons dialog.
- Once the rename control and current-comparison summary are surfaced elsewhere, the panel becomes redundant.

Desired outcome:
- Remove the `Session Workspace` section without removing the underlying session continuity capabilities.

Resolution:
- Implemented on `2026-03-16`.
- Removed the `Session Workspace` panel, kept rename in the page header area, preserved previous-comparison open/delete flows in the existing dialog, and retained the current-comparison details via the new toolbar popup.

### ISSUE-032 - History page is still a flat archive instead of a grouped BOM revision chain view
- Status: `Resolved`
- Priority: `P2`
- Area: `Frontend / History / Revision Chains`
- First observed: `2026-03-16`

Problem:
- The `/history` page still presents one flat row per comparison, which forces users to infer which records belong to the same BOM session.
- The current table does not visually explain that `Upload next revision` grows a shared revision chain over time.
- Inline rename and tag fields read like table maintenance controls rather than session-level chain management.

Desired outcome:
- Rebuild `/history` as grouped `Revision Chains` with collapsible BOM session cards, expanded session-level editing, and newest-first comparison cards while preserving open, rename, private-label, and latest-delete behavior.

Resolution:
- Implemented on `2026-03-16`.
- Replaced the flat history table with grouped revision-chain accordions, moved rename into the expanded session surface, preserved private-label editing through a details modal, kept open and latest-only delete actions intact, and aligned the page header and navigation copy to `Revision Chains`.

### ISSUE-033 - Mission Control theme stops at Upload and Results instead of carrying through the rest of the authenticated frontend
- Status: `Resolved`
- Priority: `P1`
- Area: `Frontend / Shell / Admin / Notifications / History / Mappings`
- First observed: `2026-03-17`

Problem:
- `/upload` and `/results` already present the intended Mission Control visual system, but `/admin`, `/notifications`, `/history`, `/mappings`, and their popups still use mixed legacy panels, table surfaces, and older spacing rules.
- The authenticated product therefore feels like several different applications stitched into one shell rather than one coherent workspace.
- The remaining pages need the same surface language, card rhythm, toolbar hierarchy, popup styling, and responsive behavior without changing the underlying workflows.

Desired outcome:
- Extend the Mission Control theme across the rest of the authenticated frontend so that page bodies, supporting cards, and dialogs/popup surfaces visually align with `/upload` and `/results` while preserving all current functionality, routes, and selectors required for regression safety.

Resolution:
- Implemented on `2026-03-17`.
- Added a shared Mission Control workspace treatment for non-results pages, rethemed `/notifications`, `/mappings`, `/history`, and `/admin`, aligned their dialogs and popovers to the same surface language, and preserved existing behaviors with focused frontend typecheck, build, and Playwright regression coverage.

### ISSUE-034 - Secondary pages still miss strict Mission Control brand parity against the approved Upload and Results baseline
- Status: `Resolved`
- Priority: `P1`
- Area: `Frontend / Design System / Admin / Notifications / History / Mappings`
- First observed: `2026-03-17`

Problem:
- The first mission-control unification pass carried the idea of shared theming into `/admin`, `/notifications`, `/history`, and `/mappings`, but it still diverged from the actual approved baseline visible on `/upload` and `/results`.
- Those pages continued to use gradients, larger radii, summary cards, stronger chrome, and a looser interpretation of the theme instead of the flatter mission-control language with thin borders, monochrome surfaces, restrained pills, and sparse accent color.
- Dialogs and popup surfaces in those areas also remained visually heavier than the baseline.

Desired outcome:
- Amend the documentation and implement strict Mission Control brand parity on `/mappings`, `/history`, `/notifications`, `/admin`, and their dialogs/popups using the established `/upload` and `/results` baseline:
  - cool light-gray app background
  - white flat cards with thin gray borders
  - low-radius corners
  - no drop shadows
  - sans-serif UI copy plus monospace data labels and values where appropriate
  - pastel status pills with restrained color use
  - wide, whitespace-driven layout with horizontal-only table separation

Resolution:
- Implemented on `2026-03-17`.
- Added `S23` documentation for strict brand parity, replaced the previous workspace-only interpretation with the flatter mission-control baseline on `/admin`, `/notifications`, `/history`, `/mappings`, and mapping preview, aligned popup surfaces to the same aesthetic rules, and added a reusable local skill to apply the same aesthetics to future pages.

### ISSUE-035 - Unclassified results rows do not give admins a direct path into taxonomy governance
- Status: `Resolved`
- Priority: `P2`
- Area: `Frontend / Results / Admin / Taxonomy UX`
- First observed: `2026-03-20`

Problem:
- When a results row lands in an `Unclassified` state, admins can see that the classification needs taxonomy work, but the interface leaves them at a dead end on the results page.
- The current experience forces an admin to manually navigate to `/admin`, expand `Change Taxonomy & Impacts`, and reconstruct the row context from memory.

Desired outcome:
- Turn `Unclassified` into an admin-only deep link from `/results` to `/admin` so the `Change Taxonomy & Impacts` section opens expanded with lightweight row context visible on arrival.

Resolution:
- Implemented on `2026-03-20`.
- Added an admin-only `Unclassified` deep link in `/results`, routed it to `/admin?section=taxonomyImpacts...`, auto-expanded the taxonomy section on landing, scrolled it into view, and surfaced a contextual banner with the row field/rationale so admins land directly in the relevant governance workspace.

## 3. Linked follow-up records
- Sprint 12 QA: [UI_QA_S12_RESULTS_REVISION_CHAIN.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\UI_QA_S12_RESULTS_REVISION_CHAIN.md:1)
- Sprint 12.1 backlog: [SPRINT_S12_1_RESULTS_CHAIN_HARDENING.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\SPRINT_S12_1_RESULTS_CHAIN_HARDENING.md:1)
