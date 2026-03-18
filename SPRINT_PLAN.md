# SPRINT_PLAN.md

## Planning Assumptions
- Cadence: 2-week sprints
- Estimation unit: story points
- Environment sequence: Dev -> Test -> Prod
- Traceability rule: every committed item maps to one or more `FR-*` requirements and stage acceptance criteria in `V1_SPEC.md`

## Sprint S1 - Stage 1 Foundation

### Sprint Metadata
- Sprint: `S1`
- Stage: `Stage 1 - Foundation`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Planned`

### Sprint Goal
Deliver secure sign-in and baseline access control so authenticated users can reach the upload page and unauthorized access is blocked.

### Scope (Committed)
| ID | Work Item | Spec Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S1-01 | Implement Google OAuth login flow | `FR-001`; Stage 1 bullet 1 | 5 | BE | P0 |
| S1-02 | Implement Microsoft OAuth login flow | `FR-001`; Stage 1 bullet 1 | 5 | BE | P0 |
| S1-03 | Build post-auth redirect to upload page | `FR-001`; Stage 1 bullet 2 | 3 | FE | P0 |
| S1-04 | Add protected route middleware/guards | `FR-002`; Stage 1 bullet 3 | 5 | BE | P0 |
| S1-05 | Enforce tenant-scoped data access policy baseline | `FR-002`; QA matrix item 2 | 5 | BE | P0 |
| S1-06 | Create responsive app shell and authenticated layout | Product Plan Stage 1 | 3 | FE | P1 |
| S1-07 | Add auth/authorization audit events (login success/failure, denied access) | `NFR-SECURITY`, `NFR-AUDIT` | 3 | BE | P1 |
| S1-08 | Add automated tests for auth success/failure + protected route blocking | QA matrix item 1; Stage 1 bullets 1-3 | 5 | QA/BE | P0 |

### Non-Goals (Out of Scope)
- File upload UX and validations.
- Upload cooldown/credit policy enforcement.
- Queue/worker orchestration and progress timeline.

### Delivery Plan
- Week 1:
  - Complete OAuth providers (`S1-01`, `S1-02`).
  - Implement protected routes and redirect behavior (`S1-03`, `S1-04`).
- Week 2:
  - Finalize tenant isolation baseline (`S1-05`).
  - Complete shell polish + logging + tests (`S1-06`, `S1-07`, `S1-08`).

### Dependencies
- OAuth app registrations for Google and Microsoft.
- `S1-09` identity provider provisioning and secret management completed or in parallel.
- Tenant identity model available in persistence layer.
- Secrets/config management for provider credentials (Azure Key Vault per environment).

### Definition of Done (Sprint-Level)
- All Stage 1 acceptance bullets in `V1_SPEC.md` are demonstrably met.
- Automated test coverage exists for success/failure auth and route protection.
- Unauthorized cross-tenant access attempts are denied at API and query layers.
- Audit logs capture authentication and authorization events.

### QA Plan
- Test Google login success and denied/failed path.
- Test Microsoft login success and denied/failed path.
- Verify unauthenticated user cannot access protected routes directly.
- Verify authenticated user always lands on upload route after login.
- Validate cross-tenant API access attempt returns unauthorized/forbidden and no data.

### Risks and Mitigations
| Risk | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|
| OAuth callback/config mismatch | Auth blocked | Validate provider configs in Dev/Test early; keep fallback test accounts | BE | Login failures in first integration |
| Missing tenant filter in one endpoint | Data leakage risk | Require tenant filter checklist in PR review + integration test for denial path | BE Lead | Cross-tenant test failure |
| Session/cookie misconfiguration | Re-login loops | Standardize cookie/session settings across environments | BE | Redirect loop during QA |

### Demo Plan
- Demonstrate login with both providers.
- Show blocked access on protected route when signed out.
- Show signed-in landing on upload page.
- Show denied cross-tenant request behavior.

### Rollout Notes
- Feature flag: `auth_providers_v1`.
- Runbook check: provider keys/callback URLs per environment.
- Rollback: disable provider flags and fall back to maintenance login gate if needed.

---

## Sprint S2 - Stage 2 Upload + Policy + Queue

### Sprint Metadata
- Sprint: `S2`
- Stage: `Stage 2 - Upload + Policy + Queue`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Completed (including S2vDB persistence backfill)`

### Sprint Goal
Enable two-file upload with immediate validation, enforce upload policy (including onboarding credits), and enqueue accepted jobs with visible history creation.

### Scope (Committed)
| ID | Work Item | Spec Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S2-00 | Persist Stage 2 baseline in Azure SQL (Prisma migrations, camelCase tables, durable job/history/policy/audit, include mapping/audit entities) | `FR-005`; Stage 2 bullet 4; Data Entities section | 8 | BE/DBA | P0 |
| S2-01 | Build two-file upload UI (picker + drag/drop) | `FR-003`; Stage 2 bullet 1 | 5 | FE | P0 |
| S2-02 | Add server-side file validation (type/size) with immediate rejection UX | `FR-003`; Stage 2 bullet 2 | 5 | BE/FE | P0 |
| S2-03 | Implement onboarding policy: first 3 comparisons unrestricted | `V1_DECISIONS.md` item 3 | 3 | BE | P0 |
| S2-04 | Implement 48-hour cooldown after onboarding credits exhausted | `FR-004`; `V1_DECISIONS.md` item 3; Stage 2 bullet 3 | 5 | BE | P0 |
| S2-05 | Render blocked-state banner, disable upload controls, show "More credits" link | `FR-004`; Stage 2 bullet 3 | 3 | FE | P0 |
| S2-06 | Create async enqueue endpoint and persist job metadata | `FR-005`; Stage 2 bullet 4 | 5 | BE | P0 |
| S2-07 | Create history entry at accepted upload with status/timestamps | Stage 2 bullet 4; Product Plan history direction | 3 | BE | P1 |
| S2-08 | Integrate basic queue worker handshake (accepted -> queued state) | `FR-005`; Product Plan async-first principle | 5 | BE | P1 |
| S2-09 | Add upload/policy/queue tests (happy path + rejection paths) | QA matrix items 3-5 | 5 | QA/BE/FE | P0 |

### Non-Goals (Out of Scope)
- Column detection and mapping preview.
- Deterministic matching/diff classification.
- Export, sharing, notifications, and admin override UI beyond minimal policy hooks.

### Delivery Plan
- Week 1:
  - Upload UX and validation paths (`S2-01`, `S2-02`).
  - Policy logic for onboarding credits + cooldown (`S2-03`, `S2-04`).
- Week 2:
  - Blocked-state UI and queue/history integration (`S2-05` to `S2-08`).
  - Complete full regression and acceptance verification (`S2-09`).

### Dependencies
- Storage endpoint/container for temporary uploaded files.
- Queue infrastructure with retry/dead-letter baseline.
- Job/history persistence schema available.
- Azure SQL Dev connectivity and Key Vault secret contract configured.

### Definition of Done (Sprint-Level)
- All Stage 2 acceptance bullets in `V1_SPEC.md` are demonstrably met.
- Invalid file type/size is rejected with clear UX before queueing.
- Policy enforcement reflects onboarding credits then 48-hour cooldown.
- Accepted uploads create a queued job and a visible history record.

### QA Plan
- Validate two-file upload via picker and drag/drop.
- Validate each unsupported file type is rejected.
- Validate files >30MB are rejected.
- Validate first three comparisons are accepted without cooldown.
- Validate fourth attempt is blocked if within 48-hour window.
- Validate blocked banner + disabled controls + "More credits" link.
- Validate accepted upload creates queue job and history entry.

### Risks and Mitigations
| Risk | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|
| Client and server validation rules diverge | Inconsistent UX | Centralize validation constants and share contract tests | FE/BE | Mismatch in QA behavior |
| Cooldown logic edge cases (timezone/clock skew) | Wrong allow/deny decisions | Store policy timestamps in UTC and test boundary conditions | BE | Intermittent policy test failures |
| Queue acceptance without durable history write | Lost traceability | Transactional write pattern or outbox-style persistence | BE | Job exists without history row |
| Drag/drop browser variance | Upload friction | Cross-browser test matrix for supported browsers | QA | Browser-specific upload bugs |

### Demo Plan
- Show successful two-file upload using picker and drag/drop.
- Show immediate validation errors for invalid type/size.
- Show policy transition from free comparisons to cooldown blocked state.
- Show accepted upload appearing in queue and history.

### Rollout Notes
- Feature flags: `upload_v1`, `upload_policy_v1`, `queue_enqueue_v1`.
- Monitoring: upload rejection rate, queue enqueue success rate, policy block rate.
- Rollback: disable `upload_v1` and keep authenticated shell operational.

