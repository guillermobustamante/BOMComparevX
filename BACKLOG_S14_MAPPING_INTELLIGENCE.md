# BACKLOG_S14_MAPPING_INTELLIGENCE.md

## Sprint S14 Backlog (Ticket-Ready)

This backlog defines the mapping-intelligence expansion stream for Stage 3 mapping and downstream comparison quality. It extends canonical mapping coverage, adds profile-aware detection, introduces explainable/context-aware scoring, and prepares a controlled tenant-learning loop.

Source precedence:
- `SPRINT_PLAN.md` ticket-ready story template
- `V1_SPEC.md` `FR-006`, `FR-007`
- `PRODUCT_PLAN.md` Stage 3 / Stage 7B direction
- `docs/change-management-gap-analysis.md`
- `docs/change-management-user-documentation.md`

## Delivery Guardrails

1. Deterministic by design:
- identical input must yield identical mapping suggestions
- no silent random promotion of learned aliases

2. Safe auto-mapping:
- `AUTO` only for high-confidence, explainable mappings
- ambiguous or cross-domain collisions must degrade to `REVIEW_REQUIRED` or warning

3. Profile-aware expansion:
- support global, industry, source-system, and tenant override layers
- preserve backward compatibility for existing Stage 3 contracts

4. Auditability:
- every mapping suggestion must explain why it was produced
- every learned alias promotion must be auditable and reversible

5. Quality enforcement:
- mapping improvements must not increase false downstream diff noise
- tests must cover positive and negative mapping cases

## Locked Clarification Decisions (Confirmed)

1. `1A` Tenant learning scope:
- tenant-only learning first
- no automatic cross-tenant promotion

2. `2A` Profile detection policy:
- auto-detect with optional override

3. `3A` Field policy defaults:
- conservative profile-specific defaults

4. `4A` Industry execution priority:
- automotive -> manufacturing -> aerospace -> electronics -> construction
- tenant admin override allowed

5. `5A` Source-system priority:
- `sap_bom` -> `erp_generic` -> `teamcenter_bom`

6. `6A` Learned-alias promotion thresholds:
- conservative thresholds
- `3` confirmations strengthen suggestion confidence
- `10+` confirmations become admin-review candidates for broader promotion

7. `7A` Fixture strategy:
- synthetic tests plus curated fixtures

8. `8A` Explainability UI scope:
- backend-first with light UI surfacing
- richer reviewer explainability UI is parked for future backlog work

---

## S14M-01 Canonical Mapping Model Expansion

