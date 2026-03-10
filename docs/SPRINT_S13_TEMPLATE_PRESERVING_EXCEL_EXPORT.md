# Sprint S13 - Template-Preserving Excel Export

## 1. Sprint metadata
- Sprint: `S13`
- Theme: `Template-Preserving Excel Export`
- Scope type: `Execution-ready sprint record`
- Owner: `Product + Engineering`
- Status: `Completed`

## 2. Sprint goal
Implement Excel export so the downloaded workbook preserves the latest uploaded workbook presentation while keeping the latest uploaded BOM rows intact and appending comparison metadata.

## 3. Locked decisions
- Use the latest uploaded workbook as the export template baseline.
- Preserve all sheets/tabs from the uploaded workbook.
- Preserve Excel table objects and resize them to include the three appended comparison metadata columns.
- Preserve sheet drawings/media so image-based columns remain visible after export.
- Keep metadata both inline on the BOM sheet and on a separate metadata sheet.
- Preserve widths, colors, table styling, hidden rows/columns, freeze panes, merged cells, conditional formatting, and formulas outside the BOM row region where library support permits.
- Keep the latest uploaded BOM rows as-is on the main sheet.
- Hide `comparisonId` on the `Comparison Metadata` sheet.
- Do not rebuild uploaded `.xlsx` exports through `xlsx.write(...)`; patch OOXML parts directly instead.

## 4. Execution stories

### S13-01 - Persist workbook template context for export
As the export pipeline, I need the uploaded workbook buffer and BOM row-range metadata so that Excel export can mutate the original workbook instead of rebuilding a generic sheet.

Status:
- `Completed`

### S13-02 - Preserve workbook structure during Excel export
As a user downloading Excel results, I want the exported workbook to keep the original workbook sheets, widths, row content, and visual structure so that the file still looks like the uploaded BOM workbook.

Status:
- `Completed`

### S13-03 - Preserve and resize the BOM table while appending compare metadata
As a user working in Excel, I want the BOM table to remain intact and resized correctly while comparison metadata is added inline and to a separate metadata sheet.

Status:
- `Completed`

### S13-04 - Verify template-preserving Excel export with automated tests
As engineering, we need automated validation for workbook preservation behavior so that export regressions are caught before release.

Status:
- `Completed`

## 5. Acceptance bar
- Exported workbook must preserve the uploaded workbook sheet set.
- Exported workbook must open in Microsoft Excel without triggering repair on the main BOM sheet.
- Main BOM sheet must preserve template column widths.
- Main BOM rows must remain visually aligned to the latest uploaded workbook.
- Main BOM table must remain present and resized to include the three inline comparison metadata columns.
- Image-bearing sheets must preserve their drawing/media parts.
- Inline metadata columns must appear on the main BOM sheet.
- A dedicated metadata sheet must also be present, with hidden `comparisonId`.
- Automated tests must cover the preserved workbook path.

## 6. Source issue
- `ISSUE-001` in `docs/ISSUE_TRACKER.md`

## 7. Verification
- `npm --prefix apps/backend run typecheck`
- `npm --prefix apps/backend run test:e2e`

## 8. Regression note
- A post-implementation regression surfaced in Microsoft Excel where the main BOM sheet opened only after repair and then appeared empty.
- Root cause: duplicated `min` / `max` attributes in generated worksheet `<col>` tags during OOXML column extension.
- Fix: normalize copied column attributes before appending the three metadata columns and keep an automated test assertion that rejects duplicate worksheet column attributes.
