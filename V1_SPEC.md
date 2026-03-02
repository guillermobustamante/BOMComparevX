# BOMCompare — V1 Product Specification

Version: 1.0  
Status: Scope Locked for Phase 1 Build  
Source of Truth Inputs: `PRODUCT_PLAN.md`

---

## 1. Purpose

Define the exact V1 product behavior, acceptance criteria, and implementation boundaries required to ship a publicly launchable BOM comparison platform.

This specification converts planning intent into build-ready requirements.

---

## 2. V1 Scope Summary

V1 includes:
1. OAuth authentication (Google + Microsoft)
2. Tenant-scoped authorization
3. Two-file comparison upload workflow
4. Upload validation + policy checks
5. Queue-backed asynchronous processing with progress states
6. Results review UI with sort/filter/search/change-highlighting
7. Multi-pass column detection with user confirmation
8. Deterministic BOM matching + attribute-level diffing
9. CSV + Excel-compatible export
10. History management (reopen/rename/tags/delete)
11. Sharing via multi-recipient same-tenant invite with authentication requirement
12. Notifications (in-app; email optional by config)
13. Admin controls for upload policy override/reset
14. Raw STEP/STP deletion after 7 days
15. Immutable revision chain behavior (new file => new revision)

V1 excludes:
- PLM integrations
- Regulatory-grade cryptographic signatures/tamper-evidence
- Mandatory ML-assisted detection
- Multi-region active deployment

---

## 3. Product Decisions Locked for V1

1. Graph model: Azure SQL Graph only in Phase 1; Cosmos DB/Gremlin is out of scope.
2. Export contract is CSV plus Excel-compatible output; Excel preserves source structure (sheet layout, column order, headers, mapped custom columns), while style/formula fidelity remains best-effort.
3. Retention: raw engineering files deleted at day 7; metadata/results/audits retained per policy.
4. Multi-version behavior: newest upload compares against immediately previous revision in same session.
5. Upload policy: 48-hour default with admin override/reset.
6. Notifications default: in-app required; email enabled by tenant/platform configuration.
7. Persistence layer uses Azure SQL with Prisma-managed SQL migrations.
8. Physical table naming convention is camelCase.
9. Sharing in V1 is multi-recipient, same-tenant, view-only invite with explicit revoke.
10. Stage 5 admin source of truth is database role claim.
11. Stage 5 export mode is synchronous download; async/hybrid is deferred.
12. Stage 5 retention defaults:
   - export artifacts: 7 days
   - notifications: 90 days
   - share records until explicit revoke or owning session deletion
13. Stage 7 graph snapshot model is revision-scoped and immutable:
   - `PartNode` for canonical part identity nodes per revision
   - `ContainsEdge` for parent-child links per revision
14. Parent-context properties (`quantity`, `findNumber`, contextual position/path) are edge-level data on `ContainsEdge`.
15. Existing app contracts remain stable through compatibility projections for `bom_components` and `component_links` (views or mapped query layer).
16. Stage 7 hierarchy/tree payloads use deterministic recursive traversal (recursive CTE or equivalent SQL Graph traversal) with stable ordering.
17. Stage 7 comparisons bind to immutable `leftRevisionId` and `rightRevisionId` graph snapshots.
18. Stage 7 moved rule:
   - high-confidence identity + parent change => `moved`
   - identity ambiguous/unmatched => `added`/`removed`
   - `moved` rationale includes `fromParent` and `toParent`
   - `moved` + quantity delta keeps `changeType = moved` and includes quantity in `changedFields`
19. Stage 7 moved high-confidence threshold is `>=0.90`.
20. Stage 7 tree API uses dedicated endpoint: `GET /diff-jobs/{id}/tree?...` (node-focused payload).
21. Stage 7 fixture source-of-truth for deterministic and performance validation is `docs/BOM Examples` paired version files with header/hierarchy-column variance.
22. Stage 7 graph table physical names are camelCase: `partNode`, `containsEdge`.
23. Stage 7 cutover policy is new revisions only, no dual-write, automatic per-revision read-path selection.
24. Stage 7 observability sink is Application Insights with logs as backup.
25. Stage 7 flag source is env-based now, App Configuration later.
26. Stage 7 default flags:
   - Dev: all Stage 7 flags enabled
   - Test: all Stage 7 flags disabled initially
   - Prod: all Stage 7 flags disabled initially
