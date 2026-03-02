# BACKLOG_S7.md

## Sprint S7 Backlog (Ticket-Ready)

This backlog expands Sprint S7 (Stage 7 - Advanced Matching + Results UX Closure) from `SPRINT_PLAN.md` into execution-ready stories.

Format-scalability extension:
- `BACKLOG_S7_FORMATS.md` (S7F stream) is completed and locked for Option B.
- Remaining S7 execution must avoid re-implementing S7F scope; use S7F outputs as dependencies.

Source precedence:
- `SPRINT_PLAN.md` for approved Sprint S7 scope and ordering.
- `PRODUCT_PLAN.md` for Stage 7 priority and Stage 10 STEP/STP deferral.
- `V1_DECISIONS.md` for deterministic matching and taxonomy invariants.
- `V1_SPEC.md` for FR/NFR contracts that must remain valid.
- `docs/DELTA_PREVIOUSDOCS_DEVOPS.md` for Epic `439` and `440` gap closure.

## Delivery Guardrails (Stage 7)

1. Primary objective:
- Close open/partial legacy scope from Epic `439` (BOM Comparison and Matching) and Epic `440` (Results Display and UI Interactions).

2. STEP/STP boundary:
- STEP/STP parsing and STEP/STP-specific matching are explicitly out of scope.
- STEP/STP remains deferred to Stage 10.

3. Determinism must be preserved:
- Existing Stage 4 match order, tie-break semantics, one-to-one lock, and classification taxonomy cannot regress.
- Graph-aware enhancements must remain deterministic.

4. Contract safety:
- New result-query and hierarchy responses must preserve tenant/RBAC boundaries.
- Changes must be feature-flagged for controlled rollout.

5. Codex-first execution:
- Stories are shaped for AI Coding Agent implementation.
- Human product review checkpoint is required for hierarchy UX semantics and reasoning transparency.

6. Graph backend boundary:
- Stage 7 graph-aware features must use Azure SQL Graph-compatible schema/query patterns.
- No Cosmos DB/Gremlin.
7. Graph contract boundary:
- Revision-scoped graph snapshots are authoritative (`PartNode`, `ContainsEdge`).
- Compatibility contracts `bom_components` and `component_links` remain available via views or mapped query layer.
- Tree APIs use deterministic recursive traversal (recursive CTE or equivalent SQL Graph traversal) with stable ordering.
- Dedicated tree endpoint shape is required: `GET /diff-jobs/{id}/tree?...`.
- Physical graph tables are camelCase: `partNode`, `containsEdge`.
- Cutover policy is new revisions only, no dual-write, automatic per-revision read-path.
- Rollback policy is feature-flag rollback only.

8. CI gate policy:
- Required checks: `backend:ci`, `frontend:ci`, `playwright`, `verify:story`.
- Baseline branch is `main`.
- Full CI runs on every PR.
- No merge while CI is red.
- Flaky-test quarantine requires explicit owner + deadline.

9. Overlap boundary with S7F stream:
- S7F owns adapter/composite-key/remediation scope (`S7F-01` to `S7F-06`).
- S7F owns adapter-quality metrics and adapter fixture automation (`S7F-07` to `S7F-09`).
- S7 core remaining stories (`S7-04` to `S7-08`) must focus on hierarchy/tree UX, graph-aware baseline closure, and Stage 7 rollout gates without duplicating S7F contracts.

---

## S7-01 Implement Graph-Aware Matching Enhancements for CSV/XLSX BOMs

### Story Metadata
- Story ID: `S7-01`
- Title: `Implement Graph-Aware Matching Enhancements for CSV/XLSX BOMs`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE)`
- Sprint: `S7`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-007`
- Stage acceptance link(s): `Sprint S7 objective in SPRINT_PLAN.md`
- Legacy traceability: `US-486` (DevOps workbook), Epic `439`
- Decision link(s): `V1_DECISIONS.md` items `2`, `25`, `26`, `27`

### Inputs
- Parsed and mapped BOM rows (CSV/XLSX pathways only).
- Hierarchy context fields (`parentPath`, `position`, assembly linkage metadata).
- Revision-scoped graph snapshot sources (`PartNode`, `ContainsEdge`) for both compared revisions.
- Fixture source for tests/benchmarks: paired files in `docs/BOM Examples` (ver1/ver2) including header alias variance and level-column variance.

