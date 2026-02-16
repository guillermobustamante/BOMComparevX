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
- Status: `Planned`

### Sprint Goal
Enable two-file upload with immediate validation, enforce upload policy (including onboarding credits), and enqueue accepted jobs with visible history creation.

### Scope (Committed)
| ID | Work Item | Spec Traceability | Estimate | Owner | Priority |
|---|---|---|---:|---|---|
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

---

## Sprint Review Template (Complete at Sprint Close)

### S1 Outcome
- Completed:
- Deferred:
- Regressions/Bugs:
- Lessons learned:

### S2 Outcome
- Completed:
- Deferred:
- Regressions/Bugs:
- Lessons learned:

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
