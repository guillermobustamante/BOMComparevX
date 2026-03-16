# Backlog S20 - Results Session Workspace Continuity

## Goal

Make `/results` behave like a true session workspace instead of a single comparison view.

This stage should:

* show and allow editing of one shared session name for the full revision chain
* preserve a read-only per-comparison label based on filename plus date
* make previous comparisons in the same session easier to view and reopen
* allow deleting the latest comparison and automatically stepping back to the previous comparison in the same session
* remember the active session across app navigation
* add lightweight performance improvements so page transitions and reload behavior stop feeling unnecessarily expensive

## Locked product decisions

These are confirmed for this backlog:

1. Session naming:
   * one shared session name for the full session
   * renaming from `/results` updates that name everywhere in the chain

2. Comparison label:
   * read-only
   * generated from filename plus date
   * recommended implementation assumption for this backlog:
     * use the comparison’s `rightRevision` / newest uploaded file name plus created date

3. Results rename UX:
   * inline editable session title in the results header
   * show a small save/check action only when the title is dirty
   * also save on blur when the value changed

4. Previous-comparisons UX:
   * keep a toolbar button that opens a modal listing all comparisons in the session
   * also add a persistent side rail or timeline on `/results` so the chain can be visualized directly
   * treat the side rail as part of this stage even if it is removed or simplified later

5. Delete latest behavior:
   * deleting the latest comparison must automatically open the previous comparison in the same session
   * that previous comparison becomes the latest active comparison

6. Active-session memory:
   * one global active session for the app
   * if a user returns to `/results` without explicit params, reopen the last active session automatically

7. Cross-page memory scope:
   * apply active-session memory to `Results`, `History`, `Mappings`, and `Notifications`
   * keep `Admin` session-agnostic

8. Authorization direction for this stage:
   * session initiator plus tenant admins can rename or delete session-chain items
   * more robust session security is parked as future work

9. Performance scope:
   * include lightweight performance improvements in this backlog
   * park broader performance hardening as future work

## Relationship to existing backlog and issues

### Non-overlap with `BACKLOG_S19_MAPPING_CHECK_REDESIGN.md`

This backlog does **not** redesign `Mapping Check`.

It may add session-context entry points or active-session cues on `/mappings`, but it must not:

* change the `Field Understanding Workspace` direction in `BACKLOG_S19_MAPPING_CHECK_REDESIGN.md`
* redefine mapping-preview contracts for business-understanding UX
* alter the scope of `ISSUE-027`

Boundary:

* `S19` is about how the system explains BOM field understanding
* `S20` is about how the system preserves and navigates a working session across comparisons and pages

### Current related issue landscape

This backlog is adjacent to, but not the same as:

* `ISSUE-002` reopen behavior and session/history handling
* `ISSUE-003` initiator-only previous-comparisons visibility
* `ISSUE-004` previous-comparisons status visibility
* `ISSUE-027` Mapping Check redesign for business users

## Current problem

The current experience is functionally capable but session-fragmented:

* `/results` behaves primarily like a comparison/job screen, not a long-lived session workspace
* session naming currently acts more like a per-history-entry rename than true session metadata
* the current previous-comparisons dialog is useful, but not enough for frequent chain navigation
* users can upload the next revision, but moving backward through the chain is not promoted strongly enough in the main UX
* deleting the latest comparison does not yet behave like rolling back the session state
* active context is URL-driven, so navigating away and coming back can lose the user’s working session unless the URL is fully preserved
* page loads and unnecessary refetches are making the app feel slower than the original intent

## Current implementation evidence

Frontend:

* `/results` already has:
  * upload-next-revision dialog
  * previous-comparisons dialog
  * rename and delete actions inside that dialog
  * current session/history fetch logic
* Evidence: `apps/frontend/components/results-grid.tsx`

History behavior:

* history rename/delete already exists, but is row-oriented and not yet clearly modeled as session-wide metadata
* Evidence: `apps/frontend/components/history-panel.tsx`

