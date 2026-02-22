# BOMCompare — Product Plan + Integrated Solution Architecture

## 1) Product Vision

BOMCompare is a multi-tenant SaaS platform for accurate, repeatable BOM revision comparison in manufacturing workflows. It enables secure uploads, deterministic diffs, clear visual change review, historical traceability, controlled sharing, and export outputs compatible with customer workflows.

This document integrates the original product plan with the Solution Architecture Amendment and is scoped for a public Phase 1 launch.

---

## 2) Product Owner Alignment (what we are optimizing for)

You want a product that is:
- Real and launchable (not a prototype)
- Professional in UX across desktop/tablet/mobile
- Built in visible stages with clear checkpoints
- Technically solid for future scaling and compliance hardening

---

## 3) Scope Strategy: Launchable V1 vs Later

### 3.1 Must-Have for Public V1
1. Google + Microsoft OAuth authentication
2. Tenant-scoped authorization (own + explicitly shared only)
3. Two-file upload per comparison (picker, drag/drop, link input)
4. File/type/size validation (max 30MB)
5. Async job processing with queue + progress timeline
6. BOM results table with search/sort/filter and change filters
7. Visual change indicators for new/changed/removed (row + column level)
8. CSV export and Excel-compatible export preserving uploaded source structure
9. History (status, timestamps, reopen, rename, tags, delete)
10. Sharing by invited email (multi-recipient, same-tenant, view-only), auth required, manual revoke
11. Upload limit policy (48-hour default) with admin reset/override
12. 7-day deletion of raw STEP/STP files; metadata/results persist
13. Immutable revisions (new upload = new revision)
14. Multi-version chain behavior: additional file compares to prior revision in same analysis
15. Stage 5 retention defaults: export artifacts 7 days, notifications 90 days, share records until revoke/session deletion

### 3.2 Post-Launch (V1.1/V2)
1. PLM integrations
2. Optional ML-assisted detection
3. Regulatory-grade tamper evidence / signatures
4. Multi-region and data residency expansion
5. Advanced analytics/reports

---

## 4) Architecture Principles (amended)

1. **Speed First**: Typical 5MB BOM comparison around 30s p95.
2. **Accuracy at Scale**: 95%+ column detection (Semantic Registry), deterministic attribute-level diffing.
3. **Determinism First (Phase 1)**: Same inputs produce same outputs.
4. **Format Preservation**: Original Excel structure retained via immutable mapping.
5. **Isolation-First Multi-Tenancy**: Tenant filtering in DB and app layers.
6. **Immutability for Reproducibility**: Append-only revision/result model.
7. **Async-First Processing**: Queue-backed background workers.
8. **Progressive Capability**: Phase 1 core; Phase 2 regulatory/PLM depth.

---

## 5) Integrated Solution Architecture

### 5.1 Deployment Baseline (Azure-native)
- Single region in Phase 1: Canada Central
- Managed services for reduced ops burden and compliance readiness
- Stateless API + queue + worker architecture
- Scale path from 2 concurrent uploads to 10 and 50+

### 5.2 Core Components
1. **Frontend (React SPA)**: upload, mapping preview, results, history, sharing, notifications
2. **API Layer**: authenticated endpoints, tenant context enforcement
3. **Identity**: Google and Microsoft OAuth federation
4. **Blob Storage**: raw uploads and exports
5. **Queue**: async orchestration with retry/dead-letter policies
6. **Workers**: parsing, matching, diffing, export creation, retention cleanup
7. **SQL Database**: users/sessions/revisions/shares/policies/notifications/audits
8. **Graph Capability**: Azure SQL Graph (or equivalent graph model) for BOM hierarchy traversal
9. **Cache**: query acceleration for session history/results
10. **Admin/Audit Services**: overrides, observability, audit export

Persistence conventions:
- Azure SQL persistence managed via Prisma SQL migrations.
- Physical table naming convention uses camelCase.
- Stage 2 baseline persistence includes `job_runs`, history entities, `upload_policies`, `upload_events`, `audit_logs`, `bom_column_mappings`, and `column_detection_audits`.

### 5.3 Amendment 1: Semantic Registry + Multi-Pass Detection
- **Pass 1: Semantic Registry** (95%+ target)
  - Cross-industry aliases (electronics/mechanical/aerospace/manufacturing)
  - Multi-language aliases (EN/ES/DE/FR/JA/ZH)
- **Pass 2: Heuristic Fallback** (~70% where registry misses)
- **Pass 3: ML Assist (Phase 2 optional)**
- **Pass 4: User Confirmation** via preview UI
  - confidence scores visible
  - manual remap supported
  - mappings saved immutably per revision

Detection confidence gates for V1:
- `>=0.90`: auto-map
- `0.70-0.89`: review-required in preview UI
- `<0.70`: low-confidence warning; user can proceed with explicit confirmation

Canonical mapping fields for V1:
- Required: `part_number`, `description`, `quantity`
- Conditional required: `revision` (optional when unavailable in source/domain)
- Optional: `supplier`, `cost`, `lifecycle_status`, tenant custom attributes

Detection Strategy Order: exact → fuzzy → heuristic → user override.

### 5.4 Amendment 2: Hybrid Excel-Database Interchange
- Preserve original column structure metadata
- Export comparison outputs aligned to uploaded structure
- Immutable column map snapshots enable reproducible re-exports
- Non-standard Excel support includes:
  - merged cells
  - multi-line headers
  - inline comments
  - variable row lengths

### 5.5 Deterministic Component Matching Strategy Hierarchy
1. Internal ID match (target ≥99%)
2. Part Number + Revision (target ≥98%)
3. Part Number only fallback (target ≥95%)
4. Fuzzy match (target ≥90%, bounded edit-distance)
5. No match => ADDED/REMOVED classification

