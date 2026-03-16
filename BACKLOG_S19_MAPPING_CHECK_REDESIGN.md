# Backlog S19 - Mapping Check Redesign

## Goal

Redesign the `Mapping Check` experience so it is understandable and useful for purchasing, sales, non-engineering users, managers, and engineering reviewers without weakening the comparison engine or taxonomy/governance model.

The redesigned screen should answer four questions clearly:

* Can this BOM be compared safely?
* Which columns matter most to comparison accuracy?
* Which columns improve impact classification and governance?
* What should the user do next, in plain business language?

## Current problem

The current `Mapping Check` screen is still optimized for a first-generation comparison engine:

* it is presented as a technical mapping table
* it foregrounds internal canonical fields instead of business meaning
* it visually emphasizes only a narrow set of comparison-critical fields
* it does not explain why many preserved columns are not shown as first-class mapping targets
* it does not expose taxonomy and impact-classification readiness clearly

This creates a mismatch with the current platform direction:

* the upload/diff pipeline now preserves all BOM columns
* the taxonomy engine now classifies many more changed properties
* the business value is no longer only “map enough to compare”
* the real value is “teach the system how to understand this BOM”

## Architecture decision

Recommended architecture:

* Keep one shared backend mapping-detection engine and one shared semantic/taxonomy layer.
* Redesign the frontend as a `Field Understanding Workspace`, not a raw mapping table.
* Keep the current canonical mapping model for comparison-critical logic.
* Add a second contract layer for semantic understanding, taxonomy readiness, and business-facing explanations.
* Show all source columns, but group and rank them by importance rather than treating every field equally.

Why this is the correct boundary:

* comparison-critical mapping and taxonomy understanding are related, but not the same thing
* overloading the canonical-field model with every taxonomy or business meaning would make the mapping contract brittle
* non-engineering users need progressive disclosure, not more engineering detail
* the existing backend mapping engine remains useful and should be enriched, not replaced

## Options

### Option 1 - Recommended: Field Understanding Workspace

Summary:

* Replace the current table-first UI with a guided workspace that groups every source column into business-readable buckets.
* Keep expert details available, but secondary.

Why this ranks first:

* best balance of usability, adoption, architecture fit, and future-proofing
* works for purchasing, sales, managers, and engineering reviewers
* creates a clean bridge to `Change Taxonomy & Impacts`
* does not require a risky rewrite of the detection engine

UX model:

* top summary cards:
  * `Comparison readiness`
  * `Impact classification readiness`
  * `Unresolved items`
  * `Low-confidence decisions`
* grouped column sections:
  * `Required to compare`
  * `Recommended for better matching`
  * `Useful for impact classification`
  * `Preserved but not yet understood`
* each source column row shows:
  * source column name
  * sample values
  * recommended business label
  * why it matters
  * what the system will use it for
  * confidence
  * suggested mapping
  * taxonomy relevance, if any
* expert evidence and explainability remain available behind inline expanders or a side panel

Tradeoff:

* more frontend work than a simple table refresh

### Option 2 - Fastest: Upgrade the current mapping table

Summary:

* Keep the current table layout, but add clearer labels, grouped filters, sample values, and taxonomy badges.

Why this ranks second:

* faster delivery
* lower engineering cost
* least backend change

Limitations:

* still reads like an engineering/admin tool
* weaker fit for purchasing, sales, and managers
* does not create a strong conceptual step up from the current screen

### Option 3 - Highest ambition: Persona-based dual mode

Summary:

* offer `Simple mode` for business users and `Expert mode` for data stewards/engineering users

Why this ranks third:

* strongest role-fit if done well
* attractive long-term pattern for large tenants

Limitations:

* most complexity
* larger testing surface
* higher risk of duplicated logic and UX drift
* not the fastest path to a materially better screen

## Recommended direction

Use `Option 1 - Field Understanding Workspace`.

This is the best fit for the system being built:

* it makes the screen understandable to non-engineering roles
* it supports the system’s newer taxonomy and governance goals
* it avoids creating multiple competing mapping experiences
* it preserves the current backend investment and adds a cleaner contract on top

## UX changes

### Primary experience

1. Replace the current technical table-first layout with a summary-first workspace.

2. Use business-readable labels instead of raw internal terms wherever possible.

3. Show all source columns, but rank them using visible sections:
   * `Required to compare`
   * `Recommended for better matching`
   * `Useful for change impact classification`
   * `Preserved but not yet understood`

4. Add role badges per column:
   * `Row identity`
   * `Comparison`
   * `Occurrence identity`
   * `Classification trigger`
   * `Business / compliance`
   * `Display only`

