# BACKLOG_S6.md

## Sprint S6 Backlog (Ticket-Ready)

This backlog expands Sprint S6 (Stage 6 - Retention + Hardening) from `SPRINT_PLAN.md` into execution-ready stories.

Source precedence:
- `V1_DECISIONS.md` for locked behaviors and retention policy baseline.
- `V1_SPEC.md` for FR/NFR and Stage 6 acceptance criteria.
- `PRODUCT_PLAN.md` for Stage 6 architecture direction.
- `docs/DELTA_PREVIOUSDOCS_DEVOPS.md` for legacy-to-current gap closure.

## Delivery Guardrails (Stage 6)

1. Retention safety first:
- Deletion must be policy-driven, deterministic, and auditable.
- No silent deletes without operational evidence (counts + timestamps + actor/system context).

2. Stage 6 scope boundary:
- Stage 6 handles raw upload artifact lifecycle, audit export, and performance hardening.
- STEP/STP parser development is deferred to Stage 10.
- If STEP/STP artifacts exist in storage later, cleanup policy must still be extensible.

3. Tenant and admin boundaries:
- Audit export is tenant-scoped and admin-authorized.
- Cross-tenant leakage is a release-blocking defect.

4. Reliability and performance:
- Hardening must preserve deterministic diff behavior from Stage 4.
- p95 targets from `V1_SPEC.md` remain the baseline quality gate.

5. AI-first execution:
- Stories are scoped for Codex execution where possible.
- Human approval remains required only for environment-level operational policies (alerts, backup/ops routing, production rollout sign-off).

---

## S6-01 Enforce Automated 7-Day Raw Artifact Cleanup

### Story Metadata
- Story ID: `S6-01`
- Title: `Enforce Automated 7-Day Raw Artifact Cleanup`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Platform)`
- Sprint: `S6`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-015`
- Stage acceptance link(s): `Stage 6 bullet 1`
- Decision link(s): `V1_DECISIONS.md` item `4`

### Inputs
- Raw upload artifact metadata (`tenantId`, artifact path/key, created timestamp, revision/session link).
- Retention config: `EXPORT_ARTIFACT_RETENTION_DAYS`, `STAGE5_RETENTION_INTERVAL_MS` plus Stage 6 raw artifact retention configuration.

### Outputs
- Automated deletion of raw artifacts older than 7 days.
- Sweep metrics and audit events for each run.

### Contract
- Scheduled retention runner executes at configured interval.
- Eligibility: artifact age > 7 days and not protected by active lock flag.
- Deletion result contract includes:
  - `deletedCount`
  - `skippedCount`
  - `errorCount`
  - `sweptAtUtc`
  - `cutoffUtc`

### Constraints
- Tenant-safe path selection.
- Idempotent sweep behavior.
- No deletion of derived diff data, mappings, or audit records.

### Acceptance Criteria
1. Eligible raw artifacts older than 7 days are removed automatically.
2. Non-eligible artifacts remain intact.
3. Sweep emits auditable summary with deterministic counters.

### AI Prompt (Execution-Ready)
```text
Implement Stage 6 raw artifact retention cleanup with a scheduled runner.
Delete only eligible artifacts older than 7 days, enforce tenant safety, and emit audit/metric summaries for each sweep.
```

---

## S6-02 Add Retention Reconciliation + Failure Auditing