### Closeout Summary
- `S2-00` persistence backfill completed:
  - Azure SQL + Prisma migration baseline established.
  - Stage 2 job/history/policy flows are DB-backed with tenant-safe access patterns.
  - CI includes Prisma schema validation and durability checks.
- `S2-01` to `S2-09` completed and verified in `verify:story`.

---

## Sprint S3 - Stage 3 Detection + Mapping

### Sprint Metadata
- Sprint: `S3`
- Stage: `Stage 3 - Detection + Mapping`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Completed`

### Sprint Goal
Implement multi-pass column detection with semantic registry + heuristic fallback, enforce confidence-based review gates, and persist immutable/auditable mapping confirmations.

### Scope (Committed)
| ID | Work Item | Spec Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S3-01 | Define Canonical Mapping Contract + Confidence Model | `FR-006`; Stage 3 bullet 1 | 3 | BE/Architect | P0 |
| S3-02 | Build Semantic Registry Aliases Engine | `FR-006`; Stage 3 bullets 1-2 | 5 | BE/Data | P0 |
| S3-03 | Implement Pass-1 Registry Detection | `FR-006`; Stage 3 bullet 1 | 5 | BE | P0 |
| S3-04 | Implement Pass-2 Heuristic Fallback + Unresolved Handling | `FR-006`; Stage 3 bullets 1-2 | 5 | BE | P0 |
| S3-05 | Create Detection Preview API | `FR-006`; Stage 3 bullet 2 | 3 | BE | P0 |
| S3-06 | Build Mapping Preview/Edit UI with Confidence Gates | `FR-006`; Stage 3 bullet 2 | 5 | FE | P0 |
| S3-07 | Persist Immutable Mapping Snapshot per Revision | `FR-006`; Stage 3 bullet 3 | 5 | BE | P0 |
| S3-08 | Add Detection and Manual-Mapping Audit Trail | `FR-006`; `NFR-AUDIT`; Stage 3 bullet 3 | 3 | BE | P0 |
| S3-09 | Add Stage 3 Automated Tests (Backend + Browser) | QA matrix items 6-7 | 5 | QA/BE/FE | P0 |

### Non-Goals (Out of Scope)
- Deterministic diff classification and result grid behavior (Stage 4).
- Export formatting behavior beyond mapping compatibility contracts (Stage 5).
- ML-assisted mapping in runtime flow (disabled in V1).

### Delivery Plan
- Week 1:
  - Detection contract + registry/fallback implementation (`S3-01` to `S3-04`).
  - Detection preview API (`S3-05`).
- Week 2:
  - Preview/edit UI + immutable persistence + audits (`S3-06` to `S3-08`).
  - Full acceptance test pass (`S3-09`).

### Dependencies
- Stage 2 upload/intake flow stable in Dev/Test.
- Revision identifiers and tenant context available at detection time.
- Storage/schema readiness for `bom_column_mappings` and `column_detection_audits`.

### Definition of Done (Sprint-Level)
- All Stage 3 acceptance bullets in `V1_SPEC.md` are demonstrably met.
- Confidence gate behaviors are enforced (`auto`, `review-required`, `low-confidence warning + explicit proceed`).
- Mapping confirmation is immutable per revision.
- Detection and manual corrections are audit logged with strategy/confidence metadata.

### QA Plan
- Validate registry matches multilingual/industry aliases.
- Validate heuristic fallback behavior for unmapped headers.
- Validate confidence gates route to auto/review/warning states correctly.
- Validate preview UI edit/confirm flow with sample rows.
- Validate immutable mapping snapshot persistence and audit entries.
- Validate owner-only mapping edit permissions and audited admin override behavior.

### Risks and Mitigations
| Risk | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|
| Alias collisions across domains/languages | Wrong auto-mapping | Domain-weighted scoring + review-required band | BE/Data | Unexpected mappings in fixtures |
| Over-permissive confidence threshold | False positive mappings | Conservative thresholds + mandatory confirm for medium/low | BE | QA mismatch in detection |
| Warning-based proceed on low confidence | Incorrect downstream comparison | Persist warning state + make warning explicit and test decision path | FE/BE | High correction rate post-run |
| Mapping mutability regression | Audit/reproducibility loss | Append-only snapshot write pattern + immutability tests | BE | Re-opened mapping changes |
| Preview UX complexity | User errors and friction | Show sample rows, clear strategy labels, constrained controls | FE | High correction rate in QA |

### Demo Plan
- Show automatic mapping for known aliases.
- Show review-required and low-confidence warning cases.
- Show user correction and immutable confirmation.
- Show audit entries for both automatic and manual mapping events.

### Rollout Notes
- Feature flags: `detection_registry_v1`, `mapping_preview_v1`.
- Monitoring: detection confidence distribution, manual correction rate, unresolved column rate.
- Rollback: disable Stage 3 feature flags while preserving Stage 2 flows.

---

## Sprint S4 - Stage 4 Diff Engine + Progressive Results

### Sprint Metadata
- Sprint: `S4`
- Stage: `Stage 4 - Diff Engine + Progressive Results`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Completed`

### Sprint Goal
Deliver deterministic BOM diffing with fixed tie-break behavior, normalization-first comparison, full change taxonomy classification, rationale metadata, and progressive results UX.

### Scope (Committed)
| ID | Work Item | Spec Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S4-01 | Define Deterministic Matching Contract + Tie-Break Policy | `FR-007`; Stage 4 bullet 1 | 3 | BE/Architect | P0 |
| S4-02 | Implement Multi-Pass Matcher Engine (One-to-One Lock) | `FR-007`; Stage 4 bullet 1 | 5 | BE | P0 |
| S4-03 | Implement Change Classification Taxonomy | `FR-007`; Stage 4 bullet 2 | 5 | BE/Product | P0 |
| S4-04 | Build Normalization Rules Engine for Comparison | `FR-007`; Stage 4 bullets 1-2 | 3 | BE/Data | P0 |
| S4-05 | Implement Diff Computation + Rationale/Audit Metadata | `FR-007`, `NFR-AUDIT`; Stage 4 bullets 2 and 4 | 5 | BE | P0 |
| S4-06 | Create Progressive Diff Job API (Polling + Cursor Chunks) | `FR-008`; Stage 4 bullets 2-3 | 5 | BE | P0 |
| S4-07 | Build Results Grid UI (Partial + Final States) | `FR-008`; Stage 4 bullets 3-4 | 5 | FE | P0 |
| S4-08 | Performance and Scalability Hardening for Diff Workloads | `NFR-PERF`; Stage 4 bullets 2-4 | 3 | BE/FE | P0 |
| S4-09 | Add Stage 4 Automated Tests (Backend + Browser) | QA matrix items 8-9; Stage 4 bullets 1-4 | 5 | QA/BE/FE | P0 |
| S4-10 | Rollout, Observability, and Risk Controls for Stage 4 | `NFR-OBS`, `NFR-AUDIT`; Stage 4 bullets 1-4 | 3 | BE/DevOps | P1 |

### Non-Goals (Out of Scope)
- Stage 5 capabilities: export expansion, sharing enhancements, notifications expansion, admin UI expansion.
- PLM integrations and ML-assisted matching behaviors.
- Regulatory hardening work beyond current V1 controls.

### Delivery Plan
- Week 1:
  - Lock contract + core engine behavior (`S4-01` to `S4-04`).
  - Start rationale persistence (`S4-05`) in parallel with API scaffolding (`S4-06`).
- Week 2:
  - Complete progressive API + results grid integration (`S4-06`, `S4-07`).
  - Execute performance hardening and full automation pass (`S4-08`, `S4-09`).
  - Finalize rollout controls and operational readiness (`S4-10`).

### Dependencies
- Stage 3 mapping confirmations available and immutable per revision.
- Queue/worker execution pipeline stable from Stage 2/3.
- Tenant/RBAC enforcement baseline already active in APIs and data access.
- Fixture catalog for deterministic matching and taxonomy edge-cases.

### Definition of Done (Sprint-Level)
- All Stage 4 acceptance bullets in `V1_SPEC.md` are demonstrably met.
- Matching hierarchy, tie-break semantics, and one-to-one lock are deterministic and test-covered.
- Classification taxonomy (`added`, `removed`, `replaced`, `modified`, `moved`, `quantity_change`, `no_change`) is implemented and surfaced.
- Row/cell rationale metadata is persisted and queryable.
- Progressive polling + cursor chunk UX behaves correctly for partial and final states.

