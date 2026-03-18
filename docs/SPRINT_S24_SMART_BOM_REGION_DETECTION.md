# Sprint S24 - Smart BOM Region Detection

## 1. Sprint metadata
- Sprint: `S24`
- Theme: `Smart BOM Region Detection`
- Scope type: `Execution-ready cross-cutting upload/parser sprint`
- Owner: `Product + Engineering`
- Status: `Backlog`

## 2. Sprint goal
Enable workbook-aware BOM extraction so mixed-format CSV/XLS/XLSX uploads isolate the real BOM table before comparison, while preserving the established compare pipeline once BOM rows are normalized.

## 3. Locked decisions
- Scan all visible workbook sheets and prefer sheet names similar to `BOM`, `BillOfMaterials`, `Parts`, and `Components`.
- Add per-revision sheet dropdowns on `/upload` and `Upload Next Revision`.
- Keep the dropdown always visible and disabled until workbook metadata loads.
- For CSV, show a disabled single-option `CSV`.
- User-selected sheet wins completely for sheet selection.
- Strictly exclude non-line-item columns while preserving legitimate business columns inside the BOM table.
- Always remove totals, subtotals, legends, status keys, instructions, and other non-BOM footer rows.
- Use any 2 of `part number`, `description`, and `quantity` as the primary BOM-row qualification rule, with score-based fallback.
- Ignore images entirely.
- Preserve all in-table business columns.
- End BOM detection uses row-pattern break and favors precision over recall.
- Weak-confidence parsing falls back to the current parser, logs diagnostics, and shows a non-technical validation warning before compare starts.
- Ship behind `UPLOAD_BOM_REGION_DETECTION_V1`.

## 4. Source evidence used

Planning and architecture evidence reviewed:
- `BACKLOG_S24_SMART_BOM_REGION_DETECTION.md`
- `docs/SMART_BOM_REGION_DETECTION_ARCHITECTURE.md`
- `docs/SMART_BOM_REGION_DETECTION_IMPLEMENTATION_SPEC.md`

Current code evidence reviewed:
- `apps/frontend/components/upload-validation-form.tsx`
- `apps/frontend/components/results-grid.tsx`
- `apps/frontend/app/api/uploads/validate/route.ts`
- `apps/frontend/app/api/uploads/intake/route.ts`
- `apps/backend/src/uploads/uploads.controller.ts`
- `apps/backend/src/uploads/upload-validation.service.ts`
- `apps/backend/src/uploads/upload-revision.service.ts`
- `apps/backend/src/diff/diff-job.service.ts`

Fixture and domain evidence reviewed:
- `docs/BOM Examples/`
- user-provided workbook screenshots and clarification set for mixed-format BOM extraction

## 5. Execution stories

### S24-01 - Workbook metadata endpoint and preferred-sheet discovery
As a user selecting BOM revisions, I need the upload flow to discover visible sheets and preselect the most likely BOM sheet so the correct sheet is chosen by default before validation.

Status:
- `Backlog`

### S24-02 - Per-revision sheet dropdowns on `/upload` and `Upload Next Revision`
As a user uploading BOM revisions, I want a visible sheet dropdown for each revision so I can override the default sheet when the workbook contains multiple candidates.

Status:
- `Backlog`

### S24-03 - Validate/intake contract updates for selected sheets and warnings
As the platform, I need validate and intake to carry the selected sheet and parser-warning data so the sheet the user reviewed is the same sheet that is parsed and stored.

Status:
- `Backlog`

### S24-04 - Smart BOM-region detection service with dual extraction strategies
As the comparison engine, I need the upload parser to isolate the real BOM region from mixed-format spreadsheets so non-BOM content is excluded before row normalization.

Status:
- `Backlog`

### S24-05 - Fallback, user warnings, diagnostics, and rollout controls
As product and engineering stakeholders, we need weak-confidence parsing to degrade safely with clear user messaging and engineering diagnostics so rollout risk stays controlled.

Status:
- `Backlog`

### S24-06 - Fixture matrix and regression validation
As the delivery team, we need automated validation proving smart extraction works on the known workbook patterns and does not regress the established compare workflow.

Status:
- `Backlog`

## 6. Acceptance bar
- Users can select a sheet per revision on `/upload`.
- Users can select a sheet for `Upload Next Revision`.
- Workbook uploads scan all visible sheets and preselect the preferred sheet by name affinity.
- CSV uploads show a disabled `CSV` option.
- Selected sheet values flow through validate and intake consistently.
- Smart BOM extraction excludes non-BOM headers, side panels, legends, totals, instructions, and image-only noise.
- Weak-confidence extraction falls back safely to the current parser.
- Validation warnings are understandable to non-technical users and appear before compare starts.
- The downstream comparison pipeline remains unchanged after BOM extraction.

## 7. Recommended sequencing
1. Implement workbook metadata discovery and preferred-sheet scoring.
2. Add per-revision sheet dropdowns to `/upload` and `Upload Next Revision`.
3. Extend validate/intake contracts to carry selected sheet values and warning payloads.
4. Implement smart BOM-region detection behind `UPLOAD_BOM_REGION_DETECTION_V1`.
5. Add diagnostics, warnings, and fallback controls.
6. Finish with fixture and regression validation across workbook and CSV examples.

## 8. Verification
- `npm --prefix apps/backend run typecheck`
- `npm --prefix apps/frontend run typecheck`
- backend tests covering workbook metadata discovery, selected-sheet parsing, region detection, fallback behavior, and diagnostics
- browser coverage for:
  - `/upload` per-revision sheet dropdown behavior
  - `Upload Next Revision` sheet selection behavior
  - validation warning rendering before compare
  - successful compare handoff after smart extraction and fallback cases

## 9. Change-management controls
- Feature flag:
  - `UPLOAD_BOM_REGION_DETECTION_V1`
- Fallback policy:
  - if confidence is weak, continue with the current parser and emit warnings/diagnostics
- User communication:
  - non-technical warning text only in phase 1
- Engineering traceability:
  - store or emit parser diagnostics for rollout review and incident triage

## 10. Residual notes
- This sprint is intentionally scoped to upload-boundary extraction and upload UX only.
- The current compare engine, results workflow, and downstream contracts are not to be redesigned within this sprint.
