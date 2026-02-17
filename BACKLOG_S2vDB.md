# BACKLOG_S2vDB.md

## Sprint S2vDB Mini Backlog (Ticket-Ready)

This mini backlog tracks `S2-00` persistence hardening work that formalizes Stage 2 durability in Azure SQL.

Source precedence:
- `V1_DECISIONS.md` (Prisma migrations, camelCase naming, include mapping/audit entities now)
- `V1_SPEC.md` Stage 2 and data entities
- `SPRINT_PLAN.md` `S2-00`

## S2-00 Goal

Move Stage 2 core state from in-memory baseline to durable Azure SQL persistence with migration-driven schema and test verification.

---

## S2vDB-01 Provision Dev Azure SQL + Key Vault Secret Contract

### Story Metadata
- Story ID: `S2vDB-01`
- Title: `Provision Dev Azure SQL + Key Vault Secret Contract`
- Type: `Story`
- Priority: `P0`
- Estimate: `2`
- Owner: `DevOps/BE`
- Sprint: `S2vDB`
- Status: `Done`

### Inputs
- Azure subscription/resource group details.
- Dev Key Vault availability.

### Outputs
- Running Azure SQL Dev database.
- Connection string stored as Key Vault secret and wired to env contract.

### Contract
- Secret name: `SqlConnectionString--Dev` (or agreed alias).
- App env points to secret reference, not inline credentials.

### Acceptance Criteria
1. Azure SQL Dev DB exists and is reachable from app runtime.
2. Connection string is stored in Key Vault and documented.
3. Local/dev startup can resolve DB config without hard-coded credentials.

### AI Prompt (Execution-Ready)
```text
Provision Azure SQL Dev and wire Key Vault secret contract for connection string resolution.
Update env docs and fail-fast validation for missing DB secret.
```

---

## S2vDB-02 Add Prisma Baseline + Core Migrations (camelCase)

### Story Metadata
- Story ID: `S2vDB-02`
- Title: `Add Prisma Baseline + Core Migrations (camelCase)`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S2vDB`
- Status: `Done`

### Inputs
- Data entities required for Stage 2 + early Stage 3 compatibility.

### Outputs
- Prisma schema + SQL migrations.

### Contract
- Naming convention: camelCase table/column names.
- Required entities:
  - `jobRuns`
  - `historyEntries` (or existing history table with equivalent contract)
  - `uploadPolicies`
  - `uploadEvents`
  - `auditLogs`
  - `bomColumnMappings`
  - `columnDetectionAudits`

### Constraints
- Migrations are additive and reproducible in CI.

### Acceptance Criteria
1. Prisma migration runs clean on empty Dev DB.
2. Core tables/indexes/constraints exist in camelCase.
3. Schema includes mapping + detection audit entities now.

### AI Prompt (Execution-Ready)
```text
Create Prisma schema and SQL migrations for Stage 2 durable persistence using camelCase naming.
Include job/history/policy/event/audit and mapping/audit entities.
```

---

## S2vDB-03 Replace In-Memory Job/Policy/History Persistence

### Story Metadata
- Story ID: `S2vDB-03`
- Title: `Replace In-Memory Job/Policy/History Persistence`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S2vDB`
- Status: `Done`

### Inputs
- Existing Stage 2 services/controllers.

### Outputs
- Repository-backed persistence for intake/job/policy/history flows.

### Contract
- `POST /api/uploads/intake` persists durable job + history.
- Policy counters and cooldown timestamps persist across restarts.
- Idempotency key handling is durable.

### Constraints
- Preserve existing API response contracts.

### Acceptance Criteria
1. Intake responses remain contract-compatible.
2. Restart does not reset policy/job/history state.
3. Duplicate idempotency key does not create duplicate durable job row.

### AI Prompt (Execution-Ready)
```text
Refactor Stage 2 in-memory services to Azure SQL repositories via Prisma.
Keep contracts stable and make idempotency/policy/history fully durable.
```

---

## S2vDB-04 Enforce Tenant Filters + Audit Persistence

### Story Metadata
- Story ID: `S2vDB-04`
- Title: `Enforce Tenant Filters + Audit Persistence`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE`
- Sprint: `S2vDB`
- Status: `Done`

### Inputs
- Session tenant/user context.

### Outputs
- Tenant-safe queries and persisted audit trail for persistence operations.

### Contract
- Every read/write query includes tenant context.
- Audit records include correlation ID and actor.

### Acceptance Criteria
1. Cross-tenant data reads are denied at query layer.
2. Intake/policy/admin-sensitive actions persist audit records.
3. Audit records are queryable by tenant + timestamp.

### AI Prompt (Execution-Ready)
```text
Apply tenant filters to new DB repositories and persist audit records for critical Stage 2 flows.
Add correlation IDs and actor identity in stored audit details.
```

---

## S2vDB-05 Add Persistence Verification in CI + Story Tests

### Story Metadata
- Story ID: `S2vDB-05`
- Title: `Add Persistence Verification in CI + Story Tests`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `QA/BE`
- Sprint: `S2vDB`
- Status: `Done`

### Inputs
- Existing e2e and Playwright suites.

### Outputs
- Tests validating durable DB behavior.

### Contract
- `verify:story` includes migration apply and persistence checks.
- Failure output identifies migration or persistence failures clearly.

### Acceptance Criteria
1. E2E tests assert durable rows for job/history/policy.
2. CI fails on migration drift or missing tables.
3. Stage 2 behavior remains green under persistence-backed mode.

### AI Prompt (Execution-Ready)
```text
Expand CI/e2e checks to validate migration execution and durable persistence behavior.
Keep Stage 2 contract tests green while enforcing DB-backed assertions.
```

---

## Sequencing

1. `S2vDB-01`
2. `S2vDB-02`
3. `S2vDB-03`
4. `S2vDB-04`
5. `S2vDB-05`
