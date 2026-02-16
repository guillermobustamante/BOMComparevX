# BACKLOG_S2.md

## Sprint S2 Backlog (Ticket-Ready)

This backlog expands `S2-01` to `S2-09` from `SPRINT_PLAN.md` into execution-ready stories.

Source precedence used in this backlog:
- If `V1_SPEC.md` conflicts with `V1_DECISIONS.md`, product-owner decisions are applied.
- For S2 validation scope, allowed upload formats are locked to CSV/Excel (`CSV`, `XLS`, `XLSX`) per `V1_DECISIONS.md`.

## Delivery Guardrails (Applied from Stage 1 Lessons)

1. Route prefix consistency:
- All backend callback/API URLs must include `/api` in code, env, and provider portal settings.
- Add startup assertion to fail fast if callback URLs mismatch expected prefix.

2. Config initialization order:
- Load `.env.local` before Nest app bootstrap.
- Resolve required secrets before constructing modules that depend on them.

3. DI/module boundaries:
- Shared providers must live in dedicated modules and be imported, not duplicated in root module only.

4. Windows runtime compatibility:
- Avoid default imports for CommonJS-sensitive packages (`cookie-parser`, `express-session`, `passport`, `path`).
- Keep resilient cleanup scripts for frontend cache (`.next`).

5. Stable automated verification:
- Every story must pass `npm run verify:story`.
- Keep test-only endpoints gated by `ENABLE_TEST_ROUTES=true`.

6. Parallel install/test race prevention:
- Install dependencies before running parallelized checks; do not run install and test in the same parallel block.

7. Error contract discipline:
- Keep standardized error shapes: `{ code, message, correlationId }`.
- Add correlation IDs to upload/policy/queue failures.

## Definition of Ready (S2 Story)

A story is `Ready` only when all are true:
1. Inputs/outputs/contract/constraints are fully specified.
2. Storage/queue/schema dependencies are marked `Ready` in Test.
3. Error codes are listed and test cases mapped.
4. Story has API + browser verification steps.
5. `AI Prompt` is present and scoped.

---

## S2-01 Build Two-File Upload UI (Picker + Drag/Drop)

