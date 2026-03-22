# Change Management User Documentation

Date: 2026-03-10  
Audience: Engineering leads, Purchasing leads, Support department leads  
System scope: BOM Compare VX current implementation (`apps/backend/src/diff/*`, results grid/export surfaces)

## 1) Change Type Options (Current System)

| Change Type | What It Means | What Must Happen For This Option To Be Selected | Key System Notes |
|---|---|---|---|
| `added` | A row exists only in target (new revision). | Row is unmatched on target side and is not consumed by replacement pairing. | Classification reason is `unmatched_target_row`. |
| `removed` | A row exists only in source (old revision). | Row is unmatched on source side and is not consumed by replacement pairing. | Classification reason is `unmatched_source_row`. Reviewer-facing impact must not default to `No Impact` only because no taxonomy row matched. |
| `replaced` | A removed row and an added row are paired as likely replacement. | Source unmatched row + target unmatched row pass replacement pairing logic (similarity threshold and ambiguity policy). | Classification reason is `unmatched_pair_replacement`. |
| `modified` | Matched row changed in one or more comparable fields (not pure quantity-only and not moved). | Rows are matched, `changedCells > 0`, moved rule not satisfied, quantity-only rule not satisfied. | Classification reason is `matched_modified`. |
| `moved` | Matched part changed parent/position context in BOM structure. | Rows are matched; `parentPath` or `position` changed; match is not `reviewRequired`; match score `>= 0.90`. | Classification reason is `matched_moved`; includes `fromParent` and `toParent`. |
| `quantity_change` | Matched part changed quantity only. | Rows are matched; quantity changed; part number same; all other checked fields unchanged. | Classification reason is `matched_quantity_change`. |
| `no_change` | Matched row has no comparable-field differences. | Rows are matched and `changedCells === 0` and moved rule not satisfied. | Classification reason is `matched_no_change`. |

### Decision precedence (matched rows)
1. `moved` check runs first (high-confidence parent/position change).
2. Then `no_change` if no cell differences.
3. Then `quantity_change` if only quantity changed.
4. Otherwise `modified`.

If a row satisfies both moved and quantity change behavior, it remains `moved` (quantity still appears in `changedFields`).

## 2) Classification Reason Options (Current System)

| Classification Reason | Linked Change Type(s) | What Exactly Constitutes This Reason |
|---|---|---|
| `matched_moved` | `moved` | Matched row passed moved rule (parent/position change + score threshold + not review required). |
| `matched_no_change` | `no_change` | Matched row has zero comparable-field deltas. |
| `matched_quantity_change` | `quantity_change` | Matched row changed quantity while all other quantity-check fields stayed the same. |
| `matched_modified` | `modified` | Matched row has deltas but is not moved and not quantity-only. |
| `unmatched_pair_replacement` | `replaced` | Unmatched source+target rows were paired as replacement candidate by replacement scoring and ambiguity gating. |
| `unmatched_source_row` | `removed` | Source row remained unmatched after matching and replacement pairing. |
| `unmatched_target_row` | `added` | Target row remained unmatched after matching and replacement pairing. |

## 3) Replacement Pairing Rules (What Must Happen)

| Rule Area | Current Behavior |
|---|---|
| Feature flag | `MATCHER_AMBIGUITY_STRICT_V1` (default `true`) governs strictness. |
| Score threshold | Strict mode: `>= 0.90`; relaxed mode: `>= 0.80`. |
| Context requirement in strict mode | Candidate must be context-aligned (`parentPath` match AND (`position/findNumber` OR `description` match)). |
| Ambiguity suppression in strict mode | Ambiguous context groups are filtered/suppressed to avoid false `replaced`. |
| One-to-one pairing | A target unmatched row can only be consumed by one replacement pair. |
| Similarity components | Parent match (0.40), position/findNumber match (0.25), description match (0.20), quantity/revision/supplier matches (0.05 each). |

## 4) Related Rationale Options (Not `classificationReason`, but visible in outputs)

`matchReason` values currently produced by matcher logic:

| Match Reason | Meaning |
|---|---|
| `no_candidate_found` | No valid target candidate found for source row. |
| `stable_key_exact_unique` | Stable key produced exactly one candidate. |
| `unique_candidate` | Strategy produced exactly one candidate. |
| `stable_key_ambiguous_review_required` | Stable-key tie fell into near-tie review-required path. |
| `near_tie_review_required` | Strategy tie within near-tie delta; no auto-pick. |
| `stable_key_selected` | Stable-key multi-candidate scored and deterministically selected. |
| `scored_candidate_selected_graph_context` | Scored strategy selection with graph-context bonus impact. |
| `scored_candidate_selected` | Scored strategy selection without graph-context bonus. |

Cell-level reason pattern: `field_changed_<fieldName>`.

## 5) How Teams Should Interpret Change Outputs

| Team | Primary Focus | Recommended Action by Change Pattern |
|---|---|---|
| Engineering | design intent and technical correctness | Validate `moved`, `modified`, and `replaced` first; confirm hierarchy and changed fields before release decisions. |
| Purchasing | supplier/quantity/commercial impact | Prioritize `added`, `removed`, `quantity_change`, supplier/cost changes in `modified`; trigger supplier confirmation where needed. |
| Support Leads | process quality and execution risk | Track high volumes of `replaced`/`modified`, unresolved review-required match contexts, and abnormal unmatched trends by tenant/session. |

## 6) Approved Removed-Component Impact Policy

This policy closes the gap where structural `removed` rows can appear without impact guidance even though the removal itself is a governed engineering change.

### Default reviewer-facing behavior

