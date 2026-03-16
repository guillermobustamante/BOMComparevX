# Architecture Data Externalization Assessment

Date: 2026-03-14  
Primary audience: Product Manager, AI implementation agent  
Objective: Identify which product data currently embedded in code or process memory should move to relational database storage or graph storage, explain why and how, and define a phased implementation plan that preserves the original architecture goals.

## Executive Summary

The current architecture direction remains sound. The platform goals in `PRODUCT_PLAN.md` and `V1_SPEC.md` still hold:

- deterministic comparison
- tenant isolation
- immutable revision/result behavior
- async processing
- semantic mapping accuracy
- graph-backed BOM hierarchy traversal

The main architectural gap is not the overall design. The gap is that too much product reference data and some operational state still live in code, markdown, or process memory. That creates four risks:

1. product behavior changes require code deployment instead of governed data changes
2. historical comparisons can drift when live taxonomy or alias logic changes
3. frontend and backend can diverge on business vocabulary
4. runtime state is less durable than the architecture intends

The highest-value architectural change is:

- relational database for governed reference data and durable operational state
- Azure SQL Graph for authoritative BOM hierarchy reads and structure traversal
- frontend as a consumer of backend-owned metadata, not a second source of business truth

## Original Goals Check

The original goals should remain in place. They do not need replacement. They do need stronger wording in two places.

### Goals that still stand

- `Speed First`
- `Accuracy at Scale`
- `Determinism First`
- `Format Preservation`
- `Isolation-First Multi-Tenancy`
- `Immutability for Reproducibility`
- `Async-First Processing`
- `Progressive Capability`

### Recommended amendments

Add these architecture principles explicitly:

1. `Reference-Data Governance`
   Business vocabularies, taxonomies, aliases, and canonical field definitions are governed data assets and must be versioned outside application code.

2. `Durable Operational State`
   Any user-visible job state, classification provenance, or workflow state must survive process restart and horizontal scaling.

Sharpen this existing principle:

- Current: `Graph Capability`
- Recommended: `Authoritative Graph-Backed Hierarchy Read Model`

Reason: graph should not be a future option or side model. It should be the authoritative read path for BOM structure traversal once the cutover is complete.

## Decision Rule: Database vs Graph vs Code

Use this rule consistently.

### Put data in relational database when

- it is business-governed reference data
- it changes without requiring code behavior changes
- it needs audit history or versioning
- it needs tenant-specific overrides
- it drives UI choices or backend classification rules
- it must survive restart and scaling

### Put data in graph when

- the value is in traversing relationships, ancestry, containment, or structural context
- the query asks parent-child, ancestor-descendant, path, moved-context, or impact-through-structure questions

### Keep data in code when

- it is pure presentation behavior
- it is local UI state
- it is stable technical configuration rather than business vocabulary
- it is algorithmic logic, not governed reference data

## Assessment: What Should Move Out of Code

### Summary table

