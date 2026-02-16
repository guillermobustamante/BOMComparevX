# BACKLOG_S1.md

## Sprint S1 Backlog (Ticket-Ready)

This backlog expands `S1-01` to `S1-09` from `SPRINT_PLAN.md` into execution-ready stories.

## Completion Snapshot
- Last updated: `2026-02-16`
- Completed: `S1-01`, `S1-02`, `S1-03`, `S1-04`, `S1-05`, `S1-06`, `S1-07`, `S1-08`, `S1-09`
- Remaining in Sprint S1: `None`

---

## S1-01 Implement Google OAuth Login Flow

### Story Metadata
- Story ID: `S1-01`
- Title: `Implement Google OAuth Login Flow`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-001`
- Stage acceptance link(s): `Stage 1 bullet 1`
- Decision link(s): None

### User Story
As a user, I want to sign in with Google so I can securely access the platform.

### Business Value
- Why this story matters now: Required authentication provider for Stage 1 completion.
- Risk if delayed: Stage 1 cannot close.

### Scope
- In scope:
  - OAuth start + callback flow.
  - Session creation for successful auth.
  - Standardized auth error handling.
- Out of scope:
  - Microsoft OAuth.
  - Post-auth upload redirect UX logic (`S1-03`).

### Inputs
- Trigger/API/UI input:
  - `GET /auth/google/start`
  - `GET /auth/google/callback?code=<code>&state=<state>`
- Required fields and types:
  - `code: string`, `state: string`
- Preconditions:
  - Google app registration and callback URL configured.
- Auth/Tenant context required:
  - Unauthenticated entry; tenant resolved after identity mapping.

### Outputs
- Success outputs (payload, redirect, state change):
  - Auth session established.
  - User identity created/linked.
  - Redirect to app-authenticated route.
- Failure outputs (error payload, UI state):
  - Standard error response with safe message.
- Side effects (events, history/audit records):
  - Auth success/failure audit event.

### Contract
- Endpoint(s)/event(s):
  - `/auth/google/start`, `/auth/google/callback`
- Request schema:
  - Callback query `{ code: string, state: string }`
- Response schema:
  - Success: session cookie/token + redirect
  - Failure: `{ code: string, message: string, correlationId: string }`
- Status/error codes:
  - `302` start redirect
  - `200|302` success callback
  - `400|401` invalid/denied callback
- Idempotency/retry behavior:
  - Repeated valid callback does not create duplicate user.
- Versioning notes:
  - V1 auth contract.

### Constraints
- Security constraints:
  - Validate OAuth `state`.
  - Never log provider secrets or tokens.
- Performance constraints:
  - Callback completes within normal web request timeout.
- Compliance/audit constraints:
  - Audit success/failure with correlation ID.
- Environment/config constraints:
  - Provider keys from secrets store.
- Time/date constraints (UTC, cooldown windows, retention timing):
  - Timestamps stored in UTC.

### Acceptance Criteria
1. User can authenticate through Google OAuth successfully.
2. Failed/denied login returns standardized error and no session.
3. Existing user is linked deterministically (no duplicate account creation).

### Test Plan
- Unit tests:
  - State validation, identity merge, error mapping.
- Integration tests:
  - Start/callback success and denial paths.
- E2E/manual tests:
  - Browser sign-in with Google in Test.
- Test data/fixtures:
  - OAuth mock profile payload.
- Observability checks (logs/metrics/traces):
  - Auth success/failure counters and correlation ID logs.

### Dependencies
- Upstream systems/services:
  - Google OAuth provider.
- Infrastructure prerequisites:
  - Secret config and callback route exposure.
- Blockers:
  - Missing provider credentials.

### Actionable Subtasks
1. Create auth endpoints and provider config wiring.
2. Implement callback validation and token exchange.
3. Implement user identity create/link logic.
4. Implement session creation + secure cookie/token settings.
5. Add audit logging hooks.
6. Add tests and docs.

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
```text
You are implementing story S1-01: Implement Google OAuth Login Flow.

Objective:
Implement Google OAuth start/callback authentication with secure session creation and standardized failure handling.

In Scope:
- /auth/google/start and /auth/google/callback
- Identity create/link and session issue
- Audit events for success/failure

Out of Scope:
- Microsoft OAuth
- Upload page redirect UX logic beyond normal authenticated flow

Inputs:
- GET /auth/google/start
- GET /auth/google/callback?code&state

Outputs:
- Success: authenticated session + redirect
- Failure: { code, message, correlationId }

Contract:
- Start returns 302 to provider
- Callback returns 200/302 on success, 400/401 on failure
- Repeated callbacks do not duplicate users