### Story Metadata
- Story ID: `S6-02`
- Title: `Add Retention Reconciliation + Failure Auditing`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `AI Coding Agent (BE)`
- Sprint: `S6`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-015`
- Stage acceptance link(s): `Stage 6 bullets 1-2`
- Decision link(s): `V1_DECISIONS.md` items `4`, `46`

### Inputs
- Retention sweep output from `S6-01`.
- Existing audit logging pipeline.

### Outputs
- Reconciliation record for each sweep run.
- Failure audit entries and retry-safe diagnostics.

### Contract
- Add structured audit events:
  - `retention.sweep.success`
  - `retention.sweep.failure`
- Persist summary details:
  - counts by artifact type
  - cutoff timestamps
  - correlation ID

### Constraints
- Audit writes must be best-effort but never block cleanup loop completion.
- Failure context must avoid sensitive payload leakage.

### Acceptance Criteria
1. Every sweep emits success/failure audit trace with correlation ID.
2. Failed deletions are visible with reason categories.
3. Re-run after failure is safe and does not duplicate destructive behavior.

### AI Prompt (Execution-Ready)
```text
Add retention reconciliation and failure auditing on top of cleanup jobs.
Emit structured success/failure audit events with correlation IDs and categorized error reasons.
Keep retries idempotent and safe.
```

---

## S6-03 Implement Tenant-Safe Audit Export API (CSV/JSON)

### Story Metadata
- Story ID: `S6-03`
- Title: `Implement Tenant-Safe Audit Export API (CSV/JSON)`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE)`
- Sprint: `S6`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-AUDIT`
- Stage acceptance link(s): `Stage 6 bullet 2`
- Legacy traceability: `docs/DELTA_PREVIOUSDOCS_DEVOPS.md` (Epic `445` delta)

### Inputs
- Admin-authenticated tenant context.
- Filter window: `fromUtc`, `toUtc`, optional `eventType`.

### Outputs
- Downloadable audit export in CSV or JSON.

### Contract
- Endpoint: `GET /api/audit/export`
- Query params:
  - `format=csv|json`
  - `fromUtc`
  - `toUtc`
  - `eventType?`
- Success: `200` attachment.
- Failure: standardized `{ code, message, correlationId }`.

### Constraints
- Admin-only access.
- Tenant-only dataset export.
- Export size guardrails with deterministic error on breach.

### Acceptance Criteria
1. Admin can export tenant audit logs in CSV and JSON formats.
2. Non-admin requests are denied.
3. Cross-tenant records are never included.

### AI Prompt (Execution-Ready)
```text
Build a tenant-safe admin audit export API supporting CSV and JSON formats with date-range filters.
Enforce strict tenant scoping and admin authorization, and return standardized error payloads.
```

---

## S6-04 Surface Failed Jobs and Policy Rejections in History/Audit Views

### Story Metadata
- Story ID: `S6-04`
- Title: `Surface Failed Jobs and Policy Rejections in History/Audit Views`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (FE/BE)`
- Sprint: `S6`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-011`, `NFR-RELIABILITY`
- Stage acceptance link(s): `Stage 6 bullet 2`

### Inputs
- Job failure events.
- Upload policy rejection events (`cooldown`, `limit`, validation rejection).

### Outputs
- History and/or audit UI surfaces showing failure/rejection reason and timestamp.

### Contract
- API adds reason/status fields for failure classes.
- UI exposes deterministic badges/states:
  - `failed`
  - `policy_rejected`
  - reason detail

### Constraints
- No sensitive internals in user-visible messages.
- Preserve tenant isolation.

### Acceptance Criteria
1. Failed jobs are visible with clear reason in history/audit surfaces.
2. Policy rejection events are visible with reason and time.
3. States are test-covered and deterministic.

### AI Prompt (Execution-Ready)
```text
Expose failed jobs and policy rejection outcomes in history/audit views.
Add clear reason codes and deterministic UI state badges while preserving tenant-safe access.
```

---

## S6-05 Establish Stage 6 Performance Benchmark Harness

### Story Metadata
- Story ID: `S6-05`
- Title: `Establish Stage 6 Performance Benchmark Harness`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `AI Coding Agent (QA/BE)`
- Sprint: `S6`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-PERF`
- Stage acceptance link(s): `Stage 6 bullet 3`

### Inputs
- Locked fixture set (small, medium, large BOM files).
- Target thresholds from `V1_SPEC.md`.

### Outputs
- Repeatable benchmark command and artifact report (p50/p95).

### Contract
- Add deterministic perf harness command (example: `npm run perf:stage6`).
- Emit machine-readable report artifact (JSON/Markdown).

### Constraints
- Harness must be CI-compatible and deterministic across runs.
- No mutation of production data required.

### Acceptance Criteria
1. Benchmark harness runs repeatably in Dev/Test.
2. Report includes p95 metrics for core scenarios.
3. Regression thresholds are documented and enforced.

### AI Prompt (Execution-Ready)
```text
Create a deterministic Stage 6 performance harness with fixed fixtures and p95 reporting.
Make it CI-friendly and produce machine-readable benchmark artifacts for regression tracking.
```

---

## S6-06 Tune Parse/Diff Critical Path for p95 Targets

### Story Metadata
- Story ID: `S6-06`
- Title: `Tune Parse/Diff Critical Path for p95 Targets`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE)`
- Sprint: `S6`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-PERF`
- Stage acceptance link(s): `Stage 6 bullet 3`