### Outputs
- Deterministic graph-aware candidate ranking improvements integrated into matcher.
- Parent-change aware `moved` classification inputs for downstream diff rationale.

### Contract
- Existing strategy order remains valid.
- Graph/hierarchy context is additive as a deterministic ranking signal, not random fallback.
- Rationale output includes hierarchy/graph reasoning token where used.
- Graph-aware lookup/ranking queries must run against Azure SQL Graph-compatible node/edge schema and deterministic ordering rules.
- Canonical node identity is resolved through `PartNode`; parent-specific attributes (`quantity`, `findNumber`, context path) are sourced from `ContainsEdge`.
- If parent context changes with high-confidence identity, candidate is eligible for `moved`; identity-ambiguous cases remain `added`/`removed`.
- High-confidence threshold for moved eligibility is `>=0.90`.

### Constraints
- No regression in one-to-one lock behavior.
- No cross-tenant graph traversal.
- No STEP/STP parsing introduced.
- Non-goal: No Cosmos DB/Gremlin.

### Acceptance Criteria
1. Graph-aware logic improves ambiguous candidate resolution for hierarchy-heavy CSV/XLSX fixtures.
2. Repeated runs with identical inputs produce identical outputs.
3. Existing Stage 4 contract tests continue passing.
4. `moved` eligibility uses deterministic parent-context change logic; ambiguous identity never silently converts to `moved`.

### AI Prompt (Execution-Ready)
```text
Enhance matcher behavior with deterministic graph/hierarchy-aware signals for CSV/XLSX BOMs only.
Keep existing strategy order and tie-break contracts intact, add rationale tokens for graph-assisted decisions, and preserve one-to-one lock guarantees.
```

---

## S7-02 Persist Hierarchy-Aware Immutable Diff Snapshots

### Story Metadata
- Story ID: `S7-02`
- Title: `Persist Hierarchy-Aware Immutable Diff Snapshots`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE)`
- Sprint: `S7`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-007`, `NFR-AUDIT`
- Stage acceptance link(s): `Sprint S7 objective in SPRINT_PLAN.md`
- Legacy traceability: `US-487`, Epic `439`

### Inputs
- Computed diff rows with hierarchy context and rationale metadata.
- Session/revision/comparison identifiers.
- Immutable revision snapshot identifiers: `leftRevisionId`, `rightRevisionId`.

### Outputs
- Immutable persisted snapshot model for hierarchy-aware diff outputs.

### Contract
- Snapshot record includes:
  - `comparisonId`
  - `leftRevisionId`
  - `rightRevisionId`
  - `contractVersion`
  - hierarchy-aware row payload
  - rationale metadata
  - created timestamp
- Re-open/read paths reference immutable snapshot rather than mutable in-memory state.
- Snapshot hierarchy references and read-path reconstruction must remain Azure SQL Graph-compatible (node/edge identity + deterministic traversal ordering).
- Snapshot rationale for `moved` rows includes `fromParent` and `toParent`; quantity deltas remain in `changedFields` while `changeType` stays `moved`.
- Compatibility reads for existing app contracts (`bom_components`, `component_links`) remain functional via views/mapped query layer.
- Graph-path comparison is allowed only when both `leftRevisionId` and `rightRevisionId` snapshots exist.

### Constraints
- Append-only write model.
- No in-place mutation after finalization.
- Tenant-scoped retrieval only.
- Non-goal: No Cosmos DB/Gremlin.
- Cutover is new revisions only; no dual-write permitted.
- Old legacy tables remain read-only during transition.

### Acceptance Criteria
1. Hierarchy-aware diff outputs are durably persisted as immutable snapshots.
2. Re-opened results reproduce identical payloads.
3. Snapshot writes/reads are fully tenant-safe.
4. Comparison payload reproducibility is guaranteed from `leftRevisionId`/`rightRevisionId` snapshots without mutable graph side effects.

### AI Prompt (Execution-Ready)
```text
Add immutable persistence for hierarchy-aware diff snapshots.
Store full rationale payloads, keep append-only semantics, and ensure reopened comparisons return reproducible outputs.
```

---

## S7-03 Expand Result Query Contract to Any-Column Filter/Sort/Search