### QA Plan
- Validate deterministic strategy order and tie-break behavior, including near-tie `REVIEW_REQUIRED`.
- Validate one-to-one target lock prevents duplicate target assignment.
- Validate taxonomy classification outputs on baseline and edge fixtures.
- Validate normalization rules for case, whitespace, punctuation, numeric representation, and UoM where configured.
- Validate progressive partial-state UX: status polling, chunk retrieval, stable ordering, and completion transition.
- Validate results grid mandatory filters: change-type, text search, and column filters.

### Risks and Mitigations
| Risk | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|
| Tie-break ambiguity leaks into silent auto-matches | Incorrect results trust | Enforce near-tie `REVIEW_REQUIRED` and add deterministic fixtures | BE | Mismatch in repeated runs |
| One-to-one lock gaps under concurrency | Duplicate target assignment | Central lock handling in matcher contract + concurrency tests | BE | Duplicate target IDs in output |
| Progressive chunks reorder rows | Confusing UX and incorrect filters | Cursor contract with stable ordering and retry-safe semantics | BE/FE | Row jitter during partial load |
| Rationale metadata missing/incomplete | Auditability loss | Required reason-code assertions in API and persistence tests | BE/QA | Changed row without reason codes |
| Performance degrades on large files | SLA misses | Batch tuning, DB/query profiling, and virtualization checks | BE/FE | Parse or interaction latency breach |

### Demo Plan
- Show deterministic matching across repeated runs with identical outputs.
- Show taxonomy coverage including replaced/moved/quantity-change examples.
- Show progressive load from partial to complete with stable row order.
- Show row/cell rationale metadata traceability in results.

### Rollout Notes
- Feature flags: `diff_engine_v1`, `diff_progressive_api_v1`, `results_grid_stage4_v1`.
- Monitoring: diff duration, ambiguity rate, chunk cadence, rationale completeness rate.
- Rollback: disable Stage 4 feature flags and keep Stage 3 outputs/history intact.
- Regression fixtures: `tests/fixtures/stage4/bill-of-materials.xlsx` and `tests/fixtures/stage4/bill-of-materialsv2.xlsx` are locked and must remain in CI.
- Pending execution runbooks:
  - `docs/runbooks/s4-08-performance-baseline.md`
  - `docs/runbooks/s4-10-rollout-observability.md`

---

## Sprint S5 - Stage 5 Export + Sharing + Notifications + Admin

### Sprint Metadata
- Sprint: `S5`
- Stage: `Stage 5 - Export + Sharing + Notifications + Admin`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Completed (S5-01 through S5-10 completed and verified)`

### Sprint Goal
Deliver production-ready Stage 5 capabilities for synchronous exports, multi-recipient same-tenant sharing with revoke, completion/failure notifications, and full admin UI policy controls.

### Scope (Committed)
| ID | Work Item | Spec Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S5-01 | Define/export API contract and implement synchronous CSV export (full dataset default) | `FR-010`; Stage 5 bullet 1 | 3 | BE | P0 |
| S5-02 | Implement Excel export with source-structure fidelity contract | `FR-010`; Stage 5 bullet 1 | 5 | BE | P0 |
| S5-02b | Add lightweight Results UI actions for CSV/Excel downloads bound to `comparisonId` | `FR-010`; Stage 5 bullet 1 | 2 | FE | P0 |
| S5-03 | Implement sharing data model and permissions for multi-recipient same-tenant view-only invites | `FR-012`; Stage 5 bullets 2-3 | 5 | BE | P0 |
| S5-04 | Implement share invite/revoke APIs with exact invited-email auth gate and unregistered invite handling | `FR-012`; Stage 5 bullets 2-3 | 5 | BE | P0 |
| S5-05 | Build sharing UI (multi-invite, recipient list, revoke controls, state feedback) | `FR-012`; Stage 5 bullets 2-3 | 5 | FE | P0 |
| S5-06 | Implement notifications baseline (comparison complete/fail) with in-app required and email optional by config | `FR-013`; Stage 5 bullet 4 | 5 | BE/FE | P0 |
| S5-07 | Build full admin UI for upload-policy reset/override with DB role-claim authorization | `FR-014`; Stage 5 bullet 5 | 5 | FE/BE | P0 |
| S5-08 | Implement Stage 5 artifact retention defaults (export 7d, notifications 90d, share lifecycle) | `FR-015`; Stage 5 bullets 1-5 | 3 | BE | P1 |
| S5-09 | Add Stage 5 automated tests (backend + browser) and CI coverage | QA matrix items 10-11; Stage 5 bullets 1-5 | 5 | QA/BE/FE | P0 |
| S5-10 | Stage 5 rollout, observability, and runbook closeout | `NFR-AUDIT`, `NFR-RELIABILITY`; Stage 5 bullets 1-5 | 3 | BE/DevOps | P1 |

### Non-Goals (Out of Scope)
- Async/hybrid export job architecture.
- Notification trigger expansion beyond comparison complete/fail.
- Notification retry/backoff/dead-letter hardening beyond baseline.
- Cross-tenant sharing and editor permissions for invitees.
- Entra-group admin-role authority (deferred beyond V1).

### Delivery Plan
- Week 1:
  - Lock export and sharing contracts (`S5-01` to `S5-04`).
  - Start sharing UI and notification baseline (`S5-05`, `S5-06`).
- Week 2:
  - Complete admin UI and retention defaults (`S5-07`, `S5-08`).
  - Finalize automation and rollout readiness (`S5-09`, `S5-10`).

### Dependencies
- Stable Stage 4 diff/result persistence and retrieval.
- Tenant/RBAC baseline from Stage 1.
- Durable DB baseline from `S2-00` / `S2vDB`.
- Email provider configuration available for environments that enable email notifications.

### Definition of Done (Sprint-Level)
- All Stage 5 acceptance bullets in `V1_SPEC.md` are demonstrably met.
- Export behavior is deterministic and contract-consistent across CSV and Excel.
- Sharing access controls enforce same-tenant, view-only, and revoke semantics.
- Admin UI policy actions are role-protected and audit logged.
- Stage 5 automation passes in CI with regression diagnostics.

### QA Plan
- Validate CSV and Excel download behavior and contract fidelity.
- Validate full-dataset export default (independent of active grid filters/sorts).
- Validate multi-invite share flow, exact-email auth gate, and revoke enforcement.
- Validate in-app completion/failure notifications and optional email behavior by config.
- Validate admin UI role gating, reset/override behavior, and audit traces.
- Validate Stage 5 retention policies for export artifacts and notifications.

### Risks and Mitigations
| Risk | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|
| Export fidelity drifts from uploaded structure | User trust erosion | Contract tests over fixture families and deterministic header/order assertions | BE/QA | Export mismatch defects |
| Share authorization gaps | Confidential data exposure | Same-tenant guard + exact email binding + revoke integration tests | BE | Unauthorized share access |
| Admin role misconfiguration | Over-privileged access | DB role-claim checks + denied-path tests + audit monitoring | BE | Non-admin admin-action success |
| Notification config ambiguity | Missing user signals | Explicit config matrix and fallback to in-app baseline | BE/FE | Environment-specific notification failures |

### Demo Plan
- Show CSV and Excel exports from a completed comparison.
- Show multi-recipient share invite and recipient access.
- Show revoke behavior and denied access after revocation.
- Show in-app completion/failure notification behavior.
- Show admin UI policy reset/override and associated audit log event.

### Rollout Notes
- Feature flags: `EXPORT_STAGE5_V1`, `SHARING_STAGE5_V1`, `NOTIFICATIONS_STAGE5_V1`, `ADMIN_POLICY_UI_STAGE5_V1`.
- Monitor: export success/failure, share invite/revoke events, admin override actions, notification delivery counts.
- Rollback: disable Stage 5 flags without impacting Stage 1-4 flows.
- Runbooks:
  - `docs/runbooks/s5-08-retention-baseline.md`
  - `docs/runbooks/s5-10-rollout-observability.md`

---

## Sprint S6 - Stage 6 Retention + Hardening

### Sprint Metadata
- Sprint: `S6`
- Stage: `Stage 6 - Retention + Hardening`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Suggested/Planned`

### Sprint Goal
Operationalize lifecycle retention and hardening controls: enforce raw-file cleanup, deliver audit export capabilities, and meet Stage 6 p95 performance targets with production-grade observability.

