# BACKLOG_S3.md

## Sprint S3 Backlog (Ticket-Ready)

This backlog expands Stage 3 (`S3-01` to `S3-09`) from `SPRINT_PLAN.md` into execution-ready stories.

Source precedence:
- `V1_DECISIONS.md` for locked product behavior.
- `V1_SPEC.md` for functional and stage acceptance criteria.
- `docs/PreviousDocs` for semantic registry and detection/mapping detail.

## Delivery Guardrails (Stage 3)

1. Deterministic detection first:
- Detection strategy order is fixed: `REGISTRY_EXACT` -> `REGISTRY_FUZZY` -> `HEURISTIC` -> `MANUAL`.

2. Confidence-gated behavior:
- `>=0.90` auto-map.
- `0.70-0.89` review-required.
- `<0.70` warning state; explicit proceed is allowed.

3. Immutability:
- Confirmed mapping is immutable per revision.
- No in-place updates to historical mapping snapshots.

4. Audit discipline:
- Every column mapping decision must emit strategy + confidence audit metadata.
- Manual mapping corrections must be audit logged.

5. Tenant/RBAC safety:
- Detection, preview, confirm, and retrieval flows are tenant-scoped and authenticated.

---

## S3-01 Define Canonical Mapping Contract + Confidence Model

### Story Metadata
- Story ID: `S3-01`
- Title: `Define Canonical Mapping Contract + Confidence Model`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE/Architect`
- Sprint: `S3`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): `Stage 3 bullet 1`
- Decision link(s): `V1_DECISIONS.md` items 11-17

### Inputs
- Existing upload/revision metadata and parsed header rows.

### Outputs
- Versioned contract for detection output and mapping confirmation payload.

### Contract
- Canonical fields:
  - Required: `part_number`, `description`, `quantity`
  - Conditional required: `revision` (optional when unavailable in source/domain)
  - Optional: `supplier`, `cost`, `lifecycle_status`, tenant custom fields
- Confidence bands:
  - `AUTO`: `>=0.90`
  - `REVIEW_REQUIRED`: `0.70-0.89`
  - `LOW_CONFIDENCE_WARNING`: `<0.70`

### Constraints
- Contract must support multilingual alias tracing and strategy provenance.
- Mapping record must store language metadata.

### Acceptance Criteria
1. Detection output schema and confirmation schema are documented and implemented.
2. Confidence model is enforced in code-level constants.
3. Contract is referenced by preview and persistence stories.
4. Conflict policy is locked: fresh detection has precedence over saved mapping.

### AI Prompt (Execution-Ready)
```text
Implement a versioned Stage 3 mapping contract with canonical fields and confidence bands.
Expose shared types/constants for detection, preview, and confirmation APIs.
```

---

## S3-02 Build Semantic Registry Aliases Engine (Industry + Multilingual)

### Story Metadata
- Story ID: `S3-02`
- Title: `Build Semantic Registry Aliases Engine`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE/Data`
- Sprint: `S3`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): `Stage 3 bullet 1`

### Inputs
- Header labels from uploaded files.
- Registry seed definitions.

### Outputs
- Normalized alias registry lookup service.

### Contract
- Registry supports domains: electronics, mechanical, aerospace, manufacturing.
- Language packs: EN/ES/DE/FR/JA/ZH (extensible).
- Alias entries include: `canonicalField`, `alias`, `language`, `domain`, `weight`.

### Constraints
- Header normalization must include case-folding, punctuation trimming, whitespace normalization, and diacritic handling.

### Acceptance Criteria
1. Registry resolves known aliases for required canonical fields across supported languages.
2. Domain/language metadata is retained in match output.
3. Service is deterministic and test-covered.

### AI Prompt (Execution-Ready)
```text
Implement a semantic registry service for multilingual, cross-industry column aliases.
Return canonical field + language/domain metadata and deterministic match scores.
```

---

## S3-03 Implement Pass-1 Registry Detection (Exact + Fuzzy)