Backend:

* history rename currently updates `HistoryEntry.sessionName` by `historyId`
* session list currently computes `comparisonLabel` as `entry.sessionName || generatedLabel`
* generated label is currently `leftFile -> rightFile`, not the desired read-only filename + date model
* Evidence:
  * `apps/backend/src/uploads/upload-history.service.ts`
  * `apps/backend/src/uploads/history.controller.ts`
  * `apps/backend/prisma/schema.prisma`

## Architecture decision

Recommended architecture:

* Treat session metadata as first-class domain state, separate from per-comparison display labels.
* Introduce a lightweight `active workspace` client memory layer for this stage.
* Keep URL parameters as the highest-precedence source of truth when present.
* Keep `/results` as the canonical page for setting the active session.
* Let `History`, `Mappings`, and `Notifications` consume active-session context without becoming results clones.

Recommended backend boundary:

* Add a true session-level metadata source instead of relying on duplicated `sessionName` values stored independently per history row.
* Keep `HistoryEntry` for per-comparison chain entries.
* Derive or persist `comparisonLabel` separately as read-only chain-item metadata.

Recommended frontend boundary:

* Add a shared active-session store keyed by tenant and user in browser storage for this stage.
* Results header, comparison modal, and timeline are frontend/session-workspace features.
* Mapping Check redesign remains outside this stage even if `/mappings` gains session-aware shortcuts.

Why this is the correct boundary:

* one shared session name is conceptually session metadata, not a history-row attribute
* per-comparison labels are navigation artifacts, not user-owned titles
* active workspace memory is valuable immediately, but does not require server persistence for the first stage
* full security and server-synced workspace are important, but they should not block the usability fix now

## Scope

### In scope

1. Shared session name on `/results`
   * show in the results header
   * editable inline
   * save on blur if changed
   * save on explicit check/save action if changed

2. Read-only comparison labels
   * filename plus date
   * visible in the session comparison list and timeline
   * not user-editable

3. Previous comparisons modal
   * keep the existing toolbar button
   * improve the list so it is clearly session-oriented
   * show current comparison, latest comparison, and reopen actions clearly

4. Persistent side rail or timeline on `/results`
   * display the comparison chain within the same session
   * clearly indicate current and latest
   * make reopening previous comparisons easy

5. Delete latest comparison behavior
   * allow removing the latest comparison from `/results`
   * after delete, automatically open the previous comparison
   * promote the previous comparison to latest

6. Active-session memory
   * remember the active session when navigating away
   * if `/results` is opened without explicit params, restore the active session automatically

7. Cross-page session memory support
   * `History`
     * highlight or bias the active session
   * `Mappings`
     * show session-aware entry points or shortcuts without redesigning the page
   * `Notifications`
     * preserve active session context and allow return to active results quickly

8. Lightweight performance work
   * reduce unnecessary refetching when active session is unchanged
   * reduce avoidable reload/reset behavior during same-session navigation
   * preserve active context in memory to avoid rehydration churn

### Out of scope

* `Mapping Check` redesign and business-user workflow changes from `S19`
* server-persisted recent workspace per user
* full session-security hardening or policy model redesign
* broad performance-hardening program, performance budgets, or backend architectural tuning beyond lightweight session-flow wins
* Admin session context

## UX changes

### Results header

1. Replace the current generic results title treatment with a session-first header area that includes:
   * editable session name
   * read-only current comparison label
   * dirty-state save/check action

2. Save behavior:
   * when user changes session name and blurs the field, save automatically
   * when user changes session name and clicks the check action, save immediately
   * if value is unchanged, do not show the save/check action

### Comparison chain navigation

3. Keep the `Previous comparisons` toolbar button.

4. Upgrade the modal list so each comparison clearly shows:
   * read-only comparison label
   * uploaded date
   * initiator
   * current/latest state
   * open action
   * delete action where allowed

5. Add a persistent results-side rail or timeline that:
   * lists comparisons in chain order
   * highlights current comparison
   * highlights latest comparison
   * allows quick reopening

