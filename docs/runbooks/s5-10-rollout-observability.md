# S5-10 Rollout, Observability, and Rollback Runbook

Status: `Draft (Execution-Ready)`  
Owner: `BE/DevOps`  
Stage: `S5`

## Objective
Roll out Stage 5 safely with feature flags, audit/metrics visibility, and a verified rollback path.

## Feature Flags
- `EXPORT_STAGE5_V1`
- `SHARING_STAGE5_V1`
- `NOTIFICATIONS_STAGE5_V1`
- `ADMIN_POLICY_UI_STAGE5_V1`

## Minimum Metrics and Signals
- Export success/failure: audit event `export.download`
- Share invite/revoke activity: audit events `share.invite`, `share.revoke`
- Notification generation volume: audit event `notification.created`
- Admin override/reset activity: audit events `admin.policy.override`, `admin.policy.reset`
- Retention cleanup volume: metric log `stage5.retention.sweep`

## Rollout Plan
1. Dev:
- Enable all Stage 5 flags.
- Validate export/share/notification/admin journeys.
- Run manual retention sweep and validate counters.
2. Test:
- Enable flags for QA tenant(s).
- Execute browser script: `docs/test-scripts/s5-03-to-s5-07-browser.md`.
- Run full CI and Playwright.
3. Prod:
- Enable flags in phases by tenant cohort.
- Monitor audit/event rates and error payloads.

## Rollback Procedure
1. Disable all Stage 5 flags:
- `EXPORT_STAGE5_V1=false`
- `SHARING_STAGE5_V1=false`
- `NOTIFICATIONS_STAGE5_V1=false`
- `ADMIN_POLICY_UI_STAGE5_V1=false`
2. Restart backend deployment.
3. Verify:
- Stage 5 routes return controlled `503` with feature-flag codes.
- Stage 1-4 routes remain operational.
4. Capture incident notes and flag timeline.

## Operational Checks
1. `/api/health` remains healthy.
2. Export endpoints deny/allow correctly by flag + authorization.
3. Share access remains exact-email + same-tenant.
4. Notifications page loads and read updates succeed.
5. Admin API enforces `ADMIN_REQUIRED` for non-admin users.

## Evidence to Attach
- Flag state per environment
- Dashboard query links or SIEM search URLs
- Rollback drill output
- CI/Playwright run IDs for Stage 5 closeout
