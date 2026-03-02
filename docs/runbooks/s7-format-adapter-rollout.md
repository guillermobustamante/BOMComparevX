# Stage 7 Format Adapter Rollout Runbook

This runbook controls staged rollout for contextual composite-key matching and profile adapters.

## Flags

```dotenv
MATCHER_PROFILE_ADAPTERS_V1=true
MATCHER_COMPOSITE_KEY_V1=true
MATCHER_AMBIGUITY_STRICT_V1=true
```

- `MATCHER_PROFILE_ADAPTERS_V1`
  - `true`: profile detection + adapter policies run.
  - `false`: adapter pipeline bypassed; generic legacy matching behavior.
- `MATCHER_COMPOSITE_KEY_V1`
  - `true`: `stableOccurrenceKey` is populated and used by matcher key-first pass.
  - `false`: composite keys are suppressed and matcher falls back to non-key strategies.
- `MATCHER_AMBIGUITY_STRICT_V1`
  - `true`: ambiguous replacement branches are suppressed (no forced replacement).
  - `false`: legacy replacement pairing threshold/behavior.

## Recommended Rollout Path

1. Dev canary:
   - Enable all three flags in Dev.
   - Validate with fixture matrix (`docs/BOM Examples`) and `npm run verify:story`.
2. Test canary:
   - Enable for a subset of test tenants using environment-scoped deployment slots.
   - Compare adapter-quality metrics against baseline.
3. Prod staged:
   - Start with `MATCHER_PROFILE_ADAPTERS_V1=true`, keep others aligned.
   - Enable per tenant/profile canary wave.
   - Expand only if quality thresholds are stable.

## Rollback Path

1. Fast rollback:
   - Set `MATCHER_PROFILE_ADAPTERS_V1=false` and restart backend.
2. Partial rollback:
   - Keep adapters enabled, set `MATCHER_COMPOSITE_KEY_V1=false` to remove key-first behavior.
3. Classification rollback:
   - Set `MATCHER_AMBIGUITY_STRICT_V1=false` for legacy replacement behavior.

## Metrics and Queries

Metrics are emitted as upload events with `eventType = 'stage7.adapter.quality'`.
Payload includes:
- `sourceProfile`, `targetProfile`
- `sourceKeyCollisionRate`, `targetKeyCollisionRate`
- `ambiguityRate`
- `unmatchedRate`
- `replacementSuppressionRate`
- `flags`

### Example SQL (Azure SQL)

```sql
SELECT TOP 200
  tenantId,
  correlationId AS comparisonId,
  createdAtUtc,
  JSON_VALUE(detailsJson, '$.sourceProfile') AS sourceProfile,
  JSON_VALUE(detailsJson, '$.targetProfile') AS targetProfile,
  TRY_CAST(JSON_VALUE(detailsJson, '$.sourceKeyCollisionRate') AS float) AS sourceKeyCollisionRate,
  TRY_CAST(JSON_VALUE(detailsJson, '$.targetKeyCollisionRate') AS float) AS targetKeyCollisionRate,
  TRY_CAST(JSON_VALUE(detailsJson, '$.ambiguityRate') AS float) AS ambiguityRate,
  TRY_CAST(JSON_VALUE(detailsJson, '$.unmatchedRate') AS float) AS unmatchedRate,
  TRY_CAST(JSON_VALUE(detailsJson, '$.replacementSuppressionRate') AS float) AS replacementSuppressionRate
FROM dbo.uploadEvents
WHERE eventType = 'stage7.adapter.quality'
ORDER BY createdAtUtc DESC;
```

## Operational Gates

- Block rollout expansion if:
  - `sourceKeyCollisionRate` or `targetKeyCollisionRate` rises above `0.02`.
  - `replacementSuppressionRate` spikes with rising `unmatchedRate`.
  - same-vs-same fixture runs produce non-zero replacement clusters.
- Promote rollout when:
  - same-vs-same remains no-change-dominant.
  - replacement suppression is stable and false replacement noise remains near zero.