27. Stage 7 SLO runtime telemetry is delivered behind metric flags and remains disabled initially.
28. Stage 7 alert thresholds are enforced only when corresponding runtime SLO metric flags are enabled.

---

## 4. Functional Requirements

### FR-001 Authentication
- Users can authenticate with Google OAuth.
- Users can authenticate with Microsoft OAuth.
- Authenticated users land on upload screen.

### FR-002 Authorization and Tenant Isolation
- Users can access only:
  - Their own sessions/files/results
  - Sessions explicitly shared with them
- Cross-tenant access is blocked at API and data query layers.

### FR-003 Upload Inputs and Limits
- Each comparison action requires exactly two files for first comparison.
- Supported upload modes: file picker, drag-and-drop, direct file link input.
- Max file size: 30 MB each.
- Allowed formats: STEP, STP, CSV, XLS, XLSX.
- Invalid size/type is rejected immediately with user-friendly error.

### FR-004 Upload Policy Enforcement
- Default user upload limit enforced at one comparison action every 48 hours.
- Dev/Test operational override: accounts listed in `UPLOAD_UNLIMITED_USER_EMAILS` bypass credits/cooldown limits.
- When blocked:
  - Upload controls disabled
  - Banner explains restriction
  - "More credits" link displayed
- Admin can reset or override limits per user.

### FR-005 Async Processing + Progress
- After validation, upload is accepted and queued.
- User can navigate away while job continues.
- Processing timeline shows states:
  - Uploading
  - Detecting
  - Matching
  - Diffing
  - Finalizing
- Percentage and current stage are visible.

### FR-006 Multi-Pass Column Detection
- Pass 1: Semantic registry matching (cross-industry + multilingual aliases).
- Pass 2: Heuristic fallback for unmapped columns.
- Pass 3: ML-assisted detection disabled by default in V1.
- Pass 4: User confirmation/edit in preview UI.
- Confidence gates are enforced:
  - `>=0.90`: auto-map
  - `0.70-0.89`: review-required in preview UI
  - `<0.70`: low-confidence warning; user may proceed after explicit confirmation
- Canonical mapping targets in V1:
  - Required: `part_number`, `description`, `quantity`
  - Conditional required: `revision` (optional when unavailable in source/domain)
  - Optional: `supplier`, `cost`, `lifecycle_status`, tenant custom attributes
- Confirmed mapping is saved immutably for that revision.
- Language metadata is stored in mapping records.

### FR-007 Deterministic Matching and Diffs
- Matching priority:
  1) internal ID
  2) part number + revision
  3) part number
  4) fuzzy match
  5) no match
- Deterministic tie-break order within each strategy:
  1) uniqueness first
  2) highest confidence/score
  3) attribute concordance (`description` -> `quantity` -> `supplier`)
  4) stable deterministic fallback (lowest target row index / stable UUID lexical order)
  5) near-tie ambiguity => `REVIEW_REQUIRED` (no silent auto-pick)
- One-to-one target lock: a matched target row cannot be reused in the same run.
- Comparison uses normalization-first canonicalization (case/whitespace, controlled punctuation, numeric normalization, UoM normalization where configured).
- Classification taxonomy for Stage 4:
  - `added`, `removed`, `replaced`, `modified`, `moved`, `quantity_change`, `no_change`
- Stage 4 baseline comparable attributes include:
  - `internal_id`, `part_number`, `revision`, `description`, `quantity`, `supplier`
  - business fields: `color`, `units`, `cost`, `category` (when present/mapped)