### Story Metadata
- Story ID: `S14M-01`
- Title: `Expand canonical mapping model for cross-industry BOM semantics`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Product)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`, `FR-007`
- Stage acceptance link(s): Stage 3 mapping confidence/persistence bullets; Stage 7 profile field policy behavior
- Decision link(s): Stage 7B profile field policy separation

### User Story
As a mapping reviewer, I want the system to recognize a richer set of canonical fields so that BOMs from multiple industries can be mapped accurately without manual rework.

### Business Value
- Why this story matters now: current mapping coverage is too narrow for broader industry onboarding.
- Risk if delayed: high manual correction rate and low trust in mapping preview.

### Scope
- In scope:
  - add canonical fields for cross-industry mapping
  - keep current required/review flow backward-compatible
  - expose new fields in mapping preview/editor contracts
- Out of scope:
  - automatic tenant learning
  - new UI workflow beyond existing mapping editor

### Inputs
- Trigger/API/UI input: mapping preview generation for a revision
- Required fields and types: source headers, sample rows, tenant/revision context
- Preconditions: uploaded revision exists and headers can be resolved
- Auth/Tenant context required: yes

### Outputs
- Success outputs (payload, redirect, state change): expanded canonical field options in preview and confirmation payloads
- Failure outputs (error payload, UI state): existing Stage 3 errors remain unchanged
- Side effects (events, history/audit records): detection audits include new canonical field values

### Contract
- Endpoint(s)/event(s): existing `/api/mappings/preview/:revisionId`, `/api/mappings/confirm`
- Request schema: backward-compatible with existing contract
- Response schema: canonical field lists can include new values
- Status/error codes: unchanged
- Idempotency/retry behavior: unchanged
- Versioning notes: keep `v1` unless breaking change is introduced

### Constraints
- Security constraints: no cross-tenant leakage of custom fields
- Performance constraints: no material slowdown for preview generation
- Compliance/audit constraints: new fields must remain audit-visible
- Environment/config constraints: none
- Time/date constraints (UTC, cooldown windows, retention timing): n/a

### Acceptance Criteria
1. Canonical mapping model includes the new cross-industry fields: `unit_of_measure`, `find_number`, `assembly`, `parent_path`, `plant`, `make_buy`, `material`, `finish`, `weight`, `effectivity_from`, `effectivity_to`, `serial_range`, `drawing_number`, `manufacturer_part_number`, `customer_part_number`, `compliance_status`, `hazard_class`, `location`, `discipline`.
2. Existing required-field and warning behavior remains deterministic and backward-compatible.
3. New canonical fields are available in preview/edit/confirm flows and covered by automated tests.

### Test Plan
- Unit tests: canonical-field contract assertions
- Integration tests: preview payload exposes new field targets
- E2E/manual tests: mapping editor can select and confirm new canonical fields
- Test data/fixtures: multi-industry header sets
- Observability checks (logs/metrics/traces): detection audit captures new field targets

### Dependencies
- Upstream systems/services: existing mapping preview service
- Infrastructure prerequisites: none
- Blockers: none

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
```text
You are implementing story S14M-01: Expand canonical mapping model for cross-industry BOM semantics.

Objective:
Add the new canonical field set without breaking Stage 3 mapping contracts.

In Scope:
- Expand canonical field coverage
- Preserve deterministic review-state behavior
- Add regression tests
```

---

## S14M-02 Explicit Industry and Source-System Profiles

### Story Metadata
- Story ID: `S14M-02`
- Title: `Add explicit industry and source-system mapping profiles`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Data)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`, `FR-007`
- Stage acceptance link(s): Stage 3 detection behavior; Stage 7B profile onboarding model
- Decision link(s): Stage 7B profile detection auto-detect + fallback

### User Story
As a mapping reviewer, I want explicit industry and source-system profiles so that the system can use the right vocabulary and scoring rules for the uploaded file.

### Business Value
- Why this story matters now: generic domain labels are too coarse for real customer exports.
- Risk if delayed: alias collisions and weak confidence scoring across industries.

### Scope
- In scope:
  - add explicit profiles: `automotive`, `construction`, `plm_generic`, `erp_generic`, `sap_bom`, `teamcenter_bom`, `ifc_schedule`, `ipc_bom`
  - support profile-aware alias filtering/scoring
- Out of scope:
  - ML profile detection
  - tenant auto-promotion

### Inputs
- Trigger/API/UI input: preview request with optional profile/domain context
- Required fields and types: headers, optional context hints
- Preconditions: preview seed resolvable
- Auth/Tenant context required: yes

### Outputs
- Success outputs (payload, redirect, state change): profile-aware mapping candidates
- Failure outputs (error payload, UI state): fallback to generic behavior
- Side effects (events, history/audit records): audit evidence includes profile source where applied

### Contract
- Endpoint(s)/event(s): preview service internals; existing preview endpoint
- Request schema: optional profile/domain hints
- Response schema: evidence includes profile/domain
- Status/error codes: unchanged
- Idempotency/retry behavior: deterministic fallback
- Versioning notes: additive only

### Constraints
- Security constraints: tenant-scoped profile hints only
- Performance constraints: profile selection must not introduce multi-second preview latency
- Compliance/audit constraints: chosen profile must be auditable
- Environment/config constraints: safe fallback when hint absent
- Time/date constraints (UTC, cooldown windows, retention timing): n/a

### Acceptance Criteria
1. Explicit profiles are modeled and usable by detection services.
2. Preview evidence identifies the domain/profile used when profile weighting affected the result.
3. Tests cover at least one positive mapping case per newly added profile family.