5. Add a `Why this matters` explanation for each column in plain language.

Examples:

* `Used to tell the same part apart when it appears multiple times`
* `Improves impact classification for design and compliance changes`
* `Preserved for export and history, but not required for comparison`

6. Show sample values directly in the mapping row/card so users can identify fields from data, not header text only.

7. Replace the raw confirm CTA with a clearer business action:
   * `Use these mappings`
   * supporting status text:
     * `Safe to compare`
     * `Comparison works, but impact classification is partial`
     * `High risk of comparison mistakes`

### Progressive disclosure

8. Keep explainability and scoring details, but move them behind:
   * inline `Why suggested?`
   * drawer or right-side detail panel
   * advanced-only evidence blocks

9. Keep low-confidence warnings, but express them in consequence language:
   * `Low confidence and comparison-critical`
   * `Low confidence but impact-only`
   * `Preserved only; safe to leave unresolved`

### Taxonomy integration

10. Surface semantic family and taxonomy relevance directly in the mapping experience.

Examples:

* `Volume_mm3`
  * family: `volume`
  * classification tag: `Volume`
  * likely impact categories: `Product design or form-fit-function change`

11. Add an `Impact readiness` summary block:
   * how many trigger-capable columns were recognized
   * how many changed-property families remain semantically unknown
   * whether taxonomy classification coverage is strong, partial, or weak

### Accessibility and business-user fit

12. Reduce engineering jargon in primary UI copy.

13. Prefer short guidance text over raw diagnostic density.

14. Support managers with a compact high-level view that can be understood without inspecting every field.

## Data contract changes

Recommended contract evolution:

### Mapping preview contract v2

Add a richer preview response that keeps the current detection data but adds business-facing structure.

New top-level sections:

* `summary`
* `groups`
* `columns`
* `recommendedActions`
* `impactReadiness`

Suggested structure:

```ts
interface MappingPreviewV2Contract {
  contractVersion: string;
  revisionId: string;
  summary: {
    comparisonReadiness: 'ready' | 'warning' | 'blocked';
    impactReadiness: 'strong' | 'partial' | 'weak';
    unresolvedCount: number;
    lowConfidenceCriticalCount: number;
    canProceed: boolean;
    proceedLabel: string;
  };
  groups: Array<{
    id:
      | 'required_compare'
      | 'recommended_matching'
      | 'impact_classification'
      | 'preserved_unclassified';
    label: string;
    description: string;
    counts: {
      total: number;
      unresolved: number;
      lowConfidence: number;
    };
  }>;
  columns: Array<{
    sourceColumn: string;
    displayLabel: string;
    sampleValues: string[];
    canonicalField: string | null;
    canonicalFieldLabel: string | null;
    suggestedBusinessMeaning: string | null;
    fieldRoles: string[];
    groupId:
      | 'required_compare'
      | 'recommended_matching'
      | 'impact_classification'
      | 'preserved_unclassified';
    strategy: string;
    confidence: number;
    reviewState: string;
    consequenceLevel: 'critical' | 'important' | 'helpful' | 'informational';
    whyItMatters: string;
    proceedImpact: string;
    semanticFamily?: string | null;
    classificationTags?: string[];
    likelyCategories?: string[];
    evidence?: {
      reasons?: string[];
      negativeSignals?: string[];
      matchedAlias?: string;
      domain?: string;
      profile?: string;
    };
  }>;
  impactReadiness: {
    recognizedTriggerColumns: number;
    semanticallyUnclassifiedColumns: string[];
    likelyCoverageNotes: string[];
  };
  recommendedActions: string[];
}
```

### Confirmation contract changes

Extend confirmation to capture decision intent and learning signals:

* who confirmed
* whether they accepted system suggestions unchanged
* whether any overrides should be proposed as tenant-learned aliases
* whether the confirmation is comparison-safe but impact-partial

Suggested additions:

* `confirmationMode`
* `acceptedAsSuggested`
* `impactCoverageAcknowledged`
* `learnedAliasSuggestions`

### Backend service changes

Required service additions:

1. Extend mapping preview enrichment with:
   * sample value extraction
   * grouped column classification
   * business-readable labels
   * consequence scoring
   * taxonomy readiness metadata

2. Add a label/role registry layer for user-facing descriptions of canonical fields.

3. Add a mapping consequence policy service:
   * determine whether a field is comparison-critical, matching-helpful, taxonomy-helpful, or informational

4. Add a preview presenter/adapter:
   * keep detection logic separate from UI-specific response shaping

