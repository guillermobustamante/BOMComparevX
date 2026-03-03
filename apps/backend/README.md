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
- `GET /api/auth/consent/status` (protected)
- `POST /api/auth/consent/accept` (protected)
- `GET /api/health`
- `GET /api/tenant/me` (protected)
- `GET /api/tenant/resource/:tenantId` (protected + tenant-scoped)
- `POST /api/uploads/validate` (protected, multipart `fileA` + `fileB`)
- `POST /api/uploads/intake` (protected, multipart `fileA` + `fileB`, async accept)
- `GET /api/exports/csv/:comparisonId` (protected, synchronous CSV download; full dataset default)
- `GET /api/exports/excel/:comparisonId` (protected, synchronous Excel download; full dataset default)
- `GET /api/history/sessions` (protected, owner sessions only, soft-deleted hidden)
- `POST /api/history/sessions/:historyId/rename` (protected)
- `POST /api/history/sessions/:historyId/tag` (protected)
- `POST /api/history/sessions/:historyId/delete` (protected, soft-delete)
- `GET /api/notifications` (protected)
- `POST /api/notifications/:notificationId/read` (protected)
- `POST /api/admin/retention/run` (protected, admin role required)
- `GET /api/admin/audit/export` (protected, admin role required, tenant-scoped)
- `POST /api/admin/audit/archive/run` (protected, admin role required, append-only archive run)
- `GET /api/admin/audit/archive/runs` (protected, admin role required)

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
- `export.download`
- `notification.created`
- `retention.sweep`
- `audit.export`
- `audit.archive.run`
- `rate_limit.exempt`
- `rate_limit.exceeded`
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

Stage 5 feature flags:
- `EXPORT_STAGE5_V1`
- `SHARING_STAGE5_V1`
- `NOTIFICATIONS_STAGE5_V1`
- `ADMIN_POLICY_UI_STAGE5_V1`

Stage 7 format-adapter flags:
- `MATCHER_PROFILE_ADAPTERS_V1`
- `MATCHER_COMPOSITE_KEY_V1`
- `MATCHER_AMBIGUITY_STRICT_V1`

Stage 8 rate-limit flags:
- `RATE_LIMITING_V1`
- `RATE_LIMITING_IN_TEST` (defaults to `false`; test-mode safety switch)
- `RATE_LIMIT_BASELINE_RPM` (default `100`)
- `RATE_LIMIT_UPLOAD_RPM` (default `80`)
- `RATE_LIMIT_DIFF_RPM` (default `90`)
- `RATE_LIMIT_EXPORT_RPM` (default `60`)
- `RATE_LIMIT_EXEMPT_TENANT_IDS` (optional CSV)
- `RATE_LIMIT_EXEMPT_EMAILS` (optional CSV)

Stage 8 consent flags:
- `CONSENT_TRACKING_V1` (default `false`; enable to enforce policy acceptance gate)
- `TERMS_VERSION`
- `PRIVACY_VERSION`
- `TERMS_URL`
- `PRIVACY_URL`

Stage 8 history parity flags:
- `HISTORY_PARITY_V1`

Stage 8 audit governance flags:
- `AUDIT_EXPORT_STAGE8_V1`
- `AUDIT_ARCHIVE_STAGE8_V1`
- `AUDIT_ARCHIVE_STORAGE_TARGET` (`local` or `azure_blob_grs`)
- `AUDIT_ARCHIVE_BLOB_BASE_URI` (required when target is `azure_blob_grs`)
- `AUDIT_ARCHIVE_LOCAL_DIR` (default `artifacts/audit-archive`)
- `AUDIT_ARCHIVE_RETENTION_YEARS` (minimum `7`)

Stage 5 retention defaults:
- `STAGE5_RETENTION_ENABLED=true`
- `STAGE5_RETENTION_INTERVAL_MS=3600000`
- `EXPORT_ARTIFACT_RETENTION_DAYS=7`
- `NOTIFICATION_RETENTION_DAYS=90`

## Notes
- Secrets are resolved via Azure Key Vault secret names from env contract.
- Local fallback supports direct `GOOGLE_*` and `MICROSOFT_*` env vars for development.
- Planned S2-00 DB secret contract:
  - `SQL_CONNECTION_STRING_SECRET_NAME=SqlConnectionString--Dev`
  - `DATABASE_URL=` (local fallback only)
- DB operations runbook:
  - `docs/runbooks/s2vdb-db-ops-baseline.md`
