# UI-QA - Sprint 12 Results Revision Chain

## Scope reviewed
- `apps/frontend/components/results-grid.tsx`
- `apps/frontend/components/history-panel.tsx`
- `apps/backend/src/uploads/uploads.controller.ts`
- `apps/backend/src/uploads/upload-history.service.ts`
- `apps/backend/src/uploads/history.controller.ts`
- `apps/backend/src/uploads/upload-revision.service.ts`
- `apps/frontend/app/api/history/sessions/route.ts`

## QA mode
- `Code-aware UI QA`
- `Workflow integrity QA`
- `Session-history QA`

## Verdict
- `Fail`

## Findings

### 1. Reopening a prior comparison does not reopen the original comparison; it silently creates a new one
Severity:
- `High`

Evidence:
- Prior-comparison open action pushes only `sessionId + leftRevisionId + rightRevisionId` at [results-grid.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\results-grid.tsx:1367)
- Results starts a new diff job whenever `comparisonId` is absent at [results-grid.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\results-grid.tsx:682)
- Same reopen behavior exists in History at [history-panel.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\history-panel.tsx:234)

Why it matters:
- The user asked for previous comparisons in the session.
- The implementation currently re-runs the comparison instead of reopening the original comparison record.
- That changes comparison identity, comparison ID, share/export context, notification lineage, and audit trace.

Required follow-up:
- Open prior comparisons by stored `comparisonId` or persist a dedicated session-comparison record that binds history entry to an immutable comparison snapshot.

### 2. Previous-comparisons modal is owner-only, not session-viewer aware
Severity:
- `High`

Evidence:
- Session history API filters by `initiatorEmail` in [upload-history.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\upload-history.service.ts:99)
- Controller passes the current user email into that owner-only filter at [history.controller.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\history.controller.ts:39)

Why it matters:
- The stated product intent includes Engineering, Purchasing, Sales, and support roles.
- A shared viewer can open a comparison, but cannot see the session chain if they were not the initiator.
- That makes the Sprint 12 session-history workflow inconsistent across roles.

Required follow-up:
- Define and implement session-history read access for authorized viewers of the active comparison, not only the creator.

### 3. The modal does not expose a real comparison status, even though the requirement asked for one
Severity:
- `Medium`

Evidence:
- History entries are stored with status hard-coded to `queued` in [upload-history.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\upload-history.service.ts:16) and [upload-history.service.ts](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\backend\src\uploads\upload-history.service.ts:40)
- The previous-comparisons table shows a `State` column that uses `Latest` or the upload timestamp, not the actual comparison state, at [results-grid.tsx](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\apps\frontend\components\results-grid.tsx:1349)

Why it matters:
- The locked requirement asked for label, upload date/time, user, status, and open action.
- The current implementation substitutes timeline labeling for status because the backend does not maintain meaningful comparison-state history here.

Required follow-up:
- Bind session-history rows to real comparison lifecycle state such as `running`, `completed`, or `failed`.

## What passed
- One-file chained upload entry from `/results` exists.
- Chained upload uses modal + drag/drop + file picker.
- Successful chained upload redirects into a new in-progress Results workspace.
- Results completion chrome is more compact and less dominant than before.

## Verification performed
- `npm --prefix apps/frontend run typecheck`
- `npm --prefix apps/frontend run build`
- `npm --prefix apps/backend run typecheck`

All passed.

## Recommended disposition
- Treat Sprint 12 as implemented but not fully closed from a product-QA perspective.
- Carry the three findings into a focused follow-up slice: `Sprint 12.1 - Results Chain Hardening`.
