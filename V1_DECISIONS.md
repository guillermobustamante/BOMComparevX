# V1 Decisions (Locked)

Version: 1.3  
Status: Locked through Stage 5 planning

---

## Platform and Scope

1. Deployment target is Azure-managed infrastructure for Dev/Test/Prod.
2. Graph backend decision for V1 and Stage 7 is Azure SQL Graph only; Cosmos DB/Gremlin is out of scope.
3. V1 launch file format scope is CSV/Excel-centric for upload/detection paths.
4. Raw engineering files follow 7-day deletion; metadata/results/audits follow retention policy.

## Upload, Policy, and Notifications

5. Upload onboarding policy is: first 3 comparisons unrestricted, then 48-hour cooldown.
6. Admin override/reset of upload policy is enabled and audit logged.
7. Notifications baseline in V1 is in-app required; email is optional by tenant/platform configuration.
8. Sharing scope in V1 is multi-recipient invite by email with explicit revoke.

## Export and Revision Behavior

9. Export contract in V1 is CSV plus Excel-compatible output; Excel preserves source structure (sheet layout, column order, headers, mapped custom columns) with style/formula fidelity as best-effort.
10. Revision behavior is immutable: new upload creates a new revision, compared against immediately previous revision in-session.

## Stage 3 Detection and Mapping (Locked)

11. Multi-pass detection order is fixed:
   - Pass 1: semantic registry exact/fuzzy
   - Pass 2: heuristic fallback
   - Pass 3: ML-assisted disabled in V1
   - Pass 4: user confirmation/edit
12. Semantic registry supports cross-industry aliases (electronics/mechanical/aerospace/manufacturing).
13. Semantic registry supports multilingual aliases for EN/ES/DE/FR/JA/ZH and remains extensible.
14. Confidence gates for V1 detection are:
   - `>=0.90` auto-map (UI color code: Red)
   - `0.70-0.89` review-required (UI color code: Yellow)
   - `<0.70` low-confidence warning (UI color code: Red); user may proceed with warning
15. Canonical mapping fields for Stage 3:
   - Required: `part_number`, `description`, `quantity`
   - Conditional required: `revision` (optional when unavailable in source/domain)
   - Optional: `supplier`, `cost`, `lifecycle_status`, tenant custom attributes
16. Confirmed mapping is immutable per revision and auditable.
17. Mapping persistence entities for Stage 3:
   - `bom_column_mappings` (immutable snapshot)
   - `column_detection_audits` (strategy, confidence, user confirmation/correction)
18. Mapping reuse conflict rule is fresh detection first (saved mapping does not override current detection by default).
19. Mapping edit rights default is owner-only; admin override is available and audited.
20. Low-confidence mappings do not hard-block flow; user can proceed with warning.
21. Language detection metadata is persisted in mapping records; not required in audit records.
22. Persistence/migration tool for this environment is Prisma with SQL migrations against Azure SQL.
23. Physical table naming convention is camelCase.
24. `bom_column_mappings` and `column_detection_audits` are included in the persistence baseline now (not deferred).

## Stage 4 Diff and Results (Locked)

25. Deterministic matching strategy order is fixed:
   - `INTERNAL_ID`
   - `PART_NUMBER+REVISION`
   - `PART_NUMBER`
   - `FUZZY`
   - `NO_MATCH`
26. Deterministic tie-break inside each strategy is fixed:
   - uniqueness first
   - highest confidence/score
   - attribute concordance (`description` -> `quantity` -> `supplier`)
   - stable fallback (lowest target row index / stable UUID lexical order)
   - near-tie ambiguity is `REVIEW_REQUIRED` (no silent auto-pick)
27. One-to-one match lock is required: matched target rows cannot be reused in the same run.
28. Comparison is normalization-first with deterministic canonicalization:
   - case-fold text values
   - trim and single-space normalization
   - controlled punctuation normalization
   - numeric normalization (`1`, `1.0`, `01` policy)
   - UoM conversion where configured
29. Stage 4 classification taxonomy is fixed:
   - `added`
   - `removed`
   - `replaced`
   - `modified`
   - `moved`
   - `quantity_change`
   - `no_change`