Constraints:
- Validate state, avoid sensitive logs, UTC timestamps
- Use environment-based provider credentials

Acceptance Criteria:
1. Google auth success creates session
2. Failure path is safe and standardized
3. Identity linking is deterministic

Required Tests:
- Unit: state validation + identity link
- Integration: auth success/deny callback
- Manual: browser sign-in in Test

Deliverables:
- Code, tests, and change summary mapped to acceptance criteria.
```

---

## S1-02 Implement Microsoft OAuth Login Flow

### Story Metadata
- Story ID: `S1-02`
- Title: `Implement Microsoft OAuth Login Flow`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-001`
- Stage acceptance link(s): `Stage 1 bullet 1`
- Decision link(s): None

### User Story
As a user, I want to sign in with Microsoft so I can securely access the platform.

### Scope
- In scope: Microsoft OAuth start/callback, session issuance, standardized errors.
- Out of scope: Google flow changes except shared abstraction.

### Inputs
- `GET /auth/microsoft/start`
- `GET /auth/microsoft/callback?code=<code>&state=<state>`

### Outputs
- Success: authenticated session + redirect.
- Failure: standardized auth error response.
- Side effects: auth success/failure audit event.

### Contract
- Endpoints: `/auth/microsoft/start`, `/auth/microsoft/callback`
- Response/error model: same contract as `S1-01`
- Status codes: `302`, `200|302`, `400|401`
- Idempotency: no duplicate user creation on retries.

### Constraints
- State validation and secure token handling.
- Tenant/user resolution deterministic.
- UTC timestamps and correlation IDs.

### Acceptance Criteria
1. User can authenticate via Microsoft OAuth.
2. Failure/denied callback creates no session and returns safe error.
3. Existing identity is linked without duplication.

### Test Plan
- Unit: state + profile mapping.
- Integration: Microsoft callback success/failure.
- Manual: browser sign-in in Test.

### Dependencies
- Microsoft app registration + credentials.

### Actionable Subtasks
1. Add provider configuration and endpoints.
2. Implement callback validation/token exchange.
3. Reuse shared identity/session logic.
4. Add tests and audit checks.

### AI Prompt (Execution-Ready)
```text
Implement S1-02 equivalent to S1-01 for Microsoft OAuth.
Keep contract parity with Google endpoints and shared error model.
Add tests for success/denial and ensure deterministic identity linking.
```

---

## S1-03 Build Post-Auth Redirect to Upload Page

### Story Metadata
- Story ID: `S1-03`
- Title: `Build Post-Auth Redirect to Upload Page`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `FE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-001`
- Stage acceptance link(s): `Stage 1 bullet 2`

### User Story
As an authenticated user, I want to land on the upload page immediately after login.

### Inputs
- UI auth completion event.
- Optional `returnTo` parameter when navigating from a protected page.

### Outputs
- Success: route set to upload page by default.
- Failure: user remains unauthenticated and on sign-in flow.

### Contract
- Routing behavior:
  - Default route after successful auth is `/upload`.
  - If valid `returnTo` exists and is safe/internal, honor it.
- Error states:
  - Invalid `returnTo` ignored and fallback to `/upload`.

### Constraints
- No open redirect vulnerabilities.
- Route guard compatibility with protected routes.

### Acceptance Criteria
1. Successful auth lands user on upload page.
2. Unsafe or external redirect targets are rejected.
3. Redirect behavior is consistent across Google and Microsoft auth.

### Test Plan
- Unit: redirect target sanitizer.
- Integration: auth completion to `/upload`.
- Manual: login from home and from protected-route redirect.

### Dependencies
- Auth session availability from `S1-01` and `S1-02`.

### Actionable Subtasks
1. Implement post-auth redirect handler.
2. Add `returnTo` sanitization.
3. Add route tests and manual checklist.

### AI Prompt (Execution-Ready)
```text
Implement S1-03 by enforcing /upload as default post-login destination.
Support safe internal returnTo only; block external redirects.
Add tests for default, valid returnTo, and invalid returnTo.
```

---

## S1-04 Add Protected Route Middleware/Guards

