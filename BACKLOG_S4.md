# BACKLOG_S4.md

## Sprint S4 Backlog (Ticket-Ready)

This backlog expands Stage 4 (`S4-01` to `S4-10`) from `V1_SPEC.md`, `PRODUCT_PLAN.md`, and `SPRINT_PLAN.md` into execution-ready stories.

Source precedence:
- `V1_DECISIONS.md` for locked product behavior.
- `V1_SPEC.md` for functional and stage acceptance criteria.
- `PRODUCT_PLAN.md` for delivery shape and matching hierarchy.
- `V1_BacklogQA.md` for product-owner tie-break, normalization, classification, and streaming decisions.

## Delivery Guardrails (Stage 4)

1. Deterministic matching hierarchy is fixed:
- `INTERNAL_ID` -> `PART_NUMBER+REVISION` -> `PART_NUMBER` -> `FUZZY` -> `NO_MATCH`.

2. Deterministic tie-break inside each strategy:
- Uniqueness first.
- Highest confidence/score.
- Attribute concordance (`description` -> `quantity` -> `supplier`).
- Stable fallback (lowest target row index / stable UUID lexical order).
- Ambiguous near-tie is `REVIEW_REQUIRED` (no silent auto-pick).

3. One-to-one matching lock:
- A matched target row cannot be reused by another source row in the same run.

4. Normalization-first comparison:
- Case-fold text values.
- Trim and single-space normalization.
- Controlled punctuation normalization.
- Numeric normalization (`1`, `1.0`, `01` policy) and unit/UoM normalization where configured.

5. Classification fidelity:
- Support `added`, `removed`, `replaced`, `modified`, `moved`, `quantity_change`, and `no_change`.
- Maintain row-level and cell-level rationale metadata for every non-`no_change` classification.

6. Progressive results for UX:
- Job-based polling (`/diff-jobs`) with phase/percent/counters.
- Cursor-based incremental row retrieval (`/diff-jobs/{id}/rows`).
- Stable ordering to avoid row jitter while loading.

7. Stage boundary discipline:
- Stage 5 capabilities (exports/sharing/notifications/admin) remain out of scope.

8. Tenant/RBAC safety:
- Diff execution and result retrieval are tenant-scoped and authenticated.

---

## S4-01 Define Deterministic Matching Contract + Tie-Break Policy

### Story Metadata
- Story ID: `S4-01`
- Title: `Define Deterministic Matching Contract + Tie-Break Policy`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE/Architect`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-007`
- Stage acceptance link(s): `Stage 4 bullet 1`

### Inputs
- Confirmed Stage 3 mappings.
- Normalized candidate keys (`internal_id`, `part_number`, `revision`).

### Outputs
- Versioned matcher contract with explicit pass order and tie-break semantics.

### Constraints
- Deterministic output for identical inputs.
- One-to-one lock must be first-class in contract semantics.

### Acceptance Criteria
1. Strategy order is documented and implemented as constants.
2. Tie-break precedence is documented and implemented.
3. Ambiguous near-tie behavior is explicit (`REVIEW_REQUIRED`).
4. Contract is consumed by matcher engine and test fixtures.

### AI Prompt (Execution-Ready)
```text
Implement a versioned deterministic matching contract with fixed strategy order,
secondary tie-break precedence, and one-to-one target lock guarantees.
```

---

## S4-02 Implement Multi-Pass Matcher Engine (with One-to-One Lock)