### Story Metadata
- Story ID: `S7-03`
- Title: `Expand Result Query Contract to Any-Column Filter/Sort/Search`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `AI Coding Agent (BE/FE)`
- Sprint: `S7`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-008`
- Stage acceptance link(s): `Sprint S7 objective in SPRINT_PLAN.md`
- Legacy traceability: `US-488`, Epic `440`

### Inputs
- Result rows with canonical and custom fields.
- UI filter/sort query parameters.

### Outputs
- Extended query API and UI binding supporting dynamic column operations.

### Contract
- Extend rows endpoint query schema with deterministic filter/sort descriptors.
- Validate supported field names and operators.
- Preserve stable ordering and cursor consistency.

### Constraints
- Filter/sort operations must not break progressive loading semantics.
- Unsupported filter keys return deterministic validation errors.

### Acceptance Criteria
1. Users can filter/sort/search on canonical and mapped custom columns.
2. API contract validates and enforces deterministic query behavior.
3. Cursor pagination remains stable under active filter/sort state.

### AI Prompt (Execution-Ready)
```text
Extend results query and UI bindings to support dynamic any-column filter/sort/search.
Keep cursor pagination stable and deterministic, and validate query schema with explicit error responses.
```

---

## S7-04 Build Hierarchy/Tree Results View

### Story Metadata
- Story ID: `S7-04`
- Title: `Build Hierarchy/Tree Results View`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (FE)`
- Sprint: `S7`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-008`
- Stage acceptance link(s): `Sprint S7 objective in SPRINT_PLAN.md`
- Legacy traceability: `US-491`, Epic `440`

### Inputs
- Hierarchy-aware diff payload (parent-child linkage + change metadata).

### Outputs
- Tree-based results UI with expand/collapse and change markers.

### Contract
- Tree nodes display:
  - part identifier
  - change type badge
  - critical changed fields summary
- Supports progressive expansion without reordering existing nodes.
- For `moved` rows, UI can render parent-context rationale (`fromParent` -> `toParent`) when present.
- API contract for hierarchy loading uses dedicated endpoint `GET /diff-jobs/{id}/tree?...` with deterministic recursive traversal ordering from backend (recursive CTE or equivalent SQL Graph traversal).
- Tree endpoint minimum schema:
  - request query: `cursor`, `limit`, optional `expandedNodeIds`
  - response fields: `nodes[]` (`nodeId`, `parentNodeId`, `depth`, key fields, `changeType`, `changedFields`, optional `fromParent`/`toParent`), `nextCursor`, `hasMore`

### Constraints
- Must remain responsive on large trees.
- Preserve accessibility keyboard navigation.
- Do not remove existing flat-grid mode.
- Non-goal: No Cosmos DB/Gremlin.

### Acceptance Criteria
1. User can switch between flat and hierarchy views.
2. Tree view renders deterministic parent-child structure and change badges.
3. Expand/collapse state behaves consistently while new rows stream.

### AI Prompt (Execution-Ready)
```text
Implement a hierarchy/tree results view on top of hierarchy-aware diff payloads.
Support expand/collapse, deterministic node ordering, and visible change badges, while preserving existing flat-grid functionality.
```

---

## S7-05 Harden Result-State UX for Large Hierarchical Comparisons

### Story Metadata
- Story ID: `S7-05`
- Title: `Harden Result-State UX for Large Hierarchical Comparisons`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (FE/BE)`
- Sprint: `S7`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-008`, `NFR-PERF`
- Stage acceptance link(s): `Sprint S7 objective in SPRINT_PLAN.md`
- Legacy traceability: Epic `440` delta

### Inputs
- Progressive status and chunk streams for larger comparisons.

### Outputs
- UX hardening for partial/final state clarity and non-jitter rendering.

### Contract
- Explicit state markers:
  - loading hierarchy
  - partial tree
  - complete tree
- Stable node/row identity keys across chunk loads.
- Stage 7 SLOs validated in story:
  - tree expand/collapse <=200ms p95
  - any-column filter/sort/search (up to 5k rows) <=500ms p95
  - first hierarchy response <2s
  - first meaningful hierarchy rows <5s
- Performance checks are non-blocking for first 3 CI runs, then blocking from run 4 onward.
- Measurement protocol:
  - CI benchmark suite is the gating source of truth
  - local benchmark harness is diagnostic for investigation and tuning

### Constraints
- No UI jitter from re-sorting already rendered nodes.
- Preserve responsiveness target for interactions.
- Non-goal: No Cosmos DB/Gremlin.

### Acceptance Criteria
1. Partial-state and completion-state messaging is clear for hierarchy mode.
2. Large result sets remain usable without visual instability.
3. Existing Stage 4 partial/final behavior remains valid.
4. Stage 7 tree/query SLOs are measured and met for locked fixtures.

### AI Prompt (Execution-Ready)
```text
Harden large-comparison results UX for hierarchy mode.
Preserve stable rendering and clear partial/final state indicators while keeping progressive loading behavior deterministic.
```

---

## S7-06 Add Backend Integration/E2E Coverage for Graph-Aware Matching

### Story Metadata
- Story ID: `S7-06`
- Title: `Add Backend Integration/E2E Coverage for Graph-Aware Matching`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (QA/BE)`
- Sprint: `S7`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-007`, `NFR-AUDIT`
- Stage acceptance link(s): `Sprint S7 objective in SPRINT_PLAN.md`

### Inputs
- Controlled hierarchy fixtures for CSV/XLSX.
- Existing backend e2e suite.

### Outputs
- Test coverage proving graph-aware matching correctness and determinism.

### Contract
- Tests must assert:
  - deterministic outputs on repeated runs
  - rationale includes hierarchy/graph reasoning fields
  - one-to-one lock and taxonomy integrity remain intact
  - `moved` cases include `fromParent`/`toParent` and preserve `changeType = moved` with quantity in `changedFields` when applicable
  - graph-aware matching overhead stays <=15% vs Stage 4 baseline on same fixture tier
- Uses locked fixtures from `docs/BOM Examples` transformed to deterministic test assets.
- Non-overlap rule:
  - do not duplicate adapter-specific same-vs-same remediation assertions already covered by `S7F-08` and `S7F-09`
  - focus this story on Stage 7 graph-aware baseline, hierarchy snapshot reproducibility, and moved-parent rationale assertions.

### Constraints
- No flaky tests.
- Fixture data remains version-locked.
- Non-goal: No Cosmos DB/Gremlin.
- Quarantine is allowed only with owner + deadline.

### Acceptance Criteria
1. Graph-aware matching behavior is covered by integration/e2e tests.
2. Determinism assertions are explicit.
3. Regressions fail with actionable diagnostics.
4. Performance regression test asserts overhead budget (`<=15%`) relative to Stage 4 baseline.

### AI Prompt (Execution-Ready)
```text
Add backend integration/e2e tests for graph-aware matching and hierarchy-aware immutable diff snapshots.
Assert deterministic outputs, one-to-one lock integrity, and rationale-field completeness.
```

---

## S7-07 Add Playwright Coverage for Tree View + Dynamic Filters

### Story Metadata
- Story ID: `S7-07`
- Title: `Add Playwright Coverage for Tree View + Dynamic Filters`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (QA/FE)`
- Sprint: `S7`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-008`, `NFR-PERF`
- Stage acceptance link(s): `Sprint S7 objective in SPRINT_PLAN.md`

### Inputs
- Stage 7 results UI and API contracts.

### Outputs
- Browser automation for hierarchy mode and dynamic column operations.

### Contract
- Playwright scenarios include:
  - toggle flat/tree mode
  - expand/collapse behavior
  - any-column filter/sort/search
  - partial-to-complete state handling
- Non-overlap rule:
  - adapter-profile regression scenarios remain owned by `S7F-09`
  - this story covers tree-mode UX and dynamic filter interactions for Stage 7 core contracts.

### Constraints
- Tests must remain deterministic with seeded fixtures.
- Runtime should fit existing CI budgets.
- Non-goal: No Cosmos DB/Gremlin.

### Acceptance Criteria
1. Critical Stage 7 UI paths are covered by Playwright.
2. Tree and dynamic filter interactions are validated end-to-end.
3. CI produces clear failure artifacts/screenshots.

### AI Prompt (Execution-Ready)
```text
Implement Playwright tests for hierarchy tree results and dynamic column filtering/sorting/search.
Cover partial-to-complete loading behavior and keep scenarios deterministic with fixed fixtures.
```

---

## S7-08 Add Stage 7 Rollout Flags + Observability Counters

### Story Metadata
- Story ID: `S7-08`
- Title: `Add Stage 7 Rollout Flags + Observability Counters`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (BE/DevOps)`
- Sprint: `S7`
- Status: `Completed`