| Situation | Reviewer label | Default impact |
|---|---|---|
| `removed` row with insufficient evidence to classify further | `Needs Review` | `B / Medium` |
| `removed` row with functional, service, safety, or compliance evidence | explicit removal category | `A / High` |
| `removed` row with clear variant/effectivity-only scope | explicit removal category | `B / Medium` |
| `removed` row with strong reference-only / metadata-only evidence | explicit removal category | `C / Low` |

### Removal categories approved for the taxonomy

| Category | Meaning | Default impact |
|---|---|---|
| `Component removed - impact review required` | Real BOM line removed but evidence is not strong enough to call it scoped-only or low-risk | `B / Medium` |
| `Functional or service-affecting component removed` | Installed or service-relevant component removed from released structure | `A / High` |
| `Safety, regulatory, or critical characteristic removed` | Removal touches safety, compliance, traceability, or critical-characteristic signals | `A / High` |
| `Variant or effectivity-scoped removal` | Removal applies only to option, plant, customer, date, serial, lot, or model scope | `B / Medium` |
| `Reference-only, documentation, or cleanup removal` | Note, metadata, document-only, or other non-installed reference row removed | `C / Low` |

### Execution notes

| Rule | Approved behavior |
|---|---|
| `replaced` vs `removed` | Keep them separate. A pure removal is not downgraded into a replacement unless pairing logic explicitly proves a successor. |
| Structural fallback | `added` and `removed` rows must run through impact fallback logic even when no changed-cell payload exists. |
| Low-risk cleanup | Only assign the cleanup category when there is strong explicit evidence that the row was note/reference/document-only. |
| Unmatched changed rows | If a changed row has no matched taxonomy category, show `Needs Review` in reviewer-facing UX instead of `No Impact`. |
| Historical runs | Apply this policy to new computations by default; historical runs are not automatically backfilled. |

## 7) Industry Standard Comparison (High-Level)

| Industry | Typical Standards Baseline | Current Fit in BOM Compare VX | Main Gap Themes to Reach State of the Art |
|---|---|---|---|
| Manufacturing | ISO 9001, ISO 10007, ISO 10303 family | Strong diff determinism and rationale capture; audit and export present. | Formal change governance workflow, effectivity control, release/baseline governance, stronger PLM digital thread integration. |
| Automotive | IATF 16949 + AIAG Core Tools (APQP/PPAP/FMEA) | Good change detection foundation for engineering reviews. | APQP/PPAP evidence pack generation, supplier quality workflow integration, customer-specific submission automation. |
| Aerospace | AS9100D, EIA-649C, AS9145 | Good deterministic classification and audit trail foundation. | Configuration audits, formal CCB/change authorization flows, enhanced risk/safety/counterfeit and release compliance evidence. |
| Electronics | IEC 62474, IPC-1752B, IPC-2591, IPC-1782, IPC-DPMX/2581 | BOM diffing/export is useful for engineering delta review. | Material declaration/compliance workflows, traceability-level controls, smart factory and electronics exchange standard integration. |
| Construction | ISO 19650 series, ISO 29481:2025, ISO 16739-1:2024 (IFC) | Generic comparison engine can compare structured data but is not BIM-process-native. | BIM information-delivery workflows, IFC/IDM-native change packages, project role gates and CDE-aligned approvals. |

For detailed prioritized gap items that can be converted directly into user stories, see:
`docs/change-management-gap-analysis.md`

## 8) Source Basis

Implementation basis (repository):
- `apps/backend/src/diff/diff-contract.ts`
- `apps/backend/src/diff/classification.service.ts`
- `apps/backend/src/diff/diff-computation.service.ts`
- `apps/backend/src/diff/matcher.service.ts`
- `V1_SPEC.md`
- `PRODUCT_PLAN.md`

External standards basis (checked 2026-03-10):
- ISO 9001:2015 (current, revision in progress): https://www.iso.org/standard/62085.html
- ISO 10007:2017 (configuration management guideline): https://www.iso.org/standard/70400.html
- ISO 10303-242:2025 (managed model-based engineering): https://www.iso.org/standard/84300.html
- IATF publications and 16949 listing: https://www.iatfglobaloversight.org/iatf-publications/
- AIAG Quality Core Tools and PPAP/APQP references: https://www.aiag.org/expertise-areas/quality/quality-core-tools
- AS9100D and AS9145 standard references (SAE): https://saemobilus.sae.org/standards/as9100d-quality-management-systems-requirements-aviation-space-defense-organizations and https://saemobilus.sae.org/standards/as9145-aerospace-series-requirements-advanced-product-quality-planning-production-part-approval-process
- EIA-649C configuration management standard (SAE): https://saemobilus.sae.org/standards/eia649c-configuration-management-standard
- IEC 62474 (material declaration): https://webstore.iec.ch/en/publication/29857
- IPC materials declaration and CFX references: https://www.ipc.org/materials-declaration-data-exchange-standards-homepage and https://www.ipc.org/ipc-2591-connected-factory-exchange-cfx
- IPC-DPMX/IPC-2581 consortium reference: https://www.ipc2581.com/
- ISO 19650-1 and ISO 19650-2 (BIM information management): https://www.iso.org/standard/68078.html and https://www.iso.org/standard/68080.html
- ISO 29481-1:2025 (IDM): https://www.iso.org/standard/88515.html
- ISO 16739-1:2018 record showing replacement by 2024 version: https://www.iso.org/standard/70303.html
- buildingSMART IFC 4.3 / ISO publication announcement: https://www.buildingsmart.org/ifc-4-3-formally-approved-and-published-as-an-iso-standard/
