# Backlog S15: Change Intelligence and Tenant Taxonomy

## 1. Objective
- Preserve all BOM fields during intake and diffing.
- Keep current row matching logic unchanged for now.
- Compare all preserved fields for matched, moved, and replaced rows.
- Classify detected changes against the industry taxonomy in [docs/runbooks/bom_change_taxonomy_by_industry.md](c:\Users\yetro\Evolve%20Global%20Solutions\BOM%20Compare%20-%20Documents\Code-BOMComparevX\BOMComparevX\docs\runbooks\bom_change_taxonomy_by_industry.md).
- Allow each tenant to select a default industry and fully fork the taxonomy in a simple admin UX.
- Surface impact criticality and taxonomy details in results and in a dedicated Excel sheet named `Change Impact Classification`.

## 2. Locked decisions
- Upload parser keeps all source BOM fields.
- Matching logic remains based on the current canonical keys and tie-breakers.
- Change detection compares all fields, with typed normalization where appropriate.
- Fuzzy property-name taxonomy matching is auto-accepted above a high threshold for now.
- Tenant uses one default industry for all comparisons.
- Tenant taxonomy is a full fork of the seeded platform taxonomy.
- Blank, null, and missing values are treated as equivalent.
- Reviewer roles remain editable tenant text values.
- Compliance triggers remain as seeded from the source taxonomy document.
- Impact criticality colors are platform-defined.
- Export adds one taxonomy sheet per comparison, named `Change Impact Classification`.
- Taxonomy classification applies to matched-row property changes, moved rows, and replaced rows.

## 3. Architecture

### 3.1 Core model
- `Row matching layer`
  - Uses the existing stable occurrence keys, internal ids, part/revision matching, fuzzy description fallback, and structural tie-breakers.
- `All-fields diff layer`
  - Preserves every uploaded header/value pair in a raw property bag.
  - Produces normalized property bags for comparison.
  - Detects changed properties on matched rows by comparing the union of source and target property names.
- `Change intelligence layer`
  - Maps changed property names to taxonomy trigger properties using exact match first and fuzzy match second.
  - Returns all matching categories for a row.
  - Deduplicates internal and external roles across categories.
  - Computes rollups:
    - highest impact class
    - highest impact criticality
    - combined compliance trigger set
    - primary category order for UI

### 3.2 Persistence strategy
- Use SQL for:
  - tenant default industry
  - tenant taxonomy fork
  - taxonomy property alias governance
  - future audit/versioning
- Keep graph usage limited to BOM relationship intelligence and future impact-propagation scenarios.

### 3.3 Matching versus comparison
- Matching remains intentionally smaller and controlled.
- Comparison becomes exhaustive across all preserved properties.
- Classification determines significance after the exhaustive comparison, not before it.

## 4. Data model changes

### 4.1 Diff row preservation
- Extend diff comparable rows to preserve:
  - `properties`
    - raw source values keyed by original header
  - `normalizedProperties`
    - normalized comparison-ready values keyed by original header
- Persist these in uploaded revision row JSON and in diff result snapshots.

### 4.2 Taxonomy persistence
- Add tenant taxonomy configuration storage:
  - `TenantIndustrySetting`
    - `tenantId`
    - `defaultIndustry`
    - `updatedAtUtc`
    - `updatedBy`
  - `TenantBomTaxonomy`
    - `tenantId`
    - `industry`
    - `taxonomyJson`
    - `sourceVersion`
    - `updatedAtUtc`
    - `updatedBy`
  - `TenantBomTaxonomyPropertyAlias`
    - `tenantId`
    - `industry`
    - `normalizedSourceProperty`
    - `normalizedTaxonomyProperty`
    - `matchMode`
    - `confidence`
    - `isEnabled`
    - `updatedAtUtc`
    - `updatedBy`

### 4.3 Diff result schema
- Extend persisted diff rows with:
  - `propertyChanges`
  - `impactClassification`
    - `categories`
    - `highestImpactClass`
    - `impactCriticality`
    - `internalApprovingRoles`
    - `externalApprovingRoles`
    - `complianceTriggers`
    - `controlPaths`
    - `propertyMatches`
    - `classificationConfidence`

## 5. Comparison and classification rules

### 5.1 Value normalization
- Compare values using type-aware normalization:
  - strings: trim, collapse whitespace, case-normalize where appropriate
  - blank, null, missing: equivalent
  - numeric: decimal normalization
  - dates/effectivity: ISO-like normalization when parseable
  - list fields: tokenized comparison when clearly list-shaped
  - dimensions: parse numeric tuples such as `X x Y x Z`
- Phase 1 typed comparators:
  - text
  - number
  - boolean/flag
  - date/effectivity
  - dimension tuple

### 5.2 Property-to-taxonomy mapping
- Exact matching:
  - normalized changed property name equals normalized taxonomy trigger property
- Fuzzy matching:
  - similarity score with token-aware normalization
  - auto-accept only above a high threshold
  - record match source as `exact` or `fuzzy`
- Tenant property aliases override platform fuzzy behavior when present.

### 5.3 Category rollup
- A row may map to multiple categories.
- UI shows all categories.
- Approving roles are deduplicated across categories.

## 6. API changes

### 6.1 Backend
- Extend diff status/rows/export payloads with `impactClassification`.
- Add mapping governance endpoints for taxonomy:
  - `GET /api/admin/mapping-governance/taxonomy`
  - `POST /api/admin/mapping-governance/taxonomy/default-industry`
  - `POST /api/admin/mapping-governance/taxonomy/reset`
  - `POST /api/admin/mapping-governance/taxonomy/category`
  - `POST /api/admin/mapping-governance/taxonomy/category/delete`
  - `POST /api/admin/mapping-governance/taxonomy/alias`
  - `POST /api/admin/mapping-governance/taxonomy/alias/delete`

