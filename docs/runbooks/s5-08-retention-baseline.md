# S5-08 Retention Baseline Runbook

Status: `Draft (Execution-Ready)`  
Owner: `BE/DevOps`  
Stage: `S5`

## Objective
Enforce Stage 5 retention defaults safely:
- export artifacts: 7 days
- notifications: 90 days
- share records: retained while active; revoked records are cleanup-eligible

## Configuration
- `STAGE5_RETENTION_ENABLED=true`
- `STAGE5_RETENTION_INTERVAL_MS=3600000`
- `EXPORT_ARTIFACT_RETENTION_DAYS=7`
- `NOTIFICATION_RETENTION_DAYS=90`

## Automatic Sweep Behavior
1. Backend starts retention worker at boot when `STAGE5_RETENTION_ENABLED=true`.
2. Worker runs every `STAGE5_RETENTION_INTERVAL_MS`.
3. Worker deletes:
- `exportArtifacts.createdAtUtc < now - EXPORT_ARTIFACT_RETENTION_DAYS`
- `notifications.createdAtUtc < now - NOTIFICATION_RETENTION_DAYS`
- revoked share records (`comparisonShares.revokedAtUtc IS NOT NULL`)

## Manual Sweep (Admin API)
Use for non-prod validation and incident response.

1. Authenticate as admin.
2. Run:
```bash
POST /api/admin/retention/run
```
Optional body:
```json
{ "nowUtcIso": "2026-03-01T00:00:00.000Z" }
```
3. Verify response payload:
- `deletedExportArtifacts`
- `deletedNotifications`
- `deletedRevokedShares`
- cutoff timestamps

## Verification SQL (Azure SQL)
```sql
SELECT COUNT(*) AS exportArtifactsOver7d
FROM dbo.exportArtifacts
WHERE createdAtUtc < DATEADD(day, -7, SYSUTCDATETIME());

SELECT COUNT(*) AS notificationsOver90d
FROM dbo.notifications
WHERE createdAtUtc < DATEADD(day, -90, SYSUTCDATETIME());

SELECT COUNT(*) AS revokedShares
FROM dbo.comparisonShares
WHERE revokedAtUtc IS NOT NULL;
```

## Audit and Logs
- Audit event: `retention.sweep`
- Structured metric log: `stage5.retention.sweep`

## Rollback
1. Set `STAGE5_RETENTION_ENABLED=false`.
2. Restart backend.
3. Confirm no new `stage5.retention.sweep` logs are emitted.