- Row-level and cell-level rationale metadata is captured for every non-`no_change` classification.
- Attribute-level differences are recorded and surfaced with provenance (strategy/tie-break/classification path).
- Stage 7 graph-aware contract (CSV/XLSX only):
  - authoritative per-revision immutable graph snapshot uses `PartNode`/`ContainsEdge`
  - compatibility projections preserve `bom_components`/`component_links` query contracts
  - tree traversal APIs use deterministic recursive CTE (or equivalent SQL Graph traversal) with stable ordering
  - comparisons reference `leftRevisionId` and `rightRevisionId` snapshots
  - moved classification uses parent-context delta with required rationale fields `fromParent` and `toParent`
  - no Cosmos DB/Gremlin dependencies
  - dedicated tree endpoint contract: `GET /diff-jobs/{id}/tree?...`
  - moved high-confidence threshold for parent-change classification is `>=0.90`
- Stage 7 format-scalability contract (Option B):
  - profile-adapter framework chooses ecosystem-specific occurrence identity logic with deterministic fallback
  - profile detection mode is auto-detect + confidence with optional operator override
  - matching uses contextual composite occurrence identity (`stableOccurrenceKey`) before generic/fuzzy fallback
  - immutable persistence identity uses `snapshotRowKey`
  - strict ambiguity gate prevents ambiguous identity from auto-classifying as `replaced`; user may proceed with explicit ambiguity state
  - `replaced` requires high-confidence context-aligned pairing
  - replacement confidence baseline starts at `>=0.90` and is tuned by telemetry/profile
  - effectivity/change-control fields are secondary identity context by default; profile can elevate to primary when needed
  - onboarding model is config-driven profile definitions with code hooks for advanced transforms
  - profile field policy distinguishes `identity`, `comparable`, and `display-only` fields
  - identical-file comparisons must converge to no-change-dominant output (no mass false replacements)

### FR-008 Results UI
- Result table supports:
  - Sort on all visible columns (default order remains uploaded-source order for latest upload)
  - Column filtering
  - Full-text search including part number
  - Change-type filters for Stage 4 taxonomy (combinable)
- Progressive Stage 4 job/result flow is supported:
  - `POST /diff-jobs` starts diff processing
  - `GET /diff-jobs/{id}` returns phase, percent complete, and counters
  - `GET /diff-jobs/{id}/rows?cursor=&limit=` returns stable progressive chunks
- Minimum partial payload includes:
  - `rowId`, `changeType`
  - key fields (`part_number`, `revision`, `description`)
  - per-cell diff summary for highlighted columns
- Partial-state behavior:
  - filters/search/sort apply to loaded rows immediately
  - partial indicator is shown until completion
  - row ordering does not jitter while loading
- Visual highlighting at row and cell level for changes; unchanged fields are not color-highlighted.
- Stage 4 rollout controls:
  - Backend flags: `DIFF_ENGINE_V1`, `DIFF_PROGRESSIVE_API_V1`
  - Frontend flag: `NEXT_PUBLIC_RESULTS_GRID_STAGE4_V1`
  - When disabled, APIs/UI return deterministic feature-disabled responses (no silent failure).
- Stage 7 dedicated hierarchy API contract:
  - `GET /diff-jobs/{id}/tree?cursor=&limit=&expandedNodeIds=`
  - request notes:
    - `cursor` and `limit` follow deterministic pagination rules
    - `expandedNodeIds` is optional and limits child expansion scope
  - response minimum:
    - `nodes[]` with `nodeId`, `parentNodeId`, `depth`, key fields (`part_number`, `revision`, `description`), `changeType`, `changedFields`
    - moved rationale fields where applicable: `fromParent`, `toParent`
    - pagination metadata: `nextCursor`, `hasMore`

### FR-009 Revision Chain in Session
- User can upload additional files after first comparison.
- System creates a new revision.
- Comparison is against immediately previous revision in same session.
- History reflects version chain chronology.

### FR-010 Export
- Export available for:
  - Comparison diff CSV
  - Version-level CSV where applicable
  - Excel-compatible output preserving source sheet layout, column order, headers, and mapped custom columns
