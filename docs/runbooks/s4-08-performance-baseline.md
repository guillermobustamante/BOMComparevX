# S4-08 Performance Baseline Runbook

Status: `Draft (Execution-Ready)`  
Owner: `BE/FE`  
Stage: `S4`

## Objective
Measure and harden Stage 4 diff and results performance without changing deterministic matching/classification behavior.

## Budgets (Locked)
- Diff p95 (<=5MB fixtures): `<=30s`
- Diff p95 (5-30MB fixtures): `<=90s`
- First progress response: `<2s`
- First row chunk visible in results: `<5s`
- Results grid interaction (search/sort/filter): `<500ms`

## Fixture Matrix
- Small tier: <=5MB CSV/XLSX fixture(s)
- Medium tier: 5-30MB CSV/XLSX fixture(s)
- Real regression pair:
  - `tests/fixtures/stage4/bill-of-materials.xlsx`
  - `tests/fixtures/stage4/bill-of-materialsv2.xlsx`

## Required Measurements
- `datasetId`
- `fileSizeBytes`
- `rowCountSource`
- `rowCountTarget`
- `diffDurationMs`
- `firstProgressMs`
- `firstChunkMs`
- `browserInteractionMs`
- `api5xxRate` during run

## Execution Steps
1. Run functional baseline:
   - `npm run verify:story`
2. Execute diff job runs for each fixture tier and collect timings.
3. Capture results grid interaction timings on `/results`.
4. Apply tuning changes (query/index/render/chunking).
5. Re-run the same matrix and compare p50/p95 deltas.

## Evidence to Attach
- Timing table (before/after)
- Fixture list and sizes
- Build/test commit hash
- Pass/fail against each budget

## Exit Criteria
- All budgets met for small and medium tiers.
- No regression in deterministic diff correctness.
- Procedure repeatable by another engineer.