30. Diff outcomes require row-level and cell-level rationale metadata for non-`no_change` rows.
31. Progressive delivery contract is locked to job polling + cursor chunking:
   - `POST /diff-jobs` to start
   - `GET /diff-jobs/{id}` for phase/percent/counters
   - `GET /diff-jobs/{id}/rows?cursor=&limit=` for progressive rows
32. Partial-results UX behavior is fixed:
   - filters/search/sort apply to loaded rows immediately
   - UI shows partial-state indicator until completion
   - stable row ordering is preserved while loading
33. Stage 4 filters are mandatory in results grid: change-type, text search, and column filters.
34. Stage 4 sort default is unchanged from uploaded source ordering (latest uploaded file basis).
35. Stage 4 out-of-scope lock: Stage 5 capabilities (exports/sharing/notifications/admin expansion) remain excluded.
36. Until full admin policy UI ships, Dev/Test supports ops-managed unlimited upload accounts through `UPLOAD_UNLIMITED_USER_EMAILS` (comma-separated allowlist), with backend-enforced bypass.
37. Stage 4 rollout controls are feature-flagged:
   - `DIFF_ENGINE_V1` (backend diff start)
   - `DIFF_PROGRESSIVE_API_V1` (backend status/rows API)
   - `NEXT_PUBLIC_RESULTS_GRID_STAGE4_V1` (frontend results UI)
38. Stage 4 operational metric names are standardized for rollout/perf monitoring:
   - `stage4.diff.compute`
   - `stage4.diff.first_status`
   - `stage4.diff.first_rows`
   - `stage4.diff.completed`

## Stage 5 Export, Sharing, Notifications, and Admin (Locked)

39. Sharing boundary for V1 is same-tenant only; cross-tenant sharing is excluded.
40. Invite flow allows inviting unregistered emails; access is granted only after authentication with the exact invited email.
41. Share permission model for V1 invitees is view-only.
42. Export mode in V1 is synchronous download only; async/hybrid export modes are deferred.
43. Export default scope is full dataset (not current filtered/sorted view).
44. Admin source of truth in V1 is database role claim (Entra group mapping deferred).
45. Stage 5 admin capability requires full admin UI for user search/list plus upload policy reset/override actions.
46. Retention defaults for Stage 5 artifacts are:
   - export artifacts: 7 days
   - notifications: 90 days
   - share records: retained until explicit revoke or owning session deletion
47. Revocation enforcement default is hard revoke on next authorized request (no new access after revoke).
48. Minimum notification triggers in Stage 5 are comparison completion and failure only.
49. Parked to V2/V3:
   - notification trigger expansion (share/export events)
   - notification reliability expansion (retry/backoff/dead-letter policy)
   - detailed compliance payload schema expansion for Stage 5 actions

## Stage 7 Graph Backend + Scope (Locked)

50. Stage 7 graph-aware matching scope is CSV/XLSX workflows only; STEP/STP remains deferred to Stage 10.
51. Stage 7 graph-aware query and traversal implementation must use Azure SQL Graph-compatible node/edge data and deterministic SQL query patterns.
52. Stage 7 deterministic graph-aware ranking extends existing strategy/tie-break invariants:
   - candidate precedence: same-parent exact identity before broader hierarchy candidates
   - deterministic ordering: score/confidence DESC, concordance DESC, target row index ASC, stable ID lexical ASC
   - near-tie ambiguity remains `REVIEW_REQUIRED` (no silent auto-pick)
53. Stage 7 non-goal lock: no Cosmos DB/Gremlin dependencies, models, or query paths.
54. Stage 7 SQL graph model is revision-scoped and immutable:
   - `PartNode` stores canonical part identity per `revisionId`
   - `ContainsEdge` stores parent-child links per `revisionId`
55. Parent-context attributes are stored on edges, not duplicated on canonical nodes:
   - `quantity`
   - `findNumber`
   - contextual position/path metadata
56. Compatibility projection is required for existing app contracts:
   - `bom_components` and `component_links` must be served through SQL views or mapped query layer backed by `PartNode`/`ContainsEdge`.
57. Tree rendering/read APIs use deterministic SQL traversal:
   - recursive CTE (or equivalent SQL Graph traversal)
   - stable ordering guarantees for repeatable tree payloads