- Export mode in V1 is synchronous download.
- Export default is full dataset (not current filtered/sorted view).

### FR-011 History and Management
- Every session stores:
  - upload date/time
  - file names
  - processing status
  - completion/failure state
- User can:
  - view past sessions
  - reopen result
  - rename session
  - apply/remove tags
  - delete session
- Deleting session removes access to associated results.

### FR-012 Sharing
- Owner can share specific comparison by inviting one or more emails in the same tenant.
- Recipient must authenticate.
- Access restricted to invited identity (exact invited email match).
- Invited users have view-only access.
- Invites may target unregistered emails; access is granted only after successful authentication as that invited identity.
- Share has no expiry by default.
- Owner can revoke share at any time.
- Revocation default is hard revoke on next authorized request.

### FR-013 Notifications
- In-app notification generated when processing completes/fails.
- Notification links to corresponding session result.
- Email notification configurable and supported when enabled.
- Stage 5 minimum triggers are comparison completion and failure only.

### FR-014 Administration
- Admin can:
  - view/search user list in admin UI
  - reset upload cooldown
  - apply per-user policy overrides
- Admin role authorization source in V1 is database role claim.
- Admin actions are audit logged.

### FR-015 Data Retention
- STEP/STP raw files deleted automatically at 7 days.
- Derived results and metadata persist until user deletion or policy action.
- Stage 5 retention defaults:
  - export artifacts deleted at 7 days
  - notifications retained for 90 days
  - share records retained until explicit revoke or owning session deletion

---

## 5. Non-Functional Requirements (V1)

### NFR-PERF
- p95 comparison latency:
  - <=5MB: 30s
  - 5–30MB: 90s
- Parsing performance targets for Stage 4:
  - 30MB Excel parse <10s
  - 30MB CSV parse <5s
- Initial result streaming available before full completion when feasible.
- Progressive UX targets for Stage 4:
  - first progress response <2s
  - first row chunk visible <5s
  - subsequent chunk cadence 1-3s when batch-ready
- UI interactions target <500ms.
- Page load target <3s under normal conditions.
- Stage 7 graph/tree performance targets:
  - tree expand/collapse <=200ms p95
  - any-column filter/sort/search (up to 5k rows) <=500ms p95
  - first hierarchy response <2s
  - first meaningful hierarchy rows <5s
  - graph-aware matching overhead <=15% versus Stage 4 baseline at same fixture tier
- Stage 7 CI performance gate policy:
  - first 3 performance runs are non-blocking
  - subsequent runs are blocking
- Performance measurement protocol for Stage 7:
  - CI benchmark suite is the gating source of truth
  - local benchmark harness is diagnostic and required for triage

### NFR-SCALE
- Phase 1 supports 2 concurrent uploads with queueing for overflow.
- Architecture supports staged scale path to 10 then 50+ concurrent uploads.

### NFR-RELIABILITY
- Retry strategy for transient worker failures.
- Dead-letter handling for repeated failures.
- Failed jobs surface clear status and reason in history.
- Stage 7 CI gate policy:
  - hard gate before merge
  - required checks: `backend:ci`, `frontend:ci`, `playwright`, `verify:story`
  - baseline branch is `main`
  - full CI on every PR
  - flaky-test quarantine requires owner + deadline

### NFR-SECURITY
- Tenant isolation across all data access paths.
- Auth required for all user data access.
- No public direct file access.

### NFR-AUDIT
- Audit logs for critical actions (share/revoke, admin overrides, policy changes).
- Detection mapping strategy and confidence events logged.
- Stage 4 operational metrics are emitted as structured events:
  - `stage4.diff.compute`, `stage4.diff.first_status`, `stage4.diff.first_rows`, `stage4.diff.completed`.
