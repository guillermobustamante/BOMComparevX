# QA S16: Occurrence-Aware Matching

## Scope
- Validate that repeated BOM instances do not generate false positives when occurrence-level identifiers are present.
- Validate that the fix does not regress the newer all-fields change-detection pipeline.
- Validate that identity semantics are preserved for mapping/governance.

## User stories under test
- `US-1`
  - As a user, repeated instances of the same part should match by occurrence identity when a BOM provides one.
- `US-2`
  - As a user, reordering identical repeated rows between versions should not create `modified` false positives.
- `US-3`
  - As an admin/reviewer, the system should recognize common occurrence/object id headers as mapping semantics, not generic text.

## Test matrix
- `Parser precedence`
  - workbook row with both `PartKey` and `OccurrenceInternalName`
  - expected:
    - `occurrenceInternalId` populated from `OccurrenceInternalName`
    - `objectInternalId` populated from `PartKey`
    - compatibility `internalId` resolves to the occurrence id
- `Repeated-instance diff`
  - four `SI-Mutter M8` rows with shared `PartKey` and unique occurrence ids
  - identical source/target content with different target row order
  - expected:
    - `modified = 0`
    - `no_change = 4`
    - stable occurrence keys align across versions
- `Mapping semantics`
  - `Occurrence Internal Name`
  - `Part Key`
  - expected:
    - resolve to `occurrence_id`
    - resolve to `object_id`
- `Real user example review`
  - provided `Example 1 ver 1.xlsx`
  - provided `Example 1 ver 2.xlsx`
  - expected:
    - the `SI-Mutter M8` occurrence rows are identical by `OccurrenceInternalName`
    - prior `modified` rows are diagnosed as matching defects, not source-data changes
- `External sanity`
  - additional public BOM examples from outside the repo used to sanity-check header diversity and non-regression
  - goal:
    - avoid overfitting the fix to one mechanical CAD export

## Automated evidence
- `npm --prefix apps/backend run typecheck`
- `npm --prefix apps/backend run test -- occurrence-aware-matching.e2e-spec.ts`
- `node tools/qa/validate-occurrence-bom-pair.mjs "C:\Users\yetro\Desktop\BOM Examples\Example 1 ver 1.xlsx" "C:\Users\yetro\Desktop\BOM Examples\Example 1 ver 2.xlsx"`

## Findings
- The bug was reproducible as an identity-semantics defect, not a value-comparison defect.
- The key correction is separating occurrence identity from object identity at intake time.
- After the fix, repeated-instance order changes no longer force modified rows in the covered regression scenario.
- Real-pair QA summary on the supplied example workbooks:
  - `occurrenceHeader=OccurrenceInternalName`
  - `objectHeader=PartKey`
  - `identical=191`
  - `changed=3`
  - `missing=0`
  - This confirms the repeated `SI-Mutter M8` occurrences are not the dominant delta and should not be the source of false `modified` rows.

## Release confidence
- `93%`

Confidence basis:
- direct regression coverage for parser, matcher, and mapping semantics
- validation against the supplied real-world repeated-instance pattern
- no backend typecheck regressions from the change

## Remaining watch items
- Repeated-instance BOMs that do not provide an occurrence-level id still depend on path/slot/description heuristics.
- Additional source-specific examples should continue to be added as the QA fixture library grows.
