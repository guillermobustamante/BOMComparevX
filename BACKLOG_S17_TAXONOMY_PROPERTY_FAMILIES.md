# Backlog S17 - Taxonomy Property Family Resolution

## Goal

Make taxonomy impact classification robust for engineering and industry-specific property aliases so changed fields like `Volume_mm3` classify against tenant tags like `Volume` without manual user intervention.

## Architecture decision

Implemented architecture:

* Added a dedicated taxonomy semantic layer in [taxonomy-property-family.service.ts](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/apps/backend/src/mapping/taxonomy-property-family.service.ts)
* Kept it separate from upload-column canonical mapping in [mapping-contract.ts](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/apps/backend/src/mapping/mapping-contract.ts)

Why this is the correct boundary:

* upload mapping canonical fields are ingestion-oriented and relatively stable
* taxonomy property families are classification-oriented and much broader
* overloading the upload mapping model would create unnecessary UI, persistence, and governance complexity

## Scope

Implemented:

* deterministic canonical-family resolution before fuzzy taxonomy matching
* unit-aware normalization for engineering properties
* runbook-to-service parity for the canonical family baseline in [canonical_engineering_property_families.md](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/docs/runbooks/canonical_engineering_property_families.md)
* broad alias coverage across:
  * general discrete manufacturing
  * automotive
  * electronics
  * aerospace
  * defense / government contracting
  * construction / built environment
  * medical-device and service-parts vocabulary families
* regression tests for engineering-field family matching and public-source BOM vocabularies

Deferred:

* tenant-governed family overrides
* telemetry-driven unmatched-property learning loop
* dedicated `Medical devices` industry taxonomy section

## Tasks

1. Add a dedicated taxonomy property-family resolver
   Status: `Completed`

2. Insert family matching into taxonomy classification ahead of fuzzy matching
   Status: `Completed`

3. Add unit-aware normalization for geometry and physical-property fields
   Status: `Completed`

4. Expand alias coverage for major trigger-property families
   Status: `Completed`

5. Encode the canonical family runbook baseline into the resolver
   Status: `Completed`

6. Add regression tests for engineering measurement fields, public-source vocabularies, and negative guards
   Status: `Completed`

7. Document the family model and research basis
   Status: `Completed`

8. Add follow-up record for missing medical-devices taxonomy section
   Status: `Completed`

## QA

Required checks for this stage:

* `npm --prefix apps/backend run typecheck`
* `npm --prefix apps/backend run build`
* `npm --prefix apps/backend run test -- change-intelligence.e2e-spec.ts`

QA focus:

* `Volume_mm3 -> Volume`
* `Area_mm2 -> Area`
* `BoundingBox_mm -> Bounding Box`
* `CenterOfMass -> Center of Mass`
* public shared electronics BOM vocabulary
* public PLM / ERP BOM vocabulary
* public aerospace parts-list vocabulary
* public defense / government-contracting vocabulary
* public medical-device and spare-parts vocabulary
* negative guard so unrelated fields do not opportunistically match

## Risks

Primary risk:

* overly broad aliases can inflate false positives in taxonomy classification

Mitigation:

* exact and family matching precede fuzzy
* family aliases avoid highly ambiguous generic tokens like plain `status`
* the resolver strips engineering units, but does not broadly discard semantic nouns

## Follow-up recommendation

The next architectural improvement should be unmatched-property telemetry:

* persist unmatched changed properties by tenant and industry
* review the top misses in admin governance
* promote vetted misses into the family registry or tenant taxonomy