58. Authoritative graph data is persisted as immutable snapshot per revision:
   - new upload creates a new revision graph snapshot
   - comparisons bind to `leftRevisionId` and `rightRevisionId` snapshots
   - ephemeral caches are optional and non-authoritative
59. Moved-classification rule for hierarchy-aware diffs:
   - classify as `moved` when part identity confidence is high and parent context changes
   - classify as `added`/`removed` when identity is ambiguous/unmatched
60. `moved` rationale must include `fromParent` and `toParent`; if quantity also changes, keep `changeType = moved` and include quantity in `changedFields`.
61. Stage 7 performance targets are locked:
   - tree expand/collapse <=200ms p95
   - any-column filter/sort/search (up to 5k rows) <=500ms p95
   - first hierarchy response <2s
   - first meaningful hierarchy rows <5s
   - graph-aware matching overhead <=15% vs Stage 4 baseline for same fixture tier
62. Stage 7 fixture source-of-truth is `docs/BOM Examples` using paired version files (for example, `Example 1 ver 1.xlsx` with `Example 1 ver 2.xlsx`), including header alias variance and hierarchy-level column variance.
63. Stage 7 CI gate is hard:
   - required checks: `backend:ci`, `frontend:ci`, `playwright`, `verify:story`
   - baseline branch: `main`
   - full CI on every PR
   - no merges while CI is red
   - flaky-test quarantine allowed only with explicit owner and deadline
64. Stage 7 performance gating rollout:
   - first 3 CI performance runs are non-blocking
   - from run 4 onward, performance gates are blocking
65. Stage 7 graph migration/cutover lock:
   - physical tables: `partNode`, `containsEdge` (camelCase)
   - cutover scope: new revisions only
   - dual-write: disabled
   - read path: automatic per revision (graph snapshot exists => graph path; otherwise fallback)
   - rollback strategy: feature-flag rollback only
   - old tables are read-only during transition and removed when cutover is stable
   - no historical backfill requirement for legacy dev data
66. Stage 7 snapshot completeness rule:
   - comparisons run on graph path only when both `leftRevisionId` and `rightRevisionId` have graph snapshots
   - otherwise use fallback path (while fallback remains enabled)
67. Stage 7 backfill execution plan:
   - environments: Dev and Test
   - execution mode: migration script
   - schema migration is required in Dev/Test; bulk historical data backfill is not required for legacy dev data
   - graph population applies to new revisions and explicit fixture sessions
68. Stage 7 feature flag source is env-based now (App Configuration later).
69. Stage 7 default flag states:
   - Dev: `MATCHER_GRAPH_V1=true`, `RESULTS_TREE_VIEW_V1=true`, `RESULTS_DYNAMIC_FILTERS_V1=true`
   - Test: all `false` initially
   - Prod: all `false` initially
70. Stage 7 rollout sequence is fixed: matcher -> tree -> dynamic filters.
71. Flag-off behavior is graceful fallback to Stage 4 baseline.
72. Stage 7 observability sink is Application Insights with logs as backup.
73. Stage 7 correlation dimensions include: `tenantId`, `comparisonId`, `revisionPair`, `flagState`, `correlationId` (and additional troubleshooting dimensions as required).
74. Stage 7 sampling policy: 100% in Dev/Test; sampled in Prod.
75. Stage 7 alert policy:
   - warning after 3 consecutive breaches
   - critical after 10 minutes sustained breach
   - operational response: manual rollback in Dev/Test; auto-rollback can be introduced later
76. Stage 7 moved high-confidence threshold is locked to `>=0.90` for moved eligibility.
77. Stage 7 tree API contract uses dedicated endpoint shape: `GET /diff-jobs/{id}/tree?...`.
78. Stage 7 SLO runtime telemetry policy:
   - SLO runtime metrics are not tracked initially
   - instrumentation is delivered behind metric flags, initially `false`
   - metric flags:
     - `OBS_S7_TREE_EXPAND_P95`
     - `OBS_S7_DYNAMIC_QUERY_P95`
     - `OBS_S7_FIRST_HIERARCHY_RESPONSE`
     - `OBS_S7_FIRST_MEANINGFUL_TREE_ROWS`
     - `OBS_S7_OVERHEAD_VS_S4`
