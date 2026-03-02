# BACKLOG_S8.md

## Sprint S8 Backlog (Ticket-Ready)

This backlog expands Sprint S8 (Stage 8 - Security + Compliance Baseline Closure) from `SPRINT_PLAN.md` into execution-ready stories.

Source precedence:
- `V1_DECISIONS.md` for locked Stage 8 behaviors.
- `V1_SPEC.md` for stage acceptance criteria.
- `PRODUCT_PLAN.md` for Stage 8 rollout intent.
- `docs/DELTA_PREVIOUSDOCS_DEVOPS.md` and `docs/PreviousDocs/User Stories - DevOps.xlsx` (`494`, `495`, `500`, `501`, `503`, `504`) for legacy traceability.

## Delivery Guardrails (Stage 8)

1. Security controls must fail closed:
- protected endpoints should reject when policy checks fail or misconfigure.

2. Compliance evidence must be durable:
- consent, audit export, and archive actions must be timestamped and attributable.

3. Scope boundary:
- Stage 8 hardens existing platform services (especially audit export) and does not rebuild core Stage 6/7 engines.

4. Role and tenant safety:
- all Stage 8 admin/compliance actions remain tenant-safe and DB role-claim authorized.

5. AI-first execution:
- stories are scoped for Codex execution; human input is only required for environment rollout and external service wiring.

---

## S8-01 Implement API Rate-Limiting and Abuse Controls

### Story Metadata
- Story ID: `S8-01`
- Title: `Implement API Rate-Limiting and Abuse Controls`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Platform)`
- Sprint: `S8`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-SEC-015`
- Stage acceptance link(s): `Stage 8 bullet 1`
- Decision link(s): `V1_DECISIONS.md` items `98`, `99`, `100`, `101`
- Legacy link(s): `User Stories - DevOps.xlsx` row `500`

### Inputs
- API route catalog with sensitivity/cost class (upload/diff/export/general).
- Tenant/session identity context.
- Gateway and backend middleware capability.

### Outputs
- Active gateway + app-layer rate limiting.
- Structured 429 response contract and abuse telemetry.

### Contract
- Baseline limit: `100 req/min`.
- Heavy routes (upload/diff/export) get stricter route-specific caps.
- Authenticated key: `tenantId`.
- Unauthenticated key: client IP fallback.
- Exemptions: admin/service allowlist, still audited.
- Response on breach: `429 Too Many Requests` with deterministic error code.

### Constraints
- Do not break normal user flows under expected usage.
- No cross-tenant leakage through throttle buckets.

### Acceptance Criteria
1. Baseline and route-specific limits are enforced and test-covered.
2. Authenticated and unauthenticated keying behavior matches locked policy.
3. Allowlist bypass is auditable and can be revoked.

### AI Prompt (Execution-Ready)
```text
Implement Stage 8 rate limiting at gateway and app layers.
Use tenant-scoped keys for authenticated requests, IP fallback for unauthenticated requests, baseline 100 req/min, stricter caps for upload/diff/export, and auditable allowlist exemptions.
```

---

## S8-02 Add Terms/Privacy Consent Version Tracking

### Story Metadata
- Story ID: `S8-02`
- Title: `Add Terms/Privacy Consent Version Tracking`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (FE/BE)`
- Sprint: `S8`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-COMP-006`
- Stage acceptance link(s): `Stage 8 bullets 2-3`
- Decision link(s): `V1_DECISIONS.md` items `102`, `103`
- Legacy link(s): `User Stories - DevOps.xlsx` row `503`

### Inputs
- Current authenticated user session.
- Versioned Terms/Privacy identifiers and content links.

### Outputs
- Persisted acceptance records per user with Terms and Privacy versions.
- Login gate that enforces re-acceptance after policy updates.

### Contract
- Separate fields: `termsVersion`, `privacyVersion`.
- Persist: `userEmail`, `tenantId`, `acceptedAtUtc`, versions.
- On version mismatch, block app access until acceptance.

### Constraints
- Consent evidence must be immutable append-only records.
- Consent prompt must not expose protected routes until accepted.

### Acceptance Criteria
1. First login requires acceptance before proceeding.
2. Policy version update forces re-accept on next login.
3. Consent records are queryable for compliance review.

### AI Prompt (Execution-Ready)
```text
Add a Terms/Privacy consent gate with separate version tracking and acceptance timestamps.
Require re-acceptance when either version changes, and store durable compliance evidence per user.
```

---

## S8-03 Complete History Parity (Rename/Tag/Delete) with Audit