### Test Plan
- Unit tests: profile filtering and exact/fuzzy alias behavior
- Integration tests: profile-aware preview results
- E2E/manual tests: deterministic preview with profile hints
- Test data/fixtures: profile-specific header sets
- Observability checks (logs/metrics/traces): audit evidence persists profile metadata

### Dependencies
- Upstream systems/services: semantic registry service
- Infrastructure prerequisites: none
- Blockers: none

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
```text
You are implementing story S14M-02: Add explicit industry and source-system mapping profiles.

Objective:
Move mapping detection from coarse domain labels to explicit profile-aware routing with deterministic fallback.
```

---

## S14M-03 Context-Aware Detection and Negative Rules

### Story Metadata
- Story ID: `S14M-03`
- Title: `Use column context, sample patterns, and negative rules in detection`
- Type: `Story`
- Priority: `P0`
- Estimate: `8`
- Owner: `AI Coding Agent (BE)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): Stage 3 confidence-gate behavior
- Decision link(s): deterministic fallback behavior

### User Story
As a mapping reviewer, I want mapping suggestions to use header context and sample values so that the system avoids obvious false mappings and reduces manual corrections.

### Business Value
- Why this story matters now: header-only mapping cannot reliably distinguish similar operational columns.
- Risk if delayed: false auto-maps on fields like `Status`, `No`, or adjacent numeric columns.

### Scope
- In scope:
  - use neighboring columns, sample rows, value patterns, repeated enumerations, unit tokens, and hierarchy signals
  - add negative rules that reduce confidence or block invalid candidates
- Out of scope:
  - ML inference
  - UI redesign

### Inputs
- Trigger/API/UI input: preview detection
- Required fields and types: header array, sample rows
- Preconditions: seed contains at least headers
- Auth/Tenant context required: yes

### Outputs
- Success outputs (payload, redirect, state change): safer mapping candidates with context evidence
- Failure outputs (error payload, UI state): unresolved columns remain reviewable
- Side effects (events, history/audit records): richer audit evidence

### Contract
- Endpoint(s)/event(s): preview service internals
- Request schema: additive context inputs only
- Response schema: evidence includes value-pattern/position/template reasons
- Status/error codes: unchanged
- Idempotency/retry behavior: deterministic from same input
- Versioning notes: additive evidence only

### Constraints
- Security constraints: sample inspection must stay within tenant payload
- Performance constraints: preview remains interactive for typical Stage 3 file sizes
- Compliance/audit constraints: negative-rule suppressions remain explainable
- Environment/config constraints: none
- Time/date constraints (UTC, cooldown windows, retention timing): n/a

### Acceptance Criteria
1. Detection uses non-header context signals in scoring.
2. Negative rules prevent at least these false-positive patterns:
   - numeric column adjacent to `Qty` is not auto-mapped as `quantity` when it looks like line/find/index numbering
   - `Status` in construction contexts does not auto-map to `lifecycle_status` when values look like workflow states
3. Evidence explains which context and/or negative rule influenced each mapping.

### Test Plan
- Unit tests: value-pattern boosts and negative-rule penalties
- Integration tests: preview results for ambiguous headers
- E2E/manual tests: deterministic mapping preview on multi-context fixtures
- Test data/fixtures: quantity-vs-line-number, construction-status, hierarchy-driven headers
- Observability checks (logs/metrics/traces): audit entries show rule-driven evidence

### Dependencies
- Upstream systems/services: semantic registry and preview service
- Infrastructure prerequisites: none
- Blockers: none

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
```text
You are implementing story S14M-03: Use column context, sample patterns, and negative rules in detection.

Objective:
Reduce false mappings by combining header signals with neighbor/value/hierarchy context and explicit suppression rules.
```

---

## S14M-04 Identity, Comparable, and Business-Impact Field Policies

### Story Metadata
- Story ID: `S14M-04`
- Title: `Separate identity, comparable, display, and business-impact mapping policies`
- Type: `Story`
- Priority: `P1`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Architect)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`, `FR-007`
- Stage acceptance link(s): Stage 7 profile field policy behavior
- Decision link(s): effectivity/change-control secondary identity by default

