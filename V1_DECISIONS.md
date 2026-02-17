# V1 Decisions (Locked)

Version: 1.1  
Status: Locked for Stage 3 planning/execution

---

## Platform and Scope

1. Deployment target is Azure-managed infrastructure for Dev/Test/Prod.
2. Graph model in Phase 1 is Azure SQL Graph-capable.
3. V1 launch file format scope is CSV/Excel-centric for upload/detection paths.
4. Raw engineering files follow 7-day deletion; metadata/results/audits follow retention policy.

## Upload, Policy, and Notifications

5. Upload onboarding policy is: first 3 comparisons unrestricted, then 48-hour cooldown.
6. Admin override/reset of upload policy is enabled and audit logged.
7. Notifications default is in-app for V1; email expands in later phase.
8. Sharing scope in V1 is single-recipient invite with explicit revoke.

## Export and Revision Behavior

9. Excel export fidelity targets structure/layout and mapped columns; full style/formula fidelity is best-effort.
10. Revision behavior is immutable: new upload creates a new revision, compared against immediately previous revision in-session.

## Stage 3 Detection and Mapping (Locked)

11. Multi-pass detection order is fixed:
   - Pass 1: semantic registry exact/fuzzy
   - Pass 2: heuristic fallback
   - Pass 3: ML-assisted disabled in V1
   - Pass 4: user confirmation/edit
12. Semantic registry supports cross-industry aliases (electronics/mechanical/aerospace/manufacturing).
13. Semantic registry supports multilingual aliases for EN/ES/DE/FR/JA/ZH and remains extensible.
14. Confidence gates for V1 detection are:
   - `>=0.90` auto-map (UI color code: Red)
   - `0.70-0.89` review-required (UI color code: Yellow)
   - `<0.70` low-confidence warning (UI color code: Red); user may proceed with warning
15. Canonical mapping fields for Stage 3:
   - Required: `part_number`, `description`, `quantity`
   - Conditional required: `revision` (optional when unavailable in source/domain)
   - Optional: `supplier`, `cost`, `lifecycle_status`, tenant custom attributes
16. Confirmed mapping is immutable per revision and auditable.
17. Mapping persistence entities for Stage 3:
   - `bom_column_mappings` (immutable snapshot)
   - `column_detection_audits` (strategy, confidence, user confirmation/correction)
18. Mapping reuse conflict rule is fresh detection first (saved mapping does not override current detection by default).
19. Mapping edit rights default is owner-only; admin override is available and audited.
20. Low-confidence mappings do not hard-block flow; user can proceed with warning.
21. Language detection metadata is persisted in mapping records; not required in audit records.
22. Persistence/migration tool for this environment is Prisma with SQL migrations against Azure SQL.
23. Physical table naming convention is camelCase.
24. `bom_column_mappings` and `column_detection_audits` are included in the persistence baseline now (not deferred).
