# BOMCompare — Product Discovery + V1 Build Plan

## 1) What I heard (your goals in plain language)

You want a **real, launchable web product** where engineers can:
- Sign in
- Upload two design/BOM files
- Get a clear BOM diff (new/changed/removed)
- Revisit history
- Share results securely
- Export outputs

You also want this to feel **professional**, not a demo.

---

## 2) Reality check: what to build first vs later

Your requirements are strong, but they describe roughly **V1 + V2** together.
If we build all of it at once, launch speed and quality will suffer.

### Must-have for Public V1 (recommended)
1. OAuth login (Google + Microsoft)
2. Upload two files per comparison (CSV + Excel in V1), can keep uloading files to the same comparision, compare the latest uploaded to the previous uploaded version.
3. Async processing with status/progress UI
4. BOM diff table with search/sort/filter
5. Change highlighting (new/changed/removed)
6. CSV export for comparison results
7. Session history (view/reopen)
8. Upload cooldown policy (48h) + admin override


### Defer to V1.1 / V2
9. Basic sharing by invite email (authenticated recipient only)
1. Native STEP/STP parsing (if parser quality/risk is high)
2. Email notification preferences center
3. Rich tagging/renaming UX polish
4. Multi-version chain upload (N versions) with advanced cross-version analytics
5. Deep admin analytics dashboards

---

## 3) Key assumptions I’m challenging now

1. **STEP/STP in day one** is risky unless we use a reliable parser/service.
   - Recommendation: start with CSV/Excel for stable launch, add STEP/STP pipeline right after baseline launch.

2. **48-hour upload limit for every user** may hurt activation.
   - Recommendation: keep the rule, but add free onboarding credits (e.g., first 3 comparisons immediately) to reduce drop-off.

3. **No sharing expiry** can create long-term security risk.
   - Recommendation: keep “no expiry” default per requirement, but include manual revoke and access logs in V1.

---

## 4) Proposed V1 scope we can actually launch

### User-facing
- Login via Google + Microsoft
- Landing on upload page after login
- Upload exactly 2 files (CSV/XLS/XLSX initially)
- Drag/drop + file picker (link ingest can be V1.1 if needed)
- Immediate validation (type + size)
- Background processing job with progress states
- Result table:
  - sort/filter/search
  - filters: new/changed/removed (combinable)
  - color-coded row/cell changes
- Export comparison as CSV (Excel-compatible encoding)
- History list with status + reopen result
- Share result with one or more emails (must authenticate)

### Admin-facing
- User list
- Reset/override upload cooldown
- Basic event log (uploads, failures, shares)

### Platform behavior
- Queue when concurrency exceeded
- In-app notification for completion
- File retention worker (delete raw uploaded files at 7 days)

Complexity: **Medium–Ambitious** (depending on STEP/STP inclusion in V1)

---

## 5) Technical approach (plain language)

- **Frontend**: modern responsive app (React + Next.js) for fast UI and routing.
- **Backend/API**: server routes for uploads, comparisons, history, sharing.
- **Database**: Azure SQL Database for users, jobs, sessions, shares, audit logs, with Azure SQL Server Graph when necesary.
- **Storage**: Azure Blob Storage for uploaded files and exports.
- **Background jobs**: queue worker for parsing/comparison and retention cleanup.
- **Auth**: OAuth via Google and Microsoft.
- **Hosting**: managed deployment (e.g., Build and use github wokflows).

---

## 6) Data model outline (high level)

- `users`
- `comparison_sessions`
- `session_versions`
- `comparison_results`
- `shares`
- `notifications`
- `upload_limits`
- `admin_actions`
- `job_runs`

---
## 6.1) xxxxxx
---

## 7) Build stages (visible increments)

### Stage 1 — Foundation
- App shell, responsive layout, auth, protected routes.
- Output: users can sign in and see upload screen.

### Stage 2 — Upload + Validation
- Two-file upload, drag/drop, validation, basic history entry.
- Output: sessions created and queued.

### Stage 3 — Async Comparison Engine
- Worker pipeline, progress states, result persistence.
- Output: completed comparison results viewable.

### Stage 4 — Results Experience
- Diff table, highlighting, filtering, search/sort, export CSV.
- Output: production-quality result reading workflow.

### Stage 5 — Sharing + Notifications + Limits
- Invite sharing, in-app notifications, 48h cooldown logic + admin overrides.
- Output: collaboration + policy controls.

### Stage 6 — Retention + Hardening
- 7-day raw-file deletion job, failure tracking, QA, polish.
- Output: launch-ready reliability baseline.

---

## 8) Decisions you need to make now (product owner controls)

1. **V1 file formats**
   - A) CSV/Excel only (fast launch)
   - We are going to go with Option A. We will limit V1 file formats to CSV/Excel.

2. **Notification in V1**
   - A) In-app only, In-app only notifications

3. **Upload limit onboarding policy**
   - B) first 3 comparisons unrestricted, then 48h rule. 
   - first 3 comparisons unrestricted, then 48h rule for V1

4. **Sharing scope in V1**
   - A) single recipient per share, single recipient per share for V1.

5. **Deployment preference**
   - The intention is to deploy this in Azure, so use technologies that are in Azure, and I want more control for V1.

---

## 9) Immediate next step (Phase 1 completion)

Once you confirm the 5 decisions above, I will produce:
1. A locked **V1 spec**
2. A **sprint-by-sprint implementation plan**
3. A **build checklist** with acceptance criteria
4. Then we begin implementation in repo in small, reviewable increments.