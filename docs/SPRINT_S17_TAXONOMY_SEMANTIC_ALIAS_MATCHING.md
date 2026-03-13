# Sprint S17 - Taxonomy Semantic Alias Matching

## 1. Sprint metadata
- Sprint: `S17`
- Theme: `Taxonomy Semantic Alias Matching`
- Scope type: `Backend classification hardening with execution-ready sprint record`
- Owner: `Product + Engineering`
- Status: `Completed`

## 2. Sprint goal
Make taxonomy impact classification resolve semantically equivalent property names and classification tags through canonical meaning, so equivalent labels such as `MEVS Current Revision` and `Component Revision` trigger the same taxonomy category.

## 3. Locked decisions
- Keep exact raw-label matches as the highest-precedence path.
- Add semantic canonical matching before raw fuzzy fallback.
- Use seeded alias packs for `General discrete manufacturing` and `Automotive`.
- Require both positive and negative automated tests for multiple aliases.
- Do not mark this sprint completed unless automated evidence gives greater than 90% implementation confidence.
- Preserve current taxonomy-editor UI and data shape for trigger-property labels in this sprint.
- Treat broader tenant-governed alias administration as follow-on work unless the current backend path can support it without new UI/storage.

## 4. Source evidence used

Code evidence reviewed:
- `apps/backend/src/mapping/bom-change-taxonomy.service.ts`
- `apps/backend/src/mapping/semantic-registry.service.ts`
- `apps/backend/src/diff/diff-computation.service.ts`
- `apps/backend/src/diff/classification.service.ts`
- `apps/backend/src/mapping/mapping-persistence.service.ts`
- `apps/backend/test/change-intelligence.e2e-spec.ts`

Reference content reviewed:
- `docs/runbooks/bom_change_taxonomy_by_industry.md`
- `docs/ISSUE_TRACKER.md`

## 5. Execution stories

### S17-01 - Canonical semantic matching for taxonomy triggers
As the taxonomy classifier, I need changed property names and taxonomy trigger properties to resolve through shared canonical meaning so that semantically equivalent labels classify to the same impact category.

Status:
- `Completed`

### S17-02 - Seed alias packs for Generic and Automotive tag vocabulary
As engineering, we need seeded alias coverage for common Generic and Automotive classification-tag terminology so that frequent business synonyms trigger without relying on brittle raw-string similarity alone.

Status:
- `Completed`

### S17-03 - Negative guards against false semantic triggers
As engineering, we need negative alias tests so that unrelated fields do not accidentally trigger taxonomy categories when semantic matching is introduced.

Status:
- `Completed`

### S17-04 - Confidence-gated verification
As the delivery team, we need explicit verification evidence that exceeds a 90% certainty threshold before this sprint is marked complete.

Status:
- `Completed`

## 6. Acceptance bar
- `MEVS Current Revision` and similar revision aliases must trigger categories tagged with `Component Revision` or equivalent revision tags.
- `MEVS Part Number` and similar part-number aliases must trigger categories tagged with `Component PN` or equivalent part-number tags.
- Generic and Automotive seeded aliases must each have positive automated test coverage.
- Unrelated fields must have negative automated test coverage and remain unclassified.
- Backend verification must pass before sprint status is changed from `Backlog`.
- Completion must explicitly state why the implementation confidence is above 90%.

## 7. Source issue
- `ISSUE-013` in `docs/ISSUE_TRACKER.md`

## 8. Verification
- `npm --prefix apps/backend run typecheck`
- `npm --prefix apps/backend run build`
- `npm --prefix apps/backend run test -- change-intelligence.e2e-spec.ts`

## 9. Residual notes
- Historical results remaining tied to live taxonomy edits is tracked separately in `ISSUE-012`.
- Broader tenant-admin alias authoring may still require dedicated governance UI/storage after this sprint.

## 10. Confidence gate
- Completion confidence: `>90%`
- Basis:
  - targeted backend typecheck passed
  - backend build passed
  - automated positive alias tests passed for both `General discrete manufacturing` and `Automotive`
  - automated negative alias tests passed for both `General discrete manufacturing` and `Automotive`
  - existing exact/fuzzy seeded-runbook taxonomy behavior remained covered by the pre-existing regression test
