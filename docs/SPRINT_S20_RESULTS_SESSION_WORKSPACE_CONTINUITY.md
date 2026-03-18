# Sprint S20 - Results Session Workspace Continuity

## 1. Sprint metadata
- Sprint: `S20`
- Theme: `Results Session Workspace Continuity`
- Scope type: `Execution-ready sprint record with merged S12.1 foundation`
- Owner: `Product + Engineering`
- Status: `Completed`

## 2. Sprint goal
Make `/results` behave like a true session workspace across comparison chains and app navigation while preserving stable comparison identity, authorized session visibility, predictable delete-latest rollback behavior, and lightweight navigation-performance improvements.

## 3. Merge decision
- `Sprint S12.1 - Results Chain Hardening` is merged into `Sprint S20` and is no longer intended to run as a standalone sprint.
- The three `S12.1` stories become mandatory `Phase 0` foundation stories inside `S20`.
- `S20` cannot be marked complete unless the `ISSUE-002`, `ISSUE-003`, and `ISSUE-004` workflow-integrity gaps are closed as part of this sprint.

## 4. Locked decisions
- Treat session metadata as first-class domain state rather than continuing to model shared session naming as a history-row rename side effect.
- Use a first-class session metadata table in this sprint if feasible; if internal implementation must stage through propagation, the external contract must still behave as true session metadata.
- Keep URL parameters as the highest-precedence source of truth; active workspace memory is advisory and restores only when explicit params are absent.
- Keep `/results` as the canonical page for setting and restoring the active session workspace.
- Extend session awareness to `Results`, `History`, `Mappings`, and `Notifications`; keep `Admin` explicitly session-agnostic.
- Keep session name editable inline on `/results` with save-on-blur and dirty-state explicit save/check behavior.
- Keep comparison labels read-only and generate them from the newest uploaded file name plus created date.
- Make delete-latest reopen the previous comparison automatically and promote that comparison to `latest`.
- Allow authorized viewers of an active comparison session to see the session chain, while rename/delete mutation remains restricted to the session initiator and tenant admins.
- Show real comparison lifecycle status separately from `current` and `latest` markers.
- Limit performance scope to lightweight session-navigation wins; broader hardening remains parked outside this sprint.

## 5. Source evidence used

Code evidence reviewed:
- `apps/frontend/components/results-grid.tsx`
- `apps/frontend/components/history-panel.tsx`
- `apps/frontend/lib/session.ts`
- `apps/backend/src/uploads/upload-history.service.ts`
- `apps/backend/src/uploads/history.controller.ts`
- `apps/backend/src/uploads/upload-revision.service.ts`
- `apps/backend/prisma/schema.prisma`
- `tests/e2e/auth-shell.spec.ts`
- `tests/e2e/results-redesign.spec.ts`

Planning evidence reviewed:
- `BACKLOG_S20_RESULTS_SESSION_WORKSPACE_CONTINUITY.md`
- `docs/SPRINT_S12_1_RESULTS_CHAIN_HARDENING.md`
- `docs/ISSUE_TRACKER.md`
- `docs/A Future Improvements/session-workspace-security-and-performance.md`

## 6. Execution stories

### S20-01 - Immutable reopen of prior comparisons
As a user reviewing a previous step in a BOM session, I want `Open` to reopen the original comparison record instead of recomputing it so that history, exports, shares, and audit lineage remain stable.

Status:
- `Completed`

### S20-02 - Authorized session-chain visibility for shared viewers
As an authorized same-tenant viewer of an active comparison session, I want to see the full comparison chain so that shared review workflows work beyond the original initiator.

Status:
- `Completed`

### S20-03 - Real comparison status in session-chain surfaces
As a user navigating prior comparisons, I want modal and rail entries to show real comparison lifecycle state so that I can distinguish running, completed, and failed work without inference.

Status:
- `Completed`

### S20-04 - Session metadata and chain contract cleanup
As the session workspace domain, I need shared session naming, read-only comparison labels, and current/latest/delete markers modeled explicitly so that frontend behavior no longer depends on row-oriented history semantics.

Status:
- `Completed`