### User Story
As a comparison reviewer, I want mapped fields categorized by how they affect matching and comparison so that changes are interpreted correctly and safely.

### Business Value
- Why this story matters now: more fields only help if the system knows how each field should influence matching and diffing.
- Risk if delayed: false identity breaks or noisy change classification.

### Scope
- In scope:
  - categorize fields into `identity`, `comparable`, `display`, `business_impact`
  - preserve downstream matching/classification determinism
- Out of scope:
  - approval workflow logic

### Inputs
- Trigger/API/UI input: confirmed mapping snapshot feeding diff pipeline
- Required fields and types: canonical field policy config
- Preconditions: mapping snapshot exists
- Auth/Tenant context required: yes

### Outputs
- Success outputs (payload, redirect, state change): policy-aware mapping and diff behavior
- Failure outputs (error payload, UI state): deterministic fallback to default generic policy
- Side effects (events, history/audit records): diagnostics include policy applied

### Contract
- Endpoint(s)/event(s): profile adapter / diff pipeline contracts
- Request schema: additive field policy metadata
- Response schema: unchanged externally unless diagnostics expanded
- Status/error codes: unchanged
- Idempotency/retry behavior: deterministic
- Versioning notes: additive

### Constraints
- Security constraints: no tenant policy leakage
- Performance constraints: negligible overhead
- Compliance/audit constraints: policy selection auditable
- Environment/config constraints: default safe policy if profile missing
- Time/date constraints (UTC, cooldown windows, retention timing): n/a

### Acceptance Criteria
1. Field policies separate identity from comparable and display use.
2. Business-impact-only fields can be surfaced for review without necessarily changing row identity.
3. Tests prove fields like `plant` and `effectivity` can be configured without breaking deterministic matching.

### Test Plan
- Unit tests: field policy classification
- Integration tests: diff behavior under profile policies
- E2E/manual tests: controlled comparison fixtures
- Test data/fixtures: plant/effectivity delta cases
- Observability checks (logs/metrics/traces): diagnostics report policy application

### Dependencies
- Upstream systems/services: diff pipeline
- Infrastructure prerequisites: none
- Blockers: none

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
```text
You are implementing story S14M-04: Separate identity, comparable, display, and business-impact mapping policies.
```

---

## S14M-05 Tenant Alias Packs and Controlled Learning