| ID | Current section | Current evidence | Recommended target | Why move it | How to implement |
|---|---|---|---|---|---|
| A-01 | Industry taxonomy baseline and taxonomy versions | `apps/backend/src/mapping/bom-change-taxonomy.service.ts`, `docs/runbooks/bom_change_taxonomy_by_industry.md` | Relational DB | Taxonomy is governed business data, not code | Create versioned taxonomy tables, seed current markdown, bind each comparison to a taxonomy version |
| A-02 | Canonical property families and classification-tag alias vocabulary | `apps/backend/src/mapping/taxonomy-property-family.service.ts`, `docs/runbooks/canonical_engineering_property_families.md` | Relational DB | Alias/family growth is continuous and should be audited and tenant-aware | Store families, aliases, industry scope, confidence, and lifecycle state in tables |
| A-03 | Semantic registry alias catalog and canonical vocabulary | `apps/backend/src/mapping/semantic-registry.service.ts` | Relational DB + cache | Vocabulary changes should not require code deploys | Persist aliases and canonical field definitions, cache in memory for runtime speed |
| A-04 | Canonical field catalog duplicated across backend and frontend | `apps/backend/src/mapping/mapping-contract.ts`, `apps/frontend/components/mapping-preview-editor.tsx` | Relational DB or backend metadata source | Frontend/backend drift risk | Make backend the source of truth and expose metadata endpoints |
| A-05 | Tenant alias learning observations and aggregate evidence | `apps/backend/src/mapping/mapping-alias-learning.service.ts` | Relational DB | Learned behavior is business data and should be auditable and durable | Store observations, aggregates, decisions, and approval state as first-class records |
| A-06 | Async upload/diff runtime state still held in process-local structures | `apps/backend/src/uploads/upload-queue.service.ts`, `apps/backend/src/uploads/upload-job.service.ts`, `apps/backend/src/diff/diff-job.service.ts` | Durable queue + relational job state | Restart/scaling resilience is required by architecture | Move command delivery to real queue, persist status/progress in DB |
| A-07 | Historical comparison classification provenance | inferred across diff and taxonomy flow | Relational DB | Old results must not change when live taxonomy changes | Persist taxonomy version, alias pack version, and classification evidence on the comparison |
| A-08 | Hierarchy/tree read model not yet fully graph-authoritative | `apps/backend/prisma/schema.prisma`, `apps/backend/src/diff/diff-job.service.ts` | Azure SQL Graph | Structure traversal is the graph use case that justifies graph adoption | Cut hierarchy reads to `PartNode` and `ContainsEdge`, keep relational compatibility projections where needed |
| A-09 | Frontend-held Admin and mapping metadata that mirrors backend business concepts | `apps/frontend/components/admin-governance-console.tsx`, `apps/frontend/components/mapping-preview-editor.tsx` | Backend metadata API backed by DB | Product vocabulary should be governed server-side | Replace UI-local business metadata with backend metadata fetches |

## Detailed Recommendations

### A-01. Industry taxonomy baseline and taxonomy versions

Current state:

- taxonomy baseline content is embedded in backend code and seeded from markdown
- the taxonomy editor UI behaves like product data already, but the source of truth is still partially code-centric

Recommended model:

- `taxonomySet`
- `taxonomyVersion`
- `taxonomyCategory`
- `taxonomyCoreDefinition`
- `taxonomyTriggerProperty`
- `taxonomyApprovalRole`
- `taxonomyComplianceRule`
- `taxonomyVersionStatus`

Why:

- taxonomy content is governed business policy
- Product needs version history, approval, rollback, and auditability
- comparisons must be reproducible against the taxonomy version active at run time

How:

1. Seed the current markdown taxonomy into versioned relational tables.
2. Make the Admin editor read and write only through the database-backed service.
3. Persist `taxonomyVersionId` on each comparison result.
4. Add an explicit publish workflow so draft changes do not instantly rewrite production classifications.

Goal impact:

- strengthens `Immutability for Reproducibility`
- strengthens `Determinism First`
- does not require changing the original product goals

### A-02. Canonical property families and classification-tag alias vocabulary

Current state:

- canonical engineering property families and alias logic are defined in code
- the product is already evolving toward semantic matching and tenant-governed aliases

Recommended model:

- `propertyFamily`
- `propertyFamilyAlias`
- `classificationTag`
- `classificationTagAlias`
- `industryScope`
- `aliasConfidencePolicy`

Why:

- alias growth is ongoing and domain-specific
- Product and operations need to curate vocabularies without code releases
- tenant and industry overrides are expected

How:

1. Keep the matching algorithm in code.
2. Move the controlled vocabulary and alias packs into relational tables.
3. Support global, industry, and tenant scopes.
4. Store confidence and approval metadata with each alias entry.

Goal impact:

- directly supports `Accuracy at Scale`
- preserves deterministic execution because the versioned alias data used per run can be locked

### A-03. Semantic registry alias catalog and canonical vocabulary

Current state:

- semantic alias dictionaries are code-owned in the semantic registry service

Recommended model:

- `canonicalFieldDefinition`
- `semanticAlias`
- `semanticDomain`
- `semanticLanguage`
- `semanticProfile`

Why:

- the registry is product master data
- multilingual and cross-industry vocabularies will continue to expand
- reference-data governance belongs in persistent storage

How:

