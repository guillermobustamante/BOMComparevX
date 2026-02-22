# S4-10 Rollout, Observability, and Rollback Runbook

Status: `Draft (Execution-Ready)`  
Owner: `BE/DevOps`  
Stage: `S4`

## Objective
Roll out Stage 4 safely with feature flags, operational telemetry, actionable alerts, and a validated rollback drill.

## Feature Flags (Minimum)
- `diff_engine_v1`
- `diff_progressive_api_v1`
- `results_grid_stage4_v1`

## Metrics (Minimum)
- `diffJobDurationMs` (p50/p95 by size tier)
- `diffJobErrorRate`
- `diffAmbiguityRate`
- `firstChunkLatencyMs`
- `queueDepth`
- `api5xxRate`

## Initial Alert Thresholds
- Availability down (`/api/health`) for `>5m`
- API 5xx rate `>2%` over `5m`
- Diff latency p95 breach over `15m`:
  - `>30s` for <=5MB tier
  - `>90s` for 5-30MB tier
- Queue depth `>20` for `10m`
- Dead-letter count `>0` for `10m`

## Dashboard Panels
- Uptime/availability
- Active jobs
- Diff p50/p95 latency
- First chunk latency
- Queue depth
- API 5xx trend
- Ambiguity/review-required rate

## Rollout Plan
1. Dev:
   - Enable flags for internal users only.
   - Validate dashboards and alerts.
2. Test:
   - Enable flags for QA tenant(s).
   - Run synthetic latency/failure scenarios.
3. Prod:
   - Phased tenant rollout.
   - Monitor alerts and latency during each phase.

## Rollback Drill (Test Environment)
1. Disable all Stage 4 flags.
2. Verify auth/upload/history still work.
3. Verify Stage 4 routes degrade safely.
4. Re-enable flags and verify recovery.
5. Record timestamps, impact, and operator notes.

## Evidence to Attach
- Flag state snapshots per environment
- Dashboard URL(s)
- Alert rule IDs and action group(s)
- Rollback drill output and sign-off

## Open Configuration Items
- Final on-call channel (email/Teams/PagerDuty)
- Final queue depth threshold per environment
- Final dead-letter threshold per environment