### Story Metadata
- Story ID: `S1-04`
- Title: `Add Protected Route Middleware/Guards`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-002`
- Stage acceptance link(s): `Stage 1 bullet 3`

### User Story
As a system owner, I need protected routes blocked for unauthenticated users.

### Inputs
- Incoming request to protected endpoint/page.
- Auth session/token from cookie/header.

### Outputs
- Authenticated request proceeds.
- Unauthenticated request rejected or redirected to login.
- Side effect: access denied audit event when blocked.

### Contract
- Middleware on all protected APIs and pages.
- Standard unauthorized responses:
  - API: `401` with `{ code, message, correlationId }`
  - UI: redirect to sign-in.

### Constraints
- Consistent behavior across API and UI routes.
- Correlation IDs for denied access events.

### Acceptance Criteria
1. Unauthenticated access to protected pages is blocked.
2. Protected APIs return `401` for missing/invalid auth.
3. Authenticated users can access protected routes normally.

### Test Plan
- Unit: middleware auth checks.
- Integration: protected route pass/fail.
- Manual: direct URL navigation while signed out.

### Dependencies
- Session validation logic from auth stories.

### Actionable Subtasks
1. Create common auth guard/middleware.
2. Apply to protected endpoints/pages.
3. Standardize unauthorized API response.
4. Add denial audit hook and tests.

### AI Prompt (Execution-Ready)
```text
Implement route protection middleware for API and UI protected paths.
Reject unauthenticated requests with standardized 401 API contract and UI redirect.
Add coverage for pass/fail route access and denial audits.
```

---

## S1-05 Enforce Tenant-Scoped Data Access Baseline

### Story Metadata
- Story ID: `S1-05`
- Title: `Enforce Tenant-Scoped Data Access Baseline`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-002`
- Stage acceptance link(s): `QA matrix item 2`

### User Story
As a tenant user, I want access restricted to my tenant’s data.

### Inputs
- Authenticated user context with `tenantId`.
- API/data queries requiring tenant scoping.

### Outputs
- Data results filtered by requester tenant.
- Cross-tenant requests denied.

### Contract
- Tenant filter required on every data path.
- Authorization failure returns `403` with standard error payload.

### Constraints
- Mandatory tenant filter in repository/query layer.
- No bypass path in service/controller layers.

### Acceptance Criteria
1. Cross-tenant access attempts are denied.
2. Tenant filter is applied in all relevant data reads/writes.
3. Integration tests demonstrate denial of cross-tenant access.

### Test Plan
- Unit: tenant filter injection.
- Integration: cross-tenant read/write denial.
- Manual: token tampering negative test.

### Dependencies
- Tenant ID available in auth/session claims.

### Actionable Subtasks
1. Add tenant context propagation middleware.
2. Enforce tenant filter in repository layer.
3. Add guardrails/checks in PR template or static assertions.
4. Add integration tests for cross-tenant denial.

### AI Prompt (Execution-Ready)
```text
Implement tenant isolation baseline so all data access is tenant-scoped.
Return 403 for cross-tenant attempts with standard error model.
Add integration tests that prove denial for cross-tenant reads/writes.
```

---

## S1-06 Create Responsive App Shell and Authenticated Layout

### Story Metadata
- Story ID: `S1-06`
- Title: `Create Responsive App Shell and Authenticated Layout`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `FE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): Product Plan Stage 1 foundation
- Stage acceptance link(s): Supports Stage 1 user flow

### User Story
As an authenticated user, I need a stable shell layout that works on desktop and mobile.

### Inputs
- Authenticated app navigation.
- Viewport sizes (mobile/tablet/desktop).

### Outputs
- Consistent shell for authenticated routes.
- Accessible navigation to upload page.

### Contract
- Shell renders header/nav/content for authenticated routes.
- Responsive breakpoints documented.

### Constraints
- Maintain current design system patterns.
- Keyboard accessible primary nav and focus states.

### Acceptance Criteria
1. Authenticated shell renders consistently on supported viewports.
2. Upload route is reachable from shell navigation.
3. Layout does not break protected route flows.

### Test Plan
- Manual responsive checks (mobile + desktop).
- Accessibility smoke checks (tab/focus/labels).

### Dependencies
- Protected routes from `S1-04`.

### Actionable Subtasks
1. Build authenticated shell component.
2. Wire route container and nav links.
3. Add responsive CSS and accessibility checks.

### AI Prompt (Execution-Ready)
```text
Implement a responsive authenticated shell for Stage 1 routes.
Keep design-system consistency, ensure upload route visibility, and verify mobile/desktop behavior.
```

---

## S1-07 Add Auth/Authorization Audit Events

### Story Metadata
- Story ID: `S1-07`
- Title: `Add Auth and Authorization Audit Events`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `BE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): `NFR-SECURITY`, `NFR-AUDIT`
- Stage acceptance link(s): Stage 1 operational hardening support

### User Story
As an operator, I need auditable records for login and access decisions.

### Inputs
- Auth success/failure events.
- Authorization denied events.

