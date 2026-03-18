# Sprint S21 - History Revision Chains Quick Win

## 1. Sprint metadata
- Sprint: `S21`
- Theme: `History Revision Chains Quick Win`
- Scope type: `Execution-ready sprint record`
- Owner: `Product + Engineering`
- Status: `Completed`

## 2. Sprint goal
Redesign `/history` into a grouped `Revision Chains` page that shows BOM session progression clearly, using collapsible session cards and existing history API data without introducing a new backend contract.

## 3. Locked decisions
- Use the quick-win frontend-first approach from `BACKLOG_S21_HISTORY_REVISION_CHAINS.md`.
- Keep the current `/api/history/sessions` contract and group by `sessionId` in the frontend.
- Use `randomtests/History-RevisionChains-Option2.html` as the visual direction for layout, collapse behavior, spacing, and comparison-card hierarchy.
- Keep session rename editable from the expanded card and preserve private label/tag editing.
- Preserve current reopen and latest-only delete behavior.
- Rebrand the page around `Revision Chains`, but do not make `/history` a full functional duplicate of `/results`.
- Keep advanced share/export/upload-next flows anchored in `/results` unless they can be reused safely without new backend contracts.

## 4. Source evidence used

Code evidence reviewed:
- `apps/frontend/components/history-panel.tsx`
- `apps/frontend/components/app-shell.tsx`
- `apps/frontend/app/globals.css`
- `apps/backend/src/uploads/history.controller.ts`
- `tests/e2e/auth-shell.spec.ts`
- `apps/backend/test/stage1.e2e-spec.ts`

Planning and design evidence reviewed:
- `BACKLOG_S21_HISTORY_REVISION_CHAINS.md`
- `randomtests/History-RevisionChains-Option2.html`
- `docs/ISSUE_TRACKER.md`
- `V1_SPEC.md`

## 5. Execution stories

### S21-01 - Revision Chains presenter and grouped session model
As a history-page user, I want comparison entries grouped into session chains so that I can understand which BOM revisions belong together.

Status:
- `Completed`

### S21-02 - Collapsible session cards and session-level editing
As a reviewer, I want each BOM session to expand into an editable card so that I can rename the chain and manage its private label without using a flat admin table.

Status:
- `Completed`

### S21-03 - Comparison cards with preserved open/delete behavior
As a reviewer, I want each comparison in the chain rendered as a clear card with familiar actions so that reopening or removing the latest revision is easier to understand.

Status:
- `Completed`

### S21-04 - Rebrand, responsive polish, and regression coverage
As the delivery team, we need the redesigned history page to follow the upload/results visual language and remain stable under resize and regression tests.

Status:
- `Completed`

## 6. Acceptance bar
- `/history` must present grouped session cards instead of a flat primary table.
- Session cards must be collapsed by default and expandable without layout overlap.
- Expanded session content must show newest comparisons first and oldest last.
- Session rename must still apply to the full session chain.
- Private label updates must remain possible from the redesigned page.
- Open-from-history must still navigate to the original comparison identity.
- Delete must remain restricted to the latest comparison in the chain.
- The page must stay responsive across desktop and smaller viewports.
- Browser regression coverage must be updated for the grouped session DOM and preserved actions.

## 7. Source issue
- `ISSUE-032` in `docs/ISSUE_TRACKER.md`

## 8. Recommended sequencing
1. Define the grouped session presenter on top of the current API response.
2. Rebuild the page as collapsible session cards with expanded editing controls.
3. Re-render comparison entries as timeline-style cards with preserved open/delete actions.
4. Finish with responsive polish, rebrand copy, and browser regression updates.

## 9. Verification
- `npm --prefix apps/frontend run typecheck`
- `npm --prefix apps/frontend run build`
- focused Playwright coverage for:
  - grouped history sessions
  - session rename inside expanded cards
  - private label update
  - open original comparison from history
  - latest-only delete from history

## 10. Residual notes
- Completion note:
  - Implemented and validated in repo with grouped session cards, expanded rename flow, comparison details modal, preserved open/delete/tag behavior, responsive history styling, and focused Playwright regression coverage.
- This sprint is intentionally frontend-first and avoids backend contract expansion.
- If users later require direct share/export/upload-next actions from `/history`, that should be planned as a follow-on stage after the grouped-session model is proven.