### Story Metadata
- Story ID: `S14M-05`
- Title: `Introduce tenant-level alias packs and controlled mapping learning loop`
- Type: `Story`
- Priority: `P1`
- Estimate: `8`
- Owner: `AI Coding Agent (BE/Data)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): Stage 3 auditability and immutable mapping confirmation
- Decision link(s): deterministic and auditable promotions only

### User Story
As a tenant admin, I want the system to reuse mappings my organization has repeatedly confirmed so that future uploads map faster and more accurately.

### Business Value
- Why this story matters now: recurring tenant-specific headers are a high-value source of improvement.
- Risk if delayed: repeated manual corrections for known customer formats.

### Scope
- In scope:
  - tenant alias pack persistence
  - using confirmed mappings as suggestion signals
  - conservative promotion thresholds
- Out of scope:
  - global auto-promotion without review

### Inputs
- Trigger/API/UI input: mapping confirmation events and future preview requests
- Required fields and types: confirmed source column -> canonical field pair, tenant context
- Preconditions: immutable mapping confirmation exists
- Auth/Tenant context required: yes

### Outputs
- Success outputs (payload, redirect, state change): tenant-weighted suggestions
- Failure outputs (error payload, UI state): fallback to global/profile registry
- Side effects (events, history/audit records): alias learning records and promotion audits

### Contract
- Endpoint(s)/event(s): mapping confirmation pipeline, preview pipeline
- Request schema: existing confirmation payload plus derived learning signals
- Response schema: evidence includes `tenant_confirmation`
- Status/error codes: unchanged
- Idempotency/retry behavior: confirmation learning must be idempotent per revision/source column
- Versioning notes: additive

### Constraints
- Security constraints: learned aliases are tenant-scoped by default
- Performance constraints: no heavy runtime aggregation on each preview
- Compliance/audit constraints: promotions auditable and reversible
- Environment/config constraints: feature-flag controlled
- Time/date constraints (UTC, cooldown windows, retention timing): promotions timestamped in UTC

### Acceptance Criteria
1. Confirmed mappings create or reinforce tenant-level alias suggestions.
2. Future previews for the same tenant reuse those aliases deterministically.
3. Tests cover learning, reuse, and non-leakage across tenants.

### Test Plan
- Unit tests: alias promotion threshold logic
- Integration tests: confirmation-to-preview learning reuse
- E2E/manual tests: repeat upload flow for same tenant
- Test data/fixtures: repeated custom headers by tenant
- Observability checks (logs/metrics/traces): learning metrics and audit events

### Dependencies
- Upstream systems/services: mapping confirmation persistence and audits
- Infrastructure prerequisites: persistence for learned aliases
- Blockers: schema and migration work

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
```text
You are implementing story S14M-05: Introduce tenant-level alias packs and controlled mapping learning loop.
```

---

## S14M-06 Explainable Scoring Evidence

### Story Metadata
- Story ID: `S14M-06`
- Title: `Add explainable mapping evidence and scoring reasons`
- Type: `Story`
- Priority: `P0`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/FE)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): Stage 3 audit trail and preview UX clarity
- Decision link(s): deterministic explainability for mapping suggestions

### User Story
As a mapping reviewer, I want each suggestion to show why it was made so that I can trust or correct it quickly.

### Business Value
- Why this story matters now: confidence without reasons is not enough for user trust.
- Risk if delayed: users must reverse-engineer why the system mapped a field.

### Scope
- In scope:
  - evidence reasons such as `exact_alias`, `fuzzy_alias`, `value_pattern`, `position_pattern`, `negative_rule`, `industry_template`, `tenant_confirmation`
  - additive evidence in preview payload and audits
- Out of scope:
  - major UI redesign

### Inputs
- Trigger/API/UI input: preview generation
- Required fields and types: mapping candidate score components
- Preconditions: candidate scoring executed
- Auth/Tenant context required: yes

### Outputs
- Success outputs (payload, redirect, state change): richer evidence payload for each candidate
- Failure outputs (error payload, UI state): existing mapping preview still renders
- Side effects (events, history/audit records): audits can reconstruct why a mapping was suggested

### Contract
- Endpoint(s)/event(s): preview payload, audit records
- Request schema: unchanged
- Response schema: evidence object expanded with reason list
- Status/error codes: unchanged
- Idempotency/retry behavior: deterministic
- Versioning notes: additive evidence

### Constraints
- Security constraints: no cross-tenant evidence leakage
- Performance constraints: reasons must be derived from already computed scoring data where possible
- Compliance/audit constraints: reason chain retained in audit artifacts or reproducible from score inputs
- Environment/config constraints: none
- Time/date constraints (UTC, cooldown windows, retention timing): n/a

### Acceptance Criteria
1. Mapping candidates include explainable evidence reasons.
2. Evidence can show both positive and suppressing factors.
3. Tests prove evidence remains deterministic for the same input.

### Test Plan
- Unit tests: evidence reason construction
- Integration tests: preview payload evidence assertions
- E2E/manual tests: mapping preview displays reasons where available
- Test data/fixtures: exact/fuzzy/context/negative-rule cases
- Observability checks (logs/metrics/traces): audit evidence completeness

### Dependencies
- Upstream systems/services: detection engine
- Infrastructure prerequisites: none
- Blockers: none

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

### AI Prompt (Execution-Ready)
```text
You are implementing story S14M-06: Add explainable mapping evidence and scoring reasons.
```

---

## S14M-07 Manufacturing Mapping Pack

### Story Metadata
- Story ID: `S14M-07`
- Title: `Add manufacturing profile mappings and fixtures`
- Type: `Story`
- Priority: `P1`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Data)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): Stage 3 detection confidence behavior
- Decision link(s): profile-driven onboarding

### User Story
As a manufacturing user, I want common manufacturing BOM fields to auto-map correctly so that I can confirm mappings quickly and proceed to comparison.

### Scope
- In scope:
  - fields: `plant`, `work_center`, `uom`, `make_buy`, `procurement_type`, `lead_time`, `material_group`, `routing_ref`, `alternate_part`, `effectivity`
  - manufacturing aliases and fixtures
- Out of scope:
  - ERP-specific tenant overrides

### Acceptance Criteria
1. Manufacturing headers map correctly under manufacturing-oriented profiles.
2. Ambiguous operational headers degrade safely to review or warning.
3. Tests cover common positive and negative cases for manufacturing data.

### Test Plan
- Unit tests: alias coverage and false-positive suppression
- Integration tests: manufacturing preview fixture
- E2E/manual tests: mapping preview on manufacturing seed
- Test data/fixtures: ERP-style BOM headers
- Observability checks (logs/metrics/traces): detection evidence shows manufacturing template use

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

---

## S14M-08 Automotive Mapping Pack

### Story Metadata
- Story ID: `S14M-08`
- Title: `Add automotive profile mappings and fixtures`
- Type: `Story`
- Priority: `P1`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Data)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`
- Stage acceptance link(s): Stage 3 detection confidence behavior
- Decision link(s): profile-driven onboarding