### Delete behavior

6. If the current/latest comparison is deleted:
   * remove it
   * reopen the previous comparison automatically
   * update visible latest markers in both modal and timeline

### Cross-page workspace memory

7. When the user leaves `/results` and later returns without explicit query params:
   * reopen the last active session automatically

8. On `History`, `Mappings`, and `Notifications`:
   * show active-session context subtly
   * make it easy to return to the active results workspace
   * do not turn those pages into session-detail pages

## Data and contract changes

### Session metadata model

Recommended direction:

* add a session-level metadata model rather than continuing to treat `HistoryEntry.sessionName` as the only title store

Suggested shape:

```ts
interface ComparisonSessionMetadata {
  sessionId: string;
  tenantId: string;
  sessionName: string | null;
  latestHistoryId: string | null;
  latestJobId: string | null;
  latestLeftRevisionId: string | null;
  latestRightRevisionId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}
```

This can be implemented either by:

* a new session metadata table, recommended
* or a transitional propagation model across all rows with the same `sessionId`

Recommendation:

* use a first-class session metadata table if feasible in this stage
* do not keep long-term session naming semantics bound to a single `historyId`

### Session-comparison list contract

The results/history session list should clearly separate:

* shared session name
* read-only comparison label
* current/latest markers
* delete eligibility

Suggested additions:

```ts
interface SessionComparisonEntryV2 {
  historyId: string;
  jobId: string;
  sessionId: string;
  sessionName: string | null;
  comparisonLabel: string;
  comparisonDateLabel: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  initiatorEmail: string;
  status: string;
  leftRevisionId: string | null;
  rightRevisionId: string | null;
  current: boolean;
  latest: boolean;
  canDelete: boolean;
}
```

### Delete latest contract

Delete should return enough information to continue the session seamlessly.

Suggested response:

```ts
interface DeleteLatestComparisonResult {
  deleted: true;
  historyId: string;
  nextActiveHistoryId: string | null;
  nextActiveLeftRevisionId: string | null;
  nextActiveRightRevisionId: string | null;
  sessionId: string;
}
```

### Active workspace client model

Suggested browser-stored model:

```ts
interface ActiveWorkspaceState {
  tenantId: string;
  userEmail: string;
  sessionId: string;
  historyId: string | null;
  leftRevisionId: string | null;
  rightRevisionId: string | null;
  sessionName: string | null;
  comparisonLabel: string | null;
  updatedAtUtc: string;
}
```

Rules:

* explicit URL params win
* active workspace updates when `/results` resolves a new current comparison
* `/results` auto-restores from active workspace only when explicit params are absent

## Rollout phases

### Phase 1 - Session model and contract cleanup

Goal:

* separate shared session metadata from per-comparison labels

Tasks:

* add or formalize session-level metadata
* stop using `sessionName` as the fallback comparison label
* generate read-only comparison labels from filename plus date
* expose latest/current/delete eligibility in the session list contract

### Phase 2 - Results session workspace UX

Goal:

* make `/results` clearly session-centric

Tasks:

* inline editable session title
* save-on-blur and save-on-check behavior
* improved previous-comparisons modal
* persistent side rail or timeline
* current/latest state treatment

### Phase 3 - Delete latest rollback behavior

Goal:

* let users remove the latest comparison without breaking the session chain

Tasks:

* backend delete-latest behavior
* automatic reopen of previous comparison
* latest-marker update
* safe empty-session behavior if no prior comparison remains

### Phase 4 - Active workspace memory across pages

Goal:

* preserve the user’s working session when navigating around the app

Tasks:

* client active-workspace store
* `/results` auto-restore when URL params are absent
* active-session cues/actions for `History`, `Mappings`, and `Notifications`
* keep `Admin` explicitly session-agnostic

### Phase 5 - Lightweight performance pass

Goal:

* remove obvious session-navigation inefficiencies without starting a full performance program

Tasks:

* reduce unnecessary refetches
* reuse active workspace state where safe
* avoid reload/reset churn on same-session navigation
* validate improved navigation feel on session-centric flows

## Implementation tasks

1. Define shared session metadata as distinct from per-comparison labels  
   Status: `Pending`

2. Change session rename semantics so renaming updates the full session, not only one history row  
   Status: `Pending`

3. Generate read-only comparison labels from filename plus date  
   Status: `Pending`

4. Update the session-history API contract to expose current/latest/delete eligibility clearly  
   Status: `Pending`

5. Add inline editable session title to `/results` with dirty-state save/check action  
   Status: `Pending`

6. Add save-on-blur behavior for session title editing  
   Status: `Pending`

7. Upgrade the previous-comparisons modal into a clearer session-chain browser  
   Status: `Pending`

8. Add a persistent results-side chain rail or timeline  
   Status: `Pending`

9. Implement delete-latest behavior that automatically reopens the previous comparison  
   Status: `Pending`

10. Make previous comparison the new latest after latest-delete  
    Status: `Pending`

11. Add client-side active workspace memory keyed by tenant and user  
    Status: `Pending`

12. Auto-restore `/results` from active workspace when explicit params are absent  
    Status: `Pending`

13. Add active-session cues/actions to `History`  
    Status: `Pending`

14. Add active-session cues/actions to `Mappings` without overlapping S19 redesign scope  
    Status: `Pending`

15. Add active-session cues/actions to `Notifications`  
    Status: `Pending`

16. Add lightweight performance improvements for same-session navigation and refetch behavior  
    Status: `Pending`

17. Add regression coverage for session rename, chain navigation, delete-latest rollback, and active-session restore  
    Status: `Pending`

18. Run a UX QA pass against the session-workspace flows before implementation is marked complete  
    Status: `Pending`

## QA

Required checks for this stage:

* `npm --prefix apps/backend run typecheck`
* `npm --prefix apps/backend run build`
* `npm --prefix apps/backend run test`
* `npm --prefix apps/frontend run typecheck`
* `npm --prefix apps/frontend run build`

Recommended additional checks:

* focused frontend e2e coverage for:
  * inline rename on `/results`
  * previous-comparisons modal navigation
  * delete latest and automatic rollback to previous comparison
  * active-session restore when re-entering `/results`
  * active-session cues on `History`, `Mappings`, and `Notifications`

QA focus:

* session title updates everywhere in the chain, not just one comparison row
* comparison labels remain read-only and follow filename + date rule
* results header rename is simple and saves correctly on blur and explicit confirm
* previous-comparisons modal and side rail show consistent chain state
* deleting latest reopens the previous comparison without dead-end behavior
* `/results` restores the last active session correctly when explicit URL params are absent
* `Admin` remains unaffected by active-session memory
* performance feels improved during same-session navigation and back-and-forth flows

## Risks

Primary risks:

* overloading `/results` with both a modal and a persistent chain rail can create clutter
* client-only active-session memory can drift from server truth if chain state changes elsewhere
* changing rename/delete semantics can break current history behavior if contract changes are not explicit
* touching `/mappings` session cues could accidentally collide with `S19`

Mitigation:

* keep the timeline visually lightweight and subordinate to the main results table
* keep URL params higher priority than client memory
* separate session metadata from per-comparison labels cleanly
* enforce a strict scope note that `S20` does not redesign Mapping Check

## Future items parked outside this backlog

These are intentionally parked and should not block this stage:

* server-persisted recent workspace per user
* more robust session security and authorization model
* broader performance-hardening program and load-budget enforcement

See:

* `docs/A Future Improvements/session-workspace-security-and-performance.md`

## Follow-up recommendation

After this stage:

* evaluate whether client-side active workspace should be promoted to a server-persisted recent workspace
* evaluate whether session actions should move to a more explicit authorization model with session roles and policy checks
* plan a dedicated performance-hardening stage with measurable navigation and data-fetch budgets