### Story Metadata
- Story ID: `S3-03`
- Title: `Implement Pass-1 Registry Detection`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S3`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): `Stage 3 bullet 1`

### Inputs
- Parsed headers and registry service.

### Outputs
- Initial mapping candidates with strategy/confidence.

### Contract
- Strategies:
  - `REGISTRY_EXACT`
  - `REGISTRY_FUZZY`
- Per-column result:
  - `sourceColumn`
  - `canonicalField?`
  - `strategy`
  - `confidence`
  - `reviewState`
  - `evidence` (matched alias, language, domain)

### Constraints
- Fuzzy behavior must be deterministic with fixed thresholds.

### Acceptance Criteria
1. Exact matches are prioritized over fuzzy.
2. Confidence and review state are populated for all mapped candidates.
3. Unmapped columns are passed to heuristic fallback.

### AI Prompt (Execution-Ready)
```text
Implement pass-1 registry detection with exact-first then fuzzy matching.
Emit strategy, confidence, and review-state outputs for each column.
```

---

## S3-04 Implement Pass-2 Heuristic Fallback + Unresolved Handling

### Story Metadata
- Story ID: `S3-04`
- Title: `Implement Pass-2 Heuristic Fallback + Unresolved Handling`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S3`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): `Stage 3 bullets 1-2`

### Inputs
- Unmapped headers from pass 1.

### Outputs
- Heuristic mapping candidates or unresolved markers.

### Contract
- Heuristic sources:
  - regex/token patterns
  - column-position/context hints
  - sample-value type hints
- Strategy value: `HEURISTIC`.
- If unresolved: `canonicalField=null`, `reviewState=LOW_CONFIDENCE_WARNING`.

### Constraints
- Heuristic guesses cannot bypass confidence gates.
- Low-confidence unresolved values are allowed to proceed only via explicit user confirmation.

### Acceptance Criteria
1. Unmapped headers from pass 1 are evaluated by heuristics.
2. Low-confidence/unresolved columns are marked warning-state.
3. Required canonical fields unresolved -> preview forces explicit proceed confirmation.

### AI Prompt (Execution-Ready)
```text
Implement pass-2 heuristic fallback for unmapped headers and classify unresolved columns.
Respect confidence gates and required-field warning/confirmation rules.
```

---

## S3-05 Create Detection Preview API (Sample Rows + Strategy + Confidence)

### Story Metadata
- Story ID: `S3-05`
- Title: `Create Detection Preview API`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE`
- Sprint: `S3`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): `Stage 3 bullet 2`

### Inputs
- Revision ID + detection output.

### Outputs
- Preview payload for UI confirmation/edit.

### Contract
- Endpoint: `GET /api/mappings/preview/:revisionId`
- Response:
  - `revisionId`
  - `columns[]` with strategy/confidence/reviewState/evidence
  - `sampleRows[]`
  - `requiredFieldsStatus`
  - `canProceed`

### Constraints
- Tenant-scoped and authenticated.
- Deterministic ordering of columns.

### Acceptance Criteria
1. Preview includes sample rows and per-column strategy/confidence.
2. API indicates whether explicit warning acknowledgment is required before proceed.
3. Unauthorized cross-tenant preview access is denied.

### AI Prompt (Execution-Ready)
```text
Implement a preview endpoint returning mapping candidates, confidence/strategy metadata, and sample rows.
Include explicit warning-confirmation flags when required fields are unresolved.
```

---

## S3-06 Build Mapping Preview/Edit UI with Confidence Gates

### Story Metadata
- Story ID: `S3-06`
- Title: `Build Mapping Preview/Edit UI with Confidence Gates`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `FE`
- Sprint: `S3`
- Status: `Done`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): `Stage 3 bullet 2`

### Inputs
- Preview API payload.

### Outputs
- User-edited mapping confirmation payload.

### Contract
- UI states:
  - Auto-mapped (read-only default, editable)
  - Review-required (highlighted)
  - Low-confidence warning (explicit proceed required)
- Confirm action posts explicit mapping decisions.

### Constraints
- Show strategy and confidence transparently per column.
- Proceed requires explicit acknowledgment for low-confidence states.
- Mapping edit rights are owner-only; admin override path is audited.

### Acceptance Criteria
1. User can review and edit mappings in preview.
2. Low-confidence warning state requires explicit proceed acknowledgment.
3. Confirm action submits deterministic mapping payload.

### AI Prompt (Execution-Ready)
```text
Build a mapping preview UI showing strategy/confidence per column and sample rows.
Allow user edits and require explicit confirmation to proceed when low-confidence warnings exist.
```

---

## S3-07 Persist Immutable Mapping Snapshot per Revision

### Story Metadata
- Story ID: `S3-07`
- Title: `Persist Immutable Mapping Snapshot per Revision`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `BE`
- Sprint: `S3`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): `Stage 3 bullet 3`

### Inputs
- Confirmed mapping payload.

### Outputs
- `bom_column_mappings` immutable snapshot row(s).

### Contract
- Endpoint: `POST /api/mappings/confirm`
- Response: `201` with `mappingId`, `revisionId`, `immutable=true`, `confirmedAtUtc`.
- Retrieval: `GET /api/mappings/:revisionId`.

### Constraints
- No updates to existing mapping snapshot for same revision.
- Insert-only pattern for mapping snapshots.
- Mapping snapshot stores language metadata per mapped column.

### Acceptance Criteria
1. Confirmed mappings are persisted and retrievable by revision.
2. Existing revision mapping cannot be mutated.
3. Mapping schema includes canonical + original column metadata.

### AI Prompt (Execution-Ready)
```text
Implement immutable mapping persistence and retrieval per revision.
Reject mutation attempts for already-confirmed revision mappings.
```

---

## S3-08 Add Detection and Manual-Mapping Audit Trail

### Story Metadata
- Story ID: `S3-08`
- Title: `Add Detection and Manual-Mapping Audit Trail`
- Type: `Story`
- Priority: `P0`
- Estimate: `3`
- Owner: `BE`
- Sprint: `S3`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-006`, `NFR-AUDIT`
- Stage acceptance link(s): `Stage 3 bullet 3`

