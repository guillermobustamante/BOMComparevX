# Session Workspace, Security, and Performance - Parked Future Improvements

Date: 2026-03-15  
Primary audience: Product Manager, AI implementation agent  
Objective: Park near-future improvements that should not block the `Results Session Workspace Continuity` backlog, but should remain visible for follow-on planning.

## Why these items are parked

The current priority is to make session workflow usable now:

* shared session naming
* clear comparison-chain navigation
* active-session memory across pages
* lightweight performance improvements

These three items are important, but should not block that usability stage:

1. server-persisted recent workspace per user
2. stronger session security and authorization
3. broader performance hardening

## Parked item 1 - Server-persisted recent workspace per user

### Current stage decision

For the first session-workspace implementation, active session memory should be client-side only.

Reason:

* fastest path to better navigation continuity
* no new persistence dependency required for the first user-facing improvement
* keeps scope contained while session UX is still being proven

### Future target

Persist recent workspace state server-side per tenant and user so the system can restore the user’s active context across:

* browser refresh
* device changes
* multiple tabs
* longer-lived work sessions

### Recommended direction

Store a user-scoped recent workspace record such as:

```ts
interface RecentWorkspace {
  tenantId: string;
  userEmail: string;
  workspaceType: 'results_session';
  sessionId: string;
  historyId: string | null;
  leftRevisionId: string | null;
  rightRevisionId: string | null;
  updatedAtUtc: string;
}
```

Rules:

* explicit URL params always override recent workspace restore
* server workspace is advisory, not authoritative
* workspace restore should respect tenant boundaries and authorization checks

### Why this matters

* better cross-device continuity
* better recovery after sign-in roundtrips or refreshes
* reduced user frustration when returning to active work

## Parked item 2 - Robust session security and authorization model

### Current stage decision

For the current backlog, rename/delete session actions are intended for:

* session initiator
* tenant admins

That is acceptable for the near-term usability stage, but it is not a complete session-security model.

### Future target

Create a more explicit security model for session-scoped actions such as:

* rename session
* delete latest comparison
* reopen prior comparison
* upload next revision into an existing session
* share or govern session-level state

### Recommended direction

Add explicit session-action policy concepts, for example:

* `sessionOwner`
* `sessionContributor`
* `sessionViewer`
* `tenantAdmin`

And action policies such as:

* who can rename session metadata
* who can delete chain entries
* who can append new revisions
* whether shared viewers can reopen but not mutate

### Why this matters

* clearer governance for collaborative tenants
* less ambiguity than initiator-only or viewer-can-edit shortcuts
* stronger auditability for session mutation actions

## Parked item 3 - Performance hardening program

### Current stage decision

The current backlog should include only lightweight performance improvements:

* reduce unnecessary refetches
* reuse active session context where safe
* avoid avoidable same-session reload churn

This is useful, but it is not a full performance plan.

### Future target

Create a dedicated performance-hardening stage focused on page-load, navigation, and data-fetch budgets across:

* `/results`
* `/history`
* `/mappings`
* `/notifications`

### Recommended direction

Define measurable targets such as:

* time to return to active `/results` workspace
* time to open previous-comparisons modal
* time to switch between comparisons in the same session
* data-fetch counts per navigation flow

Candidate work areas:

* query deduplication
* cache strategy by session/comparison
* API contract trimming where payloads are oversized
* optimistic session-chain updates after rename/delete
* instrumentation around session-navigation latency

### Why this matters

* current UX concerns are no longer just visual
* users are beginning to feel slow navigation and page reload behavior
* performance should be enforced as a product quality attribute, not only fixed opportunistically

## Recommended follow-up sequence

After `S20`:

1. validate client-side session workspace behavior with real usage
2. promote active workspace to server persistence if the workflow proves valuable
3. formalize session-action authorization
4. run a dedicated performance-hardening stage with explicit acceptance targets

## Related record

Current execution-stage backlog:

* `BACKLOG_S20_RESULTS_SESSION_WORKSPACE_CONTINUITY.md`
