# Backlog S16: Occurrence-Aware Matching for Repeated BOM Instances

## 1. Objective
- Eliminate false positives caused by matching repeated part instances on shared object identity instead of true occurrence identity.
- Make the diff engine distinguish occurrence-level identifiers from object/part-level identifiers.
- Keep the all-fields comparison model intact while hardening the row-matching layer.
- Add QA coverage that specifically targets repeated-instance BOMs, order shifts, and mixed-source headers.

## 2. Problem statement
- Some BOMs contain the same part multiple times in one assembly while also providing a unique identifier for each occurrence.
- The current parser collapses fields such as `PartKey` and `OccurrenceInternalName` into one generic internal id.
- When a shared object id is chosen over a unique occurrence id, repeated instances can be cross-matched.
- Once the wrong row pair is formed, the all-fields diff correctly reports many differences, but they are false positives caused by bad matching.

## 3. Locked decisions
- `OccurrenceInternalName`-style fields are occurrence identity, not object identity.
- `PartKey`-style fields are object identity, not occurrence identity.
- The parser will preserve both identities separately.
- Matching must prefer occurrence identity over shared object identity.
- Mapping semantics must expose `occurrence_id` and `object_id` as first-class canonical fields.
- QA must include repeated-instance order-shift scenarios before the stage is considered releasable.

## 4. Design

### 4.1 Intake model
- Extend diff rows with:
  - `occurrenceInternalId`
  - `objectInternalId`
- Keep `internalId` for compatibility, but resolve it with this precedence:
  - occurrence id
  - generic internal id
  - object id

### 4.2 Matching model
- Stable occurrence keys should anchor on `occurrenceInternalId` when present.
- SAP/generic adapters should prefer occurrence identity before position, description, or shared object ids.
- Shared object ids remain useful context, but they must not outrank occurrence ids.

### 4.3 Governance/mapping model
- Add `occurrence_id` and `object_id` to the mapping canonical field set.
- Add semantic registry aliases for common header names:
  - `Occurrence Internal Name`
  - `Occurrence ID`
  - `Instance ID`
  - `Item Node`
  - `Part Key`
  - `Linked Object Name`
  - `Object ID`

## 5. Implementation tasks

### Backend
- Split parser alias handling into generic, occurrence, and object identity groups.
- Populate `occurrenceInternalId` and `objectInternalId` on upload.
- Update normalization to preserve deterministic normalization for both fields.
- Update profile adapters so stable keys use occurrence ids first.
- Update matcher identity token precedence to use occurrence identity before generic internal ids.

### Mapping
- Extend mapping canonical fields with `occurrence_id` and `object_id`.
- Extend semantic registry aliases to recognize common occurrence/object identity headers.

### QA
- Add parser regression test for workbook upload with both occurrence and object identifiers.
- Add repeated-instance diff regression for identical BOM rows presented in different order.
- Add mapping semantic tests for occurrence/object id detection.
- Validate against the provided mechanical CAD example pair before closeout.
- Validate against external BOM examples from outside the repo to guard against source-specific overfitting.

## 6. Acceptance criteria
- Repeated identical part instances with unique occurrence ids do not show false `modified` rows when file order changes.
- Uploaded rows preserve both occurrence and object identity when present.
- Stable occurrence keys are deterministic for repeated-instance BOMs.
- Mapping can classify common occurrence/object identity headers without manual code changes.
- QA evidence demonstrates release confidence above 90%.

## 7. Risks
- `Overfitting to one source format`
  - mitigate with semantic identity roles and external QA examples.
- `Legacy workflows depending on generic internalId`
  - mitigate by keeping `internalId` as a compatibility field with safer precedence.
- `Repeated rows without occurrence ids`
  - mitigate with current stable-key/path logic and future ambiguity-hardening follow-up.

## 8. Release gate
- Do not release unless:
  - backend typecheck passes
  - targeted occurrence-aware regression tests pass
  - broader backend test suite passes
  - QA review of repeated-instance scenarios is completed
  - confidence assessment is at least 90%
