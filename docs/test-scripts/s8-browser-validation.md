# S8 Browser Validation Script

## Prerequisites
1. Backend running at `http://localhost:4000/api`
2. Frontend running at `http://localhost:3000`
3. Stage 8 flags enabled:
- `RATE_LIMITING_V1=true`
- `CONSENT_TRACKING_V1=true`
- `HISTORY_PARITY_V1=true`
- `AUDIT_EXPORT_STAGE8_V1=true`
- `AUDIT_ARCHIVE_STAGE8_V1=true`

## 1. Consent Tracking
1. Sign in with a test user.
2. Verify redirect to `/consent` when current versions are not accepted.
3. Accept Terms + Privacy.
4. Confirm app navigation is restored.
5. Bump `TERMS_VERSION` or `PRIVACY_VERSION`, restart backend, refresh session.
6. Confirm consent prompt is required again.

## 2. History Parity
1. Upload file A + file B and queue intake.
2. Navigate to `/history`.
3. Rename a history item.
4. Add/update tag.
5. Soft-delete same item.
6. Verify deleted item is hidden in default list.
7. Verify another same-tenant user cannot modify owner-owned item.

## 3. Rate Limit Behavior
1. Trigger repeated upload/diff/export requests quickly.
2. Verify throttle behavior once limit is exceeded (`429`, deterministic error code).
3. If allowlist configured, verify exempt account avoids 429 and action is still audited.

## 4. Admin Audit Governance
1. Sign in as admin-role user.
2. Trigger:
- `GET /api/admin/audit/export?format=csv`
- `POST /api/admin/audit/archive/run`
- `GET /api/admin/audit/archive/runs`
3. Verify:
- export contains tenant-scoped records only
- archive response includes `appendOnly=true`, `sha256`, `recordCount`, `retentionYears >= 7`

