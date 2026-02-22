# BACKLOG_S5.md

## Sprint S5 Backlog (Ticket-Ready)

This backlog expands Stage 5 (`S5-01` to `S5-10`) from `SPRINT_PLAN.md` into execution-ready stories.

Source precedence:
- `V1_DECISIONS.md` for locked Stage 5 behavior.
- `V1_SPEC.md` for FR and stage acceptance criteria.
- `PRODUCT_PLAN.md` for architecture and UX direction.
- `docs/S5_ParkedClarifications.md` for explicitly deferred V2/V3 items.

## Delivery Guardrails (Stage 5)

1. Export contract:
- V1 export is synchronous download only.
- Default export scope is full dataset (not current filtered/sorted view).
- CSV + Excel are required.

2. Excel fidelity:
- Preserve source sheet layout, column order, headers, and mapped custom columns.
- Style/formula fidelity is best-effort (not strict parity).

3. Sharing policy:
- Multi-recipient invite is allowed.
- Sharing is same-tenant only.
- Invitees are view-only.
- Invited identity is exact-email bound.

4. Invite identity flow:
- Unregistered invite emails are allowed.
- Access is granted only after authentication as the exact invited email.

5. Revocation default:
- Hard revoke on next authorized request.

6. Notifications baseline:
- Trigger only on comparison complete/fail.
- In-app required.
- Email optional by configuration.

7. Admin policy controls:
- Full admin UI is in scope.
- Authorization source is DB role claim in V1.

8. Retention defaults:
- Export artifacts: 7 days.
- Notifications: 90 days.
- Share records: until explicit revoke or owning session deletion.

---

## S5-01 Define Export Contract + Synchronous CSV Export

### Story Metadata
- Story ID: `S5-01`
- Title: `Define Export Contract + Synchronous CSV Export`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-010`
- Stage acceptance link(s): `Stage 5 bullet 1`
- Decision link(s): `V1_DECISIONS.md` items `9`, `42`, `43`

### Inputs
- `comparisonId`
- authenticated user and tenant context

### Outputs
- Sync CSV download containing full result dataset.

### Contract
- Endpoint: `GET /api/exports/csv/:comparisonId`
- Success: `200` with `text/csv` attachment
- Failure: standardized `{ code, message, correlationId }`

### Constraints
- Tenant-scoped authorization and share checks.
- Export must ignore active grid filter/sort state.

### Acceptance Criteria
1. CSV export is downloadable synchronously.
2. CSV includes full dataset by default.
3. Unauthorized requests are denied with standardized error payload.

### AI Prompt (Execution-Ready)
```text
Implement the Stage 5 CSV export contract as synchronous download.
Default to full dataset export and enforce tenant/share authorization.
Keep error payloads standardized with correlation IDs.
```

---

## S5-02 Implement Excel Export with Source-Structure Fidelity

### Story Metadata
- Story ID: `S5-02`
- Title: `Implement Excel Export with Source-Structure Fidelity`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-010`
- Stage acceptance link(s): `Stage 5 bullet 1`
- Decision link(s): `V1_DECISIONS.md` item `9`

### Inputs
- comparison/revision metadata
- immutable mapping snapshot
- computed diff rows

### Outputs
- Sync `.xlsx` download preserving required source structure contract.

### Contract
- Endpoint: `GET /api/exports/excel/:comparisonId`
- Success: `200` with Excel attachment
- Failure: standardized error contract

### Constraints
- Preserve source sheet layout/column order/headers/mapped custom columns.
- Style/formula fidelity is best-effort.

### Acceptance Criteria
1. Excel export opens correctly and is downloadable synchronously.
2. Required source-structure fidelity rules are met.
3. Full dataset is exported by default.

### AI Prompt (Execution-Ready)
```text
Build synchronous Excel export for Stage 5 using immutable mapping snapshots.
Preserve source structure contract (layout/order/headers/custom mapped columns) and keep style/formulas best-effort.
```

---

## S5-03 Implement Sharing Data Model + Permission Rules

