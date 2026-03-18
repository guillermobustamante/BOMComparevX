# Smart BOM Region Detection Architecture

## Goal

Identify and extract only the real BOM table from uploaded CSV/XLS/XLSX files before the existing comparison pipeline runs.

This must safely ignore:

- title blocks and metadata rows above the BOM
- instruction panels, logos, images, and notes beside the BOM
- footer rows such as totals, legends, and status keys
- non-BOM columns outside the real component/part list

The output must stay the same contract already used today:

- parsed `DiffComparableRow[]`
- detected headers and header-to-field mapping
- existing revision storage, diff job start, diff computation, exports, history, and results behavior unchanged

## Locked Product Decisions

- Scan all visible sheets by default.
- Prefer sheet names similar to `BOM`, `BillOfMaterials`, `Parts`, and `Components`.
- Add a sheet dropdown per revision on:
  - `/upload`
  - `Upload Next Revision`
- Keep the dropdown always visible and disabled until workbook metadata loads.
- For CSV, show a disabled single-option dropdown such as `CSV`.
- If the user manually selects a sheet, user choice wins completely for sheet selection.
- Strictly exclude columns that do not behave like line-item data, but retain borderline columns when they are part of the line item and contain business data.
- Always remove totals, subtotals, legends, status keys, instructions, and other non-BOM footer rows.
- A BOM row qualifies with any 2 of `part number`, `description`, `quantity`, with a score-based fallback when that rule is not met.
- Ignore images entirely.
- Preserve all in-table business columns.
- Detect BOM end by scoring each next row and stopping when row-pattern breaks.
- Ignore top metadata completely.
- Favor precision over recall.
- When confidence is weak, fall back to the current parser, log diagnostics, and show a non-technical warning before compare on validation.
- Ship behind a feature flag with fallback to current behavior.

## Current Seam In The Code

The safe insertion point already exists in the upload path:

1. `UploadsController.intake()` stores accepted files.
2. `UploadRevisionService.storeRevisionPair()` / `storeChainedRevisionPair()` call `parseRowsFromFile()`.
3. `parseRowsFromFile()` currently:
   - parses the file into rows
   - finds the first non-empty row as the header
   - maps aliases
   - converts rows into `DiffComparableRow[]`
4. `DiffJobService.startJob()` consumes those rows later.

Relevant files:

- `apps/backend/src/uploads/upload-revision.service.ts`
- `apps/backend/src/uploads/uploads.controller.ts`
- `apps/backend/src/diff/diff-job.service.ts`

This means the new logic should live inside upload parsing only, before row normalization.

## What The Three Examples Mean

### Example 1

- rows `1-10` are safe to ignore
- the BOM starts at row `11`
- column `A` is irrelevant noise
- the BOM ends before the `Total` row

### Example 2

- the top title/summary area is safe to ignore
- the BOM starts at row `8`
- the useful table is within a bounded middle range
- the right-side status legend is not BOM data
- the BOM ends when the repeated component rows stop and the table becomes empty/non-BOM

### Example 3

- rows `1-9` are safe to ignore
- the BOM starts at row `10`
- columns `J+` are side content/instructions and must be ignored
- image cells inside the BOM area must not break detection

## Architecture Decision

Add a new pre-normalization stage:

- `BomRegionDetectionService`

This service determines:

- which worksheet contains the BOM
- which row is the BOM header row
- which column range belongs to the BOM table
- where the BOM data ends

Only the cropped BOM region is then passed into the existing header alias mapper and row-to-`DiffComparableRow` normalization.

## Proposed Processing Flow

### Phase 1: Workbook Grid Extraction

For each worksheet, build a rectangular cell grid with:

- row index
- column index
- displayed cell text
- whether the cell is blank

Important:

- images, shapes, and drawings must be ignored completely
- merged cells should contribute displayed text only where useful for scoring, not as BOM rows
- this should read worksheet cells directly instead of relying only on `sheet_to_json(..., header: 1)` because region detection needs accurate empty columns and side panels

Suggested structure:

- `WorksheetGrid`
- `GridCell`
- `CandidateRegion`

### Phase 2: Candidate Header Detection

Scan each worksheet for candidate header rows.

A row becomes a candidate when it contains several BOM-like header signals, such as:

- `part number`, `part #`, `item number`
- `description`, `part name`, `item name`
- `qty`, `quantity`
- `supplier`, `vendor`
- `unit cost`, `cost`
- `units`, `uom`
- `find number`, `position`, `category`, `revision`

Header scoring should reward:

- multiple recognized aliases on the same row
- aliases spread across adjacent columns
- nearby rows below that resemble repeated line items
- a nearby title containing `bill of materials`, `bom`, `parts list`, or `components`

Header scoring should penalize:

- label-value metadata layouts (`name:`, `revision:`, `approval date:`)
- rows with too few repeatable columns
- rows dominated by prose/instructions

### Phase 3: Column Window Detection

For each candidate header row, find the tightest useful BOM column window.

Logic:

1. Locate columns on the header row with recognized BOM aliases.
2. Expand slightly left/right only when adjacent columns behave like table columns.
3. Exclude side panels that do not behave like repeated line-item data.

This is how the system safely handles:

- ignoring column `A` in Example 1
- ignoring columns `J+` in Example 3
- ignoring legends and decorative side panels in Example 2

Column inclusion heuristics:

- header cell is recognized or near a recognized header
- rows below contain repeated structured values
- value types are consistent across multiple rows

