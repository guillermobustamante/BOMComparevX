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

## 3. Linked follow-up records
- Sprint 12 QA: [UI_QA_S12_RESULTS_REVISION_CHAIN.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\UI_QA_S12_RESULTS_REVISION_CHAIN.md:1)
- Sprint 12.1 backlog: [SPRINT_S12_1_RESULTS_CHAIN_HARDENING.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\SPRINT_S12_1_RESULTS_CHAIN_HARDENING.md:1)