Deterministic tie-break inside each strategy:
- Uniqueness first
- Highest confidence/score
- Attribute concordance (`description` -> `quantity` -> `supplier`)
- Stable fallback (lowest target row index / stable UUID lexical order)
- Near-tie ambiguity => `REVIEW_REQUIRED` (no silent auto-pick)

One-to-one matching lock:
- Once a target row is matched, it cannot be reused by another source row in the same run.

### 5.6 Attribute-Level Change Detection
Stage 4 classification taxonomy:
- `added`
- `removed`
- `replaced`
- `modified`
- `moved`
- `quantity_change`
- `no_change`

Default monitored attributes:
- quantity
- supplier
- cost (unit/total)
- lifecycle_status
- revision
- lead_time_weeks

Custom tenant attributes are configurable (example: ROHS_Compliant, Certification_Level, Thermal_Rating).
Classification outcomes persist row-level and cell-level rationale metadata for non-`no_change` rows.

### 5.7 End-to-End Runtime Flow
1. User logs in and lands on upload screen
2. Two files submitted; API validates policy/size/type
3. Files stored; session + revision records created; job queued
4. Worker parses and runs multi-pass detection
5. Preview UI displays mapping/confidence for user confirmation
6. Worker performs deterministic matching and normalization-first diff computation
7. Diff job APIs support progressive retrieval:
   - `POST /diff-jobs`
   - `GET /diff-jobs/{id}` (phase/percent/counters)
   - `GET /diff-jobs/{id}/rows?cursor=&limit=` (stable incremental chunks)
8. Completion notification triggered (in-app/email per config)
9. User reviews, filters, exports, shares, and revisits via history

### 5.8 Data Model Outline (architecture-aligned)
- `tenants`
- `users`
- `comparison_sessions`
- `bom_revisions`
- `bom_components`
- `component_links`
- `comparison_diffs`
- `bom_column_mappings` (immutable per revision)
- `column_detection_audits` (strategy/confidence/confirmation)
- `shares`
- `upload_policies` and overrides
- `job_runs`
- `notifications`
- `audit_logs`

### 5.9 Security and Isolation
- Tenant filter required on every data path
- No cross-tenant query behavior in Phase 1
- Sharing is explicit, same-tenant, and auditable
- Append-only audit trail with synchronized timestamps
- Audit export supported (CSV/JSON)

---

## 6) NFR Alignment Snapshot

### 6.1 Performance
- ≤5MB BOM: 30s p95
- 5–30MB BOM: 90s p95
- Enterprise BOM: first rows quickly + remainder async
- 30MB upload target: ~5s ingest via direct/resumable upload
- Stage 4 parse targets:
  - 30MB Excel parse <10s
  - 30MB CSV parse <5s
- Stage 4 progressive UX targets:
  - first progress response <2s
  - first row chunk visible <5s
  - subsequent chunks every 1-3s (or when batch ready)
- UI interactions: <500ms
- Page load: <3s
- Mobile interaction: <1s target under 4G conditions

### 6.2 Scaling Roadmap
- **Phase 1 (0–6 mo)**: 2 concurrent uploads
- **Transition (6–12 mo)**: ~10 concurrent uploads
- **Phase 2 (12–18 mo)**: 50+ concurrent uploads
- Trigger-based scaling by CPU, queue depth, DB/RU utilization, storage thresholds

### 6.3 Compliance and Controls
- SOC 2 Type II target readiness within 9 months post-launch
- ISO 27001 readiness within 12 months
- Exportable audit trails
- Phase 1 customer focus: non-regulated environments

---

## 7) UX Blueprint

1. Post-login direct landing on upload screen
2. Restriction banner when queue/limits block uploads
3. Two-file upload card with validation feedback
4. Column detection preview screen with confidence + editable mapping
5. Processing timeline: Uploading → Detecting → Matching → Diffing → Finalizing
6. Results grid with color-coded row/cell deltas + mandatory change-type filter, text search, and column filters
7. History view with reopen/rename/tags/delete
8. Share modal with invite + revoke controls
9. Notification center linking to completed jobs

---

## 8) Staged Delivery Plan

### Stage 1 — Foundation
Auth, tenant model, responsive shell, protected routes.

### Stage 2 — Upload + Policy + Queue
Validation rules, cooldown/override, queued processing, restriction banners.

### Stage 3 — Detection + Mapping
Semantic Registry + fallback detection + confirmation UI + immutable mapping persistence.
Low-confidence mappings show warning and require explicit proceed confirmation.
Saved mappings are reusable for future similar uploads and remain immutable per revision snapshot.
If saved mapping conflicts with fresh detection, fresh detection is used by default.

### Stage 4 — Diff Engine + Progressive Results
Deterministic matching with fixed tie-break + one-to-one lock, normalization-first comparison,
full Stage 4 taxonomy classification, row/cell rationale metadata, and progressive polling + cursor chunk delivery.

### Stage 5 — Export + Sharing + Notifications + Admin
Sync export downloads (CSV + Excel source-structure fidelity), multi-recipient same-tenant invite/revoke sharing (view-only), completion/failure notifications (in-app with optional email), and full admin UI controls backed by DB role claims.

### Stage 6 — Retention + Hardening
Raw-file lifecycle enforcement, audit exports, performance tuning for p95 targets.

---

## 9) Build-Lock Notes

1. Stage 4 matching, classification, normalization, and progressive delivery behavior are now locked in `V1_DECISIONS.md`.
2. Stage 4 execution backlog is defined in `Backlog_S4.md` (`S4-01` to `S4-10`) and mapped into `SPRINT_PLAN.md`.
---

## 10) Immediate Next Step

Proceed with Stage 5 backlog creation and execution against the locked export/sharing/notification/admin defaults.
