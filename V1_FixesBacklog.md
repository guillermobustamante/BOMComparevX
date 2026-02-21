# V1_FixesBacklog.md

## Mini Sprint Backlog - V1 Accuracy Fixes (Upload -> Results)

Status: `Completed`  
Owner: `Codex + Product`  
Priority: `P0`  
Goal: Make real user BOM uploads (CSV/XLSX) produce correct, deterministic Stage 4 results with strong regression protection.

---

## Why This Backlog Exists

Observed issue with real files (`bill-of-materials.xlsx` vs `bill-of-materialsv2.xlsx`):
- Results showed inflated row counts and incorrect `removed` rows.
- Root cause: revision parser path treated `.xlsx` as UTF-8 CSV text.
- Secondary gap: Stage 4 diff field set does not yet include all BOM properties expected by users (for example `Color`, `Cost`).

Business impact:
- Users cannot trust upload-to-results output for Excel fixtures.
- Stage 4 appears functionally complete in dev harness but is incomplete on real BOM formats.

---

## Scope

In scope:
- Proper XLSX parsing in upload revision ingestion.
- Canonical header alias expansion for common BOM headers.
- Diff/classification extension for additional business properties.
- Robust parser failure handling (fail-fast, no silent garbage rows).
- End-to-end automated regression tests using real fixtures.

Out of scope:
- PLM/CAD deep integrations.
- Stage 5 exports/sharing/notification expansion.
- Full spreadsheet style/formula fidelity.

---

## Story List

### FX-01 - Replace CSV-only Revision Parser with Format-Aware Parser
- Status: `Done`
- Priority: `P0`
- Problem:
  - `.xlsx` files are currently parsed through text/CSV logic.
- Implementation:
  - Add format-aware parser:
    - `.csv`: existing CSV parser path
    - `.xlsx`/`.xls`: workbook parser path
  - Parse first sheet by default with deterministic row ordering.
  - Preserve source row index.
- Acceptance Criteria:
  1. Uploading valid `.xlsx` yields expected row count (no binary garbage rows).
  2. CSV behavior remains backward compatible.
  3. Unsupported/corrupt format returns structured parse error.
- Test Coverage:
  - Unit + integration tests for CSV and XLSX paths.

### FX-02 - Header Alias Contract Hardening (Real BOM Headers)
- Status: `Done`
- Priority: `P0`
- Problem:
  - Real headers like `Part #`, `Part Name`, `Unit Cost` are not fully mapped.
- Implementation:
  - Extend alias normalization/mapping for:
    - `part_number`: `Part #`, `Part No`, `Part Number`
    - `description`: `Part Name`, `Description`
    - `quantity`: `Qty`, `Quantity`
    - `cost`: `Unit Cost`, `Cost`
    - optional custom field capture for `Color`, `Units`, `Category`, etc.
- Acceptance Criteria:
  1. Provided fixture headers resolve deterministically.
  2. Missing required canonical fields return clear validation/warning state.
  3. Mapping evidence includes alias used.
- Test Coverage:
  - Header alias fixtures and deterministic mapping assertions.

### FX-03 - Expand Stage 4 Diff Field Set for Business-Relevant Changes
- Status: `Done`
- Priority: `P0`
- Problem:
  - Current diff ignores properties users expect to detect (e.g., `Color`, `Cost`).
- Implementation:
  - Extend comparable fields to include:
    - `color`
    - `cost` / `unit_cost`
    - optional `units` (if present)
  - Ensure classification/rationale includes these field deltas.
- Acceptance Criteria:
  1. Fixture pair detects expected changes on target row (Color, Qty, Cost).
  2. Changed-field chips/rationale include these properties.
  3. No regression in existing `quantity_change`, `modified`, `no_change` behavior.
- Test Coverage:
  - Unit + e2e assertions for changed fields list and classification.

### FX-04 - Fail-Fast Parser Guardrails and Diagnostics
- Status: `Done`
- Priority: `P0`
- Problem:
  - Parser can silently produce invalid row counts when wrong parser is used.
- Implementation:
  - Add guardrails:
    - suspicious row explosion detection
    - required-header sanity checks
    - parse error codes + correlation ID
  - Emit diagnostic events for parse failures.
- Acceptance Criteria:
  1. Invalid parse scenario fails with explicit error.
  2. No silent fallback to invalid row generation.
  3. Logs include parser mode and failure reason.
- Test Coverage:
  - Negative tests for corrupt/unsupported files.

### FX-05 - Real-File Regression Suite (Backend + Browser)
- Status: `Done`
- Priority: `P0`
- Problem:
  - Existing tests overfit sample rows and missed real XLSX behavior.
- Implementation:
  - Add locked fixtures:
    - `tests/fixtures/stage4/bill-of-materials.xlsx`
    - `tests/fixtures/stage4/bill-of-materialsv2.xlsx`
  - Backend e2e:
    - upload -> intake -> diff job -> assert expected row deltas.
  - Playwright e2e:
    - upload two fixtures -> View Results -> assert targeted changed row and fields.
- Acceptance Criteria:
  1. CI fails if regression reappears.
  2. Fixture expected output is deterministic.
  3. Test report clearly indicates parser/diff mismatch details.

### FX-06 - Stage 4 Closeout Patch + Documentation Update
- Status: `Done`
- Priority: `P1`
- Implementation:
  - Update Stage 4 docs and backlog status after fixes:
    - `BACKLOG_S4.md`
    - `SPRINT_PLAN.md`
    - `V1_SPEC.md` (if field set/contract changed)
  - Add runbook notes for supported upload parse behavior.
- Acceptance Criteria:
  1. Docs match implemented parser and diff behavior.
  2. Browser test instructions include real XLSX path.

---

## Execution Order

1. `FX-01` format-aware parsing  
2. `FX-02` header alias hardening  
3. `FX-03` diff field expansion (`Color`, `Cost`, etc.)  
4. `FX-04` fail-fast parser guardrails  
5. `FX-05` fixture-based regression automation  
6. `FX-06` documentation closeout

---

## Definition of Done

1. Real uploaded XLSX fixtures produce correct row counts and expected change detection.
2. Results view reflects true deltas (not parser artifacts).
3. Full verification passes (`npm run verify:story`) including new regression tests.
4. Backlog and sprint docs updated to reflect fixes and completion.

---

## Completion Evidence

- Backend parser now supports deterministic `.csv` and workbook (`.xlsx`/`.xls`) parsing with source row index preservation.
- Header aliases expanded for real BOM columns (`Part #`, `Part Name`, `Qty`, `Color`, `Units`, `Cost`, `Unit Cost`, `Elem ID`, `Category`).
- Diff contract/classification expanded to include additional business deltas (`color`, `units`, `cost`, `category`).
- Parser guardrails implemented:
  - unsupported/corrupt workbook errors
  - required header sanity checks
  - suspicious row explosion checks
  - structured parse error payloads with `code` + `correlationId` + `parserMode`
- Locked real-file fixtures added:
  - `tests/fixtures/stage4/bill-of-materials.xlsx`
  - `tests/fixtures/stage4/bill-of-materialsv2.xlsx`
- Regression coverage added:
  - backend e2e verifies fixture pair produces expected modified row and changed fields (`color`, `quantity`, `cost`)
  - Playwright e2e verifies upload -> results flow for fixture pair in browser path
- Verification command passed:
  - `npm run verify:story`
