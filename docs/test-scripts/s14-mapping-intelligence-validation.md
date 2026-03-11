# S14 Mapping Intelligence Validation Script

## 0. Scope

Use this script to validate all implemented `S14` mapping-intelligence changes:
- expanded canonical mapping model
- explicit profile-aware mapping
- context-aware detection and negative rules
- explainable evidence and field-class surfacing
- tenant-scoped alias learning
- manufacturing, automotive, aerospace, electronics, and construction mapping packs
- S14 regression safety checks

## 1. Prerequisites

1. Start backend:
`npm --prefix apps/backend run start:dev`

2. Start frontend:
`npm --prefix apps/frontend run dev`

3. Sign in as a test user in the browser.

4. Use the same signed-in browser session for all `/mappings/...` routes below.

5. Optional automated gate before manual testing:
`npm --prefix apps/backend run typecheck`
`npm --prefix apps/frontend run typecheck`
`npm --prefix apps/backend run test:e2e`

## 2. Generic Mapping Preview Baseline

1. Open:
`http://localhost:3000/mappings/rev-s3-preview`

2. Verify these source columns appear:
- `Part Number`
- `Descriptin`
- `Needed Count`
- `Mystery Header`

3. Verify expected mapping behavior:
- `Part Number` maps to `part_number`
- `Descriptin` maps to `description`
- `Needed Count` maps to `quantity`
- `Mystery Header` remains unresolved or low-confidence

4. Verify the UI shows:
- `strategy`
- `confidence`
- `review state`
- evidence reasons
- field class

5. Expected:
- `Part Number` shows exact-alias style evidence
- `Descriptin` shows fuzzy-alias style evidence
- `Needed Count` shows heuristic evidence

## 3. Warning Acknowledgment + Confirm Flow

1. Stay on:
`/mappings/rev-s3-preview`

2. Verify the confirm button is disabled while low-confidence warning exists and the acknowledgment checkbox is not checked.

3. Check the low-confidence acknowledgment checkbox.

4. Change `Mystery Header` to any valid canonical field, for example `supplier`.

5. Click confirm.

6. Expected:
- success banner appears
- response includes `MAPPING_CONFIRM_SUBMITTED`

## 4. Tenant Learning Validation

### 4.1 Build the learned alias

1. Open:
`http://localhost:3000/mappings/rev-s14-tenant-learning-1`

2. Map `MFG Plant Code` to `plant`.

3. Confirm the mapping.

4. Repeat the same steps for:
- `/mappings/rev-s14-tenant-learning-2`
- `/mappings/rev-s14-tenant-learning-3`

### 4.2 Verify learned reuse

1. Open:
`http://localhost:3000/mappings/rev-s14-tenant-learning-preview`

2. Expected:
- `MFG Plant Code` auto-maps to `plant`
- strategy shows `TENANT_PACK`
- review state is `AUTO`
- evidence includes `tenant_confirmation`

## 5. Manufacturing Pack

1. Open:
`http://localhost:3000/mappings/rev-s14-manufacturing-preview?profile=manufacturing`

2. Expected mappings:
- `Plant` -> `plant`
- `Work Center` -> `work_center`
- `UOM` -> `unit_of_measure`
- `Procurement Type` -> `procurement_type`
- `Lead Time` -> `lead_time`
- `Material Group` -> `material_group`

3. Expected evidence:
- reasons present for each mapped field
- field classes shown

## 6. Automotive Pack

1. Open:
`http://localhost:3000/mappings/rev-s14-automotive-preview?profile=automotive`

2. Expected mappings:
- `Program` -> `program`
- `Vehicle Line` -> `vehicle_line`
- `Option Code` -> `option_code`
- `Engineering Level` -> `engineering_level`
- `PPAP Status` -> `ppap_status`

## 7. Aerospace Pack

1. Open:
`http://localhost:3000/mappings/rev-s14-aerospace-preview?profile=aerospace`

2. Expected mappings:
- `Drawing Number` -> `drawing_number`
- `Dash Number` -> `dash_number`
- `Serial Range` -> `serial_range`
- `Airworthiness Class` -> `airworthiness_class`

## 8. Electronics Pack

1. Open:
`http://localhost:3000/mappings/rev-s14-electronics-preview?profile=ipc_bom`

2. Expected mappings:
- `RefDes` -> `reference_designator`
- `Footprint` -> `footprint`
- `Manufacturer Part Number` -> `manufacturer_part_number`
- `RoHS` -> `rohs`
- `AVL` -> `avl`

## 9. Construction Pack + Negative Rule

1. Open:
`http://localhost:3000/mappings/rev-s14-construction-preview?profile=construction`

2. Expected positive mappings:
- `Asset ID` -> `asset_id`
- `Discipline` -> `discipline`
- `Location` -> `location`
- `IFC Class` -> `ifc_class`

3. Expected negative-rule behavior:
- `Status` must not auto-map to `lifecycle_status`
- evidence should show a suppressing/negative signal for workflow-state handling

## 10. Field Policy Validation

1. On any of the profile-specific mapping pages above, inspect the `fieldClass` values shown in the table.

2. Expected conservative behavior examples:
- `part_number` appears as identity-oriented
- `assembly` or `parent_path` appears as display-oriented
- `plant`, `cost`, `effectivity`, `compliance`, or similar impact fields appear as business-impact oriented when applicable
- normal descriptive fields remain comparable

## 11. Optional JSON Spot Checks

Use these in the browser address bar while signed in, or from DevTools:

1. Generic preview:
`http://localhost:3000/api/mappings/preview/rev-s3-preview`

2. Manufacturing:
`http://localhost:3000/api/mappings/preview/rev-s14-manufacturing-preview?profile=manufacturing`

3. Construction:
`http://localhost:3000/api/mappings/preview/rev-s14-construction-preview?profile=construction`

4. Expected in JSON:
- `columns[].strategy`
- `columns[].confidence`
- `columns[].reviewState`
- `columns[].fieldClass`
- `columns[].evidence.reasons`
- `columns[].evidence.negativeSignals` where applicable

## 12. Automated Regression Gate

Run:
`npm --prefix apps/backend run test:e2e`

Expected:
- all tests pass
- mapping-focused checks pass for:
  - profile aliases
  - tenant-learning reuse
  - negative rules
  - field policy classification
  - industry fixtures
  - deterministic repeated runs

## 13. Pass Criteria

1. Generic preview still behaves deterministically.
2. Low-confidence acknowledgment gate works.
3. Tenant learning upgrades a repeated tenant-specific header to `TENANT_PACK`.
4. All five industry previews map the seeded fields correctly.
5. Construction `Status` is suppressed from false lifecycle auto-mapping under construction profile.
6. Evidence reasons and field classes are visible and plausible.
7. Backend e2e regression suite passes.
