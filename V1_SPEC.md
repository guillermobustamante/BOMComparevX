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
11. Sharing via invite with authentication requirement
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

1. Graph model: Azure SQL Graph-capable model in Phase 1.
2. Excel export fidelity: preserve structure/order and mapped columns; full style/formula fidelity is best-effort, not guaranteed.
3. Retention: raw engineering files deleted at day 7; metadata/results/audits retained per policy.
4. Multi-version behavior: newest upload compares against immediately previous revision in same session.
5. Upload policy: 48-hour default with admin override/reset.
6. Notifications default: in-app required; email enabled by tenant/platform configuration.
7. Persistence layer uses Azure SQL with Prisma-managed SQL migrations.
8. Physical table naming convention is camelCase.

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

### FR-009 Revision Chain in Session
- User can upload additional files after first comparison.
- System creates a new revision.
- Comparison is against immediately previous revision in same session.
- History reflects version chain chronology.

### FR-010 Export
- Export available for:
  - Comparison diff CSV
  - Version-level CSV where applicable
  - Excel-compatible output preserving mapped structure

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
- Owner can share specific comparison by inviting email.
- Recipient must authenticate.
- Access restricted to invited identity.
- Share has no expiry by default.
- Owner can revoke share at any time.

### FR-013 Notifications
- In-app notification generated when processing completes/fails.
- Notification links to corresponding session result.
- Email notification configurable and supported when enabled.

### FR-014 Administration
- Admin can:
  - view user list
  - reset upload cooldown
  - apply per-user policy overrides
- Admin actions are audit logged.

### FR-015 Data Retention
- STEP/STP raw files deleted automatically at 7 days.
- Derived results and metadata persist until user deletion or policy action.

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

### NFR-SCALE
- Phase 1 supports 2 concurrent uploads with queueing for overflow.
- Architecture supports staged scale path to 10 then 50+ concurrent uploads.

### NFR-RELIABILITY
- Retry strategy for transient worker failures.
- Dead-letter handling for repeated failures.
- Failed jobs surface clear status and reason in history.

### NFR-SECURITY
- Tenant isolation across all data access paths.
- Auth required for all user data access.
- No public direct file access.

### NFR-AUDIT
- Audit logs for critical actions (share/revoke, admin overrides, policy changes).
- Detection mapping strategy and confidence events logged.
- Stage 4 operational metrics are emitted as structured events:
  - `stage4.diff.compute`, `stage4.diff.first_status`, `stage4.diff.first_rows`, `stage4.diff.completed`.

---

## 6. Data Entities (V1 Minimum)

- tenants
- users
- comparison_sessions
- bom_revisions
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
- CSV and Excel-compatible exports are downloadable.
- Owner can invite/revoke sharing access.
- Recipient authentication required for shared access.
- In-app completion notifications are delivered and deep-link correctly.
- Admin can reset/override upload limits.

### Stage 6 — Retention + Hardening
**Done when:**
- 7-day STEP/STP cleanup runs automatically.
- Failed jobs and policy rejections are visible in history/audit.
- p95 performance checks pass for core scenarios.

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