### Scope (Suggested)
| ID | Work Item | Spec Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S6-01 | Enforce automated 7-day raw engineering file cleanup (temporary upload/raw artifacts) | Stage 6 bullet 1; `FR-015` | 5 | BE/Platform | P0 |
| S6-02 | Add retention reconciliation + failure auditing for cleanup jobs | Stage 6 bullets 1-2; `NFR-AUDIT` | 3 | BE | P0 |
| S6-03 | Implement tenant-safe audit export API (CSV/JSON) with admin authorization | Product Plan Stage 6 (audit exports); `NFR-AUDIT` | 5 | BE | P0 |
| S6-04 | Surface failed jobs and policy rejections in history/audit views | Stage 6 bullet 2; `FR-011`, `NFR-OBS` | 3 | FE/BE | P1 |
| S6-05 | Establish Stage 6 performance benchmark harness (locked fixtures + p95 scorecard) | Stage 6 bullet 3; `NFR-PERF` | 3 | QA/BE | P0 |
| S6-06 | Tune parse/diff critical path to meet p95 targets for core scenarios | Stage 6 bullet 3; `NFR-PERF` | 5 | BE | P0 |
| S6-07 | Expand operational telemetry/alerts for retention, queue failures, and latency regressions | `NFR-OBS`, `NFR-RELIABILITY` | 3 | DevOps/BE | P1 |
| S6-08 | Add Stage 6 automated tests + rollout/rollback closeout runbook | Stage 6 bullets 1-3; QA matrix retention/perf additions | 5 | QA/BE/DevOps | P0 |

### Non-Goals (Out of Scope)
- Graph hierarchy view and graph-backed matching model evolution.
- PLM connector development.
- Disaster recovery/failover drills and RTO certification.

### Delivery Plan
- Week 1:
  - Lifecycle enforcement + audit export contract (`S6-01` to `S6-03`).
  - Begin history/audit surfacing (`S6-04`).
- Week 2:
  - Performance harness + tuning (`S6-05`, `S6-06`).
  - Observability hardening + Stage 6 closeout (`S6-07`, `S6-08`).

### Dependencies
- Stage 5 complete and stable (retention baseline, admin gates, notifications, exports).
- Blob/object storage metadata availability for raw-file lifecycle deletion.
- Monitoring/alert channel availability for Dev/Test/Prod.
- CI capacity for heavier performance and retention test suites.

### Definition of Done (Sprint-Level)
- Stage 6 acceptance criteria in `V1_SPEC.md` are met.
- 7-day raw engineering file cleanup runs automatically and is auditable.
- Failed jobs and policy rejections are visible in history/audit surfaces.
- p95 performance checks for core scenarios pass and are repeatable in CI/non-prod.

### QA Plan
- Validate automatic cleanup behavior and retention boundary conditions (UTC/time-window edges).
- Validate audit export correctness (tenant scope, format contract, authorization).
- Validate failed-job/policy rejection visibility in history/audit views.
- Validate p95 targets with locked fixtures and regression thresholds.

### Risks and Mitigations
| Risk | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|
| Raw-file cleanup deletes incorrect assets | Data loss | Marker-based eligibility + dry-run + audit trail before hard-delete | BE | Unexpected file deletion in Dev/Test |
| Audit export leaks cross-tenant records | Compliance/security breach | Tenant-scoped query guards + explicit admin auth + denied-path tests | BE | Cross-tenant export data in QA |
| Performance tuning regresses deterministic behavior | Data correctness risk | Keep deterministic fixture assertions as invariant CI gates | BE/QA | Mismatch between repeated diff runs |
| Alert noise/under-alerting | Slow incident response | Threshold tuning by environment + documented runbooks | DevOps | Missed or noisy alerts in Test |

### Rollout Notes
- Proposed feature flags: `RAW_FILE_RETENTION_V1`, `AUDIT_EXPORT_V1`, `PERF_HARDENING_V1`.
- Monitor: cleanup counts/failures, audit-export success/failure, diff p95 latency, queue dead-letter growth.
- Rollback: disable Stage 6 flags while preserving Stage 1-5 behavior.

---

## Sprint S7 - Stage 7 Advanced Matching + Results UX Closure

### Sprint Metadata
- Sprint: `S7`
- Stage: `Stage 7 - Advanced Matching + Results UX Closure`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Suggested/Planned (Priority after S6)`

### Sprint Goal
Close remaining high-priority scope from legacy Epic `439` and Epic `440` with Codex-first execution, excluding STEP/STP work.

### Scope (Suggested)
| ID | Work Item | Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S7-01 | Implement graph-aware matching enhancements for CSV/XLSX BOMs using revision-scoped Azure SQL Graph model (`PartNode`/`ContainsEdge`) with deterministic tie-break preservation | Legacy `US-486`; Stage 7 objective | 5 | AI Coding Agent (BE) | P0 |
| S7-02 | Persist hierarchy-aware immutable diff snapshots + rationale fields with `leftRevisionId`/`rightRevisionId` binding and compatibility projections (`bom_components`/`component_links`) | Legacy `US-487`; `NFR-AUDIT` | 5 | AI Coding Agent (BE) | P0 |
| S7-03 | Expand results query contract to support dynamic any-column filter/sort/search | Legacy `US-488`; Stage 7 objective | 3 | AI Coding Agent (BE/FE) | P0 |
| S7-04 | Build hierarchy/tree results view with expand/collapse, row-level change badges, and deterministic recursive traversal API contract | Legacy `US-491`; Stage 7 objective | 5 | AI Coding Agent (FE) | P0 |
| S7-05 | Add result-state UX hardening for large/hierarchical comparisons with S7 tree/query performance SLO validation | Legacy `US-440` delta | 3 | AI Coding Agent (FE/BE) | P1 |
| S7-06 | Add backend integration/e2e coverage for graph-aware matching, moved-parent rationale (`fromParent`/`toParent`), and immutable hierarchy snapshots | QA hardening | 5 | AI Coding Agent (QA/BE) | P0 |
| S7-07 | Add Playwright coverage for hierarchy view and dynamic filter/sort behaviors | QA hardening | 5 | AI Coding Agent (QA/FE) | P0 |
| S7-08 | Add Stage 7 rollout flags + observability counters for Azure SQL Graph matcher path, tree/query SLOs, and overhead budget tracking | `NFR-OBS`, `NFR-RELIABILITY` | 3 | AI Coding Agent (BE/DevOps) | P1 |

### Non-Goals (Out of Scope)
- STEP/STP parsing or STEP/STP-specific matching logic.
- PLM connector development.
- Cosmos DB/Gremlin dependencies, services, or query paths.

### S7 Guardrails (Locked)
- Graph-aware implementation in S7 must use Azure SQL Graph-compatible data/query patterns only.
- S7 stories must not introduce Cosmos DB/Gremlin packages, infrastructure, or runtime dependencies.
- Deterministic tie-break invariants from Stage 4 remain binding in all graph-aware paths.

### S7 Data/Query Contract (Locked)
- Revision-scoped SQL graph model:
  - `PartNode` (canonical part identity per revision)
  - `ContainsEdge` (parent-child edges per revision)
- Parent-context attributes (`quantity`, `findNumber`, context path) are edge-level fields on `ContainsEdge`.
- Existing contracts `bom_components` and `component_links` remain supported via compatibility views or mapped query layer.
- Tree APIs should use recursive CTE (or equivalent SQL Graph traversal) with deterministic ordering.
- Tree API shape is dedicated endpoint: `GET /diff-jobs/{id}/tree?...` with node-focused payload contract.
- Tree endpoint minimum payload contract:
  - request: `cursor`, `limit`, optional `expandedNodeIds`
  - response: `nodes[]` (`nodeId`, `parentNodeId`, `depth`, key fields, `changeType`, `changedFields`, optional `fromParent`/`toParent`), `nextCursor`, `hasMore`
- Comparison read paths bind to immutable `leftRevisionId` and `rightRevisionId` graph snapshots.
- `moved` classification requires parent-change rationale (`fromParent`, `toParent`) with moved eligibility threshold `>=0.90`; if quantity also changes, keep `moved` and include quantity in `changedFields`.
- Graph physical table names are camelCase: `partNode`, `containsEdge`.
- Cutover is new revisions only with no dual-write.
- Read-path rule is automatic per revision (graph snapshot exists => graph path; else fallback during transition).
- Snapshot completeness for graph-path comparisons requires both `leftRevisionId` and `rightRevisionId` snapshots.
- Existing legacy tables remain read-only during transition and are removed after stable cutover.
- Rollback strategy during transition is feature-flag rollback only.

### S7 Performance Targets (Locked)
- Keep core comparison p95 unchanged:
  - <=30s for <=5MB
  - <=90s for 5-30MB
- Stage 7 additions:
  - tree expand/collapse <=200ms p95
  - any-column filter/sort/search (up to 5k rows) <=500ms p95
  - first hierarchy response <2s
  - first meaningful hierarchy rows <5s
  - graph-aware matching overhead <=15% vs Stage 4 baseline for same fixture tier
- Performance gate treatment:
  - first 3 CI performance runs are non-blocking
  - from run 4 onward, checks are blocking
- Performance measurement protocol:
  - CI benchmark suite is the gating source of truth
  - local benchmark harness is diagnostic and required for triage

### AI Execution Prerequisites
- Locked matching contracts and deterministic fixture catalog available.
- Real-world CSV/XLSX hierarchy fixtures sourced from `docs/BOM Examples` paired-version files and checked into test assets.
- Browser + backend CI pipelines green before Story start.
- Human product checkpoint only for taxonomy/rationale UX acceptance.
- Hard CI gate policy:
  - required checks: `backend:ci`, `frontend:ci`, `playwright`, `verify:story`
  - authoritative baseline branch: `main`
  - full CI on every PR
  - flaky test quarantine only with explicit owner + deadline
  - no merge while CI is red

### Rollout Notes
- Proposed flags: `MATCHER_GRAPH_V1`, `RESULTS_TREE_VIEW_V1`, `RESULTS_DYNAMIC_FILTERS_V1`.
- STEP/STP remains deferred to Stage 10 by explicit planning decision.
- Flag source: env-based now; App Configuration later.
- Environment defaults:
  - Dev: all Stage 7 flags `true`
  - Test: all Stage 7 flags `false` initially
  - Prod: all Stage 7 flags `false` initially
- Rollout order: matcher -> tree -> dynamic filters.
- Flag-off behavior: graceful fallback to Stage 4 baseline.
- Telemetry sink: Application Insights (logs backup), with correlation dimensions:
  - `tenantId`, `comparisonId`, `revisionPair`, `flagState`, `correlationId`
- Runtime SLO telemetry flags (initially all `false`):
  - `OBS_S7_TREE_EXPAND_P95`
  - `OBS_S7_DYNAMIC_QUERY_P95`
  - `OBS_S7_FIRST_HIERARCHY_RESPONSE`
  - `OBS_S7_FIRST_MEANINGFUL_TREE_ROWS`
  - `OBS_S7_OVERHEAD_VS_S4`
- Alert policy:
  - warn after 3 consecutive breaches
  - critical after 10 minutes sustained
  - manual rollback in Dev/Test
- Alert thresholds apply when corresponding SLO metric flags are enabled.

---

## Sprint S7B - Stage 7 Format Scalability (Option B)

### Sprint Metadata
- Sprint: `S7B`
- Stage: `Stage 7 - Format Scalability and Composite Identity`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Completed (Executed with S7 in current delivery cycle)`

