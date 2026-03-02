# Stage 7 Core Rollout + Observability Runbook

## Scope

This runbook covers Stage 7 core rollout controls for:
- graph-aware matcher path
- hierarchy/tree results view
- dynamic filter/sort/search contract

Format-adapter stream controls (`MATCHER_PROFILE_ADAPTERS_V1`, etc.) are covered in:
- `docs/runbooks/s7-format-adapter-rollout.md`

## Feature Flags

Backend flags:
- `MATCHER_GRAPH_V1`
- `RESULTS_TREE_VIEW_V1`
- `RESULTS_DYNAMIC_FILTERS_V1`

Frontend flags:
- `NEXT_PUBLIC_RESULTS_TREE_VIEW_V1`
- `NEXT_PUBLIC_RESULTS_DYNAMIC_FILTERS_V1`

Runtime SLO instrumentation flags:
- `OBS_S7_TREE_EXPAND_P95`
- `OBS_S7_DYNAMIC_QUERY_P95`
- `OBS_S7_FIRST_HIERARCHY_RESPONSE`
- `OBS_S7_FIRST_MEANINGFUL_TREE_ROWS`
- `OBS_S7_OVERHEAD_VS_S4`

## Environment Defaults

Dev:
- Core Stage 7 flags: `true`
- Runtime SLO flags: `false` until baseline is stable

Test:
- Core Stage 7 flags: `false` initially, then enable by rollout order
- Runtime SLO flags: `false` initially

Prod:
- Core Stage 7 flags: `false` initially
- Runtime SLO flags: `false` initially

## Rollout Order

1. Enable `MATCHER_GRAPH_V1`
2. Enable `RESULTS_TREE_VIEW_V1` + `NEXT_PUBLIC_RESULTS_TREE_VIEW_V1`
3. Enable `RESULTS_DYNAMIC_FILTERS_V1` + `NEXT_PUBLIC_RESULTS_DYNAMIC_FILTERS_V1`
4. Enable runtime SLO metric flags in Dev/Test for measurement windows

## Rollback

Immediate rollback path:
1. Set `RESULTS_DYNAMIC_FILTERS_V1=false` + `NEXT_PUBLIC_RESULTS_DYNAMIC_FILTERS_V1=false`
2. Set `RESULTS_TREE_VIEW_V1=false` + `NEXT_PUBLIC_RESULTS_TREE_VIEW_V1=false`
3. Set `MATCHER_GRAPH_V1=false`
4. Keep runtime SLO flags `false`

Expected degraded behavior:
- flat results remain available via Stage 4 baseline path
- tree route returns deterministic feature-disabled response
- dynamic query route returns deterministic feature-disabled response when advanced query args are used

## Validation Checklist

1. Backend:
- `npm --prefix apps/backend run ci`

2. Frontend:
- `npm --prefix apps/frontend run ci`

3. End-to-end:
- `npx playwright test`

4. Story gate:
- `npm run verify:story`

## Metrics/Logs

Core metrics emitted:
- `stage7.matcher.graph.utilization`
- `stage7.tree.query_timing` (when `OBS_S7_TREE_EXPAND_P95=true`)
- `stage7.tree.first_response` (when `OBS_S7_FIRST_HIERARCHY_RESPONSE=true`)
- `stage7.tree.first_meaningful_rows` (when `OBS_S7_FIRST_MEANINGFUL_TREE_ROWS=true`)
- `stage7.dynamic_query.timing` (when `OBS_S7_DYNAMIC_QUERY_P95=true`)
- `stage7.dynamic_query.failure`
- `stage7.matcher.overhead_vs_s4` (when `OBS_S7_OVERHEAD_VS_S4=true`)

Required dimensions in logs:
- `tenantId`
- `comparisonId` (jobId)
- `flagState`/flag values in payload where relevant
- `correlationId` (when provided by request flow)