### Inputs
- Baseline perf report from `S6-05`.
- Existing parser/matcher pipeline and Stage 4 progressive API.

### Outputs
- Optimized critical path meeting target p95 latency budgets.

### Contract
- Preserve deterministic output contract.
- Maintain Stage 4 progress/status semantics.

### Constraints
- No behavior drift in diff classification and rationale metadata.
- Performance tuning cannot relax tenant/auth safeguards.

### Acceptance Criteria
1. Core p95 targets are met for agreed fixture tiers.
2. Deterministic diff output remains unchanged for identical inputs.
3. Performance gains are measurable and documented in benchmark report.

### AI Prompt (Execution-Ready)
```text
Tune parse/diff critical path to meet Stage 6 p95 targets without changing deterministic output behavior.
Use benchmark evidence to prove improvements and keep existing contracts stable.
```

---

## S6-07 Expand Telemetry/Alerts for Retention and Latency Regressions

### Story Metadata
- Story ID: `S6-07`
- Title: `Expand Telemetry/Alerts for Retention and Latency Regressions`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (BE/DevOps)`
- Sprint: `S6`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-RELIABILITY`, `NFR-AUDIT`
- Stage acceptance link(s): `Stage 6 bullets 2-3`

### Inputs
- Existing Stage 4/5 metric events.
- Stage 6 retention and performance outputs.

### Outputs
- Structured Stage 6 telemetry and alert thresholds.

### Contract
- Metric/event additions:
  - `stage6.retention.sweep`
  - `stage6.retention.failure`
  - `stage6.audit.export`
  - `stage6.perf.budget_breach`

### Constraints
- Alerts must be environment-tunable (`Dev/Test/Prod`).
- Avoid noisy duplicate signals.

### Acceptance Criteria
1. Stage 6 events are emitted with consistent schemas.
2. Alert rules exist for retention failures and perf budget breaches.
3. Runbook references are updated with threshold and triage steps.

### AI Prompt (Execution-Ready)
```text
Add Stage 6 telemetry and alert signals for retention sweeps, audit exports, and performance budget breaches.
Keep schemas consistent and environment-configurable, and update runbook references.
```

---

## S6-08 Add Stage 6 Automated Tests + Rollout/Rollback Closeout

### Story Metadata
- Story ID: `S6-08`
- Title: `Add Stage 6 Automated Tests + Rollout/Rollback Closeout`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (QA/BE/DevOps)`
- Sprint: `S6`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-015`, `NFR-PERF`, `NFR-RELIABILITY`, `NFR-AUDIT`
- Stage acceptance link(s): `Stage 6 bullets 1-3`

### Inputs
- Completed Stage 6 implementation stories.
- Existing CI checks and Playwright harness.

### Outputs
- Automated test coverage and Stage 6 runbook closeout evidence.

### Contract
- CI includes:
  - retention behavior checks
  - audit export authorization/scope checks
  - perf harness threshold checks
- Rollback drill documented and reproducible.

### Constraints
- Tests must be diagnostic and non-flaky.
- Rollback path must preserve Stage 1-5 functionality.

### Acceptance Criteria
1. Stage 6 acceptance bullets are mapped to passing automated tests.
2. Rollback and observability runbooks are complete and validated in non-prod.
3. CI output includes actionable artifacts for failures.

### AI Prompt (Execution-Ready)
```text
Add full Stage 6 automated coverage and closeout runbooks.
Map tests directly to Stage 6 acceptance criteria and ensure rollback/observability procedures are validated in non-production.
```

---

## Story Dependency Map

- `S6-01` -> `S6-02`.
- `S6-03` can run in parallel with `S6-01`/`S6-02`.
- `S6-04` depends on event/status availability from `S6-01`/`S6-02`.
- `S6-05` -> `S6-06`.
- `S6-07` follows core event and perf outputs from `S6-02`, `S6-03`, and `S6-06`.
- `S6-08` is the final quality and rollout gate.

## Stage 6 Definition of Done (Backlog-Level)

- Automated 7-day raw artifact cleanup is active and auditable.
- Failed job and policy rejection visibility is available in history/audit surfaces.
- p95 performance checks pass for core scenarios and are captured by repeatable benchmarks.
- Audit export and retention telemetry are tenant-safe and operationally monitored.
