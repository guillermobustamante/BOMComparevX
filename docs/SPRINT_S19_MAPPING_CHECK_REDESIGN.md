# Sprint S19 - Mapping Check Redesign

## 1. Sprint metadata
- Sprint: `S19`
- Theme: `Mapping Check Redesign`
- Scope type: `Execution-ready sprint record`
- Owner: `Product + Engineering`
- Status: `Completed`

## 2. Sprint goal
Redesign `Mapping Check` as a business-friendly `Field Understanding Workspace` that helps purchasing, sales, managers, and engineering reviewers understand whether a BOM is safe to compare, which columns matter most, what improves impact classification, and what action should be taken next.

## 3. Locked decisions
- Use `Option 1 - Field Understanding Workspace`; do not spend this sprint on a minor table refresh or a dual-mode persona split.
- Keep one shared backend mapping-detection engine and one shared semantic/taxonomy layer; enrich them rather than replacing them.
- Introduce a richer `MappingPreviewV2Contract` and presenter layer while preserving the current preview path until the new UI is ready to cut over.
- Show all source columns somewhere in the experience, grouped by importance rather than treated as one flat table.
- Use business-readable labels, sample values, consequence language, and `Why this matters` guidance in the primary UI.
- Keep expert explainability and evidence behind progressive disclosure instead of making it the default view.
- Treat partial impact coverage as a warning, not a hard block, when comparison-critical fields are safely understood.
- Allow broad review of comparison-critical mappings, but keep durable tenant-learning and governance promotion restricted to admin/governance roles.
- Generate learned-alias suggestions from approved overrides only as suggestions in this sprint; do not auto-promote them to shared tenant behavior.
- Do not mark the sprint complete without both automated regression coverage and role-based QA for business and expert reviewers.

## 4. Source evidence used

Code evidence reviewed:
- `apps/frontend/components/mapping-preview-editor.tsx`
- `apps/backend/src/mapping/mapping-contract.ts`
- `apps/backend/src/mapping/mapping-preview.service.ts`
- `apps/backend/src/mapping/mapping-field-policy.service.ts`
- `apps/backend/src/mapping/semantic-registry.service.ts`
- `apps/backend/src/mapping/bom-change-taxonomy.service.ts`
- `apps/backend/test/stage1.e2e-spec.ts`
- `tests/e2e/auth-shell.spec.ts`

Planning evidence reviewed:
- `BACKLOG_S19_MAPPING_CHECK_REDESIGN.md`
- `docs/ISSUE_TRACKER.md`

## 5. Execution stories

### S19-01 - Mapping preview v2 contract and presenter layer
As the Mapping Check workspace, I need a richer preview contract and UI-facing presenter so that the frontend can explain BOM understanding in business terms without coupling directly to raw detection internals.

Status:
- `Completed`

### S19-02 - Business-readable field understanding metadata
As a reviewer, I want each source column to include business labels, sample values, field roles, consequence level, and plain-language guidance so that I can understand why the system cares about that field.

Status:
- `Completed`

### S19-03 - Taxonomy and impact-readiness enrichment
As a reviewer deciding whether the BOM is fully understood, I want semantic-family and taxonomy-readiness signals surfaced in the preview so that impact classification strength is visible before comparison proceeds.

Status:
- `Completed`

### S19-04 - Summary-first Field Understanding Workspace UI
As a business-facing user, I want Mapping Check to open as a summary-first grouped workspace instead of a raw mapping table so that I can understand the BOM without engineering jargon.

Status:
- `Completed`

### S19-05 - Progressive disclosure and safer proceed states
As an expert reviewer, I want evidence, low-confidence diagnostics, and proceed risk states to remain available but secondary so that detail is accessible without overwhelming business users.

Status:
- `Completed`

### S19-06 - Confirmation intent and alias-learning suggestion capture
As governance-aware product logic, I need confirmation to capture whether the reviewer accepted suggestions, acknowledged partial impact coverage, and proposed learned aliases so that future tenant learning can be controlled cleanly.

Status:
- `Completed`

### S19-07 - Regression coverage and persona QA
As the delivery team, we need automated regression checks and role-based walkthroughs for purchasing, sales, managers, and engineering reviewers so that the redesign improves usability without degrading comparison safety.

Status:
- `Completed`

## 6. Acceptance bar
- The redesigned Mapping Check experience must clearly answer:
  - can this BOM be compared safely
  - which columns matter most to comparison accuracy
  - which columns improve impact classification and governance
  - what the user should do next
- All source columns must be visible somewhere in the experience.
- The UI must visibly separate `required to compare`, `recommended for better matching`, `useful for impact classification`, and `preserved but not yet understood`.
- Comparison-critical low-confidence mappings must be impossible to miss.
- Each surfaced column must include sample values and plain-language explanation of why it matters.
- Taxonomy relevance and impact-readiness state must be visible for applicable columns.
- Safe comparison must remain possible even when impact coverage is partial, with explicit warning language.
- Expert evidence and explainability must remain available through progressive disclosure.
- Confirmation payloads must support reviewer intent and learned-alias suggestion capture without auto-promoting tenant behavior.
- The current comparison-safe backend behavior must remain backward-compatible during transition.

## 7. Source issue
- `ISSUE-027` in `docs/ISSUE_TRACKER.md`

## 8. Recommended sequencing
1. Define the preview v2 contract and presenter layer first.
2. Add business-readable labels, consequence metadata, and taxonomy-readiness enrichment.
3. Build the summary-first frontend workspace on top of the new contract.
4. Extend confirmation payloads for review intent and alias-learning suggestions.
5. Close with regression coverage and persona-based QA.

## 9. Verification
- `npm --prefix apps/backend run typecheck`
- `npm --prefix apps/backend run build`
- `npm --prefix apps/backend run test`
- `npm --prefix apps/frontend run typecheck`
- `npm --prefix apps/frontend run build`
- focused frontend e2e coverage for the Mapping Check workflow
- role walkthroughs for purchasing, sales/account review, manager readiness review, and engineering/admin review

## 10. Residual notes
- Completion note:
  - Implemented and validated in repo, including backend/frontend typecheck and build plus focused mapping workflow regression coverage.
- Follow-on analytics for unresolved fields, overrides, and alias candidates remain a separate future stage after this redesign lands.
- Tenant-governed alias approval workflows may still warrant a dedicated governance sprint after S19.