### Story Metadata
- Story ID: `S5-03`
- Title: `Implement Sharing Data Model + Permission Rules`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-012`
- Stage acceptance link(s): `Stage 5 bullets 2-3`
- Decision link(s): `V1_DECISIONS.md` items `39`, `41`

### Inputs
- owner user context
- target invite email(s)
- comparison/session identifier

### Outputs
- durable share records with same-tenant and view-only constraints.

### Contract
- Share model fields include:
  - `tenantId`, `comparisonId`, `ownerUserId`, `invitedEmail`, `permission=view`, `createdAtUtc`, `revokedAtUtc?`

### Constraints
- Same-tenant only.
- View-only permission only in V1.
- Append-only history of share state changes via audit trail.

### Acceptance Criteria
1. Multi-recipient share records can be created for same-tenant recipients.
2. Invitees are constrained to view-only.
3. Cross-tenant share attempts are denied.

### AI Prompt (Execution-Ready)
```text
Implement Stage 5 sharing persistence and permission rules.
Support multi-recipient same-tenant invites with view-only access and deny cross-tenant sharing.
```

---

## S5-04 Implement Share Invite/Revoke APIs + Exact-Email Access Gate

### Story Metadata
- Story ID: `S5-04`
- Title: `Implement Share Invite/Revoke APIs + Exact-Email Access Gate`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-012`
- Stage acceptance link(s): `Stage 5 bullets 2-3`
- Decision link(s): `V1_DECISIONS.md` items `40`, `47`

### Inputs
- invite/revoke API payloads
- authenticated actor

### Outputs
- invite creation/revocation actions
- enforced access checks for shared resources

### Contract
- `POST /api/shares/invite`
- `POST /api/shares/revoke`
- Access check enforced on result/history retrieval paths

### Constraints
- Unregistered invite emails are valid targets.
- Access requires authentication as exact invited email.
- Revocation is hard-enforced on next authorized request.

### Acceptance Criteria
1. Owner can invite and revoke multiple recipients.
2. Shared access is granted only to exact invited email identity.
3. Revoked recipients lose access on subsequent access checks.

### AI Prompt (Execution-Ready)
```text
Implement invite/revoke sharing APIs and enforce exact-email identity checks for shared access.
Support unregistered invite emails and enforce hard revoke on next authorized request.
```

---

## S5-05 Build Sharing UI (Multi-Invite + Revoke)

### Story Metadata
- Story ID: `S5-05`
- Title: `Build Sharing UI (Multi-Invite + Revoke)`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `FE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-012`
- Stage acceptance link(s): `Stage 5 bullets 2-3`

### Inputs
- share API responses
- comparison context

### Outputs
- share dialog/page for invite, recipient list, and revoke actions.

### Contract
- UI supports multiple email entry.
- UI clearly marks invitees as view-only.

### Constraints
- Owner/admin-only management controls.
- Clear error handling for denied/invalid invites.

### Acceptance Criteria
1. Owner can invite multiple emails from UI.
2. Owner can view current recipient list and revoke access.
3. UI state remains consistent after invite/revoke actions.

### AI Prompt (Execution-Ready)
```text
Build Stage 5 sharing UI with multi-email invite, recipient list, and revoke controls.
Keep invitee permission as view-only and handle API errors with deterministic UI states.
```

---

## S5-06 Implement Notifications Baseline (Complete/Fail)

### Story Metadata
- Story ID: `S5-06`
- Title: `Implement Notifications Baseline (Complete/Fail)`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE/FE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-013`
- Stage acceptance link(s): `Stage 5 bullet 4`
- Decision link(s): `V1_DECISIONS.md` items `7`, `48`

### Inputs
- comparison job completion/failure events
- notification config flags

### Outputs
- in-app notifications (required)
- optional email notifications (config enabled)

### Contract
- Minimum event triggers:
  - comparison completed
  - comparison failed

### Constraints
- Deep links must require authentication.
- Non-trigger events are out of scope in Stage 5.

### Acceptance Criteria
1. In-app notifications are created for complete/fail outcomes.
2. Email notifications are sent only when email config is enabled.
3. Notification links route authenticated users to target comparison context.

### AI Prompt (Execution-Ready)
```text
Implement Stage 5 notifications baseline for comparison complete/fail events.
In-app notifications are required, email is optional by config, and links must remain auth-protected.
```

---

## S5-07 Build Full Admin UI for Upload Policy Overrides

### Story Metadata
- Story ID: `S5-07`
- Title: `Build Full Admin UI for Upload Policy Overrides`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `FE/BE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-014`
- Stage acceptance link(s): `Stage 5 bullet 5`
- Decision link(s): `V1_DECISIONS.md` items `44`, `45`

### Inputs
- admin identity (DB role claim)
- target user selection and policy action

### Outputs
- admin user list/search UI
- reset/override actions and confirmation state

### Contract
- Admin endpoints require DB role-claim authorization.
- Non-admin access returns denied response.

### Constraints
- Admin actions must be audit logged.
- No Entra-group admin authority in V1.

### Acceptance Criteria
1. Admin can search/list users in admin UI.
2. Admin can reset cooldown/apply override from UI.
3. Non-admin users cannot access admin features or APIs.

### AI Prompt (Execution-Ready)
```text
Implement full Stage 5 admin UI for upload policy reset/override actions.
Enforce DB role-claim authorization, deny non-admin access, and persist audit events.
```

---

## S5-08 Implement Stage 5 Retention Defaults

### Story Metadata
- Story ID: `S5-08`
- Title: `Implement Stage 5 Retention Defaults`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `BE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-015`
- Stage acceptance link(s): `Stage 5 bullets 1-5`
- Decision link(s): `V1_DECISIONS.md` item `46`

### Inputs
- export artifacts, notifications, share records

### Outputs
- retention enforcement jobs/rules for Stage 5 defaults

### Contract
- Export artifacts retention: 7 days
- Notifications retention: 90 days
- Share records retained until revoke/session deletion

### Constraints
- Retention operations must be tenant-safe and auditable.

### Acceptance Criteria
1. Export artifacts older than 7 days are deleted by policy.
2. Notifications older than 90 days are deleted by policy.
3. Share records remain until revoke or owning session deletion.

### AI Prompt (Execution-Ready)
```text
Implement Stage 5 retention defaults for export artifacts, notifications, and share records.
Enforce tenant-safe lifecycle jobs and keep retention actions auditable.
```

---

## S5-09 Add Stage 5 Automated Tests (Backend + Browser)

### Story Metadata
- Story ID: `S5-09`
- Title: `Add Stage 5 Automated Tests (Backend + Browser)`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `QA/BE/FE`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-010`, `FR-012`, `FR-013`, `FR-014`, `FR-015`
- Stage acceptance link(s): `Stage 5 bullets 1-5`
- QA matrix link(s): items `10`, `11`