### User Story
As an automotive user, I want automotive BOM and quality-adjacent fields to map correctly so that program and supplier-driven changes can be reviewed without remapping each file.

### Scope
- In scope:
  - fields: `program`, `vehicle_line`, `plant`, `option_code`, `engineering_level`, `change_notice`, `supplier_code`, `PPAP_status`, `tooling_status`, `service_part_flag`
- Out of scope:
  - PPAP workflow generation

### Acceptance Criteria
1. Automotive-specific aliases are recognized by automotive profiles.
2. Shared headers with manufacturing profiles remain deterministically disambiguated.
3. Tests cover positive mapping and collision scenarios.

### Test Plan
- Unit tests: automotive alias cases
- Integration tests: automotive preview fixture
- E2E/manual tests: deterministic preview review flow
- Test data/fixtures: automotive BOM export samples
- Observability checks (logs/metrics/traces): profile evidence and collision behavior

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

---

## S14M-09 Aerospace Mapping Pack

### Story Metadata
- Story ID: `S14M-09`
- Title: `Add aerospace profile mappings and fixtures`
- Type: `Story`
- Priority: `P1`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Data)`
- Sprint: `S14`
- Status: `Completed`

### User Story
As an aerospace user, I want configuration and drawing-related fields to map correctly so that effectivity-sensitive changes can be reviewed with less manual work.

### Scope
- In scope:
  - fields: `drawing_number`, `dash_number`, `effectivity`, `tail_number`, `serial_range`, `lot`, `configuration_state`, `criticality`, `airworthiness_class`, `approved_supplier`
- Out of scope:
  - release/airworthiness approval workflow

### Acceptance Criteria
1. Aerospace aliases are recognized under aerospace profiles.
2. Effectivity/drawing-related fields are distinguishable from generic revision/status fields.
3. Tests cover positive mapping and ambiguous collision scenarios.

### Test Plan
- Unit tests: aerospace alias and value-pattern cases
- Integration tests: aerospace preview fixture
- E2E/manual tests: review-required behavior for ambiguous headers
- Test data/fixtures: aerospace export samples
- Observability checks (logs/metrics/traces): evidence reasons include aerospace template use

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

---

## S14M-10 Electronics Mapping Pack

### Story Metadata
- Story ID: `S14M-10`
- Title: `Add electronics profile mappings and fixtures`
- Type: `Story`
- Priority: `P1`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Data)`
- Sprint: `S14`
- Status: `Completed`

### User Story
As an electronics user, I want PCB and compliance-related fields to map correctly so that AVL, compliance, and designator changes are reviewable without repeated manual fixes.