- Stage 7 correlation dimensions (minimum): `tenantId`, `comparisonId`, `revisionPair`, `flagState`, `correlationId`.
- Stage 7 runtime SLO telemetry flags (default `false` initially):
  - `OBS_S7_TREE_EXPAND_P95`
  - `OBS_S7_DYNAMIC_QUERY_P95`
  - `OBS_S7_FIRST_HIERARCHY_RESPONSE`
  - `OBS_S7_FIRST_MEANINGFUL_TREE_ROWS`
  - `OBS_S7_OVERHEAD_VS_S4`

---

## 6. Data Entities (V1 Minimum)

- tenants
- users
- comparison_sessions
- bom_revisions
- partNode (`PartNode`, revision-scoped canonical node model)
- containsEdge (`ContainsEdge`, revision-scoped parent-child edge model)
- bom_components
- component_links
- comparison_diffs
- bom_column_mappings
- column_detection_audits
- shares
- upload_policies
- upload_events
- job_runs
- notifications
- audit_logs

Compatibility note:
- `bom_components` and `component_links` remain valid app contracts and may be served via compatibility views or mapped query layer backed by `PartNode`/`ContainsEdge`.

---

## 7. API/Workflow Boundaries

### 7.1 Required API Domains
- auth
- upload intake
- policy validation
- job status/progress
- results retrieval/query
- exports
- sharing
- history management
- admin policy operations
- notifications

### 7.2 Worker Domains
- parser + normalization
- column detection + mapping persistence
- deterministic matcher + diff generator
- export artifact generation
- retention cleanup

---

## 8. Stage-by-Stage Acceptance Criteria

### Stage 1 — Foundation
**Done when:**
- User can authenticate via Google and Microsoft.
- Authenticated user lands on upload page.
- Unauthenticated access to protected pages is blocked.

### Stage 2 — Upload + Policy + Queue
**Done when:**
- Two-file upload works via picker and drag/drop.
- Invalid type/size is rejected immediately.
- 48-hour policy blocks uploads with clear banner and disabled controls.
- Accepted uploads enqueue processing job and create history entry.
- Job/history/policy state is durable in database-backed persistence.

### Stage 3 — Detection + Mapping
**Done when:**
- Multi-pass detection runs automatically.
- User sees confidence-based mapping preview and can edit mapping.
- Confirmed mapping is saved immutably and auditable.
- Detection decisions include strategy and confidence per mapped column.
- Low-confidence mappings show warning and require explicit proceed confirmation.

### Stage 4 — Diff Engine + Results
**Done when:**
- Deterministic matching runs with documented strategy order.
- Tie-break rules and one-to-one lock behavior are deterministic and test-covered.
- Results classify `added`, `removed`, `replaced`, `modified`, `moved`, `quantity_change`, and `no_change` correctly.
- Row/cell rationale metadata is persisted and queryable.
- Progressive job polling and cursor-based retrieval work with stable ordering.
- Search/sort/filter/change-type filters operate correctly.
- Row/cell-level visual highlighting renders consistently.

### Stage 5 — Export + Sharing + Notifications + Admin
**Done when:**
- CSV and Excel-compatible exports are downloadable as synchronous downloads.
- Excel export preserves source sheet layout/column order/headers/mapped custom columns (style/formulas best-effort).
- Export output is full dataset by default.
- Owner can invite/revoke multiple same-tenant sharing recipients.
- Recipient authentication required for shared access.
- Invited recipients are view-only and revoked access is denied on subsequent access check.
- In-app completion/failure notifications are delivered and deep-link correctly.
- Admin can reset/override upload limits.
- Admin actions are available through admin UI with database role claim enforcement.

### Stage 6 — Retention + Hardening
**Done when:**
- 7-day STEP/STP cleanup runs automatically.
- Failed jobs and policy rejections are visible in history/audit.
- p95 performance checks pass for core scenarios.