### Story Metadata
- Story ID: `S4-02`
- Title: `Implement Multi-Pass Matcher Engine`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-007`
- Stage acceptance link(s): `Stage 4 bullet 1`

### Inputs
- Source and target normalized BOM rows.
- Matching contract from `S4-01`.

### Outputs
- Deterministic match set with strategy provenance and confidence metadata.

### Constraints
- Passes must execute in strict hierarchy order.
- Matched targets are locked from reuse.

### Acceptance Criteria
1. Engine executes all pass levels with deterministic ordering.
2. One-to-one lock prevents duplicate target assignment.
3. Ambiguous ties are emitted with review-required state.
4. Provenance records include strategy and tie-break reason.

### AI Prompt (Execution-Ready)
```text
Build a deterministic multi-pass matching engine that enforces one-to-one target locking,
traceable strategy provenance, and ambiguity-safe tie handling.
```

---

## S4-03 Implement Change Classification Taxonomy

### Story Metadata
- Story ID: `S4-03`
- Title: `Implement Change Classification Taxonomy`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE/Product`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-007`
- Stage acceptance link(s): `Stage 4 bullet 2`

### Inputs
- Matched row pairs and unmatched rows.
- Product-owner FFF classification guidance.

### Outputs
- Classification outputs: `added`, `removed`, `replaced`, `modified`, `moved`, `quantity_change`, `no_change`.

### Constraints
- Row status and cell status must not conflict.
- Classification logic must support revision-aware behavior when configured.

### Acceptance Criteria
1. Added/removed/changed classifications are correct for baseline fixtures.
2. Extended classes (`replaced`, `moved`, `quantity_change`) are represented in API and UI contracts.
3. Classification includes rationale codes per row.
4. Revision comparison mode is explicit and test-covered.

### AI Prompt (Execution-Ready)
```text
Implement a deterministic BOM change taxonomy with row/cell rationale,
including added/removed/replaced/modified/moved/quantity-change semantics.
```

---

## S4-04 Build Normalization Rules Engine for Comparison

### Story Metadata
- Story ID: `S4-04`
- Title: `Build Normalization Rules Engine for Comparison`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE/Data`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-007`
- Stage acceptance link(s): `Stage 4 bullets 1-2`

### Inputs
- Raw attribute values from source/target BOM rows.
- Tenant-level normalization policy (default provided).

### Outputs
- Canonical comparable values and normalization audit metadata.

### Constraints
- Transform steps are deterministic and idempotent.
- Part number normalization policy is configurable but default-safe.

### Acceptance Criteria
1. String case/whitespace normalization is implemented and test-covered.
2. Numeric normalization handles representation variants consistently.
3. UoM normalization path is defined and applied where configured.
4. Normalization metadata is emitted for traceability.

### AI Prompt (Execution-Ready)
```text
Implement a deterministic normalization module for text, punctuation, numeric, and UoM values
that emits traceable pre/post-compare metadata.
```

---

## S4-05 Diff Computation + Rationale/Audit Metadata

### Story Metadata
- Story ID: `S4-05`
- Title: `Implement Diff Computation + Rationale/Audit Metadata`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-007`, `NFR-AUDIT`
- Stage acceptance link(s): `Stage 4 bullets 2 and 4`

### Inputs
- Match outputs (`S4-02`) and classification outputs (`S4-03`).

### Outputs
- Persisted row/cell diffs with rationale and provenance.

### Constraints
- Every changed row must have machine-readable reason codes.
- Tenant-safe retrieval and immutable historical snapshots.

### Acceptance Criteria
1. Row-level and cell-level diffs are persisted and queryable.
2. Reason codes explain why a row is changed and which attributes changed.
3. Audit entries include strategy, confidence/score, and classification pathway.
4. Retention tags for paid/non-paid policy are implemented or explicitly stubbed.

### AI Prompt (Execution-Ready)
```text
Persist row/cell diff artifacts with deterministic rationale metadata,
including classification reason codes and match provenance for audits.
```

---

## S4-06 Create Progressive Diff Job API (Polling + Cursor Chunks)

### Story Metadata
- Story ID: `S4-06`
- Title: `Create Progressive Diff Job API`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-008`
- Stage acceptance link(s): `Stage 4 bullets 2-3`

### Inputs
- Diff execution jobs and persisted diff rows.

### Outputs
- `/diff-jobs` status endpoint with phase/progress/counters.
- `/diff-jobs/{id}/rows` cursor endpoint for incremental retrieval.

### Constraints
- Stable ordering across chunks.
- Cursor contract supports retries without duplication.

### Acceptance Criteria
1. Job status endpoint returns phase, percent complete, and counters.
2. Row endpoint returns deterministic chunk slices with `nextCursor`.
3. First progress update and first chunk meet agreed UX SLA targets.
4. API behavior is tenant-scoped, authenticated, and load-tested.

### AI Prompt (Execution-Ready)
```text
Implement progressive diff delivery via job polling and cursor-based row streaming,
with deterministic ordering and retry-safe cursors.
```

---

## S4-07 Build Results Grid UI (Partial + Final States)

### Story Metadata
- Story ID: `S4-07`
- Title: `Build Results Grid UI (Partial + Final States)`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `FE`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-008`
- Stage acceptance link(s): `Stage 4 bullets 3-4`