### Story Metadata
- Story ID: `S8-03`
- Title: `Complete History Parity (Rename/Tag/Delete) with Audit`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (FE/BE)`
- Sprint: `S8`
- Status: `Ready`

### Traceability
- Requirement link(s): `FR-010`
- Stage acceptance link(s): `Stage 8 bullets 4-5`
- Decision link(s): `V1_DECISIONS.md` items `104`, `105`
- Legacy link(s): `User Stories - DevOps.xlsx` rows `494`, `495`

### Inputs
- Existing history/comparison metadata.
- Owner identity and tenant scope.

### Outputs
- Rename, single-label tag, and soft-delete operations on history records.
- Audit events for every state-changing action.

### Contract
- Tag model: single owner-private label (`<= 50` chars).
- Delete semantics: soft delete only (logical hide/deactivate), no immediate physical delete.
- API contract includes deterministic result codes for unauthorized/not-found/deleted states.

### Constraints
- Owner or authorized scope only; cross-tenant operations forbidden.
- Delete must preserve compliance/audit trail.

### Acceptance Criteria
1. Rename/tag/delete UI actions are available and persisted.
2. Soft-deleted records no longer appear in default history listing.
3. Audit events contain actor, target, action, and timestamp.

### AI Prompt (Execution-Ready)
```text
Implement history rename, single-label tagging, and soft-delete with tenant-safe authorization.
Emit audit events for all actions and preserve immutable audit evidence.
```

---

## S8-04 Harden Audit Export Governance and Archive Policy

### Story Metadata
- Story ID: `S8-04`
- Title: `Harden Audit Export Governance and Archive Policy`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `AI Coding Agent (BE)`
- Sprint: `S8`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-AUDIT`, `NFR-COMP-004`, `NFR-COMP-009`
- Stage acceptance link(s): `Stage 8 bullets 6-7`
- Decision link(s): `V1_DECISIONS.md` items `106`, `107`, `109`
- Legacy link(s): `User Stories - DevOps.xlsx` row `504`

### Inputs
- Existing Stage 6 audit export APIs.
- Admin role-claim authorization.
- Storage target for archive artifacts.

### Outputs
- Governance hardening over existing export APIs (no rebuild).
- Daily append-only audit archive workflow with retention metadata.

### Contract
- Authorized role: DB admin role claim.
- Export access remains tenant-scoped.
- Daily archive written append-only to Azure Blob (GRS target).
- Retention target metadata: 7+ years.

### Constraints
- Archive writes must not mutate or rewrite historical files.
- Governance changes must remain backward compatible with existing export clients.

### Acceptance Criteria
1. Existing audit export APIs enforce hardened authorization and scope checks.
2. Daily append-only archive job executes with verifiable metadata.
3. Archive evidence is available for compliance review.

### AI Prompt (Execution-Ready)
```text
Harden Stage 6 audit export governance in-place (no service rebuild).
Add daily append-only archive to Blob with geo-redundancy assumptions and 7+ year retention target metadata.
```

---

## S8-05 Add Secure SDLC CI Security/License/Secret Gates

### Story Metadata
- Story ID: `S8-05`
- Title: `Add Secure SDLC CI Security/License/Secret Gates`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (DevOps)`
- Sprint: `S8`
- Status: `Ready`

### Traceability
- Requirement link(s): `NFR-SEC-011`, `NFR-SEC-012`, `NFR-SEC-013`
- Stage acceptance link(s): `Stage 8 bullet 8`
- Decision link(s): `V1_DECISIONS.md` item `108`
- Legacy link(s): `User Stories - DevOps.xlsx` row `501`

### Inputs
- Existing CI pipeline.
- Dependency vulnerability scanner.
- Secret scanning tooling.
- License policy file.

### Outputs
- Blocking CI gates for security and compliance hygiene.

### Contract
- CI fails on:
  - high/critical vulnerabilities
  - secret scan hits
  - license policy violations.
- CI artifacts publish actionable report summaries.

### Constraints
- Gates must run deterministically in CI and local preflight where possible.
- Avoid noisy false positives by controlled ignore/allowlist process with audit trail.

### Acceptance Criteria
1. CI fails under the three blocked conditions.
2. Developers receive clear failure diagnostics and remediation guidance.
3. Gate configuration is documented in runbook.

### AI Prompt (Execution-Ready)
```text
Add secure SDLC CI gates that block on high/critical vulnerabilities, secret exposures, and license-policy violations.
Publish concise artifacts/logs so failures are actionable.
```

---

## S8-06 Stage 8 Automated Tests + Compliance Runbook Closeout

### Story Metadata
- Story ID: `S8-06`
- Title: `Stage 8 Automated Tests + Compliance Runbook Closeout`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (QA/DevOps)`
- Sprint: `S8`
- Status: `Ready`

### Traceability
- Requirement link(s): `Stage 8 acceptance criteria`
- Stage acceptance link(s): `Stage 8 bullets 1-9`
- Decision link(s): `V1_DECISIONS.md` items `98`-`109`

### Inputs
- Completed S8-01 through S8-05 implementation.
- Existing backend e2e and Playwright suites.

### Outputs
- Automated regression coverage for all Stage 8 controls.
- Stage 8 operations/compliance runbook with rollout and rollback steps.

### Contract
- Test coverage must include:
  - 429 behavior and limit-key behavior
  - consent prompt and re-accept flows
  - history rename/tag/soft-delete audit traces
  - audit export governance enforcement and archive evidence
  - CI gate failure scenarios.

### Constraints
- Rollback instructions must preserve Stage 1-7 behavior.
- Compliance runbook must include evidence collection steps.

### Acceptance Criteria
1. Stage 8 acceptance bullets are mapped to automated tests.
2. Stage 8 runbook includes enable/disable and incident-response flow.
3. Verify-story baseline remains green after Stage 8 integration.

### AI Prompt (Execution-Ready)
```text
Implement Stage 8 automated coverage and runbook closeout.
Map each Stage 8 acceptance criterion to executable tests and document rollback-safe operational steps.
```

---

## Stage 8 Definition of Done (Backlog-Level)

- All S8 stories are implemented and test-covered.
- No open Stage 8 clarification items remain.
- Compliance evidence artifacts (consent/audit archive/CI gate records) are reproducible in Dev/Test.
