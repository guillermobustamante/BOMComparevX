# Delta Review: `docs/PreviousDocs` vs Current Delivery (S1-S5)

Status: `Current`  
Scope: `Input for Sprint 6+ planning`

## Reviewed Sources
- `docs/PreviousDocs/User Stories - DevOps.xlsx`
- `docs/PreviousDocs/BOM Comparison Platform Solution Architecture.docx`
- `docs/PreviousDocs/BOM Comparison Platform Solution Architecture - BOMComparevX.docx`
- `docs/PreviousDocs/BOM Comparison Platform - Solution Architecture v1.1 (Ammendmnents).docx`
- `docs/PreviousDocs/BOM Comparison Platform - Solution Architecture v1.1 (Agentic Architecture Delta Addendum (Amendment 3)).docx`
- Current execution artifacts:
  - `BACKLOG_S1.md` through `BACKLOG_S5.md`
  - `BACKLOG_S2vDB.md`
  - `SPRINT_PLAN.md`
  - `PRODUCT_PLAN.md`
  - `V1_SPEC.md`
  - `V1_DECISIONS.md`

## Snapshot Summary
- Legacy workbook baseline:
  - `12` epics, `36` features, `37` user stories, `197` tasks.
  - All in `State = New`.
- Current delivery baseline:
  - `S1` through `S5` complete.
  - `S2vDB` persistence baseline complete.
  - Stage 5 closeout complete including retention baseline and runbooks.

## Epic-Level Delta (Legacy -> Current)
| Legacy Epic | Current Status | Evidence in Current Plan/Backlogs | Delta |
|---|---|---|---|
| 400 Authentication and Authorization | Closed | S1 complete | None |
| 415 File Upload and Validation | Closed | S2 complete (+ admin override in S5) | None |
| 438 Async Processing and Progress Feedback | Mostly closed | S2 queue/intake + S4 progressive results + S5 notifications | Queue-position detail and busy-mode UX can be hardened |
| 439 BOM Comparison and Matching | Partial | S3 detection/mapping + S4 deterministic diff | STEP/STP parse path and graph-backed matching not implemented |
| 440 Results Display and UI Interactions | Partial | S4 results filters/highlighting | Hierarchical/tree view not implemented |
| 441 Export (CSV + format-preserving Excel) | Closed | S5-01, S5-02, S5-02b complete | None |
| 442 History and Tagging | Partial | History route exists | History is placeholder; rename/tag/delete parity still open |
| 443 Sharing and Permissions | Closed | S5-03 to S5-05 complete | None |
| 444 Security and Tenant Isolation | Partial | Tenant isolation/auth complete; admin policy controls complete | Platform-level rate limiting and secure SDLC evidence still open |
| 445 Audit Logging and Compliance Foundations | Partial | Audit events exist across S1-S5 | Audit export + terms/privacy acknowledgment flow still open |
| 446 Observability and Operational Readiness | Partial | Stage 4/5 runbooks + telemetry hooks | Alert routing hardening and on-call drill evidence still open |
| 447 Backup and Disaster Recovery | Open | Not scheduled yet | Backup/restore/DR drill execution pending |

## Superseded Assumptions (Legacy -> Current)
- Legacy assumption (some prior architecture variants): Cosmos DB/Gremlin-backed graph traversal for BOM hierarchy.
- Current locked decision: Azure SQL Graph only for graph-aware hierarchy and matching paths.
- Replacement scope impact:
  - Stage 7 stories must use Azure SQL Graph-compatible schema/query patterns.
  - No Cosmos DB/Gremlin dependencies in Stage 7 implementation.
  - STEP/STP graph expansion remains deferred to Stage 10.

## Delta-Driven Sprint Sequencing

### Sprint 6 (Stage 6 in `PRODUCT_PLAN.md`)
Focus:
- Raw-file lifecycle cleanup automation
- Audit export contract
- Failed-job/policy visibility hardening
- p95 performance benchmarking/tuning
- retention/queue/latency observability hardening

### Sprint 7 (Suggested)
Focus:
- Security/compliance baseline closure:
  - API rate-limiting and abuse controls
  - terms/privacy consent tracking
  - secure SDLC evidence workflow (dependency/secret/policy gates)
  - history parity completion (rename/tag/delete)

### Sprint 8 (Suggested)
Focus:
- Reliability + DR readiness:
  - backup automation and retention policy validation
  - restore validation against RTO goals
  - on-call runbook drills and alert threshold calibration

### Sprint 9 (Recommended, post-V1 hardening)
Focus:
- Graph/hierarchy and PLM integration expansion:
  - tree/hierarchy result exploration
  - graph-backed BOM traversal optimization
  - PLM connector framework and sync boundaries

## Lessons Applied from S1-S5 Execution
1. Migration reliability must stay Prisma-compatible on SQL Server (avoid `GO` batch syntax).
2. Env/flag naming and runbook clarity reduce rollout friction.
3. Real user fixtures must remain in automated tests to prevent parser/diff regressions.
4. Feature-flagged rollout paths and explicit rollback runbooks should be part of each sprint closeout.
5. Admin/bootstrap flows need explicit non-test operational path documentation.

## Planning Impact
- `SPRINT_PLAN.md` now includes suggested Sprint 6.
- `PRODUCT_PLAN.md` now includes Stage/Sprint 7 and 8 (+ recommended Stage 9).
- This delta file should be used as the source input when building `BACKLOG_S6.md` and any subsequent backlog files.
