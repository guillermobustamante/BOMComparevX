# Backlog S21 - History Revision Chains Quick Win

## Goal

Redesign `/history` so users can understand BOM revision progress as grouped session chains instead of a flat archive table.

This backlog should:

* keep the current session-history API contract
* rebrand the page around `Revision Chains`
* group comparisons by shared BOM session
* show each session as a collapsible card that is collapsed by default
* list newest comparisons at the top and oldest at the bottom inside each session
* preserve existing rename, open, private-label, refresh, and delete behaviors while making them easier to understand

## Locked product decisions

1. Delivery boundary:
   * use the recommended quick win
   * keep the current backend API contract for history sessions
   * do not require a new backend grouping endpoint for this sprint

2. Visual source of truth:
   * use `randomtests/History-RevisionChains-Option2.html` as the layout and interaction reference
   * match its collapsible session structure, minimal upload-theme surface language, and comparison-card direction as closely as practical inside the app shell

3. Information model:
   * top level of the page is a BOM session chain
   * expanded content shows the individual comparisons that belong to that session
   * comparisons are ordered newest first, oldest last

4. Rename behavior:
   * session rename remains editable from `/history`
   * editing happens inside the expanded session card, not in a flat table cell
   * rename continues to apply to the whole session chain

5. Existing actions:
   * `Open comparison` remains available
   * latest-only `Delete` remains available
   * refresh remains available
   * private label/tag capability remains available even if relabeled in the UI

6. Action-surface boundary:
   * this sprint should align iconography and card rhythm with `/results`
   * it must not turn `/history` into a full duplicate of the `/results` workspace
   * direct share/export/upload-next-revision actions from `/history` are parked unless they can be delivered without new backend contracts or workflow confusion

## Current problem

The current `/history` page is technically functional but visually misleading:

* it presents one flat row per comparison instead of one grouped BOM session
* it does not make `upload next revision` progression obvious
* it makes users infer which comparisons belong together
* inline rename and tag fields read like admin-table controls rather than a working revision chain
* the page vocabulary still centers on `History` instead of the clearer user mental model of `revision chains`

## Current implementation evidence

Frontend:

* `/history` is currently rendered as a flat table
* rename, tag, open, delete, and refresh are already implemented
* Evidence:
  * `apps/frontend/components/history-panel.tsx`
  * `apps/frontend/components/app-shell.tsx`
  * `apps/frontend/app/globals.css`

Backend:

* `/api/history/sessions` already returns enough data to group by `sessionId`
* each entry already exposes:
  * `sessionId`
  * `sessionName`
  * `tagLabel`
  * `initiatorEmail`
  * `comparisonId`
  * `comparisonLabel`
  * `comparisonDateLabel`
  * `current`
  * `latest`
  * `canRename`
  * `canDelete`
* Evidence:
  * `apps/backend/src/uploads/history.controller.ts`

Regression coverage:

* browser coverage already exists for rename/delete/open behavior on `/history`
* backend e2e already covers chain markers, rename propagation, and delete-latest rules
* Evidence:
  * `tests/e2e/auth-shell.spec.ts`
  * `apps/backend/test/stage1.e2e-spec.ts`

## Architecture decision

Recommended architecture:

* keep the backend response as a flat list of comparison entries
* group entries by `sessionId` in the frontend presenter layer
* use the latest entry in each group as the session summary row
* keep mutation endpoints pointed at existing `historyId` records
* preserve `/results` as the deeper action workspace for advanced comparison actions

Why this is the correct boundary:

* the API already contains the fields needed for grouping
* the user problem is primarily visual and conceptual, not contract-blocked
* grouping client-side is lower risk than adding a new backend shape
* it keeps the sprint focused on clarity and regression safety

## Scope

### In scope

1. Rebrand `/history` content to `Revision Chains`
2. Group comparison rows into session cards by `sessionId`
3. Render session cards as collapsible accordions, collapsed by default
4. Show session summary metadata:
   * session name
   * owner
   * comparison count
   * newest comparison label
   * current/latest status markers
5. Render expanded comparison cards newest to oldest
6. Move rename into the expanded session content
7. Preserve private label/tag editing in the expanded session content
8. Preserve open and latest-only delete actions
9. Align the action icon style and card rhythm more closely with `/results`
10. Update browser coverage for the new grouped DOM

### Out of scope

* new backend history grouping endpoints
* share/export/upload-next-revision workflows launched directly from `/history`
* server-persisted history filters or saved views
* major results-page or upload-page changes
* replacing the `/results` session workspace as the canonical detailed action surface

## UX changes

### Page framing

1. Replace the table-first archive language with a `Revision Chains` surface.

2. Explain the page in plain language:
   * each card is one BOM session
   * each expanded item is one comparison created when a new revision was added

### Session grouping

3. Group all entries by session.

4. Show each session as a collapsible card that includes:
   * shared session name
   * owner
   * newest comparison
   * count of comparisons
   * state pills for `Open now`, `Latest revision`, and lifecycle status where relevant

5. Keep all cards collapsed by default.

### Expanded session state

6. When expanded, show:
   * editable session name
   * editable private label
   * the comparison chain as stacked cards

7. Order comparison cards newest first, oldest last.

8. Each comparison card should show:
   * comparison label
   * comparison date
   * owner
   * lifecycle status
   * current/latest markers when applicable
   * open action
   * delete action when allowed

### Action language

9. Rebrand field names where helpful:
   * `History` -> `Revision Chains`
   * `Session Name` -> `Session title`
   * `Tag` -> `Private label`
   * `Created` -> session or comparison timestamp copy inside the card instead of a table column

## Data contract changes

No backend contract change is required for this quick win.

Frontend responsibilities:

* group entries by `sessionId`
* derive session summary state from the grouped entries
* preserve mutation routing through existing `historyId` endpoints

## Stories

### S21-01 - Revision Chains presenter and grouped session model
As a history-page user, I want comparison entries grouped into session chains so that I can understand which BOM revisions belong together.

Status:
* `Completed`

### S21-02 - Collapsible session cards and session-level editing
As a reviewer, I want each BOM session to expand into an editable card so that I can rename the chain and manage its private label without using a flat admin table.

Status:
* `Completed`

### S21-03 - Comparison cards with preserved open/delete behavior
As a reviewer, I want each comparison in the chain rendered as a clear card with familiar actions so that reopening or removing the latest revision is easier to understand.

Status:
* `Completed`

### S21-04 - Rebrand, responsive polish, and regression coverage
As the delivery team, we need the redesigned history page to follow the upload/results visual language and remain stable under resize and regression tests.

Status:
* `Completed`

## Acceptance bar

* `/history` must no longer render the primary experience as a flat comparison table.
* Entries must be grouped by session and displayed as collapsed-by-default session cards.
* Expanded cards must show newest comparisons first and oldest last.
* Session rename must still work and continue to apply to the full chain.
* Private label/tag updates must remain possible.
* Opening a comparison from `/history` must still reopen the original comparison identity.
* Latest-only delete rules must remain enforced.
* The page must remain responsive without overlapping controls.
* The new page must visibly align more closely with the approved mock and the existing `/upload` and `/results` action styling.

## Completion note

Implemented and validated on `2026-03-16`.