## Rollout phases

### Phase 1 - Contract and backend enrichment

Goal:

* produce a richer preview contract without changing the core detection engine

Tasks:

* define `MappingPreviewV2Contract`
* add business labels and field-role metadata
* add grouped section logic
* add consequence scoring
* add taxonomy-readiness enrichment
* preserve backward compatibility for the current frontend until the new UI is ready

### Phase 2 - New Mapping Check UX

Goal:

* replace the current table-first editor with the Field Understanding Workspace

Tasks:

* summary cards and grouped sections
* business-readable mapping rows/cards
* sample values and why-it-matters copy
* progressive disclosure for evidence
* clearer confirm/proceed workflow

### Phase 3 - Tenant learning and governance integration

Goal:

* make the screen reduce future work instead of repeating it

Tasks:

* suggest tenant alias learning from approved overrides
* surface taxonomy-impact relevance inline
* add impact-readiness health summary
* connect unresolved semantic fields to admin governance workflows

### Phase 4 - Governance hardening

Goal:

* make the workflow more auditable and role-aware

Tasks:

* approval restrictions by role if needed
* stronger audit trail for overrides
* optional workflow for learning alias approval
* taxonomy-version visibility and future reclassification readiness

## Implementation tasks

1. Define the `MappingPreviewV2Contract`
   Status: `Pending`

2. Add a backend presenter layer that shapes preview data for business-first UX
   Status: `Pending`

3. Add field-role, consequence, and business-label metadata for canonical fields
   Status: `Pending`

4. Add taxonomy-readiness enrichment to mapping preview responses
   Status: `Pending`

5. Preserve backward compatibility for the current preview endpoint during transition
   Status: `Pending`

6. Design and implement the new summary-first Mapping Check frontend
   Status: `Pending`

7. Add progressive disclosure for explainability diagnostics
   Status: `Pending`

8. Add sample-value rendering and recommendation copy
   Status: `Pending`

9. Add safer proceed states and business-readable status messaging
   Status: `Pending`

10. Add tenant alias-learning suggestion flow for approved overrides
   Status: `Pending`

11. Add regression tests for business-user flows and expert-review flows
   Status: `Pending`

12. Run a role-based QA pass for purchasing, sales, manager, and engineering reviewer use cases
   Status: `Pending`

## QA

Required checks for this stage:

* `npm --prefix apps/backend run typecheck`
* `npm --prefix apps/backend run build`
* `npm --prefix apps/backend run test`
* `npm --prefix apps/frontend run typecheck`
* `npm --prefix apps/frontend run build`

Recommended additional checks:

* focused frontend e2e coverage for the Mapping Check workflow
* story-level walkthroughs for:
  * purchasing reviewer
  * sales / account reviewer
  * manager approving readiness
  * engineering/admin reviewer resolving low-confidence mappings

QA focus:

* all source columns are visible somewhere in the experience
* comparison-critical fields are clearly distinguished from optional fields
* business users can understand why a column matters without reading engineering jargon
* taxonomy-trigger relevance is visible for suitable fields
* low-confidence comparison-critical mappings are impossible to miss
* partial impact-readiness states are explained without blocking safe comparison unnecessarily
* overrides do not silently degrade core comparison behavior

## Risks

Primary risks:

* the screen can become too dense if all columns are shown without strong grouping
* adding taxonomy information can make the workflow feel too technical again
* alias-learning automation can create governance noise if it is too aggressive

Mitigation:

* use summary-first layout and grouped sections
* keep advanced evidence behind progressive disclosure
* separate `comparison-critical` from `impact-helpful`
* treat learned aliases as suggestions first unless governance explicitly allows auto-promotion

## Open decisions

These are important, but not blocking backlog creation:

1. Who is allowed to confirm comparison-critical mappings?
   Recommendation:
   * allow broad review
   * restrict durable tenant-learning and policy changes to admin/governance roles

2. Should partial impact coverage block comparison?
   Recommendation:
   * no
   * allow comparison when comparison-critical fields are safe
   * warn clearly when impact classification coverage is partial

3. Should approved overrides automatically create tenant-learned aliases?
   Recommendation:
   * create suggestions automatically
   * require governance acceptance before promoting them to shared tenant behavior

## Follow-up recommendation

After this redesign stage, the next logical follow-up is a `Mapping Governance Analytics` stage:

* track the most frequently unresolved fields
* track the most overridden suggestions
* track the most valuable new tenant alias candidates
* connect these patterns back into taxonomy-property-family and mapping-semantic governance