Column exclusion heuristics:

- mostly empty below header
- long prose text / instruction text
- isolated sidebar values
- legend/status-key blocks
- decorative/image columns with no stable cell values

### Phase 4: Data Row Expansion And End Detection

Starting below the chosen header row, keep rows while they look like BOM entries.

A row should count as BOM when it has enough of:

- part-like token
- description-like text
- quantity-like numeric value
- supplier/category/unit/cost values
- hierarchical item numbers such as `14.1`, `14.2`

The detector should stop when one of these is true:

- `N` consecutive blank rows inside the chosen column window
- a footer row like `Total`, `Grand Total`, `Status Key`, `Instructions`
- repeated non-BOM prose rows
- schema break where the row no longer resembles a component list

Footer rows must not be emitted as BOM components.

### Phase 5: Existing Mapping And Normalization

Once the region is cropped:

1. run the current header alias mapping logic
2. build `DiffComparableRow[]`
3. run existing hierarchy inference
4. persist revision rows and continue current compare flow unchanged

## Smart Scoring Model

Use a weighted score instead of fixed row numbers or fixed columns.

Suggested score dimensions:

- `headerAliasScore`
- `adjacentColumnContinuityScore`
- `dataDensityScore`
- `typedValueScore`
- `bomKeywordContextScore`
- `footerPenalty`
- `sidebarPenalty`
- `metadataPenalty`

The best sheet + region wins.

## Required Adaptation To Variations

The detector should adapt to:

- BOM header not starting on row `1`
- BOM not starting in column `A`
- sidebars on the right or left
- image columns inside the table
- cost-only or supplier-heavy BOMs
- hierarchical multi-level BOMs
- single-sheet or multi-sheet workbooks
- title rows, merged cells, and logo/instruction blocks

It should not depend on:

- exact row numbers
- exact column letters
- exact sheet names
- exact formatting or colors

## Sheet Selection Strategy

Current code uses the first sheet only. That is brittle.

New strategy:

1. enumerate every visible worksheet
2. choose a preferred default sheet using sheet-name affinity
3. allow user override in the upload UI
4. run BOM region detection against the user-selected sheet
5. if confidence is low, fall back to current parser behavior and warn

This keeps the system safe while improving coverage.

## Safe Fallback Behavior

To protect the established compare pipeline:

- gate the new detector behind a feature flag, for example `UPLOAD_BOM_REGION_DETECTION_V1`
- if region confidence is high, use the detected region
- if confidence is low or ambiguous, use the current parser logic
- emit structured diagnostics showing why the detector accepted or rejected a region
- surface a non-technical warning to the user during validation before compare starts

This allows gradual rollout without destabilizing comparison quality.

## UI And API Requirements

The architecture now requires a workbook metadata step before validation/intake parsing.

Needed additions:

- sheet discovery endpoint for workbook uploads
- per-revision sheet dropdown on `/upload`
- per-revision sheet dropdown in `Upload Next Revision`
- selected sheet names sent through `validate` and `intake`
- validation warnings returned to the frontend before compare starts

This is still compatible with the current compare pipeline because only pre-normalization extraction changes.

## Proposed Service Contract

```ts
interface BomRegionDetectionInput {
  fileName: string;
  parserMode: 'csv' | 'xlsx';
  worksheets: WorksheetGrid[];
}

interface BomRegionDetectionResult {
  detected: boolean;
  confidence: number;
  worksheetName: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  dataEndRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
  reasons: string[];
}
```

Integration point inside `UploadRevisionService`:

- parse workbook/CSV into worksheet grids
- call `BomRegionDetectionService.detect(...)`
- crop to the detected region
- run current alias mapping on the cropped header/data rows

The selected sheet must come from:

- user-selected sheet if provided
- otherwise the preferred default sheet

## Why This Fits The Existing Flow

This design changes only the extraction boundary, not the comparison engine.

Unchanged components:

- upload validation
- accepted job creation
- revision persistence
- diff job start
- matcher and classification logic
- results grid, exports, history, and sharing

Changed component:

- upload parsing inside `UploadRevisionService`

## Recommended Implementation Order

1. Extract worksheet-grid parsing from `parseWorkbookTable()`.
2. Add `BomRegionDetectionService` with scoring and diagnostics only.
3. Feature-flag region cropping for XLS/XLSX first.
4. Reuse the same detector for CSV with a single-sheet grid abstraction.
5. Add telemetry for:
   - chosen sheet
   - chosen row/column window
   - confidence
   - fallback reason
6. Add fixture tests for the three examples and nearby variations.

## Test Matrix

Must include:

- header rows above BOM
- left-side junk column
- right-side instruction columns
- right-side legends
- image cells in or near BOM
- subtotal/footer rows
- empty rows after the BOM
- multi-level dotted item numbers
- same workbook with BOM on a non-first sheet

Expected assertion:

- detector crops the BOM correctly
- emitted `DiffComparableRow[]` excludes non-BOM rows and columns
- downstream diff results remain unchanged for already-supported files

## Final Recommendation

Implement a confidence-scored BOM region detector inside `UploadRevisionService` as a pre-normalization step, behind a feature flag, with fallback to the current parser.

That is the safest way to support these three examples and future variants while preserving the current stable comparison pipeline once the BOM table has been isolated.

The finalized implementation spec is documented in:

- `docs/SMART_BOM_REGION_DETECTION_IMPLEMENTATION_SPEC.md`