### S20-05 - Session-first results header and rename workflow
As a user working inside `/results`, I want the session title and current comparison label presented clearly in the header so that the page feels like a long-lived workspace instead of a one-off comparison screen.

Status:
- `Completed`

### S20-06 - Session chain browser in modal and persistent rail
As a user reviewing revision history, I want both a session-chain modal and a lightweight persistent rail so that I can reopen prior comparisons quickly without losing my place.

Status:
- `Completed`

### S20-07 - Delete-latest rollback behavior
As a user correcting a session chain, I want deleting the latest comparison to reopen the previous comparison automatically so that the session rolls back cleanly instead of ending in a dead state.

Status:
- `Completed`

### S20-08 - Active workspace restore across app pages
As a user moving between results-adjacent pages, I want the active session to be remembered and restorable so that I can return to the same working context without rebuilding the URL manually.

Status:
- `Completed`

### S20-09 - Lightweight performance pass for same-session navigation
As a user moving around one active session, I want navigation and reload behavior to feel lighter so that the workspace no longer refetches or resets more than necessary.

Status:
- `Completed`

### S20-10 - Regression coverage and UX QA for session continuity
As the delivery team, we need automated regression coverage and session-workspace QA so that rename, reopen, delete-latest, restore, and authorization behavior remain stable.

Status:
- `Completed`

## 7. Acceptance bar
- Opening a prior comparison must not generate a new comparison identity.
- Authorized same-tenant viewers of an active comparison must be able to see the session chain.
- Rename/delete mutation permissions must remain explicit and narrower than read visibility.
- Session-history responses must expose real comparison status plus `current`, `latest`, and delete eligibility markers.
- Shared session name must update at the session level, not only on one history row.
- Comparison labels must remain read-only and follow the newest-file-name plus created-date rule.
- `/results` must support inline rename with save-on-blur and explicit dirty-state save behavior.
- The previous-comparisons modal and persistent rail must show consistent chain ordering and state.
- Deleting the latest comparison must reopen the previous comparison and promote it to `latest`, with a safe empty-session fallback if no previous comparison remains.
- `/results` must restore the active session when explicit URL params are absent.
- `History`, `Mappings`, and `Notifications` must expose subtle active-session cues or return actions without becoming results clones.
- `Admin` must remain unaffected by active-session memory.
- Same-session navigation must avoid obvious unnecessary refetch and reload churn.

## 8. Source issues
- `ISSUE-002` in `docs/ISSUE_TRACKER.md`
- `ISSUE-003` in `docs/ISSUE_TRACKER.md`
- `ISSUE-004` in `docs/ISSUE_TRACKER.md`

## 9. Recommended sequencing
1. Execute the merged `S12.1` foundation stories first:
   - immutable reopen
   - shared-viewer session visibility
   - real status in chain surfaces
2. Formalize session metadata and the session-chain API contract.
3. Implement the `/results` header rename workflow and chain-navigation UI.
4. Add delete-latest rollback behavior.
5. Add active workspace memory across supported pages.
6. Finish with the lightweight performance pass and regression/UX QA.

## 10. Verification
- `npm --prefix apps/backend run typecheck`
- `npm --prefix apps/backend run build`
- `npm --prefix apps/backend run test`
- `npm --prefix apps/frontend run typecheck`
- `npm --prefix apps/frontend run build`
- focused frontend e2e coverage for:
  - inline rename on `/results`
  - modal and rail session-chain navigation
  - immutable reopen of previous comparisons
  - delete-latest rollback to the previous comparison
  - active-session restore when re-entering `/results`
  - active-session cues on `History`, `Mappings`, and `Notifications`

## 11. Residual notes
- Completion note:
  - Implemented and validated in repo, including contract, UI, rollback, active-workspace, backend regression, and focused browser coverage for reopen, restore, and delete-latest flows.
- Server-persisted recent workspace remains parked until the client-memory approach proves valuable.
- Broader session authorization and policy modeling remains a follow-on hardening stage after this sprint.
- Deeper performance budgeting and instrumentation remain a separate future stage after lightweight S20 improvements land.