### Sprint Goal
Implement a scalable profile-adapter matching architecture so arbitrary BOM formats can be compared deterministically without false mass `replaced` classifications.

Execution backlog:
- `BACKLOG_S7_FORMATS.md`

### Scope (Suggested)
| ID | Work Item | Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S7F-01 | Define contextual composite key contract (`stableOccurrenceKey` + `snapshotRowKey`) and adapter interface | Epic `439`; format scalability objective | 3 | AI Coding Agent (BE/Architect) | P0 |
| S7F-02 | Implement profile registry + SAP adapter (occurrence identity from component + hierarchy/sequence context) | Epic `439`; SAP false-replace remediation | 5 | AI Coding Agent (BE) | P0 |
| S7F-03 | Implement generic adapter fallback for unknown BOM formats with deterministic key degradation | Epic `439`; unlimited-format objective | 5 | AI Coding Agent (BE) | P0 |
| S7F-04 | Integrate key-first matcher pass order with strict ambiguity gate (no forced replacement on ambiguous identity) | `FR-007`; deterministic policy lock | 5 | AI Coding Agent (BE) | P0 |
| S7F-05 | Add profile-based field policy (`identity` vs `comparable` vs `display`) and include mapped business fields such as `Plant` as non-identity deltas | Epic `439`; Stage 4/7 diff quality | 3 | AI Coding Agent (BE/Product) | P0 |
| S7F-06 | Harden replacement classification guardrails (`replaced` only on high-confidence context-aligned pairings) | `FR-007`; taxonomy correctness | 3 | AI Coding Agent (BE) | P0 |
| S7F-07 | Add observability metrics for key collision, ambiguity rate, unmatched rate, and forced-replacement suppression | `NFR-OBS`; rollout safety | 3 | AI Coding Agent (BE/DevOps) | P1 |
| S7F-08 | Add backend fixture matrix tests (same-vs-same, single-change, hierarchy duplicates) using `docs/BOM Examples` | QA hardening | 5 | AI Coding Agent (QA/BE) | P0 |
| S7F-09 | Add Playwright scenarios for format adapters (same-vs-same should converge to no-change) | QA hardening | 3 | AI Coding Agent (QA/FE) | P1 |
| S7F-10 | Add rollout flags/runbook for adapter framework and staged profile enablement | rollout control | 3 | AI Coding Agent (BE/DevOps) | P1 |

### Guardrails (Locked)
- No Cosmos DB/Gremlin.
- Deterministic strategy/tie-break invariants from Stage 4 remain binding.
- `replaced` must not be emitted from ambiguous identity fallback paths.
- Same-file-vs-same-file baseline must produce no mass false change classifications.
- Profile adapter framework must always have a deterministic generic fallback for unknown formats.
- Locked clarification set: `1A`, `2A`, `3A`, `4A`, `5A`, `6A` (see `BACKLOG_S7_FORMATS.md`).

### Rollout Notes
- Proposed flags:
  - `MATCHER_PROFILE_ADAPTERS_V1`
  - `MATCHER_COMPOSITE_KEY_V1`
  - `MATCHER_AMBIGUITY_STRICT_V1`
- Enablement sequence:
  - Dev: all `true`
  - Test: `MATCHER_PROFILE_ADAPTERS_V1=true`, others gated after fixture pass
  - Prod: start `false`, then canary by tenant/profile
- Locked runtime rollout strategy: tenant/profile canary first, not global big-bang.

### Definition of Done (Sprint-Level)
- Adapter framework exists with profile registry and deterministic generic fallback.
- Composite-key-first matching reduces false `replaced` for duplicate-heavy BOMs.
- Same-vs-same BOM fixture runs converge to expected `no_change` dominant output.
- Regression suite and browser automation for adapter flows pass.
- Rollout flags + runbook support safe tenant/profile staged activation.

### Clarification Status
- No open clarification items for S7B.
- Locked set `1A` through `6A` is implemented and documented in `BACKLOG_S7_FORMATS.md` and `V1_DECISIONS.md`.

### Overlap Boundary
- S7B closed adapter/composite-key scope and adapter-quality automation.
- Remaining open S7 stories (`S7-04` to `S7-08`) should not duplicate S7B tests/metrics; they should focus on hierarchy tree UX, Stage 7 core graph closure, and rollout controls.

---

## Sprint S8 - Stage 8 Security + Compliance Baseline Closure

### Sprint Metadata
- Sprint: `S8`
- Stage: `Stage 8 - Security + Compliance Baseline Closure`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Suggested/Planned`

### Scope (Suggested)
| ID | Work Item | Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S8-01 | Implement API rate-limiting and abuse controls (tenant/user scoped) | Legacy `US-500`; `NFR-SEC-015` | 5 | AI Coding Agent (BE) | P0 |
| S8-02 | Add Terms/Privacy consent/version tracking workflow | Legacy `US-503` | 3 | AI Coding Agent (FE/BE) | P1 |
| S8-03 | Complete history parity: rename/tag/delete with audit logs | Legacy `US-494`, `US-495`; Product plan history intent | 5 | AI Coding Agent (FE/BE) | P0 |
| S8-04 | Harden audit export governance and access controls | Legacy `US-504`; `NFR-AUDIT` | 3 | AI Coding Agent (BE) | P0 |
| S8-05 | Add secure SDLC policy checks to CI (dependency/license/secret scanning gates) | Legacy `US-501` | 3 | AI Coding Agent (DevOps) | P1 |
| S8-06 | Add Stage 8 automated tests and compliance runbook updates | QA + compliance hardening | 5 | AI Coding Agent (QA/DevOps) | P0 |

### Rollout Notes
- Proposed flags: `RATE_LIMITING_V1`, `HISTORY_PARITY_V1`, `CONSENT_TRACKING_V1`.
- Clarification lock (approved):
  - rate-limit enforcement: gateway + app
  - baseline limit: `100 req/min` + stricter upload/diff/export caps
  - authenticated throttle key: `tenantId`; unauthenticated fallback: IP
  - exemptions: admin/service allowlist with audit
  - consent model: separate Terms/Privacy versions + timestamp; policy updates require re-accept on next login
  - history delete: soft-delete + audit (physical purge by retention flow)
  - tag model: single owner-private editable label (max 50 chars)
  - audit export: harden existing Stage 6 surface (no rebuild)
  - audit archive: daily append-only Blob archive, GRS, 7+ years target
  - secure SDLC CI gates: block on high/critical vulnerabilities, secret hits, and license-policy violations
  - compliance role source: existing DB admin role claim.

---

## Sprint S9 - Stage 9 Reliability + Disaster-Recovery Readiness

### Sprint Metadata
- Sprint: `S9`
- Stage: `Stage 9 - Reliability + Disaster-Recovery Readiness`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Suggested/Planned`