1. Persist the current registry data in the database.
2. Load hot slices into cache during application startup.
3. Keep the resolver algorithm in code but remove hardcoded vocabularies from services.

Goal impact:

- aligns with the existing `Semantic Registry` objective in the architecture
- no goal amendment required

### A-04. Canonical field catalog duplicated across backend and frontend

Current state:

- canonical fields are defined in backend contracts and partially duplicated in frontend editor logic

Recommended model:

- backend-owned metadata contract, backed by DB or at minimum backend metadata code
- frontend consumes metadata through API

Why:

- duplicated business definitions drift
- UI should not encode canonical-field governance locally

How:

1. Create a metadata endpoint for canonical fields, profiles, required/optional state, and display labels.
2. Update mapping preview and Admin taxonomy editor to consume backend metadata.
3. Remove duplicate lists from the frontend.

Goal impact:

- improves frontend/backend coherence
- does not change the original product goals

### A-05. Tenant alias learning observations and aggregate evidence

Current state:

- tenant alias decisions exist, but learned evidence is still reconstructed into in-memory structures

Recommended model:

- `tenantAliasObservation`
- `tenantAliasAggregate`
- `tenantAliasDecision`
- `tenantAliasApprovalEvent`

Why:

- learned alias evidence is governed product behavior
- it needs audit trail, confidence history, and survivability across restarts

How:

1. Append an observation record every time a mapping is confirmed.
2. Maintain aggregate counts and confidence in relational tables.
3. Keep enable/disable or approve/reject states as separate decision records.
4. Use these records to generate recommended aliases for Admin review.

Goal impact:

- supports `Accuracy at Scale`
- supports tenant governance without weakening deterministic behavior if versioned snapshots are used per comparison

### A-06. Async upload and diff runtime state

Current state:

- some queue and job state remain process-local

Recommended model:

- broker queue for work dispatch
- relational job-state tables for progress and recoverability

Suggested tables:

- `jobRun`
- `jobPhase`
- `jobAttempt`
- `jobArtifact`
- `jobFailureEvent`

Why:

- current architecture already promises queue-backed background processing
- process-local state is weaker than the intended operating model
- progress visibility must survive restart and horizontal scaling

How:

1. Keep API contracts stable.
2. Move command delivery to queue infrastructure.
3. Persist authoritative progress/status in DB.
4. Let workers be stateless consumers.

Goal impact:

- required to fully satisfy `Async-First Processing`
- no goal amendment required

### A-07. Historical comparison classification provenance

Current state:

- classification results can be recomputed using live taxonomy and alias behavior instead of the version that existed when the comparison ran

Recommended model:

- persist on the comparison:
  - `taxonomyVersionId`
  - `semanticRegistryVersionId`
  - `aliasPackVersionId`
  - `classificationEvidence`
  - `classificationEngineVersion`

Why:

- Product explicitly needs historical stability
- old results should not change when Admin taxonomy is edited later

How:

1. Persist all version references when the comparison is finalized.
2. Store match evidence payloads needed for audit and explainability.
3. Require an explicit reclassification workflow if historical data is ever intentionally recalculated.

Goal impact:

- strongly reinforces `Immutability for Reproducibility`
- no change to original goals, only a stronger implementation of them

### A-08. Hierarchy/tree read model should be graph-authoritative

Current state:

- graph tables exist
- some hierarchy logic still reconstructs structure from non-graph row snapshots or compatibility layers

Recommended model:

- Azure SQL Graph remains the structural source of truth for:
  - parent-child traversal
  - ancestor/descendant lookup
  - moved-context analysis
  - revision hierarchy queries

Why:

- this is the clearest graph-native use case in the product
- hierarchy traversal is where graph earns its complexity

How:

1. Keep row-level diff storage relational.
2. Move tree and structure traversal reads to `PartNode` and `ContainsEdge`.
3. Use compatibility projections where contracts still require `bom_components` or `component_links`.
4. Add graph-backed tests for moved classification and tree determinism.

Goal impact:

- the original graph goal should be sharpened, not replaced

### A-09. Frontend-held business metadata

Current state:

- some frontend components still carry domain-specific business lists and labels that mirror backend concepts

Recommended model:

