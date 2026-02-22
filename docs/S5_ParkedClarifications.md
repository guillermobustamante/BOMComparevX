# Stage 5 Parked Clarifications

Status: `Open - Parked for V2/V3`  
Scope: `S5`

## Purpose
Capture non-blocking Stage 5 clarifications intentionally deferred so Stage 5 can execute with locked defaults.

## Locked Stage 5 Defaults (Not Parked)

1. Sharing is multi-recipient, same-tenant, view-only, with explicit revoke.
2. Invite flow allows unregistered emails; access requires authentication as exact invited email.
3. Export mode is synchronous download only (CSV + Excel source-structure fidelity).
4. Export default is full dataset (not current filtered view).
5. Admin source of truth is database role claim with full admin UI.
6. Notification baseline triggers are comparison complete and failure only.
7. Stage 5 retention defaults:
   - export artifacts: 7 days
   - notifications: 90 days
   - share records: until revoke or owning session deletion

## Parked Items

1. Notification trigger expansion
- Deferred scope: share invite/revoke and export-complete notifications.
- Current default: comparison complete/failure only.

2. Notification reliability hardening
- Deferred scope: mandatory retry/backoff/dead-letter policy and alert thresholds.
- Current default: baseline delivery with config-driven optional email.

3. Retention policy tuning by tier/compliance class
- Deferred scope: differentiated retention by tenant plan, legal hold, compliance profile.
- Current default: fixed Stage 5 defaults.

4. Revocation UX/session propagation behavior
- Deferred scope: active-session interruption and real-time revoke propagation.
- Current default: hard revoke enforced on next authorized request.

5. Compliance payload expansion
- Deferred scope: enriched/standardized payload schema for export/share/admin audit events.
- Current default: baseline audit event logging for Stage 5 actions.

## Revisit Trigger
- Revisit before V2 planning kickoff or before enabling advanced notification and compliance workflows.