### Outputs
- Structured audit events with actor, tenant, timestamp, outcome, correlation ID.

### Contract
- Event names:
  - `auth.login.success`
  - `auth.login.failure`
  - `auth.access.denied`
- Required fields:
  - `eventType, userId?, tenantId?, provider?, outcome, reason?, correlationId, occurredAtUtc`

### Constraints
- No sensitive secret/token values in audit records.
- UTC timestamps required.
- Write failures should not crash user-facing auth flow.

### Acceptance Criteria
1. Success/failure login events are emitted.
2. Access-denied events are emitted for blocked protected-route access.
3. Audit payload includes correlation ID and UTC timestamp.

### Test Plan
- Unit: event payload builder.
- Integration: verify event emission on auth and denial paths.

### Dependencies
- Auth and guard logic from `S1-01` through `S1-04`.

### Actionable Subtasks
1. Define audit event schema.
2. Emit events in auth and guard layers.
3. Add tests and log validation.

### AI Prompt (Execution-Ready)
```text
Implement structured audit events for auth success/failure and access denied.
Use required event schema with UTC timestamps and correlation IDs.
Ensure no secrets/tokens are written to logs.
```

---

## S1-08 Add Automated Tests for Stage 1 Acceptance

### Story Metadata
- Story ID: `S1-08`
- Title: `Add Automated Tests for Stage 1 Acceptance`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `QA/BE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-001`, `FR-002`
- Stage acceptance link(s): `Stage 1 bullets 1-3`, `QA matrix item 1`

### User Story
As a team, we need automated confidence that Stage 1 behavior remains correct.

### Inputs
- Test fixtures for authenticated and unauthenticated users.
- Tenant-separated fixture data.

### Outputs
- Automated test suite covering auth and route protection baseline.
- CI pass/fail signal for Stage 1.

### Contract
- Required coverage areas:
  - Google/Microsoft auth success and failure.
  - Protected route block for unauthenticated users.
  - Cross-tenant denial path.
- Exit contract:
  - Tests must pass in CI for Stage 1 completion.

### Constraints
- Tests deterministic and environment-safe.
- Avoid flakiness from external OAuth calls via mocks/stubs in automated runs.

### Acceptance Criteria
1. Automated tests exist for all Stage 1 done-when bullets.
2. Tests run in CI and block merge on failure.
3. Cross-tenant denial is explicitly tested.

### Test Plan
- Unit: auth guard/utils.
- Integration: auth callbacks and protected endpoints.
- E2E/manual: sanity sign-in on Test environment.

### Dependencies
- Stories `S1-01` to `S1-07` implemented or stubbed.

### Actionable Subtasks
1. Build test matrix mapped to Stage 1 acceptance bullets.
2. Implement missing unit/integration tests.
3. Add CI checks and reporting.
4. Add manual smoke checklist for Test environment.

### AI Prompt (Execution-Ready)
```text
Implement S1-08 by adding automated coverage for all Stage 1 acceptance criteria.
Use deterministic mocks for OAuth in CI, include cross-tenant denial integration tests,
and ensure failures block merge.
```

---

## Sequencing and Parallelization

- Parallel lane A: `S1-09` provisioning track plus `S1-01` and `S1-02` implementation track.
- Parallel lane B: `S1-06` shell scaffolding.
- Follow-on: `S1-03` and `S1-04` once auth endpoints stabilize.
- Security/data hardening: `S1-05` and `S1-07`.
- Final gate: `S1-08` acceptance automation and CI enforcement.

## Ready Checklist (Per Story)

A story is `Ready` only when all are true:
1. Inputs/outputs/contracts are filled and unambiguous.
2. Constraints include security + environment details.
3. Dependencies are explicitly not blocked.
4. Acceptance criteria are testable and mapped to `V1_SPEC.md`.
5. AI Prompt is present and scoped to in-story work only.
---

## S1-09 Identity Provider Provisioning and Secret Management