### Scope (Suggested)
| ID | Work Item | Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S9-01 | Implement backup automation policy for critical stores (DB/storage/config metadata) | Legacy `US-508`; `NFR-AV-008` | 3 | AI Coding Agent (DevOps) | P0 |
| S9-02 | Implement restore verification workflow and evidence capture against RTO goals | Legacy `US-509` | 3 | AI Coding Agent (DevOps) | P0 |
| S9-03 | Add disaster recovery runbook and recurring drill workflow | Legacy `US-510` | 3 | AI Coding Agent (DevOps) | P1 |
| S9-04 | Tune alert thresholds and on-call operational dashboards across environments | Legacy `US-505`, `US-506` | 3 | AI Coding Agent (DevOps/BE) | P1 |
| S9-05 | Add reliability chaos/failure-path tests (queue/storage/db transient failures) | Reliability hardening | 5 | AI Coding Agent (QA/BE) | P0 |
| S9-06 | Stage 9 rollout + rollback drill and sign-off package | Operational closeout | 3 | AI Coding Agent (DevOps) | P1 |

### Notes
- Human operations approval remains required for production backup/restore policy activation.

---

## Sprint S10 - Stage 10 STEP/STP + PLM/Graph Expansion (Deferred)

### Sprint Metadata
- Sprint: `S10`
- Stage: `Stage 10 - STEP/STP + PLM/Graph Expansion`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Recommended/Deferred`

### Scope (Suggested)
| ID | Work Item | Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
| S10-01 | Implement STEP/STP ingestion + validation contract | Legacy `US-484` delta | 5 | AI Coding Agent (BE) | P0 |
| S10-02 | Extend mapping detection flow for STEP/STP-derived attributes | Legacy `US-484` delta | 5 | AI Coding Agent (BE) | P0 |
| S10-03 | Extend matcher for STEP/STP comparison pathways with deterministic rationale | Legacy `US-486` delta | 5 | AI Coding Agent (BE) | P0 |
| S10-04 | Add hierarchy/graph acceleration layer where measurable | Legacy `US-439` architecture notes | 3 | AI Coding Agent (BE) | P1 |
| S10-05 | Add PLM connector framework and first integration boundary contracts | Legacy architecture integration goals | 5 | AI Coding Agent (BE/DevOps) | P1 |
| S10-06 | Add Stage 10 automated tests + rollout hardening | QA hardening | 5 | AI Coding Agent (QA/BE) | P0 |

---

## Sprint Review Template (Complete at Sprint Close)

### S1 Outcome
- Completed:
- Deferred:
- Regressions/Bugs:
- Lessons learned:

### S2 Outcome
- Completed:
  - `S2-00` through `S2-09` completed.
  - `S2-10` operational unlimited-account override for Dev/Test (`UPLOAD_UNLIMITED_USER_EMAILS`) completed.
  - Stage 2 acceptance criteria passed with automation.
- Deferred:
  - None.
- Regressions/Bugs:
  - Prisma SQL Server migration required removal of `GO` batch separators.
- Lessons learned:
  - Keep SQL migrations Prisma-compatible and idempotent from first draft.

### S3 Outcome
- Completed:
  - `S3-01` through `S3-09` completed.
  - Stage 3 acceptance criteria passed with automated backend and browser coverage.
- Deferred:
  - None.
- Regressions/Bugs:
  - None blocking closeout; browser automation was stabilized by clearing local test port conflicts (`3100`/`4100`).
- Lessons learned:
  - Keep preview/edit contracts aligned with backend confirmation constraints to avoid UI gating drift.
  - Maintain deterministic ordering and immutable snapshot behavior early to reduce rework in later stages.

### S4 Outcome
- Completed:
- `S4-01` through `S4-07` completed and verified.
- `S4-08` completed with perf harness, baseline runbook, and recorded benchmark artifact.
- `S4-09` completed, including backend + Playwright regression coverage for real XLSX uploads.
- `S4-10` completed with feature flags, diff operational metrics hooks, and rollout/rollback runbook.
- `V1` fix sprint (`FX-01`..`FX-06`) completed with format-aware parser, header alias hardening, diff field expansion, and parser guardrails.
- Deferred:
- None.
- Regressions/Bugs:
- Real XLSX parsing regression fixed (previous `.xlsx` bytes parsed as CSV text).
- Lessons learned:
- Keep real user fixture files in automated tests to prevent parser/contract drift.
- Keep non-blocking operational thresholds tracked separately so delivery can continue:
  - `docs/S4_ParkedClarifications.md`.

---

## Sprint S11 - Frontend Antigravity Mission Control

### Sprint Metadata
- Sprint: `S11`
- Stage: `Frontend Antigravity Mission Control`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Completed`

### Sprint Goal
Implement the approved Antigravity-inspired mission-control frontend across authenticated product routes, carrying the redesign from approval artifacts into production route components without changing core backend domain scope.

### Scope (Committed)
| ID | Work Item | Traceability | Estimate | Owner | Priority | Status |
|---|---|---|---:|---|---|---|
| S11-01 | Replace the authenticated frontend shell with a collapsed-first mission-control shell, route-aware titles, and icon-driven left navigation | `docs/FOUNDATION_GENERATION_UI_PLAN.md`; `docs/UI_QA_FINAL_APPROVED_BASELINE.md` | 5 | FE | P0 | `Completed` |
| S11-02 | Implement dual-theme Antigravity token system with persisted light/dark selection and shared iconography primitives | `docs/FOUNDATION_GENERATION_UI_PLAN.md`; `docs/UI_VISUAL_APPROVAL_PACK.md` | 5 | FE | P0 | `Completed` |
| S11-03 | Rebuild `Compare BOMs` as a mission-control intake surface with drag/drop, icon-first compare action, popup issue handling, and auto-open results handoff | `FR-003`; `FR-004`; `FR-005`; Stage 2 UX surface | 5 | FE | P0 | `Completed` |
| S11-04 | Rebuild `Mapping Check` as a dense confidence-review surface with compact toolbar and icon-first confirm control | `FR-006`; Stage 3 UI surface | 3 | FE | P0 | `Completed` |
| S11-05 | Rebuild `Results` as the primary mission-control workspace with subtle progress, icon-first list/tree/share/export/run actions, inline filters, popup export/share flows, and compact pagination | `FR-008`; `FR-010`; `FR-012`; Stage 4/5 UI surfaces | 8 | FE | P0 | `Completed` |
| S11-06 | Rebuild `History`, `Notifications`, and `Admin` into shell-consistent mission-control screens with compact toolbars and icon-first high-frequency actions | `FR-011`; `FR-013`; `FR-014` | 5 | FE | P0 | `Completed` |
| S11-07 | Produce and maintain high-fidelity approval artifacts, remediation record, and final UI-QA baseline for the Antigravity frontend | `docs/UI_VISUAL_APPROVAL_PACK.md`; `docs/UI_APPROVAL_REMEDIATION_PLAN.md`; `docs/UI_QA_FINAL_APPROVED_BASELINE.md` | 5 | FE/Product/QA | P0 | `Completed` |
| S11-08 | Execute post-implementation polish and responsive hardening across upload/results/shell based on PM review feedback | `docs/UI_APPROVAL_REMEDIATION_PLAN.md`; `docs/UI_QA_FINAL_APPROVED_BASELINE.md` | 3 | FE | P1 | `Completed` |

### Non-Goals (Out of Scope)
- Backend business-domain expansion beyond existing upload, mapping, diff, export, share, notification, and admin APIs.
- PLM/connector work.
- Full elimination of authenticated-route latency caused by server-side session fetch behavior.
- Replacing the approved mission-control direction with a new visual system.

### Delivery Plan
- Week 1:
  - Lock shell, theme, icon, and approval-reference direction (`S11-01`, `S11-02`, `S11-07`).
  - Convert Compare BOMs and Results first, as the highest-visibility operator flows (`S11-03`, `S11-05`).
- Week 2:
  - Convert Mapping, History, Notifications, and Admin (`S11-04`, `S11-06`).
  - Close polish, responsive, and PM-feedback loops (`S11-08`).

### Dependencies
- Approved foundation and visual pack:
  - `docs/FOUNDATION_GENERATION_UI_PLAN.md`
  - `docs/UI_VISUAL_APPROVAL_PACK.md`
- Approved implementation QA baseline:
  - `docs/UI_QA_FINAL_APPROVED_BASELINE.md`