### Story Metadata
- Story ID: `S2-01`
- Title: `Build Two-File Upload UI (Picker + Drag/Drop)`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `FE`
- Sprint: `S2`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-003`
- Stage acceptance link(s): `Stage 2 bullet 1`

### User Story
As a user, I want to upload two files via picker or drag/drop so I can start a BOM comparison.

### Scope
- In scope:
  - Two-file upload card.
  - Drag/drop interaction.
  - Picker interaction.
  - File list preview before submit.
- Out of scope:
  - Diff results.
  - Column mapping.

### Inputs
- UI events: select/drop files.
- Allowed count: exactly 2 files for initial comparison.

### Outputs
- Success: two files staged and ready for submit.
- Failure: inline validation error state.

### Contract
- Frontend payload to intake endpoint (multipart):
  - `fileA`, `fileB`, `sessionId?`, `comparisonMode=initial`.
- Error surface must map backend error codes.

### Constraints
- Accessibility for drag/drop and file input.
- Mobile and desktop responsiveness.
- Deterministic ordering of file slots (`fileA`, `fileB`).

### Acceptance Criteria
1. User can select exactly two files via picker.
2. User can drag/drop exactly two files.
3. UI blocks submit unless two valid files are present.

### Test Plan
- Playwright: picker and drag/drop paths.
- Playwright: invalid count handling.

### Dependencies
- `S2-02` backend validation contract available.

### Actionable Subtasks
1. Add upload card component with two slots.
2. Add drag/drop handlers and file preview.
3. Connect submit action to intake API.
4. Add browser tests.

### AI Prompt (Execution-Ready)
```text
Implement S2-01 upload UI with exactly two-file requirement, supporting picker and drag/drop.
Enforce deterministic file slot ordering and surface backend validation errors using standard error contract.
Add Playwright coverage for happy path and invalid file count.
```

---

## S2-02 Add Server-Side File Validation with Immediate Rejection UX

### Story Metadata
- Story ID: `S2-02`
- Title: `Add Server-Side File Validation with Immediate Rejection UX`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE/FE`
- Sprint: `S2`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-003`
- Stage acceptance link(s): `Stage 2 bullet 2`

### Scope
- In scope:
  - Validate file count, format, and max size.
  - Return standardized errors.
  - Immediate frontend display of rejection reason.
- Out of scope:
  - Queue processing.

### Inputs
- Multipart upload: `fileA`, `fileB`.

### Outputs
- Success: validation pass and handoff to policy/enqueue flow in the same intake pipeline.
- Failure: `400` with error code/message/correlationId.

### Contract
- Allowed extensions: `CSV`, `XLS`, `XLSX` (V1 decision).
- Max file size per file: `30MB`.
- Error codes:
  - `UPLOAD_FILE_COUNT_INVALID`
  - `UPLOAD_FILE_TYPE_INVALID`
  - `UPLOAD_FILE_SIZE_EXCEEDED`

### Constraints
- Validate on backend even if frontend pre-validates.
- No file persisted if validation fails.

### Acceptance Criteria
1. Invalid type is rejected immediately with clear message.
2. File over size limit is rejected immediately with clear message.
3. Invalid file count is rejected with deterministic code.

### Test Plan
- Backend e2e for each rejection code.
- Browser test verifies mapped error banner.

### AI Prompt (Execution-Ready)
```text
Implement strict server-side upload validation for count/type/size and return standardized error codes.
Ensure frontend displays backend rejection messages immediately.
Add e2e coverage for all rejection paths.
```

---

## S2-03 Implement Onboarding Policy: First 3 Comparisons Unrestricted

### Story Metadata
- Story ID: `S2-03`
- Title: `Implement Onboarding Policy: First 3 Comparisons Unrestricted`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE`
- Sprint: `S2`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-004`, `V1_DECISIONS.md` upload policy decision
- Stage acceptance link(s): supports `Stage 2 bullet 3`

### Contract
- Policy state model per user:
  - `comparisonsUsed`
  - `cooldownUntilUtc`
- First 3 accepted uploads bypass cooldown check.

### Error Codes
- `UPLOAD_POLICY_STATE_UNAVAILABLE`

### Acceptance Criteria
1. Comparisons 1-3 are accepted when files are valid.
2. Policy state increments atomically after acceptance.

### Test Plan
- Backend e2e with seeded policy state transitions.

### AI Prompt (Execution-Ready)
```text
Implement onboarding policy where first 3 valid comparisons are unrestricted.
Persist and increment usage state atomically and expose policy fields for downstream checks.
```

---

## S2-04 Implement 48-Hour Cooldown After Credits Exhausted

### Story Metadata
- Story ID: `S2-04`
- Title: `Implement 48-Hour Cooldown After Credits Exhausted`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S2`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-004`, `V1_DECISIONS.md`
- Stage acceptance link(s): `Stage 2 bullet 3`

### Contract
- Cooldown check uses UTC timestamps only.
- Blocked response:
  - `429` (locked for S2 execution).
  - body: `{ code: "UPLOAD_COOLDOWN_ACTIVE", message, correlationId, cooldownUntilUtc }`

### Constraints
- Boundary tests around exact expiry timestamp.
- No local timezone logic.

### Acceptance Criteria
1. Attempt 4 within 48h is blocked with cooldown metadata.
2. Attempt after cooldown expiry is accepted.

### Test Plan
- Time-boundary e2e tests.

### AI Prompt (Execution-Ready)
```text
Implement 48-hour cooldown policy after onboarding credits are exhausted.
Use UTC comparisons and return deterministic cooldown metadata/error contract.
```

---

## S2-05 Render Blocked Banner, Disable Controls, Show "More Credits" Link

### Story Metadata
- Story ID: `S2-05`
- Title: `Render Blocked Banner, Disable Controls, Show More Credits Link`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `FE`
- Sprint: `S2`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-004`
- Stage acceptance link(s): `Stage 2 bullet 3`

### Contract
- Frontend consumes `UPLOAD_COOLDOWN_ACTIVE` and `cooldownUntilUtc`.
- UI behavior:
  - upload controls disabled.
  - visible policy banner.
  - "More credits" link present.

### Acceptance Criteria
1. Blocked state disables upload actions.
2. Banner displays cooldown details.
3. Link is visible and accessible.

### Test Plan
- Playwright blocked-state scenario.

### AI Prompt (Execution-Ready)
```text
Render policy-blocked upload state with disabled controls, clear banner, and More Credits link.
Map backend cooldown contract directly to UI state.
```

---

## S2-06 Create Async Enqueue Endpoint and Persist Job Metadata

### Story Metadata
- Story ID: `S2-06`
- Title: `Create Async Enqueue Endpoint and Persist Job Metadata`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S2`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-005`
- Stage acceptance link(s): `Stage 2 bullet 4`

### Inputs
- Validated files + policy-approved request.

### Outputs
- `202` accepted with `jobId`, `status=accepted`, `correlationId`.