### Traceability
- Requirement link(s): `NFR-RELIABILITY`, `NFR-AUDIT`
- Stage acceptance link(s): `Sprint S7 objective in SPRINT_PLAN.md`

### Inputs
- Stage 7 matcher + UI outputs.
- Existing Stage 4/5 observability patterns.

### Outputs
- Feature flags and metric/audit counters for controlled release.

### Contract
- Feature flags:
  - `MATCHER_GRAPH_V1`
  - `RESULTS_TREE_VIEW_V1`
  - `RESULTS_DYNAMIC_FILTERS_V1`
- Metrics/events:
  - graph-aware match utilization
  - tree-view load timing
  - dynamic-filter query failure rates
- Observability for graph-aware matcher must cover Azure SQL Graph query path success/failure and latency buckets.
- S7 runtime SLO metric instrumentation must exist behind flags:
  - tree expand/collapse p95
  - any-column filter/sort/search p95 at 5k-row fixture tier
  - first hierarchy response latency
  - first meaningful hierarchy rows latency
  - graph-aware overhead percent vs Stage 4 baseline
- Flag source is env-based now (App Configuration later).
- Default states:
  - Dev: all Stage 7 flags `true`
  - Test: all Stage 7 flags `false` initially
  - Prod: all Stage 7 flags `false` initially