- Existing backend route contracts for uploads, mappings, diff jobs, exports, sharing, notifications, and admin.

### Definition of Done (Sprint-Level)
- Approved Antigravity mission-control shell is implemented across authenticated frontend routes.
- Light and dark themes both work with the shared shell.
- Compare BOMs, Mapping Check, Results, History, Notifications, and Admin all use the production mission-control UI model.
- Approval artifacts and final UI-QA documentation remain aligned with the implemented frontend.
- Typecheck and production build succeed for the frontend after the redesign.

### QA Plan
- Validate the production routes against the approved `/approval` baseline.
- Validate collapsed-first rail behavior and shell parity in light and dark themes.
- Validate Compare BOMs upload, popup issues, and automatic Results handoff.
- Validate Results list/tree/share/export/run flows and table-first layout.
- Validate History, Notifications, and Admin compact toolbar behavior.
- Re-run code-aware UI-QA after major FE changes and keep the approved baseline doc current.

### Risks and Mitigations
| Risk | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|
| Shell redesign breaks route behavior or auth flow | High user-visible regression | Keep backend contracts stable, validate production routes after each slice, preserve existing APIs | FE | Route regression during conversion |
| Icon-first controls reduce clarity | Workflow errors | Keep accessible labels/tooltips and preserve text where icon-only meaning is risky | FE/Product | PM review confusion |
| Results chrome crowds the main table | Lower review efficiency | Keep table-first layout and progressively compress support controls | FE | PM feedback on density |
| Approval artifacts drift from production implementation | Signoff ambiguity | Keep approval docs and final QA baseline updated from real code | FE/QA | Mismatch between `/approval` and route behavior |
| Authenticated nav feels slow under server fetches | UX friction | Track nav latency separately as carry-forward optimization work | FE/Platform | PM feedback on route delay |

### Demo Plan
- Show collapsed-first mission-control shell in light and dark themes.
- Show Compare BOMs with drag/drop intake, combined compare action, popup issue handling, and automatic Results transition.
- Show Results toolbar, inline filters, export/share modals, and compact pagination.
- Show Mapping, History, Notifications, and Admin route consistency under the new shell.
- Show the approval doc and final UI-QA baseline as the design-to-code audit trail.

### Rollout Notes
- Treat Sprint 11 as a frontend-system sprint, not a pure visual-polish sprint.
- Keep `/approval` as the design reference while future frontend changes continue.
- Carry forward authenticated-nav latency optimization as a separate improvement track after Sprint 11 closeout.
- Detailed reverse-engineered story record:
  - `docs/SPRINT_S11_FRONTEND_ANTIGRAVITY.md`

---

## Sprint S12 - Results Revision Chain

### Sprint Metadata
- Sprint: `S12`
- Stage: `Results Revision Chain`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Completed`

### Sprint Goal
Extend the Antigravity Results workspace so users can continue a BOM session by uploading one new file, automatically compare latest-vs-new inside the same session, and review previous session comparisons from Results.

### Locked UX Decisions
- Always compare the latest file in the session against the new upload.
- Use a modal on `/results` for chained upload.
- Support drag/drop and `Select file` in that modal.
- Redirect immediately into the next in-progress Results workspace after chained intake succeeds.
- Provide a `Previous comparisons` modal on `/results`.
- Show comparison label, upload date/time, user, latest/historical state treatment, and open action.
- Use system-generated labels with rename support.
- Keep previous-comparison actions non-read-only.
- Apply exports/shares only to the currently open comparison.
- Keep validation/comparison failures popup-based and non-navigating.
- Treat all files in the session as the same BOM lineage.

### Scope (Committed)
| ID | Work Item | Traceability | Estimate | Owner | Priority | Status |
|---|---|---|---:|---|---|---|
| S12-01 | Add one-file chained upload initiation from `/results` with drag/drop modal and file-picker support | Locked UX decisions `1`, `2`, `8`; existing Stage 2 upload flow | 5 | FE | P0 | `Completed` |
| S12-02 | Extend upload validation/intake contracts to support latest-vs-new comparison inside an existing session | Locked UX decisions `1`, `10`; existing upload/session services | 5 | FE/BE | P0 | `Completed` |
| S12-03 | Redirect immediately into the next in-progress Results workspace after chained intake succeeds | Locked UX decision `3` | 3 | FE | P0 | `Completed` |
| S12-04 | Add a session-scoped `Previous comparisons` modal with label, time, user, latest state treatment, and open action | Locked UX decisions `4`, `9`; existing history/session model | 5 | FE | P0 | `Completed` |
| S12-05 | Support rename/delete actions for prior comparisons while keeping system-generated default labels | Locked UX decisions `5`, `6` | 3 | FE | P1 | `Completed` |
| S12-06 | Refine Results toolbar density by shrinking the completion indicator and keeping the table visually dominant | PM review feedback; Results workspace polish | 2 | FE | P1 | `Completed` |

### Non-Goals (Out of Scope)
- Baseline chooser for chained uploads.
- Branching or graph-style comparison history.
- Cross-session lineage comparison.
- New export/share semantics beyond current-comparison scope.

### Delivery Plan
- Week 1:
  - Lock chained-upload UX and session-history UX.
  - Extend upload/session contracts for single-file chained intake.
- Week 2:
  - Implement Results modals, redirect flow, and history actions.
  - Close visual polish and route-consistency gaps.

### Dependencies
- Sprint 11 mission-control shell and Results workspace
- Existing upload/session/revision services
- Existing history rename/delete routes

### Definition of Done (Sprint-Level)
- Results supports chained one-file upload against the latest file in the session.
- Chained upload redirects into the next in-progress Results workspace.
- Results exposes previous comparisons for the current session.
- Previous comparison labels can be renamed.
- Frontend typecheck and build succeed after the change.

### QA Plan
- Validate chained upload modal drag/drop and file picker behavior.
- Validate latest-vs-new comparison behavior inside the same session.
- Validate redirect into the next in-progress Results workspace.
- Validate previous-comparisons modal load, rename, open, and delete actions.
- Validate Results toolbar density after progress-indicator change.

### Risks and Mitigations
| Risk | Impact | Mitigation | Owner | Trigger |
|---|---|---|---|---|
| Chained intake creates a new session instead of continuing the current one | Breaks lineage model | Force `sessionId` reuse in chained intake path and verify with session-filtered history | FE/BE | Previous comparisons modal shows split sessions |
| Previous comparisons cannot reopen accurate revision pairs | Wrong comparison reopened | Enrich session history with stored revision-pair metadata and open by revisions | FE/BE | Opened comparison does not match expected files |
| Results toolbar becomes overcrowded | Lower usability | Keep progress/status compact and push secondary actions into modals | FE | PM review feedback |

### Rollout Notes
- Treat Sprint 12 as a workflow extension on top of Sprint 11, not a new visual reset.
- Detailed sprint record:
  - `docs/SPRINT_S12_RESULTS_REVISION_CHAIN.md`
 - Focused UI-QA record:
   - `docs/UI_QA_S12_RESULTS_REVISION_CHAIN.md`
 - Recommended follow-up sprint:
   - `docs/SPRINT_S12_1_RESULTS_CHAIN_HARDENING.md`

---

## Sprint S12.1 - Results Chain Hardening

### Sprint Metadata
- Sprint: `S12.1`
- Stage: `Results Chain Hardening`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Backlog`

### Sprint Goal
Close the workflow-integrity gaps found during the Sprint 12 focused QA pass so session comparison history is immutable, role-consistent, and status-aware.

### Scope (Committed)
| ID | Work Item | Traceability | Estimate | Owner | Priority | Status |
|---|---|---|---:|---|---|---|
| S12.1-01 | Reopen previous comparisons by original comparison identity instead of silently recomputing them | `docs/UI_QA_S12_RESULTS_REVISION_CHAIN.md` finding `1` | 5 | FE/BE | P0 | `Backlog` |
| S12.1-02 | Extend session-history visibility to authorized viewers instead of initiator-only access | `docs/UI_QA_S12_RESULTS_REVISION_CHAIN.md` finding `2` | 5 | FE/BE | P0 | `Backlog` |
| S12.1-03 | Add real comparison lifecycle state to session-history rows and modal rendering | `docs/UI_QA_S12_RESULTS_REVISION_CHAIN.md` finding `3` | 3 | FE/BE | P1 | `Backlog` |

### Non-Goals (Out of Scope)
- New visual redesign work
- Branching comparison graphs
- Cross-session baseline selection

### QA Driver
- Sprint 12 focused QA record:
  - `docs/UI_QA_S12_RESULTS_REVISION_CHAIN.md`

---

## Sprint S13 - Template-Preserving Excel Export