### 6.2 Frontend proxy routes
- Mirror the new backend admin taxonomy endpoints under `apps/frontend/app/api/admin/mapping-governance/...`.

## 7. UI changes

### 7.1 Results grid
- Add `Impact Criticality` badge column with fixed color coding:
  - `High`
  - `Medium`
  - `Low`
- Add detail action to open a modal showing:
  - all categories
  - change description
  - internal approving roles
  - external approving roles
  - compliance trigger
  - matched changed properties

### 7.2 Admin mapping governance
- Add tenant default industry selector under mapping governance.
- Add friendly taxonomy editor:
  - inline auto-save
  - editable category cards
  - token-style role editing with simple removal
  - property trigger list editing
  - no explicit save button
- Defer drag-and-drop ordering until the foundational fork/edit flow is stable.

### 7.3 Export
- Add Excel sheet `Change Impact Classification`.
- Each row represents a diff row classification summary with:
  - comparison id
  - row id
  - change type
  - changed properties
  - categories
  - impact class
  - impact criticality
  - internal roles
  - external roles
  - compliance trigger
  - control path

## 8. Rollout order

### Phase 1
- Preserve all BOM fields.
- Compare all fields.
- Add taxonomy engine seeded from the runbook.
- Add tenant default industry.
- Add results impact criticality and detail modal.
- Add export taxonomy sheet.

### Phase 2
- Add tenant taxonomy fork editor in admin mapping governance.
- Add taxonomy property alias governance.
- Add richer UI affordances for role chips and property editing.

### Phase 3
- Add advanced governance:
  - version history
  - compare tenant taxonomy to platform baseline
  - drag-and-drop ordering
  - approval workflow for fuzzy matches

### Phase 4
- Execute QA hardening:
  - validate user stories against real workflows
  - add automated regression coverage
  - run focused exploratory QA on results, admin taxonomy editing, and export
  - amend defects and related issue records before closeout

## 9. Implementation tasks

### Backend foundation
- Preserve raw and normalized property bags from uploads.
- Extend diff contracts and normalization utilities.
- Add all-fields property comparison.
- Add taxonomy parser/service seeded from the markdown runbook.
- Add tenant taxonomy persistence service with database and in-memory fallback.
- Add row impact classification service.

### Backend integration
- Invoke classification during diff computation for matched, moved, and replaced rows.
- Persist classification to diff snapshots.
- Add admin taxonomy endpoints.
- Extend export sheet generation.

### Frontend integration
- Extend result row types and table rendering.
- Add impact badge and detail modal.
- Add admin taxonomy governance panel and default industry selector.
- Add frontend API routes for taxonomy governance.

### QA and remediation
- Define user stories and acceptance criteria before implementation closeout.
- Write backend tests for:
  - all-field preservation from upload
  - exact and fuzzy taxonomy property matching
  - tenant default industry selection
  - matched, moved, and replaced row classification
  - export sheet generation for `Change Impact Classification`
- Write frontend tests for:
  - impact criticality rendering
  - category detail modal
  - tenant default industry editor
  - tenant taxonomy editor interactions
- Run regression checks on upload, diff, results, mapping, admin, and exports.
- Perform QA review as if this were a production-grade BOM comparison and change-management feature set.
- Amend implementation and issue records for every meaningful defect discovered during QA.

## 10. User stories and acceptance criteria

### US-1: Preserve every source BOM property
- As a user, when I upload BOM files, every source column should be retained by the system even if it is not part of the current matching model.
- Acceptance:
  - uploaded revision rows retain all headers and values
  - blank, null, and missing are normalized equivalently
  - unknown/custom source columns survive through diff computation

### US-2: Detect change on any preserved property
- As a user, if any preserved matched-row property changes, I should see that property listed in the diff.
- Acceptance:
  - changed property list is built from all preserved fields
  - unchanged formatting-only noise is reduced through typed normalization

### US-3: Classify changed rows by tenant industry taxonomy
- As a user, when a property changes, I should see all applicable taxonomy categories for my tenant's default industry.
- Acceptance:
  - exact property matches win over fuzzy matches
  - high-confidence fuzzy matches auto-accept for now
  - approving roles are deduplicated across categories

### US-4: Admin can control tenant taxonomy
- As a tenant admin, I can set one default industry and fork/edit my taxonomy in a simple inline workflow.
- Acceptance:
  - default industry persists per tenant
  - taxonomy edits auto-save
  - roles are editable and removable without save buttons

### US-5: Results surface impact clearly
- As a reviewer, I can see impact criticality directly in the grid and inspect full change-impact details in a modal.
- Acceptance:
  - impact criticality uses fixed platform colors
  - modal shows categories, change description, internal roles, external roles, and compliance trigger

### US-6: Export includes change-impact audit view
- As a reviewer, when I export the comparison to Excel, I receive a separate `Change Impact Classification` sheet with the row classification summary.
- Acceptance:
  - sheet exists for each comparison export
  - sheet includes category and impact metadata for classified rows

## 11. Risks and mitigations
- `Noise from all-fields compare`
  - mitigate with typed normalization and taxonomy-driven significance.
- `Fuzzy property-name false positives`
  - mitigate with high threshold, match provenance, and future approval workflow.
- `Tenant taxonomy drift`
  - mitigate with reset-to-baseline and future version diff tooling.
- `Wide-row performance`
  - mitigate by preserving property bags once at upload time and classifying only changed rows.

## 12. Deferred follow-up items
- Revisit automatic fuzzy taxonomy property acceptance and replace with governed approval workflow.
- Revisit tenant ability to override compliance trigger text and standards.