- frontend should consume:
  - taxonomy metadata
  - canonical field metadata
  - classification tag metadata
  - alias-family display metadata

Why:

- PM-governed business vocabulary should not require frontend redeploys
- backend must remain the source of truth

How:

1. expose metadata endpoints
2. cache stable responses client-side
3. keep only presentation-only configuration in code

Goal impact:

- improves maintainability and consistency
- no goal amendment required

## Frontend Assessment

### What should move out of frontend code

| Frontend area | Current evidence | Move to | Why |
|---|---|---|---|
| Canonical field option lists and mapping metadata | `apps/frontend/components/mapping-preview-editor.tsx` | Backend metadata API | Avoid duplicate business logic |
| Admin taxonomy schema vocabulary that mirrors backend policy concepts | `apps/frontend/components/admin-governance-console.tsx` | Backend metadata API + relational DB | Governance data should be server-owned |

### What should stay in frontend code

- visual layout and interaction behavior
- local animation and display timing
- local page-size lists, sort defaults, and view toggles where they are pure UX choices
- shell navigation and route presentation labels, unless Product wants dynamic role-driven nav from backend later

Frontend conclusion:

The frontend is mostly thin and should stay thin. The architectural issue is not that the UI contains too much logic overall. The issue is that some domain-owned metadata is duplicated there and should instead be served by the backend.

## Backend Assessment

### Where the current backend architecture is strongest

- deterministic matching and diffing direction is clear
- revision immutability is already a first-class concept
- taxonomy and alias governance direction is emerging correctly
- graph adoption for BOM structure is directionally correct

### Where the main architectural debt exists

- product vocabularies still embedded in services
- markdown-seeded business data still behaves like code-owned assets
- queue and job state are not yet fully durable
- graph exists but is not yet the complete authoritative read path for structure
- comparison results need stronger provenance locking

Backend conclusion:

The backend already points toward the correct architecture. The main work is to externalize data ownership cleanly and make runtime state match the durability promised in the architecture documents.

## What Should Not Move

To avoid over-architecting, these should remain in code unless product requirements change:

- matching algorithms and tie-break logic
- diff classification algorithms
- UI presentation behavior and CSS design system choices
- low-level technical configuration that is not business-governed
- static test fixtures and test helper code

## Recommended Data Model Direction

### Relational database domains

Use relational storage for:

- taxonomy definitions and versions
- classification tags and aliases
- semantic registry aliases and canonical fields
- tenant alias learning and approvals
- job state and processing events
- historical classification provenance
- policy metadata and governance workflows

### Graph domains

Use graph storage for:

- BOM structure
- parent-child relationships
- moved-context and re-parent analysis
- ancestry and impact-through-structure traversal

### Combined model

Use a combined model where:

- relational owns the business vocabulary
- graph owns the structure
- comparison results reference both through immutable version identifiers

## Phased Implementation Plan For The AI Agent

## Phase 0 - Guardrails and target-state contract

Objective:
Define the target externalization boundaries before moving data.

Deliverables:

- architecture decision record for relational vs graph boundaries
- target schema draft for taxonomy, aliases, semantic registry, and provenance
- API contract draft for frontend metadata endpoints

Agent tasks:

1. inventory all business vocabulary currently embedded in code
2. classify each item as `relational`, `graph`, or `keep in code`
3. produce migration-safe schema proposal
4. define version identifiers that must be persisted on comparisons

Exit criteria:

- approved data ownership map
- no ambiguous ownership left for taxonomy, aliases, or graph hierarchy

## Phase 1 - Taxonomy and alias reference data externalization

Objective:
Move taxonomy, property families, and semantic aliases into relational storage without changing user-visible behavior.

Deliverables:

- database schema and migrations
- seed scripts to import current markdown and code-based dictionaries
- backend services reading from DB-backed repositories

Agent tasks:

1. create relational tables for taxonomy versions and alias vocabularies
2. seed current runbook data and service constants into tables
3. preserve current service outputs through repository abstraction
4. add automated regression tests to prove no behavior drift for current seeded cases

Exit criteria:

- current taxonomy and alias behavior preserved
- production behavior no longer depends on hardcoded baseline taxonomy content

