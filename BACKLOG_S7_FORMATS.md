# BACKLOG_S7_FORMATS.md

## Sprint S7B Backlog (Ticket-Ready)

This backlog defines the Stage 7 format-scalability stream (Option B): profile adapters + contextual composite identity for deterministic matching across unlimited BOM formats.

Source precedence:
- `SPRINT_PLAN.md` Sprint `S7B`
- `V1_DECISIONS.md` Stage 7 format-scalability locks
- `V1_SPEC.md` FR-007 format-scalability contract
- `PRODUCT_PLAN.md` Stage 7B direction

## Delivery Guardrails

1. Deterministic by design:
- no random candidate selection
- stable output for identical input

2. Adapter architecture:
- explicit profile adapters for known ecosystems
- deterministic generic fallback for unknown formats

3. Taxonomy safety:
- no ambiguous auto-conversion into `replaced`
- `replaced` only for high-confidence context-aligned pairings

4. Platform boundaries:
- Azure SQL Graph only
- no Cosmos/Gremlin

5. Quality baseline:
- same-file-vs-same-file must converge to no-change-dominant results

## Locked Clarification Decisions (Confirmed)

1. `1A` Profile detection mode:
- auto-detect with confidence + deterministic generic fallback + optional operator override.
2. `2A` Ambiguity handling:
- explicit ambiguity state; no forced replacement; user can proceed.
3. `3A` Effectivity/change-control usage:
- secondary identity context by default; profile may elevate to primary.
4. `4A` New profile onboarding:
- config-driven profile definitions + code hooks for advanced transforms.
5. `5A` Replacement confidence threshold:
- start at `>=0.90` and tune by telemetry/profile.
6. `6A` Runtime rollout strategy:
- tenant/profile canary in Dev/Test, then staged Prod enablement.

---

## S7F-01 Composite Key Contract + Adapter Interface

### Story Metadata
- Story ID: `S7F-01`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `AI Coding Agent (BE/Architect)`
- Status: `Completed`

### Inputs
- Current parsed row contract and matcher interfaces.

### Outputs
- Contract definitions:
  - `stableOccurrenceKey`
  - `snapshotRowKey`
  - adapter interface + adapter result shape.

### Contract
- `stableOccurrenceKey` is revision-independent occurrence identity.
- `snapshotRowKey` is immutable snapshot identity (collision-safe).
- Adapter output includes:
  - profile name
  - confidence
  - field policy (`identity`, `comparable`, `display`).

### Acceptance Criteria
1. Contract types are implemented and used by parser/matcher boundaries.
2. Key generation is deterministic and covered by unit tests.

### AI Prompt
```text
Define the contextual composite key contracts and profile adapter interface.
Keep deterministic semantics and backward-compatible with existing Stage 7 contracts.
```

---

## S7F-02 Profile Registry + SAP Adapter

### Story Metadata
- Story ID: `S7F-02`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE)`
- Status: `Completed`

### Inputs
- SAP example fixtures in `docs/BOM Examples`.

### Outputs
- Profile registry and SAP adapter implementation.

### Contract
- SAP adapter identity uses composite context:
  - component number
  - hierarchy/sequence context (path predecessor, level, item/line semantics where available)
  - change/effectivity context when present.
- SAP `Plant` defaults to comparable delta field, not primary identity field.

### Acceptance Criteria
1. SAP same-vs-same fixture does not produce mass false `replaced`.
2. Single controlled SAP field changes are localized to expected modified rows.

### AI Prompt
```text
Implement SAP-specific occurrence identity extraction using contextual composite keys.
Prioritize deterministic disambiguation for duplicate component numbers across hierarchy contexts.
```

---

## S7F-03 Deterministic Generic Adapter Fallback

### Story Metadata
- Story ID: `S7F-03`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE)`
- Status: `Completed`

### Inputs
- Unknown-format CSV/XLSX files with only partial recognizable columns.

### Outputs
- Generic fallback adapter.

### Contract
- Generic adapter must always emit deterministic keys when minimum signals exist.
- Degradation order is deterministic and explicit (no hidden heuristics).

### Acceptance Criteria
1. Unknown formats still match deterministically with bounded ambiguity.
2. Fallback behavior is observable and test-covered.

### AI Prompt
```text
Implement deterministic generic fallback adapter so unknown BOM formats can still be matched without non-deterministic behavior.
```

---

## S7F-04 Matcher Key-First Pass + Strict Ambiguity Gate