### Contract
- Endpoint: `POST /api/uploads/intake`
- Response:
  - `{ jobId, sessionId, status, correlationId }`
- Persistence:
  - Job row with state timeline baseline.

### Constraints
- Idempotency key supported to avoid duplicate enqueues.
- Queue write + job metadata write must be durable.

### Acceptance Criteria
1. Accepted upload enqueues job.
2. Job metadata persists with `accepted` state and correlation ID.
3. Duplicate request with same idempotency key does not create duplicate jobs.

### Test Plan
- Backend e2e for enqueue and idempotency.

### AI Prompt (Execution-Ready)
```text
Implement upload intake endpoint that validates preconditions, persists job metadata, and enqueues processing.
Return 202 with job identifiers and support idempotency to prevent duplicate enqueues.
```

---

## S2-07 Create History Entry at Accepted Upload

### Story Metadata
- Story ID: `S2-07`
- Title: `Create History Entry at Accepted Upload`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `BE`
- Sprint: `S2`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-011`
- Stage acceptance link(s): `Stage 2 bullet 4`

### Contract
- On acceptance, create history row with:
  - `historyId`, `jobId`, `sessionId`, `createdAtUtc`, `status=queued`, `initiatorUserId/email`

### Constraints
- History write must not be skipped on successful enqueue.

### Acceptance Criteria
1. Every accepted upload creates history entry.
2. Entry links to job and session identifiers.

### Test Plan
- Backend e2e assertion for history row creation.

### AI Prompt (Execution-Ready)
```text
Create history entries for each accepted upload, linked to job/session with queued status and UTC timestamps.
Ensure history persistence is guaranteed on success path.
```

---

## S2-08 Integrate Basic Queue Worker Handshake (accepted -> queued)

### Story Metadata
- Story ID: `S2-08`
- Title: `Integrate Basic Queue Worker Handshake`
- Type: `Story`
- Priority: `P1`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S2`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-005`
- Stage acceptance link(s): supports `Stage 2 bullet 4`

### Contract
- Queue message contract includes:
  - `jobId`, `tenantId`, `fileRefs`, `requestedBy`, `createdAtUtc`
- Worker ack updates job state from `accepted` -> `queued`.

### Constraints
- Include retry + dead-letter baseline.
- Correlation ID propagation from API -> queue metadata.

### Acceptance Criteria
1. Queue message matches contract and is consumable.
2. Worker ack updates state deterministically.
3. Failed enqueue routes to retry/dead-letter policy.

### Test Plan
- Integration test with queue test double.

### AI Prompt (Execution-Ready)
```text
Implement queue handshake contract from upload intake to worker acceptance.
Include retry/dead-letter baseline and deterministic job state transitions.
```

---

## S2-09 Add Upload/Policy/Queue Tests (Happy + Rejection Paths)

### Story Metadata
- Story ID: `S2-09`
- Title: `Add Upload/Policy/Queue Tests`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `QA/BE/FE`
- Sprint: `S2`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-003`, `FR-004`, `FR-005`
- Stage acceptance link(s): `Stage 2 bullets 1-4`

### Scope
- Backend e2e:
  - validation errors
  - onboarding policy transitions
  - cooldown enforcement
  - enqueue + history persistence
- Browser e2e:
  - two-file UI behavior
  - blocked banner/disabled controls
  - success submit to queued state UI feedback

### Acceptance Criteria
1. Stage 2 acceptance bullets are explicitly covered by automated tests.
2. `npm run verify:story` includes Stage 2 tests and passes.
3. CI stores browser artifacts on failures.

### AI Prompt (Execution-Ready)
```text
Expand automated coverage for Stage 2 end-to-end behavior.
Map tests directly to Stage 2 acceptance bullets and ensure failures are diagnostic with artifacts/logs.
```

---

## Sequencing and Parallelization

- Lane A (FE): `S2-01` -> `S2-05`
- Lane B (BE): `S2-02` -> `S2-03` -> `S2-04` -> `S2-06` -> `S2-07` -> `S2-08`
- Final Gate: `S2-09`

## Dependency Readiness Gates (Must be Green)

1. Storage:
- Temporary upload container exists in Dev/Test.
- Service identity has write/read/delete permissions.

2. Queue:
- Queue + dead-letter queue exists in Dev/Test.
- Producer and consumer identities authorized.

3. Schema:
- Job and history tables/migrations applied in Dev/Test.
- Indexes for user/session/job queries validated.

4. Secrets/Config:
- Upload and queue config present in env contracts.
- Startup fail-fast checks for missing required config.