### Story Metadata
- Story ID: `S1-09`
- Title: `Identity Provider Provisioning and Secret Management`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `DevOps/BE`
- Sprint: `S1`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-001`
- Stage acceptance link(s): `Stage 1 bullet 1`
- Decision link(s): Deployment preference in `V1_DECISIONS.md` (Azure-oriented stack)

### User Story
As an engineering team, we need OAuth provider credentials securely provisioned per environment so Google and Microsoft login can run safely in Dev/Test/Prod.

### Business Value
- Why this story matters now: Unblocks `S1-01` and `S1-02` from being environment-blocked.
- Risk if delayed: Auth stories may complete in code but fail in real environments.

### Scope
- In scope:
  - Create Google and Microsoft app registrations.
  - Configure callback URLs for Dev/Test/Prod.
  - Store client IDs/secrets in Azure Key Vault.
  - Wire runtime configuration to retrieve secrets without hardcoding.
  - Document secret rotation and access policy.
- Out of scope:
  - End-user auth UX and routing behavior.
  - Tenant authorization logic.

### Inputs
- Trigger/API/UI input:
  - Infrastructure setup request for OAuth providers.
- Required fields and types:
  - Environment names, callback URLs, tenant/domain constraints.
- Preconditions:
  - Azure subscription/resource group and Key Vault exist.
- Auth/Tenant context required:
  - Platform/admin permissions for provider portals and Azure Key Vault.

### Outputs
- Success outputs (payload, redirect, state change):
  - Provider credentials available via secure runtime config.
  - Verified callback registrations in each environment.
- Failure outputs (error payload, UI state):
  - Setup checklist indicates blocking config missing.
- Side effects (events, history/audit records):
  - Audit trail for secret creation/updates via platform logs.

### Contract
- Endpoint(s)/event(s):
  - Config contract exposed to auth modules:
    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
    - `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
    - Provider callback URL config per environment
- Request schema:
  - N/A (infrastructure/config story)
- Response schema:
  - N/A (verification checklist + smoke results)
- Status/error codes:
  - N/A
- Idempotency/retry behavior:
  - Re-running provisioning updates existing registrations/secrets safely.
- Versioning notes:
  - V1 baseline provider config contract.

### Constraints
- Security constraints:
  - Secrets never committed to repository.
  - Least-privilege access to Key Vault.
  - Secrets masked in logs and CI output.
- Performance constraints:
  - Runtime secret retrieval should not materially increase auth latency.
- Compliance/audit constraints:
  - Secret create/update actions auditable.
- Environment/config constraints:
  - Separate credentials per Dev/Test/Prod.
  - Local development uses `.env.local` only (gitignored).
- Time/date constraints (UTC, cooldown windows, retention timing):
  - Rotation timestamps tracked in UTC.

### Acceptance Criteria
1. Google and Microsoft app registrations exist with correct callback URLs for Dev/Test/Prod.
2. OAuth credentials are stored in Azure Key Vault and consumed at runtime without hardcoded secrets.
3. Runbook documents secret rotation, required permissions, and smoke validation steps.

### Test Plan
- Unit tests:
  - N/A
- Integration tests:
  - Startup config load verifies required secrets exist.
- E2E/manual tests:
  - Smoke auth flow for both providers in Dev and Test.
- Test data/fixtures:
  - Non-production OAuth apps and test users.
- Observability checks (logs/metrics/traces):
  - Config load errors and auth failure metrics visible.

### Dependencies
- Upstream systems/services:
  - Google Cloud Console, Microsoft Entra app registrations.
- Infrastructure prerequisites:
  - Azure Key Vault access and managed identity/app identity setup.
- Blockers:
  - Missing platform admin permissions.

### Actionable Subtasks
1. Create provider app registrations and callback URL matrix.
2. Create Key Vault secrets for each environment.
3. Wire runtime secret retrieval and fail-fast config checks.
4. Add smoke checklist for Dev/Test provider login.
5. Document rotation runbook and ownership.

### Definition of Done
- Implementation complete and merged.
- Tests/checks added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
```text
You are implementing story S1-09: Identity Provider Provisioning and Secret Management.

Objective:
Provision Google/Microsoft OAuth credentials securely across Dev/Test/Prod and expose them to runtime config without storing secrets in code.

In Scope:
- Provider app registrations and callback URLs
- Azure Key Vault secret setup
- Runtime config wiring and fail-fast checks
- Rotation/runbook documentation

Out of Scope:
- OAuth UX flows and route behavior

Inputs:
- Environment list and callback URL matrix
- Access to provider portals and Azure Key Vault

Outputs:
- Runtime-available secrets and validated provider setup in Dev/Test

Contract:
- Required config keys:
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  - MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
- Per-environment callback URL mapping

Constraints:
- No secrets in repo/logs
- Least-privilege Key Vault access
- Separate credentials per environment

Acceptance Criteria:
1. Registrations and callbacks complete for all environments
2. Secrets loaded from Key Vault at runtime
3. Rotation and smoke-test runbook documented

Required Tests:
- Integration: startup config validation
- Manual: auth smoke on Dev/Test for both providers

Deliverables:
- Config/infrastructure updates, validation checks, and runbook updates.
```