### Story Metadata
- Story ID: `S7F-04`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE)`
- Status: `Completed`

### Inputs
- Adapter-generated keys and field policy.

### Outputs
- Matcher flow updated to key-first pass.

### Contract
- Matching pass order starts with exact `stableOccurrenceKey`.
- Ambiguous key-level ties remain ambiguous (`reviewRequired`) and are not auto-paired as replacements.

### Acceptance Criteria
1. Duplicate-heavy fixtures show reduced false replacement output.
2. Existing deterministic tie-break invariants remain valid.

### AI Prompt
```text
Integrate key-first matching and enforce strict ambiguity gate.
Do not emit replaced from ambiguous identity branches.
```

---

## S7F-05 Profile Field Policy Enforcement

### Story Metadata
- Story ID: `S7F-05`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `AI Coding Agent (BE/Product)`
- Status: `Completed`

### Outputs
- Field policy enforcement in diff pipeline.

### Contract
- Identity fields drive match identity only.
- Comparable fields drive changedFields/cell deltas.
- Display fields do not affect matching/classification.

### Acceptance Criteria
1. Policy is profile-aware and test-covered.
2. `Plant` (SAP) appears as changed field when changed, not as identity break by default.

### AI Prompt
```text
Enforce profile field policy classes across matching and diff classification.
```

---

## S7F-06 Replacement Classification Guardrails

### Story Metadata
- Story ID: `S7F-06`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `AI Coding Agent (BE)`
- Status: `Completed`

### Outputs
- Guarded replacement classifier behavior.

### Contract
- `replaced` requires high-confidence context-aligned pairing.
- Low-confidence/ambiguous branches remain unmatched or explicit ambiguity state.

### Acceptance Criteria
1. False `unmatched_pair_replacement` rate drops on duplicate-heavy fixtures.
2. Controlled true replacements still classify correctly.

### AI Prompt
```text
Harden replacement classification so ambiguous unmatched pairs do not become false replacements.
```

---

## S7F-07 Observability for Key/Adapter Quality

### Story Metadata
- Story ID: `S7F-07`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (BE/DevOps)`
- Status: `Completed`

### Outputs
- Quality metrics and logs for adapter/key system.

### Contract
- Minimum metrics:
  - key collision rate
  - ambiguity rate
  - unmatched rate
  - replacement suppression rate
  - profile selection distribution.

### Acceptance Criteria
1. Metrics emitted with tenant/comparison/profile dimensions.
2. Dashboards/queries documented.

### AI Prompt
```text
Add observability for composite-key and adapter quality with dimensions usable for rollout gating.
```

---

## S7F-08 Backend Fixture Matrix Automation

### Story Metadata
- Story ID: `S7F-08`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (QA/BE)`
- Status: `Completed`

### Inputs
- `docs/BOM Examples` paired fixtures + same-vs-same controls.

### Outputs
- Backend integration tests for adapter flows.

### Acceptance Criteria
1. Same-vs-same runs pass no-change convergence assertions.
2. Single-change fixtures produce localized deltas.
3. Duplicate-heavy fixtures do not produce mass false replacements.

### AI Prompt
```text
Add robust backend fixture matrix tests validating profile adapters and composite-key matching behavior.
```

---

## S7F-09 Playwright Adapter Scenarios

### Story Metadata
- Story ID: `S7F-09`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (QA/FE)`
- Status: `Completed`

### Outputs
- Browser-level tests validating end-user outcomes.

### Acceptance Criteria
1. Same-vs-same UI run shows no-change-dominant result set.
2. Single-change UI run highlights expected changed fields.

### AI Prompt
```text
Add Playwright coverage for format-adapter outcomes in results UI.
```

---

## S7F-10 Rollout Controls + Runbook

### Story Metadata
- Story ID: `S7F-10`
- Type: `Story`
- Priority: `P1`
- Estimate: `3`
- Owner: `AI Coding Agent (BE/DevOps)`
- Status: `Completed`

### Outputs
- Feature flags and rollout runbook for adapter stream.

### Contract
- Flags:
  - `MATCHER_PROFILE_ADAPTERS_V1`
  - `MATCHER_COMPOSITE_KEY_V1`
  - `MATCHER_AMBIGUITY_STRICT_V1`
- Profile/tenant staged enablement documented.

### Acceptance Criteria
1. Safe canary rollout path exists.
2. Rollback path exists and tested in Dev/Test.

### AI Prompt
```text
Implement rollout flags and runbook for staged enablement of profile-adapter matching.
```

---

## Story Dependency Map

- `S7F-01` -> `S7F-02`, `S7F-03`.
- `S7F-02` + `S7F-03` -> `S7F-04`.
- `S7F-04` -> `S7F-05`, `S7F-06`.
- `S7F-04` -> `S7F-07`, `S7F-08`, `S7F-09`.
- `S7F-10` closes rollout after functional/test hardening.

## Definition of Done (Backlog-Level)

- Composite-key + adapter framework is production-capable behind flags.
- Same-vs-same false replacement defect class is closed.
- Unknown-format fallback remains deterministic.
- Backend + browser automation for adapter behavior are green.

## Clarification Status

No open clarification items remain for this backlog.

Resolved and locked decisions:
1. `1A` Profile detection mode: auto-detect + confidence + deterministic fallback + optional override.
2. `2A` Ambiguity handling: explicit ambiguity state, proceed allowed, no forced replacement.
3. `3A` Effectivity/change-control usage: secondary identity context by default, profile elevation allowed.
4. `4A` New profile onboarding model: config-driven definitions + code hooks.
5. `5A` Replacement confidence baseline: `>=0.90`, tuned by telemetry/profile.
6. `6A` Runtime rollout strategy: tenant/profile canary in Dev/Test, staged Prod enablement.