### Inputs
- Progressive API payloads from `S4-06`.
- Classification + color palette policy.

### Outputs
- Results grid with search/sort/filter/change-type filters.
- Row/cell highlighting and partial-progress UX.

### Constraints
- Partial results must never duplicate or reorder already-rendered rows unexpectedly.
- Accessibility contrast checks for color-coded states.

### Acceptance Criteria
1. Search/sort/filter functions are correct in partial and final states.
2. Change-type filters include full taxonomy from `S4-03`.
3. Row and cell highlights render consistently with approved palette.
4. Partial-state badge and completion transition UX are implemented.

### AI Prompt (Execution-Ready)
```text
Build a progressive results grid with deterministic row identity,
full filter/sort/search capability, and consistent row/cell diff highlighting.
```

---

## S4-08 Performance and Scalability Hardening for Diff Workloads

### Story Metadata
- Story ID: `S4-08`
- Title: `Performance and Scalability Hardening for Diff Workloads`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE/FE`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `NFR-PERF`
- Stage acceptance link(s): `Stage 4 bullets 2-4`

### Inputs
- Representative BOM fixtures and runtime telemetry.
- Fixture tiers (locked for perf tests):
  - Small: <=5MB CSV/XLSX
  - Medium: 5-30MB CSV/XLSX
  - Real regression fixtures:
    - `tests/fixtures/stage4/bill-of-materials.xlsx`
    - `tests/fixtures/stage4/bill-of-materialsv2.xlsx`
- Progressive API behavior from `S4-06` and results grid behavior from `S4-07`.

### Outputs
- Benchmarked limits and tuned query/render behavior.
- Published baseline report with p50/p95 metrics and dataset references.
- Repeatable perf test procedure documented in `docs/runbooks/s4-08-performance-baseline.md`.

### Contract
- Stage 4 performance budgets (from `V1_SPEC.md` + PreviousDocs):
  - Diff end-to-end p95 for <=5MB fixtures: <=30s
  - Diff end-to-end p95 for 5-30MB fixtures: <=90s
  - First progress response: <2s
  - First rows visible in results grid: <5s
  - Search/sort/filter interaction in loaded grid: <500ms
- Capture and report at minimum:
  - `datasetId`, `fileSizeBytes`, `rowCountSource`, `rowCountTarget`
  - `diffDurationMs`, `firstProgressMs`, `firstChunkMs`
  - `rowsPerSecond`, `browserInteractionMs`

### Constraints
- Must preserve deterministic result fidelity under load.
- Must not degrade Stage 2/3 stability.
- No relaxation of tie-break or classification contract for speed gains.
- Perf tests must run with tenant safety on and real auth/session path.

### Acceptance Criteria
1. Baseline and tuned runs are captured for small and medium fixtures with p50/p95 metrics.
2. p95 budgets are met (`<=30s` for <=5MB, `<=90s` for 5-30MB) without classification regressions.
3. Progressive UX budgets are met (`firstProgress <2s`, `firstChunk <5s`, grid interactions <500ms).
4. Perf procedure is documented and runnable by team members using one command sequence.
5. At least one regression guard is added (CI or scheduled/nightly path).

### Test Plan
- Backend:
  - Repeat `POST /diff-jobs` + poll + rows retrieval across fixture tiers and record durations.
  - Validate counters/classifications remain unchanged versus functional baseline.
- Browser:
  - Time first render and interaction latency on `/results` with staged datasets.
- CI:
  - Keep `npm run verify:story` as functional gate.
  - Add/plan perf gate command in runbook for nightly if PR-time gate is too expensive.

### Dependencies
- Stable Dev/Test environment with DB and queue baseline (`S2-00`).
- Real fixture catalog available in repo.
- Telemetry sink available for duration/error capture (prepared in `S4-10`).

### Actionable Subtasks
1. Add instrumentation points for job duration and first-chunk timings.
2. Create repeatable perf harness script/process and fixture matrix.
3. Run baseline and tuned passes; document deltas.
4. Add regression guard (CI/nightly) and publish threshold ownership.

### AI Prompt (Execution-Ready)
```text
Implement Stage 4 performance hardening with explicit p95 budgets:
<=30s for <=5MB, <=90s for 5-30MB, firstProgress<2s, firstChunk<5s, and grid interactions<500ms.
Do not change deterministic matching/classification behavior.
Produce benchmark evidence and add a repeatable perf regression process.
```

### Completion Evidence
- Perf harness implemented: `tools/perf/stage4-perf-benchmark.mjs`.
- Runbook implemented: `docs/runbooks/s4-08-performance-baseline.md`.
- Command added: `npm run stage4:perf`.
- Baseline report artifact generated: `test-results/stage4-perf-report.json`.
- API progressive delivery tuned for larger result sets via adaptive chunk cadence in `apps/backend/src/diff/diff-job.service.ts`.
- CI safety guard added in backend e2e:
  - `stage 4 baseline timings stay within agreed small-fixture budgets`.

---

## S4-09 Add Stage 4 Automated Tests (Backend + Browser)

### Story Metadata
- Story ID: `S4-09`
- Title: `Add Stage 4 Automated Tests`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `QA/BE/FE`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-007`, `FR-008`
- Stage acceptance link(s): `Stage 4 bullets 1-4`
- QA matrix link(s): items `8` and `9`

