# Backend (NestJS)

Planned framework: NestJS + TypeScript with Passport strategies for Google/Microsoft.

## Local Run
1. Install deps: `npm install --prefix apps/backend`
2. Ensure `.env.local` is populated from `.env.example`
3. Start dev server: `npm --prefix apps/backend run start:dev`
4. Run API e2e tests: `npm --prefix apps/backend run test:e2e`

## Implemented Auth Contract Endpoints
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/auth/microsoft/start`
- `GET /api/auth/microsoft/callback`
- `GET /api/auth/me` (protected)
- `GET /api/health`
- `GET /api/tenant/me` (protected)
- `GET /api/tenant/resource/:tenantId` (protected + tenant-scoped)
- `POST /api/uploads/validate` (protected, multipart `fileA` + `fileB`)
- `POST /api/uploads/intake` (protected, multipart `fileA` + `fileB`, async accept)

Optional query support for start endpoints:
- `returnTo` (internal path only, e.g. `/upload` or `/history`).
- Unsafe values fall back to `/upload`.

Tenant behavior:
- Tenant ID is resolved from email domain using `TENANT_DOMAIN_MAP_JSON` when provided.
- Fallback tenant is `DEFAULT_TENANT_ID`.
- Cross-tenant access to `tenant/resource/:tenantId` returns `403`.

Audit events:
- `auth.login.success`
- `auth.login.failure`
- `auth.access.denied`
- Events are emitted as structured JSON logs with correlation ID and UTC timestamp.

Test support routes (disabled by default):
- Set `ENABLE_TEST_ROUTES=true` to enable:
- `POST /api/auth/test/login`
- `POST /api/auth/test/logout`

Upload validation error codes:
- `UPLOAD_FILE_COUNT_INVALID`
- `UPLOAD_FILE_TYPE_INVALID`
- `UPLOAD_FILE_SIZE_EXCEEDED`

Upload policy fields returned on successful validation:
- `policy.comparisonsUsed`
- `policy.unrestrictedComparisonsRemaining`
- `policy.cooldownUntilUtc` (reserved for cooldown enforcement in S2-04)

Cooldown policy behavior:
- First 3 accepted validations are unrestricted.
- Attempt 4 within cooldown window returns `429` with:
  - `code: UPLOAD_COOLDOWN_ACTIVE`
  - `cooldownUntilUtc`
  - `correlationId`

Upload intake contract:
- `POST /api/uploads/intake`
- Success: `202` with `{ jobId, sessionId, historyId, status: "accepted", correlationId, idempotentReplay, policy }`
- Supports optional `Idempotency-Key` header; repeated key for same user returns same accepted job and does not create a duplicate.
- Queue handshake: accepted jobs are retried and transitioned to `queued`; persistent enqueue failure returns `503` with `UPLOAD_QUEUE_ENQUEUE_FAILED`.

## Notes
- Secrets are resolved via Azure Key Vault secret names from env contract.
- Local fallback supports direct `GOOGLE_*` and `MICROSOFT_*` env vars for development.
- Planned S2-00 DB secret contract:
  - `SQL_CONNECTION_STRING_SECRET_NAME=SqlConnectionString--Dev`
  - `DATABASE_URL=` (local fallback only)
