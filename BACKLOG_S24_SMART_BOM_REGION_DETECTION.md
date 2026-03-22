# Backlog S24 - Smart BOM Region Detection

## Goal

Introduce smart BOM-region detection so uploaded CSV/XLS/XLSX files can safely ignore non-BOM headers, side panels, instructions, legends, totals, and image-backed noise before entering the existing comparison pipeline.

This backlog should:

* preserve the current comparison pipeline once BOM rows have been isolated
* add explicit per-revision sheet selection on `/upload` and `Upload Next Revision`
* support all visible workbook sheets while preferring BOM-like sheet names by default
* keep parsing precision-first, with safe fallback to the current parser
* emit non-technical warnings to users and structured diagnostics to engineering when smart detection confidence is weak

## Parent backlog item

### S24-00 - Smart BOM Region Detection
As a BOM Compare user, I want the platform to automatically isolate the real BOM table from mixed-format spreadsheets so that uploads compare the actual parts list instead of decorative or administrative spreadsheet content.

Status:
* `Completed`

## Locked product decisions

1. Sheet selection:
   * scan all visible sheets
   * prefer sheets named like `BOM`, `BillOfMaterials`, `Parts`, or `Components`
   * expose a sheet dropdown for each revision on `/upload` and `Upload Next Revision`
   * keep the dropdown always visible and disabled until workbook metadata loads
   * for CSV, show a disabled single-option dropdown like `CSV`
   * if the user manually selects a sheet, user choice wins completely

2. BOM extraction rules:
   * strictly exclude columns not behaving like line-item data
   * keep borderline columns only when they are part of the line item and contain business data
   * always remove totals, subtotals, legends, status keys, instructions, and other non-BOM footer rows
   * qualify BOM rows using any 2 of `part number`, `description`, and `quantity`, with score-based fallback when that rule is not met
   * ignore images entirely
   * preserve all in-table business columns
   * detect BOM end by row-pattern break
   * ignore metadata completely
   * favor precision over recall

3. Confidence and rollout:
   * ship behind `UPLOAD_BOM_REGION_DETECTION_V1`
   * when confidence is weak, continue with fallback to the current parser
   * log diagnostics and show a non-technical validation warning before compare starts
   * automatic detection now, manual row/column override later

## Current problem

The current parser assumes the first non-empty row is the BOM header and the first worksheet is the active source. That is too brittle for the workbook patterns already identified:

* title blocks and metadata can sit above the BOM
* the BOM may start away from column `A`
* right-side instruction panels and legends can sit beside the BOM
* image columns and decorative cells can appear inside the workbook
* the correct BOM may not be on the first visible sheet

Without a smarter boundary, the current upload flow risks comparing spreadsheet framing instead of the actual line-item BOM.

## Current implementation evidence

Planning and architecture evidence:

* `docs/SMART_BOM_REGION_DETECTION_ARCHITECTURE.md`
* `docs/SMART_BOM_REGION_DETECTION_IMPLEMENTATION_SPEC.md`

Current upload and compare flow:

* `apps/frontend/components/upload-validation-form.tsx`
* `apps/frontend/components/results-grid.tsx`
* `apps/frontend/app/api/uploads/validate/route.ts`
* `apps/frontend/app/api/uploads/intake/route.ts`
* `apps/backend/src/uploads/uploads.controller.ts`
* `apps/backend/src/uploads/upload-validation.service.ts`
* `apps/backend/src/uploads/upload-revision.service.ts`
* `apps/backend/src/diff/diff-job.service.ts`

Example fixtures and problem evidence:

* `docs/BOM Examples/`
* user-provided workbook screenshots and locked clarifications for mixed-format BOM extraction

## Architecture decision

Recommended implementation boundary:

* add workbook metadata discovery before validation/intake parsing
* add a selected-sheet contract to the upload flow
* introduce `BomWorkbookMetadataService` and `BomRegionDetectionService` inside the upload domain
* keep smart extraction limited to the upload parsing seam in `UploadRevisionService.parseRowsFromFile()`
* keep the downstream `DiffComparableRow[]` contract, diff job start, diff computation, results, exports, and history unchanged

Why this is the correct boundary:

* the problem is extraction fidelity, not diff-engine correctness
* the current compare engine is explicitly to remain stable once the BOM has been isolated
* sheet selection and validation warnings belong to the existing upload workflow, not a new standalone tool
* feature-flagged fallback reduces change-management risk during rollout

## Scope

### In scope

1. Add workbook metadata inspection for uploads
2. Add per-revision sheet dropdowns on `/upload`
3. Add per-revision sheet selection to `Upload Next Revision`
4. Extend validate/intake contracts to carry selected sheet names and parser warnings
5. Implement smart BOM-region detection inside upload parsing
6. Add fallback, diagnostics, warning messages, and rollout guardrails
7. Add fixture and regression coverage for workbook and CSV variants