### Sprint Metadata
- Sprint: `S13`
- Stage: `Template-Preserving Excel Export`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Completed`

### Sprint Goal
Implement Excel export so the downloaded workbook preserves the latest uploaded workbook presentation while replacing the BOM row region with current comparison data.

### Scope (Committed)
| ID | Work Item | Traceability | Estimate | Owner | Priority | Status |
|---|---|---|---:|---|---|---|
| S13-01 | Persist workbook template context for export | `docs/ISSUE_TRACKER.md` `ISSUE-001` | 3 | BE | P0 | `Completed` |
| S13-02 | Replace generated-sheet Excel export with template-preserving workbook mutation | `docs/ISSUE_TRACKER.md` `ISSUE-001` | 5 | BE | P0 | `Completed` |
| S13-03 | Preserve and resize the BOM table while appending inline metadata and separate metadata sheet | `docs/ISSUE_TRACKER.md` `ISSUE-001` | 5 | BE | P0 | `Completed` |
| S13-04 | Add automated tests for workbook preservation behavior before release | `docs/ISSUE_TRACKER.md` `ISSUE-001` | 3 | BE/QA | P0 | `Completed` |

### Locked Decisions
- Use the latest uploaded workbook as the export template baseline.
- Preserve all workbook sheets/tabs.
- Preserve and resize BOM tables.
- Preserve drawing/media-backed image columns.
- Add metadata both inline and on a separate sheet.
- Preserve workbook presentation artifacts where library support permits.
- Patch OOXML parts directly for uploaded `.xlsx` exports instead of rebuilding the workbook through `xlsx.write(...)`.

### QA Plan
- Validate preserved sheet names.
- Validate preserved column widths on the main BOM sheet.
- Validate table XML presence and resized row ref.
- Validate drawing/media preservation on image-based workbooks.
- Validate inline metadata columns and separate metadata sheet.
- Run backend automated tests before release.

### Execution record
- Detailed sprint record:
  - `docs/SPRINT_S13_TEMPLATE_PRESERVING_EXCEL_EXPORT.md`
- Verification:
  - `npm --prefix apps/backend run typecheck`
  - `npm --prefix apps/backend run test:e2e`

---

## Sprint S24 - Smart BOM Region Detection

### Sprint Metadata
- Sprint: `S24`
- Stage: `Upload Parsing + Sheet-Aware BOM Region Detection`
- Dates: `TBD`
- Owner: `Product + Engineering`
- Status: `Backlog`

### Sprint Goal
Enable sheet-aware, precision-first BOM extraction for CSV/XLS/XLSX uploads so the system compares the actual BOM table while safely excluding workbook framing content.

Execution backlog:
- `BACKLOG_S24_SMART_BOM_REGION_DETECTION.md`

### Scope (Committed)
| ID | Work Item | Traceability | Estimate | Owner | Priority | Status |
|---|---|---|---:|---|---|---|
| S24-01 | Add workbook metadata endpoint and preferred-sheet discovery for visible sheets | `docs/SMART_BOM_REGION_DETECTION_IMPLEMENTATION_SPEC.md`; sheet-selection decision set | 3 | BE | P0 | `Backlog` |
| S24-02 | Add per-revision sheet dropdowns on `/upload` and `Upload Next Revision` | `docs/SMART_BOM_REGION_DETECTION_IMPLEMENTATION_SPEC.md`; upload UX decision set | 5 | FE | P0 | `Backlog` |
| S24-03 | Extend validate/intake contracts to carry selected sheet values and parser warnings | `docs/SMART_BOM_REGION_DETECTION_IMPLEMENTATION_SPEC.md`; deterministic upload contract | 3 | FE/BE | P0 | `Backlog` |
| S24-04 | Implement smart BOM-region detection with crop-first vs map-first confidence comparison | `docs/SMART_BOM_REGION_DETECTION_ARCHITECTURE.md`; parser-boundary architecture | 8 | BE | P0 | `Backlog` |
| S24-05 | Add fallback controls, non-technical validation warnings, diagnostics, and feature flag rollout path | `docs/SMART_BOM_REGION_DETECTION_IMPLEMENTATION_SPEC.md`; change-management controls | 5 | FE/BE | P0 | `Backlog` |
| S24-06 | Add fixture matrix and regression coverage for workbook and CSV variants | `docs/BOM Examples`; QA hardening | 5 | QA/BE/FE | P0 | `Backlog` |

### Locked Decisions
- Scan all visible sheets.
- Prefer sheet names similar to `BOM`, `BillOfMaterials`, `Parts`, and `Components`.
- Show an always-visible per-revision sheet dropdown and disable it until workbook metadata loads.
- For CSV, show a disabled single-option `CSV`.
- User-selected sheet wins completely for sheet selection.
- Strictly exclude non-line-item columns while preserving legitimate business columns.
- Always remove totals, subtotals, legends, status keys, instructions, and other non-BOM footer rows.
- Primary BOM-row qualification is any 2 of `part number`, `description`, and `quantity`, with score-based fallback.
- Ignore images entirely.
- Favor precision over recall.
- Weak-confidence cases continue with fallback to the current parser plus warning and diagnostics.
- Rollout behind `UPLOAD_BOM_REGION_DETECTION_V1`.

### Guardrails
- Do not redesign the diff engine after normalized rows are produced.
- Do not add manual row/column override in this sprint.
- Do not add row/column preview UI in this sprint.
- Keep validate and intake deterministic with respect to the user-reviewed sheet selection.
- Non-technical validation warnings are required for fallback cases.

### Definition of Done (Sprint-Level)
- Workbook metadata discovery, sheet selection, and smart BOM-region detection are implemented behind a feature flag.
- Validation and intake use the same selected-sheet contract deterministically.
- Weak-confidence extraction degrades safely to the current parser with user warning and engineering diagnostics.
- Fixture and regression automation pass for workbook and CSV examples.
- Downstream compare behavior remains unchanged after BOM extraction.

### Detailed Sprint Record
- `docs/SPRINT_S24_SMART_BOM_REGION_DETECTION.md`

---

## Ticket-Ready Story Template

Use this template for every backlog story before sprint start.

### Story Metadata
- Story ID:
- Title:
- Type: `Story | Bug | Spike`
- Priority: `P0 | P1 | P2`
- Estimate:
- Owner:
- Sprint:
- Status: `Backlog | Ready | In Progress | In Review | Done`

### Traceability
- Requirement link(s): `FR-*` from `V1_SPEC.md`
- Stage acceptance link(s): exact Stage/Done-when bullet(s) from `V1_SPEC.md`
- Decision link(s): any applicable item from `V1_DECISIONS.md`

### User Story
As a `<persona>`, I want `<capability>` so that `<outcome>`.

### Business Value
- Why this story matters now:
- Risk if delayed:

### Scope
- In scope:
- Out of scope:

### Inputs
- Trigger/API/UI input:
- Required fields and types:
- Preconditions:
- Auth/Tenant context required:

### Outputs
- Success outputs (payload, redirect, state change):
- Failure outputs (error payload, UI state):
- Side effects (events, history/audit records):

### Contract
- Endpoint(s)/event(s):
- Request schema:
- Response schema:
- Status/error codes:
- Idempotency/retry behavior:
- Versioning notes:

### Constraints
- Security constraints:
- Performance constraints:
- Compliance/audit constraints:
- Environment/config constraints:
- Time/date constraints (UTC, cooldown windows, retention timing):

### Acceptance Criteria
1. 
2. 
3. 

### Test Plan
- Unit tests:
- Integration tests:
- E2E/manual tests:
- Test data/fixtures:
- Observability checks (logs/metrics/traces):

### Dependencies
- Upstream systems/services:
- Infrastructure prerequisites:
- Blockers:

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
Use this block when assigning to an AI coding agent.

```text
You are implementing story <STORY_ID>: <TITLE>.

Objective:
<one-sentence objective>

In Scope:
- <item>
- <item>

Out of Scope:
- <item>

Inputs:
- <input contract details>

Outputs:
- <output contract details>

Contract:
- Endpoints/events: <...>
- Request schema: <...>
- Response schema: <...>
- Error codes: <...>
- Idempotency/retry: <...>

Constraints:
- Security: <...>
- Performance: <...>
- Audit/compliance: <...>
- Environment/config: <...>

Acceptance Criteria:
1. <criterion>
2. <criterion>
3. <criterion>

Required Tests:
- Unit: <...>
- Integration: <...>
- E2E/manual: <...>

Implementation Notes:
- Touch only relevant files.
- Keep behavior deterministic.
- Add/adjust docs for any contract change.

Deliverables:
- Code changes.
- Tests.
- Short change summary mapped to acceptance criteria.
```