### Stage 7 — Advanced Matching + Results UX Closure
**Done when:**
- Revision-scoped immutable graph snapshots (`PartNode`/`ContainsEdge`) are persisted and used for hierarchy-aware comparisons.
- Comparison run contracts bind to `leftRevisionId` and `rightRevisionId` snapshot references.
- Existing `bom_components` and `component_links` app contracts remain compatible.
- Hierarchy tree APIs return deterministic ordering via recursive traversal.
- Moved classification includes `fromParent`/`toParent` rationale and keeps `moved` when quantity also changes (quantity listed in `changedFields`).
- Stage 7 performance targets pass:
  - tree expand/collapse <=200ms p95
  - any-column filter/sort/search <=500ms p95 for up to 5k rows
  - first hierarchy response <2s, first meaningful rows <5s
  - graph-aware matching overhead <=15% vs Stage 4 baseline.
- Stage 7 rollout and cutover behavior is validated:
  - new-revision-only graph writes to `partNode`/`containsEdge`
  - no dual-write
  - per-revision automatic graph/fallback read-path selection
  - dedicated tree endpoint contract is implemented and verified
  - flag defaults by environment are respected
  - runtime SLO telemetry flags exist and default to disabled
- Stage 7 format-scalability behavior is validated:
  - profile-adapter framework + deterministic generic fallback are active behind flags
  - contextual composite key matching reduces duplicate-heavy false replacement outcomes
  - strict ambiguity gate prevents broad unmatched-pair replacement artifacts
  - same-vs-same fixture comparisons converge to no-change-dominant results

### Stage 8 — Security + Compliance Baseline Closure
**Done when:**
- Rate limiting is active at gateway and app layers with baseline `100 req/min` and stricter limits on heavy endpoints.
- Authenticated requests are throttled by tenant key; unauthenticated requests fall back to IP keying.
- Terms and Privacy consent are versioned separately and acceptance records persist user + timestamp.
- Policy updates force re-acceptance at next login before app access continues.
- History parity is complete for rename/tag/delete with delete implemented as soft-delete + audit trail.
- Audit export governance is hardened on top of existing Stage 6 export services.
- Audit archives are produced daily as append-only artifacts in geo-redundant Blob storage with 7+ year target retention.
- Secure SDLC checks are blocking in CI for high/critical vulnerabilities, secrets, and license-policy violations.
- Compliance/admin access model remains database role-claim based and audited.

---

## 9. QA Test Matrix (Minimum)

1. Auth success/failure for both providers.
2. Cross-tenant access attempt denied.
3. Oversize and invalid file type rejection.
4. Cooldown blocked state rendering.
5. Queue + progress state transitions.
6. Detection preview edit + save mapping.
7. Confidence gate behavior (auto/review/low-confidence warning) across fixtures.
8. Match strategy fallback behavior on controlled fixture data.
9. Change filter combinations in results grid.
10. Export file generation + download integrity.
11. Share invite + authenticated access + revoke enforcement.
12. Session rename/tag/delete behavior.
13. Retention job deleting raw STEP/STP only.
14. Graph snapshot immutability per revision (`PartNode`/`ContainsEdge`) with `leftRevisionId`/`rightRevisionId` binding.
15. Compatibility projection behavior for `bom_components`/`component_links` queries.
16. Moved classification parent-change behavior with `fromParent`/`toParent` rationale.
17. Stage 7 hierarchy/tree performance targets and graph-aware overhead budget.
18. Stage 7 format-scalability assertions:
  - contextual composite key behavior across known and unknown profile adapters
  - strict ambiguity gating and replacement suppression on duplicate-heavy fixtures
  - same-vs-same fixture no-change convergence.

---

## 10. Launch Exit Criteria

V1 is launch-ready when all of the following are true:
- Stage 1–6 acceptance criteria pass.
- Critical severity defects are zero.
- Tenant isolation tests pass.
- Core p95 performance goals are met in pre-launch environment.
- Audit and retention behavior verified.
- Runbook exists for incident response and rollback.

---

## 11. Change Control

Any requirement that changes one of the following must be logged as a V1 scope change:
- upload policy
- matching strategy order
- retention semantics
- sharing access semantics
- export fidelity definition