### Out of scope

* changing the diff engine after normalized BOM rows are produced
* manual row/column override in phase 1
* visual preview of detected row/column boundaries in phase 1
* redesigning `/upload` or `/results` outside the required sheet-selection UX

## UX changes

1. Each revision slot shows a sheet dropdown immediately, disabled until workbook metadata loads.
2. Workbook uploads auto-populate visible sheets and preselect the preferred one.
3. CSV uploads show a disabled `CSV` dropdown option.
4. Validation may show a non-technical warning before compare starts when smart parsing confidence is weak or fallback parser behavior was used.

## Data contract changes

Required additions:

* workbook metadata discovery response
* selected sheet name for each uploaded revision
* validation warnings and parser/fallback indicators
* optional parser diagnostics persistence or structured logging payload

## Stories

### S24-01 - Workbook metadata endpoint and preferred-sheet discovery
As a user selecting BOM revisions, I need the upload flow to discover visible sheets and preselect the most likely BOM sheet so the correct sheet is chosen by default before validation.

Status:
* `Completed`

### S24-02 - Per-revision sheet dropdowns on `/upload` and `Upload Next Revision`
As a user uploading BOM revisions, I want a visible sheet dropdown for each revision so I can override the default sheet when the workbook contains multiple candidates.

Status:
* `Completed`

### S24-03 - Validate/intake contract updates for selected sheets and warnings
As the platform, I need validate and intake to carry the selected sheet and parser-warning data so the sheet the user reviewed is the same sheet that is parsed and stored.

Status:
* `Completed`

### S24-04 - Smart BOM-region detection service with dual extraction strategies
As the comparison engine, I need the upload parser to isolate the real BOM region from mixed-format spreadsheets so non-BOM content is excluded before row normalization.

Status:
* `Completed`

### S24-05 - Fallback, user warnings, diagnostics, and rollout controls
As product and engineering stakeholders, we need weak-confidence parsing to degrade safely with clear user messaging and engineering diagnostics so rollout risk stays controlled.

Status:
* `Completed`

### S24-06 - Fixture matrix and regression validation
As the delivery team, we need automated validation proving smart extraction works on the known workbook patterns and does not regress the established compare workflow.

Status:
* `Completed`

## Acceptance bar

* Users can select a sheet per revision on `/upload`.
* Users can select a sheet for `Upload Next Revision`.
* Workbook uploads scan all visible sheets and preselect the preferred sheet by name affinity.
* CSV uploads show a disabled `CSV` option.
* Selected sheet values flow through validate and intake consistently.
* Smart BOM extraction excludes non-BOM headers, side panels, legends, totals, instructions, and image-only noise.
* Weak-confidence extraction falls back safely to the current parser.
* Validation warnings are understandable to non-technical users.
* The downstream comparison pipeline remains unchanged after BOM extraction.

## Story dependency map

* `S24-01` -> `S24-02`, `S24-03`
* `S24-03` -> `S24-04`, `S24-05`
* `S24-04` -> `S24-05`, `S24-06`
* `S24-02` + `S24-05` -> complete user workflow readiness

## Definition of Done (Backlog-Level)

* Workbook metadata discovery, sheet selection, and smart region detection exist behind a feature flag.
* Validation/intake preserve deterministic sheet selection.
* Weak-confidence cases degrade safely with user-facing warnings and engineering diagnostics.
* Automated fixture and regression coverage pass for workbook and CSV variants.
* The compare pipeline remains contract-compatible after BOM extraction.

## Clarification status

No open clarification items remain for this backlog.

Resolved and locked decisions:
1. Preferred sheet by BOM-like name, with explicit user override.
2. Scan all visible sheets.
3. Strict non-line-item exclusion while preserving legitimate business columns.
4. Always remove totals, legends, and non-BOM footer rows.
5. BOM row qualification uses any 2 of `part number`, `description`, `quantity`, with score-based fallback.
6. Compare crop-first vs map-first extraction and keep the higher-confidence result.
7. Ignore images entirely.
8. Weak confidence continues with fallback parser, warning, and stored diagnostics.
9. Automatic now, manual override later.
10. Preserve all in-table business columns.
11. Stop BOM rows when row-pattern breaks.
12. Ignore metadata completely.
13. Apply the same logic to CSV and Excel.
14. Favor precision over recall.
15. Ship feature-flagged with fallback to current behavior.
16. Dropdowns are always visible and disabled until workbook metadata loads.
17. User-selected sheet fully overrides preferred-sheet auto-selection.
18. CSV shows disabled single-option `CSV`.
19. Low-confidence user-selected-sheet cases continue with fallback parser and warning.
20. Validation warnings appear before compare starts.
21. Warning text only in phase 1, no row/column preview UI.