### Scope
- Export tests (CSV/Excel, full dataset default)
- Share invite/revoke tests (same-tenant, exact-email auth)
- Notification complete/fail tests
- Admin UI/API authorization tests
- Retention policy enforcement tests

### Acceptance Criteria
1. Stage 5 acceptance bullets are mapped to automated tests.
2. Browser tests cover share/admin critical flows.
3. CI failures are diagnostic with actionable artifacts.

### AI Prompt (Execution-Ready)
```text
Add Stage 5 backend and browser test coverage for exports, sharing, notifications, admin UI, and retention defaults.
Map tests directly to Stage 5 acceptance criteria and produce actionable diagnostics on failures.
```

---

## S5-10 Stage 5 Rollout, Observability, and Runbook Closeout

### Story Metadata
- Story ID: `S5-10`
- Title: `Stage 5 Rollout, Observability, and Runbook Closeout`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `BE/DevOps`
- Sprint: `S5`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-AUDIT`, `NFR-RELIABILITY`
- Stage acceptance link(s): `Stage 5 bullets 1-5`

### Inputs
- Stage 5 feature flags
- logging/metrics pipeline

### Outputs
- rollout plan and rollback runbook
- dashboard/alert wiring for Stage 5 operations

### Contract
- Monitor:
  - export success/failure rate
  - share invite/revoke events
  - admin override actions
  - notification generation/delivery counts

### Constraints
- Rollout must preserve Stage 1-4 behavior.
- Parked V2/V3 clarifications remain documented, not silently implemented.

### Acceptance Criteria
1. Stage 5 feature flags and rollback paths are documented and tested in non-prod.
2. Stage 5 metrics and alert paths are available for operations.
3. Runbooks include incident and rollback steps for Stage 5 surfaces.

### AI Prompt (Execution-Ready)
```text
Finalize Stage 5 rollout controls, observability, and runbooks.
Add Stage 5 metrics/alerts and validate rollback behavior in non-production before release.
```

---

## Story Dependency Map

- `S5-01` -> `S5-02`.
- `S5-03` -> `S5-04` -> `S5-05`.
- `S5-06` can run in parallel with sharing work after base event contracts are stable.
- `S5-07` depends on admin authorization baseline from Stage 1 and policy services from Stage 2.
- `S5-08` depends on Stage 5 artifact persistence surfaces.
- `S5-09` spans all stories as the final quality gate.
- `S5-10` starts early and closes at cutover.

## Stage 5 Definition of Done (Backlog-Level)

- CSV and Excel exports work with locked V1 export contract.
- Sharing supports multi-invite, same-tenant, exact-email access, and revoke.
- Notifications baseline (complete/fail) is operational with in-app required and optional email.
- Admin UI supports reset/override actions with DB role-claim enforcement.
- Stage 5 retention defaults are enforced and test-covered.