- Runtime SLO metric flags (initially all `false`):
  - `OBS_S7_TREE_EXPAND_P95`
  - `OBS_S7_DYNAMIC_QUERY_P95`
  - `OBS_S7_FIRST_HIERARCHY_RESPONSE`
  - `OBS_S7_FIRST_MEANINGFUL_TREE_ROWS`
  - `OBS_S7_OVERHEAD_VS_S4`
- Rollout order is fixed: matcher -> tree -> dynamic filters.
- Flag-off behavior is graceful fallback to Stage 4 baseline.
- Telemetry sink is Application Insights with logs backup.
- Correlation dimensions minimum: `tenantId`, `comparisonId`, `revisionPair`, `flagState`, `correlationId`.
- Sampling policy: 100% in Dev/Test, sampled in Prod.
- Alert policy: warn after 3 consecutive breaches; critical after 10 minutes sustained.
- Alert thresholds apply when corresponding runtime SLO metric flags are enabled.
- Non-overlap rule:
  - adapter-quality metrics (`key collision`, `ambiguity rate`, `replacement suppression`, `profile distribution`) remain owned by `S7F-07`
  - this story adds Stage 7 core matcher/tree/filter rollout metrics and SLO instrumentation.

### Constraints
- Flag-off behavior must degrade safely with deterministic responses.
- Metrics must avoid PII leakage.
- Non-goal: No Cosmos DB/Gremlin.

### Acceptance Criteria
1. Stage 7 behavior can be rolled out/rolled back by flags.
2. Operational counters exist for new matcher/tree/filter paths.
3. Runbook updates document rollout and rollback checks.
4. Runtime SLO metric flags exist and default to disabled.

### AI Prompt (Execution-Ready)
```text
Add feature-flag controls and observability counters for Stage 7 matcher and results UI enhancements.
Ensure safe flag-off degradation and update rollout/rollback runbooks with concrete checks.
```

---

## Story Dependency Map

- `S7-01` -> `S7-02`.
- `S7-03` and `S7-04` depend on data contracts from `S7-01`/`S7-02`.
- `S7-05` depends on baseline tree + dynamic filter implementation (`S7-03`, `S7-04`).
- `S7-06` and `S7-07` run after core implementation stories.
- `S7-08` is integrated as rollout/ops closeout after core behavior stabilizes.

## Stage 7 Definition of Done (Backlog-Level)

- Open/partial high-priority scope for Epic `439` and Epic `440` is closed for CSV/XLSX workflows.
- Graph-aware matching is deterministic and auditable.
- Results UX supports dynamic any-column operations and hierarchy/tree exploration.
- Stage 7 backend and browser automation are passing.
- STEP/STP remains explicitly deferred to Stage 10.
- Hard CI gate is passing on `main` baseline with required checks:
  - `backend:ci`, `frontend:ci`, `playwright`, `verify:story`