### Scope
- In scope:
  - fields: `reference_designator`, `footprint`, `package`, `manufacturer`, `manufacturer_part_number`, `AVL`, `compliance_status`, `RoHS`, `REACH`, `lifecycle_risk`, `substitute_part`
- Out of scope:
  - compliance rules engine

### Acceptance Criteria
1. Electronics aliases are recognized under electronics or `ipc_bom` profiles.
2. Designator/manufacturer/compliance fields map deterministically.
3. Tests cover positive and negative cases for electronics field families.

### Test Plan
- Unit tests: electronics alias and fuzzy cases
- Integration tests: electronics preview fixture
- E2E/manual tests: deterministic preview confirmation
- Test data/fixtures: PCB BOM samples
- Observability checks (logs/metrics/traces): evidence shows profile/template reasons

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

---

## S14M-11 Construction Mapping Pack

### Story Metadata
- Story ID: `S14M-11`
- Title: `Add construction profile mappings and fixtures`
- Type: `Story`
- Priority: `P1`
- Estimate: `5`
- Owner: `AI Coding Agent (BE/Data)`
- Sprint: `S14`
- Status: `Completed`

### User Story
As a construction user, I want project and BIM-oriented fields to map correctly so that schedule and information-package extracts can be compared without reworking the mapping every time.

### Scope
- In scope:
  - fields: `asset_id`, `system`, `discipline`, `spec_section`, `location`, `level`, `zone`, `room`, `IFC_class`, `COBie_attribute`, `install_phase`, `revision_package`
- Out of scope:
  - IFC-native file parsing

### Acceptance Criteria
1. Construction aliases are recognized under construction or `ifc_schedule` profiles.
2. Workflow-style `Status` values do not auto-map to `lifecycle_status` when construction context indicates schedule/state semantics.
3. Tests cover construction-specific positive and negative mapping cases.

### Test Plan
- Unit tests: construction alias and negative-rule cases
- Integration tests: construction preview fixture
- E2E/manual tests: preview review flow
- Test data/fixtures: schedule/BIM extract headers
- Observability checks (logs/metrics/traces): evidence shows negative-rule suppression where applied

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.

---

## S14M-12 Mapping Quality Gates and Regression Pack

### Story Metadata
- Story ID: `S14M-12`
- Title: `Add mapping regression fixtures, industry coverage tests, and quality gates`
- Type: `Story`
- Priority: `P0`
- Estimate: `8`
- Owner: `AI Coding Agent (QA/BE)`
- Sprint: `S14`
- Status: `Completed`

### Traceability
- Requirement link(s): `FR-006`, `FR-007`
- Stage acceptance link(s): Stage 3 QA matrix items 6-7; Stage 7 same-vs-same determinism baseline
- Decision link(s): deterministic quality baseline

### User Story
As a release owner, I want mapping changes to be regression-tested across industries so that new alias and scoring rules do not break existing customer flows.

### Business Value
- Why this story matters now: mapping intelligence will become progressively broader and riskier without a strong safety net.
- Risk if delayed: silent regression in mapping quality and downstream comparisons.

### Scope
- In scope:
  - industry fixture matrix
  - deterministic regression assertions
  - false-positive/false-negative focused tests
- Out of scope:
  - production observability dashboard

### Acceptance Criteria
1. Automated tests cover manufacturing, automotive, aerospace, electronics, and construction mapping cases.
2. Regression suite includes negative cases and deterministic evidence assertions.
3. Release verification fails if mapping behavior regresses on protected fixtures.

### Test Plan
- Unit tests: core scoring and rule logic
- Integration tests: preview endpoint coverage for all industry packs
- E2E/manual tests: spot-check mapping editor flow on representative revisions
- Test data/fixtures: curated header/sample-row matrix by industry
- Observability checks (logs/metrics/traces): confidence distribution and unresolved rate checks in test runs

### Definition of Done
- Implementation complete and merged.
- Tests added and passing.
- Acceptance criteria verified in Test.
- Docs/runbook/config updates completed.
- Monitoring/audit hooks verified.