### Inputs
- Detection run output and mapping confirmation events.

### Outputs
- `column_detection_audits` records.

### Contract
- Audit event fields:
  - `tenantId`
  - `revisionId`
  - `sourceColumn`
  - `canonicalField`
  - `strategy`
  - `confidence`
  - `reviewState`
  - `actor`
  - `changedFrom?`
  - `changedTo?`
  - `timestampUtc`

### Constraints
- Append-only audit behavior.
- Correlation IDs included for API-triggered operations.
- Language metadata is not required in audit rows (stored in mapping snapshot instead).

### Acceptance Criteria
1. Automatic detection events are audit recorded.
2. User corrections are audit recorded with before/after values.
3. Audit entries are tenant-scoped and queryable by revision.

### AI Prompt (Execution-Ready)
```text
Implement append-only detection and mapping audit logging with strategy/confidence metadata.
Capture manual correction deltas and actor identity.
```

---

## S3-09 Add Stage 3 Automated Tests (Backend + Browser)

### Story Metadata
- Story ID: `S3-09`
- Title: `Add Stage 3 Automated Tests`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `QA/BE/FE`
- Sprint: `S3`
- Status: `Backlog`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): `Stage 3 bullets 1-3`

### Scope
- Backend coverage:
  - registry exact/fuzzy mapping
  - heuristic fallback
  - confidence gate states
  - immutable confirm behavior
  - audit logging
- Browser coverage:
  - preview rendering with confidence
  - edit + confirm flow
  - low-confidence warning + explicit proceed behavior

### Acceptance Criteria
1. Stage 3 acceptance bullets are explicitly mapped to automated tests.
2. `npm run verify:story` includes Stage 3 coverage and passes.
3. Failure diagnostics include browser artifacts and API payload visibility.

### AI Prompt (Execution-Ready)
```text
Add backend and browser tests for Stage 3 detection and mapping flows.
Map tests to Stage 3 acceptance criteria and ensure CI failure diagnostics are actionable.
```

---

## Sequencing

1. `S3-01` -> `S3-02` -> `S3-03` -> `S3-04`
2. `S3-05` -> `S3-06`
3. `S3-07` -> `S3-08`
4. `S3-09` (final gate)

## Dependency Readiness Gates

1. Schema/storage readiness for mapping and audit entities.
2. Revision/job context available for preview/confirm endpoints.
3. Stage 2 pipeline stable in Dev/Test.