### Inputs
- Stage 4 fixture catalog and deterministic expected outputs.
- Real XLSX regression fixtures:
  - `tests/fixtures/stage4/bill-of-materials.xlsx`
  - `tests/fixtures/stage4/bill-of-materialsv2.xlsx`

### Outputs
- API/engine tests + browser tests for grid interactions and highlighting.

### Constraints
- Include ambiguity/tie-break and one-to-one lock edge cases.
- Include partial-to-final transition behavior.

### Acceptance Criteria
1. Matching hierarchy and tie-break edge cases are fully covered.
2. Classification correctness is covered on baseline and edge fixtures.
3. Search/sort/filter/change-type coverage includes partial-state loading.
4. Visual highlight consistency checks are included in browser tests.

### AI Prompt (Execution-Ready)
```text
Create robust Stage 4 backend and browser test suites for deterministic matching,
classification correctness, progressive loading, and results-grid behaviors.
```

---

## S4-10 Rollout, Observability, and Risk Controls for Stage 4

### Story Metadata
- Story ID: `S4-10`
- Title: `Rollout, Observability, and Risk Controls for Stage 4`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `BE/DevOps`
- Sprint: `S4`
- Status: `Done`

### Traceability
- Requirement link(s): `NFR-OBS`, `NFR-AUDIT`
- Stage acceptance link(s): `Stage 4 bullets 1-4`

### Inputs
- Telemetry framework and feature flag framework.
- PreviousDocs guidance:
  - Azure Monitor + Application Insights for metrics/traces/logs.
  - Alerting for availability, error rate, latency, queue depth.
  - Incident runbooks for high latency, outage, and corruption paths.

### Outputs
- Feature flags, dashboards, and runbook for Stage 4.
- Operational docs:
  - `docs/runbooks/s4-10-rollout-observability.md`
  - rollback and incident checklists with owners/escalation path.

### Constraints
- All metrics tenant-safe and privacy-compliant.
- Kill-switch rollback path must preserve historical diff visibility.
- Rollout must be progressive (Dev -> Test -> Prod), no big-bang enablement.

### Contract
- Feature flags (minimum):
  - `diff_engine_v1`
  - `diff_progressive_api_v1`
  - `results_grid_stage4_v1`