## Phase 2 - Metadata service and frontend de-duplication

Objective:
Make backend the source of truth for canonical fields and Admin business metadata.

Deliverables:

- metadata endpoints
- frontend migration from local constants to metadata fetches
- cache strategy for stable metadata

Agent tasks:

1. expose canonical field and classification-tag metadata from backend
2. update mapping preview UI to consume backend metadata
3. update Admin taxonomy UI to consume backend metadata
4. remove duplicate business vocabularies from frontend code

Exit criteria:

- frontend no longer owns canonical-field business definitions
- backend is the sole source of truth for governed vocabulary

## Phase 3 - Historical result locking and provenance

Objective:
Make every comparison reproducible against the exact classification context used when it ran.

Deliverables:

- versioned provenance columns on comparison records
- stored evidence payload for classification and semantic matches
- explicit reclassification workflow definition

Agent tasks:

1. persist taxonomy and alias version IDs on finalized comparisons
2. persist classification evidence payloads
3. update result reads to use locked provenance data
4. add tests proving old results remain unchanged after taxonomy edits

Exit criteria:

- historical comparisons remain stable after Admin changes
- reclassification, if desired, is an explicit separate operation

## Phase 4 - Durable async state

Objective:
Move upload and diff runtime state from process-local memory to durable infrastructure.

Deliverables:

- queue-backed dispatch
- DB-backed progress state
- restart-safe worker behavior

Agent tasks:

1. replace local queue assumptions with broker-backed jobs
2. persist phase, progress, attempts, and artifacts in DB
3. harden API status endpoints against worker restarts
4. add failure-recovery tests

Exit criteria:

- user-visible progress survives restart
- worker fleet can scale horizontally without state divergence

## Phase 5 - Graph-authoritative hierarchy reads

Objective:
Make graph the primary structural read model for BOM hierarchy traversal.

Deliverables:

- graph-backed tree APIs
- moved-context resolution over graph
- compatibility projections where old contracts remain

Agent tasks:

1. move tree traversal queries to `PartNode` and `ContainsEdge`
2. retain relational compatibility projections only where necessary
3. add deterministic graph traversal tests
4. validate moved classification against graph-backed parent-context reads

Exit criteria:

- hierarchy APIs and moved logic read from graph authoritatively
- compatibility layer remains stable for non-graph consumers

## Phase 6 - Tenant-governed vocabulary operations

Objective:
Operationalize governance so Product and tenant admins can manage aliases and taxonomy changes safely.

Deliverables:

- publish workflow for taxonomy changes
- alias approval lifecycle
- audit surfaces for vocabulary changes
- recommendation workflow for learned aliases

Agent tasks:

1. add draft, review, publish states for taxonomy changes
2. add alias recommendation and approval workflow
3. expose audit history and rollback references
4. enforce that live classification only uses published versions

Exit criteria:

- no production behavior changes from unreviewed vocabulary edits
- governance is auditable and explainable

## Verification Strategy

The AI agent should not mark phases complete without evidence in four areas:

1. schema and migration verification
2. automated regression coverage for seeded behavior
3. historical result stability tests
4. frontend/backend contract verification for metadata consumers

Recommended minimum automated test themes:

- positive taxonomy trigger matches
- negative alias matches to prevent false positives
- locked historical results after taxonomy change
- worker restart recovery for job progress
- deterministic graph traversal and moved classification

## Recommended Delivery Order

Implement in this order:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6

Reason:

- Phase 1 and Phase 2 remove duplicate data ownership first
- Phase 3 protects historical correctness
- Phase 4 hardens operations
- Phase 5 completes the graph intent once reference-data governance is stable
- Phase 6 adds controlled admin operations on top of the new data model

## Bottom Line

The most important architectural improvement is not to move more logic into graph. It is to move governed business data and durable runtime state out of code and into the correct persistent model.

Recommended end state:

- relational database owns business vocabularies, versions, aliases, policies, provenance, and job state
- Azure SQL Graph owns structure traversal and hierarchy semantics
- frontend consumes backend-owned metadata instead of duplicating business concepts

That end state still meets the original architecture goals. It implements them more faithfully.