79. Stage 7 alert thresholds apply only when corresponding SLO metric flags are enabled.

## Stage 7 Format Scalability + Composite Identity (Locked)

80. Stage 7 format-scalability implementation model is Option B:
   - profile-adapter framework + deterministic generic fallback.
81. Matching must use contextual composite occurrence identity, not part number alone, for duplicate-heavy BOM ecosystems.
82. Two key contracts are required:
   - `stableOccurrenceKey`: cross-revision deterministic occurrence identity for matching
   - `snapshotRowKey`: immutable per-snapshot persistence identity
83. Adapter precedence is deterministic:
   - explicit profile adapter (when profile confidence is sufficient)
   - deterministic generic adapter fallback
84. Strict ambiguity policy:
   - ambiguous identity does not auto-emit `replaced`
   - ambiguous rows remain unmatched/ambiguous until confidence policy allows deterministic classification.
85. `replaced` classification policy is hardened:
   - only emitted for high-confidence context-aligned source/target pairings
   - no broad unmatched-pair replacement sweep when identity ambiguity is present.
86. Field policy is profile-aware with three classes:
   - identity fields
   - comparable change fields
   - display-only fields
87. Default SAP field policy:
   - identity: component number + hierarchy/sequence context keys
   - comparable: plant, quantity, description, and other business deltas
88. Same-vs-same baseline quality rule:
   - comparing identical files must not produce mass false `replaced`; expected dominant outcome is `no_change`.
89. Observability metrics for this stream are mandatory:
   - key collision rate
   - ambiguity rate
   - unmatched rate
   - replacement suppression rate
90. Rollout for format-scalability stream is feature-flagged:
   - `MATCHER_PROFILE_ADAPTERS_V1`
   - `MATCHER_COMPOSITE_KEY_V1`
   - `MATCHER_AMBIGUITY_STRICT_V1`
91. Locked profile detection mode is auto-detect + confidence + deterministic generic fallback + optional operator override.
92. Locked ambiguity policy is explicit ambiguity state with proceed allowed; no forced replacement from ambiguity paths.
93. Locked effectivity/change-control policy is secondary identity context by default, with profile-level elevation to primary where required.
94. Locked profile onboarding model is config-driven definitions with code hooks for advanced transforms.
95. Locked replacement confidence baseline is `>=0.90` with telemetry/profile-based tuning.
96. Locked runtime rollout strategy is tenant/profile canary in Dev/Test, then staged Prod enablement.
97. Parked for future stage (V2/V3): adapter configuration screen for end users:
   - purpose: allow profile override, field-policy preview, and adapter debug visibility without code changes
   - option set:
     - A: read-only diagnostics panel
     - B: tenant-admin override controls (recommended future)
     - C: all-user override controls

## Stage 8 Security and Compliance Baseline (Locked)

98. Stage 8 rate limiting is enforced at both gateway and application layers.
99. Stage 8 rate-limit defaults:
   - baseline: 100 requests/minute
   - stricter caps apply to high-cost routes (upload/diff/export).
100. Stage 8 rate-limit key policy:
   - authenticated: tenant bucket (`tenantId`)
   - unauthenticated fallback: client IP.
101. Stage 8 rate-limit exemptions:
   - admin/service allowlist is supported
   - exemption events remain auditable.
102. Stage 8 consent versioning stores separate Terms and Privacy versions with per-user acceptance timestamp.
103. Stage 8 policy-update behavior is hard-block on next login until re-acceptance.
104. Stage 8 history delete semantics are soft-delete with audit event; retention/purge handles physical deletion later.
105. Stage 8 tag scope is single editable owner-private label (max 50 chars) for V1 baseline parity.
106. Stage 8 audit-export governance hardens existing Stage 6 export services; no service rebuild in Stage 8.
107. Stage 8 audit archive baseline:
   - daily append-only archive to Azure Blob
   - geo-redundant storage
   - retention target 7+ years.
108. Stage 8 secure SDLC CI policy is blocking:
   - fail on high/critical vulnerabilities
   - fail on secret-scanning hits
   - fail on license-policy violations.
109. Stage 8 compliance-role mapping uses existing database admin role-claim model.