- Required Stage 4 operational metrics:
  - `diffJobDurationMs` (p50/p95 by dataset tier)
  - `diffJobErrorRate`
  - `diffAmbiguityRate` (review-required share)
  - `firstChunkLatencyMs`
  - `queueDepth`
  - `api5xxRate`
- Initial alert thresholds (inferred defaults, tune after baseline):
  - Availability/health endpoint down >5m
  - API 5xx rate >2% for 5m
  - Diff p95 breach for 15m:
    - >30s (<=5MB tier)
    - >90s (5-30MB tier)
  - Queue depth >20 for 10m
  - Dead-letter count >0 sustained 10m
- Dashboard minimum panels:
  - Uptime, active sessions/jobs, p50/p95 diff duration, queue depth, error rate, ambiguity rate

### Acceptance Criteria
1. Feature flags are implemented and validated independently across API/UI components.
2. Dashboard panels and metric queries are documented and visible in non-prod.
3. Alert rules are configured with thresholds, windows, and owner/escalation routing.
4. Rollback runbook is executed in non-prod and evidence is captured.
5. Post-rollout checklist includes monitoring sign-off and kill-switch verification.

### Test Plan
- Flag tests:
  - Validate each Stage 4 surface can be disabled independently without breaking auth/upload/history.
- Observability tests:
  - Emit synthetic failures/latency and verify alert trigger + notification path.
  - Validate dashboard reflects live metric changes.
- Rollback drill:
  - Disable Stage 4 flags in Test and verify system degrades gracefully to safe behavior.

### Dependencies
- Access to Azure Monitor/Application Insights resources.
- On-call destination (email/Teams/PagerDuty) and owner rotation.
- CI pipeline permissions for artifacting/report links.

### Actionable Subtasks
1. Add/confirm feature flag reads in backend/frontend boundaries.
2. Define metric schema and emitters for Stage 4 operations.
3. Build dashboard with agreed panels and links.
4. Configure alerts + action groups.
5. Execute and document rollback drill.

### AI Prompt (Execution-Ready)
```text
Implement Stage 4 rollout controls using feature flags and Azure Monitor/Application Insights.
Deliver metric emitters, dashboard, actionable alerts, and a validated rollback drill in Test.
Preserve tenant safety and deterministic diff behavior during all rollout states.
```

### Completion Evidence
- Feature flags implemented:
  - Backend: `DIFF_ENGINE_V1`, `DIFF_PROGRESSIVE_API_V1` in `apps/backend/src/diff/diff.controller.ts`.
  - Frontend UI: `NEXT_PUBLIC_RESULTS_GRID_STAGE4_V1` in `apps/frontend/components/results-grid.tsx`.
- Feature-flag behavior test coverage added in `apps/backend/test/stage1.e2e-spec.ts`:
  - `diff engine flag can disable diff job start endpoint`
  - `progressive diff API flag can disable status/rows endpoints`
- Operational metric emitters added to diff pipeline:
  - `stage4.diff.compute`, `stage4.diff.first_status`, `stage4.diff.first_rows`, `stage4.diff.completed`
  - implemented in `apps/backend/src/diff/diff-job.service.ts`.
- Rollout/observability runbook added:
  - `docs/runbooks/s4-10-rollout-observability.md`.
- Deferred fine-tuning items parked for later without blocking execution:
  - `docs/S4_ParkedClarifications.md`.

---

## Story Dependency Map

- `S4-01` -> `S4-02` -> `S4-03` -> `S4-05`.
- `S4-04` feeds `S4-02` and `S4-03`.
- `S4-05` -> `S4-06` -> `S4-07`.
- `S4-08` runs parallel after initial end-to-end path is available.
- `S4-09` spans all core stories.
- `S4-10` starts early and finalizes at cutover.

## Stage 4 Definition of Done (Backlog-Level)

- Deterministic matching runs with fixed strategy and tie-break order.
- Added/removed/changed outcomes are correct and explainable with rationale metadata.
- Search/sort/filter/change-type filters are correct for partial and final states.
- Row/cell-level highlighting is consistent and accessible.
- Progressive delivery is production-safe with polling + cursor chunking.
- Stage 5 scope remains excluded from Stage 4 implementation.
