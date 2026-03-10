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

## 3. Linked follow-up records
- Sprint 12 QA: [UI_QA_S12_RESULTS_REVISION_CHAIN.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\UI_QA_S12_RESULTS_REVISION_CHAIN.md:1)
- Sprint 12.1 backlog: [SPRINT_S12_1_RESULTS_CHAIN_HARDENING.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\SPRINT_S12_1_RESULTS_CHAIN_HARDENING.md:1)
