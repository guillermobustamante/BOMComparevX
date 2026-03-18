# Smart BOM Region Detection Implementation Spec

## Status

Locked implementation spec based on clarified product decisions.

## Product Decisions

### Sheet selection

- Scan all visible sheets for every workbook upload.
- Prefer sheets with names similar to:
  - `BOM`
  - `BillOfMaterials`
  - `Parts`
  - `Components`
- Show a sheet dropdown for each uploaded revision:
  - on `/upload`
  - in the Results page `Upload Next Revision` dialog
- The dropdown is always visible but disabled until workbook metadata is loaded.
- For CSV, show a disabled single-option dropdown such as `CSV`.
- If the user manually selects a sheet, user choice wins completely for sheet selection.

### BOM extraction behavior

- Strictly exclude any column not behaving like line-item data.
- Keep borderline columns only if they are part of the line item and contain business data.
- Always remove:
  - totals
  - subtotals
  - status keys
  - legends
  - instruction rows
  - other footer/non-BOM rows
- A row qualifies as BOM when it satisfies any 2 of:
  - part number
  - description
  - quantity
- If that rule is not met, use a score-based fallback with no single required field.
- Ignore images entirely.
- Preserve all in-table business columns.
- End-of-BOM detection is score-based and stops when row-pattern breaks.
- Ignore metadata completely, even if metadata conflicts with extracted row counts or cost totals.
- Favor precision over recall.

### Confidence and fallback

- Feature-flag the new behavior with fallback to current parsing.
- If detection confidence is weak:
  - continue
  - fall back to current parser behavior
  - log a warning
  - show a non-technical warning to the user before compare on validation
- Automatic detection now.
- Manual row/column override later, not in phase 1.

## Goal

Improve upload parsing so BOM-like workbooks with headers, sidebars, images, notes, and non-BOM panels are safely cropped to the real BOM region before comparison, while preserving the current downstream compare pipeline unchanged.

## Non-Goals

- No changes to diff matching, classification, results rendering, exports, history, or sharing after BOM rows are produced.
- No user row/column manual override in phase 1.
- No visual preview of detected row/column bounds in phase 1.

## Existing Flow To Preserve

1. Frontend upload screen collects files.
2. Frontend calls `/api/uploads/validate`.
3. Backend validates and parses accepted files.
4. Frontend calls `/api/uploads/intake`.
5. Backend stores revisions and revision pair.
6. Results page starts diff through `/api/diff-jobs`.
7. Current diff engine runs on `DiffComparableRow[]`.

Only the BOM extraction stage before `DiffComparableRow[]` creation should change.

## Required UX Changes

### Upload page

Affected component:

- `apps/frontend/components/upload-validation-form.tsx`

For each revision slot:

- Add a sheet dropdown control.
- Render it immediately in the UI.
- Disable it until workbook metadata has loaded.
- After file selection, call workbook metadata discovery.
- Populate visible sheets.
- Preselect the preferred sheet.
- Allow manual override.

Validation UX:

- On validate, if parsing confidence is weak or fallback parser is used, show a non-technical warning before compare starts.
- Warning should be understandable by non-technical users.

Example warning style:

- `We found the part list, but this file has extra content like headers or side notes. We used the safest available interpretation. Please confirm the selected sheet looks correct if results seem incomplete.`

### Results page upload-next flow

Affected component:

- `apps/frontend/components/results-grid.tsx`

In `Upload Next Revision`:

- Add the same always-visible sheet dropdown for the new file.
- Disable until workbook metadata has loaded.
- For CSV, show disabled `CSV`.
- User-selected sheet wins completely.

## Required API Changes

### New workbook metadata endpoint

Add a new upload-preflight endpoint for workbook inspection.

Suggested frontend route:

- `apps/frontend/app/api/uploads/workbook-metadata/route.ts`

Suggested backend route:

- `POST /api/uploads/workbook-metadata`

Purpose:

- inspect uploaded file
- list visible sheets
- return preferred default sheet
- indicate file kind (`csv` or workbook)
- return sheet selection warnings if needed

Suggested response:

```ts
interface WorkbookMetadataResponse {
  fileKind: 'csv' | 'workbook';
  visibleSheets: Array<{
    name: string;
    preferred: boolean;
    reason?: string;
  }>;
  selectedSheetName: string;
  dropdownDisabled: boolean;
  warnings: string[];
}
```

Rules:

- workbook: populate all visible sheets and mark the preferred one
- csv: return one disabled option, `CSV`

### Validate endpoint changes

Affected backend route:

- `apps/backend/src/uploads/uploads.controller.ts`

Affected frontend proxy:

- `apps/frontend/app/api/uploads/validate/route.ts`

Extend validation form payload to include per-file sheet selections, for example:

- `fileASheetName`
- `fileBSheetName`

Validation response should support warnings:

```ts
interface UploadValidationWarning {
  code: string;
  message: string;
  file?: 'fileA' | 'fileB';
  selectedSheetName?: string;
}
```

Validation success should include:

- existing accepted payload
- warning list
- selected sheet names actually used
- whether fallback parser was used

### Intake endpoint changes

Affected backend route:

- `apps/backend/src/uploads/uploads.controller.ts`

Affected frontend proxy:

- `apps/frontend/app/api/uploads/intake/route.ts`

Intake must receive the same selected sheet names used during validation so revision parsing is deterministic and consistent with what the user reviewed.

## Backend Design

### New services

Add:

- `BomWorkbookMetadataService`
- `BomRegionDetectionService`

Possible location:

- `apps/backend/src/uploads/`

Responsibilities:

#### `BomWorkbookMetadataService`

- parse workbook or CSV structure
- enumerate visible sheets
- score sheet names
- identify preferred sheet
- ignore hidden sheets by default

#### `BomRegionDetectionService`

- analyze the selected sheet only
- detect BOM header row
- detect BOM column window
- detect BOM end row
- return confidence, warnings, and diagnostics
- support fallback comparison between:
  - crop-first then map
  - map-first then suppress columns
- keep whichever has higher confidence

### Integration point

Primary integration remains:

- `UploadRevisionService.parseRowsFromFile()`

New flow inside that method:

1. Parse file into workbook/CSV grid model.
2. Resolve user-selected sheet if workbook.
3. If no user selection, use preferred sheet.
4. Run region detection on selected sheet.
5. Run both extraction strategies:
   - crop-first then map aliases
   - map-first then suppress irrelevant columns
6. Keep the higher-confidence result.
7. If low confidence:
   - fall back to current parser logic
   - emit warning + diagnostics
8. Return the same normalized `DiffComparableRow[]` contract already used today.

## Detection Logic

### Sheet preference scoring

Preferred names should score highest when normalized sheet names match or contain:

- `bom`
- `billofmaterials`
- `parts`
- `components`

Still scan all visible sheets because preferred name is only the default, not the sole candidate.

### Header detection

A candidate header row gains confidence when it contains recognized aliases for BOM columns such as:

- part number / part #
- description / part name / item name
- quantity / qty
- supplier / vendor
- units
- cost / unit cost
- category
- item number / position / find number

Header rows lose confidence when they resemble metadata or instructions.

### Column detection

The detector must:

- exclude sidebars, legends, instruction columns, sparse image columns, and decorative columns
- preserve legitimate business columns that behave like line-item columns
- evaluate both:
  - crop-first extraction
  - map-first suppression

Winner is whichever produces higher confidence and cleaner BOM rows.

### Row detection

Keep rows while they continue to resemble BOM line items.

Score signals include:

- part-like identifier
- description-like text
- quantity-like numeric field
- supplier/category/unit/cost business fields
- hierarchical item numbering like `14.1`
- consistency with surrounding rows

Always remove rows that behave like:

- totals
- subtotals
- legends
- instructions
- blank separators that break the row pattern

### Images

- Ignore images entirely during metadata discovery and BOM extraction.
- Image-bearing rows remain valid if text cells indicate they are part of the BOM.

## Diagnostics And Warning Model

Diagnostics must be stored for backend analysis and rollout confidence.

Suggested diagnostics:

- file name
- file type
- visible sheets
- selected sheet
- preferred sheet
- detected header row
- detected data bounds
- detected column bounds
- extraction strategy used
- confidence score
- fallback used
- warning reasons

User-facing warning text must be non-technical.

Suggested warning cases:

- selected sheet had extra content outside the BOM
- BOM boundaries were estimated
- fallback parser was used because the BOM layout was unclear

## Data Model Impact

Minimal by design.

Existing revision storage should remain primary.

Recommended additions:

- selected sheet name used for each stored revision
- parse confidence
- parse warnings JSON
- parse diagnostics JSON

If persistence changes are deferred, diagnostics may first be emitted through structured logs and upload events.

## Feature Flag

Suggested flag:

- `UPLOAD_BOM_REGION_DETECTION_V1`

Behavior:

- `false`: current parser only
- `true`: smart region detection with fallback to current parser

## Test Requirements

### Fixture coverage

Must cover:

- the three provided example patterns
- top metadata headers
- left junk columns
- right instruction panels
- right legends/status keys
- embedded image columns
- subtotal/total/footer rows
- blank row breaks
- non-first-sheet BOMs
- CSV with similar non-BOM framing

### Assertions

- preferred sheet chosen correctly
- sheet dropdown payloads respected
- user override beats preferred sheet
- BOM rows exclude non-BOM content
- warnings appear on validation before compare
- fallback parser works when confidence is weak
- downstream diff behavior remains unchanged once rows are produced

## Rollout Plan

1. Implement backend workbook metadata discovery.
2. Add sheet dropdowns to upload flows.
3. Add selected sheet fields to validate/intake.
4. Implement region detection behind feature flag.
5. Add warnings and diagnostics.
6. Run fixture validation with the example files and nearby variants.
7. Enable in dev/test before broader rollout.

## Acceptance Criteria

- User can select a sheet for each uploaded revision on `/upload`.
- User can select a sheet for next revision uploads in Results.
- Dropdown is always visible and disabled until workbook metadata loads.
- Preferred sheet is auto-selected by default.
- CSV shows disabled single-option `CSV`.
- Validation shows understandable warnings before compare when detection is weak or fallback is used.
- Selected sheet is honored exactly.
- Non-BOM headers, side panels, instructions, legends, totals, and images are excluded from the BOM extraction.
- Existing comparison flow after BOM extraction remains unchanged.
