# Stage 4 Parked Clarifications

Status: `Open - Parked for later execution refinement`  
Scope: `S4-08`, `S4-10`

## Purpose
Capture non-blocking S4 clarifications that can be finalized later while execution proceeds with current defaults.

## Parked Items

1. On-call routing target for production alerts
- Options: email, Teams, PagerDuty.
- Current execution default: document alert rules with owner placeholders.

2. Queue depth and dead-letter alert thresholds by environment
- Need per-environment tuning (Dev/Test/Prod).
- Current execution default:
  - Queue depth `>20` for `10m`
  - Dead-letter count `>0` for `10m`

3. Perf guard mode in CI
- Decision needed: PR gate vs nightly-only for heavy perf suites.
- Current execution default: keep functional CI gate and add repeatable perf harness/runbook.

4. Rollout strategy granularity
- Decision needed: tenant allowlist only, percentage rollout, or both.
- Current execution default: phased tenant rollout (`Dev -> Test -> Prod`) via feature flags.

5. Rollback execution SLO
- Decision needed: target max time to disable Stage 4 safely in production.
- Current execution default: rollback drill documented and required in non-prod before prod cutover.

## Revisit Trigger
- Revisit before final Stage 4 production rollout sign-off (`S4-10` exit criteria).
